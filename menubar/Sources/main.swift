import Cocoa
import Foundation

// MARK: - 데이터 모델

struct DailyUsage {
    let period: String
    let totalCost: Double
    let inputTokens: Int
    let cacheCreationTokens: Int
    let cacheReadTokens: Int
    let outputTokens: Int
    let models: [String]
}

// 일별 추이 한 점 (날짜 + 비용 + 토큰)
struct DayPoint {
    let date: String   // "2026-05-22"
    let cost: Double
    let tokens: Int
}

struct UsageData {
    let today: DailyUsage?
    let weeklyTotalCost: Double
    let allTimeCost: Double      // 누적 비용 ($ALL)
    let allTimeTokens: Int       // 누적 토큰 (BALL)
    let totalDays: Int           // 활동 일수
    let last7Costs: [Double]     // 최근 7일 일별 비용 (스파크라인용, 과거→오늘 순)
    let last14Costs: [Double]    // 최근 14일 일별 비용 (드롭다운 차트용)
    let recent7Days: [DayPoint]  // 최근 7일 일별 상세 (날짜+비용+토큰, 드롭다운 리스트용)
    let recent14Days: [DayPoint] // 최근 14일 일별 상세 (차트 날짜 라벨용)
}

// MARK: - ccusage 호출

// fnm symlink npx 직접 spawn — zsh 완전 우회 (launchd 환경에서 .zshrc 초기화가 hang하는 문제 회피).
// `~/.local/share/fnm/aliases/default/bin/npx`는 default Node 버전을 가리키는 안정 symlink.
// 실행 시 npx는 같은 디렉토리의 node 바이너리를 찾는다 → PATH에 fnm bin 명시 필수.
func runCcusage() -> UsageData? {
    let process = Process()
    let home = NSHomeDirectory()
    let fnmBin = "\(home)/.local/share/fnm/aliases/default/bin"
    process.executableURL = URL(fileURLWithPath: "\(fnmBin)/npx")
    process.arguments = ["--yes", "ccusage", "daily", "--json"]

    var env = ProcessInfo.processInfo.environment
    env["PATH"] = "\(fnmBin):/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    env["HOME"] = home
    process.environment = env

    // 142KB JSON > 64KB pipe buffer → 자식 write block deadlock 회피용 파일 redirect
    let tmpPath = "/tmp/cc-menubar-ccusage-\(getpid()).json"
    FileManager.default.createFile(atPath: tmpPath, contents: nil, attributes: nil)
    guard let writeHandle = FileHandle(forWritingAtPath: tmpPath) else {
        print("CCUSAGE-FAIL: tmp 파일 생성 실패 \(tmpPath)")
        fflush(stdout)
        return nil
    }
    process.standardOutput = writeHandle
    process.standardError = Pipe() // stderr는 작아서 pipe OK

    do {
        try process.run()
    } catch {
        print("CCUSAGE-FAIL: 실행 실패 — \(error.localizedDescription)")
        fflush(stdout)
        writeHandle.closeFile()
        return nil
    }

    // 20초 timeout — 정상 5~7초, hang 누적 방지용 안전망
    let deadline = DispatchTime.now() + .seconds(20)
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: deadline) {
        if process.isRunning {
            process.terminate()
            print("CCUSAGE-TIMEOUT: 20초 초과, 강제 종료")
            fflush(stdout)
        }
    }

    process.waitUntilExit()
    writeHandle.closeFile()

    let data = (try? Data(contentsOf: URL(fileURLWithPath: tmpPath))) ?? Data()
    try? FileManager.default.removeItem(atPath: tmpPath)
    print("CCUSAGE: exit=\(process.terminationStatus) bytes=\(data.count)")
    fflush(stdout)

    guard process.terminationStatus == 0, !data.isEmpty else {
        return nil
    }

    let parsed = parseUsageData(from: data)
    print("CCUSAGE-PARSE: today=\(parsed?.today?.period ?? "nil") cost=\(parsed?.today?.totalCost ?? -1)")
    fflush(stdout)
    return parsed
}

