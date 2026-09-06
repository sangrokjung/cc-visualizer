import Cocoa
import Darwin
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

// 모델별 사용량 (codex 추적 — gpt-5.5 등 포함)
struct ModelUsage {
    let model: String     // raw "claude-opus-4-8" / "gpt-5.5"
    let label: String     // 표시명 "Opus4.8" / "GPT-5.5"
    let provider: String  // "Claude" / "Codex" / "Gemini" / ...
    let cost: Double
    let tokens: Int
}

struct UsageData {
    let today: DailyUsage?
    let weeklyTotalCost: Double   // 최근 7일 롤링 (기존 — 스파크라인 호환)
    let thisWeekCost: Double      // 이번 주 (native ccusage weekly, 월요일 시작)
    let thisWeekTokens: Int
    let thisMonthCost: Double     // 이번 달 (native ccusage monthly, YYYY-MM)
    let thisMonthTokens: Int
    let allTimeCost: Double      // 누적 비용 ($ALL)
    let allTimeTokens: Int       // 누적 토큰 (BALL)
    let totalDays: Int           // 활동 일수
    let usdKrwRate: Double        // USD→KRW 환율 (라이브 또는 폴백)
    let modelBreakdown: [ModelUsage]  // 이번 달 모델별 (codex 포함, 비용 내림차순)
    let last7Costs: [Double]     // 최근 7일 일별 비용 (스파크라인용, 과거→오늘 순)
    let last14Costs: [Double]    // 최근 14일 일별 비용 (드롭다운 차트용)
    let recent7Days: [DayPoint]  // 최근 7일 일별 상세 (날짜+비용+토큰, 드롭다운 리스트용)
    let recent14Days: [DayPoint] // 최근 14일 일별 상세 (차트 날짜 라벨용)
}

struct TeamClaudeHostMetrics {
    let cpuPercent: Double?      // 호스트 CPU 사용률 (%) — 서버 첫 호출 직후 nil 가능
    let cores: Int?             // 논리 코어 수
    let loadavg1: Double?       // 1분 load average
    let memUsedPercent: Double? // RAM 사용률 (%)
    let memUsedBytes: Int?      // RAM 사용량 (bytes)
    let memTotalBytes: Int?     // RAM 총량 (bytes)
    let sampledAt: String?      // 샘플 시각 (ISO8601)
}

struct TeamClaudeHealth {
    let checkedAt: Date
    let overallStatus: String
    let configPresent: Bool
    let serverReachable: Bool
    let serverPort: Int?
    let serverPid: Int?
    let accountTotal: Int
    let accountConfigured: Int
    let accountActive: Int
    let accountUsable: Int
    let accountThrottled: Int
    let accountExhausted: Int
    let accountError: Int
    let accountDisabled: Int
    let accountConfigDrift: Int
    let inflight: Int
    let capacity: Int
    let fableKnown: Int
    let fableOver: Int
    let fableMaxPercent: Double?
    let fableAvgPercent: Double?
    let quotaThresholdPercent: Double
    let retryAfterSeconds: Int?
    let accounts: [TeamClaudeAccountHealth]
    let hints: [String]
    let host: TeamClaudeHostMetrics?
    var statusIdentityAvailable: Bool = true

    // 호스트 CPU/RAM 한 줄 요약 (표시할 값이 없으면 nil → 라인 생략)
    var hostSummaryText: String? {
        guard let host = host else { return nil }
        var parts: [String] = []
        if let cpu = host.cpuPercent, cpu.isFinite { parts.append("CPU \(Int(cpu.rounded()))%") }
        if let mem = host.memUsedPercent, mem.isFinite { parts.append("RAM \(Int(mem.rounded()))%") }
        guard !parts.isEmpty else { return nil }
        var extras: [String] = []
        if let load = host.loadavg1, load.isFinite { extras.append(String(format: "load %.1f", load)) }
        if let cores = host.cores { extras.append("\(cores)코어") }
        let suffix = extras.isEmpty ? "" : " (\(extras.joined(separator: " / ")))"
        return "호스트  " + parts.joined(separator: " · ") + suffix
    }

    // CPU 또는 RAM 사용률이 90% 이상이면 경고 강조
    var hostIsWarning: Bool {
        guard let host = host else { return false }
        return (host.cpuPercent ?? 0) >= 90 || (host.memUsedPercent ?? 0) >= 90
    }

    var isWarning: Bool { overallStatus == "warning" }
    var isError: Bool { overallStatus == "error" }
    var measurementPendingCount: Int {
        accounts.filter { $0.measurementIssue?.canMeasureNow == true }.count
    }
    var measurementUnavailableCount: Int {
        accounts.filter { $0.measurementIssue?.isMeasurementUnavailable == true }.count
    }
    var quotaLimitedCount: Int {
        accounts.filter { $0.measurementIssue?.isQuotaLimited == true }.count
    }

    var titleSlot: String {
        if !statusIdentityAvailable { return "Claude 조회 인증 확인" }
        let total = max(accountTotal, accountConfigured)
        return teamClaudeTitleSlot(TeamClaudeHeadlineInput(
            serverReachable: serverReachable,
            accountConfigDrift: accountConfigDrift,
            measurementPendingCount: measurementPendingCount,
            quotaLimitedCount: quotaLimitedCount,
            fableKnown: fableKnown,
            fableOver: fableOver,
            totalAccounts: total,
            accountUsable: accountUsable,
            accountActive: accountActive
        ))
    }

    var statusLabel: String {
        if isError { return "오류" }
        if isWarning { return "주의" }
        return "정상"
    }
}

struct TeamClaudeAccountHealth {
    let name: String
    let isCurrent: Bool
    let enabled: Bool
    let isUsable: Bool
    let status: String
    let source: String?
    let totalTokens: Int
    let totalRequests: Int
    let sessionPercent: Double?
    let sessionResetSeconds: Int?
    let weeklyPercent: Double?
    let weeklyResetSeconds: Int?
    let fablePercent: Double?
    let fableResetSeconds: Int?
    let probedAt: Date?
    let measurementIssue: TeamClaudeMeasurementIssue?
}

private let _teamClaudeISOFormatter = ISO8601DateFormatter()
private let _teamClaudeISOFormatterFractional: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

func tcInt(_ value: Any?) -> Int? {
    if let n = value as? Int { return n }
    if let n = value as? NSNumber { return n.intValue }
    if let d = value as? Double { return Int(d) }
    if let s = value as? String { return Int(s) }
    return nil
}

func tcDouble(_ value: Any?) -> Double? {
    if let d = value as? Double { return d }
    if let n = value as? NSNumber { return n.doubleValue }
    if let s = value as? String { return Double(s) }
    return nil
}

func tcBool(_ value: Any?) -> Bool? {
    if let b = value as? Bool { return b }
    if let n = value as? NSNumber { return n.boolValue }
    return nil
}

func tcString(_ value: Any?) -> String? {
    if let s = value as? String { return s }
    if let n = value as? NSNumber { return n.stringValue }
    return nil
}

func tcDict(_ value: Any?) -> [String: Any]? {
    value as? [String: Any]
}

func tcArray(_ value: Any?) -> [[String: Any]]? {
    value as? [[String: Any]]
}

func round1(_ value: Double) -> Double {
    (value * 10).rounded() / 10
}

func trimLogIfNeeded(_ path: String, maxBytes: Int64 = 10 * 1024 * 1024) {
    guard let size = (try? FileManager.default.attributesOfItem(atPath: path)[.size] as? NSNumber)?.int64Value,
          size > maxBytes,
          let handle = FileHandle(forWritingAtPath: path) else {
        return
    }
    handle.truncateFile(atOffset: 0)
    handle.closeFile()
}

func parseTeamClaudeTimeMs(_ value: Any?) -> Int64? {
    if let n = value as? Int64 { return n }
    if let n = value as? Int { return Int64(n) }
    if let n = value as? NSNumber { return teamClaudeSafeInt64(n.doubleValue) }
    if let d = value as? Double { return teamClaudeSafeInt64(d) }
    if let s = value as? String {
        if let d = Double(s) { return teamClaudeSafeInt64(d) }
        if let date = parseTeamClaudeDate(s) {
            return teamClaudeSafeInt64(date.timeIntervalSince1970 * 1000)
        }
    }
    return nil
}

func parseTeamClaudeDate(_ value: String) -> Date? {
    _teamClaudeISOFormatterFractional.date(from: value) ?? _teamClaudeISOFormatter.date(from: value)
}

func secondsUntil(_ value: Any?, nowMs: Int64) -> Int? {
    guard let resetMs = parseTeamClaudeTimeMs(value) else { return nil }
    return max(0, Int(ceil(Double(resetMs - nowMs) / 1000.0)))
}

func readTeamClaudeJSON(_ path: String) -> [String: Any]? {
    guard let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        return nil
    }
    return obj
}

func teamClaudeConfiguredRows(_ config: [String: Any]?, identityAvailable: Bool = true) -> [TeamClaudeAccountHealth] {
    let accounts = tcArray(config?["accounts"]) ?? []
    return accounts.compactMap { account in
        guard let name = tcString(account["name"]), !name.isEmpty else { return nil }
        return TeamClaudeAccountHealth(
            name: name,
            isCurrent: false,
            enabled: tcBool(account["enabled"]) ?? true,
            isUsable: false,
            status: identityAvailable ? "configured" : "identity-unavailable",
            source: tcString(account["source"]) ?? tcString(account["type"]),
            totalTokens: 0,
            totalRequests: 0,
            sessionPercent: nil,
            sessionResetSeconds: nil,
            weeklyPercent: nil,
            weeklyResetSeconds: nil,
            fablePercent: nil,
            fableResetSeconds: nil,
            probedAt: nil,
            measurementIssue: tcBool(account["enabled"]) == false ? .disabled
                : (identityAvailable ? .serverNotSynced : .statusIdentityUnavailable)
        )
    }
}

func fetchTeamClaudeStatus(port: Int, apiKey: String?) -> [String: Any]? {
    guard let data = teamCodexFetchStatus(port: port, apiKey: apiKey) else { return nil }
    return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
}

func triggerTeamClaudeQuotaProbe(port: Int, model: String) -> Int? {
    guard let url = URL(string: "http://127.0.0.1:\(port)/v1/messages") else { return nil }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 45
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

    let message: [String: Any] = ["role": "user", "content": "ping"]
    let body: [String: Any] = [
        "model": model,
        "max_tokens": 1,
        "messages": [message],
    ]
    guard JSONSerialization.isValidJSONObject(body),
          let bodyData = try? JSONSerialization.data(withJSONObject: body) else {
        return nil
    }
    request.httpBody = bodyData

    let semaphore = DispatchSemaphore(value: 0)
    var statusCode: Int?
    let task = URLSession.shared.dataTask(with: request) { _, response, _ in
        defer { semaphore.signal() }
        statusCode = (response as? HTTPURLResponse)?.statusCode
    }
    task.resume()
    _ = semaphore.wait(timeout: .now() + 50)
    task.cancel()
    return statusCode
}

func resolveClaudeExecutable() -> String {
    let candidates = [
        "/opt/homebrew/bin/claude",
        "/usr/local/bin/claude",
        "\(NSHomeDirectory())/.local/bin/claude",
    ]
    for candidate in candidates where FileManager.default.isExecutableFile(atPath: candidate) {
        return candidate
    }
    return "/usr/bin/env"
}

func runTeamClaudeBareClaudeProbe(port: Int, apiKey: String?, model: String) -> Int32? {
    guard let apiKey = apiKey, !apiKey.isEmpty else { return nil }
    let process = Process()
    let claude = resolveClaudeExecutable()
    if claude == "/usr/bin/env" {
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = [
            "claude", "--bare", "-p", "Respond exactly: OK",
            "--model", model,
            "--tools", "",
            "--max-budget-usd", "0.02",
            "--no-session-persistence",
            "--output-format", "json",
        ]
    } else {
        process.executableURL = URL(fileURLWithPath: claude)
        process.arguments = [
            "--bare", "-p", "Respond exactly: OK",
            "--model", model,
            "--tools", "",
            "--max-budget-usd", "0.02",
            "--no-session-persistence",
            "--output-format", "json",
        ]
    }

    var env = ProcessInfo.processInfo.environment
    env["HOME"] = NSHomeDirectory()
    env["ANTHROPIC_BASE_URL"] = "http://localhost:\(port)"
    env["ANTHROPIC_API_KEY"] = apiKey
    env["PATH"] = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    process.environment = env

    let nullOut = FileHandle(forWritingAtPath: "/dev/null")
    process.standardOutput = nullOut
    process.standardError = nullOut

    do {
        try process.run()
    } catch {
        nullOut?.closeFile()
        return nil
    }

    let pid = process.processIdentifier
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 45) {
        if process.isRunning {
            terminateProcessTree(rootPid: pid, signal: SIGTERM)
        }
    }

    process.waitUntilExit()
    nullOut?.closeFile()
    return process.terminationStatus
}

func stripClaudeModelSuffix(_ model: String) -> String {
    var value = model
    if let r = value.range(of: "\\[[^\\]]+\\]$", options: .regularExpression) {
        value.removeSubrange(r)
    }
    return value
}

func computeTeamClaudeRetryAfterSeconds(accounts: [[String: Any]], threshold: Double, nowMs: Int64) -> Int? {
    let states = accounts.map { account -> TeamClaudeRetryAccountState in
        let quota = tcDict(account["quota"]) ?? [:]
        var windows = [
            TeamClaudeQuotaWindowState(
                utilization: tcDouble(quota["unified5h"]),
                resetAtMs: parseTeamClaudeTimeMs(quota["unified5hReset"])
            ),
            TeamClaudeQuotaWindowState(
                utilization: tcDouble(quota["unified7d"]),
                resetAtMs: parseTeamClaudeTimeMs(quota["unified7dReset"])
            ),
        ]

        let modelWeekly = tcDict(quota["modelWeekly"]) ?? [:]
        windows.append(contentsOf: modelWeekly.values.compactMap { value in
            guard let window = tcDict(value) else { return nil }
            return TeamClaudeQuotaWindowState(
                utilization: tcDouble(window["utilization"]),
                resetAtMs: parseTeamClaudeTimeMs(window["reset"])
            )
        })

        let tokensReset = quota["tokensReset"] ?? quota["resetsAt"]
        if let limit = tcDouble(quota["tokensLimit"]),
           let remaining = tcDouble(quota["tokensRemaining"]),
           limit > 0 {
            windows.append(TeamClaudeQuotaWindowState(
                utilization: 1.0 - remaining / limit,
                resetAtMs: parseTeamClaudeTimeMs(tokensReset)
            ))
        }

        let requestsReset = quota["requestsReset"] ?? quota["resetsAt"]
        if let limit = tcDouble(quota["requestsLimit"]),
           let remaining = tcDouble(quota["requestsRemaining"]),
           limit > 0 {
            windows.append(TeamClaudeQuotaWindowState(
                utilization: 1.0 - remaining / limit,
                resetAtMs: parseTeamClaudeTimeMs(requestsReset)
            ))
        }

        return TeamClaudeRetryAccountState(
            enabled: tcBool(account["enabled"]) ?? true,
            status: tcString(account["status"]) ?? "unknown",
            rateLimitedUntilMs: parseTeamClaudeTimeMs(account["rateLimitedUntil"]),
            windows: windows
        )
    }
    return teamClaudeRetryAfterSeconds(accounts: states, threshold: threshold, nowMs: nowMs)
}

