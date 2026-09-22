import Foundation

@main
struct TeamRuntimeSummaryTests {
    static func main() {
        let seoul = TimeZone(identifier: "Asia/Seoul")!
        let full: [String: Any] = [
            "artifact": "eeb99bae2f5d", "version": "1.3.0", "uptimeMs": 3_900_000,
            "workerRestarts": 2, "lastWorkerRestartAt": "2026-09-22T05:10:00.000Z",
            "lastWorkerRestartReason": "health-check",
        ]
        let fullText = teamRuntimeSummary(full, timeZone: seoul)
        precondition(fullText == "빌드 eeb99bae2f5d · 가동 1시간 5분 · 워커 재시작 2회 (마지막 9/22 14:10)", fullText ?? "nil")
        let shortText = teamRuntimeSummary(full, short: true, timeZone: seoul)
        precondition(shortText == "빌드 eeb99bae2f5d · 재시작 2회", shortText ?? "nil")
        precondition(teamRuntimeSummary(["version": "1.3.0"], timeZone: seoul) == "v1.3.0")
        precondition(teamRuntimeSummary(["uptimeMs": 90_000_000], timeZone: seoul) == "빌드 미상 · 가동 1일 1시간")
        precondition(teamRuntimeSummary(nil, timeZone: seoul) == nil)
        precondition(teamRuntimeSummary("junk", timeZone: seoul) == nil)
        print("TeamRuntimeSummaryTests: full, short, partial, nil passed")
    }
}