func parseUsageData(from data: Data) -> UsageData? {
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let dailyArray = json["daily"] as? [[String: Any]] else {
        print("CCUSAGE-PARSE-FAIL: JSON 파싱 실패 (data prefix: \(String(data: data.prefix(120), encoding: .utf8) ?? "non-utf8"))")
        fflush(stdout)
        return nil
    }
    print("CCUSAGE-PARSE: dailyArray.count=\(dailyArray.count)")
    fflush(stdout)

    // 오늘 날짜 (YYYY-MM-DD)
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    let todayStr = formatter.string(from: Date())

    // JSON 큰 수는 NSNumber로 와서 Int/Double 캐스팅이 변동 가능 → 안전 추출
    func numInt(_ v: Any?) -> Int {
        if let n = v as? Int { return n }
        if let d = v as? Double { return Int(d) }
        if let n = v as? NSNumber { return n.intValue }
        return 0
    }
    func numDouble(_ v: Any?) -> Double {
        if let d = v as? Double { return d }
        if let n = v as? NSNumber { return n.doubleValue }
        return 0.0
    }

    var days: [DailyUsage] = []
    for item in dailyArray {
        guard let period = item["period"] as? String else { continue }
        let totalCost = numDouble(item["totalCost"])
        let inputTokens = numInt(item["inputTokens"])
        let cacheCreationTokens = numInt(item["cacheCreationTokens"])
        let cacheReadTokens = numInt(item["cacheReadTokens"])
        let outputTokens = numInt(item["outputTokens"])

        var models: [String] = []
        if let breakdowns = item["modelBreakdowns"] as? [[String: Any]] {
            // 비용 기준 내림차순 정렬, 상위 2개 모델명 추출
            let sorted = breakdowns.sorted { ($0["cost"] as? Double ?? 0) > ($1["cost"] as? Double ?? 0) }
            for bd in sorted.prefix(2) {
                if let name = bd["modelName"] as? String {
                    models.append(shortenModelName(name))
                }
            }
        }

        days.append(DailyUsage(
            period: period,
            totalCost: totalCost,
            inputTokens: inputTokens,
            cacheCreationTokens: cacheCreationTokens,
            cacheReadTokens: cacheReadTokens,
            outputTokens: outputTokens,
            models: models
        ))
    }

    // 오늘 데이터
    let today = days.first(where: { $0.period == todayStr }) ?? days.last

    // 주간 비용: 최근 7일
    let recentDays = Array(days.suffix(7))
    let weeklyTotalCost = recentDays.reduce(0.0) { $0 + $1.totalCost }

    // 누적 — totals 블록 우선, 없으면 days 합산
    let totalsObj = json["totals"] as? [String: Any]
    let allTimeCost: Double
    let allTimeTokens: Int
    if let t = totalsObj {
        allTimeCost = numDouble(t["totalCost"])
        allTimeTokens = numInt(t["totalTokens"])
    } else {
        allTimeCost = days.reduce(0.0) { $0 + $1.totalCost }
        allTimeTokens = days.reduce(0) {
            $0 + $1.inputTokens + $1.cacheCreationTokens + $1.cacheReadTokens + $1.outputTokens
        }
    }

    // 스파크라인/차트용 일별 비용 배열 (과거→오늘 순)
    let last7 = Array(days.suffix(7))
    let last14 = Array(days.suffix(14))
    let last7Costs = last7.map { $0.totalCost }
    let last14Costs = last14.map { $0.totalCost }

    // 일별 추이 상세 (날짜 + 비용 + 토큰)
    func toPoint(_ d: DailyUsage) -> DayPoint {
        DayPoint(
            date: d.period,
            cost: d.totalCost,
            tokens: d.inputTokens + d.cacheCreationTokens + d.cacheReadTokens + d.outputTokens
        )
    }
    let recent7Days = last7.map(toPoint)
    let recent14Days = last14.map(toPoint)

    return UsageData(
        today: today,
        weeklyTotalCost: weeklyTotalCost,
        allTimeCost: allTimeCost,
        allTimeTokens: allTimeTokens,
        totalDays: days.count,
        last7Costs: last7Costs,
        last14Costs: last14Costs,
        recent7Days: recent7Days,
        recent14Days: recent14Days
    )
}

// MARK: - 병렬 Claude Code 세션 감지

/// 현재 실행 중인 Claude CLI 인스턴스 수.
/// `claude --effort` 또는 `claude` 명령 패턴으로 감지. ccusage/cc-menubar 같은 자식 프로세스는 자동 제외.
func countParallelClaudeSessions() -> Int {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
    process.arguments = ["-f", "^claude( |$)"]

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = Pipe()

    do { try process.run() } catch { return 0 }
    process.waitUntilExit()

    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    guard let str = String(data: data, encoding: .utf8) else { return 0 }
    return str.split(separator: "\n").filter { !$0.isEmpty }.count
}

