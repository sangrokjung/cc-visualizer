// menubar/Tests/AgyTitleSlotTests.swift
import Foundation

@main
struct AgyTitleSlotTests {
    static func main() {
        func bucket(_ remaining: Double) -> AgyQuotaBucket {
            AgyQuotaBucket(remaining: remaining, resetAt: nil)
        }

        // 그룹 순서대로 주간 잔량만, 반올림한 정수 퍼센트로.
        let twoGroups = AgyCardModel(message: nil, groups: [
            AgyQuotaGroup(name: "Gemini Models", weekly: bucket(0.99), fiveHour: bucket(1.0)),
            AgyQuotaGroup(name: "Claude and GPT models", weekly: bucket(0.314), fiveHour: bucket(1.0)),
        ])
        precondition(agyTitleSlot(twoGroups) == "Agy 99/31%", agyTitleSlot(twoGroups) ?? "nil")

        let oneGroup = AgyCardModel(message: nil, groups: [
            AgyQuotaGroup(name: "Gemini Models", weekly: bucket(0.5), fiveHour: nil),
        ])
        precondition(agyTitleSlot(oneGroup) == "Agy 50%", agyTitleSlot(oneGroup) ?? "nil")

        // 주간 버킷이 없는 그룹은 건너뛴다(5시간만 있는 그룹으로 제목을 채우지 않는다).
        let fiveHourOnly = AgyCardModel(message: nil, groups: [
            AgyQuotaGroup(name: "Gemini Models", weekly: nil, fiveHour: bucket(1.0)),
            AgyQuotaGroup(name: "Claude and GPT models", weekly: bucket(0.07), fiveHour: bucket(1.0)),
        ])
        precondition(agyTitleSlot(fiveHourOnly) == "Agy 7%", agyTitleSlot(fiveHourOnly) ?? "nil")

        // 데이터가 없으면 제목에 아무것도 넣지 않는다 — "agy 확인 필요" 같은 메시지 카드도 마찬가지.
        precondition(agyTitleSlot(AgyCardModel(message: nil, groups: [])) == nil)
        precondition(agyTitleSlot(AgyCardModel(message: "agy 확인 필요", groups: [])) == nil)
        precondition(agyTitleSlot(AgyCardModel(message: nil, groups: [
            AgyQuotaGroup(name: "Gemini Models", weekly: nil, fiveHour: nil),
        ])) == nil)

        print("AgyTitleSlotTests: title slot for two groups, one group, missing weekly, empty passed")
    }
}
