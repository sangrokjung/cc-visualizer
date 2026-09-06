import Foundation

struct TeamCodexPoolAccount {
    let name: String
    let isCurrent: Bool
    let enabled: Bool
    let status: String
    let sessionPercent: Double?
    let sessionResetAt: Date?
    let weeklyPercent: Double?
    let weeklyResetAt: Date?
    let inflight: Int
    let maxConcurrent: Int
    let totalRequests: Int
    let totalTokens: Int

    func isQuotaBlocked(switchThresholdPercent: Double) -> Bool {
        [sessionPercent, weeklyPercent].compactMap { $0 }.contains { $0 >= switchThresholdPercent }
    }

    func isUsable(switchThresholdPercent: Double) -> Bool {
        enabled
            && !["disabled", "error", "exhausted", "throttled"].contains(status)
            && !isQuotaBlocked(switchThresholdPercent: switchThresholdPercent)
    }
}

struct TeamCodexPoolHealth {
    let checkedAt: Date
    let serverReachable: Bool
    let serverPort: Int
    let serverPid: Int?
    let currentAccount: String?
    let switchThresholdPercent: Double
    let accounts: [TeamCodexPoolAccount]

    var activeCount: Int {
        accounts.filter { $0.status == "active" }.count
    }

    var usableCount: Int {
        accounts.filter { $0.isUsable(switchThresholdPercent: switchThresholdPercent) }.count
    }

    var statusLabel: String {
        serverReachable ? "온라인" : "오프라인"
    }

    var accessibilitySummary: String {
        "TeamCodex \(statusLabel), 계정 \(accounts.count)개, 활성 \(activeCount)개, 사용 가능 \(usableCount)개"
    }
}

enum TeamCodexPoolStatusError: Error {
    case invalidJSON
}

private func teamCodexObject(from data: Data) throws -> [String: Any] {
    guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        throw TeamCodexPoolStatusError.invalidJSON
    }
    return object
}

private func teamCodexInt(_ value: Any?) -> Int? {
    if let value = value as? Int { return value }
    if let value = value as? NSNumber { return value.intValue }
    if let value = value as? String { return Int(value) }
    return nil
}

private func teamCodexDouble(_ value: Any?) -> Double? {
    if let value = value as? Double { return value }
    if let value = value as? NSNumber { return value.doubleValue }
    if let value = value as? String { return Double(value) }
    return nil
}

private func teamCodexBool(_ value: Any?) -> Bool? {
    if let value = value as? Bool { return value }
    if let value = value as? NSNumber { return value.boolValue }
    return nil
}

private func teamCodexString(_ value: Any?) -> String? {
    value as? String
}

private func teamCodexDate(_ value: Any?) -> Date? {
    guard let raw = teamCodexDouble(value), raw.isFinite, raw > 0 else { return nil }
    let seconds = raw > 10_000_000_000 ? raw / 1000 : raw
    return Date(timeIntervalSince1970: seconds)
}

func formatTeamCodexResetRemaining(_ date: Date?, now: Date = Date()) -> String {
    guard let date else { return "시각 미측정" }
    let seconds = Int(date.timeIntervalSince(now))
    if seconds <= 0 { return "갱신 확인 중" }

    let minutes = seconds / 60
    if minutes < 60 { return "\(max(1, minutes))분 후" }

    let hours = minutes / 60
    let remainingMinutes = minutes % 60
    if hours < 24 {
        return remainingMinutes == 0
            ? "\(hours)시간 후"
            : "\(hours)시간 \(remainingMinutes)분 후"
    }

    let days = hours / 24
    let remainingHours = hours % 24
    return remainingHours == 0
        ? "\(days)일 후"
        : "\(days)일 \(remainingHours)시간 후"
}

private func teamCodexAccounts(
    from rows: [[String: Any]],
    currentAccount: String?
) -> [TeamCodexPoolAccount] {
    rows.compactMap { row in
        guard let name = teamCodexString(row["name"]), !name.isEmpty else { return nil }
        let quota = row["quota"] as? [String: Any] ?? [:]
        let usage = row["usage"] as? [String: Any] ?? [:]
        let inputTokens = max(0, teamCodexInt(usage["totalInputTokens"]) ?? 0)
        let outputTokens = max(0, teamCodexInt(usage["totalOutputTokens"]) ?? 0)
        return TeamCodexPoolAccount(
            name: name,
            isCurrent: currentAccount == name,
            enabled: teamCodexBool(row["enabled"]) ?? true,
            status: teamCodexString(row["status"]) ?? "unknown",
            sessionPercent: teamCodexDouble(quota["unified5h"]).map { $0 * 100 },
            sessionResetAt: teamCodexDate(quota["unified5hReset"]),
            weeklyPercent: teamCodexDouble(quota["unified7d"]).map { $0 * 100 },
            weeklyResetAt: teamCodexDate(quota["unified7dReset"]),
            inflight: max(0, teamCodexInt(row["inflight"]) ?? 0),
            maxConcurrent: max(0, teamCodexInt(row["maxConcurrent"]) ?? 0),
            totalRequests: max(0, teamCodexInt(usage["totalRequests"]) ?? 0),
            totalTokens: inputTokens.addingReportingOverflow(outputTokens).overflow
                ? Int.max
                : inputTokens + outputTokens
        )
    }
}