// MARK: - 그래픽 렌더링 (메뉴바 스파크라인 + 펄스 도트)

/// 메뉴바용 미니 스파크라인 NSImage. 최근 N일 비용을 막대 그래프로.
/// 마지막 막대(오늘)는 강조색, 나머지는 중간톤. 다크/라이트 자동 대응 위해 isTemplate=false 컬러 직접.
func makeSparklineImage(_ values: [Double], width: CGFloat = 34, height: CGFloat = 16) -> NSImage {
    let image = NSImage(size: NSSize(width: width, height: height))
    image.lockFocus()
    defer { image.unlockFocus() }

    guard !values.isEmpty, let maxV = values.max(), maxV > 0 else { return image }

    let count = values.count
    let gap: CGFloat = 1.5
    let barW = max(1.5, (width - gap * CGFloat(count - 1)) / CGFloat(count))
    let minBarH: CGFloat = 2.0

    for (i, v) in values.enumerated() {
        let ratio = CGFloat(v / maxV)
        let barH = max(minBarH, ratio * (height - 1))
        let x = CGFloat(i) * (barW + gap)
        let rect = NSRect(x: x, y: 0, width: barW, height: barH)
        let path = NSBezierPath(roundedRect: rect, xRadius: 0.8, yRadius: 0.8)
        // 마지막(오늘) 막대는 초록 강조, 나머지는 청록 그라데이션 톤
        if i == count - 1 {
            NSColor(calibratedRed: 0.16, green: 0.65, blue: 0.20, alpha: 1.0).setFill() // 초록 (오늘)
        } else {
            let alpha = 0.35 + 0.45 * (CGFloat(i) / CGFloat(max(count - 1, 1))) // 과거→최근 점점 진하게
            NSColor(calibratedRed: 0.0, green: 0.64, blue: 0.59, alpha: alpha).setFill() // 청록
        }
        path.fill()
    }
    return image
}

/// 펄스 도트 NSImage — 활성 시 채워진 컬러 원(프레임에 따라 크기 변동), idle 시 빈 회색 원.
func makePulseDot(active: Bool, frame: Int, size: CGFloat = 11) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    defer { image.unlockFocus() }

    let center = NSPoint(x: size / 2, y: size / 2)
    if active {
        // 활성: 초록 채움 + 프레임에 따라 반경 펄스 (숨쉬는 효과)
        let pulse = [0.32, 0.42, 0.50, 0.42][frame % 4]
        let r = size * CGFloat(pulse)
        // 외곽 글로우
        let glowR = r + 2
        NSColor(calibratedRed: 0.16, green: 0.78, blue: 0.25, alpha: 0.25).setFill()
        NSBezierPath(ovalIn: NSRect(x: center.x - glowR, y: center.y - glowR, width: glowR * 2, height: glowR * 2)).fill()
        // 본체
        NSColor(calibratedRed: 0.16, green: 0.78, blue: 0.25, alpha: 1.0).setFill()
        NSBezierPath(ovalIn: NSRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2)).fill()
    } else {
        // idle: 회색 외곽선 원
        let r = size * 0.34
        let path = NSBezierPath(ovalIn: NSRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2))
        NSColor(calibratedWhite: 0.55, alpha: 0.7).setStroke()
        path.lineWidth = 1.4
        path.stroke()
    }
    return image
}

// MARK: - 드롭다운 차트 NSView

/// "2026-05-22" → "5/22" 날짜 축약
func shortDate(_ ymd: String) -> String {
    let parts = ymd.split(separator: "-")
    guard parts.count == 3 else { return ymd }
    let m = Int(parts[1]) ?? 0
    let d = Int(parts[2]) ?? 0
    return "\(m)/\(d)"
}

private let _ymdFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    f.locale = Locale(identifier: "en_US_POSIX")
    return f
}()

/// "2026-05-22" → Date (오늘 판정용)
func dateFromYMD(_ ymd: String) -> Date? {
    _ymdFormatter.date(from: ymd)
}

/// 14일 비용 추이 막대 차트 — 날짜축 라벨 + 최고값 표시 + 오늘 강조. 다크 메뉴 배경 가정.
final class TrendChartView: NSView {
    var points: [DayPoint] = []

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let w = bounds.width, h = bounds.height
        let padL: CGFloat = 12, padR: CGFloat = 12, padT: CGFloat = 22, padB: CGFloat = 16
        let chartW = w - padL - padR
        let chartH = h - padT - padB

