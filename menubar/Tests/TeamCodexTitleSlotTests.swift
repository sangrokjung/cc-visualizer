// menubar/Tests/TeamCodexTitleSlotTests.swift
import Foundation

@main
struct TeamCodexTitleSlotTests {
    static func main() throws {
        let now = Date(timeIntervalSince1970: 1_790_000_000)
        let seoul = TimeZone(identifier: "Asia/Seoul")!
        func row(_ name: String, usable: Bool, weekly: Double, weeklyResetIn: TimeInterval) -> [String: Any] {
            ["name": name, "enabled": true, "status": "active", "usable": usable,
             "quota": ["unified5h": 0, "unified7d": weekly,
                       "unified7dReset": (now.timeIntervalSince1970 + weeklyResetIn) * 1000],
             "subscription": ["state": "active"]]
        }
        func pool(_ rows: [[String: Any]]) throws -> TeamCodexPoolHealth {
            let data = try JSONSerialization.data(withJSONObject: ["accounts": rows, "switchThreshold": 1])
            return try teamCodexPoolHealth(from: data, port: 3457, serverPid: nil, checkedAt: now)
        }

        let healthy = try pool([row("a0", usable: true, weekly: 0.4, weeklyResetIn: 3600),
                                row("a1", usable: false, weekly: 1, weeklyResetIn: 7200)])
        precondition(!healthy.isExhausted)
        precondition(healthy.statusLabel == "온라인", healthy.statusLabel)
        precondition(healthy.titleSlot(timeZone: seoul) == "Codex 1/2", healthy.titleSlot(timeZone: seoul))

        let exhausted = try pool([row("a0", usable: false, weekly: 1, weeklyResetIn: 3 * 86_400),
                                  row("a1", usable: false, weekly: 1, weeklyResetIn: 86_400)])
        precondition(exhausted.isExhausted)
        precondition(exhausted.statusLabel == "소진", exhausted.statusLabel)
        let soonest = teamCodexShortClock(now.addingTimeInterval(86_400), timeZone: seoul)
        precondition(exhausted.titleSlot(timeZone: seoul) == "Codex 소진 · \(soonest) 복구", exhausted.titleSlot(timeZone: seoul))

        let noReset = try pool([row("a0", usable: false, weekly: 1, weeklyResetIn: -60)])
        precondition(noReset.titleSlot(timeZone: seoul) == "Codex 소진 0/1", noReset.titleSlot(timeZone: seoul))

        let config = try JSONSerialization.data(withJSONObject: ["accounts": [row("a0", usable: true, weekly: 0, weeklyResetIn: 60)]])
        let offline = try teamCodexPoolOfflineHealth(configData: config, port: 3457, serverPid: nil, checkedAt: now)
        precondition(offline.statusLabel == "오프라인", offline.statusLabel)
        precondition(offline.titleSlot(timeZone: seoul) == "Codex 오프라인", offline.titleSlot(timeZone: seoul))

        precondition(exhausted.accessibilitySummary.hasPrefix("TeamCodex 소진, "), exhausted.accessibilitySummary)
        print("TeamCodexTitleSlotTests: status label, exhaustion, recovery clock, title slot passed")
    }
}
