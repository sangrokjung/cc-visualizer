import Foundation

// Claude 풀 표의 계정 행은 이름 줄 아래에 보조 줄 두 개(2행 사유, 3행 구독)를 둘 수 있다.
// 어느 줄을 그릴지와 그 결과 행이 몇 pt인지를 이 파일 하나가 정한다.
// 높이 계산(teamContentHeight)·버튼 배치(layout)·그리기(draw)가 서로 다른 판정을 쓰면
// 행이 겹치거나 빈 칸이 생기므로, 세 경로 모두 여기 함수만 부른다. main.swift 밖에 둔 이유는
// 테스트 러너가 main.swift 없이 컴파일하는 라이브러리 묶음에 들어가야 해서다.

/// 정보가 없어 행에서 빼도 되는 사유 문구.
/// TeamClaudeAvailability가 같은 상수를 쓰므로 문자열이 두 군데서 따로 바뀌지 않는다.
enum TeamClaudeRowReason {
    static let fableReady = "Fable 사용 가능"
    static let opusReady = "Opus 사용 가능"
    static let offline = "오프라인 · 확인 필요"
    static let thresholdUnknown = "한도 기준 확인 필요"
    static let measurementStale = "최신 한도 측정 필요"

    /// 상태 점(초록)이나 헤더 요약("N개 계정 확인 필요")이 이미 말하는 문구, 또는 계정별 원인이 아니라
    /// 서버 전체 조건(오프라인·한도 기준 없음·측정 지연)이라 모든 행에 똑같이 찍히는 문구.
    /// 오류·인증 거부·비활성·한도 초과·구독 종료 같은 계정별 문제 사유는 여기 넣지 않는다 — 그 문구가 이 표의 핵심이다.
    static let uninformative: Set<String> = [fableReady, opusReady, offline, thresholdUnknown, measurementStale]
}

/// 2행(사유)을 그릴지. 위 목록 밖의 문구는 전부 그린다.
func teamClaudeReasonLineIsInformative(_ reason: String) -> Bool {
    !TeamClaudeRowReason.uninformative.contains(reason)
}

/// 3행(구독)을 그릴지. 플랜·확인 기록·입력 결제일·메일 조회 상태 중 하나라도 있어야 한다.
/// 전부 없으면 "구독 미확인 · 해지 미확인 · 결제일 미확인 · 만료일 미확인"처럼 모든 행에 같은 문구가 반복된다.
/// 행 외형이 회색(종료·종료일 경과)이면 서버 기록만으로 종료를 말하는 중이라 기록이 비어 있어도 그린다.
func accountSubscriptionLineIsInformative(_ details: AccountSubscriptionDetails,
                                          appearance: AccountSubscriptionAppearance = .standard) -> Bool {
    if appearance.isMuted { return true }
    if details.plan != nil || details.confirmation != nil || details.monitorStatus != nil { return true }
    return details.paymentDate.flatMap(accountSubscriptionDate) != nil
}

/// 한 행에 그릴 보조 줄.
struct TeamClaudeRowLines: Equatable {
    var reason: Bool
    var subscription: Bool

    static let full = TeamClaudeRowLines(reason: true, subscription: true)
    static let compact = TeamClaudeRowLines(reason: false, subscription: false)
}

/// 행 기하. 세 줄 다 있을 때 70pt + 간격 2pt = 72pt로, 보조 줄이 생기기 전 고정 행 높이와 같다.
enum TeamClaudeRowMetrics {
    static let nameHeight: CGFloat = 28
    static let reasonHeight: CGFloat = 20
    static let subscriptionHeight: CGFloat = 22
    static let gap: CGFloat = 2
    /// 이름 줄 아래 첫 보조 줄이 시작하는 y.
    static let firstLineY: CGFloat = 27
}

func teamClaudeRowHeight(_ lines: TeamClaudeRowLines) -> CGFloat {
    TeamClaudeRowMetrics.nameHeight
        + (lines.reason ? TeamClaudeRowMetrics.reasonHeight : 0)
        + (lines.subscription ? TeamClaudeRowMetrics.subscriptionHeight : 0)
}

func teamClaudeRowStride(_ lines: TeamClaudeRowLines) -> CGFloat {
    teamClaudeRowHeight(lines) + TeamClaudeRowMetrics.gap
}

/// 행 원점 기준 사유 텍스트 y. 그리지 않으면 nil.
func teamClaudeReasonLineY(_ lines: TeamClaudeRowLines) -> CGFloat? {
    lines.reason ? TeamClaudeRowMetrics.firstLineY : nil
}

/// 행 원점 기준 구독 버튼 y. 사유 줄이 빠지면 그 자리로 올라온다.
func teamClaudeSubscriptionLineY(_ lines: TeamClaudeRowLines) -> CGFloat? {
    guard lines.subscription else { return nil }
    return TeamClaudeRowMetrics.firstLineY + (lines.reason ? TeamClaudeRowMetrics.reasonHeight : 0)
}

/// 표 첫 행 기준 각 행의 원점 y. 마지막 원소 뒤에 총 높이가 하나 더 붙는다(count + 1개).
func teamClaudeRowOrigins(_ rows: [TeamClaudeRowLines]) -> [CGFloat] {
    var origins: [CGFloat] = [0]
    for lines in rows { origins.append(origins[origins.count - 1] + teamClaudeRowStride(lines)) }
    return origins
}

func teamClaudeRowsHeight(_ rows: [TeamClaudeRowLines]) -> CGFloat {
    rows.reduce(0) { $0 + teamClaudeRowStride($1) }
}