        // 제목 + 최고값
        let titleAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: NSColor.secondaryLabelColor,
        ]
        "최근 \(points.count)일 비용 추이".draw(at: NSPoint(x: padL, y: h - 16), withAttributes: titleAttr)

        guard !points.isEmpty, let maxV = points.map({ $0.cost }).max(), maxV > 0 else { return }
        let count = points.count
        let gap: CGFloat = 2.5
        let barW = max(2, (chartW - gap * CGFloat(count - 1)) / CGFloat(count))

        // 우상단에 최고값 표시 (피크 일자)
        if let peak = points.max(by: { $0.cost < $1.cost }) {
            let peakStr = "최고 \(formatCost(peak.cost)) (\(shortDate(peak.date)))"
            let peakAttr: [NSAttributedString.Key: Any] = [
                .font: NSFont.monospacedDigitSystemFont(ofSize: 8.5, weight: .medium),
                .foregroundColor: NSColor.tertiaryLabelColor,
            ]
            let sz = peakStr.size(withAttributes: peakAttr)
            peakStr.draw(at: NSPoint(x: w - padR - sz.width, y: h - 15), withAttributes: peakAttr)
        }

        for (i, p) in points.enumerated() {
            let ratio = CGFloat(p.cost / maxV)
            let barH = max(1.5, ratio * chartH)
            let x = padL + CGFloat(i) * (barW + gap)
            let y = padB
            let rect = NSRect(x: x, y: y, width: barW, height: barH)
            let path = NSBezierPath(roundedRect: rect, xRadius: 1.2, yRadius: 1.2)
            let isToday = i == count - 1
            if isToday {
                NSColor(calibratedRed: 0.16, green: 0.70, blue: 0.22, alpha: 1.0).setFill()
            } else {
                let a = 0.4 + 0.45 * (CGFloat(i) / CGFloat(max(count - 1, 1)))
                NSColor(calibratedRed: 0.18, green: 0.45, blue: 0.82, alpha: a).setFill()
            }
            path.fill()
        }

        // x축 날짜 라벨 — 양 끝 + 중간 (3개, 겹침 방지)
        let lblAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 8, weight: .regular),
            .foregroundColor: NSColor.tertiaryLabelColor,
        ]
        let labelIdxs = count >= 3 ? [0, count / 2, count - 1] : Array(0..<count)
        for idx in labelIdxs {
            let x = padL + CGFloat(idx) * (barW + gap)
            let label = idx == count - 1 ? "오늘" : shortDate(points[idx].date)
            let sz = label.size(withAttributes: lblAttr)
            // 막대 중심 정렬, 화면 밖 클리핑 방지
            var lx = x + barW / 2 - sz.width / 2
            lx = max(padL, min(lx, w - padR - sz.width))
            label.draw(at: NSPoint(x: lx, y: 2), withAttributes: lblAttr)
        }
    }
}

/// 일별 추이 한 행 — [날짜] [인라인 미니바] [비용] [토큰]. 드롭다운 리스트용.
final class DailyRowView: NSView {
    var point: DayPoint?
    var maxCost: Double = 1

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard let p = point else { return }
        let w = bounds.width, h = bounds.height
        let padL: CGFloat = 14, padR: CGFloat = 14
        let isToday = Calendar.current.isDateInToday(dateFromYMD(p.date) ?? Date.distantPast)

