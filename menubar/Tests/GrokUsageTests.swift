import Foundation

@main
struct GrokUsageTests {
    static func main() {
        let billing = """
        {"config":{"creditUsagePercent":9,"productUsage":[{"product":"GrokBuild","usagePercent":2.0}]}}
        """.data(using: .utf8)!
        precondition(grokUsagePercent(fromBilling: billing) == 2, "GrokBuild percent wins over the account total")
        precondition(grokPercentSlot(2) == "Grok 2%")
        precondition(grokPercentSlot(0) == "Grok 0%", "a real zero stays visible")
        precondition(grokPercentSlot(2.05) == "Grok 2.1%")

        let creditOnly = #"{"config":{"creditUsagePercent":0}}"#.data(using: .utf8)!
        precondition(grokUsagePercent(fromBilling: creditOnly) == 0)
        precondition(grokPercentSlot(grokUsagePercent(fromBilling: creditOnly)!) == "Grok 0%")

        let unknown = #"{"contextWindowUsage":53,"contextWindowTokens":500000}"#.data(using: .utf8)!
        precondition(grokUsagePercent(fromBilling: unknown) == nil, "context window is not plan usage")
        precondition(grokPercentSlot(250) == nil, "out of range must not render as a percent")
        precondition(grokUsagePercent(fromBilling: #"{"config":{"creditUsagePercent":250}}"#.data(using: .utf8)!) == nil)

        let now = ISO8601DateFormatter().date(from: "2026-09-22T05:23:23Z")!
        let expired = #"{"acct":{"key":"test-token","expires_at":"2020-01-01T00:00:00Z"}}"#.data(using: .utf8)!
        if case .login = grokCredential(from: expired, now: now) {} else {
            preconditionFailure("expired Grok auth must ask for login")
        }
        let missingExpiry = #"{"acct":{"key":"test-token","expires_at":"not-a-date"}}"#.data(using: .utf8)!
        if case .login = grokCredential(from: missingExpiry, now: now) {} else {
            preconditionFailure("unreadable expiry must not be treated as usable")
        }
        let live = #"{"acct":{"key":"test-token","expires_at":"2026-09-22T11:00:11.164109Z"}}"#.data(using: .utf8)!
        if case .usable = grokCredential(from: live, now: now) {} else {
            preconditionFailure("future expiry must stay usable")
        }
        let absent = Data("{}".utf8)
        if case .login = grokCredential(from: absent, now: now) {} else {
            preconditionFailure("missing credential must ask for login")
        }

        print("Grok title usage test passed")
    }
}
