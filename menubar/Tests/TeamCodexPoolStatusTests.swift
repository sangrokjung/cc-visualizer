import Foundation

@main
struct TeamCodexPoolStatusTests {
    static func main() throws {
        let checkedAt = Date(timeIntervalSince1970: 1_700_000_000)
        let sessionResetMs = Int64((checkedAt.timeIntervalSince1970 + 16_200) * 1_000)
        let weeklyResetMs = Int64((checkedAt.timeIntervalSince1970 + 176_400) * 1_000)

        // Given: TeamCodex 프록시가 반환하는 실제 status 형태
        let fixture: [String: Any] = [
            "currentAccount": "codex-main",
            "switchThreshold": 0.98,
            "accounts": [
                [
                    "name": "codex-main",
                    "status": "active",
                    "enabled": true,
                    "inflight": 1,
                    "maxConcurrent": 3,
                    "quota": [
                        "unified5h": 0.42,
                        "unified5hReset": sessionResetMs,
                        "unified7d": 0.67,
                        "unified7dReset": weeklyResetMs,
                    ],
                    "usage": [
                        "totalRequests": 12,
                        "totalInputTokens": 1_200,
                        "totalOutputTokens": 300,
                    ],
                ],
                [
                    "name": "codex-backup",
                    "status": "disabled",
                    "enabled": false,
                    "inflight": 0,
                    "maxConcurrent": 2,
                    "quota": [:],
                    "usage": [:],
                ],
                [
                    "name": "codex-limited",
                    "status": "active",
                    "enabled": true,
                    "inflight": 0,
                    "maxConcurrent": 3,
                    "quota": [
                        "unified5h": 1.0,
                        "unified5hReset": sessionResetMs,
                    ],
                    "usage": [:],
                ],
            ],
        ]
        let data = try JSONSerialization.data(withJSONObject: fixture)

        // When: 앱 표시 모델로 파싱
        let health = try teamCodexPoolHealth(
            from: data,
            port: 3457,
            serverPid: 1234,
            checkedAt: checkedAt
        )

        // Then: 현재 계정·쿼터·동시 요청·사용량이 보존됨
        precondition(health.serverReachable)
        precondition(health.serverPort == 3457)
        precondition(health.serverPid == 1234)
        precondition(health.currentAccount == "codex-main")
        precondition(health.accounts.count == 3)
        precondition(health.activeCount == 2)
        precondition(health.usableCount == 1)
        precondition(health.accounts[0].isCurrent)
        precondition(health.accounts[0].sessionPercent == 42)
        precondition(health.accounts[0].sessionResetAt == Date(timeIntervalSince1970: Double(sessionResetMs) / 1_000))
        precondition(health.accounts[0].weeklyPercent == 67)
        precondition(health.accounts[0].weeklyResetAt == Date(timeIntervalSince1970: Double(weeklyResetMs) / 1_000))
        precondition(formatTeamCodexResetRemaining(health.accounts[0].sessionResetAt, now: checkedAt) == "4시간 30분 후")
        precondition(formatTeamCodexResetRemaining(health.accounts[0].weeklyResetAt, now: checkedAt) == "2일 1시간 후")
        precondition(health.accounts[0].inflight == 1)
        precondition(health.accounts[0].maxConcurrent == 3)
        precondition(health.accounts[0].totalRequests == 12)
        precondition(health.accounts[0].totalTokens == 1_500)
        precondition(!health.accounts[1].enabled)
        precondition(health.accounts[2].isQuotaBlocked(switchThresholdPercent: health.switchThresholdPercent))
        precondition(!health.accounts[2].isUsable(switchThresholdPercent: health.switchThresholdPercent))
        precondition(formatTeamCodexResetRemaining(nil, now: checkedAt) == "시각 미측정")
        precondition(formatTeamCodexResetRemaining(checkedAt.addingTimeInterval(-1), now: checkedAt) == "갱신 확인 중")

        // Given: 서버가 꺼져도 설정에는 계정이 남아 있음
        let config: [String: Any] = [
            "accounts": [
                ["name": "configured-only", "type": "oauth"],
            ],
        ]
        let configData = try JSONSerialization.data(withJSONObject: config)

        // When/Then: 앱은 계정 자체를 숨기지 않고 오프라인 상태로 표시
        let offline = try teamCodexPoolOfflineHealth(
            configData: configData,
            port: 3457,
            serverPid: nil
        )
        precondition(!offline.serverReachable)
        precondition(offline.statusLabel == "오프라인")
        precondition(offline.accounts.count == 1)
        precondition(offline.accounts[0].name == "configured-only")

        let loadingLayout = codexStatusLayout(
            topY: 14,
            poolHeight: 86,
            hasPool: true,
            localUsageLoaded: false
        )
        let loadedLayout = codexStatusLayout(
            topY: 14,
            poolHeight: 86,
            hasPool: true,
            localUsageLoaded: true
        )
        precondition(loadingLayout.poolY == 72)
        precondition(loadedLayout.poolY == loadingLayout.poolY)
        precondition(loadedLayout.metricsY == 168)

        print("TeamCodexPoolStatusTests: 37 passed, 0 failed")
    }
}