        // 1) 날짜 (좌측, 고정폭)
        let dateAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 10.5, weight: isToday ? .bold : .regular),
            .foregroundColor: isToday ? NSColor.labelColor : NSColor.secondaryLabelColor,
        ]
        let dateStr = isToday ? "오늘" : shortDate(p.date)
        dateStr.draw(at: NSPoint(x: padL, y: (h - 14) / 2), withAttributes: dateAttr)

        // 2) 인라인 미니바 (중앙)
        let barX: CGFloat = padL + 42
        let barMaxW: CGFloat = 90
        let barH: CGFloat = 7
        let barY = (h - barH) / 2
        // 트랙
        NSColor(calibratedWhite: 1.0, alpha: 0.10).setFill()
        NSBezierPath(roundedRect: NSRect(x: barX, y: barY, width: barMaxW, height: barH), xRadius: 3, yRadius: 3).fill()
        // 채움
        let ratio = maxCost > 0 ? CGFloat(p.cost / maxCost) : 0
        if ratio > 0 {
            let fw = max(3, barMaxW * ratio)
            if isToday {
                NSColor(calibratedRed: 0.16, green: 0.70, blue: 0.22, alpha: 1.0).setFill()
            } else {
                NSColor(calibratedRed: 0.20, green: 0.52, blue: 0.85, alpha: 0.85).setFill()
            }
            NSBezierPath(roundedRect: NSRect(x: barX, y: barY, width: fw, height: barH), xRadius: 3, yRadius: 3).fill()
        }

        // 3) 비용 (우측 정렬)
        let costAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 10.5, weight: .medium),
            .foregroundColor: isToday ? NSColor(calibratedRed: 0.20, green: 0.78, blue: 0.30, alpha: 1.0) : NSColor.labelColor,
        ]
        let costStr = formatCost(p.cost)
        let costSz = costStr.size(withAttributes: costAttr)
        // 토큰 (비용 우측에 작게)
        let tokAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 8.5, weight: .regular),
            .foregroundColor: NSColor.tertiaryLabelColor,
        ]
        let tokStr = formatTokens(p.tokens)
        let tokSz = tokStr.size(withAttributes: tokAttr)

        tokStr.draw(at: NSPoint(x: w - padR - tokSz.width, y: (h - 12) / 2), withAttributes: tokAttr)
        costStr.draw(at: NSPoint(x: w - padR - tokSz.width - 8 - costSz.width, y: (h - 14) / 2), withAttributes: costAttr)
    }
}

/// 병렬 세션 게이지 바 NSView — 가로 막대로 동시 실행 수 시각화.
final class ParallelGaugeView: NSView {
    var count: Int = 0
    var maxScale: Int = 16   // 게이지 풀스케일 기준 (초과 시 100%)

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let w = bounds.width, h = bounds.height
        let padL: CGFloat = 12, padR: CGFloat = 12

        // 라벨
        let labelAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: NSColor.secondaryLabelColor,
        ]
        "병렬 실행 중".draw(at: NSPoint(x: padL, y: h - 15), withAttributes: labelAttr)

        // 카운트 숫자 (우측, 큰 글씨)
        let numAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .bold),
            .foregroundColor: NSColor(calibratedRed: 0.16, green: 0.70, blue: 0.22, alpha: 1.0),
        ]
        let numStr = "\(count)개"
        let numSize = numStr.size(withAttributes: numAttr)
        numStr.draw(at: NSPoint(x: w - padR - numSize.width, y: h - 16), withAttributes: numAttr)

        // 게이지 트랙
        let trackY: CGFloat = 5, trackH: CGFloat = 6
        let trackW = w - padL - padR
        let trackRect = NSRect(x: padL, y: trackY, width: trackW, height: trackH)
        NSColor(calibratedWhite: 1.0, alpha: 0.12).setFill()
        NSBezierPath(roundedRect: trackRect, xRadius: 3, yRadius: 3).fill()

        // 채움
        let ratio = min(1.0, CGFloat(count) / CGFloat(maxScale))
        if ratio > 0 {
            let fillRect = NSRect(x: padL, y: trackY, width: max(4, trackW * ratio), height: trackH)
            // 비율 따라 색 변화: 낮음=청록, 높음=주황
            let color: NSColor = ratio > 0.75
                ? NSColor(calibratedRed: 0.90, green: 0.55, blue: 0.10, alpha: 1.0)
                : NSColor(calibratedRed: 0.16, green: 0.70, blue: 0.45, alpha: 1.0)
            color.setFill()
            NSBezierPath(roundedRect: fillRect, xRadius: 3, yRadius: 3).fill()
        }
    }
}

// MARK: - 포맷 헬퍼

func shortenModelName(_ name: String) -> String {
    let lower = name.lowercased()
    if lower.contains("opus") {
        return "Opus\(extractVersion(name))"
    } else if lower.contains("sonnet") {
        return "Sonnet\(extractVersion(name))"
    } else if lower.contains("haiku") {
        return "Haiku\(extractVersion(name))"
    } else if lower.hasPrefix("gpt") {
        // gpt-5.5 → GPT-5.5
        return name.uppercased()
    }
    return String(name.suffix(20))
}