func loadTeamClaudeHealth(home: String = NSHomeDirectory()) -> TeamClaudeHealth {
    let config = readTeamClaudeJSON("\(home)/.config/teamclaude.json")
    let server = readTeamClaudeJSON("\(home)/.config/teamclaude.server.json")
    let port = tcInt(server?["port"])
        ?? tcInt(tcDict(config?["proxy"])?["port"])
        ?? 3456
    let status = fetchTeamClaudeStatus(
        port: port,
        apiKey: tcString(tcDict(config?["proxy"])?["apiKey"])
    )
    let rawAccounts = tcArray(status?["accounts"])
    let identityAvailable = status == nil || rawAccounts?.allSatisfy {
        guard let name = $0["name"] as? String else { return false }
        return !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    } == true
    let accounts = identityAvailable ? (rawAccounts ?? []) : []
    let currentAccount = tcString(status?["currentAccount"])
    let threshold = tcDouble(status?["switchThreshold"])
        ?? tcDouble(config?["switchThreshold"])
        ?? 0.98
    let configuredRows = teamClaudeConfiguredRows(config, identityAvailable: identityAvailable)
    let configAccounts = configuredRows.count
    let nowMs = Int64(Date().timeIntervalSince1970 * 1000)

    var active = 0
    var usable = 0
    var throttled = 0
    var exhausted = 0
    var error = 0
    var disabled = 0
    var inflight = 0
    var capacity = 0
    var fableKnown = 0
    var fableOver = 0
    var fableSum = 0.0
    var fableMax: Double?
    var accountRows: [TeamClaudeAccountHealth] = []

    for account in accounts {
        switch account["status"] as? String {
        case "active": active += 1
        case "throttled": throttled += 1
        case "exhausted": exhausted += 1
        case "error": error += 1
        default: break
        }
        if tcBool(account["enabled"]) == false { disabled += 1 }
        inflight = teamClaudeAddingCounts(
            inflight,
            teamClaudeBoundedCount(tcInt(account["inflight"]), maximum: 1_000_000),
            maximum: 1_000_000
        )
        capacity = teamClaudeAddingCounts(
            capacity,
            teamClaudeBoundedCount(tcInt(account["maxConcurrent"]), maximum: 1_000_000),
            maximum: 1_000_000
        )

        let quota = tcDict(account["quota"])
        let modelWeekly = tcDict(quota?["modelWeekly"])
        let fable = tcDict(modelWeekly?["7d_oi"])
        let fableResetMs = parseTeamClaudeTimeMs(fable?["reset"])
        let fableUtilization = teamClaudeCurrentQuotaUtilization(
            tcDouble(fable?["utilization"]),
            resetAtMs: fableResetMs,
            nowMs: nowMs
        )
        if let utilization = fableUtilization {
            fableKnown += 1
            if utilization >= threshold { fableOver += 1 }
            let pct = utilization * 100
            fableSum += pct
            fableMax = max(fableMax ?? pct, pct)
        }
        let name = tcString(account["name"]) ?? "unknown"
        let usage = tcDict(account["usage"])
        let lastUsed = tcString(usage?["lastUsed"]).flatMap(parseTeamClaudeDate)
        let totalTokens = teamClaudeAddingCounts(
            teamClaudeBoundedCount(tcInt(usage?["totalInputTokens"]), maximum: 1_000_000_000_000_000),
            teamClaudeBoundedCount(tcInt(usage?["totalOutputTokens"]), maximum: 1_000_000_000_000_000),
            maximum: 1_000_000_000_000_000
        )
        let enabled = tcBool(account["enabled"]) ?? true
        let status = tcString(account["status"]) ?? "unknown"
        let sessionResetMs = parseTeamClaudeTimeMs(quota?["unified5hReset"])
        let weeklyResetMs = parseTeamClaudeTimeMs(quota?["unified7dReset"])
        let sessionPercent = teamClaudeCurrentQuotaUtilization(
            tcDouble(quota?["unified5h"]),
            resetAtMs: sessionResetMs,
            nowMs: nowMs
        ).map { $0 * 100 }
        let weeklyPercent = teamClaudeCurrentQuotaUtilization(
            tcDouble(quota?["unified7d"]),
            resetAtMs: weeklyResetMs,
            nowMs: nowMs
        ).map { $0 * 100 }
        let fablePercent = fableUtilization.map { $0 * 100 }
        let measurementIssue = teamClaudeMeasurementIssue(
            enabled: enabled,
            status: status,
            sessionPercent: sessionPercent,
            weeklyPercent: weeklyPercent,
            fablePercent: fablePercent,
            lastUsed: lastUsed,
            thresholdPercent: threshold * 100
        )
        let isUsable = teamClaudeAccountIsUsable(
            enabled: enabled,
            status: status,
            sessionPercent: sessionPercent,
            weeklyPercent: weeklyPercent,
            fablePercent: fablePercent,
            thresholdPercent: threshold * 100
        )
        if isUsable { usable += 1 }
        accountRows.append(TeamClaudeAccountHealth(
            name: name,
            isCurrent: currentAccount == name,
            enabled: enabled,
            isUsable: isUsable,
            status: status,
            source: tcString(account["source"]) ?? tcString(account["type"]),
            totalTokens: totalTokens,
            totalRequests: teamClaudeBoundedCount(
                tcInt(usage?["totalRequests"]),
                maximum: 1_000_000_000_000
            ),
            sessionPercent: sessionPercent,
            sessionResetSeconds: sessionPercent == nil ? nil : secondsUntil(quota?["unified5hReset"], nowMs: nowMs),
            weeklyPercent: weeklyPercent,
            weeklyResetSeconds: weeklyPercent == nil ? nil : secondsUntil(quota?["unified7dReset"], nowMs: nowMs),
            fablePercent: fablePercent,
            fableResetSeconds: fablePercent == nil ? nil : secondsUntil(fable?["reset"], nowMs: nowMs),
            probedAt: lastUsed,
            measurementIssue: measurementIssue
        ))
    }

    let liveNames = Set(accountRows.map(\.name))
    let accountDrift = config == nil || !identityAvailable
        ? TeamClaudeAccountDrift(missingFromServer: [], extraOnServer: [], stateMismatch: [])
        : teamClaudeAccountDrift(
            configuredNames: configuredRows.map(\.name),
            serverNames: Array(liveNames),
            configuredEnabled: configuredRows.reduce(into: [String: Bool]()) { $0[$1.name] = $1.enabled },
            serverEnabled: accountRows.reduce(into: [String: Bool]()) { $0[$1.name] = $1.enabled }
        )
    let missingConfiguredRows = identityAvailable
        ? configuredRows.filter { accountDrift.missingFromServer.contains($0.name) }
        : configuredRows
    accountRows.append(contentsOf: missingConfiguredRows)
    disabled += missingConfiguredRows.filter { !$0.enabled }.count
    let measurementPending = accountRows.filter { $0.measurementIssue?.canMeasureNow == true }.count
    let measurementUnavailable = accountRows.filter {
        $0.measurementIssue?.isMeasurementUnavailable == true
    }.count
    let quotaLimited = accountRows.filter {
        $0.measurementIssue?.isQuotaLimited == true
    }.count

    let reachable = status != nil
    let fableAllOver = fableKnown > 0 && fableOver == fableKnown
    let overallStatus = teamClaudeOverallStatus(TeamClaudeOverallStatusInput(
        serverReachable: reachable,
        configPresent: config != nil,
        allAccountsError: !accounts.isEmpty && error == accounts.count,
        quotaLimitedCount: quotaLimited,
        hasOtherWarning: fableOver > 0 || throttled > 0 || exhausted > 0 || disabled > 0
            || measurementPending > 0 || !accountDrift.isEmpty || !identityAvailable
    ))

    var hints: [String] = []
    if !identityAvailable {
        hints.append("계정 식별 정보 없음 · 상태 조회 인증 확인 필요")
    }
    if !reachable {
        hints.append("teamclaude 서버 연결 실패")
    }
    if config == nil {
        hints.append("teamclaude 계정 설정 파일 확인 필요")
    }
    if fableAllOver {
        hints.append("Fable 주간 쿼터가 모든 확인 계정에서 임계치 이상")
    } else if fableOver > 0 {
        hints.append("일부 계정의 Fable 주간 쿼터가 임계치 이상")
    }
    if identityAvailable && !missingConfiguredRows.isEmpty {
        hints.append("설정 계정 \(missingConfiguredRows.count)개 서버 미반영 · 재시작 필요")
    }
    if !accountDrift.extraOnServer.isEmpty {
        hints.append("제거된 계정 \(accountDrift.extraOnServer.count)개 서버 잔존 · 재시작 필요")
    }
    if !accountDrift.stateMismatch.isEmpty {
        hints.append("계정 활성 상태 \(accountDrift.stateMismatch.count)개 서버 불일치 · 재시작 필요")
    }
    if measurementPending > 0 {
        hints.append("사용량 미측정 계정 \(measurementPending)개 · 지금 측정 가능")
    }
    if measurementUnavailable > 0 {
        hints.append("일시 제한 상태 확인이 필요한 계정 \(measurementUnavailable)개")
    }

    let retryAfter = computeTeamClaudeRetryAfterSeconds(
        accounts: accounts,
        threshold: threshold,
        nowMs: nowMs
    )

    // 프록시가 내보내는 host 메트릭 (구버전 서버는 없을 수 있어 전부 옵셔널 안전 파싱)
    let hostMetrics: TeamClaudeHostMetrics? = tcDict(status?["host"]).map { host in
        let cpu = tcDict(host["cpu"])
        let memory = tcDict(host["memory"])
        let load1 = (cpu?["loadavg"] as? [Any])?.first.flatMap(tcDouble)
        return TeamClaudeHostMetrics(
            cpuPercent: tcDouble(cpu?["usedPct"]),
            cores: tcInt(cpu?["cores"]),
            loadavg1: load1,
            memUsedPercent: tcDouble(memory?["usedPct"]),
            memUsedBytes: tcDouble(memory?["usedBytes"]).flatMap(teamClaudeSafeInt64).map(Int.init),
            memTotalBytes: tcDouble(memory?["totalBytes"]).flatMap(teamClaudeSafeInt64).map(Int.init),
            sampledAt: tcString(host["sampledAt"])
        )
    }

    return TeamClaudeHealth(
        checkedAt: Date(),
        overallStatus: overallStatus,
        configPresent: config != nil,
        serverReachable: reachable,
        serverPort: port,
        serverPid: tcInt(server?["pid"]),
        accountTotal: max(accounts.count, configAccounts),
        accountConfigured: configAccounts,
        accountActive: active,
        accountUsable: usable,
        accountThrottled: throttled,
        accountExhausted: exhausted,
        accountError: error,
        accountDisabled: disabled,
        accountConfigDrift: accountDrift.count,
        inflight: inflight,
        capacity: capacity,
        fableKnown: fableKnown,
        fableOver: fableOver,
        fableMaxPercent: fableMax.map(round1),
        fableAvgPercent: fableKnown > 0 ? round1(fableSum / Double(fableKnown)) : nil,
        quotaThresholdPercent: threshold * 100,
        retryAfterSeconds: retryAfter,
        accounts: accountRows,
        hints: hints,
        host: hostMetrics,
        statusIdentityAvailable: identityAvailable
    )
}

func teamClaudeRetainingQuota(
    candidate: TeamClaudeHealth,
    previous: TeamClaudeHealth
) -> TeamClaudeHealth {
    let elapsedSeconds = max(0, Int(candidate.checkedAt.timeIntervalSince(previous.checkedAt)))
    let quotaPendingAccounts = previous.accounts.map { account in
        let sessionResetSeconds = teamClaudeAdjustedResetSeconds(
            account.sessionResetSeconds,
            elapsedSeconds: elapsedSeconds
        )
        return TeamClaudeAccountHealth(
            name: account.name,
            isCurrent: account.isCurrent,
            enabled: account.enabled,
            isUsable: account.isUsable,
            status: account.status,
            source: account.source,
            totalTokens: account.totalTokens,
            totalRequests: account.totalRequests,
            sessionPercent: sessionResetSeconds == nil ? nil : account.sessionPercent,
            sessionResetSeconds: sessionResetSeconds,
            weeklyPercent: nil,
            weeklyResetSeconds: nil,
            fablePercent: nil,
            fableResetSeconds: nil,
            probedAt: account.probedAt,
            measurementIssue: account.measurementIssue
        )
    }
    let quotaPending = TeamClaudeHealth(
        checkedAt: candidate.checkedAt,
        overallStatus: previous.overallStatus,
        configPresent: previous.configPresent,
        serverReachable: previous.serverReachable,
        serverPort: previous.serverPort,
        serverPid: previous.serverPid,
        accountTotal: previous.accountTotal,
        accountConfigured: previous.accountConfigured,
        accountActive: previous.accountActive,
        accountUsable: previous.accountUsable,
        accountThrottled: previous.accountThrottled,
        accountExhausted: previous.accountExhausted,
        accountError: previous.accountError,
        accountDisabled: previous.accountDisabled,
        accountConfigDrift: previous.accountConfigDrift,
        inflight: previous.inflight,
        capacity: previous.capacity,
        fableKnown: previous.fableKnown,
        fableOver: previous.fableOver,
        fableMaxPercent: previous.fableMaxPercent,
        fableAvgPercent: previous.fableAvgPercent,
        quotaThresholdPercent: previous.quotaThresholdPercent,
        retryAfterSeconds: teamClaudeAdjustedResetSeconds(
            previous.retryAfterSeconds,
            elapsedSeconds: elapsedSeconds
        ),
        accounts: quotaPendingAccounts,
        hints: previous.hints,
        host: previous.host
    )
    let adjusted = teamClaudeHealthMergingQuota(candidate: quotaPending, previous: previous)

    return TeamClaudeHealth(
        checkedAt: candidate.checkedAt,
        overallStatus: "error",
        configPresent: candidate.configPresent,
        serverReachable: false,
        serverPort: candidate.serverPort,
        serverPid: candidate.serverPid,
        accountTotal: max(candidate.accountTotal, adjusted.accountTotal),
        accountConfigured: max(candidate.accountConfigured, adjusted.accountConfigured),
        accountActive: adjusted.accountActive,
        accountUsable: adjusted.accountUsable,
        accountThrottled: adjusted.accountThrottled,
        accountExhausted: adjusted.accountExhausted,
        accountError: adjusted.accountError,
        accountDisabled: adjusted.accountDisabled,
        accountConfigDrift: adjusted.accountConfigDrift,
        inflight: adjusted.inflight,
        capacity: adjusted.capacity,
        fableKnown: adjusted.fableKnown,
        fableOver: adjusted.fableOver,
        fableMaxPercent: adjusted.fableMaxPercent,
        fableAvgPercent: adjusted.fableAvgPercent,
        quotaThresholdPercent: adjusted.quotaThresholdPercent,
        retryAfterSeconds: adjusted.retryAfterSeconds,
        accounts: adjusted.accounts,
        hints: candidate.hints + ["서버 재연결 중 · 마지막 정상 주간/Fable 표시"],
        host: candidate.host
    )
}

func teamClaudeQuotaPair(for account: TeamClaudeAccountHealth) -> TeamClaudeQuotaPair? {
    teamClaudeQuotaPair(
        weeklyPercent: account.weeklyPercent,
        weeklyResetSeconds: account.weeklyResetSeconds,
        fablePercent: account.fablePercent,
        fableResetSeconds: account.fableResetSeconds
    )
}

func teamClaudeAccountMergingQuota(
    candidate: TeamClaudeAccountHealth,
    previous: TeamClaudeAccountHealth?,
    elapsedSeconds: Int,
    thresholdPercent: Double,
    observedAt: Date
) -> TeamClaudeAccountHealth {
    let candidatePair = teamClaudeQuotaPair(for: candidate)
    let previousPair = teamClaudeAdjustedQuotaPair(
        previous.flatMap(teamClaudeQuotaPair(for:)),
        elapsedSeconds: elapsedSeconds
    )
    let mergedPair = teamClaudeMergedQuotaPair(
        candidate: candidatePair,
        previous: previousPair
    )
    let weeklyPercent = mergedPair?.weeklyPercent ?? candidate.weeklyPercent
    let fablePercent = mergedPair?.fablePercent ?? candidate.fablePercent
    let measurementIssue = teamClaudeMeasurementIssue(
        enabled: candidate.enabled,
        status: candidate.status,
        sessionPercent: candidate.sessionPercent,
        weeklyPercent: weeklyPercent,
        fablePercent: fablePercent,
        lastUsed: candidate.probedAt,
        thresholdPercent: thresholdPercent,
        now: observedAt
    )
    let isUsable = teamClaudeAccountIsUsable(
        enabled: candidate.enabled,
        status: candidate.status,
        sessionPercent: candidate.sessionPercent,
        weeklyPercent: weeklyPercent,
        fablePercent: fablePercent,
        thresholdPercent: thresholdPercent
    )

    return TeamClaudeAccountHealth(
        name: candidate.name,
        isCurrent: candidate.isCurrent,
        enabled: candidate.enabled,
        isUsable: isUsable,
        status: candidate.status,
        source: candidate.source,
        totalTokens: candidate.totalTokens,
        totalRequests: candidate.totalRequests,
        sessionPercent: candidate.sessionPercent,
        sessionResetSeconds: candidate.sessionResetSeconds,
        weeklyPercent: weeklyPercent,
        weeklyResetSeconds: mergedPair?.weeklyResetSeconds ?? candidate.weeklyResetSeconds,
        fablePercent: fablePercent,
        fableResetSeconds: mergedPair?.fableResetSeconds ?? candidate.fableResetSeconds,
        probedAt: candidate.probedAt,
        measurementIssue: measurementIssue
    )
}

func teamClaudeHealthMergingQuota(
    candidate: TeamClaudeHealth,
    previous: TeamClaudeHealth?
) -> TeamClaudeHealth {
    guard candidate.statusIdentityAvailable else { return candidate }
    let previousByName = (previous?.accounts ?? []).reduce(into: [String: TeamClaudeAccountHealth]()) {
        $0[$1.name] = $1
    }
    let elapsedSeconds = previous.map {
        max(0, Int(candidate.checkedAt.timeIntervalSince($0.checkedAt)))
    } ?? 0
    let thresholdPercent = candidate.quotaThresholdPercent
    let retainedPreviousQuota = candidate.accounts.contains { account in
        teamClaudeQuotaPair(for: account) == nil
            && teamClaudeAdjustedQuotaPair(
                previousByName[account.name].flatMap(teamClaudeQuotaPair(for:)),
                elapsedSeconds: elapsedSeconds
            ) != nil
    }
    let accounts = candidate.accounts.map {
        teamClaudeAccountMergingQuota(
            candidate: $0,
            previous: previousByName[$0.name],
            elapsedSeconds: elapsedSeconds,
            thresholdPercent: thresholdPercent,
            observedAt: candidate.checkedAt
        )
    }
    let fableValues = accounts.compactMap { teamClaudeQuotaPair(for: $0)?.fablePercent }
    let fableSummary = teamClaudeFableSummary(
        values: fableValues,
        thresholdPercent: thresholdPercent
    )
    let quotaRetryAfter = accounts.compactMap { account -> Int? in
        var resetCandidates: [Int] = []
        if let percent = account.sessionPercent,
           percent >= thresholdPercent,
           let reset = account.sessionResetSeconds {
            resetCandidates.append(reset)
        }
        let displayPair = teamClaudeQuotaPair(for: account)
        if let percent = displayPair?.weeklyPercent,
           percent >= thresholdPercent,
           let reset = displayPair?.weeklyResetSeconds {
            resetCandidates.append(reset)
        }
        if let percent = displayPair?.fablePercent,
           percent >= thresholdPercent,
           let reset = displayPair?.fableResetSeconds {
            resetCandidates.append(reset)
        }
        return resetCandidates.max()
    }.min()
    let retryAfter = quotaRetryAfter ?? candidate.retryAfterSeconds
    let quotaLimited = accounts.filter { $0.measurementIssue?.isQuotaLimited == true }.count
    let measurementPending = accounts.filter { $0.measurementIssue?.canMeasureNow == true }.count
    let overallStatus = teamClaudeOverallStatus(TeamClaudeOverallStatusInput(
        serverReachable: candidate.serverReachable,
        configPresent: candidate.configPresent,
        allAccountsError: !accounts.isEmpty && candidate.accountError == accounts.count,
        quotaLimitedCount: quotaLimited,
        hasOtherWarning: fableSummary.over > 0 || candidate.accountThrottled > 0
            || candidate.accountExhausted > 0 || candidate.accountDisabled > 0
            || measurementPending > 0 || candidate.accountConfigDrift > 0
    ))

    return TeamClaudeHealth(
        checkedAt: candidate.checkedAt,
        overallStatus: overallStatus,
        configPresent: candidate.configPresent,
        serverReachable: candidate.serverReachable,
        serverPort: candidate.serverPort,
        serverPid: candidate.serverPid,
        accountTotal: candidate.accountTotal,
        accountConfigured: candidate.accountConfigured,
        accountActive: candidate.accountActive,
        accountUsable: accounts.filter(\.isUsable).count,
        accountThrottled: candidate.accountThrottled,
        accountExhausted: candidate.accountExhausted,
        accountError: candidate.accountError,
        accountDisabled: candidate.accountDisabled,
        accountConfigDrift: candidate.accountConfigDrift,
        inflight: candidate.inflight,
        capacity: candidate.capacity,
        fableKnown: fableSummary.known,
        fableOver: fableSummary.over,
        fableMaxPercent: fableSummary.maximum,
        fableAvgPercent: fableSummary.average,
        quotaThresholdPercent: thresholdPercent,
        retryAfterSeconds: retryAfter,
        accounts: accounts,
        hints: retainedPreviousQuota
            ? candidate.hints + ["일부 한도 동기화 중 · 계정 상태는 최신"]
            : candidate.hints,
        host: candidate.host
    )
}

// MARK: - ccusage 호출

// npx 절대경로 후보 probing — zsh 완전 우회 (launchd 환경에서 .zshrc 초기화가 hang하는 문제 회피).
// 직원 PC마다 Node 설치 방식이 다르다(fnm / Homebrew Apple Silicon / Intel / 공식 installer).
// commands.rs 의 run_tsx_script 다중 fallback 패턴과 동일하게 첫 존재 후보를 사용한다.
// 실행 시 npx는 같은 디렉토리의 node 바이너리를 찾으므로 PATH에 모든 후보 bin 디렉토리 명시.

