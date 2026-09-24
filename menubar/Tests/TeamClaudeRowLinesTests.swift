import Foundation

// 계정 행 보조 줄 판정과 행 기하. 높이 계산·그리기·버튼 배치가 전부 이 함수들에 기대므로
// 여기서 고정하는 값이 바뀌면 세 경로가 함께 움직여야 한다.
@main
struct TeamClaudeRowLinesTests {
    static func main() {
        // 1. 사유 줄 — 정상·서버 전체 조건 문구만 빠지고, 계정별 문제 사유는 전부 남는다.
        for reason in [TeamClaudeRowReason.fableReady, TeamClaudeRowReason.opusReady, TeamClaudeRowReason.offline,
                       TeamClaudeRowReason.thresholdUnknown, TeamClaudeRowReason.measurementStale] {
            precondition(!teamClaudeReasonLineIsInformative(reason), "\(reason) repeats on every row and says nothing per account")
        }
        for reason in ["인증 거부 · 상태 확인 필요", "구독 접근 차단", "비활성 · 직접 꺼 둔 계정", "세션·전체 주간 한도 대기",
                       "구독 종료 · 이용 불가", "구독 종료일 경과 · 확인 필요", "한도 리셋 경과 · 재측정 필요",
                       "프록시 라우팅 제외", "일시 제한 해제 대기", "사용 한도 리셋 대기", "서버 상태 확인 필요"] {
            precondition(teamClaudeReasonLineIsInformative(reason), "problem reason must never be dropped: \(reason)")
        }
        precondition(teamClaudeReasonLineIsInformative(""), "an unknown reason is kept rather than silently hidden")

        // 2. 구독 줄 — 전부 미확인이면 빠지고, 정보가 하나라도 있으면 남는다.
        let blank = AccountSubscriptionDetails(tracksCancellation: true)
        precondition(!accountSubscriptionLineIsInformative(blank), "all-unknown subscription line is noise")
        precondition(accountSubscriptionLabel(blank, now: Date()).contains("구독 미확인"), "fixture really is the all-unknown label")
        precondition(accountSubscriptionLineIsInformative(AccountSubscriptionDetails(plan: "Max 20×", tracksCancellation: true)))
        let confirmed = AccountSubscriptionConfirmation(state: .scheduled, date: "2099-10-05", checkedAt: Date(), source: "user-confirmed")
        precondition(accountSubscriptionLineIsInformative(AccountSubscriptionDetails(tracksCancellation: true, confirmation: confirmed)))
        precondition(accountSubscriptionLineIsInformative(AccountSubscriptionDetails(paymentDate: "2099-10-05", tracksCancellation: true)))
        precondition(!accountSubscriptionLineIsInformative(AccountSubscriptionDetails(paymentDate: "not-a-date", tracksCancellation: true)),
                     "an unparsable payment date renders as 미확인 and adds nothing")
        var monitored = blank
        monitored.monitorStatus = "로그인 필요"
        precondition(accountSubscriptionLineIsInformative(monitored), "mail monitor status is actionable")
        precondition(accountSubscriptionLineIsInformative(blank, appearance: .ended), "server-recorded end shows even with no local record")
        precondition(accountSubscriptionLineIsInformative(blank, appearance: .endDateReached))

        // 3. 행 기하 — 세 줄 다 있으면 예전 고정 행(70 + 2)과 같고, 빠진 줄만큼 줄어든다.
        precondition(teamClaudeRowHeight(.full) == 70)
        precondition(teamClaudeRowStride(.full) == 72)
        precondition(teamClaudeRowHeight(.compact) == 28)
        precondition(teamClaudeRowHeight(TeamClaudeRowLines(reason: true, subscription: false)) == 48)
        precondition(teamClaudeRowHeight(TeamClaudeRowLines(reason: false, subscription: true)) == 50)
        precondition(teamClaudeReasonLineY(.full) == 27)
        precondition(teamClaudeSubscriptionLineY(.full) == 47, "full row keeps the pre-change button offset")
        precondition(teamClaudeReasonLineY(.compact) == nil && teamClaudeSubscriptionLineY(.compact) == nil)
        precondition(teamClaudeSubscriptionLineY(TeamClaudeRowLines(reason: false, subscription: true)) == 27,
                     "without a reason line the subscription line moves up into its slot")
        let rows: [TeamClaudeRowLines] = [.full, .compact, TeamClaudeRowLines(reason: true, subscription: false)]
        precondition(teamClaudeRowOrigins(rows) == [0, 72, 102, 152])
        precondition(teamClaudeRowsHeight(rows) == 152)
        precondition(teamClaudeRowOrigins([]) == [0] && teamClaudeRowsHeight([]) == 0)
        precondition(teamClaudeRowsHeight(Array(repeating: .full, count: 17)) == 17 * 72, "all-full rows reproduce the legacy table height")

        print("teamclaude row lines: reason/subscription gating and row geometry passed")
    }
}