func extractVersion(_ name: String) -> String {
    // claude-opus-4-7 → 4.7
    let parts = name.split(separator: "-")
    var nums: [String] = []
    for part in parts where part.allSatisfy({ $0.isNumber }) {
        nums.append(String(part))
    }
    if nums.count >= 2 {
        return "\(nums[nums.count-2]).\(nums[nums.count-1])"
    } else if nums.count == 1 {
        return nums[0]
    }
    return ""
}

func formatTokens(_ count: Int) -> String {
    if count >= 1_000_000_000 {
        return String(format: "%.1fB", Double(count) / 1_000_000_000)
    } else if count >= 1_000_000 {
        return String(format: "%.1fM", Double(count) / 1_000_000)
    } else {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: count)) ?? "\(count)"
    }
}

func formatCost(_ cost: Double) -> String {
    String(format: "$%.2f", cost)
}

// MARK: - AppDelegate

// MARK: - 활동 감지 (Claude Code 세션 JSONL 폴링)

/// ~/.claude/projects/ 하위 프로젝트 디렉토리 중 최근 60초 내 수정된 게 있으면 ACTIVE.
/// 디렉토리 mtime은 OS가 자식 jsonl 변경 시 자동 갱신해주므로, 전체 파일 트리 traverse 없이
/// 1-depth 디렉토리 stat만으로 활동 감지 가능. (26K+ jsonl 트리 traverse 회피)
func isClaudeActive() -> Bool {
    let projectsDir = NSHomeDirectory() + "/.claude/projects"
    let fm = FileManager.default
    guard let subdirs = try? fm.contentsOfDirectory(atPath: projectsDir) else { return false }

    let threshold = Date().addingTimeInterval(-60)
    for name in subdirs {
        let path = projectsDir + "/" + name
        if let attrs = try? fm.attributesOfItem(atPath: path),
           let mtime = attrs[.modificationDate] as? Date,
           mtime > threshold {
            return true
        }
    }
    return false
}