// 존재하는 첫 npx 절대경로 + 그 bin 디렉토리 반환. 못 찾으면 PATH 의존 "npx" 폴백.
func resolveNpx(home: String) -> (exec: String, bin: String) {
    let fnmBin = "\(home)/.local/share/fnm/aliases/default/bin"
    let candidates = [
        "\(fnmBin)/npx",          // fnm default symlink
        "/opt/homebrew/bin/npx",  // Homebrew (Apple Silicon)
        "/usr/local/bin/npx",     // Homebrew (Intel) / 공식 Node installer
    ]
    let fm = FileManager.default
    for c in candidates where fm.fileExists(atPath: c) {
        return (c, (c as NSString).deletingLastPathComponent)
    }
    // 모두 없으면 PATH 의존 (env PATH 가 npx 를 찾도록)
    return ("/usr/bin/env", fnmBin)
}

/// npx ccusage <subcommand> --json --offline 을 실행해 stdout JSON Data 반환. 실패 시 nil.
/// daily/weekly/monthly 공용 — 각 호출은 별도 tmp 파일(서브커맨드명 포함)로 redirect.
func runCcusageRaw(_ subcommand: String) -> Data? {
    let process = Process()
    let home = NSHomeDirectory()
    let fnmBin = "\(home)/.local/share/fnm/aliases/default/bin"
    let npx = resolveNpx(home: home)
    if npx.exec == "/usr/bin/env" {
        // 절대경로 후보 미발견 → env 로 PATH 탐색
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["npx", "--yes", "ccusage", subcommand, "--json", "--offline"]
    } else {
        process.executableURL = URL(fileURLWithPath: npx.exec)
        process.arguments = ["--yes", "ccusage", subcommand, "--json", "--offline"]
    }

    var env = ProcessInfo.processInfo.environment
    // 발견된 npx 의 bin 을 PATH 최우선 + 모든 일반 후보 디렉토리 포함.
    env["PATH"] = "\(npx.bin):\(fnmBin):/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    env["HOME"] = home
    process.environment = env

    // 142KB JSON > 64KB pipe buffer → 자식 write block deadlock 회피용 파일 redirect
    let tmpPath = "/tmp/cc-menubar-ccusage-\(subcommand)-\(getpid()).json"
    FileManager.default.createFile(atPath: tmpPath, contents: nil, attributes: nil)
    guard let writeHandle = FileHandle(forWritingAtPath: tmpPath) else {
        print("CCUSAGE-FAIL[\(subcommand)]: tmp 파일 생성 실패 \(tmpPath)")
        fflush(stdout)
        return nil
    }
    process.standardOutput = writeHandle
    process.standardError = Pipe() // stderr는 작아서 pipe OK

    do {
        try process.run()
    } catch {
        print("CCUSAGE-FAIL[\(subcommand)]: 실행 실패 — \(error.localizedDescription)")
        fflush(stdout)
        writeHandle.closeFile()
        return nil
    }

    let pid = process.processIdentifier
    let deadline = DispatchTime.now() + .seconds(60)
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: deadline) {
        if process.isRunning {
            terminateProcessTree(rootPid: pid, signal: SIGTERM)
            usleep(700_000)
            if process.isRunning {
                terminateProcessTree(rootPid: pid, signal: SIGKILL)
            }
            print("CCUSAGE-TIMEOUT[\(subcommand)]: 60초 초과, 강제 종료")
            fflush(stdout)
        }
    }

    process.waitUntilExit()
    writeHandle.closeFile()

    let data = (try? Data(contentsOf: URL(fileURLWithPath: tmpPath))) ?? Data()
    try? FileManager.default.removeItem(atPath: tmpPath)
    print("CCUSAGE[\(subcommand)]: exit=\(process.terminationStatus) bytes=\(data.count)")
    fflush(stdout)

    guard process.terminationStatus == 0, !data.isEmpty else { return nil }
    return data
}

func processTreePids(rootPid: Int32) -> [Int32] {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/bin/ps")
    process.arguments = ["-axo", "pid=,ppid="]
    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = Pipe()
    do { try process.run() } catch { return [rootPid] }
    process.waitUntilExit()

    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    guard let output = String(data: data, encoding: .utf8) else { return [rootPid] }

    var childrenByParent: [Int32: [Int32]] = [:]
    for line in output.split(separator: "\n") {
        let parts = line.split(separator: " ").compactMap { Int32($0) }
        if parts.count == 2 {
            childrenByParent[parts[1], default: []].append(parts[0])
        }
    }

    var result: [Int32] = []
    func visit(_ pid: Int32) {
        for child in childrenByParent[pid] ?? [] {
            visit(child)
            result.append(child)
        }
    }
    visit(rootPid)
    result.append(rootPid)
    return result
}

func terminateProcessTree(rootPid: Int32, signal: Int32) {
    for pid in processTreePids(rootPid: rootPid) {
        _ = Darwin.kill(pid, signal)
    }
}

/// daily(필수) + weekly/monthly(정확도 향상, 실패 시 daily 파생 폴백) + 환율을 조합해 UsageData 반환.
/// 수동 호출용 동기 헬퍼이며, 메뉴바 갱신은 loadUsageInBackground 에서 daily quick 반영을 먼저 수행한다.
func runCcusage() -> UsageData? {
    guard let dailyData = runCcusageRaw("daily") else { return nil }
    let weeklyData = runCcusageRaw("weekly")
    let monthlyData = runCcusageRaw("monthly")
    let rate = fetchUsdKrwRate()
    let parsed = parseUsageData(daily: dailyData, weekly: weeklyData, monthly: monthlyData, rate: rate)
    print("CCUSAGE-PARSE: today=\(parsed?.today?.period ?? "nil") cost=\(parsed?.today?.totalCost ?? -1) thisMonth=\(parsed?.thisMonthCost ?? -1) rate=\(rate)")
    fflush(stdout)
    return parsed
}

