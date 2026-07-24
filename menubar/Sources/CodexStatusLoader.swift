import Foundation

func loadCodexConfigSummary(path: String) -> CodexConfigSummary {
    guard let text = try? String(contentsOfFile: path, encoding: .utf8) else {
        return CodexConfigSummary(present: false, model: nil, reasoningEffort: nil, serviceTier: nil, contextWindow: nil)
    }

    var model: String?
    var effort: String?
    var tier: String?
    var window: Int?

    for rawLine in text.split(separator: "\n", omittingEmptySubsequences: false) {
        let line = String(rawLine).trimmingCharacters(in: .whitespaces)
        if line.isEmpty || line.hasPrefix("#") { continue }
        if line.hasPrefix("[") { break }
        guard let eq = line.firstIndex(of: "=") else { continue }
        let key = line[..<eq].trimmingCharacters(in: .whitespaces)
        let rawValue = line[line.index(after: eq)...]
        guard let value = codexTomlValue(String(rawValue)) else { continue }

        switch key {
        case "model":
            model = value
        case "model_reasoning_effort":
            effort = value
        case "service_tier":
            tier = value
        case "model_context_window":
            window = Int(value)
        default:
            continue
        }
    }

    return CodexConfigSummary(present: true, model: model, reasoningEffort: effort, serviceTier: tier, contextWindow: window)
}

private struct CodexSessionFile {
    let url: URL
    let modifiedAt: Date
    let size: Int64
}

private struct CodexSessionFileStats: Codable {
    var todayCalls = 0
    var weekCalls = 0
    var totalCalls = 0
    var todayTokens = 0
    var weekTokens = 0
    var totalTokens = 0
    var quotaEvents = 0
    var errorEvents = 0
    var lastCallAt: Date?
    var latestModel: String?
    var latestContextWindow: Int?
    var latestRateAt: Date?
    var planType: String?
    var primaryUsedPercent: Double?
    var secondaryUsedPercent: Double?
    var primaryResetAt: Date?
    var secondaryResetAt: Date?
    var byProfile: [String: CodexMutableProfile] = [:]
    var currentModel = "Codex"
    var lastCumulativeTotal: Int?
    var parsedBytes: Int64 = 0
}

private let codexSessionStatsCacheLock = NSLock()
private var codexSessionStatsCache: (signature: String, stats: CodexCallStats)?
private var codexSessionFileStatsCache: [String: (dayKey: String, modifiedAt: Int, size: Int64, stats: CodexSessionFileStats)] = [:]
private var codexPersistentCacheLoaded = false
private let codexTokenCountNeedle = Data("token_count".utf8)
private let codexTurnContextNeedle = Data("turn_context".utf8)
private let codexModelNeedle = Data("\"model\"".utf8)

private struct CodexPersistentFileCacheEntry: Codable {
    let dayKey: String
    let modifiedAt: Int
    let size: Int64
    let stats: CodexSessionFileStats
}

private struct CodexPersistentFileCache: Codable {
    let version: Int
    let entries: [String: CodexPersistentFileCacheEntry]
}

private let codexPersistentFileCacheVersion = 1

private func codexPersistentFileCacheURL() -> URL {
    URL(fileURLWithPath: NSHomeDirectory())
        .appendingPathComponent(".codex/cache", isDirectory: true)
        .appendingPathComponent("cc-menubar-session-stats-v1.json")
}

private func loadCodexPersistentFileCacheIfNeeded(dayKey: String) {
    codexSessionStatsCacheLock.lock()
    guard !codexPersistentCacheLoaded else {
        codexSessionStatsCacheLock.unlock()
        return
    }
    codexPersistentCacheLoaded = true
    codexSessionStatsCacheLock.unlock()

    let url = codexPersistentFileCacheURL()
    guard let data = try? Data(contentsOf: url),
          let cache = try? JSONDecoder().decode(CodexPersistentFileCache.self, from: data),
          cache.version == codexPersistentFileCacheVersion else {
        return
    }

    let entries = cache.entries.compactMapValues { entry in
        entry.dayKey == dayKey
            ? (entry.dayKey, entry.modifiedAt, entry.size, entry.stats)
            : nil
    }
    codexSessionStatsCacheLock.lock()
    codexSessionFileStatsCache.merge(entries) { current, _ in current }
    codexSessionStatsCacheLock.unlock()
}