class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    var statusItem: NSStatusItem?
    var dataTimer: Timer?       // ccusage 갱신 (60초)
    var rollTimer: Timer?       // 정보 롤링 + 펄스 (1초)
    var activityTimer: Timer?   // 활동 감지 (5초)
    var currentData: UsageData?

    // 롤링 상태
    var rollIndex = 0       // 현재 표시 중인 정보 슬롯
    var pulseFrame = 0      // 펄스 애니메이션 프레임 (0~3)
    var tickCount = 0       // 1초 tick 누적 (5의 배수마다 슬롯 전환)
    var isActive = false    // 최근 활동 감지 결과
    var parallelCount = 0   // 현재 병렬 실행 중인 Claude Code 인스턴스 수
    var isFetching = false  // ccusage 호출 진행 중 플래그 (동시 호출 방지 — 좀비 누적 차단)

    // 펄스 프레임: 활성일 때 회전, idle일 때 정지
    let pulseFramesActive = ["●", "◐", "○", "◐"]
    let pulseFrameIdle = "○"

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        setLoading()

        let menu = NSMenu()
        menu.delegate = self
        statusItem?.menu = menu

        refresh()
        updateActivity() // 즉시 첫 감지

        // 1초마다: 펄스 프레임 회전 + tickCount 누적 (5의 배수에서 슬롯 전환)
        rollTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.tick()
        }
        if let t = rollTimer { RunLoop.main.add(t, forMode: .common) }

        // 15초마다 활동 감지 (1-depth dir mtime만 stat — 매우 가벼움)
        activityTimer = Timer.scheduledTimer(withTimeInterval: 15.0, repeats: true) { [weak self] _ in
            self?.updateActivity()
        }
        if let t = activityTimer { RunLoop.main.add(t, forMode: .common) }

        // 60초마다 ccusage 갱신
        dataTimer = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            self?.loadInBackground()
        }
        if let t = dataTimer { RunLoop.main.add(t, forMode: .common) }
    }

    // MARK: - Tick (1초마다 호출)

    func tick() {
        pulseFrame = (pulseFrame + 1) % pulseFramesActive.count
        tickCount += 1
        // 5초마다 표시 슬롯 전환
        if tickCount % 5 == 0 {
            rollIndex = (rollIndex + 1) % displaySlots().count
        }
        updateTitle()
    }

    func updateActivity() {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let active = isClaudeActive()
            let parallel = countParallelClaudeSessions()
            DispatchQueue.main.async {
                self?.isActive = active
                self?.parallelCount = parallel
            }
        }
    }

    // MARK: - 타이틀 조립

    /// 롤링 표시 슬롯 (5초마다 순환). 데이터 없으면 병렬 세션 수만 표시.
    func displaySlots() -> [String] {
        // 데이터 없으면 최소 정보 — 병렬 세션 수만이라도 의미 있음
        guard let usage = currentData, let today = usage.today else {
            return ["병렬 \(parallelCount)"]
        }
        let todayTokens = today.inputTokens + today.cacheCreationTokens
                        + today.cacheReadTokens + today.outputTokens
        return [
            "오늘 \(formatCost(today.totalCost))",         // 오늘 비용
            "토큰 \(formatTokens(todayTokens))",            // 오늘 토큰
            "누적 \(formatCost(usage.allTimeCost))",         // 누적 비용 ($23.3K)
            "총 \(formatTokens(usage.allTimeTokens))",       // 누적 토큰 (28.3B)
            "병렬 \(parallelCount)",                          // 동시 실행 Claude 수
            "주간 \(formatCost(usage.weeklyTotalCost))",     // 주간 비용
            today.models.first ?? "Claude",                  // 주력 모델
        ]
    }

    func setLoading() {
        DispatchQueue.main.async { [weak self] in
            self?.statusItem?.button?.title = "○ 로딩…"
        }
    }

    func updateTitle() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let button = self.statusItem?.button else { return }

            let slots = self.displaySlots()
            let info = slots[self.rollIndex % slots.count]
            let activeMark = self.isActive ? " ⚡" : ""
            let text = "\(info)\(activeMark)"

            // 좌측: 펄스 도트(활성=초록 숨쉬기, idle=회색 링) + 스파크라인 미니 차트
            let pulseDot = makePulseDot(active: self.isActive, frame: self.pulseFrame)

            // 합성 이미지: [펄스 도트][스파크라인] 가로 배치
            let dotW = pulseDot.size.width
            let sparkline = self.currentData.map { makeSparklineImage($0.last7Costs) }
            let sparkW = sparkline?.size.width ?? 0
            let composedW = dotW + (sparkW > 0 ? 4 + sparkW : 0)
            let composedH: CGFloat = 16

            let composed = NSImage(size: NSSize(width: composedW, height: composedH))
            composed.lockFocus()
            pulseDot.draw(at: NSPoint(x: 0, y: (composedH - pulseDot.size.height) / 2), from: .zero, operation: .sourceOver, fraction: 1.0)
            if let s = sparkline {
                s.draw(at: NSPoint(x: dotW + 4, y: 0), from: .zero, operation: .sourceOver, fraction: 1.0)
            }
            composed.unlockFocus()
            composed.isTemplate = false

            button.image = composed
            button.imagePosition = .imageLeading
            button.title = " \(text)"

            print("TITLE[tick=\(self.tickCount) slot=\(self.rollIndex) active=\(self.isActive)] [dot+spark] \(text)")
            fflush(stdout)
        }
    }

    // MARK: - 데이터 로딩

    func refresh() {
        setLoading()
        loadInBackground()
    }

    func loadInBackground() {
        // 동시 호출 방지 — 이전 ccusage 호출이 끝나기 전 새 호출 금지.
        // (없으면 느린 호출이 겹쳐 ccusage 자식 프로세스가 무한 누적되는 버그 — 426개 좀비 사고)
        guard !isFetching else {
            print("CCUSAGE-SKIP: 이전 호출 진행 중, 건너뜀")
            fflush(stdout)
            return
        }
        isFetching = true
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let data = runCcusage()
            DispatchQueue.main.async {
                self?.isFetching = false
                if let data = data {
                    self?.currentData = data // 실패 시 기존 데이터 유지 (깜빡임 방지)
                }
                self?.updateTitle()
            }
        }
    }

    // MARK: - NSMenuDelegate

    func menuWillOpen(_ menu: NSMenu) {
        // 메뉴 열릴 때마다 최신 데이터로 항목 재구성
        menu.removeAllItems()

        if let usage = currentData, let today = usage.today {
            // 활성 상태 + 병렬 세션 (항상 상단)
            let activeLabel = isActive ? "⚡ 작업 중" : "○ 대기"
            let statusMenuItem = NSMenuItem(title: "현재 상태:   \(activeLabel)", action: nil, keyEquivalent: "")
            statusMenuItem.isEnabled = false
            menu.addItem(statusMenuItem)

            // 병렬 세션 게이지 차트
            let gauge = ParallelGaugeView(frame: NSRect(x: 0, y: 0, width: 240, height: 32))
            gauge.count = parallelCount
            let gaugeItem = NSMenuItem()
            gaugeItem.view = gauge
            menu.addItem(gaugeItem)

            menu.addItem(NSMenuItem.separator())

            // 14일 추이 막대 차트 (날짜축 + 피크 표시)
            let chart = TrendChartView(frame: NSRect(x: 0, y: 0, width: 260, height: 88))
            chart.points = usage.recent14Days
            let chartItem = NSMenuItem()
            chartItem.view = chart
            menu.addItem(chartItem)

            menu.addItem(NSMenuItem.separator())

            // 최근 7일 일별 상세 (날짜 + 비용 + 인라인 미니바) — 정확한 일별 추이 확인용
            let dailyHeader = NSMenuItem(title: "일별 추이 (최근 7일)", action: nil, keyEquivalent: "")
            dailyHeader.isEnabled = false
            menu.addItem(dailyHeader)

            let maxDayCost = usage.recent7Days.map { $0.cost }.max() ?? 1
            // 최신(오늘)이 위로 오도록 역순
            for p in usage.recent7Days.reversed() {
                let row = DailyRowView(frame: NSRect(x: 0, y: 0, width: 260, height: 20))
                row.point = p
                row.maxCost = maxDayCost
                let item = NSMenuItem()
                item.view = row
                menu.addItem(item)
            }

            menu.addItem(NSMenuItem.separator())

            // 오늘
            let costItem = NSMenuItem(title: "오늘 비용:   \(formatCost(today.totalCost))", action: nil, keyEquivalent: "")
            costItem.isEnabled = false
            menu.addItem(costItem)

            let allTokens = today.inputTokens + today.cacheCreationTokens + today.cacheReadTokens + today.outputTokens
            let tokenItem = NSMenuItem(title: "오늘 토큰:   \(formatTokens(allTokens))", action: nil, keyEquivalent: "")
            tokenItem.isEnabled = false
            menu.addItem(tokenItem)

            let weekItem = NSMenuItem(title: "주간 비용:   \(formatCost(usage.weeklyTotalCost))", action: nil, keyEquivalent: "")
            weekItem.isEnabled = false
            menu.addItem(weekItem)

            menu.addItem(NSMenuItem.separator())

            // 누적 (전체 기간)
            let allCostItem = NSMenuItem(title: "누적 비용:   \(formatCost(usage.allTimeCost))  (\(usage.totalDays)일)", action: nil, keyEquivalent: "")
            allCostItem.isEnabled = false
            menu.addItem(allCostItem)

            let allTokenItem = NSMenuItem(title: "누적 토큰:   \(formatTokens(usage.allTimeTokens))", action: nil, keyEquivalent: "")
            allTokenItem.isEnabled = false
            menu.addItem(allTokenItem)

            if !today.models.isEmpty {
                menu.addItem(NSMenuItem.separator())
                let modelsStr = today.models.joined(separator: ", ")
                let modelItem = NSMenuItem(title: "사용 모델:   \(modelsStr)", action: nil, keyEquivalent: "")
                modelItem.isEnabled = false
                menu.addItem(modelItem)
            }
        } else {
            let noData = NSMenuItem(title: "데이터 없음 (ccusage 확인 필요)", action: nil, keyEquivalent: "")
            noData.isEnabled = false
            menu.addItem(noData)
        }

        menu.addItem(NSMenuItem.separator())

        let refreshItem = NSMenuItem(title: "↻  새로고침", action: #selector(refreshAction), keyEquivalent: "r")
        refreshItem.target = self
        menu.addItem(refreshItem)

        let openItem = NSMenuItem(title: "📊 cc-visualizer 열기", action: #selector(openCCVisualizer), keyEquivalent: "")
        openItem.target = self
        menu.addItem(openItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "종료", action: #selector(quitAction), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)
    }

    // MARK: - 액션

    @objc func refreshAction() {
        refresh()
    }

    @objc func openCCVisualizer() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        task.arguments = ["-a", "CC Visualizer"]
        try? task.run()
    }

    @objc func quitAction() {
        dataTimer?.invalidate()
        rollTimer?.invalidate()
        activityTimer?.invalidate()
        NSApp.terminate(nil)
    }
}

// MARK: - 진입점

let delegate = AppDelegate()
let app = NSApplication.shared
app.delegate = delegate
app.run()