func parseUsageData(daily dailyData: Data, weekly weeklyData: Data?, monthly monthlyData: Data?, rate: Double) -> UsageData? {
    guard let json = try? JSONSerialization.jsonObject(with: dailyData) as? [String: Any],
          let dailyArray = json["daily"] as? [[String: Any]] else {
        print("CCUSAGE-PARSE-FAIL: JSON 파싱 실패 (data prefix: \(String(data: dailyData.prefix(120), encoding: .utf8) ?? "non-utf8"))")
        fflush(stdout)
        return nil
    }
    print("CCUSAGE-PARSE: dailyArray.count=\(dailyArray.count)")
    fflush(stdout)

    // 오늘 날짜 (YYYY-MM-DD)
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    let todayStr = formatter.string(from: Date())

    // 이번 달 키 (YYYY-MM) + 이번 주 월요일 키 (YYYY-MM-DD) — ccusage native weekly/monthly period 매칭용
    let monthFmt = DateFormatter()
    monthFmt.dateFormat = "yyyy-MM"
    monthFmt.locale = Locale(identifier: "en_US_POSIX")
    let thisMonthKey = monthFmt.string(from: Date())

    let cal = Calendar(identifier: .gregorian)
    let nowDate = Date()
    let weekday = cal.component(.weekday, from: nowDate) // 1=일 .. 7=토
    let mondayOffset = weekday == 1 ? 6 : weekday - 2     // 월요일까지 거슬러 올라갈 일수
    let mondayDate = cal.date(byAdding: .day, value: -mondayOffset, to: cal.startOfDay(for: nowDate)) ?? nowDate
    let thisMondayKey = formatter.string(from: mondayDate)

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

    // ccusage weekly/monthly Data → 지정 period 엔트리(cost/tokens/found) + totals(전체 누적, hasTotals)
    func pickPeriod(_ data: Data?, key: String, arrayKey: String)
        -> (cost: Double, tokens: Int, found: Bool, totalsCost: Double, totalsTokens: Int, hasTotals: Bool) {
        guard let data = data,
              let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let arr = j[arrayKey] as? [[String: Any]] else {
            return (0, 0, false, 0, 0, false)
        }
        var cost = 0.0, tokens = 0, found = false
        for item in arr where (item["period"] as? String) == key {
            cost = numDouble(item["totalCost"]); tokens = numInt(item["totalTokens"]); found = true
        }
        var tc = 0.0, tt = 0, hasTotals = false
        if let t = j["totals"] as? [String: Any] {
            tc = numDouble(t["totalCost"]); tt = numInt(t["totalTokens"]); hasTotals = true
        }
        return (cost, tokens, found, tc, tt, hasTotals)
    }

    // 이번 달 모델별 분해 — monthly 현재 엔트리의 modelBreakdowns 우선, 없으면 daily(이번달) 집계.
    // codex(gpt) 모델 포함 추적.
    func parseModelBreakdown(_ monthlyData: Data?, monthKey: String) -> [ModelUsage] {
        var raw: [[String: Any]] = []
        if let data = monthlyData,
           let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let arr = j["monthly"] as? [[String: Any]],
           let cur = arr.first(where: { ($0["period"] as? String) == monthKey }),
           let bds = cur["modelBreakdowns"] as? [[String: Any]] {
            raw = bds
        } else if let dd = dailyData as Data?,  // 폴백: daily 이번달 엔트리들의 breakdowns
                  let dj = try? JSONSerialization.jsonObject(with: dd) as? [String: Any],
                  let darr = dj["daily"] as? [[String: Any]] {
            for e in darr where (e["period"] as? String)?.hasPrefix(monthKey) == true {
                if let bds = e["modelBreakdowns"] as? [[String: Any]] { raw.append(contentsOf: bds) }
            }
        }
        var acc: [String: (cost: Double, tokens: Int)] = [:]
        for b in raw {
            guard let name = b["modelName"] as? String else { continue }
            let cost = numDouble(b["cost"])
            let tok = numInt(b["inputTokens"]) + numInt(b["outputTokens"])
                    + numInt(b["cacheCreationTokens"]) + numInt(b["cacheReadTokens"])
            let prev = acc[name] ?? (0, 0)
            acc[name] = (prev.cost + cost, prev.tokens + tok)
        }
        return acc.map {
            ModelUsage(model: $0.key, label: shortenModelName($0.key), provider: providerOf($0.key),
                       cost: $0.value.cost, tokens: $0.value.tokens)
        }.sorted { $0.cost > $1.cost }
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

    // native weekly/monthly 에서 이번 주/이번 달 정확 집계
    let weeklyPick = pickPeriod(weeklyData, key: thisMondayKey, arrayKey: "weekly")
    let monthlyPick = pickPeriod(monthlyData, key: thisMonthKey, arrayKey: "monthly")

    // 이번 달 모델별 분해 (codex 포함)
    let modelBreakdown = parseModelBreakdown(monthlyData, monthKey: thisMonthKey)

    func dailyTokens(_ d: DailyUsage) -> Int {
        d.inputTokens + d.cacheCreationTokens + d.cacheReadTokens + d.outputTokens
    }

    // 이번 주 — native 우선, 없으면 daily 파생(월요일 이후 합)
    let thisWeekCost: Double
    let thisWeekTokens: Int
    if weeklyPick.found {
        thisWeekCost = weeklyPick.cost
        thisWeekTokens = weeklyPick.tokens
    } else {
        let wd = days.filter { $0.period >= thisMondayKey && $0.period <= todayStr }
        thisWeekCost = wd.reduce(0.0) { $0 + $1.totalCost }
        thisWeekTokens = wd.reduce(0) { $0 + dailyTokens($1) }
    }

    // 이번 달 — native 우선, 없으면 daily 파생(YYYY-MM 합)
    let thisMonthCost: Double
    let thisMonthTokens: Int
    if monthlyPick.found {
        thisMonthCost = monthlyPick.cost
        thisMonthTokens = monthlyPick.tokens
    } else {
        let md = days.filter { $0.period.hasPrefix(thisMonthKey) }
        thisMonthCost = md.reduce(0.0) { $0 + $1.totalCost }
        thisMonthTokens = md.reduce(0) { $0 + dailyTokens($1) }
    }

    // 누적 — monthly totals(전체 기간, 정확) 우선 → daily totals 블록 → days 합산.
    // hasTotals(블록 존재)로 판정 — totalsCost==0(사용액 0)이어도 블록이 있으면 정상값.
    let totalsObj = json["totals"] as? [String: Any]
    let allTimeCost: Double
    let allTimeTokens: Int
    if monthlyPick.hasTotals {
        allTimeCost = monthlyPick.totalsCost
        allTimeTokens = monthlyPick.totalsTokens
    } else if let t = totalsObj {
        allTimeCost = numDouble(t["totalCost"])
        allTimeTokens = numInt(t["totalTokens"])
    } else {
        allTimeCost = days.reduce(0.0) { $0 + $1.totalCost }
        allTimeTokens = days.reduce(0) { $0 + dailyTokens($1) }
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
        thisWeekCost: thisWeekCost,
        thisWeekTokens: thisWeekTokens,
        thisMonthCost: thisMonthCost,
        thisMonthTokens: thisMonthTokens,
        allTimeCost: allTimeCost,
        allTimeTokens: allTimeTokens,
        totalDays: days.count,
        usdKrwRate: rate,
        modelBreakdown: modelBreakdown,
        last7Costs: last7Costs,
        last14Costs: last14Costs,
        recent7Days: recent7Days,
        recent14Days: recent14Days
    )
}

// MARK: - 환율 (USD → KRW)

func fetchUsdKrwRate() -> Double {
    let FALLBACK = 1450.0
    let cached = UserDefaults.standard.double(forKey: "usdKrwRate")
    print("FX: 로컬 캐시/폴백 사용 (cached=\(cached))")
    fflush(stdout)
    return cached > 0 ? cached : FALLBACK
}

/// USD → KRW 포맷: ₩1,234,567 (정수, 천단위)
func formatKRW(_ usd: Double, rate: Double) -> String {
    let krw = (usd * rate).rounded()
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.maximumFractionDigits = 0
    return "₩" + (f.string(from: NSNumber(value: krw)) ?? "\(Int(krw))")
}

/// USD → KRW 축약: ₩3.7천만 / ₩1.4억 / ₩14만 / ₩1,380 (메뉴바 롤링용)
func formatKRWShort(_ usd: Double, rate: Double) -> String {
    let krw = (usd * rate).rounded()
    let absK = Swift.abs(krw)
    let sign = krw < 0 ? "-" : ""
    if absK >= 100_000_000 {
        return sign + String(format: absK >= 1_000_000_000 ? "₩%.0f억" : "₩%.1f억", absK / 100_000_000)
    }
    if absK >= 10_000_000 { return sign + String(format: "₩%.1f천만", absK / 10_000_000) }
    if absK >= 10_000 {
        let man = (absK / 10_000).rounded()
        let f = NumberFormatter(); f.numberStyle = .decimal; f.maximumFractionDigits = 0
        return sign + "₩" + (f.string(from: NSNumber(value: man)) ?? "\(Int(man))") + "만"
    }
    let f = NumberFormatter(); f.numberStyle = .decimal; f.maximumFractionDigits = 0
    return sign + "₩" + (f.string(from: NSNumber(value: absK)) ?? "\(Int(absK))")
}

func dailyUsageTotalTokens(_ daily: DailyUsage) -> Int {
    daily.inputTokens + daily.cacheCreationTokens + daily.cacheReadTokens + daily.outputTokens
}

func replacingToday(in data: UsageData, with freshToday: DailyUsage) -> UsageData {
    guard let previousToday = data.today, previousToday.period == freshToday.period else { return data }
    let costDelta = freshToday.totalCost - previousToday.totalCost
    let tokenDelta = dailyUsageTotalTokens(freshToday) - dailyUsageTotalTokens(previousToday)

    func replacePoint(_ point: DayPoint) -> DayPoint {
        guard point.date == freshToday.period else { return point }
        return DayPoint(date: point.date, cost: freshToday.totalCost, tokens: dailyUsageTotalTokens(freshToday))
    }

    let recent7Days = data.recent7Days.map(replacePoint)
    let recent14Days = data.recent14Days.map(replacePoint)

    return UsageData(
        today: freshToday,
        weeklyTotalCost: max(0, data.weeklyTotalCost + costDelta),
        thisWeekCost: max(0, data.thisWeekCost + costDelta),
        thisWeekTokens: max(0, data.thisWeekTokens + tokenDelta),
        thisMonthCost: max(0, data.thisMonthCost + costDelta),
        thisMonthTokens: max(0, data.thisMonthTokens + tokenDelta),
        allTimeCost: max(0, data.allTimeCost + costDelta),
        allTimeTokens: max(0, data.allTimeTokens + tokenDelta),
        totalDays: data.totalDays,
        usdKrwRate: data.usdKrwRate,
        modelBreakdown: data.modelBreakdown,
        last7Costs: recent7Days.isEmpty ? data.last7Costs : recent7Days.map { $0.cost },
        last14Costs: recent14Days.isEmpty ? data.last14Costs : recent14Days.map { $0.cost },
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

final class TeamClaudeTableView: NSView {
    var health: TeamClaudeHealth? {
        didSet {
            guard let health = health else { return }
            let total = max(health.accountTotal, health.accountConfigured)
            setAccessibilityLabel("TeamClaude, 활성 \(health.accountActive)/\(total), 라우팅 가능 \(health.accountUsable), 계정 연동 불일치 \(health.accountConfigDrift), 측정 필요 \(health.measurementPendingCount), 상태 확인 \(health.measurementUnavailableCount), 사용 한도 \(health.quotaLimitedCount), Fable 경고 \(health.fableOver), 상태 \(health.statusLabel)")
            setAccessibilityHelp(health.measurementPendingCount > 0 ? "Return 키를 누르면 미측정 계정을 지금 측정합니다." : nil)
            needsDisplay = true
        }
    }
    var isMeasuring = false { didSet { needsDisplay = true } }
    var measurementDetail: String? { didSet { needsDisplay = true } }
    var onMeasure: (() -> Void)?
    private var measureActionRect = NSRect.zero
    private var measureRowRects: [NSRect] = []
    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setAccessibilityElement(true)
        setAccessibilityRole(.group)
        setAccessibilityLabel("TeamClaude 상태")
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        if measureActionRect.contains(point) || measureRowRects.contains(where: { $0.contains(point) }) {
            onMeasure?()
            return
        }
        super.mouseDown(with: event)
    }

    override func keyDown(with event: NSEvent) {
        if (event.keyCode == 36 || event.charactersIgnoringModifiers == " "), health?.measurementPendingCount ?? 0 > 0, !isMeasuring {
            onMeasure?()
            return
        }
        super.keyDown(with: event)
    }

    override func resetCursorRects() {
        super.resetCursorRects()
        if !measureActionRect.isEmpty { addCursorRect(measureActionRect, cursor: .pointingHand) }
        for rect in measureRowRects { addCursorRect(rect, cursor: .pointingHand) }
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard let health = health else { return }
        measureActionRect = .zero
        measureRowRects.removeAll(keepingCapacity: true)

        let card = bounds.insetBy(dx: 8, dy: 4)
        let bg = NSColor(calibratedRed: 0.06, green: 0.075, blue: 0.10, alpha: 0.97)
        let panel = NSColor(calibratedRed: 0.095, green: 0.115, blue: 0.15, alpha: 1.0)
        let panel2 = NSColor(calibratedRed: 0.12, green: 0.14, blue: 0.18, alpha: 1.0)
        let line = NSColor(calibratedRed: 0.23, green: 0.27, blue: 0.34, alpha: 1.0)
        let text = NSColor(calibratedRed: 0.92, green: 0.95, blue: 0.98, alpha: 1.0)
        let muted = NSColor(calibratedRed: 0.55, green: 0.61, blue: 0.70, alpha: 1.0)
        let green = NSColor(calibratedRed: 0.18, green: 0.82, blue: 0.48, alpha: 1.0)
        let yellow = NSColor(calibratedRed: 0.93, green: 0.76, blue: 0.22, alpha: 1.0)
        let red = NSColor(calibratedRed: 0.96, green: 0.26, blue: 0.32, alpha: 1.0)
        let blue = NSColor(calibratedRed: 0.28, green: 0.55, blue: 0.90, alpha: 1.0)
        let titleFont = NSFont.systemFont(ofSize: 18, weight: .bold)
        let subFont = NSFont.systemFont(ofSize: 13, weight: .medium)
        let headFont = NSFont.systemFont(ofSize: 12, weight: .semibold)
        let rowFont = NSFont.monospacedSystemFont(ofSize: 13, weight: .medium)
        let smallFont = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)

        func attrs(_ font: NSFont, _ color: NSColor) -> [NSAttributedString.Key: Any] {
            [.font: font, .foregroundColor: color]
        }
        func drawText(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
            value.draw(at: NSPoint(x: x, y: y), withAttributes: attrs(font, color))
        }
        func drawRight(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
            let a = attrs(font, color)
            let s = value.size(withAttributes: a)
            value.draw(at: NSPoint(x: x - s.width, y: y), withAttributes: a)
        }
        func tone(_ percent: Double?) -> NSColor {
            guard let percent = percent else { return muted }
            if percent >= 90 { return red }
            if percent >= 70 { return yellow }
            return green
        }
        func percentText(_ percent: Double?) -> String {
            guard let percent = percent else { return "-" }
            return "\(Int(percent.rounded()))%"
        }
        func probeAttempted(_ row: TeamClaudeAccountHealth) -> Bool {
            row.probedAt != nil || row.totalRequests > 0 || row.totalTokens > 0
        }
        func clipped(_ value: String, _ count: Int) -> String {
            if value.count <= count { return value }
            return String(value.prefix(max(0, count - 1))) + "…"
        }
        func fillRound(_ rect: NSRect, _ color: NSColor, _ radius: CGFloat) {
            color.setFill()
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
        }
        func strokeRound(_ rect: NSRect, _ color: NSColor, _ radius: CGFloat) {
            color.setStroke()
            let p = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
            p.lineWidth = 1
            p.stroke()
        }
        func pill(_ value: String, x: CGFloat, y: CGFloat, color: NSColor) {
            let size = value.size(withAttributes: attrs(subFont, color))
            let rect = NSRect(x: x, y: y, width: size.width + 16, height: 22)
            fillRound(rect, color.withAlphaComponent(0.14), 11)
            strokeRound(rect, color.withAlphaComponent(0.38), 11)
            drawText(value, x + 8, y + 3.5, subFont, color)
        }
        func stat(_ title: String, _ value: String, _ detail: String, x: CGFloat, y: CGFloat, width: CGFloat, color: NSColor) {
            let rect = NSRect(x: x, y: y, width: width, height: 54)
            fillRound(rect, panel, 9)
            strokeRound(rect, line.withAlphaComponent(0.8), 9)
            drawText(title.uppercased(), x + 10, y + 8, headFont, muted)
            drawText(value, x + 10, y + 25, NSFont.monospacedSystemFont(ofSize: 18, weight: .bold), color)
            drawText(detail, x + width - detail.size(withAttributes: attrs(smallFont, muted)).width - 10, y + 31, smallFont, muted)
        }
        func bar(_ percent: Double?, x: CGFloat, y: CGFloat, width: CGFloat, color: NSColor) {
            fillRound(NSRect(x: x, y: y, width: width, height: 7), NSColor.white.withAlphaComponent(0.10), 3.5)
            guard let percent = percent else { return }
            let fillW = max(3, width * CGFloat(max(0, min(100, percent)) / 100.0))
            fillRound(NSRect(x: x, y: y, width: fillW, height: 7), color, 3.5)
        }

        fillRound(card, bg, 14)
        strokeRound(card, line, 14)

        let innerX = card.minX + 16
        let topY = card.minY + 14
        drawText("TeamClaude", innerX, topY, titleFont, text)
        pill(health.serverReachable ? "실행중" : "오프라인", x: innerX + 122, y: topY - 2, color: health.serverReachable ? green : red)
        let integrationLabel = !health.statusIdentityAvailable ? "상태 조회 인증 확인"
            : (health.accountConfigDrift == 0 ? "연동 정상" : "연동 불일치 \(health.accountConfigDrift)")
        drawText("port \(health.serverPort ?? 0)  ·  pid \(health.serverPid.map(String.init) ?? "-")  ·  \(integrationLabel)", innerX, topY + 29, subFont, health.accountConfigDrift == 0 ? muted : yellow)
        let hostLineShown = health.hostSummaryText != nil
        if let hostText = health.hostSummaryText {
            drawText(hostText, innerX, topY + 48, subFont, health.hostIsWarning ? red : muted)
        }
        let totalAccounts = max(health.accountTotal, health.accountConfigured)
        let fableDetail = health.fableKnown > 0
            ? "Fable \(health.fableOver)/\(totalAccounts) 경고 · \(health.fableKnown)측정"
            : "Fable 미측정 · \(totalAccounts)계정"
        let pendingCount = health.measurementPendingCount
        let unavailableCount = health.measurementUnavailableCount
        let quotaLimitedCount = health.quotaLimitedCount
        let actionRect = NSRect(x: card.maxX - 330, y: topY - 4, width: 314, height: 48)
        let actionColor: NSColor
        let actionTitle: String
        let actionDetail: String
        if isMeasuring {
            actionColor = blue
            actionTitle = "계정 사용량 측정 중"
            actionDetail = measurementDetail ?? "잠시만 기다려 주세요"
        } else if !health.statusIdentityAvailable {
            actionColor = yellow
            actionTitle = "상태 조회 인증 확인 필요"
            actionDetail = "계정 설정의 프록시 연결 정보를 확인하세요"
        } else if health.accountConfigDrift > 0 {
            actionColor = yellow
            actionTitle = "\(health.accountConfigDrift)개 계정 연동 불일치"
            actionDetail = "자동 동기화 중 · 서버 반영 확인"
        } else if pendingCount > 0 {
            actionColor = yellow
            actionTitle = "\(pendingCount)개 계정 측정 필요"
            if let measurementDetail, measurementDetail.contains("실패") || measurementDetail.contains("확인 필요") {
                actionDetail = measurementDetail
            } else {
                actionDetail = "클릭하여 지금 측정"
            }
            measureActionRect = actionRect
        } else if unavailableCount > 0 {
            actionColor = red
            actionTitle = "\(unavailableCount)개 계정 상태 확인 필요"
            actionDetail = "일시 제한 해제 후 자동 복구"
        } else if quotaLimitedCount > 0 {
            actionColor = yellow
            actionTitle = "\(quotaLimitedCount)개 계정 라우팅 한도 대기"
            actionDetail = "세션·주간·Fable 중 하나 이상 · 리셋 후 자동 전환"
        } else {
            actionColor = green
            actionTitle = "모든 계정 측정 완료"
            actionDetail = fableDetail
        }
        fillRound(actionRect, actionColor.withAlphaComponent(0.11), 8)
        strokeRound(actionRect, actionColor.withAlphaComponent(0.45), 8)
        let actionIcon = isMeasuring ? "↻" : (pendingCount > 0 || unavailableCount > 0 || quotaLimitedCount > 0 ? "!" : "✓")
        drawText(actionIcon, actionRect.minX + 12, actionRect.minY + 8, titleFont, actionColor)
        drawText(clipped(actionTitle, 28), actionRect.minX + 40, actionRect.minY + 6, subFont, actionColor)
        drawText(clipped(actionDetail, 38), actionRect.minX + 40, actionRect.minY + 25, smallFont, muted)

        let statY = topY + (hostLineShown ? 78 : 58)
        let statW = (card.width - 32 - 27) / 4
        stat("라우팅 가능", "\(health.accountUsable)/\(max(health.accountTotal, health.accountConfigured))", "accounts", x: innerX, y: statY, width: statW, color: health.accountUsable > 0 ? green : red)
        stat("Fable", "\(health.fableOver)/\(totalAccounts)", "\(health.fableKnown)측정", x: innerX + statW + 9, y: statY, width: statW, color: health.fableOver > 0 ? red : green)
        stat("최대", health.fableMaxPercent.map { String(format: "%.1f%%", $0) } ?? "-", "weekly", x: innerX + (statW + 9) * 2, y: statY, width: statW, color: health.fableOver > 0 ? red : yellow)
        stat("다음 리셋", formatDurationShort(health.retryAfterSeconds), "soonest", x: innerX + (statW + 9) * 3, y: statY, width: statW, color: blue)

        let tableY = statY + 70
        fillRound(NSRect(x: innerX, y: tableY, width: card.width - 32, height: 30), panel2, 8)
        drawText("계정", innerX + 12, tableY + 8, headFont, muted)
        drawText("세션", innerX + 270, tableY + 8, headFont, muted)
        drawText("주간", innerX + 450, tableY + 8, headFont, muted)
        drawText("fable", innerX + 620, tableY + 8, headFont, muted)
        drawText("측정", innerX + 790, tableY + 8, headFont, muted)

        for (i, row) in health.accounts.enumerated() {
            let y = tableY + 34 + CGFloat(i) * 28
            let rowRect = NSRect(x: innerX, y: y, width: card.width - 32, height: 26)
            if row.isCurrent {
                fillRound(rowRect, green.withAlphaComponent(0.13), 7)
                strokeRound(rowRect, green.withAlphaComponent(0.32), 7)
            } else if i % 2 == 1 {
                fillRound(rowRect, NSColor.white.withAlphaComponent(0.035), 7)
            }
            let rowPair = teamClaudeQuotaPair(for: row)
            let maxKnownQuota = [row.sessionPercent, rowPair?.weeklyPercent, rowPair?.fablePercent].compactMap { $0 }.max() ?? 0
            let dotColor = row.isUsable ? green : (row.status == "error" || maxKnownQuota >= 98 ? red : (row.status == "configured" ? blue : yellow))
            fillRound(NSRect(x: innerX + 10, y: y + 9, width: 8, height: 8), dotColor, 4)
            let nameColor = row.isCurrent ? green : (row.status == "configured" ? muted : text)
            drawText((row.isCurrent ? ">" : " ") + clipped(row.name, 30), innerX + 24, y + 5, rowFont, nameColor)

            let attempted = probeAttempted(row)
            let session = teamClaudeSessionState(percent: row.sessionPercent, lastUsed: row.probedAt)
            let sessionPercent = session.percent
            let sesColor = tone(sessionPercent)
            drawText(percentText(sessionPercent), innerX + 270, y + 5, rowFont, sessionPercent == nil ? blue : sesColor)
            bar(sessionPercent, x: innerX + 314, y: y + 10, width: 74, color: sesColor)
            let sessionDetail = session.isStale
                ? (row.measurementIssue == .quotaBlocked ? "한도리셋" : "재측정")
                : (sessionPercent != nil ? formatTeamClaudeDuration(row.sessionResetSeconds) : (attempted ? "확인필요" : "측정전"))
            drawText(sessionDetail, innerX + 398, y + 5, smallFont, muted)

            // 주간·Fable 독립 표시 — 프록시는 재시작 후 Fable(7d_oi) 창을 의도적으로
            // 스냅샷 복원하지 않고 재측정한다(self-lock 방지). 구 all-four 페어링
            // 가드(teamClaudeQuotaPair)는 Fable 미측정 계정의 주간 표시까지 막아
            // 두 열 모두 "동기화중"으로 떨어뜨렸다 (2026-07-22 사고).
            let wkPercent = row.weeklyPercent
            let wkColor = tone(wkPercent)
            drawText(wkPercent != nil ? percentText(wkPercent) : "동기화중", innerX + 450, y + 5, rowFont, wkPercent != nil ? wkColor : yellow)
            bar(wkPercent, x: innerX + 494, y: y + 10, width: 74, color: wkColor)
            drawText(formatTeamClaudeDuration(row.weeklyResetSeconds), innerX + 578, y + 5, smallFont, muted)

            let fbPercent = row.fablePercent
            let fbColor = tone(fbPercent)
            drawText(fbPercent != nil ? percentText(fbPercent) : "측정전", innerX + 620, y + 5, rowFont, fbPercent != nil ? fbColor : muted)
            bar(fbPercent, x: innerX + 682, y: y + 10, width: 48, color: fbColor)
            drawText(formatTeamClaudeDuration(row.fableResetSeconds), innerX + 738, y + 5, smallFont, muted)
            if let issue = row.measurementIssue {
                if issue.canMeasureNow && !isMeasuring {
                    let rowActionRect = NSRect(x: innerX + 780, y: y + 2, width: 58, height: 22)
                    fillRound(rowActionRect, yellow.withAlphaComponent(0.13), 6)
                    strokeRound(rowActionRect, yellow.withAlphaComponent(0.42), 6)
                    drawText("측정", rowActionRect.minX + 16, y + 5, smallFont, yellow)
                    measureRowRects.append(rowActionRect)
                } else {
                    drawText(issue.compactText, innerX + 790, y + 5, smallFont, issue == .quotaBlocked ? red : muted)
                }
            } else {
                let probeText = row.probedAt.map(formatTeamClaudeProbe) ?? (row.source.map { "\($0)" } ?? "-")
                drawText(probeText, innerX + 790, y + 5, smallFont, muted)
            }
        }

        window?.invalidateCursorRects(for: self)

        let footerY = card.maxY - 33
        NSBezierPath.strokeLine(from: NSPoint(x: innerX, y: footerY - 8), to: NSPoint(x: card.maxX - 16, y: footerY - 8))
        drawText("초록 <70%    노랑 70-89%    빨강 >=90%    현재 계정 강조", innerX, footerY, smallFont, muted)
    }
}

final class StatusMenuDashboardView: NSView {
    static let preferredWidth: CGFloat = 880
    static let maxTeamHeight: CGFloat = 596
    static let maxMenuDashboardHeight: CGFloat = 936

    private var teamClaudeView: TeamClaudeTableView?
    private var codexView: CodexStatusView?
    private var usageView: UsageDashboardView?
    private var renderedAccountCount = -1
    private var renderedCodexPresent = false
    private var renderedTeamCodexAccountCount = -1
    private var renderedTeamCodexPresent = false
    private var renderedUsageHeight: CGFloat = 0
    override var isFlipped: Bool { true }

    static func teamContentHeight(_ health: TeamClaudeHealth?) -> CGFloat {
        guard let health = health else { return 0 }
        // 호스트 라인이 표시될 때만 20pt 추가 (구버전 서버·미측정 시 여백 없음)
        let base: CGFloat = health.hostSummaryText != nil ? 258 : 238
        return base + CGFloat(health.accounts.count) * 28
    }

    static func teamHeight(_ health: TeamClaudeHealth?) -> CGFloat {
        min(teamContentHeight(health), maxTeamHeight)
    }

    static func codexHeight(_ health: CodexHealth?, teamCodex: TeamCodexPoolHealth?) -> CGFloat {
        health == nil && teamCodex == nil ? 0 : CodexStatusView.preferredHeight(for: teamCodex)
    }

    static func preferredHeight(teamClaude: TeamClaudeHealth?, codex: CodexHealth?, teamCodex: TeamCodexPoolHealth?, usage: UsageData?) -> CGFloat {
        let team = teamHeight(teamClaude)
        let codex = codexHeight(codex, teamCodex: teamCodex)
        let usage = UsageDashboardView.preferredHeight(for: usage)
        return 8 + team + (team > 0 ? 4 : 0) + codex + (codex > 0 ? 4 : 0) + usage + 8
    }

    func configure(
        teamClaude: TeamClaudeHealth?,
        codex: CodexHealth?,
        teamCodex: TeamCodexPoolHealth?,
        usage: UsageData?,
        parallelCount: Int,
        active: Bool,
        isMeasuringTeamClaude: Bool,
        teamClaudeMeasureDetail: String?,
        onMeasureTeamClaude: (() -> Void)?
    ) {
        subviews.removeAll()
        renderedAccountCount = teamClaude?.accounts.count ?? 0
        renderedCodexPresent = codex != nil
        renderedTeamCodexAccountCount = teamCodex?.accounts.count ?? 0
        renderedTeamCodexPresent = teamCodex != nil
        renderedUsageHeight = UsageDashboardView.preferredHeight(for: usage)
        var y: CGFloat = 4

        if let teamClaude = teamClaude {
            let contentHeight = Self.teamContentHeight(teamClaude)
            let height = Self.teamHeight(teamClaude)
            let view = TeamClaudeTableView(frame: NSRect(x: 0, y: 0, width: bounds.width, height: contentHeight))
            view.health = teamClaude
            view.isMeasuring = isMeasuringTeamClaude
            view.measurementDetail = teamClaudeMeasureDetail
            view.onMeasure = onMeasureTeamClaude
            teamClaudeView = view

            if contentHeight > height {
                let scrollView = NSScrollView(frame: NSRect(x: 0, y: y, width: bounds.width, height: height))
                scrollView.documentView = view
                scrollView.hasVerticalScroller = true
                scrollView.autohidesScrollers = true
                scrollView.scrollerStyle = .overlay
                scrollView.drawsBackground = false
                scrollView.borderType = .noBorder
                scrollView.contentView.scroll(to: .zero)
                addSubview(scrollView)
            } else {
                view.frame.origin.y = y
                addSubview(view)
            }
            y += height + 4
        }

        if codex != nil || teamCodex != nil {
            let codexHeight = CodexStatusView.preferredHeight(for: teamCodex)
            let view = CodexStatusView(frame: NSRect(x: 0, y: y, width: bounds.width, height: codexHeight))
            view.health = codex
            view.pool = teamCodex
            view.usage = usage
            addSubview(view)
            codexView = view
            y += codexHeight + 4
        }

        let usageHeight = UsageDashboardView.preferredHeight(for: usage)
        let view = UsageDashboardView(frame: NSRect(x: 0, y: y, width: bounds.width, height: usageHeight))
        view.usage = usage
        view.parallelCount = parallelCount
        view.active = active
        addSubview(view)
        usageView = view
    }

    func updateContent(
        teamClaude: TeamClaudeHealth?,
        codex: CodexHealth?,
        teamCodex: TeamCodexPoolHealth?,
        usage: UsageData?,
        parallelCount: Int,
        active: Bool,
        isMeasuringTeamClaude: Bool,
        teamClaudeMeasureDetail: String?,
        onMeasureTeamClaude: (() -> Void)?
    ) {
        let accountCount = teamClaude?.accounts.count ?? 0
        let usageHeight = UsageDashboardView.preferredHeight(for: usage)
        let structureChanged = accountCount != renderedAccountCount
            || (codex != nil) != renderedCodexPresent
            || (teamCodex?.accounts.count ?? 0) != renderedTeamCodexAccountCount
            || (teamCodex != nil) != renderedTeamCodexPresent
            || usageHeight != renderedUsageHeight
        if structureChanged {
            frame.size.height = Self.preferredHeight(teamClaude: teamClaude, codex: codex, teamCodex: teamCodex, usage: usage)
            configure(
                teamClaude: teamClaude,
                codex: codex,
                teamCodex: teamCodex,
                usage: usage,
                parallelCount: parallelCount,
                active: active,
                isMeasuringTeamClaude: isMeasuringTeamClaude,
                teamClaudeMeasureDetail: teamClaudeMeasureDetail,
                onMeasureTeamClaude: onMeasureTeamClaude
            )
            return
        }

        teamClaudeView?.health = teamClaude
        teamClaudeView?.isMeasuring = isMeasuringTeamClaude
        teamClaudeView?.measurementDetail = teamClaudeMeasureDetail
        teamClaudeView?.onMeasure = onMeasureTeamClaude
        codexView?.health = codex
        codexView?.pool = teamCodex
        codexView?.usage = usage
        usageView?.usage = usage
        usageView?.parallelCount = parallelCount
        usageView?.active = active
        usageView?.needsDisplay = true
    }
}

final class UsageDashboardView: NSView {
    var usage: UsageData? {
        didSet {
            if let usage = usage, let today = usage.today {
                setAccessibilityLabel("사용량 대시보드, 오늘 \(formatCost(today.totalCost)), 이번 주 \(formatCost(usage.thisWeekCost)), 이번 달 \(formatCost(usage.thisMonthCost))")
            }
            needsDisplay = true
        }
    }
    var parallelCount: Int = 0
    var active: Bool = false
    override var isFlipped: Bool { true }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setAccessibilityElement(true)
        setAccessibilityRole(.group)
        setAccessibilityLabel("사용량 대시보드")
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    static func preferredHeight(for usage: UsageData?) -> CGFloat {
        guard usage?.today != nil else { return 176 }
        return 500
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        let bg = NSColor(calibratedRed: 0.06, green: 0.075, blue: 0.10, alpha: 0.97)
        let panel = NSColor(calibratedRed: 0.095, green: 0.115, blue: 0.15, alpha: 1.0)
        let line = NSColor(calibratedRed: 0.23, green: 0.27, blue: 0.34, alpha: 1.0)
        let text = NSColor(calibratedRed: 0.92, green: 0.95, blue: 0.98, alpha: 1.0)
        let muted = NSColor(calibratedRed: 0.55, green: 0.61, blue: 0.70, alpha: 1.0)
        let dim = NSColor(calibratedRed: 0.40, green: 0.46, blue: 0.55, alpha: 1.0)
        let green = NSColor(calibratedRed: 0.18, green: 0.82, blue: 0.48, alpha: 1.0)
        let yellow = NSColor(calibratedRed: 0.93, green: 0.76, blue: 0.22, alpha: 1.0)
        let blue = NSColor(calibratedRed: 0.28, green: 0.55, blue: 0.90, alpha: 1.0)

        let titleFont = NSFont.systemFont(ofSize: 18, weight: .bold)
        let sectionFont = NSFont.systemFont(ofSize: 12.5, weight: .semibold)
        let bodyFont = NSFont.systemFont(ofSize: 12.5, weight: .medium)
        let smallFont = NSFont.systemFont(ofSize: 11, weight: .medium)
        let monoFont = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium)
        let krwRate = usage?.usdKrwRate ?? 1450.0

        func attrs(_ font: NSFont, _ color: NSColor) -> [NSAttributedString.Key: Any] {
            [.font: font, .foregroundColor: color]
        }
        func drawText(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
            value.draw(at: NSPoint(x: x, y: y), withAttributes: attrs(font, color))
        }
        func drawRight(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
            let a = attrs(font, color)
            let s = value.size(withAttributes: a)
            value.draw(at: NSPoint(x: x - s.width, y: y), withAttributes: a)
        }
        func fillRound(_ rect: NSRect, _ color: NSColor, _ radius: CGFloat) {
            color.setFill()
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
        }
        func strokeRound(_ rect: NSRect, _ color: NSColor, _ radius: CGFloat) {
            color.setStroke()
            let p = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
            p.lineWidth = 1
            p.stroke()
        }
        func pill(_ value: String, x: CGFloat, y: CGFloat, color: NSColor) {
            let a = attrs(smallFont, color)
            let s = value.size(withAttributes: a)
            let rect = NSRect(x: x, y: y, width: s.width + 16, height: 22)
            fillRound(rect, color.withAlphaComponent(0.14), 11)
            strokeRound(rect, color.withAlphaComponent(0.38), 11)
            value.draw(at: NSPoint(x: x + 8, y: y + 3.5), withAttributes: a)
        }
        func metric(_ label: String, _ usd: String, _ krw: String, _ detail: String, rect: NSRect, color: NSColor) {
            fillRound(rect, panel, 9)
            strokeRound(rect, line.withAlphaComponent(0.80), 9)
            drawText(label.uppercased(), rect.minX + 10, rect.minY + 8, sectionFont, muted)
            drawRight(detail, rect.maxX - 10, rect.minY + 9, smallFont, dim)
            let valueFont = NSFont.monospacedDigitSystemFont(ofSize: usd.count > 11 ? 16 : 18, weight: .bold)
            drawText(usd, rect.minX + 10, rect.minY + 28, valueFont, color)
            drawText(krw, rect.minX + 10, rect.minY + 52, smallFont, muted)
        }
        func labelForDate(_ ymd: String) -> String {
            guard let date = dateFromYMD(ymd) else { return shortDate(ymd) }
            if Calendar.current.isDateInToday(date) { return "오늘" }
            if Calendar.current.isDateInYesterday(date) { return "어제" }
            return shortDate(ymd)
        }
        func drawMiniBar(value: Double, maxValue: Double, rect: NSRect, color: NSColor) {
            fillRound(rect, NSColor.white.withAlphaComponent(0.08), rect.height / 2)
            guard maxValue > 0, value > 0 else { return }
            let width = max(3, rect.width * CGFloat(value / maxValue))
            fillRound(NSRect(x: rect.minX, y: rect.minY, width: width, height: rect.height), color, rect.height / 2)
        }
        func drawTrend(_ points: [DayPoint], rect: NSRect) {
            fillRound(rect, panel, 9)
            strokeRound(rect, line.withAlphaComponent(0.75), 9)
            drawText("최근 14일 비용", rect.minX + 12, rect.minY + 10, sectionFont, muted)
            guard !points.isEmpty, let maxCost = points.map({ $0.cost }).max(), maxCost > 0 else {
                drawText("표시할 비용 데이터가 없습니다", rect.minX + 12, rect.minY + 60, bodyFont, dim)
                return
            }
            if let peak = points.max(by: { $0.cost < $1.cost }) {
                drawRight("최고 \(formatCostShort(peak.cost)) · \(formatKRWShort(peak.cost, rate: krwRate))", rect.maxX - 12, rect.minY + 10, smallFont, dim)
            }
            let chart = NSRect(x: rect.minX + 12, y: rect.minY + 38, width: rect.width - 24, height: rect.height - 58)
            let gap: CGFloat = 3
            let barW = max(3, (chart.width - gap * CGFloat(points.count - 1)) / CGFloat(points.count))
            for (i, point) in points.enumerated() {
                let ratio = CGFloat(point.cost / maxCost)
                let barH = max(2, chart.height * ratio)
                let x = chart.minX + CGFloat(i) * (barW + gap)
                let y = chart.maxY - barH
                let color = i == points.count - 1 ? green : blue.withAlphaComponent(0.38 + 0.46 * CGFloat(i) / CGFloat(max(points.count - 1, 1)))
                fillRound(NSRect(x: x, y: y, width: barW, height: barH), color, 2)
            }
            if let first = points.first, let last = points.last {
                drawText(shortDate(first.date), chart.minX, rect.maxY - 16, smallFont, dim)
                drawRight("오늘 \(shortDate(last.date))", chart.maxX, rect.maxY - 16, smallFont, dim)
            }
        }
        func drawDaily(_ points: [DayPoint], rect: NSRect) {
            fillRound(rect, panel, 9)
            strokeRound(rect, line.withAlphaComponent(0.75), 9)
            drawText("일별 추이", rect.minX + 12, rect.minY + 10, sectionFont, muted)
            let rows = Array(points.reversed().prefix(7))
            let maxCost = rows.map { $0.cost }.max() ?? 1
            for (i, point) in rows.enumerated() {
                let y = rect.minY + 36 + CGFloat(i) * 19
                let isToday = Calendar.current.isDateInToday(dateFromYMD(point.date) ?? Date.distantPast)
                let rowColor = isToday ? green : text
                drawText(labelForDate(point.date), rect.minX + 12, y, monoFont, rowColor)
                drawMiniBar(value: point.cost, maxValue: maxCost, rect: NSRect(x: rect.minX + 62, y: y + 5, width: 112, height: 6), color: isToday ? green : blue)
                drawRight(formatCost(point.cost), rect.maxX - 146, y, monoFont, rowColor)
                drawRight(formatKRWShort(point.cost, rate: krwRate), rect.maxX - 76, y + 1, NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .regular), dim)
                drawRight(formatTokens(point.tokens), rect.maxX - 12, y + 1, NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .regular), dim)
            }
        }
        func drawProviders(_ models: [ModelUsage], rect: NSRect, rate: Double) {
            fillRound(rect, panel, 9)
            strokeRound(rect, line.withAlphaComponent(0.75), 9)
            drawText("모델별 비용", rect.minX + 12, rect.minY + 10, sectionFont, muted)
            drawRight("환율 1 USD = ₩\(String(format: "%.1f", rate))", rect.maxX - 12, rect.minY + 10, smallFont, dim)

            if models.isEmpty {
                drawText("이번 달 모델별 데이터가 아직 없습니다", rect.minX + 12, rect.minY + 54, bodyFont, dim)
                return
            }

            var providerTotals: [String: Double] = [:]
            for model in models { providerTotals[model.provider, default: 0] += model.cost }
            let providers = providerTotals.sorted { $0.value > $1.value }
            let total = providers.reduce(0.0) { $0 + $1.value }

            var x = rect.minX + 12
            for item in providers.prefix(4) {
                let color = providerColor(item.key)
                fillRound(NSRect(x: x, y: rect.minY + 36, width: 7, height: 7), color, 3.5)
                x += 11
                let label = "\(item.key) \(formatKRWShort(item.value, rate: rate))"
                drawText(label, x, rect.minY + 31, smallFont, text)
                x += label.size(withAttributes: attrs(smallFont, text)).width + 15
            }

            let track = NSRect(x: rect.minX + 12, y: rect.minY + 55, width: rect.width - 24, height: 8)
            fillRound(track, NSColor.white.withAlphaComponent(0.08), 4)
            if total > 0 {
                NSGraphicsContext.saveGraphicsState()
                NSBezierPath(roundedRect: track, xRadius: 4, yRadius: 4).addClip()
                var bx = track.minX
                for item in providers {
                    let seg = track.width * CGFloat(item.value / total)
                    providerColor(item.key).withAlphaComponent(0.90).setFill()
                    NSBezierPath(rect: NSRect(x: bx, y: track.minY, width: seg, height: track.height)).fill()
                    bx += seg
                }
                NSGraphicsContext.restoreGraphicsState()
            }

            let maxCost = models.first?.cost ?? 1
            for (i, model) in models.prefix(4).enumerated() {
                let y = rect.minY + 72 + CGFloat(i) * 18
                let color = providerColor(model.provider)
                fillRound(NSRect(x: rect.minX + 12, y: y + 5, width: 7, height: 7), color, 3.5)
                drawText(model.label, rect.minX + 25, y, bodyFont, text)
                let barX = rect.minX + 154
                let barW = rect.width - 294
                if barW > 20 {
                    drawMiniBar(value: model.cost, maxValue: maxCost, rect: NSRect(x: barX, y: y + 6, width: barW, height: 6), color: color)
                }
                drawRight(formatKRWShort(model.cost, rate: rate), rect.maxX - 88, y + 1, NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .regular), dim)
                drawRight(formatCost(model.cost), rect.maxX - 12, y, monoFont, text)
            }
        }

        let card = bounds.insetBy(dx: 8, dy: 4)
        fillRound(card, bg, 14)
        strokeRound(card, line, 14)

        guard let usageData = usage, let today = usageData.today else {
            drawText("사용량 대시보드", card.minX + 16, card.minY + 16, titleFont, text)
            pill(active ? "작업 중" : "대기", x: card.minX + 154, y: card.minY + 14, color: active ? green : muted)
            fillRound(NSRect(x: card.minX + 16, y: card.minY + 54, width: card.width - 32, height: 70), panel, 10)
            drawText("ccusage 데이터를 기다리는 중입니다", card.minX + 32, card.minY + 75, NSFont.systemFont(ofSize: 14.5, weight: .semibold), text)
            drawText("새로고침을 누르거나 잠시 뒤 다시 열면 최신 사용량을 표시합니다", card.minX + 32, card.minY + 100, bodyFont, dim)
            return
        }

        let innerX = card.minX + 16
        let topY = card.minY + 16
        let rate = usageData.usdKrwRate
        let todayTokens = today.inputTokens + today.cacheCreationTokens + today.cacheReadTokens + today.outputTokens

        drawText("사용량 대시보드", innerX, topY, titleFont, text)
        pill(active ? "작업 중" : "대기", x: innerX + 148, y: topY - 2, color: active ? green : muted)
        pill("병렬 \(parallelCount)", x: innerX + 236, y: topY - 2, color: parallelCount > 0 ? green : blue)
        drawRight("오늘 \(formatKRWShort(today.totalCost, rate: rate)) · 총 \(formatTokens(usageData.allTimeTokens))", card.maxX - 16, topY + 2, bodyFont, muted)

        let metricY = topY + 44
        let gap: CGFloat = 9
        let metricW = (card.width - 32 - gap * 3) / 4
        metric("오늘", formatCost(today.totalCost), formatKRW(today.totalCost, rate: rate), formatTokens(todayTokens), rect: NSRect(x: innerX, y: metricY, width: metricW, height: 68), color: green)
        metric("최근 7일", formatCost(usageData.weeklyTotalCost), formatKRW(usageData.weeklyTotalCost, rate: rate), "이번주 \(formatKRWShort(usageData.thisWeekCost, rate: rate))", rect: NSRect(x: innerX + (metricW + gap), y: metricY, width: metricW, height: 68), color: blue)
        metric("이번 달", formatCost(usageData.thisMonthCost), formatKRW(usageData.thisMonthCost, rate: rate), formatTokens(usageData.thisMonthTokens), rect: NSRect(x: innerX + (metricW + gap) * 2, y: metricY, width: metricW, height: 68), color: yellow)
        metric("누적", formatCost(usageData.allTimeCost), formatKRW(usageData.allTimeCost, rate: rate), formatTokens(usageData.allTimeTokens), rect: NSRect(x: innerX + (metricW + gap) * 3, y: metricY, width: metricW, height: 68), color: text)

        let mainY = metricY + 84
        let leftW = (card.width - 32 - gap) * 0.47
        let rightW = card.width - 32 - gap - leftW
        drawTrend(usageData.recent14Days, rect: NSRect(x: innerX, y: mainY, width: leftW, height: 162))
        drawDaily(usageData.recent7Days, rect: NSRect(x: innerX + leftW + gap, y: mainY, width: rightW, height: 162))

        let modelY = mainY + 178
        drawProviders(usageData.modelBreakdown, rect: NSRect(x: innerX, y: modelY, width: card.width - 32, height: 138), rate: rate)
    }
}

