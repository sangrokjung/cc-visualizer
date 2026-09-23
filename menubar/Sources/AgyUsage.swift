import Foundation

// agy(Antigravity CLI) 할당량. 인쇄 모드 `/usage`만 읽는다.
// 이 명령은 모델 턴을 시작하지 않는다. 응답 원문과 계정 식별자는 로그에 남기지 않는다.

let agyUsageFetchInterval: TimeInterval = 60
// 호출은 보통 5~7초. 호스트가 포화되면 더 걸리므로 폴링 주기보다 짧게, 넉넉히 잡는다.
let agyFetchTimeout: TimeInterval = 40
let agyKillGrace: TimeInterval = 3

struct AgyQuotaBucket: Equatable {
    var remaining: Double
    var resetAt: Date?
}

struct AgyQuotaGroup: Equatable {
    var name: String
    var weekly: AgyQuotaBucket?
    var fiveHour: AgyQuotaBucket?
}

struct AgyCardModel: Equatable {
    var message: String?
    var groups: [AgyQuotaGroup]
}

enum AgyFetchOutcome: Equatable {
    case missing
    case ready([AgyQuotaGroup])
    case failed
}

func agyExecutableURL() -> URL? {
    if let override = ProcessInfo.processInfo.environment["CC_MENUBAR_AGY_BIN"], !override.isEmpty {
        return FileManager.default.isExecutableFile(atPath: override) ? URL(fileURLWithPath: override) : nil
    }
    let home = NSHomeDirectory()
    let candidates = [
        "\(home)/bin/agy",
        "/opt/homebrew/bin/agy",
        "/usr/local/bin/agy",
    ]
    for path in candidates where FileManager.default.isExecutableFile(atPath: path) {
        return URL(fileURLWithPath: path)
    }
    return nil
}

func agyFiniteFraction(_ value: Any?) -> Double? {
    let number: Double?
    if let parsed = value as? Double {
        number = parsed
    } else if let parsed = value as? Int {
        number = Double(parsed)
    } else if let parsed = value as? NSNumber {
        number = parsed.doubleValue
    } else {
        number = nil
    }
    guard let number, number.isFinite, number >= 0, number <= 1 else { return nil }
    return number
}

func agyRemainingLabel(_ fraction: Double) -> String? {
    guard let fraction = agyFiniteFraction(fraction) else { return nil }
    let tenth = (fraction * 1000).rounded() / 10
    if abs(tenth - tenth.rounded()) < 0.001 {
        return "\(Int(tenth.rounded()))% 남음"
    }
    let formatted = String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), tenth)
    return "\(formatted)% 남음"
}

func agyDisplayName(_ name: String) -> String {
    let folded = name.lowercased()
    if folded.contains("gemini") { return "Gemini 모델" }
    if folded.contains("claude") || folded.contains("gpt") { return "Claude·GPT" }
    return name
}

func agyResetHint(_ date: Date?, now: Date) -> String? {
    guard let date else { return nil }
    let seconds = date.timeIntervalSince(now)
    if seconds <= 0 { return "곧 리셋" }
    let minutes = Int(seconds / 60)
    if minutes < 60 { return "\(max(minutes, 1))분 뒤" }
    let hours = minutes / 60
    if hours < 48 { return "\(hours)시간 뒤" }
    return "\(hours / 24)일 뒤"
}

func agyLogLine(_ card: AgyCardModel) -> String {
    if card.groups.isEmpty {
        return card.message ?? "agy 확인 중"
    }
    return card.groups.prefix(2).map { group in
        let weekly = group.weekly.flatMap { agyRemainingLabel($0.remaining) } ?? "주간 확인 필요"
        let fiveHour = group.fiveHour.flatMap { agyRemainingLabel($0.remaining) } ?? "5시간 확인 필요"
        return "\(agyDisplayName(group.name)) \(weekly) / \(fiveHour)"
    }.joined(separator: " · ")
}

func agyQuotaGroups(from data: Data) -> [AgyQuotaGroup]? {
    guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
    if let turns = root["num_turns"] as? Int, turns != 0 { return nil }
    if let turns = root["num_turns"] as? NSNumber, turns.intValue != 0 { return nil }
    guard let command = root["command"] as? [String: Any],
          (command["name"] as? String) == "usage",
          let payload = command["data"] as? [String: Any],
          let rawGroups = payload["groups"] as? [Any] else {
        return nil
    }

    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let plain = ISO8601DateFormatter()
    plain.formatOptions = [.withInternetDateTime]

    var groups: [AgyQuotaGroup] = []
    for item in rawGroups {
        guard let row = item as? [String: Any],
              let name = row["name"] as? String,
              !name.isEmpty,
              let buckets = row["buckets"] as? [Any] else {
            return nil
        }
        var weekly: AgyQuotaBucket?
        var fiveHour: AgyQuotaBucket?
        for bucket in buckets {
            guard let bucket = bucket as? [String: Any],
                  let window = bucket["window"] as? String,
                  window == "weekly" || window == "5h" else {
                continue
            }
            guard let remaining = agyFiniteFraction(bucket["remaining_fraction"]) else {
                return nil
            }
            var resetAt: Date?
            if let raw = bucket["reset_time"] as? String {
                resetAt = fractional.date(from: raw) ?? plain.date(from: raw)
            }
            let parsed = AgyQuotaBucket(remaining: remaining, resetAt: resetAt)
            if window == "weekly" {
                weekly = parsed
            } else {
                fiveHour = parsed
            }
        }
        if weekly == nil && fiveHour == nil { return nil }
        groups.append(AgyQuotaGroup(name: name, weekly: weekly, fiveHour: fiveHour))
    }
    return groups.isEmpty ? nil : groups
}