private func persistCodexSessionFileStatsCache() {
    codexSessionStatsCacheLock.lock()
    let entries = codexSessionFileStatsCache.mapValues { entry in
        CodexPersistentFileCacheEntry(
            dayKey: entry.dayKey,
            modifiedAt: entry.modifiedAt,
            size: entry.size,
            stats: entry.stats
        )
    }
    codexSessionStatsCacheLock.unlock()

    let cache = CodexPersistentFileCache(
        version: codexPersistentFileCacheVersion,
        entries: entries
    )
    let url = codexPersistentFileCacheURL()
    let directory = url.deletingLastPathComponent()
    do {
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        let data = try JSONEncoder().encode(cache)
        try data.write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    } catch {
        print("CODEX-CACHE-WRITE: \(error.localizedDescription)")
        fflush(stdout)
    }
}

private func emptyCodexCallStats(scannedLogFiles: Int = 0, scannedLogBytes: Int64 = 0) -> CodexCallStats {
    CodexCallStats(
        todayCalls: 0,
        weekCalls: 0,
        totalCalls: 0,
        todayTokens: 0,
        weekTokens: 0,
        totalTokens: 0,
        quotaEvents: 0,
        errorEvents: 0,
        lastCallAt: nil,
        latestModel: nil,
        planType: nil,
        contextWindow: nil,
        primaryUsedPercent: nil,
        secondaryUsedPercent: nil,
        primaryResetAt: nil,
        secondaryResetAt: nil,
        scannedLogFiles: scannedLogFiles,
        scannedLogBytes: scannedLogBytes,
        profiles: []
    )
}

func loadCodexCallStats(path: String) -> CodexCallStats {
    guard let text = try? String(contentsOfFile: path, encoding: .utf8) else {
        return emptyCodexCallStats()
    }

    let calendar = Calendar.current
    let now = Date()
    let weekStart = calendar.date(byAdding: .day, value: -7, to: now) ?? Date.distantPast
    var todayCalls = 0
    var weekCalls = 0
    var totalCalls = 0
    var quotaEvents = 0
    var errorEvents = 0
    var lastCallAt: Date?
    var byProfile: [String: CodexMutableProfile] = [:]

    for line in text.split(separator: "\n") {
        guard let data = String(line).data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            continue
        }

        let profile = safeCodexLabel(codexString(obj["profile"]) ?? "default")
        let verdict = codexString(obj["verdict_class"]) ?? "unknown"
        let date = parseCodexDate(obj["ts"])
        let isToday = date.map { calendar.isDateInToday($0) } ?? false
        let isWeek = date.map { $0 >= weekStart } ?? false
        let verdictLower = verdict.lowercased()
        let isQuota = verdictLower.contains("quota")
        let isError = verdictLower != "ok" && !isQuota

        totalCalls += 1
        if isToday { todayCalls += 1 }
        if isWeek { weekCalls += 1 }
        if isWeek, isQuota { quotaEvents += 1 }
        if isWeek, isError { errorEvents += 1 }

        var row = byProfile[profile] ?? CodexMutableProfile()
        row.totalCalls += 1
        if isToday { row.todayCalls += 1 }
        if isWeek { row.weekCalls += 1 }
        if isWeek, isQuota { row.quotaEvents += 1 }
        if isWeek, isError { row.errorEvents += 1 }
        if let date = date, lastCallAt == nil || date > lastCallAt! {
            lastCallAt = date
        }
        if let date = date, row.lastAt == nil || date > row.lastAt! {
            row.lastAt = date
            row.lastVerdict = verdict
        } else if row.lastAt == nil {
            row.lastVerdict = verdict
        }
        byProfile[profile] = row
    }

    let profiles = byProfile.map { profile, row in
        CodexProfileHealth(
            profile: profile,
            todayCalls: row.todayCalls,
            weekCalls: row.weekCalls,
            totalCalls: row.totalCalls,
            todayTokens: row.todayTokens,
            weekTokens: row.weekTokens,
            totalTokens: row.totalTokens,
            quotaEvents: row.quotaEvents,
            errorEvents: row.errorEvents,
            lastVerdict: row.lastVerdict,
            lastAt: row.lastAt
        )
    }
    .sorted {
        if $0.todayCalls != $1.todayCalls { return $0.todayCalls > $1.todayCalls }
        if $0.weekCalls != $1.weekCalls { return $0.weekCalls > $1.weekCalls }
        return $0.totalCalls > $1.totalCalls
    }

    return CodexCallStats(
        todayCalls: todayCalls,
        weekCalls: weekCalls,
        totalCalls: totalCalls,
        todayTokens: 0,
        weekTokens: 0,
        totalTokens: 0,
        quotaEvents: quotaEvents,
        errorEvents: errorEvents,
        lastCallAt: lastCallAt,
        latestModel: nil,
        planType: nil,
        contextWindow: nil,
        primaryUsedPercent: nil,
        secondaryUsedPercent: nil,
        primaryResetAt: nil,
        secondaryResetAt: nil,
        scannedLogFiles: 1,
        scannedLogBytes: Int64(text.utf8.count),
        profiles: profiles
    )
}

