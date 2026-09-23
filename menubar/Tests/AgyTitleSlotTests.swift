// menubar/Tests/AgyTitleSlotTests.swift
import Foundation

@main
struct AgyTitleSlotTests {
    static func main() {
        func bucket(_ remaining: Double) -> AgyQuotaBucket {
            AgyQuotaBucket(remaining: remaining, resetAt: nil)
        }

        // 제목에는 우리가 쓰는 레인(Gemini)의 주간 잔량만 올린다 — 같은 계정의 Claude·GPT 한도는 빼고.
        let twoGroups = AgyCardModel(message: nil, groups: [
            AgyQuotaGroup(name: "Gemini Models", weekly: bucket(0.988), fiveHour: bucket(1.0)),
            AgyQuotaGroup(name: "Claude and GPT models", weekly: bucket(0.306), fiveHour: bucket(1.0)),
        ])
        precondition(agyTitleSlot(twoGroups) == "Agy 99%", agyTitleSlot(twoGroups) ?? "nil")

        // 순서가 바뀌어도 Gemini를 찾아 쓴다.
        let reversed = AgyCardModel(message: nil, groups: [
            AgyQuotaGroup(name: "Claude and GPT models", weekly: bucket(0.306), fiveHour: bucket(1.0)),
            AgyQuotaGroup(name: "Gemini Models", weekly: bucket(0.5), fiveHour: bucket(1.0)),
        ])
        precondition(agyTitleSlot(reversed) == "Agy 50%", agyTitleSlot(reversed) ?? "nil")

        // Gemini 그룹이 없으면 제목에 아무것도 넣지 않는다(Claude·GPT 숫자로 대신하지 않는다).
        let noGemini = AgyCardModel(message: nil, groups: [
            AgyQuotaGroup(name: "Claude and GPT models", weekly: bucket(0.07), fiveHour: bucket(1.0)),
        ])
        precondition(agyTitleSlot(noGemini) == nil, agyTitleSlot(noGemini) ?? "nil")

        // Gemini가 있어도 주간 버킷이 없으면 비워 둔다(5시간 값으로 대신하지 않는다).
        let fiveHourOnly = AgyCardModel(message: nil, groups: [
            AgyQuotaGroup(name: "Gemini Models", weekly: nil, fiveHour: bucket(1.0)),
        ])
        precondition(agyTitleSlot(fiveHourOnly) == nil, agyTitleSlot(fiveHourOnly) ?? "nil")

        // 데이터가 없거나 메시지만 있는 카드도 제목을 차지하지 않는다.
        precondition(agyTitleSlot(AgyCardModel(message: nil, groups: [])) == nil)
        precondition(agyTitleSlot(AgyCardModel(message: "agy 확인 필요", groups: [])) == nil)

        print("AgyTitleSlotTests: Gemini-only title slot, order independence, missing group/weekly, empty passed")
    }
}