func teamCodexPoolHealth(
    from data: Data,
    port: Int,
    serverPid: Int?,
    checkedAt: Date = Date()
) throws -> TeamCodexPoolHealth {
    let object = try teamCodexObject(from: data)
    let currentAccount = teamCodexString(object["currentAccount"])
    let rows = object["accounts"] as? [[String: Any]] ?? []
    return TeamCodexPoolHealth(
        checkedAt: checkedAt,
        serverReachable: true,
        serverPort: port,
        serverPid: serverPid,
        currentAccount: currentAccount,
        switchThresholdPercent: (teamCodexDouble(object["switchThreshold"]) ?? 0.98) * 100,
        accounts: teamCodexAccounts(from: rows, currentAccount: currentAccount)
    )
}

func teamCodexPoolOfflineHealth(
    configData: Data?,
    port: Int,
    serverPid: Int?,
    checkedAt: Date = Date()
) throws -> TeamCodexPoolHealth {
    let object = try configData.map(teamCodexObject) ?? [:]
    let rows = object["accounts"] as? [[String: Any]] ?? []
    let configuredRows = rows.map { row -> [String: Any] in
        var configured = row
        configured["status"] = "configured"
        configured["quota"] = [:]
        configured["usage"] = [:]
        return configured
    }
    return TeamCodexPoolHealth(
        checkedAt: checkedAt,
        serverReachable: false,
        serverPort: port,
        serverPid: serverPid,
        currentAccount: nil,
        switchThresholdPercent: (teamCodexDouble(object["switchThreshold"]) ?? 0.98) * 100,
        accounts: teamCodexAccounts(from: configuredRows, currentAccount: nil)
    )
}

private func teamCodexReadObject(_ path: String) -> [String: Any]? {
    guard let data = try? Data(contentsOf: URL(fileURLWithPath: path)) else { return nil }
    return try? teamCodexObject(from: data)
}

final class TeamCodexStatusRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @Sendable @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

func teamCodexFetchStatus(port: Int, apiKey: String?) -> Data? {
    guard let url = URL(string: "http://127.0.0.1:\(port)/teamclaude/status") else { return nil }
    var request = URLRequest(url: url)
    request.timeoutInterval = 2.5
    if let apiKey, !apiKey.isEmpty {
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("1", forHTTPHeaderField: "x-teamcodex-status-identity")
    }

    let semaphore = DispatchSemaphore(value: 0)
    var result: Data?
    let statusSession = URLSession(
        configuration: .ephemeral,
        delegate: TeamCodexStatusRedirectDelegate(),
        delegateQueue: nil
    )
    let task = statusSession.dataTask(with: request) { data, response, _ in
        defer { semaphore.signal() }
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            return
        }
        result = data
    }
    task.resume()
    _ = semaphore.wait(timeout: .now() + 3)
    task.cancel()
    statusSession.invalidateAndCancel()
    return result
}

func loadTeamCodexPoolHealth(home: String = NSHomeDirectory()) -> TeamCodexPoolHealth {
    let configPath = "\(home)/.config/teamcodex.json"
    let serverPath = "\(home)/.config/teamcodex.server.json"
    let configData = try? Data(contentsOf: URL(fileURLWithPath: configPath))
    let config = teamCodexReadObject(configPath)
    let server = teamCodexReadObject(serverPath)
    let proxy = config?["proxy"] as? [String: Any]
    let port = teamCodexInt(server?["port"]) ?? teamCodexInt(proxy?["port"]) ?? 3457
    let serverPid = teamCodexInt(server?["pid"])

    if let data = teamCodexFetchStatus(port: port, apiKey: teamCodexString(proxy?["apiKey"])),
       let health = try? teamCodexPoolHealth(from: data, port: port, serverPid: serverPid) {
        return health
    }
    return (try? teamCodexPoolOfflineHealth(
        configData: configData,
        port: port,
        serverPid: serverPid
    )) ?? TeamCodexPoolHealth(
        checkedAt: Date(),
        serverReachable: false,
        serverPort: port,
        serverPid: serverPid,
        currentAccount: nil,
        switchThresholdPercent: 98,
        accounts: []
    )
}