private func recentCodexSessionFiles(root: String) -> [CodexSessionFile] {
    let fm = FileManager.default
    let rootURL = URL(fileURLWithPath: root, isDirectory: true)
    guard fm.fileExists(atPath: rootURL.path) else { return [] }

    let cutoff = Calendar.current.date(byAdding: .day, value: -8, to: Date()) ?? Date.distantPast
    let keys: [URLResourceKey] = [.isRegularFileKey, .contentModificationDateKey, .fileSizeKey]
    guard let enumerator = fm.enumerator(
        at: rootURL,
        includingPropertiesForKeys: keys,
        options: [.skipsHiddenFiles, .skipsPackageDescendants]
    ) else {
        return []
    }

    var files: [CodexSessionFile] = []
    for case let url as URL in enumerator {
        guard url.pathExtension == "jsonl",
              let values = try? url.resourceValues(forKeys: Set(keys)),
              values.isRegularFile == true,
              let modifiedAt = values.contentModificationDate,
              modifiedAt >= cutoff else {
            continue
        }
        files.append(CodexSessionFile(
            url: url,
            modifiedAt: modifiedAt,
            size: Int64(values.fileSize ?? 0)
        ))
    }
    return files.sorted {
        if $0.modifiedAt != $1.modifiedAt { return $0.modifiedAt < $1.modifiedAt }
        return $0.url.path < $1.url.path
    }
}

private func codexSessionSignature(_ files: [CodexSessionFile], dayKey: String) -> String {
    dayKey + "\n" + files.map { file in
        "\(file.url.path)|\(Int(file.modifiedAt.timeIntervalSince1970))|\(file.size)"
    }.joined(separator: "\n")
}

private func codexDayKey(_ date: Date, calendar: Calendar) -> String {
    let components = calendar.dateComponents([.year, .month, .day], from: date)
    return "\(components.year ?? 0)-\(components.month ?? 0)-\(components.day ?? 0)"
}

@discardableResult
private func forEachCodexSessionInterestingLine(url: URL, startOffset: Int64, _ body: (Data) -> Void) -> Int64 {
    guard let handle = try? FileHandle(forReadingFrom: url) else { return startOffset }
    defer { handle.closeFile() }
    do {
        try handle.seek(toOffset: UInt64(max(0, startOffset)))
    } catch {
        return startOffset
    }

    let newline = UInt8(10)
    var buffer = Data()
    var consumedOffset = startOffset
    while true {
        let chunk = handle.readData(ofLength: 64 * 1024)
        if chunk.isEmpty { break }
        buffer.append(chunk)

        while let newlineIndex = buffer.firstIndex(of: newline) {
            let lineRange = buffer.startIndex..<newlineIndex
            let hasTokenCount = buffer.range(of: codexTokenCountNeedle, options: [], in: lineRange) != nil
            let hasTurnContext = buffer.range(of: codexTurnContextNeedle, options: [], in: lineRange) != nil
                && buffer.range(of: codexModelNeedle, options: [], in: lineRange) != nil
            if hasTokenCount || hasTurnContext {
                let lineData = Data(buffer[lineRange])
                autoreleasepool {
                    body(lineData)
                }
            }
            let consumed = buffer.distance(from: buffer.startIndex, to: newlineIndex) + 1
            buffer.removeFirst(consumed)
            consumedOffset += Int64(consumed)
        }
    }
    return consumedOffset
}