final class MenuActionRowView: NSView {
    static let preferredHeight: CGFloat = 46
    let icon: String
    let symbolName: String?
    let title: String
    var detail: String {
        didSet {
            setAccessibilityHelp(detail)
            needsDisplay = true
        }
    }
    let tone: NSColor
    var onClick: (() -> Void)?
    private var hovered = false
    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    init(frame frameRect: NSRect, icon: String, symbolName: String? = nil, title: String, detail: String, tone: NSColor) {
        self.icon = icon
        self.symbolName = symbolName
        self.title = title
        self.detail = detail
        self.tone = tone
        super.init(frame: frameRect)
        setAccessibilityElement(true)
        setAccessibilityRole(.button)
        setAccessibilityLabel(title)
        setAccessibilityHelp(detail)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach { removeTrackingArea($0) }
        addTrackingArea(NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeAlways], owner: self, userInfo: nil))
    }

    override func mouseEntered(with event: NSEvent) {
        hovered = true
        needsDisplay = true
    }

    override func mouseExited(with event: NSEvent) {
        hovered = false
        needsDisplay = true
    }

    override func mouseDown(with event: NSEvent) {
        onClick?()
    }

    override func keyDown(with event: NSEvent) {
        if event.keyCode == 36 || event.keyCode == 49 {
            onClick?()
        } else {
            super.keyDown(with: event)
        }
    }

    override func accessibilityPerformPress() -> Bool {
        onClick?()
        return true
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let bg = hovered
            ? NSColor(calibratedRed: 0.13, green: 0.16, blue: 0.21, alpha: 1.0)
            : NSColor(calibratedRed: 0.075, green: 0.09, blue: 0.12, alpha: 0.98)
        let line = hovered ? tone.withAlphaComponent(0.42) : NSColor(calibratedRed: 0.23, green: 0.27, blue: 0.34, alpha: 0.90)
        let text = NSColor(calibratedRed: 0.92, green: 0.95, blue: 0.98, alpha: 1.0)
        let muted = NSColor(calibratedRed: 0.55, green: 0.61, blue: 0.70, alpha: 1.0)
        let card = bounds.insetBy(dx: 8, dy: 4)

        bg.setFill()
        NSBezierPath(roundedRect: card, xRadius: 8, yRadius: 8).fill()
        line.setStroke()
        let path = NSBezierPath(roundedRect: card, xRadius: 8, yRadius: 8)
        path.lineWidth = 1
        path.stroke()

        let iconRect = NSRect(x: card.minX + 12, y: card.minY + 6, width: 28, height: 28)
        tone.withAlphaComponent(0.16).setFill()
        NSBezierPath(roundedRect: iconRect, xRadius: 7, yRadius: 7).fill()
        tone.withAlphaComponent(0.30).setStroke()
        let iconPath = NSBezierPath(roundedRect: iconRect, xRadius: 7, yRadius: 7)
        iconPath.lineWidth = 1
        iconPath.stroke()

        if #available(macOS 11.0, *),
           let symbolName = symbolName,
           let baseImage = NSImage(systemSymbolName: symbolName, accessibilityDescription: title) {
            let config = NSImage.SymbolConfiguration(pointSize: 15, weight: .semibold)
            let image = baseImage.withSymbolConfiguration(config) ?? baseImage
            let drawRect = iconRect.insetBy(dx: 6, dy: 6)
            image.draw(in: drawRect, from: .zero, operation: .sourceOver, fraction: 1.0)
            if let context = NSGraphicsContext.current {
                let previousOperation = context.compositingOperation
                context.compositingOperation = .sourceAtop
                tone.setFill()
                NSBezierPath(rect: drawRect).fill()
                context.compositingOperation = previousOperation
            }
        } else {
            let iconAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 16, weight: .semibold),
                .foregroundColor: tone,
            ]
            let iconSize = icon.size(withAttributes: iconAttrs)
            icon.draw(
                at: NSPoint(x: iconRect.midX - iconSize.width / 2, y: iconRect.midY - iconSize.height / 2 - 0.5),
                withAttributes: iconAttrs
            )
        }

        title.draw(at: NSPoint(x: card.minX + 54, y: card.minY + 11), withAttributes: [
            .font: NSFont.systemFont(ofSize: 15, weight: .semibold),
            .foregroundColor: text,
        ])
        let detailAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12, weight: .medium),
            .foregroundColor: muted,
        ]
        let size = detail.size(withAttributes: detailAttrs)
        detail.draw(at: NSPoint(x: card.maxX - size.width - 14, y: card.minY + 13), withAttributes: detailAttrs)
    }
}