/// agy는 실행 디렉터리를 워크스페이스로 삼는다. 데몬의 cwd는 launchd 기본값인 루트라서 그대로 두면
/// 루트를 워크스페이스로 열고 응답 없이 멈춘다(2026-09-23 실측: 자식이 6시간 20분 생존, SIGTERM 무시,
/// 완료 콜백이 오지 않아 폴링이 통째로 정지). 전용 빈 폴더에서만 실행한다 — agy 레인 규칙도 루트·홈 워크스페이스를 금지한다.
func agyWorkspaceURL() -> URL? {
    let url = URL(fileURLWithPath: NSHomeDirectory())
        .appendingPathComponent(".claude/cache/cc-menubar-agy", isDirectory: true)
    do {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    } catch {
        return nil
    }
    return url
}

func fetchAgyUsage(completion: @escaping (AgyFetchOutcome) -> Void) {
    guard let executable = agyExecutableURL(), let workspace = agyWorkspaceURL() else {
        completion(.missing)
        return
    }
    DispatchQueue.global(qos: .utility).async {
        let process = Process()
        process.executableURL = executable
        process.arguments = ["-p", "/usage", "--output-format", "json"]
        process.currentDirectoryURL = workspace
        let output = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = output
        process.standardError = errorPipe
        process.standardInput = FileHandle.nullDevice

        // 완료는 정확히 한 번 — 타임아웃·정상종료·실행실패가 경쟁해도 호출부의 진행 플래그가 영구히 박히지 않는다.
        let completionLock = NSLock()
        var completed = false
        func finish(_ outcome: AgyFetchOutcome) {
            completionLock.lock()
            let isFirst = !completed
            completed = true
            completionLock.unlock()
            guard isFirst else { return }
            completion(outcome)
        }

        // 자식이 끝나기 전에 읽는다(파이프가 차서 서로 기다리는 교착 방지).
        let dataLock = NSLock()
        var collected = Data()
        output.fileHandleForReading.readabilityHandler = { handle in
            let chunk = handle.availableData
            guard !chunk.isEmpty else { return }
            dataLock.lock()
            collected.append(chunk)
            dataLock.unlock()
        }
        errorPipe.fileHandleForReading.readabilityHandler = { handle in
            _ = handle.availableData
        }
        func stopReading() {
            output.fileHandleForReading.readabilityHandler = nil
            errorPipe.fileHandleForReading.readabilityHandler = nil
        }

        process.terminationHandler = { finishedProcess in
            let tail = (try? output.fileHandleForReading.readToEnd()) ?? nil
            stopReading()
            dataLock.lock()
            if let tail { collected.append(tail) }
            let data = collected
            dataLock.unlock()
            guard finishedProcess.terminationStatus == 0,
                  let groups = agyQuotaGroups(from: data) else {
                finish(.failed)
                return
            }
            finish(.ready(groups))
        }

        do {
            try process.run()
        } catch {
            stopReading()
            finish(.missing)
            return
        }

        // 워치독: SIGTERM으로 죽지 않는 상태가 실재하므로 유예 뒤 SIGKILL까지 간다.
        let pid = process.processIdentifier
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + agyFetchTimeout) {
            guard process.isRunning else { return }
            kill(pid, SIGTERM)
            DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + agyKillGrace) {
                if process.isRunning { kill(pid, SIGKILL) }
            }
        }
        // 마지막 안전망: 무슨 일이 있어도 이 시각까지는 완료가 돌아간다.
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + agyFetchTimeout + agyKillGrace + 2) {
            stopReading()
            finish(.failed)
        }
    }
}

/// 메뉴바 제목용 짧은 표기 — 그룹 순서대로 주간 잔량만 모은다("Agy 99/31%"). 데이터가 없으면 nil이라 아무것도 그리지 않는다.
func agyTitleSlot(_ card: AgyCardModel) -> String? {
    let percents: [Int] = card.groups.compactMap { group in
        guard let weekly = group.weekly,
              let fraction = agyFiniteFraction(weekly.remaining) else { return nil }
        return Int((fraction * 100).rounded())
    }
    guard !percents.isEmpty else { return nil }
    return "Agy " + percents.map { String($0) }.joined(separator: "/") + "%"
}