private func codexTokenTotal(_ usage: [String: Any]?) -> Int {
    guard let usage = usage else { return 0 }
    if let total = codexInt(usage["total_tokens"]) {
        return total
    }
    return [
        "input_tokens",
        "cached_input_tokens",
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
        "output_tokens",
        "reasoning_output_tokens",
    ].reduce(0) { partial, key in
        partial + (codexInt(usage[key]) ?? 0)
    }
}

private func scanCodexSessionFile(
    _ file: CodexSessionFile,
    calendar: Calendar,
    weekStart: Date,
    existing: CodexSessionFileStats? = nil
) -> CodexSessionFileStats {
    var stats = existing ?? CodexSessionFileStats()
    var currentModel = stats.currentModel
    var lastCumulativeTotal = stats.lastCumulativeTotal

    let consumedOffset = forEachCodexSessionInterestingLine(url: file.url, startOffset: stats.parsedBytes) { lineData in
        if lineData.range(of: codexTurnContextNeedle) != nil,
           let obj = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any],
           codexString(obj["type"]) == "turn_context",
           let payload = obj["payload"] as? [String: Any],
           let model = codexString(payload["model"]) {
            currentModel = model
            return
        }

        guard lineData.range(of: codexTokenCountNeedle) != nil,
              let obj = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any],
              let payload = obj["payload"] as? [String: Any],
              codexString(payload["type"]) == "token_count" else {
            return
        }

        let date = parseCodexDate(obj["timestamp"])
        let info = payload["info"] as? [String: Any]
        let totalUsage = info?["total_token_usage"] as? [String: Any]
        if let cumulativeTotal = codexInt(totalUsage?["total_tokens"]) {
            if let last = lastCumulativeTotal, cumulativeTotal <= last {
                return
            }
            lastCumulativeTotal = cumulativeTotal
        }

        let lastUsage = (info?["last_token_usage"] as? [String: Any]) ?? totalUsage
        let tokens = codexTokenTotal(lastUsage)
        let isToday = date.map { calendar.isDateInToday($0) } ?? false
        let isWeek = date.map { $0 >= weekStart } ?? false
        let rawModel = currentModel.isEmpty ? "Codex" : currentModel
        let profile = safeCodexLabel(codexShortenModelName(rawModel))
        var verdict = "ok"

        if let rate = payload["rate_limits"] as? [String: Any] {
            if let reached = codexString(rate["rate_limit_reached_type"]), !reached.isEmpty {
                verdict = "pass_quota"
                if isWeek { stats.quotaEvents += 1 }
            }
            let rateDate = date ?? stats.latestRateAt ?? Date.distantPast
            if stats.latestRateAt == nil || rateDate >= stats.latestRateAt! {
                stats.latestRateAt = rateDate
                stats.planType = codexString(rate["plan_type"]) ?? stats.planType
                if let primary = rate["primary"] as? [String: Any] {
                    stats.primaryUsedPercent = codexDouble(primary["used_percent"])
                    stats.primaryResetAt = parseCodexDate(primary["resets_at"])
                }
                if let secondary = rate["secondary"] as? [String: Any] {
                    stats.secondaryUsedPercent = codexDouble(secondary["used_percent"])
                    stats.secondaryResetAt = parseCodexDate(secondary["resets_at"])
                }
            }
        }

        stats.totalCalls += 1
        stats.totalTokens += tokens
        if isToday {
            stats.todayCalls += 1
            stats.todayTokens += tokens
        }
        if isWeek {
            stats.weekCalls += 1
            stats.weekTokens += tokens
        }

        var row = stats.byProfile[profile] ?? CodexMutableProfile()
        row.totalCalls += 1
        row.totalTokens += tokens
        if isToday {
            row.todayCalls += 1
            row.todayTokens += tokens
        }
        if isWeek {
            row.weekCalls += 1
            row.weekTokens += tokens
            if verdict == "pass_quota" { row.quotaEvents += 1 }
        }
        if let date = date, stats.lastCallAt == nil || date > stats.lastCallAt! {
            stats.lastCallAt = date
            stats.latestModel = rawModel
            stats.latestContextWindow = codexInt(info?["model_context_window"])
        }
        if let date = date, row.lastAt == nil || date > row.lastAt! {
            row.lastAt = date
            row.lastVerdict = verdict
        } else if row.lastAt == nil {
            row.lastVerdict = verdict
        }
        stats.byProfile[profile] = row
    }

    stats.currentModel = currentModel
    stats.lastCumulativeTotal = lastCumulativeTotal
    stats.parsedBytes = consumedOffset
    return stats
}