func resolveTeamClaudeExecutable() -> String {
    let home = NSHomeDirectory()
    var candidates = [
        "\(home)/.local/share/fnm/aliases/default/bin/teamclaude",
        "\(home)/.local/bin/teamclaude",
        "/opt/homebrew/bin/teamclaude",
        "/usr/local/bin/teamclaude",
    ]
    let fnmVersions = "\(home)/.local/share/fnm/node-versions"
    if let versions = try? FileManager.default.contentsOfDirectory(atPath: fnmVersions) {
        let installed = versions.compactMap { version -> (String, Date)? in
            let path = "\(fnmVersions)/\(version)/installation/bin/teamclaude"
            guard FileManager.default.isExecutableFile(atPath: path) else { return nil }
            let modified = (try? FileManager.default.attributesOfItem(atPath: path)[.modificationDate] as? Date) ?? .distantPast
            return (path, modified)
        }.sorted { $0.1 > $1.1 }.map(\.0)
        candidates.append(contentsOf: installed)
    }
    for candidate in candidates where FileManager.default.isExecutableFile(atPath: candidate) {
        return candidate
    }
    return "teamclaude"
}

func teamClaudeConfigSignature() -> String {
    let path = "\(NSHomeDirectory())/.config/teamclaude.json"
    let modifiedAt = (try? FileManager.default.attributesOfItem(atPath: path)[.modificationDate] as? Date)?
        .timeIntervalSince1970 ?? 0
    guard let config = readTeamClaudeJSON(path) else {
        return "missing|\(modifiedAt)"
    }
    let accounts = tcArray(config["accounts"]) ?? []
    return "\(Int(modifiedAt))|\(accounts.count)|\(teamClaudeAccountTopologySignature())"
}

func teamClaudeAccountTopologySignature() -> Int {
    guard let config = readTeamClaudeJSON("\(NSHomeDirectory())/.config/teamclaude.json") else {
        return 0
    }
    let accounts = tcArray(config["accounts"]) ?? []
    let topology = accounts.compactMap { account -> String? in
        guard let name = tcString(account["name"]), !name.isEmpty else { return nil }
        let enabled = tcBool(account["enabled"]) ?? true
        let type = tcString(account["type"]) ?? tcString(account["source"]) ?? "unknown"
        return "\(name)|\(enabled)|\(type)"
    }.sorted().joined(separator: ";")
    return topology.hashValue
}

@discardableResult
func kickstartTeamClaudeServer() -> Bool {
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
    task.arguments = ["kickstart", "-k", "gui/\(getuid())/com.qjc.teamclaude"]
    do {
        try task.run()
        task.waitUntilExit()
        return task.terminationStatus == 0
    } catch {
        return false
    }
}

func refreshTeamClaudeOAuthAccounts() -> Int32? {
    let process = Process()
    let executable = resolveTeamClaudeExecutable()
    if executable == "teamclaude" {
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["teamclaude", "accounts"]
    } else {
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = ["accounts"]
    }

    var environment = ProcessInfo.processInfo.environment
    environment["HOME"] = NSHomeDirectory()
    let executableBin = URL(fileURLWithPath: executable).deletingLastPathComponent().path
    environment["PATH"] = "\(executableBin):/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    process.environment = environment
    let nullOut = FileHandle(forWritingAtPath: "/dev/null")
    process.standardOutput = nullOut
    process.standardError = nullOut

    do {
        try process.run()
    } catch {
        nullOut?.closeFile()
        return nil
    }

    let pid = process.processIdentifier
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 45) {
        if process.isRunning {
            terminateProcessTree(rootPid: pid, signal: SIGTERM)
        }
    }
    process.waitUntilExit()
    nullOut?.closeFile()
    return process.terminationStatus
}

func shellQuote(_ value: String) -> String {
    "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
}

func escapeForAppleScriptString(_ value: String) -> String {
    value
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")
}

// MARK: - 포맷 헬퍼

private let _labelWord: [String: String] = [
    "codex": "Codex", "max": "Max", "mini": "Mini", "pro": "Pro",
    "flash": "Flash", "high": "High", "preview": "Preview", "image": "Image", "free": "Free",
]
private func titleWord(_ w: String) -> String { _labelWord[w.lowercased()] ?? w }

// raw 모델명 → 표시명 (TS modelLabel과 동일 규칙). 8자리 날짜 접미사 제거 + 공백 버전.
// claude-haiku-4-5-20251001 → "Haiku 4.5", claude-opus-4-8 → "Opus 4.8",
// claude-fable-5 → "Fable 5", gpt-5.5 → "GPT-5.5", gpt-5-codex → "GPT-5 Codex",
// gemini-2.5-pro → "Gemini 2.5 Pro".
func shortenModelName(_ name: String) -> String {
    var base = name
    if let r = base.range(of: "-[0-9]{8}$", options: .regularExpression) {
        base.removeSubrange(r)
    }
    let lower = base.lowercased()
    let parts = base.split(separator: "-").map(String.init)
    let tiers = ["opus", "sonnet", "haiku", "fable"]
    if lower.hasPrefix("claude"), parts.count >= 3, tiers.contains(parts[1].lowercased()) {
        let tier = parts[1].prefix(1).uppercased() + parts[1].dropFirst().lowercased()
        let nums = parts.dropFirst(2).filter { $0.allSatisfy { $0.isNumber } }
        return nums.isEmpty ? tier : "\(tier) \(nums.joined(separator: "."))"
    }
    if lower.hasPrefix("gpt") {
        let ver = parts.count > 1 ? parts[1] : ""
        let rest = parts.dropFirst(2).map { titleWord($0) }
        return (["GPT-" + ver] + rest).joined(separator: " ").trimmingCharacters(in: .whitespaces)
    }
    if lower.contains("gemini") {
        let cleaned = base.replacingOccurrences(of: "antigravity-", with: "")
        let rparts = cleaned.split(separator: "-").map(String.init).filter { $0.lowercased() != "gemini" }
        return ("Gemini " + rparts.map { titleWord($0) }.joined(separator: " ")).trimmingCharacters(in: .whitespaces)
    }
    return base
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

private let _costFormatter: NumberFormatter = {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.minimumFractionDigits = 2
    f.maximumFractionDigits = 2
    return f
}()

// 천단위 구분 포함 비용 표기 — $17,447.49 (가독성). 큰 금액도 한눈에.
func formatCost(_ cost: Double) -> String {
    "$" + (_costFormatter.string(from: NSNumber(value: cost)) ?? String(format: "%.2f", cost))
}

// 축약 비용 — $24.5K / $1.7K / $950 / $0.37 (제공자 칩 등 좁은 공간용)
func formatCostShort(_ cost: Double) -> String {
    if cost >= 1000 { return String(format: "$%.1fK", cost / 1000) }
    if cost >= 100 { return String(format: "$%.0f", cost) }
    return String(format: "$%.2f", cost)
}

func formatDurationShort(_ seconds: Int?) -> String {
    guard let seconds = seconds else { return "-" }
    if seconds >= 3600 { return "\(seconds / 3600)h \((seconds % 3600) / 60)m" }
    if seconds >= 60 { return "\(seconds / 60)m \(seconds % 60)s" }
    return "\(seconds)s"
}

func formatTeamClaudeDuration(_ seconds: Int?) -> String {
    guard let seconds = seconds else { return "-" }
    let days = seconds / 86_400
    let hours = (seconds % 86_400) / 3_600
    let minutes = (seconds % 3_600) / 60
    if days > 0 { return "\(days)d\(hours)h" }
    if hours > 0 { return "\(hours)h\(minutes)m" }
    if minutes > 0 { return "\(minutes)m" }
    return "\(seconds)s"
}

private let _teamClaudeProbeFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    f.locale = Locale(identifier: "en_US_POSIX")
    return f
}()

func formatTeamClaudeProbe(_ date: Date?) -> String {
    guard let date = date else { return "-" }
    return "@" + _teamClaudeProbeFormatter.string(from: date)
}

// 모델명 → 제공자 (codex 추적 핵심). TS providerOf와 동일 규칙.
func providerOf(_ model: String) -> String {
    let m = model.lowercased()
    if m.hasPrefix("claude") { return "Claude" }
    if m.hasPrefix("gpt") || m.contains("codex") || m.hasPrefix("o1") || m.hasPrefix("o3") { return "Codex" }
    if m.contains("gemini") { return "Gemini" }
    if m.contains("minimax") { return "MiniMax" }
    if m.hasPrefix("glm") { return "GLM" }
    return "Other"
}

