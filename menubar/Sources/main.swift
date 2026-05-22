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

struct UsageData {
    let today: DailyUsage?
    let weeklyTotalCost: Double
}

// MARK: - ccusage 호출

func findNpxPath() -> String {
    let candidates = [
        "/opt/homebrew/bin/npx",
        "/usr/local/bin/npx",
        "/usr/bin/npx",
    ]
    for path in candidates {
        if FileManager.default.fileExists(atPath: path) {
            return path
        }
    }
    return "npx"
}

func runCcusage() -> UsageData? {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: findNpxPath())
    process.arguments = ["ccusage", "daily", "--json"]

    // PATH 보강 (LSUIElement 환경은 PATH가 제한적)
    var env = ProcessInfo.processInfo.environment
    let extraPaths = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    if let existing = env["PATH"] {
        env["PATH"] = "\(extraPaths):\(existing)"
    } else {
        env["PATH"] = extraPaths
    }
    env["HOME"] = NSHomeDirectory()
    process.environment = env

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = Pipe() // stderr 무시

    do {
        try process.run()
    } catch {
        NSLog("cc-menubar: ccusage 실행 실패 — \(error.localizedDescription)")
        return nil
    }

    process.waitUntilExit()

    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    guard process.terminationStatus == 0, !data.isEmpty else {
        NSLog("cc-menubar: ccusage 종료 코드 \(process.terminationStatus)")
        return nil
    }

    return parseUsageData(from: data)
}

func parseUsageData(from data: Data) -> UsageData? {
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let dailyArray = json["daily"] as? [[String: Any]] else {
        NSLog("cc-menubar: JSON 파싱 실패")
        return nil
    }

    // 오늘 날짜 (YYYY-MM-DD)
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    let todayStr = formatter.string(from: Date())

    var days: [DailyUsage] = []
    for item in dailyArray {
        guard let period = item["period"] as? String else { continue }
        let totalCost = item["totalCost"] as? Double ?? 0.0
        let inputTokens = item["inputTokens"] as? Int ?? 0
        let cacheCreationTokens = item["cacheCreationTokens"] as? Int ?? 0
        let cacheReadTokens = item["cacheReadTokens"] as? Int ?? 0
        let outputTokens = item["outputTokens"] as? Int ?? 0

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

    return UsageData(today: today, weeklyTotalCost: weeklyTotalCost)
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

class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    var statusItem: NSStatusItem?
    var timer: Timer?
    var currentData: UsageData?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        // 상태바 아이템 생성
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        setTitle(loading: true)

        // 첫 메뉴 설정 (더미, 열릴 때 갱신됨)
        let menu = NSMenu()
        menu.delegate = self
        statusItem?.menu = menu

        // 초기 데이터 로딩
        refresh()

        // 60초 자동 갱신
        timer = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            self?.loadInBackground()
        }
        if let timer = timer {
            RunLoop.main.add(timer, forMode: .common)
        }
    }

    // MARK: - 타이틀 업데이트

    func setTitle(loading: Bool) {
        DispatchQueue.main.async { [weak self] in
            self?.statusItem?.button?.title = loading ? "🤖 …" : "🤖 ⚠️"
        }
    }

    func setTitleWithCost(_ cost: Double) {
        DispatchQueue.main.async { [weak self] in
            self?.statusItem?.button?.title = "🤖 \(formatCost(cost))"
        }
    }

    // MARK: - 데이터 로딩

    func refresh() {
        setTitle(loading: true)
        loadInBackground()
    }

    func loadInBackground() {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let data = runCcusage()
            DispatchQueue.main.async {
                self?.currentData = data
                if let cost = data?.today?.totalCost {
                    self?.setTitleWithCost(cost)
                } else {
                    self?.setTitle(loading: false)
                }
            }
        }
    }

    // MARK: - NSMenuDelegate

    func menuWillOpen(_ menu: NSMenu) {
        // 메뉴 열릴 때마다 최신 데이터로 항목 재구성
        menu.removeAllItems()

        if let usage = currentData, let today = usage.today {
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
        timer?.invalidate()
        NSApp.terminate(nil)
    }
}

// MARK: - 진입점

let delegate = AppDelegate()
let app = NSApplication.shared
app.delegate = delegate
app.run()