func loadCodexSessionStats(root: String) -> CodexCallStats {
    let files = recentCodexSessionFiles(root: root)
    let scannedBytes = files.reduce(Int64(0)) { $0 + $1.size }
    guard !files.isEmpty else {
        return emptyCodexCallStats()
    }

    let calendar = Calendar.current
    let weekStart = calendar.date(byAdding: .day, value: -7, to: Date()) ?? Date.distantPast
    let dayKey = codexDayKey(Date(), calendar: calendar)
    loadCodexPersistentFileCacheIfNeeded(dayKey: dayKey)
    let signature = codexSessionSignature(files, dayKey: dayKey)
    codexSessionStatsCacheLock.lock()
    if let cached = codexSessionStatsCache, cached.signature == signature {
        codexSessionStatsCacheLock.unlock()
        return cached.stats
    }
    codexSessionStatsCacheLock.unlock()
    var fileStatsList: [CodexSessionFileStats] = []
    var activeFilePaths = Set<String>()

    for file in files {
        let path = file.url.path
        let modifiedAt = Int(file.modifiedAt.timeIntervalSince1970)
        activeFilePaths.insert(path)

        codexSessionStatsCacheLock.lock()
        let cachedEntry = codexSessionFileStatsCache[path]
        codexSessionStatsCacheLock.unlock()

        let parsedStats: CodexSessionFileStats
        if let cached = cachedEntry,
           cached.dayKey == dayKey,
           file.size > cached.size,
           file.size >= cached.stats.parsedBytes {
            parsedStats = autoreleasepool {
                scanCodexSessionFile(file, calendar: calendar, weekStart: weekStart, existing: cached.stats)
            }
        } else if let cached = cachedEntry,
                  cached.dayKey == dayKey,
                  cached.size == file.size,
                  cached.modifiedAt == modifiedAt {
            parsedStats = cached.stats
        } else {
            parsedStats = autoreleasepool {
                scanCodexSessionFile(file, calendar: calendar, weekStart: weekStart)
            }
        }

        codexSessionStatsCacheLock.lock()
        codexSessionFileStatsCache[path] = (dayKey, modifiedAt, file.size, parsedStats)
        codexSessionStatsCacheLock.unlock()
        fileStatsList.append(parsedStats)
    }

    codexSessionStatsCacheLock.lock()
    codexSessionFileStatsCache = codexSessionFileStatsCache.filter { activeFilePaths.contains($0.key) }
    codexSessionStatsCacheLock.unlock()
    persistCodexSessionFileStatsCache()

    var todayCalls = 0
    var weekCalls = 0
    var totalCalls = 0
    var todayTokens = 0
    var weekTokens = 0
    var totalTokens = 0
    var quotaEvents = 0
    var errorEvents = 0
    var lastCallAt: Date?
    var latestModel: String?
    var latestContextWindow: Int?
    var latestRateAt: Date?
    var planType: String?
    var primaryUsedPercent: Double?
    var secondaryUsedPercent: Double?
    var primaryResetAt: Date?
    var secondaryResetAt: Date?
    var byProfile: [String: CodexMutableProfile] = [:]

    for fileStats in fileStatsList {
        todayCalls += fileStats.todayCalls
        weekCalls += fileStats.weekCalls
        totalCalls += fileStats.totalCalls
        todayTokens += fileStats.todayTokens
        weekTokens += fileStats.weekTokens
        totalTokens += fileStats.totalTokens
        quotaEvents += fileStats.quotaEvents
        errorEvents += fileStats.errorEvents

        if let date = fileStats.lastCallAt, lastCallAt == nil || date > lastCallAt! {
            lastCallAt = date
            latestModel = fileStats.latestModel
            latestContextWindow = fileStats.latestContextWindow
        }
        if let rateAt = fileStats.latestRateAt, latestRateAt == nil || rateAt > latestRateAt! {
            latestRateAt = rateAt
            planType = fileStats.planType
            primaryUsedPercent = fileStats.primaryUsedPercent
            secondaryUsedPercent = fileStats.secondaryUsedPercent
            primaryResetAt = fileStats.primaryResetAt
            secondaryResetAt = fileStats.secondaryResetAt
        }

        for (profile, row) in fileStats.byProfile {
            var merged = byProfile[profile] ?? CodexMutableProfile()
            merged.todayCalls += row.todayCalls
            merged.weekCalls += row.weekCalls
            merged.totalCalls += row.totalCalls
            merged.todayTokens += row.todayTokens
            merged.weekTokens += row.weekTokens
            merged.totalTokens += row.totalTokens
            merged.quotaEvents += row.quotaEvents
            merged.errorEvents += row.errorEvents
            if let date = row.lastAt, merged.lastAt == nil || date > merged.lastAt! {
                merged.lastAt = date
                merged.lastVerdict = row.lastVerdict
            } else if merged.lastAt == nil {
                merged.lastVerdict = row.lastVerdict
            }
            byProfile[profile] = merged
        }
    }

    let profiles = byProfile.map { profile, row in
        CodexProfileHealth(
            profile: profile,
            todayCalls: row.todayCalls,
            weekCalls: row.weekCalls,
            totalCalls: row.totalCalls,
            todayTokens: row.todayTokens,
            weekTokens: row.weekTokens,
            totalTokens: row.totalTokens,
            quotaEvents: row.quotaEvents,
            errorEvents: row.errorEvents,
            lastVerdict: row.lastVerdict,
            lastAt: row.lastAt
        )
    }
    .sorted {
        if $0.todayTokens != $1.todayTokens { return $0.todayTokens > $1.todayTokens }
        if $0.weekTokens != $1.weekTokens { return $0.weekTokens > $1.weekTokens }
        if $0.todayCalls != $1.todayCalls { return $0.todayCalls > $1.todayCalls }
        return $0.weekCalls > $1.weekCalls
    }

    let stats = CodexCallStats(
        todayCalls: todayCalls,
        weekCalls: weekCalls,
        totalCalls: totalCalls,
        todayTokens: todayTokens,
        weekTokens: weekTokens,
        totalTokens: totalTokens,
        quotaEvents: quotaEvents,
        errorEvents: errorEvents,
        lastCallAt: lastCallAt,
        latestModel: latestModel,
        planType: planType,
        contextWindow: latestContextWindow,
        primaryUsedPercent: primaryUsedPercent,
        secondaryUsedPercent: secondaryUsedPercent,
        primaryResetAt: primaryResetAt,
        secondaryResetAt: secondaryResetAt,
        scannedLogFiles: files.count,
        scannedLogBytes: scannedBytes,
        profiles: profiles
    )

    codexSessionStatsCacheLock.lock()
    codexSessionStatsCache = (signature, stats)
    codexSessionStatsCacheLock.unlock()
    return stats
}