// 제공자별 색 (TS PROVIDER_COLOR와 동일 톤)
func providerColor(_ provider: String) -> NSColor {
    switch provider {
    case "Claude":  return NSColor(calibratedRed: 0.82, green: 0.60, blue: 0.04, alpha: 1.0) // 앰버
    case "Codex":   return NSColor(calibratedRed: 0.00, green: 0.64, blue: 0.59, alpha: 1.0) // 청록(OpenAI)
    case "Gemini":  return NSColor(calibratedRed: 0.47, green: 0.38, blue: 0.86, alpha: 1.0) // 보라
    case "MiniMax": return NSColor(calibratedRed: 0.86, green: 0.17, blue: 0.44, alpha: 1.0)
    case "GLM":     return NSColor(calibratedRed: 0.83, green: 0.24, blue: 0.09, alpha: 1.0)
    default:        return NSColor.secondaryLabelColor
    }
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
    var statusTimer: Timer?     // TeamClaude/Codex 상태 갱신 (10초)
    var rollTimer: Timer?       // 정보 롤링 + 펄스 (1초)
    var activityTimer: Timer?   // 활동 감지 (5초)
    var currentData: UsageData?
    var currentTeamClaude: TeamClaudeHealth?
    var currentCodex: CodexHealth?
    var currentTeamCodex: TeamCodexPoolHealth?

    // 롤링 상태
    var rollIndex = 0       // 현재 표시 중인 정보 슬롯
    var pulseFrame = 0      // 펄스 애니메이션 프레임 (0~3)
    var tickCount = 0       // 1초 tick 누적 (5의 배수마다 슬롯 전환)
    var isActive = false    // 최근 활동 감지 결과
    var parallelCount = 0   // 현재 병렬 실행 중인 Claude Code 인스턴스 수
    var isFetching = false  // ccusage 전체 호출 진행 중 플래그 (동시 호출 방지 — 좀비 누적 차단)
    var isFetchingUsageQuick = false  // 전체 호출 중 수동 새로고침용 daily quick 경로
    var lastFullUsageCompletedAt: Date?
    var lastUsageQuickCompletedAt: Date?
    var teamClaudeRefreshCoordinator = TeamClaudeRefreshCoordinator()
    var isRefreshingTeamClaude: Bool { teamClaudeRefreshCoordinator.isRunning }
    var isRefreshingCodex = false
    var isRefreshingTeamCodex = false
    var isRefreshingStatus: Bool { isRefreshingTeamClaude || isRefreshingCodex || isRefreshingTeamCodex }
    var isMeasuringTeamClaude = false
    var teamClaudeMeasureDetail: String?
    var teamClaudeConfigWatchGeneration = 0
    var lastTeamClaudeAutoSyncAt: Date?
    var pendingTeamClaudeForcedSyncReason: String?
    var teamClaudeOutageStartedAt: TimeInterval?
    var attemptedTeamClaudeOutageStartedAt: TimeInterval?
    var attemptedTeamClaudeDriftTopologySignature: Int?
    weak var openDashboardView: StatusMenuDashboardView?
    var cachedDashboardView: StatusMenuDashboardView?
    weak var cachedDashboardItem: NSMenuItem?
    weak var refreshMenuView: MenuActionRowView?
    weak var measureMenuView: MenuActionRowView?
    var hasScheduledMenuPrewarm = false
    var isPreparingMenuCache = false
    var cachedSparklineCosts: [Double] = []
    var cachedSparklineImage: NSImage?

    // 펄스 프레임: 활성일 때 회전, idle일 때 정지
    let pulseFramesActive = ["●", "◐", "○", "◐"]
    let pulseFrameIdle = "○"

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        trimLogIfNeeded("\(NSHomeDirectory())/.claude/cache/cc-menubar.log")

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem?.button?.toolTip = "Claude Code 사용량 — 좌측 스파크라인은 최근 7일 일별 비용 (오늘=초록). 클릭하면 상세."
        setLoading()

        let menu = NSMenu()
        menu.delegate = self
        statusItem?.menu = menu

        refresh()
        updateActivity() // 즉시 첫 감지
        scheduleMenuPrewarm()

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

        // 계정 쿼터와 현재 계정은 사용 중 빠르게 바뀌므로 비용 집계와 분리해 갱신한다.
        statusTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            self?.loadFastStatusInBackground()
        }
        if let t = statusTimer { RunLoop.main.add(t, forMode: .common) }

        // 60초마다 ccusage 갱신
        dataTimer = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            self?.loadUsageInBackground()
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
        if isMeasuringTeamClaude {
            return ["Claude 측정 중"]
        }
        let teamClaudeSlot = currentTeamClaude?.titleSlot
        let codexSlot = currentCodex?.titleSlot
        // 데이터 없으면 최소 정보 — 병렬 세션 수만이라도 의미 있음
        guard let usage = currentData, let today = usage.today else {
            return [teamClaudeSlot, codexSlot, "병렬 \(parallelCount)"].compactMap { $0 }
        }
        let todayTokens = today.inputTokens + today.cacheCreationTokens
                        + today.cacheReadTokens + today.outputTokens
        let rate = usage.usdKrwRate

        // 이번 달 제공자별 비용 (codex 추적) — 상위 제공자 슬롯
        var provAcc: [String: Double] = [:]
        for m in usage.modelBreakdown { provAcc[m.provider, default: 0] += m.cost }
        let codexCost = provAcc["Codex"] ?? 0

        var slots = [
            teamClaudeSlot,
            codexSlot,
            "오늘 \(formatCost(today.totalCost))",
            "오늘 \(formatKRWShort(today.totalCost, rate: rate))",
            "토큰 \(formatTokens(todayTokens))",
            "주간 \(formatCost(usage.weeklyTotalCost))",
            "이번주 \(formatCost(usage.thisWeekCost))",
            "이번달 \(formatCost(usage.thisMonthCost))",
            "이번달 \(formatKRWShort(usage.thisMonthCost, rate: rate))",
            "누적 \(formatKRWShort(usage.allTimeCost, rate: rate))",
            "총 \(formatTokens(usage.allTimeTokens))",
            "병렬 \(parallelCount)",
        ].compactMap { $0 }
        // codex 사용이 있으면 별도 슬롯으로 노출
        if codexCost > 0 { slots.append("코덱스 \(formatCost(codexCost))") }
        slots.append(usage.modelBreakdown.first?.label ?? today.models.first ?? "Claude") // 최다 비용 모델
        return slots
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
            let sparkline: NSImage?
            if let costs = self.currentData?.last7Costs {
                if costs != self.cachedSparklineCosts {
                    self.cachedSparklineCosts = costs
                    self.cachedSparklineImage = makeSparklineImage(costs)
                }
                sparkline = self.cachedSparklineImage
            } else {
                sparkline = nil
            }
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
            if let health = self.currentTeamClaude {
                let fable = health.fableKnown > 0 ? "Fable \(health.fableOver)/\(health.fableKnown)" : "Fable -"
                let measurement = " · 측정 필요 \(health.measurementPendingCount) · 상태 확인 \(health.measurementUnavailableCount) · 한도 리셋 \(health.quotaLimitedCount)"
                let integration = health.accountConfigDrift == 0 ? " · 계정 연동 정상" : " · 계정 연동 불일치 \(health.accountConfigDrift)"
                let codex = self.currentCodex.map { " · codex \($0.statusLabel) · calls \($0.todayCalls)/\($0.weekCalls)" } ?? ""
                button.toolTip = "Claude Code 사용량 · teamclaude \(health.statusLabel) · \(fable) · active \(health.accountActive)/\(max(health.accountTotal, health.accountConfigured))\(integration)\(measurement)\(codex)"
            } else if let codex = self.currentCodex {
                button.toolTip = "Claude Code 사용량 · codex \(codex.statusLabel) · calls \(codex.todayCalls)/\(codex.weekCalls)"
            }

        }
    }

    // MARK: - 데이터 로딩

    func refresh() {
        setLoading()
        rollIndex = 0
        updateActivity()
        loadFastStatusInBackground()
        loadUsageInBackground()
    }

    func refreshStatusOnly() {
        rollIndex = 0
        updateActivity()
        loadFastStatusInBackground()
    }

    func refreshInteractive() {
        rollIndex = 0
        updateActivity()
        loadFastStatusInBackground()
        if isFetching {
            loadUsageQuickInBackground(reason: "manual")
        } else {
            loadUsageInBackground()
        }
    }

    func refreshOpenDashboard() {
        guard let dashboard = cachedDashboardView ?? openDashboardView else { return }
        dashboard.updateContent(
            teamClaude: currentTeamClaude,
            codex: currentCodex,
            teamCodex: currentTeamCodex,
            usage: currentData,
            parallelCount: parallelCount,
            active: isActive,
            isMeasuringTeamClaude: isMeasuringTeamClaude,
            teamClaudeMeasureDetail: teamClaudeMeasureDetail,
            onMeasureTeamClaude: { [weak self] in self?.measureTeamClaudeAction() }
        )
        dashboard.needsDisplay = true
        if openDashboardView != nil {
            print("DASHBOARD-REFRESH: 열린 메뉴 최신 상태 반영")
            fflush(stdout)
        }
    }

    func loadInBackground() {
        loadFastStatusInBackground()
        loadUsageInBackground()
    }

    func loadFastStatusInBackground() {
        loadTeamClaudeStatusInBackground()
        loadTeamCodexStatusInBackground()
        loadCodexStatusInBackground()
    }

    func commitTeamClaudeHealth(_ candidate: TeamClaudeHealth, outageDuration: TimeInterval = 0) {
        guard teamClaudeCandidateIsCurrent(
            candidateCheckedAt: candidate.checkedAt,
            currentCheckedAt: currentTeamClaude?.checkedAt
        ) else {
            print("TEAMCLAUDE-STALE: 더 오래된 응답 폐기")
            fflush(stdout)
            return
        }

        let hasMeasuredQuota = currentTeamClaude?.accounts.contains {
            $0.weeklyPercent != nil || $0.fablePercent != nil
        } == true

        if teamClaudeShouldRetainQuota(
            candidateReachable: candidate.serverReachable,
            hasMeasuredQuota: hasMeasuredQuota
        ), let previous = currentTeamClaude {
            currentTeamClaude = teamClaudeRetainingQuota(candidate: candidate, previous: previous)
            print("TEAMCLAUDE-STALE: 서버 연결 실패 \(Int(outageDuration))초, 마지막 정상 주간/Fable 유지")
            fflush(stdout)
            return
        }

        currentTeamClaude = teamClaudeHealthMergingQuota(
            candidate: candidate,
            previous: currentTeamClaude
        )
    }

    func loadTeamClaudeStatusInBackground() {
        guard teamClaudeRefreshCoordinator.request() else { return }
        let forcedSyncReason = pendingTeamClaudeForcedSyncReason
        pendingTeamClaudeForcedSyncReason = nil
        let previousOutageStartedAt = teamClaudeOutageStartedAt
        let previousAttemptedOutageStartedAt = attemptedTeamClaudeOutageStartedAt
        let previousAttemptedDriftTopologySignature = attemptedTeamClaudeDriftTopologySignature
        let autoSyncAllowed = lastTeamClaudeAutoSyncAt.map { Date().timeIntervalSince($0) > 60 } ?? true
        DispatchQueue.global(qos: .utility).async { [weak self] in
            var teamClaude = loadTeamClaudeHealth()
            let topologySignature = teamClaudeAccountTopologySignature()
            let observedAt = ProcessInfo.processInfo.systemUptime
            var outageStartedAt = nextTeamClaudeOutageStartedAt(
                previous: previousOutageStartedAt,
                candidateReachable: teamClaude.serverReachable,
                observedAt: observedAt
            )
            let outageDuration = outageStartedAt.map { max(0, observedAt - $0) } ?? 0
            var syncReason = forcedSyncReason
            if syncReason == nil,
               let recovery = teamClaudeRecoveryReason(
                   serverReachable: teamClaude.serverReachable,
                   configPresent: teamClaude.configPresent,
                   accountConfigDrift: teamClaude.accountConfigDrift
               ) {
                switch recovery {
                case .serverOffline:
                    if teamClaudeShouldAutoRecover(
                        candidateReachable: false,
                        accountConfigDrift: 0,
                        outageDurationSeconds: outageDuration
                    ), teamClaudeShouldAttemptRecoveryForOutage(
                        outageStartedAt: outageStartedAt,
                        attemptedOutageStartedAt: previousAttemptedOutageStartedAt
                    ) {
                        syncReason = "서버 연결 \(Int(outageDuration))초 실패"
                    }
                case .accountDrift(let count):
                    if teamClaudeShouldAttemptRecoveryForDrift(
                        topologySignature: topologySignature,
                        attemptedTopologySignature: previousAttemptedDriftTopologySignature
                    ) {
                        syncReason = "계정 연동 불일치 \(count)개"
                    }
                }
            }

            var syncAttempted = false
            var syncSucceeded = false
            if let syncReason, forcedSyncReason != nil || autoSyncAllowed {
                syncAttempted = true
                print("TEAMCLAUDE-AUTOSYNC: \(syncReason), 서버 재시작")
                fflush(stdout)
                let kicked = kickstartTeamClaudeServer()
                if kicked {
                    for _ in 0..<45 {
                        Thread.sleep(forTimeInterval: 1)
                        teamClaude = loadTeamClaudeHealth()
                        if teamClaude.serverReachable && teamClaude.accountConfigDrift == 0 {
                            outageStartedAt = nil
                            syncSucceeded = true
                            break
                        }
                    }
                }
                if !syncSucceeded {
                    print("TEAMCLAUDE-AUTOSYNC-FAILED: \(syncReason) kicked=\(kicked)")
                    fflush(stdout)
                }
            }

            DispatchQueue.main.async {
                guard let self = self else { return }
                if syncAttempted {
                    self.lastTeamClaudeAutoSyncAt = Date()
                    if let outageStartedAt {
                        self.attemptedTeamClaudeOutageStartedAt = outageStartedAt
                    }
                    if teamClaude.serverReachable && teamClaude.accountConfigDrift > 0 {
                        self.attemptedTeamClaudeDriftTopologySignature = topologySignature
                    }
                }
                if teamClaude.serverReachable {
                    self.attemptedTeamClaudeOutageStartedAt = nil
                }
                if teamClaude.accountConfigDrift == 0 {
                    self.attemptedTeamClaudeDriftTopologySignature = nil
                }
                self.teamClaudeOutageStartedAt = teamClaude.serverReachable ? nil : outageStartedAt
                self.commitTeamClaudeHealth(teamClaude, outageDuration: outageDuration)
                let shouldRefreshAgain = self.teamClaudeRefreshCoordinator.finish()
                self.refreshOpenDashboard()
                self.updateTitle()
                let displayed = self.currentTeamClaude ?? teamClaude
                print("TEAMCLAUDE-REFRESH: status=\(displayed.statusLabel) usable=\(displayed.accountUsable)/\(max(displayed.accountTotal, displayed.accountConfigured)) drift=\(displayed.accountConfigDrift) pending=\(displayed.measurementPendingCount) unavailable=\(displayed.measurementUnavailableCount) quotaLimited=\(displayed.quotaLimitedCount)")
                fflush(stdout)
                if shouldRefreshAgain {
                    self.loadTeamClaudeStatusInBackground()
                }
            }
        }
    }

    func loadCodexStatusInBackground() {
        guard !isRefreshingCodex else { return }
        isRefreshingCodex = true
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let startedAt = ProcessInfo.processInfo.systemUptime
            let codex = autoreleasepool { loadCodexHealth() }
            let elapsedMs = Int((ProcessInfo.processInfo.systemUptime - startedAt) * 1_000)
            malloc_zone_pressure_relief(nil, 0)
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.currentCodex = codex
                self.isRefreshingCodex = false
                self.refreshOpenDashboard()
                self.updateTitle()
                print("CODEX-REFRESH: status=\(codex.statusLabel) calls=\(codex.todayCalls)/\(codex.weekCalls) duration=\(elapsedMs)ms")
                fflush(stdout)
            }
        }
    }

    func loadTeamCodexStatusInBackground() {
        guard !isRefreshingTeamCodex else { return }
        isRefreshingTeamCodex = true
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let teamCodex = autoreleasepool { loadTeamCodexPoolHealth() }
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.currentTeamCodex = teamCodex
                self.isRefreshingTeamCodex = false
                self.refreshOpenDashboard()
                self.updateTitle()
                print("TEAMCODEX-REFRESH: status=\(teamCodex.statusLabel) accounts=\(teamCodex.accounts.count) current=\(teamCodex.currentAccount ?? "-")")
                fflush(stdout)
            }
        }
    }

    func loadUsageInBackground() {
        // ccusage는 느릴 수 있으므로 단일 실행만 허용한다.
        // 상태 갱신(TeamClaude/Codex)은 위 loadFastStatusInBackground 에서 별도로 즉시 처리한다.
        guard !isFetching else {
            print("CCUSAGE-SKIP: 이전 사용량 갱신 진행 중, 상태 갱신만 반영")
            fflush(stdout)
            DispatchQueue.main.async { [weak self] in
                self?.updateTitle()
            }
            return
        }
        isFetching = true
        let startedAt = Date()
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let dailyData = runCcusageRaw("daily") else {
                DispatchQueue.main.async {
                    self?.isFetching = false
                    self?.updateTitle()
                }
                return
            }

            let rate = fetchUsdKrwRate()
            if let quickData = parseUsageData(daily: dailyData, weekly: nil, monthly: nil, rate: rate) {
                print("CCUSAGE-QUICK: daily 반영 today=\(quickData.today?.period ?? "nil") cost=\(quickData.today?.totalCost ?? -1)")
                fflush(stdout)
                DispatchQueue.main.async {
                    self?.currentData = quickData
                    self?.refreshOpenDashboard()
                    self?.updateTitle()
                }
            }

            let weeklyData = runCcusageRaw("weekly")
            let monthlyData = runCcusageRaw("monthly")
            let data = parseUsageData(daily: dailyData, weekly: weeklyData, monthly: monthlyData, rate: rate)
            print("CCUSAGE-FULL: today=\(data?.today?.period ?? "nil") cost=\(data?.today?.totalCost ?? -1) thisMonth=\(data?.thisMonthCost ?? -1) rate=\(rate)")
            fflush(stdout)

            DispatchQueue.main.async {
                guard let self = self else { return }
                self.isFetching = false
                self.lastFullUsageCompletedAt = Date()
                if let data = data {
                    var finalData = data
                    if let quickAt = self.lastUsageQuickCompletedAt,
                       quickAt > startedAt,
                       let currentToday = self.currentData?.today,
                       let parsedToday = data.today,
                       currentToday.period == parsedToday.period,
                       currentToday.totalCost > parsedToday.totalCost {
                        finalData = replacingToday(in: data, with: currentToday)
                        print("CCUSAGE-FULL-MERGE: quick today 유지 cost=\(currentToday.totalCost)")
                        fflush(stdout)
                    }
                    self.currentData = finalData // 실패 시 기존 데이터 유지 (깜빡임 방지)
                }
                self.refreshOpenDashboard()
                self.updateTitle()
            }
        }
    }

    func loadUsageQuickInBackground(reason: String) {
        guard !isFetchingUsageQuick else {
            print("CCUSAGE-QUICK-SKIP[\(reason)]: 이전 quick 사용량 갱신 진행 중")
            fflush(stdout)
            return
        }

        isFetchingUsageQuick = true
        let startedAt = Date()
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let dailyData = runCcusageRaw("daily") else {
                DispatchQueue.main.async {
                    self?.isFetchingUsageQuick = false
                    self?.updateTitle()
                }
                return
            }

            let rate = fetchUsdKrwRate()
            let quickData = parseUsageData(daily: dailyData, weekly: nil, monthly: nil, rate: rate)
            print("CCUSAGE-QUICK[\(reason)]: today=\(quickData?.today?.period ?? "nil") cost=\(quickData?.today?.totalCost ?? -1)")
            fflush(stdout)

            DispatchQueue.main.async {
                guard let self = self else { return }
                self.isFetchingUsageQuick = false
                if let lastFull = self.lastFullUsageCompletedAt, lastFull > startedAt {
                    print("CCUSAGE-QUICK-DROP[\(reason)]: 더 최신 full 결과 유지")
                    fflush(stdout)
                    self.updateTitle()
                    return
                }
                if let quickData = quickData {
                    self.currentData = quickData
                    self.lastUsageQuickCompletedAt = Date()
                }
                self.refreshOpenDashboard()
                self.updateTitle()
            }
        }
    }

    // MARK: - NSMenuDelegate

    func scheduleMenuPrewarm() {
        guard !hasScheduledMenuPrewarm else { return }
        hasScheduledMenuPrewarm = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self,
                  let menu = self.statusItem?.menu,
                  menu.items.isEmpty else {
                return
            }
            self.isPreparingMenuCache = true
            self.menuWillOpen(menu)
            self.menuDidClose(menu)
            self.isPreparingMenuCache = false
        }
    }

    func refreshMenuDetailText() -> String {
        if isFetchingUsageQuick { return "오늘 사용량 갱신 중" }
        if isFetching { return "전체 사용량 갱신 중" }
        if isRefreshingStatus { return "상태 갱신 중" }
        return "즉시 갱신"
    }

    func measureMenuDetailText() -> String {
        if isMeasuringTeamClaude { return teamClaudeMeasureDetail ?? "진행 중" }
        if let teamClaudeMeasureDetail { return teamClaudeMeasureDetail }

        let unmeasuredCount = currentTeamClaude?.measurementPendingCount ?? 0
        if unmeasuredCount > 0 { return "\(unmeasuredCount)개 지금 측정 가능" }

        let unavailableCount = currentTeamClaude?.measurementUnavailableCount ?? 0
        if unavailableCount > 0 { return "\(unavailableCount)개 상태 확인 필요" }

        let quotaLimitedCount = currentTeamClaude?.quotaLimitedCount ?? 0
        return quotaLimitedCount > 0
            ? "측정 완료 · \(quotaLimitedCount)개 라우팅 한도 대기"
            : "모든 계정 측정 완료"
    }

    func updateCachedMenuPresentation() {
        guard let dashboard = cachedDashboardView,
              let dashboardItem = cachedDashboardItem else {
            return
        }

        dashboard.updateContent(
            teamClaude: currentTeamClaude,
            codex: currentCodex,
            teamCodex: currentTeamCodex,
            usage: currentData,
            parallelCount: parallelCount,
            active: isActive,
            isMeasuringTeamClaude: isMeasuringTeamClaude,
            teamClaudeMeasureDetail: teamClaudeMeasureDetail,
            onMeasureTeamClaude: { [weak self] in self?.measureTeamClaudeAction() }
        )

        let contentHeight = StatusMenuDashboardView.preferredHeight(
            teamClaude: currentTeamClaude,
            codex: currentCodex,
            teamCodex: currentTeamCodex,
            usage: currentData
        )
        dashboard.frame.size.height = contentHeight
        let screenHeight = statusItem?.button?.window?.screen?.visibleFrame.height
            ?? NSScreen.main?.visibleFrame.height
            ?? 900
        let actionAreaHeight = CGFloat(8) * MenuActionRowView.preferredHeight + 72
        let dashboardHeight = min(
            contentHeight,
            min(StatusMenuDashboardView.maxMenuDashboardHeight, max(320, screenHeight - actionAreaHeight))
        )

        if contentHeight > dashboardHeight {
            let scrollView = (dashboardItem.view as? NSScrollView)
                ?? NSScrollView(frame: .zero)
            scrollView.frame = NSRect(
                x: 0,
                y: 0,
                width: StatusMenuDashboardView.preferredWidth,
                height: dashboardHeight
            )
            scrollView.documentView = dashboard
            scrollView.hasVerticalScroller = true
            scrollView.autohidesScrollers = true
            scrollView.scrollerStyle = .overlay
            scrollView.drawsBackground = false
            scrollView.borderType = .noBorder
            scrollView.verticalScrollElasticity = .none
            scrollView.contentView.scroll(to: .zero)
            dashboardItem.view = scrollView
        } else {
            if let scrollView = dashboardItem.view as? NSScrollView {
                scrollView.documentView = nil
            }
            dashboard.frame.origin = .zero
            dashboardItem.view = dashboard
        }

        refreshMenuView?.detail = refreshMenuDetailText()
        measureMenuView?.detail = measureMenuDetailText()
    }

    func menuWillOpen(_ menu: NSMenu) {
        let openedAt = ProcessInfo.processInfo.systemUptime
        let eventName = isPreparingMenuCache ? "MENU-PREWARM" : "MENU-OPEN"
        defer {
            let elapsedMs = Int((ProcessInfo.processInfo.systemUptime - openedAt) * 1_000)
            print("\(eventName): \(elapsedMs)ms")
            fflush(stdout)
        }

        if let cachedDashboardView,
           cachedDashboardItem != nil,
           !menu.items.isEmpty {
            openDashboardView = cachedDashboardView
            updateCachedMenuPresentation()
            loadFastStatusInBackground()
            return
        }

        // 메뉴 열릴 때마다 최신 데이터로 항목 재구성
        menu.removeAllItems()

        let dashboardContentHeight = StatusMenuDashboardView.preferredHeight(teamClaude: currentTeamClaude, codex: currentCodex, teamCodex: currentTeamCodex, usage: currentData)
        let screenHeight = statusItem?.button?.window?.screen?.visibleFrame.height
            ?? NSScreen.main?.visibleFrame.height
            ?? 900
        let actionAreaHeight = CGFloat(8) * MenuActionRowView.preferredHeight + 72
        let screenLimitedHeight = max(320, screenHeight - actionAreaHeight)
        let dashboardHeight = min(dashboardContentHeight, min(StatusMenuDashboardView.maxMenuDashboardHeight, screenLimitedHeight))
        let dashboard = StatusMenuDashboardView(frame: NSRect(x: 0, y: 0, width: StatusMenuDashboardView.preferredWidth, height: dashboardContentHeight))
        dashboard.configure(
            teamClaude: currentTeamClaude,
            codex: currentCodex,
            teamCodex: currentTeamCodex,
            usage: currentData,
            parallelCount: parallelCount,
            active: isActive,
            isMeasuringTeamClaude: isMeasuringTeamClaude,
            teamClaudeMeasureDetail: teamClaudeMeasureDetail,
            onMeasureTeamClaude: { [weak self] in self?.measureTeamClaudeAction() }
        )
        openDashboardView = dashboard
        cachedDashboardView = dashboard
        let dashboardItem = NSMenuItem()
        if dashboardContentHeight > dashboardHeight {
            let scrollView = NSScrollView(frame: NSRect(x: 0, y: 0, width: StatusMenuDashboardView.preferredWidth, height: dashboardHeight))
            scrollView.documentView = dashboard
            scrollView.hasVerticalScroller = true
            scrollView.autohidesScrollers = true
            scrollView.scrollerStyle = .overlay
            scrollView.drawsBackground = false
            scrollView.borderType = .noBorder
            scrollView.verticalScrollElasticity = .none
            scrollView.contentView.scroll(to: .zero)
            dashboardItem.view = scrollView
        } else {
            dashboardItem.view = dashboard
        }
        menu.addItem(dashboardItem)
        cachedDashboardItem = dashboardItem

        let actionWidth = StatusMenuDashboardView.preferredWidth
        let green = NSColor(calibratedRed: 0.18, green: 0.82, blue: 0.48, alpha: 1.0)
        let blue = NSColor(calibratedRed: 0.28, green: 0.55, blue: 0.90, alpha: 1.0)
        let yellow = NSColor(calibratedRed: 0.93, green: 0.76, blue: 0.22, alpha: 1.0)
        let red = NSColor(calibratedRed: 0.96, green: 0.26, blue: 0.32, alpha: 1.0)

        let refreshItem = NSMenuItem(title: "새로고침", action: #selector(refreshAction), keyEquivalent: "r")
        refreshItem.target = self
        let refreshDetail = refreshMenuDetailText()
        let refreshView = MenuActionRowView(frame: NSRect(x: 0, y: 0, width: actionWidth, height: MenuActionRowView.preferredHeight), icon: "↻", symbolName: "arrow.clockwise", title: "새로고침", detail: refreshDetail, tone: green)
        refreshView.onClick = { [weak self, weak menu] in
            self?.refreshAction()
            menu?.cancelTracking()
        }
        refreshItem.view = refreshView
        menu.addItem(refreshItem)
        refreshMenuView = refreshView

        let measureDetail = measureMenuDetailText()
        let measureItem = NSMenuItem(title: "TeamClaude 계정 측정", action: #selector(measureTeamClaudeAction), keyEquivalent: "")
        measureItem.target = self
        let measureView = MenuActionRowView(frame: NSRect(x: 0, y: 0, width: actionWidth, height: MenuActionRowView.preferredHeight), icon: "◎", symbolName: "gauge", title: "TeamClaude 계정 측정", detail: measureDetail, tone: yellow)
        measureView.onClick = { [weak self, weak menu] in
            self?.measureTeamClaudeAction()
            menu?.cancelTracking()
        }
        measureItem.view = measureView
        menu.addItem(measureItem)
        measureMenuView = measureView

        let importItem = NSMenuItem(title: "Claude Code 계정 가져오기", action: #selector(importClaudeCodeAccountAction), keyEquivalent: "")
        importItem.target = self
        let importView = MenuActionRowView(frame: NSRect(x: 0, y: 0, width: actionWidth, height: MenuActionRowView.preferredHeight), icon: "↓", symbolName: "square.and.arrow.down", title: "Claude Code 계정 가져오기", detail: "현재 로그인", tone: green)
        importView.onClick = { [weak self, weak menu] in
            self?.importClaudeCodeAccountAction()
            menu?.cancelTracking()
        }
        importItem.view = importView
        menu.addItem(importItem)

        let loginItem = NSMenuItem(title: "Claude OAuth 계정 추가", action: #selector(addClaudeOAuthAccountAction), keyEquivalent: "")
        loginItem.target = self
        let loginView = MenuActionRowView(frame: NSRect(x: 0, y: 0, width: actionWidth, height: MenuActionRowView.preferredHeight), icon: "+", symbolName: "person.crop.circle.badge.plus", title: "Claude OAuth 계정 추가", detail: "브라우저", tone: blue)
        loginView.onClick = { [weak self, weak menu] in
            self?.addClaudeOAuthAccountAction()
            menu?.cancelTracking()
        }
        loginItem.view = loginView
        menu.addItem(loginItem)

        let codexLoginItem = NSMenuItem(title: "Codex OAuth 계정 추가", action: #selector(addCodexOAuthAccountAction), keyEquivalent: "")
        codexLoginItem.target = self
        let codexLoginView = MenuActionRowView(frame: NSRect(x: 0, y: 0, width: actionWidth, height: MenuActionRowView.preferredHeight), icon: "+", symbolName: "person.crop.circle.badge.plus", title: "Codex OAuth 계정 추가", detail: "브라우저", tone: blue)
        codexLoginView.onClick = { [weak self, weak menu] in
            self?.addCodexOAuthAccountAction()
            menu?.cancelTracking()
        }
        codexLoginItem.view = codexLoginView
        menu.addItem(codexLoginItem)

        let restartTeamClaudeItem = NSMenuItem(title: "TeamClaude 서버 재시작", action: #selector(restartTeamClaudeAction), keyEquivalent: "")
        restartTeamClaudeItem.target = self
        let restartTeamClaudeView = MenuActionRowView(frame: NSRect(x: 0, y: 0, width: actionWidth, height: MenuActionRowView.preferredHeight), icon: "⟳", symbolName: "arrow.triangle.2.circlepath", title: "TeamClaude 서버 재시작", detail: "계정 반영", tone: blue)
        restartTeamClaudeView.onClick = { [weak self, weak menu] in
            self?.restartTeamClaudeAction()
            menu?.cancelTracking()
        }
        restartTeamClaudeItem.view = restartTeamClaudeView
        menu.addItem(restartTeamClaudeItem)

        let openItem = NSMenuItem(title: "cc-visualizer 열기", action: #selector(openCCVisualizer), keyEquivalent: "")
        openItem.target = self
        let openView = MenuActionRowView(frame: NSRect(x: 0, y: 0, width: actionWidth, height: MenuActionRowView.preferredHeight), icon: "▣", symbolName: "chart.bar.xaxis", title: "cc-visualizer 열기", detail: "앱 열기", tone: blue)
        openView.onClick = { [weak self, weak menu] in
            self?.openCCVisualizer()
            menu?.cancelTracking()
        }
        openItem.view = openView
        menu.addItem(openItem)

        let quitItem = NSMenuItem(title: "종료", action: #selector(quitAction), keyEquivalent: "q")
        quitItem.target = self
        let quitView = MenuActionRowView(frame: NSRect(x: 0, y: 0, width: actionWidth, height: MenuActionRowView.preferredHeight), icon: "×", symbolName: "power", title: "종료", detail: "⌘Q", tone: red)
        quitView.onClick = { [weak self] in
            self?.quitAction()
        }
        quitItem.view = quitView
        menu.addItem(quitItem)

        // 메뉴가 열린 직후 서버 원본을 다시 읽고 위 dashboard를 실시간 갱신한다.
        loadFastStatusInBackground()
    }

    func menuDidClose(_ menu: NSMenu) {
        openDashboardView = nil
    }

    // MARK: - 액션

    @objc func refreshAction() {
        refreshInteractive()
    }

    func preferredTeamClaudeProbeModel() -> String {
        if let model = currentData?.modelBreakdown.first(where: { $0.provider == "Claude" && $0.model.lowercased().contains("fable") })?.model {
            return stripClaudeModelSuffix(model)
        }
        if let model = currentData?.modelBreakdown.first(where: { $0.provider == "Claude" })?.model,
           model.lowercased().hasPrefix("claude") {
            return stripClaudeModelSuffix(model)
        }
        if let model = currentData?.today?.models.first(where: { $0.lowercased().hasPrefix("claude") }) {
            return stripClaudeModelSuffix(model)
        }
        return "claude-fable-5"
    }

    @objc func measureTeamClaudeAction() {
        guard !isMeasuringTeamClaude else { return }
        let port = currentTeamClaude?.serverPort ?? 3456
        let model = preferredTeamClaudeProbeModel()
        let config = readTeamClaudeJSON("\(NSHomeDirectory())/.config/teamclaude.json")
        let proxyApiKey = tcString(tcDict(config?["proxy"])?["apiKey"])
        isMeasuringTeamClaude = true
        teamClaudeMeasureDetail = "OAuth 갱신 중"
        refreshOpenDashboard()
        updateTitle()

        DispatchQueue.global(qos: .utility).async { [weak self] in
            let refreshExit = refreshTeamClaudeOAuthAccounts()
            guard refreshExit == 0 else {
                DispatchQueue.main.async {
                    self?.isMeasuringTeamClaude = false
                    self?.teamClaudeMeasureDetail = "OAuth 갱신 실패"
                    self?.refreshOpenDashboard()
                    self?.updateTitle()
                }
                return
            }

            DispatchQueue.main.async {
                self?.teamClaudeMeasureDetail = "서버 동기화 중"
                self?.refreshOpenDashboard()
                self?.updateTitle()
            }
            _ = kickstartTeamClaudeServer()
            var serverReady = false
            for _ in 0..<10 {
                if loadTeamClaudeHealth().serverReachable {
                    serverReady = true
                    break
                }
                Thread.sleep(forTimeInterval: 1)
            }
            guard serverReady else {
                DispatchQueue.main.async {
                    self?.isMeasuringTeamClaude = false
                    self?.teamClaudeMeasureDetail = "서버 연결 실패"
                    self?.refreshOpenDashboard()
                    self?.updateTitle()
                }
                return
            }

            DispatchQueue.main.async {
                self?.teamClaudeMeasureDetail = "계정 사용량 측정 중"
                self?.refreshOpenDashboard()
                self?.updateTitle()
            }
            let exitCode = runTeamClaudeBareClaudeProbe(port: port, apiKey: proxyApiKey, model: model)
            let directStatus = exitCode == nil ? triggerTeamClaudeQuotaProbe(port: port, model: model) : nil
            print("TEAMCLAUDE-PROBE: refreshExit=\(refreshExit.map(String.init) ?? "nil") model=\(model) claudeExit=\(exitCode.map(String.init) ?? "nil") directStatus=\(directStatus.map(String.init) ?? "nil")")
            fflush(stdout)

            var teamClaude = loadTeamClaudeHealth()
            for _ in 0..<10 {
                let pending = teamClaude.measurementPendingCount
                if pending == 0 { break }
                Thread.sleep(forTimeInterval: 2)
                teamClaude = loadTeamClaudeHealth()
            }
            let pending = teamClaude.measurementPendingCount
            let unavailable = teamClaude.measurementUnavailableCount
            let quotaLimited = teamClaude.quotaLimitedCount
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.commitTeamClaudeHealth(teamClaude)
                self.isMeasuringTeamClaude = false
                if pending > 0 {
                    self.teamClaudeMeasureDetail = "\(pending)개 측정 실패 · 다시 시도"
                } else if unavailable > 0 {
                    self.teamClaudeMeasureDetail = "\(unavailable)개 상태 확인 필요"
                } else if quotaLimited > 0 {
                    self.teamClaudeMeasureDetail = "측정 완료 · \(quotaLimited)개 라우팅 한도 대기"
                } else {
                    self.teamClaudeMeasureDetail = "\(teamClaude.accounts.count)개 계정 측정 완료"
                }
                self.refreshOpenDashboard()
                self.updateTitle()
                print("TEAMCLAUDE-MEASURE: pending=\(pending) unavailable=\(unavailable) quotaLimited=\(quotaLimited) result=\(self.teamClaudeMeasureDetail ?? "-")")
                fflush(stdout)
            }
        }
    }

    func openTeamClaudeTerminal(commandTitle: String, arguments: [String], codexMode: Bool = false) {
        let exe = resolveTeamClaudeExecutable()
        let quotedExe = shellQuote(exe)
        let argString = arguments.map(shellQuote).joined(separator: " ")
        let product = codexMode ? "TeamCodex" : "TeamClaude"
        let restart: String
        if codexMode {
            let logPath = shellQuote("\(NSHomeDirectory())/.config/teamcodex.log")
            restart = "\(quotedExe) codex stop; nohup \(quotedExe) codex server </dev/null >> \(logPath) 2>&1 &"
        } else {
            restart = "launchctl kickstart -k gui/$(id -u)/com.qjc.teamclaude || \(quotedExe) restart"
        }
        let command = [
            "clear",
            "echo \(shellQuote("\(product): \(commandTitle)"))",
            "\(quotedExe) \(argString)",
            "status=$?",
            "if [ $status -eq 0 ]; then \(restart); fi",
            "echo",
            "echo \(shellQuote("완료되면 상태바 메뉴를 다시 열거나 새로고침을 누르세요."))",
            "read -n 1 -s -r -p \(shellQuote("닫으려면 아무 키나 누르세요"))",
        ].joined(separator: "; ")

        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        task.arguments = [
            "-e", "tell application \"Terminal\" to activate",
            "-e", "tell application \"Terminal\" to do script \"\(escapeForAppleScriptString(command))\"",
        ]
        try? task.run()
    }

    func refreshAfterTeamClaudeRestart() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            self?.refreshStatusOnly()
        }
    }

    func watchTeamClaudeConfigAfterExternalCommand(reason: String) {
        teamClaudeConfigWatchGeneration += 1
        let generation = teamClaudeConfigWatchGeneration
        let initialSignature = teamClaudeConfigSignature()
        let initialTopology = teamClaudeAccountTopologySignature()
        print("TEAMCLAUDE-WATCH: \(reason) 시작")
        fflush(stdout)

        DispatchQueue.global(qos: .utility).async { [weak self] in
            for attempt in 1...60 {
                Thread.sleep(forTimeInterval: 5)
                guard let self = self else { return }
                guard self.teamClaudeConfigWatchGeneration == generation else { return }

                let currentSignature = teamClaudeConfigSignature()
                if currentSignature != initialSignature {
                    let topologyChanged = teamClaudeAccountTopologySignature() != initialTopology
                    let teamClaude = loadTeamClaudeHealth()
                    print("TEAMCLAUDE-WATCH: 설정 변경 감지 attempt=\(attempt) topologyChanged=\(topologyChanged) drift=\(teamClaude.accountConfigDrift)")
                    fflush(stdout)
                    DispatchQueue.main.async {
                        guard self.teamClaudeConfigWatchGeneration == generation else { return }
                        self.commitTeamClaudeHealth(teamClaude)
                        if !topologyChanged || (teamClaude.accountConfigDrift > 0 && !self.isRefreshingTeamClaude) {
                            self.pendingTeamClaudeForcedSyncReason = "\(reason) 설정 변경"
                        }
                        self.refreshStatusOnly()
                        self.updateTitle()
                    }
                    return
                }

                if attempt % 6 == 0 {
                    let teamClaude = loadTeamClaudeHealth()
                    DispatchQueue.main.async {
                        guard self.teamClaudeConfigWatchGeneration == generation else { return }
                        self.commitTeamClaudeHealth(teamClaude)
                        self.updateTitle()
                    }
                }
            }
            print("TEAMCLAUDE-WATCH: \(reason) 변경 감지 없이 종료")
            fflush(stdout)
        }
    }

    @objc func importClaudeCodeAccountAction() {
        openTeamClaudeTerminal(commandTitle: "현재 Claude Code 로그인 계정 가져오기", arguments: ["import"])
        watchTeamClaudeConfigAfterExternalCommand(reason: "import")
    }

    @objc func addClaudeOAuthAccountAction() {
        openTeamClaudeTerminal(commandTitle: "Claude OAuth 계정 추가", arguments: ["login"])
        watchTeamClaudeConfigAfterExternalCommand(reason: "login")
    }

    @objc func addCodexOAuthAccountAction() {
        openTeamClaudeTerminal(
            commandTitle: "Codex OAuth 계정 추가",
            arguments: ["codex", "login"],
            codexMode: true
        )
    }

    @objc func restartTeamClaudeAction() {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            _ = kickstartTeamClaudeServer()
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                self?.refreshStatusOnly()
            }
        }
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

if let snapshotIndex = CommandLine.arguments.firstIndex(of: "--teamcodex-snapshot") {
    let outputPath = CommandLine.arguments.indices.contains(snapshotIndex + 1)
        ? CommandLine.arguments[snapshotIndex + 1]
        : "/tmp/cc-menubar-teamcodex.png"
    let pool = loadTeamCodexPoolHealth()
    let height = CodexStatusView.preferredHeight(for: pool)
    let view = CodexStatusView(frame: NSRect(
        x: 0,
        y: 0,
        width: StatusMenuDashboardView.preferredWidth,
        height: height
    ))
    view.pool = pool
    view.health = loadCodexHealth()
    view.layoutSubtreeIfNeeded()
    guard let representation = view.bitmapImageRepForCachingDisplay(in: view.bounds) else {
        fputs("TEAMCODEX-SNAPSHOT: bitmap 생성 실패\n", stderr)
        exit(1)
    }
    view.cacheDisplay(in: view.bounds, to: representation)
    guard let data = representation.representation(using: .png, properties: [:]) else {
        fputs("TEAMCODEX-SNAPSHOT: PNG 변환 실패\n", stderr)
        exit(1)
    }
    do {
        try data.write(to: URL(fileURLWithPath: outputPath), options: .atomic)
        print("TEAMCODEX-SNAPSHOT: \(outputPath) accounts=\(pool.accounts.count) current=\(pool.currentAccount ?? "-")")
        exit(0)
    } catch {
        fputs("TEAMCODEX-SNAPSHOT: \(error)\n", stderr)
        exit(1)
    }
}

if CommandLine.arguments.contains("--menu-open-benchmark") {
    _ = NSApplication.shared
    let delegate = AppDelegate()
    delegate.currentTeamClaude = loadTeamClaudeHealth()
    delegate.currentTeamCodex = loadTeamCodexPoolHealth()
    let menu = NSMenu()

    let coldStartedAt = ProcessInfo.processInfo.systemUptime
    delegate.menuWillOpen(menu)
    delegate.menuDidClose(menu)
    let coldMs = Int((ProcessInfo.processInfo.systemUptime - coldStartedAt) * 1_000)

    let warmStartedAt = ProcessInfo.processInfo.systemUptime
    delegate.menuWillOpen(menu)
    delegate.menuDidClose(menu)
    let warmMs = Int((ProcessInfo.processInfo.systemUptime - warmStartedAt) * 1_000)

    print("MENU-BENCHMARK: cold=\(coldMs)ms warm=\(warmMs)ms items=\(menu.items.count)")
    exit(0)
}

if CommandLine.arguments.contains("--codex-loader-benchmark") {
    let startedAt = ProcessInfo.processInfo.systemUptime
    let health = loadCodexHealth()
    let elapsedMs = Int((ProcessInfo.processInfo.systemUptime - startedAt) * 1_000)
    print("CODEX-LOADER-BENCHMARK: \(elapsedMs)ms files=\(health.scannedLogFiles)")
    exit(0)
}

// 헤드리스 셀프테스트: `cc-menubar --selftest`는 GUI 없이 프록시 status를 파싱해
// 계정별 세션/주간/Fable 값을 출력하고 종료한다. "동기화중" 진단용(2026-07-22).
if CommandLine.arguments.contains("--selftest") {
    let health = loadTeamClaudeHealth()
    print("SELFTEST reachable=\(health.serverReachable) accounts=\(health.accounts.count) usable=\(health.accountUsable) host=\(health.hostSummaryText ?? "nil")")
    for row in health.accounts {
        let pair = teamClaudeQuotaPair(for: row)
        print("  \(row.name) status=\(row.status) ses=\(String(describing: row.sessionPercent)) wk=\(String(describing: row.weeklyPercent)) wkReset=\(String(describing: row.weeklyResetSeconds)) fb=\(String(describing: row.fablePercent)) pair=\(pair == nil ? "nil(→동기화중)" : "ok")")
    }
    exit(0)
}

let delegate = AppDelegate()
let app = NSApplication.shared
app.delegate = delegate
app.run()
