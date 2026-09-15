import Foundation

@main
struct CodexStatusLoaderTests {
    static func main() throws {
        precondition(codexModelRecommendations.count == 4)
        precondition(codexModelRecommendations[0] == CodexModelRecommendation(task: "구현·설계", model: "gpt-5.6", effort: "medium · 복잡하면 high"))
        precondition(codexModelRecommendations[2].model == "gpt-5.6-terra")

        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("cc-codex-loader-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let timestamp = ISO8601DateFormatter().string(from: Date())
        let lines: [[String: Any]] = [
            [
                "timestamp": timestamp,
                "type": "turn_context",
                "payload": ["model": "gpt-5.6-codex"],
            ],
            tokenLine(timestamp: timestamp, total: 1_000, last: 400, primary: 17, secondary: 3),
            tokenLine(timestamp: timestamp, total: 1_600, last: 600, primary: 18, secondary: 4),
        ]
        let data = try lines.map { object -> Data in
            var line = try JSONSerialization.data(withJSONObject: object)
            line.append(0x0A)
            return line
        }.reduce(into: Data()) { $0.append($1) }
        try data.write(to: root.appendingPathComponent("fixture.jsonl"))

        let stats = loadCodexSessionStats(root: root.path)
        precondition(stats.todayCalls == 2)
        precondition(stats.weekCalls == 2)
        precondition(stats.todayTokens == 1_000)
        precondition(stats.weekTokens == 1_000)
        precondition(stats.primaryUsedPercent == 18)
        precondition(stats.secondaryUsedPercent == 4)
        precondition(stats.planType == "pro")
        precondition(stats.profiles.count == 1)
        precondition(stats.profiles[0].profile == "GPT-5.6 Codex")

        let appended = tokenLine(timestamp: timestamp, total: 1_900, last: 300, primary: 19, secondary: 5)
        var appendedData = try JSONSerialization.data(withJSONObject: appended)
        appendedData.append(0x0A)
        let handle = try FileHandle(forWritingTo: root.appendingPathComponent("fixture.jsonl"))
        try handle.seekToEnd()
        try handle.write(contentsOf: appendedData)
        try handle.close()

        let incremental = loadCodexSessionStats(root: root.path)
        precondition(incremental.todayCalls == 3)
        precondition(incremental.todayTokens == 1_300)
        precondition(incremental.primaryUsedPercent == 19)
        precondition(incremental.secondaryUsedPercent == 5)

        print("CodexStatusLoaderTests: 16 passed, 0 failed")
    }

    private static func tokenLine(
        timestamp: String,
        total: Int,
        last: Int,
        primary: Double,
        secondary: Double
    ) -> [String: Any] {
        [
            "timestamp": timestamp,
            "type": "event_msg",
            "payload": [
                "type": "token_count",
                "info": [
                    "model_context_window": 1_000_000,
                    "total_token_usage": ["total_tokens": total],
                    "last_token_usage": ["total_tokens": last],
                ],
                "rate_limits": [
                    "plan_type": "pro",
                    "primary": ["used_percent": primary, "resets_at": Date().addingTimeInterval(3_600).timeIntervalSince1970],
                    "secondary": ["used_percent": secondary, "resets_at": Date().addingTimeInterval(86_400).timeIntervalSince1970],
                ],
            ],
        ]
    }
}