func loadCodexHealth() -> CodexHealth {
    let home = codexHomePath()
    let fm = FileManager.default
    let authPath = "\(home)/auth.json"
    let configPath = "\(home)/config.toml"
    let authFileExists = fm.fileExists(atPath: authPath)
    let auth = readCodexJSON(authPath)
    let authMalformed = authFileExists && auth == nil
    let authMode = codexString(auth?["auth_mode"])
    let hasApiKey = (codexString(auth?["OPENAI_API_KEY"])?.isEmpty == false)
    let tokenObject = auth?["tokens"]
    let hasTokens = tokenObject != nil && !(tokenObject is NSNull)
    let lastRefresh = parseCodexDate(auth?["last_refresh"])
    let config = loadCodexConfigSummary(path: configPath)
    let sessionStats = loadCodexSessionStats(root: codexSessionsPath())
    let stats = (sessionStats.totalCalls > 0 || sessionStats.primaryUsedPercent != nil || sessionStats.secondaryUsedPercent != nil)
        ? sessionStats
        : loadCodexCallStats(path: codexCallLogPath())

    let authLabel: String
    if authMode?.lowercased().contains("chatgpt") == true || (hasTokens && !hasApiKey) {
        authLabel = "ChatGPT"
    } else if authMode?.lowercased().contains("api") == true || hasApiKey {
        authLabel = "API Key"
    } else {
        authLabel = "로그인 필요"
    }

    let staleRefresh = lastRefresh.map { $0 < Date().addingTimeInterval(TimeInterval(-14 * 86_400)) } ?? false
    var hints: [String] = []
    if authMalformed {
        hints.append("auth.json 파싱 실패")
    } else if !authFileExists {
        hints.append("Codex auth 파일 없음")
    } else if !hasApiKey && !hasTokens {
        hints.append("Codex 인증 정보 없음")
    }
    if staleRefresh {
        hints.append("마지막 refresh 14일 초과")
    }
    if !config.present {
        hints.append("config.toml 없음")
    }
    if stats.scannedLogFiles == 0 {
        hints.append("Codex 세션 로그 없음")
    }
    if stats.quotaEvents > 0 {
        hints.append("최근 7일 쿼터 이벤트 \(stats.quotaEvents)회")
    }
    if stats.errorEvents > 0 {
        hints.append("최근 7일 오류 이벤트 \(stats.errorEvents)회")
    }
    if max(stats.primaryUsedPercent ?? 0, stats.secondaryUsedPercent ?? 0) >= 90 {
        hints.append("Codex 제한 높음 \(formatCodexLimitPair(stats.primaryUsedPercent, stats.secondaryUsedPercent) ?? "-")")
    }

    let status: String
    if authMalformed {
        status = "error"
    } else if !authFileExists || (!hasApiKey && !hasTokens) || staleRefresh || stats.quotaEvents > 0 || stats.errorEvents > 0 || max(stats.primaryUsedPercent ?? 0, stats.secondaryUsedPercent ?? 0) >= 90 {
        status = "warning"
    } else {
        status = "ok"
    }

    return CodexHealth(
        checkedAt: Date(),
        overallStatus: status,
        configPresent: config.present,
        authPresent: authFileExists,
        authMode: authMode,
        authLabel: authLabel,
        hasApiKey: hasApiKey,
        hasTokens: hasTokens,
        lastRefresh: lastRefresh,
        model: stats.latestModel ?? config.model,
        reasoningEffort: config.reasoningEffort,
        serviceTier: config.serviceTier,
        contextWindow: stats.contextWindow ?? config.contextWindow,
        todayCalls: stats.todayCalls,
        weekCalls: stats.weekCalls,
        totalCalls: stats.totalCalls,
        todayTokens: stats.todayTokens,
        weekTokens: stats.weekTokens,
        totalTokens: stats.totalTokens,
        quotaEvents: stats.quotaEvents,
        errorEvents: stats.errorEvents,
        lastCallAt: stats.lastCallAt,
        planType: stats.planType,
        primaryUsedPercent: stats.primaryUsedPercent,
        secondaryUsedPercent: stats.secondaryUsedPercent,
        primaryResetAt: stats.primaryResetAt,
        secondaryResetAt: stats.secondaryResetAt,
        scannedLogFiles: stats.scannedLogFiles,
        scannedLogBytes: stats.scannedLogBytes,
        profiles: stats.profiles,
        hints: hints
    )
}
