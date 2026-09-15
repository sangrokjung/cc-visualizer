import Foundation

struct TeamClaudeOverallStatusInput: Equatable {
    let serverReachable: Bool
    let configPresent: Bool
    let allAccountsError: Bool
    let quotaLimitedCount: Int
    let hasOtherWarning: Bool
}

func teamClaudeOverallStatus(_ input: TeamClaudeOverallStatusInput) -> String {
    if !input.serverReachable || input.allAccountsError { return "error" }
    if !input.configPresent || input.quotaLimitedCount > 0 || input.hasOtherWarning {
        return "warning"
    }
    return "ok"
}

struct TeamClaudeHeadlineInput: Equatable {
    let serverReachable: Bool
    let accountConfigDrift: Int
    let measurementPendingCount: Int
    let quotaLimitedCount: Int
    let fableKnown: Int
    let fableOver: Int
    let totalAccounts: Int
    let accountUsable: Int
    let accountActive: Int
}

func teamClaudeTitleSlot(_ input: TeamClaudeHeadlineInput) -> String {
    if !input.serverReachable { return "Claude 오프라인" }
    if input.accountConfigDrift > 0 { return "Claude 연동 확인 \(input.accountConfigDrift)" }
    if input.measurementPendingCount > 0 { return "Claude 측정 필요 \(input.measurementPendingCount)" }
    if input.fableKnown > 0,
       input.fableOver == input.fableKnown,
       input.fableKnown >= input.totalAccounts {
        return "Claude Fable 한도 \(input.fableOver)/\(input.fableKnown)"
    }
    if input.quotaLimitedCount > 0 {
        return "Claude 라우팅 \(input.accountUsable)/\(input.totalAccounts)"
    }
    return "Claude 정상 \(input.accountActive)/\(input.totalAccounts)"
}
