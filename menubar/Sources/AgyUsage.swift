import Foundation

// agy(Antigravity CLI) 할당량. 인쇄 모드 `/usage`만 읽는다.
// 이 명령은 모델 턴을 시작하지 않는다. 응답 원문과 계정 식별자는 로그에 남기지 않는다.

let agyUsageFetchInterval: TimeInterval = 60

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

func fetchAgyUsage(completion: @escaping (AgyFetchOutcome) -> Void) {
    guard let executable = agyExecutableURL() else {
        completion(.missing)
        return
    }
    DispatchQueue.global(qos: .utility).async {
        let process = Process()
        process.executableURL = executable
        process.arguments = ["-p", "/usage", "--output-format", "json"]
        let output = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = output
        process.standardError = errorPipe
        errorPipe.fileHandleForReading.readabilityHandler = { handle in
            _ = handle.availableData
        }
        do {
            try process.run()
        } catch {
            errorPipe.fileHandleForReading.readabilityHandler = nil
            completion(.missing)
            return
        }
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 15) {
            if process.isRunning {
                process.terminate()
            }
        }
        process.waitUntilExit()
        errorPipe.fileHandleForReading.readabilityHandler = nil
        let data = output.fileHandleForReading.readDataToEndOfFile()
        guard process.terminationStatus == 0,
              let groups = agyQuotaGroups(from: data) else {
            completion(.failed)
            return
        }
        completion(.ready(groups))
    }
}
