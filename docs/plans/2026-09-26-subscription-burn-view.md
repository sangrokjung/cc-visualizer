# 구독 지출·한도 소진 전망 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메뉴바 대시보드에 "월 얼마가 나가고 각 서비스가 주간 한도를 다 쓰는가"를 답하는 섹션을 더한다.

**Architecture:** 계산과 그리기를 분리한다. 순수 함수 네 개(이력 경계 감지·전망·판정·단가 읽기)를 `main.swift` 밖 파일에 두고, 뷰는 그 결과만 그린다. `main.swift`는 `-parse-as-library` 테스트 바이너리에 들어가지 못하므로 계산이 거기 있으면 단위 테스트가 불가능하다. 이력은 이미 도는 60초 폴링에 얹어 쌓고 새 프로세스를 만들지 않는다.

**Tech Stack:** Swift 5 / AppKit (native macOS 메뉴바 데몬), swiftc 직접 컴파일(SwiftPM 아님), 테스트는 `@main struct …Tests` + Python 소스 배선 테스트.

**Spec:** `docs/specs/2026-09-26-subscription-burn-view.md`

## Global Constraints

- 금액을 추정하지 않는다. 단가가 없으면 `미입력`이다.
- 새 색을 만들지 않는다. 기존 팔레트 의미를 쓴다(녹=정상, 황=주의, 적=오류, 회=중립).
- 빈 값 표현은 `StatusVocabulary`를 쓴다. 새 표현을 만들지 않는다.
- 판정은 주간과 세션 중 **사용률이 높은 쪽**으로 한다.
- 목표 사용률은 **1.0**이다.
- `blockedMoments > 0`이면 전망과 무관하게 `부족`이다.
- 데몬 공백 주기(`complete: false`)는 평균에서 제외한다.
- 권고는 기여하지 않는 계정을 먼저 말하고 계정 수 조정을 나중에 말한다.
- 이 저장소는 공개다. 코드·주석·커밋에 호스트명·머신명·실제 이메일·내부 절대경로를 넣지 않는다.
- 로컬에서 `swiftc`·`build.sh`·`run-tests.sh`를 직접 실행하지 않는다. 워커 경유만 쓴다(각 Task의 실행 명령 참조).
- Python 배선 테스트 클래스는 `test_dashboard_wiring.py`의 `if __name__ == "__main__"` 블록 **위에** 둔다. 러너가 `python3 <파일>`로 실행하므로 그 아래 정의는 수집되지 않는다.
- 주석은 한국어로 "왜"를 적는다.

## Review Focus

다섯 가지 입력이 스펙에 암시돼 있으나 본문이 명시하지 않는다. 각 줄의 테스트를 해당 Task에 넣었다.

1. **리셋 시각이 이미 지난 계정** — `unified7dReset`이 과거면 경과율이 1을 넘거나 음수가 된다. 전망이 0으로 나누거나 폭주하지 않고 `측정 전`으로 떨어져야 한다. (Task 2)
2. **기여 계정 0** — 전 계정이 오류면 평균의 분모가 0이다. 나눗셈이 터지지 않고 판정이 `측정 전`이어야 한다. (Task 3)
3. **이력 파일 손상·다른 버전** — 깨진 JSON이나 `version: 2`를 만나도 앱이 죽지 않고 빈 이력으로 떨어져야 한다. (Task 1)
4. **단가 설정의 비정상 값** — 음수·문자열·거대값이 들어와도 금액 표시가 깨지지 않아야 한다. 음수와 비숫자는 `미입력`으로 본다. (Task 4)
5. **시계 되감김** — NTP 조정으로 `endedAt`이 미래가 되면 주기 경계를 오탐한다. 미래 종료 시각을 가진 주기는 기록하지 않아야 한다. (Task 1)

---

### Task 1: 이력 저장과 주기 경계 감지

**Files:**
- Create: `menubar/Sources/QuotaHistory.swift`
- Test: `menubar/Tests/QuotaHistoryTests.swift`

**Interfaces:**
- Consumes: 없음(첫 Task)
- Produces:
  - `struct QuotaCycle: Equatable` — `lane: String`, `window: String`, `endedAt: Date`, `contributing: Int`, `paid: Int`, `meanUtilization: Double`, `maxUtilization: Double`, `exhaustedAccounts: Int`, `blockedMoments: Int`, `complete: Bool`
  - `struct QuotaObservation: Equatable` — `lane: String`, `window: String`, `resetAt: Date?`, `contributing: Int`, `paid: Int`, `meanUtilization: Double`, `maxUtilization: Double`, `exhaustedAccounts: Int`, `blocked: Bool`
  - `func quotaCycleBoundary(previous: QuotaObservation?, current: QuotaObservation, now: Date) -> QuotaCycle?`
  - `func quotaDropBoundary(previous: QuotaObservation?, current: QuotaObservation, now: Date) -> QuotaCycle?`
  - `let quotaResetDropThreshold: Double` (= 0.2)
  - `func quotaHistoryDecode(_ data: Data) -> [QuotaCycle]`
  - `func quotaHistoryEncode(_ cycles: [QuotaCycle]) -> Data?`
  - `func quotaHistoryTrimmed(_ cycles: [QuotaCycle], keepPerLane: Int = 32) -> [QuotaCycle]`
  - `let quotaHistoryURL: URL`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`menubar/Tests/QuotaHistoryTests.swift`:

```swift
// menubar/Tests/QuotaHistoryTests.swift
import Foundation

@main
struct QuotaHistoryTests {
    static func main() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        func obs(_ reset: Date?, mean: Double = 0.5, blocked: Bool = false,
                 contributing: Int = 7, paid: Int = 17) -> QuotaObservation {
            QuotaObservation(lane: "claude", window: "7d", resetAt: reset,
                             contributing: contributing, paid: paid,
                             meanUtilization: mean, maxUtilization: mean,
                             exhaustedAccounts: 0, blocked: blocked)
        }

        // 리셋 시각이 그대로면 아직 같은 주기다.
        let reset = now.addingTimeInterval(3600)
        precondition(quotaCycleBoundary(previous: obs(reset), current: obs(reset), now: now) == nil)

        // 리셋 시각이 바뀌면 직전 주기를 확정한다. 확정값은 '이전' 관측이다.
        let moved = now.addingTimeInterval(7 * 86_400)
        let closed = quotaCycleBoundary(previous: obs(reset, mean: 0.82), current: obs(moved), now: now)
        precondition(closed?.meanUtilization == 0.82, "확정은 직전 주기의 값이어야 한다")
        precondition(closed?.contributing == 7 && closed?.paid == 17, "분모를 함께 남긴다")
        precondition(closed?.complete == true)

        // 이전 관측이 없으면(기동 직후) 확정할 주기가 없다.
        precondition(quotaCycleBoundary(previous: nil, current: obs(moved), now: now) == nil)

        // Review Focus 5: 시계 되감김으로 종료 시각이 미래면 기록하지 않는다.
        let future = now.addingTimeInterval(86_400)
        precondition(quotaCycleBoundary(previous: obs(future, mean: 0.5), current: obs(moved), now: now) == nil,
                     "미래 종료 시각을 가진 주기는 기록하지 않는다")

        // Review Focus 3: 깨진 JSON과 다른 버전은 빈 이력이다.
        precondition(quotaHistoryDecode(Data("not json".utf8)).isEmpty)
        precondition(quotaHistoryDecode(Data(#"{"version":2,"cycles":[]}"#.utf8)).isEmpty)

        // 왕복이 값을 보존한다.
        let cycle = QuotaCycle(lane: "codex", window: "7d", endedAt: now, contributing: 7, paid: 7,
                               meanUtilization: 0.73, maxUtilization: 1.0,
                               exhaustedAccounts: 2, blockedMoments: 0, complete: true)
        let encoded = quotaHistoryEncode([cycle])
        precondition(encoded != nil)
        precondition(quotaHistoryDecode(encoded!) == [cycle])

        // 보관은 레인·창 조합마다 센다. 한 레인이 많다고 다른 레인이 밀리지 않는다.
        let many = (0..<40).map { i in
            QuotaCycle(lane: "claude", window: "7d", endedAt: now.addingTimeInterval(Double(i) * 86_400),
                       contributing: 1, paid: 1, meanUtilization: 0.1, maxUtilization: 0.1,
                       exhaustedAccounts: 0, blockedMoments: 0, complete: true)
        }
        let trimmed = quotaHistoryTrimmed(many + [cycle], keepPerLane: 32)
        precondition(trimmed.filter { $0.lane == "claude" }.count == 32)
        precondition(trimmed.contains(cycle), "다른 레인은 밀려나지 않는다")
        // 남는 것은 최신 쪽이다.
        precondition(trimmed.filter { $0.lane == "claude" }.allSatisfy {
            $0.endedAt >= now.addingTimeInterval(8 * 86_400)
        })

        // Grok은 리셋 시각을 주지 않는다. 사용률이 크게 떨어지는 순간을 경계로 본다.
        func grok(_ mean: Double) -> QuotaObservation {
            QuotaObservation(lane: "grok", window: "7d", resetAt: nil, contributing: 1, paid: 1,
                             meanUtilization: mean, maxUtilization: mean,
                             exhaustedAccounts: 0, blocked: false)
        }
        // 정상 증가는 경계가 아니다.
        precondition(quotaDropBoundary(previous: grok(0.29), current: grok(0.31), now: now) == nil)
        // 잔잔한 하락도 경계가 아니다(잡음).
        precondition(quotaDropBoundary(previous: grok(0.29), current: grok(0.20), now: now) == nil)
        // 20%p 이상 떨어지면 리셋으로 본다. 확정값은 떨어지기 직전 값이다.
        let dropped = quotaDropBoundary(previous: grok(0.95), current: grok(0.02), now: now)
        precondition(dropped?.meanUtilization == 0.95, "\(String(describing: dropped))")
        precondition(dropped?.endedAt == now, "경계 시각은 관측 시각이다 — 리셋 시각을 모른다")
        precondition(dropped?.complete == true)
        // 이전 관측이 없으면 경계를 모른다.
        precondition(quotaDropBoundary(previous: nil, current: grok(0.02), now: now) == nil)

        print("QuotaHistoryTests: 통과")
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t1-red -- \
  bash -c 'cd $PWD; bash menubar/build.sh 2>&1 | grep -E "QuotaHistoryTests|error:" | head -5'
```
Expected: `error: cannot find 'QuotaObservation' in scope`

- [ ] **Step 3: 최소 구현을 쓴다**

`menubar/Sources/QuotaHistory.swift`:

```swift
import Foundation

// 주기 단위 요약만 쌓는다. 60초 폴링 값을 모두 남길 이유가 없다 —
// 판정에 필요한 것은 "지난 주기에 실제로 몇 % 썼나" 하나다.
//
// 분모(contributing)를 반드시 함께 남긴다. 계정 7개가 살아 있을 때의 82%와
// 15개일 때의 82%는 소비량이 두 배 차이라, 분모가 없으면 이력끼리 비교할 수 없다.

struct QuotaCycle: Equatable, Codable {
    let lane: String
    let window: String
    let endedAt: Date
    let contributing: Int
    let paid: Int
    let meanUtilization: Double
    let maxUtilization: Double
    let exhaustedAccounts: Int
    let blockedMoments: Int
    let complete: Bool
}

/// 폴링 한 번의 관측. 주기가 넘어갈 때 직전 관측이 그대로 한 주기가 된다.
struct QuotaObservation: Equatable {
    let lane: String
    let window: String
    let resetAt: Date?
    let contributing: Int
    let paid: Int
    let meanUtilization: Double
    let maxUtilization: Double
    let exhaustedAccounts: Int
    let blocked: Bool
}

/// 리셋 시각이 바뀌는 순간이 주기가 넘어간 순간이다. 그때 직전 주기를 확정한다.
///
/// 확정값은 **직전 관측**이다. 현재 관측은 이미 새 주기의 것이라 쓰면 안 된다.
func quotaCycleBoundary(previous: QuotaObservation?, current: QuotaObservation,
                        now: Date) -> QuotaCycle? {
    guard let previous,
          previous.lane == current.lane, previous.window == current.window,
          let previousReset = previous.resetAt, let currentReset = current.resetAt,
          previousReset != currentReset else {
        return nil
    }
    // 시계가 되감기면 종료 시각이 미래가 된다. 그런 주기는 기록하지 않는다 —
    // 잘못된 시각이 이력에 섞이면 평균이 오염되고 되돌릴 방법이 없다.
    guard previousReset <= now else { return nil }
    return QuotaCycle(
        lane: previous.lane, window: previous.window, endedAt: previousReset,
        contributing: previous.contributing, paid: previous.paid,
        meanUtilization: previous.meanUtilization, maxUtilization: previous.maxUtilization,
        exhaustedAccounts: previous.exhaustedAccounts,
        blockedMoments: previous.blocked ? 1 : 0, complete: true
    )
}

private struct QuotaHistoryFile: Codable {
    let version: Int
    let cycles: [QuotaCycle]
}

var quotaHistoryURL: URL {
    URL(fileURLWithPath: NSHomeDirectory())
        .appendingPathComponent(".codex/cache/cc-menubar-quota-history-v1.json")
}

/// 읽기는 절대 던지지 않는다. 파일이 깨져도 앱이 죽는 것보다 이력을 잃는 편이 낫다.
func quotaHistoryDecode(_ data: Data) -> [QuotaCycle] {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    guard let file = try? decoder.decode(QuotaHistoryFile.self, from: data),
          file.version == 1 else {
        return []
    }
    return file.cycles
}

func quotaHistoryEncode(_ cycles: [QuotaCycle]) -> Data? {
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    return try? encoder.encode(QuotaHistoryFile(version: 1, cycles: cycles))
}

/// 리셋 시각을 주지 않는 레인(Grok)의 주기 경계.
///
/// 사용률은 주기 안에서 단조 증가하다 리셋에서만 떨어진다. 그래서 큰 하락은 리셋이다.
/// 20%p는 관측 간격(60초) 동안 정상 사용으로 도달하기 어려운 폭이라 잡음과 구분된다.
/// 리셋 시각을 모르므로 종료 시각은 관측 시각으로 둔다. 추정이라는 사실은 화면이 표시한다.
let quotaResetDropThreshold: Double = 0.2

func quotaDropBoundary(previous: QuotaObservation?, current: QuotaObservation,
                       now: Date) -> QuotaCycle? {
    guard let previous,
          previous.lane == current.lane, previous.window == current.window,
          previous.meanUtilization - current.meanUtilization >= quotaResetDropThreshold else {
        return nil
    }
    return QuotaCycle(
        lane: previous.lane, window: previous.window, endedAt: now,
        contributing: previous.contributing, paid: previous.paid,
        meanUtilization: previous.meanUtilization, maxUtilization: previous.maxUtilization,
        exhaustedAccounts: previous.exhaustedAccounts,
        blockedMoments: previous.blocked ? 1 : 0, complete: true
    )
}

/// 보관은 레인·창 조합마다 센다. 한 레인이 오래 돌았다고 다른 레인의 이력이 밀리면
/// 그 레인은 영원히 판정할 수 없다.
func quotaHistoryTrimmed(_ cycles: [QuotaCycle], keepPerLane: Int = 32) -> [QuotaCycle] {
    var kept: [String: [QuotaCycle]] = [:]
    for cycle in cycles.sorted(by: { $0.endedAt < $1.endedAt }) {
        kept["\(cycle.lane)/\(cycle.window)", default: []].append(cycle)
    }
    return kept.values.flatMap { $0.suffix(keepPerLane) }.sorted { $0.endedAt < $1.endedAt }
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t1-green -- \
  bash -c 'cd $PWD; bash menubar/build.sh > /tmp/t1.log 2>&1; echo "RC=$?"; grep -E "menubar tests:|✗|error:" /tmp/t1.log | head -5'
```
Expected: `RC=0`, `failed=0`

- [ ] **Step 5: 커밋한다**

```bash
git add menubar/Sources/QuotaHistory.swift menubar/Tests/QuotaHistoryTests.swift
git commit -m "feat(menubar): 주기 단위 쿼터 이력과 경계 감지"
```

---

### Task 2: 전망 계산

**Files:**
- Create: `menubar/Sources/BurnProjection.swift`
- Test: `menubar/Tests/BurnProjectionTests.swift`

**Interfaces:**
- Consumes: `QuotaCycle` (Task 1)
- Produces:
  - `enum BurnBasis: Equatable` — `.history(cycles: Int)`, `.extrapolation(confidence: BurnConfidence)`, `.collecting`, `.unmeasured`
  - `enum BurnConfidence: Equatable` — `.low`, `.normal`
  - `struct BurnProjection: Equatable` — `current: Double?`, `projected: Double?`, `range: ClosedRange<Double>?`, `basis: BurnBasis`
  - `func burnElapsedRatio(windowSeconds: Double, resetAt: Date?, now: Date) -> Double?`
  - `func burnProject(current: Double?, windowSeconds: Double, resetAt: Date?, history: [QuotaCycle], now: Date) -> BurnProjection`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`menubar/Tests/BurnProjectionTests.swift`:

```swift
// menubar/Tests/BurnProjectionTests.swift
import Foundation

@main
struct BurnProjectionTests {
    static func main() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let week: Double = 7 * 86_400

        // 절반 지났으면 경과율 0.5다.
        let half = burnElapsedRatio(windowSeconds: week, resetAt: now.addingTimeInterval(week / 2), now: now)
        precondition(half != nil && abs(half! - 0.5) < 0.001, "\(String(describing: half))")

        // Review Focus 1: 리셋이 이미 지났으면 경과율을 내지 않는다.
        precondition(burnElapsedRatio(windowSeconds: week, resetAt: now.addingTimeInterval(-60), now: now) == nil)
        precondition(burnElapsedRatio(windowSeconds: week, resetAt: nil, now: now) == nil)
        // 리셋이 창 길이보다 멀면(서버 오류) 경과율을 내지 않는다.
        precondition(burnElapsedRatio(windowSeconds: week, resetAt: now.addingTimeInterval(week * 2), now: now) == nil)

        // 이력이 없으면 외삽한다: 0.41 ÷ 0.5 = 0.82
        let extrapolated = burnProject(current: 0.41, windowSeconds: week,
                                       resetAt: now.addingTimeInterval(week / 2), history: [], now: now)
        precondition(abs((extrapolated.projected ?? 0) - 0.82) < 0.001, "\(String(describing: extrapolated.projected))")
        precondition(extrapolated.basis == .extrapolation(confidence: .normal))

        // 주기 초반이면 신뢰가 낮다고 말한다.
        let early = burnProject(current: 0.05, windowSeconds: week,
                                resetAt: now.addingTimeInterval(week * 0.8), history: [], now: now)
        precondition(early.basis == .extrapolation(confidence: .low))

        // Review Focus 1: 리셋이 지났으면 전망을 내지 않는다(0으로 나누지 않는다).
        let stale = burnProject(current: 0.9, windowSeconds: week,
                                resetAt: now.addingTimeInterval(-60), history: [], now: now)
        precondition(stale.projected == nil && stale.basis == .unmeasured)

        // 완료 주기 2개 이상이면 과거 평균을 쓰고 범위를 함께 낸다.
        func cycle(_ mean: Double, complete: Bool = true, day: Double) -> QuotaCycle {
            QuotaCycle(lane: "claude", window: "7d", endedAt: now.addingTimeInterval(-day * 86_400),
                       contributing: 7, paid: 17, meanUtilization: mean, maxUtilization: mean,
                       exhaustedAccounts: 0, blockedMoments: 0, complete: complete)
        }
        let withHistory = burnProject(current: 0.4, windowSeconds: week,
                                      resetAt: now.addingTimeInterval(week / 2),
                                      history: [cycle(0.61, day: 14), cycle(0.97, day: 7)], now: now)
        precondition(abs((withHistory.projected ?? 0) - 0.79) < 0.001, "\(String(describing: withHistory.projected))")
        precondition(withHistory.range?.lowerBound == 0.61 && withHistory.range?.upperBound == 0.97)
        precondition(withHistory.basis == .history(cycles: 2))

        // 불완전 주기는 평균에서 뺀다. 두 개 중 하나가 불완전하면 이력이 모자라 외삽으로 돌아간다.
        let partial = burnProject(current: 0.41, windowSeconds: week,
                                  resetAt: now.addingTimeInterval(week / 2),
                                  history: [cycle(0.61, complete: false, day: 14), cycle(0.97, day: 7)], now: now)
        precondition(partial.basis == .extrapolation(confidence: .normal), "\(partial.basis)")

        // 현재 값이 없으면 수집 중이다(Grok처럼 창을 모르는 레인).
        let none = burnProject(current: nil, windowSeconds: week, resetAt: nil, history: [], now: now)
        precondition(none.basis == .collecting)

        print("BurnProjectionTests: 통과")
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t2-red -- \
  bash -c 'cd $PWD; bash menubar/build.sh 2>&1 | grep -E "BurnProjectionTests|error:" | head -5'
```
Expected: `error: cannot find 'burnElapsedRatio' in scope`

- [ ] **Step 3: 최소 구현을 쓴다**

`menubar/Sources/BurnProjection.swift`:

```swift
import Foundation

// 전망은 두 근거 중 하나로 낸다. 완료 주기가 둘 이상이면 과거 평균이고,
// 그 전까지는 현재 주기를 선형 외삽한다. 외삽임을 화면이 숨기지 않는다.

enum BurnConfidence: Equatable { case low, normal }

enum BurnBasis: Equatable {
    case history(cycles: Int)
    case extrapolation(confidence: BurnConfidence)
    /// 주기 경계를 아직 모른다(리셋 시각을 주지 않는 레인).
    case collecting
    /// 잴 수 없다(리셋이 이미 지났거나 값이 없다).
    case unmeasured
}

struct BurnProjection: Equatable {
    let current: Double?
    let projected: Double?
    /// 과거 주기들의 최소~최대. 평균만 보면 "매주 딱 맞다"로 읽힌다.
    let range: ClosedRange<Double>?
    let basis: BurnBasis
}

/// 경과율 30% 미만이면 외삽을 믿기 어렵다.
let burnLowConfidenceRatio: Double = 0.3

/// 주기가 얼마나 지났는가. 0으로 나누지 않도록 경계를 모두 막는다.
func burnElapsedRatio(windowSeconds: Double, resetAt: Date?, now: Date) -> Double? {
    guard windowSeconds > 0, let resetAt else { return nil }
    let remaining = resetAt.timeIntervalSince(now)
    // 이미 지난 리셋과, 창 길이보다 먼 리셋은 둘 다 신뢰할 수 없는 입력이다.
    guard remaining > 0, remaining <= windowSeconds else { return nil }
    let elapsed = (windowSeconds - remaining) / windowSeconds
    return elapsed > 0 ? elapsed : nil
}

func burnProject(current: Double?, windowSeconds: Double, resetAt: Date?,
                 history: [QuotaCycle], now: Date) -> BurnProjection {
    let complete = history.filter { $0.complete }
    if complete.count >= 2 {
        let means = complete.map { $0.meanUtilization }
        let mean = means.reduce(0, +) / Double(means.count)
        return BurnProjection(current: current, projected: mean,
                              range: (means.min() ?? mean)...(means.max() ?? mean),
                              basis: .history(cycles: complete.count))
    }
    guard let current else {
        return BurnProjection(current: nil, projected: nil, range: nil, basis: .collecting)
    }
    guard let elapsed = burnElapsedRatio(windowSeconds: windowSeconds, resetAt: resetAt, now: now) else {
        return BurnProjection(current: current, projected: nil, range: nil, basis: .unmeasured)
    }
    return BurnProjection(
        current: current, projected: current / elapsed, range: nil,
        basis: .extrapolation(confidence: elapsed < burnLowConfidenceRatio ? .low : .normal)
    )
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t2-green -- \
  bash -c 'cd $PWD; bash menubar/build.sh > /tmp/t2.log 2>&1; echo "RC=$?"; grep -E "menubar tests:|✗|error:" /tmp/t2.log | head -5'
```
Expected: `RC=0`, `failed=0`

- [ ] **Step 5: 커밋한다**

```bash
git add menubar/Sources/BurnProjection.swift menubar/Tests/BurnProjectionTests.swift
git commit -m "feat(menubar): 한도 소진 전망 계산"
```

---

### Task 3: 판정과 권고

**Files:**
- Create: `menubar/Sources/SubscriptionPolicy.swift`
- Test: `menubar/Tests/SubscriptionPolicyTests.swift`

**Interfaces:**
- Consumes: `BurnProjection`, `BurnBasis` (Task 2)
- Produces:
  - `enum BurnVerdict: Equatable` — `.blocked`, `.onTarget`, `.near`, `.slack`, `.excess`, `.unknown`
  - `struct LaneUsage: Equatable` — `lane: String`, `paidAccounts: Int`, `contributingAccounts: Int`, `errorAccounts: Int`, `disabledAccounts: Int`, `weekly: BurnProjection`, `session: BurnProjection`, `blockedMoments: Int`
  - `func burnVerdict(_ usage: LaneUsage) -> BurnVerdict`
  - `func burnBindingProjection(_ usage: LaneUsage) -> BurnProjection`
  - `func burnNeededAccounts(_ usage: LaneUsage) -> Int?`
  - `func burnRecommendations(_ usages: [LaneUsage]) -> [String]`
  - `let burnTargetUtilization: Double` (= 1.0)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`menubar/Tests/SubscriptionPolicyTests.swift`:

```swift
// menubar/Tests/SubscriptionPolicyTests.swift
import Foundation

@main
struct SubscriptionPolicyTests {
    static func main() {
        func projection(_ value: Double?) -> BurnProjection {
            BurnProjection(current: value, projected: value, range: nil,
                           basis: .extrapolation(confidence: .normal))
        }
        func usage(lane: String = "claude", paid: Int = 17, contributing: Int = 7,
                   error: Int = 6, disabled: Int = 4,
                   weekly: Double? = 0.82, session: Double? = 0.11,
                   blocked: Int = 0) -> LaneUsage {
            LaneUsage(lane: lane, paidAccounts: paid, contributingAccounts: contributing,
                      errorAccounts: error, disabledAccounts: disabled,
                      weekly: projection(weekly), session: projection(session),
                      blockedMoments: blocked)
        }

        // 병목은 높은 쪽이다. 세션 11%로 판정하면 "한참 여유"라는 틀린 답이 나온다.
        precondition(burnBindingProjection(usage()).projected == 0.82)

        // 막힌 적이 있으면 전망과 무관하게 부족이다.
        precondition(burnVerdict(usage(weekly: 0.4, blocked: 2)) == .blocked)

        // 목표는 1.0이다. 넘겼고 막히지 않았으면 달성이다.
        precondition(burnVerdict(usage(weekly: 1.05)) == .onTarget)
        precondition(burnVerdict(usage(weekly: 0.9)) == .near)
        precondition(burnVerdict(usage(weekly: 0.7)) == .slack)
        precondition(burnVerdict(usage(weekly: 0.2)) == .excess)

        // 경계값을 못 박는다.
        precondition(burnVerdict(usage(weekly: 1.0)) == .onTarget)
        precondition(burnVerdict(usage(weekly: 0.85)) == .near)
        precondition(burnVerdict(usage(weekly: 0.6)) == .slack)

        // Review Focus 2: 기여 계정이 0이면 나눗셈이 터지지 않고 모른다고 말한다.
        let dead = usage(contributing: 0, error: 17, disabled: 0, weekly: nil, session: nil)
        precondition(burnVerdict(dead) == .unknown)
        precondition(burnNeededAccounts(dead) == nil)

        // 필요 계정 = 기여 × 사용률 ÷ 목표. 7 × 0.73 ≈ 5.1 → 올려서 6.
        precondition(burnNeededAccounts(usage(lane: "codex", paid: 7, contributing: 7,
                                              error: 0, disabled: 0, weekly: 0.73)) == 6)

        // 권고는 죽은 계정을 먼저 말한다. 순서를 뒤집으면 고칠 수 있는 문제에 돈을 쓰게 된다.
        let lines = burnRecommendations([usage(), usage(lane: "agy", paid: 1, contributing: 1,
                                                        error: 0, disabled: 0, weekly: 0.06)])
        precondition(lines.first?.contains("오류") == true, "\(lines)")
        precondition(lines.contains { $0.contains("agy") }, "\(lines)")

        // 모두 정상이면 권고가 없다. 할 말이 없을 때 지어내지 않는다.
        precondition(burnRecommendations([usage(paid: 7, contributing: 7, error: 0, disabled: 0,
                                                weekly: 0.95)]).isEmpty)

        print("SubscriptionPolicyTests: 통과")
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t3-red -- \
  bash -c 'cd $PWD; bash menubar/build.sh 2>&1 | grep -E "SubscriptionPolicyTests|error:" | head -5'
```
Expected: `error: cannot find 'burnVerdict' in scope`

- [ ] **Step 3: 최소 구현을 쓴다**

`menubar/Sources/SubscriptionPolicy.swift`:

```swift
import Foundation

// 목표 사용률은 1.0이다. 주간 한도를 남기지 않고 다 쓰는 것이 이 풀의 운영 목표다.
// 그래서 100% 도달은 실패가 아니라 달성이고, 진짜 부족은 한도 때문에 실제로 막힌 것이다.
let burnTargetUtilization: Double = 1.0

enum BurnVerdict: Equatable {
    case blocked    // 가용 0이 관측됨
    case onTarget   // 목표 달성
    case near       // 근접
    case slack      // 여유
    case excess     // 과다
    case unknown    // 잴 수 없음
}

struct LaneUsage: Equatable {
    let lane: String
    let paidAccounts: Int
    let contributingAccounts: Int
    let errorAccounts: Int
    let disabledAccounts: Int
    let weekly: BurnProjection
    let session: BurnProjection
    let blockedMoments: Int
}

/// 주간과 세션 중 사용률이 높은 쪽이 병목이고, 병목이 판정을 지배해야 한다.
func burnBindingProjection(_ usage: LaneUsage) -> BurnProjection {
    let weekly = usage.weekly.projected ?? -1
    let session = usage.session.projected ?? -1
    return session > weekly ? usage.session : usage.weekly
}

func burnVerdict(_ usage: LaneUsage) -> BurnVerdict {
    if usage.blockedMoments > 0 { return .blocked }
    guard let projected = burnBindingProjection(usage).projected else { return .unknown }
    if projected >= burnTargetUtilization { return .onTarget }
    if projected >= 0.85 { return .near }
    if projected >= 0.60 { return .slack }
    return .excess
}

/// 필요 계정 ≈ 기여 계정 × 평균 사용률 ÷ 목표 사용률. 소수는 올린다 —
/// 내리면 목표에 못 미치고, 이 화면의 목표는 다 쓰는 것이지 모자라는 것이 아니다.
func burnNeededAccounts(_ usage: LaneUsage) -> Int? {
    guard usage.contributingAccounts > 0,
          let projected = burnBindingProjection(usage).projected,
          burnTargetUtilization > 0 else {
        return nil
    }
    return max(1, Int(ceil(Double(usage.contributingAccounts) * projected / burnTargetUtilization)))
}

/// 권고는 순서를 지킨다. 기여하지 않는 계정을 먼저 말하고 계정 수 조정은 그다음이다.
/// 죽은 계정을 살리면 분모가 커져 사용률이 떨어지므로, 순서를 뒤집으면
/// 고칠 수 있는 문제에 돈을 쓰게 된다.
func burnRecommendations(_ usages: [LaneUsage]) -> [String] {
    var lines: [String] = []
    let errors = usages.reduce(0) { $0 + $1.errorAccounts }
    if errors > 0 { lines.append("오류 \(errors)개 재인증이 먼저") }
    let disabled = usages.reduce(0) { $0 + $1.disabledAccounts }
    if disabled > 0 { lines.append("꺼 둔 \(disabled)개 유지 여부 결정") }
    for usage in usages where burnVerdict(usage) == .excess {
        if usage.paidAccounts > 1, let needed = burnNeededAccounts(usage), needed < usage.contributingAccounts {
            lines.append("\(usage.lane) \(usage.contributingAccounts - needed)개 줄일 여지")
        } else if usage.paidAccounts == 1 {
            lines.append("\(usage.lane) 다운그레이드 검토")
        }
    }
    return lines
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t3-green -- \
  bash -c 'cd $PWD; bash menubar/build.sh > /tmp/t3.log 2>&1; echo "RC=$?"; grep -E "menubar tests:|✗|error:" /tmp/t3.log | head -5'
```
Expected: `RC=0`, `failed=0`

- [ ] **Step 5: 커밋한다**

```bash
git add menubar/Sources/SubscriptionPolicy.swift menubar/Tests/SubscriptionPolicyTests.swift
git commit -m "feat(menubar): 구독 판정과 권고 순서"
```

---

### Task 4: 단가 설정 읽기

**Files:**
- Create: `menubar/Sources/SubscriptionRates.swift`
- Modify: `menubar/Sources/AccountSubscription.swift:170` (`private final class AccountSubscriptionFileCache` → `final class`)
- Test: `menubar/Tests/SubscriptionRatesTests.swift`

기존 파일 캐시는 `private`이라 다른 파일에서 쓸 수 없다. 같은 mtime 캐시를 또 만들면 같은 버그를 두 벌 관리하게 되므로 접근 수준만 연다.

**Interfaces:**
- Consumes: `AccountSubscriptionFileCache` (기존, 접근 수준 변경)
- Produces:
  - `struct LaneRate: Equatable` — `plan: String?`, `monthly: Int?`
  - `func subscriptionRateParse(_ json: [String: Any]?) -> [String: LaneRate]`
  - `func subscriptionRates() -> [String: LaneRate]`
  - `func subscriptionMonthlyTotal(rates: [String: LaneRate], paidAccounts: [String: Int]) -> Int?`
  - `let subscriptionRatesURL: URL`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`menubar/Tests/SubscriptionRatesTests.swift`:

```swift
// menubar/Tests/SubscriptionRatesTests.swift
import Foundation

@main
struct SubscriptionRatesTests {
    static func main() {
        func parse(_ raw: String) -> [String: LaneRate] {
            let json = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any]
            return subscriptionRateParse(json ?? nil)
        }

        let ok = parse(#"{"version":1,"lanes":{"claude":{"plan":"Max 20x","monthly":280000}}}"#)
        precondition(ok["claude"]?.monthly == 280_000)
        precondition(ok["claude"]?.plan == "Max 20x")

        // 파일이 없거나 버전이 다르면 빈 표다. 금액을 추정하지 않는다.
        precondition(subscriptionRateParse(nil).isEmpty)
        precondition(parse(#"{"version":2,"lanes":{"claude":{"monthly":1}}}"#).isEmpty)

        // Review Focus 4: 비정상 값은 미입력으로 본다.
        let bad = parse("""
        {"version":1,"lanes":{
          "a":{"monthly":-5},
          "b":{"monthly":"많이"},
          "c":{"monthly":0},
          "d":{"plan":"Pro"}
        }}
        """)
        for lane in ["a", "b", "c", "d"] {
            precondition(bad[lane]?.monthly == nil, "\(lane)은 미입력이어야 한다")
        }
        precondition(bad["d"]?.plan == "Pro", "금액이 없어도 요금제 이름은 남긴다")

        // 합계는 단가 × 지불 계정 수다.
        let rates = parse(#"{"version":1,"lanes":{"claude":{"monthly":100},"agy":{"monthly":50}}}"#)
        precondition(subscriptionMonthlyTotal(rates: rates,
                                              paidAccounts: ["claude": 17, "agy": 1]) == 1_750)

        // 단가가 하나도 없으면 합계가 없다. 0원이라고 말하지 않는다.
        precondition(subscriptionMonthlyTotal(rates: [:], paidAccounts: ["claude": 17]) == nil)

        // 일부만 입력돼 있으면 입력된 것만 더하고, 합계는 낸다.
        let partial = parse(#"{"version":1,"lanes":{"claude":{"monthly":100}}}"#)
        precondition(subscriptionMonthlyTotal(rates: partial,
                                              paidAccounts: ["claude": 2, "agy": 1]) == 200)

        print("SubscriptionRatesTests: 통과")
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t4-red -- \
  bash -c 'cd $PWD; bash menubar/build.sh 2>&1 | grep -E "SubscriptionRatesTests|error:" | head -5'
```
Expected: `error: cannot find 'subscriptionRateParse' in scope`

- [ ] **Step 3: 최소 구현을 쓴다**

먼저 `menubar/Sources/AccountSubscription.swift:170`에서 `private`를 지운다:

```swift
final class AccountSubscriptionFileCache {
```

그리고 `menubar/Sources/SubscriptionRates.swift`:

```swift
import Foundation

// 단가는 사람이 적는다. 결제 시스템을 연동하지 않는다.
// 값이 없으면 "미입력"이고, 어떤 경우에도 금액을 추정하지 않는다 —
// 지어낸 금액으로 구독을 해지하는 판단을 하게 만들 수는 없다.

struct LaneRate: Equatable {
    let plan: String?
    /// 계정 1개당 월 금액. 없거나 비정상이면 nil이다.
    let monthly: Int?
}

var subscriptionRatesURL: URL {
    URL(fileURLWithPath: NSHomeDirectory())
        .appendingPathComponent(".config/cc-menubar-subscriptions.json")
}

func subscriptionRateParse(_ json: [String: Any]?) -> [String: LaneRate] {
    guard let json, (json["version"] as? Int) == 1,
          let lanes = json["lanes"] as? [String: Any] else {
        return [:]
    }
    var out: [String: LaneRate] = [:]
    for (lane, raw) in lanes {
        guard let row = raw as? [String: Any] else { continue }
        // 0과 음수는 "적지 않았다"로 본다. 숫자가 아닌 값도 마찬가지다.
        let monthly = (row["monthly"] as? NSNumber)?.intValue
        out[lane] = LaneRate(plan: row["plan"] as? String,
                             monthly: (monthly ?? 0) > 0 ? monthly : nil)
    }
    return out
}

func subscriptionRates() -> [String: LaneRate] {
    subscriptionRateParse(AccountSubscriptionFileCache.shared.json(at: subscriptionRatesURL))
}

/// 합계 = 레인별 단가 × 지불 계정 수. 단가가 하나도 없으면 합계도 없다(0원이 아니다).
func subscriptionMonthlyTotal(rates: [String: LaneRate], paidAccounts: [String: Int]) -> Int? {
    var total = 0
    var counted = false
    for (lane, rate) in rates {
        guard let monthly = rate.monthly else { continue }
        total += monthly * max(paidAccounts[lane] ?? 0, 0)
        counted = true
    }
    return counted ? total : nil
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t4-green -- \
  bash -c 'cd $PWD; bash menubar/build.sh > /tmp/t4.log 2>&1; echo "RC=$?"; grep -E "menubar tests:|✗|error:" /tmp/t4.log | head -5'
```
Expected: `RC=0`, `failed=0`

- [ ] **Step 5: 커밋한다**

```bash
git add menubar/Sources/SubscriptionRates.swift menubar/Sources/AccountSubscription.swift menubar/Tests/SubscriptionRatesTests.swift
git commit -m "feat(menubar): 구독 단가 설정 읽기"
```

---

### Task 5: 두 블록 그리기

**Files:**
- Create: `menubar/Sources/SubscriptionBurnView.swift`
- Test: `menubar/Tests/SubscriptionBurnLayoutTests.swift`

**Interfaces:**
- Consumes: `LaneUsage`, `BurnVerdict`, `LaneRate`, `BurnBasis`, `StatusVocabulary`
- Produces:
  - `struct SubscriptionBurnModel: Equatable` — `usages: [LaneUsage]`, `rates: [String: LaneRate]`, `recommendations: [String]`
  - `func burnProjectionLabel(_ projection: BurnProjection) -> String`
  - `func burnVerdictLabel(_ verdict: BurnVerdict) -> String`
  - `func burnAmountLabel(_ monthly: Int?, accounts: Int) -> String`
  - `final class SubscriptionBurnView: NSView` — `var model: SubscriptionBurnModel`, `static func preferredHeight(_ model: SubscriptionBurnModel) -> CGFloat`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`menubar/Tests/SubscriptionBurnLayoutTests.swift`:

```swift
// menubar/Tests/SubscriptionBurnLayoutTests.swift
import Foundation

@main
struct SubscriptionBurnLayoutTests {
    static func main() {
        // 금액은 입력됐을 때만 숫자다.
        precondition(burnAmountLabel(nil, accounts: 17) == "미입력")
        precondition(burnAmountLabel(280_000, accounts: 17) == "4,760,000")
        precondition(burnAmountLabel(280_000, accounts: 0) == "0")

        // 전망 표시는 근거를 함께 말한다.
        let extrapolated = BurnProjection(current: 0.82, projected: 1.12, range: nil,
                                          basis: .extrapolation(confidence: .normal))
        precondition(burnProjectionLabel(extrapolated).contains("82%"))
        precondition(burnProjectionLabel(extrapolated).contains("112%"))
        precondition(burnProjectionLabel(extrapolated).contains("추정"))

        let low = BurnProjection(current: 0.05, projected: 0.5, range: nil,
                                 basis: .extrapolation(confidence: .low))
        precondition(burnProjectionLabel(low).contains("신뢰 낮음"))

        let history = BurnProjection(current: 0.4, projected: 0.79, range: 0.61...0.97,
                                     basis: .history(cycles: 4))
        let label = burnProjectionLabel(history)
        precondition(label.contains("4주"), label)
        precondition(label.contains("61") && label.contains("97"), "범위를 함께 보인다: \(label)")

        precondition(burnProjectionLabel(
            BurnProjection(current: nil, projected: nil, range: nil, basis: .collecting)) == "수집 중")
        precondition(burnProjectionLabel(
            BurnProjection(current: 0.9, projected: nil, range: nil, basis: .unmeasured))
            == StatusVocabulary.notMeasured)

        // 판정 문구
        precondition(burnVerdictLabel(.blocked) == "부족")
        precondition(burnVerdictLabel(.onTarget) == "달성")
        precondition(burnVerdictLabel(.unknown) == StatusVocabulary.notMeasured)

        // 권고가 없으면 그 줄만큼 높이가 줄어든다. 할 말이 없을 때 빈 줄을 남기지 않는다.
        func model(_ lines: [String]) -> SubscriptionBurnModel {
            SubscriptionBurnModel(
                usages: [LaneUsage(lane: "claude", paidAccounts: 17, contributingAccounts: 7,
                                   errorAccounts: 6, disabledAccounts: 4,
                                   weekly: extrapolated, session: extrapolated, blockedMoments: 0)],
                rates: [:], recommendations: lines)
        }
        precondition(SubscriptionBurnView.preferredHeight(model([]))
                     < SubscriptionBurnView.preferredHeight(model(["오류 6개 재인증이 먼저"])))

        // 레인이 늘면 높이도 는다.
        let two = SubscriptionBurnModel(
            usages: model([]).usages + model([]).usages, rates: [:], recommendations: [])
        precondition(SubscriptionBurnView.preferredHeight(two) > SubscriptionBurnView.preferredHeight(model([])))

        print("SubscriptionBurnLayoutTests: 통과")
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t5-red -- \
  bash -c 'cd $PWD; bash menubar/build.sh 2>&1 | grep -E "SubscriptionBurnLayoutTests|error:" | head -5'
```
Expected: `error: cannot find 'burnAmountLabel' in scope`

- [ ] **Step 3: 최소 구현을 쓴다**

`menubar/Sources/SubscriptionBurnView.swift`:

```swift
import Cocoa

// 두 블록이 겹치지 않는다. 위는 합계와 새는 돈, 아래는 서비스별이다.
// 서비스 이름을 두 번 적지 않는 것이 이 대시보드의 규율이다.

struct SubscriptionBurnModel: Equatable {
    let usages: [LaneUsage]
    let rates: [String: LaneRate]
    let recommendations: [String]
}

private let burnNumberFormatter: NumberFormatter = {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    return formatter
}()

/// 단가가 없으면 숫자를 만들지 않는다.
func burnAmountLabel(_ monthly: Int?, accounts: Int) -> String {
    guard let monthly else { return "미입력" }
    let total = monthly * max(accounts, 0)
    return burnNumberFormatter.string(from: NSNumber(value: total)) ?? "\(total)"
}

private func burnPercent(_ value: Double) -> String { "\(Int((value * 100).rounded()))%" }

/// 전망은 근거를 함께 말한다. 근거를 숨기면 추정이 실측으로 읽힌다.
func burnProjectionLabel(_ projection: BurnProjection) -> String {
    switch projection.basis {
    case .collecting:
        return "수집 중"
    case .unmeasured:
        return StatusVocabulary.notMeasured
    case .history(let cycles):
        guard let projected = projection.projected else { return StatusVocabulary.notMeasured }
        let base = "최근 \(cycles)주 평균 \(burnPercent(projected))"
        guard let range = projection.range else { return base }
        return "\(base) · \(burnPercent(range.lowerBound))~\(burnPercent(range.upperBound))"
    case .extrapolation(let confidence):
        guard let current = projection.current, let projected = projection.projected else {
            return StatusVocabulary.notMeasured
        }
        let base = "\(burnPercent(current)) → \(burnPercent(projected)) 추정"
        return confidence == .low ? "\(base) · 신뢰 낮음" : base
    }
}

func burnVerdictLabel(_ verdict: BurnVerdict) -> String {
    switch verdict {
    case .blocked: return "부족"
    case .onTarget: return "달성"
    case .near: return "근접"
    case .slack: return "여유"
    case .excess: return "과다"
    case .unknown: return StatusVocabulary.notMeasured
    }
}

/// 색은 기존 팔레트 의미를 그대로 쓴다. 새 색을 만들면 같은 색이 두 가지를 뜻하게 된다.
func burnVerdictColor(_ verdict: BurnVerdict) -> NSColor {
    switch verdict {
    case .blocked: return TeamClaudePalette.red
    case .onTarget, .near: return TeamClaudePalette.green
    case .slack, .unknown: return TeamClaudePalette.muted
    case .excess: return TeamClaudePalette.yellow
    }
}

final class SubscriptionBurnView: NSView {
    static let spendHeight: CGFloat = 56
    static let headerHeight: CGFloat = 26
    static let rowHeight: CGFloat = 24
    static let recommendationHeight: CGFloat = 26
    static let blockGap: CGFloat = 8
    static let padding: CGFloat = 12

    static func preferredHeight(_ model: SubscriptionBurnModel) -> CGFloat {
        let rows = CGFloat(model.usages.count) * rowHeight
        let recommendations = model.recommendations.isEmpty ? 0 : recommendationHeight
        return spendHeight + blockGap + padding * 2 + headerHeight + rows + recommendations
    }

    var model = SubscriptionBurnModel(usages: [], rates: [:], recommendations: []) {
        didSet {
            guard model != oldValue else { return }
            setAccessibilityLabel(accessibilityText)
            needsDisplay = true
        }
    }

    override var isFlipped: Bool { true }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setAccessibilityElement(true)
        setAccessibilityRole(.group)
        setAccessibilityLabel(accessibilityText)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private var accessibilityText: String {
        let lanes = model.usages.map { usage in
            "\(usage.lane) \(usage.paidAccounts)계정 중 기여 \(usage.contributingAccounts), "
            + "\(burnProjectionLabel(burnBindingProjection(usage))), \(burnVerdictLabel(burnVerdict(usage)))"
        }
        return (["구독 지출과 한도 소진"] + lanes + model.recommendations).joined(separator: "; ")
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard bounds.width > 0 else { return }

        let panel = NSColor(calibratedRed: 0.095, green: 0.115, blue: 0.15, alpha: 1.0)
        let text = TeamClaudePalette.text
        let muted = TeamClaudePalette.muted
        let head = NSFont.systemFont(ofSize: 12, weight: .semibold)
        let body = NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .medium)
        let small = NSFont.systemFont(ofSize: 11, weight: .medium)

        func drawText(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
            (value as NSString).draw(at: NSPoint(x: x, y: y),
                                     withAttributes: [.font: font, .foregroundColor: color])
        }
        func drawRight(_ value: String, _ x: CGFloat, _ y: CGFloat, _ font: NSFont, _ color: NSColor) {
            let width = (value as NSString).size(withAttributes: [.font: font]).width
            drawText(value, x - width, y, font, color)
        }
        func fill(_ rect: NSRect) {
            let path = NSBezierPath(roundedRect: rect, xRadius: 8, yRadius: 8)
            panel.setFill()
            path.fill()
        }

        let inner = bounds.insetBy(dx: 8, dy: 0)
        let spend = NSRect(x: inner.minX, y: 0, width: inner.width, height: Self.spendHeight)
        fill(spend)

        let paidTotal = model.usages.reduce(0) { $0 + $1.paidAccounts }
        let idle = model.usages.reduce(0) { $0 + $1.errorAccounts + $1.disabledAccounts }
        let paidAccounts = Dictionary(model.usages.map { ($0.lane, $0.paidAccounts) },
                                      uniquingKeysWith: { a, _ in a })
        let total = subscriptionMonthlyTotal(rates: model.rates, paidAccounts: paidAccounts)

        drawText("월 합계", spend.minX + Self.padding, 12, head, muted)
        drawText(total.map { burnAmountLabel($0, accounts: 1) } ?? "미입력",
                 spend.minX + Self.padding + 64, 10, body, text)
        drawRight("기여 없는 계정 \(idle) / \(paidTotal)",
                  spend.maxX - Self.padding, 12, head, idle > 0 ? TeamClaudePalette.yellow : muted)

        let errors = model.usages.reduce(0) { $0 + $1.errorAccounts }
        let disabled = model.usages.reduce(0) { $0 + $1.disabledAccounts }
        drawText("오류 \(errors) · 복구 가능", spend.minX + Self.padding, 34, small, muted)
        drawText("꺼 둠 \(disabled) · 결정 필요", spend.minX + Self.padding + 160, 34, small, muted)

        let burnTop = Self.spendHeight + Self.blockGap
        let burn = NSRect(x: inner.minX, y: burnTop, width: inner.width,
                          height: bounds.height - burnTop)
        fill(burn)

        let columnLane = burn.minX + Self.padding
        let columnAccounts = burn.minX + 120
        let columnSpend = burn.minX + 260
        let columnBurn = burn.minX + 380
        let columnVerdict = burn.maxX - Self.padding

        var y = burnTop + Self.padding
        drawText("서비스", columnLane, y, head, muted)
        drawText("계정", columnAccounts, y, head, muted)
        drawText("월 지출", columnSpend, y, head, muted)
        drawText("주간 소진", columnBurn, y, head, muted)
        drawRight("판정", columnVerdict, y, head, muted)
        y += Self.headerHeight

        for usage in model.usages {
            let verdict = burnVerdict(usage)
            drawText(usage.lane, columnLane, y, body, text)
            let accounts = usage.paidAccounts == usage.contributingAccounts
                ? "\(usage.paidAccounts)"
                : "\(usage.paidAccounts) (\(usage.contributingAccounts))"
            drawText(accounts, columnAccounts, y, body, text)
            drawText(burnAmountLabel(model.rates[usage.lane]?.monthly, accounts: usage.paidAccounts),
                     columnSpend, y, body, model.rates[usage.lane]?.monthly == nil ? muted : text)
            drawText(burnProjectionLabel(burnBindingProjection(usage)), columnBurn, y, small, muted)
            drawRight(burnVerdictLabel(verdict), columnVerdict, y, body, burnVerdictColor(verdict))
            y += Self.rowHeight
        }

        if !model.recommendations.isEmpty {
            drawText(model.recommendations.joined(separator: " · "), columnLane, y + 4, small, muted)
        }
    }
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t5-green -- \
  bash -c 'cd $PWD; bash menubar/build.sh > /tmp/t5.log 2>&1; echo "RC=$?"; grep -E "menubar tests:|✗|error:" /tmp/t5.log | head -5'
```
Expected: `RC=0`, `failed=0`

팔레트 이름은 실측 확인했다: `bg` `panel` `panel2` `line` `text` `muted` `green` `yellow` `red` `blue` `inactive`. 새 색을 추가하지 않는다.

- [ ] **Step 5: 커밋한다**

```bash
git add menubar/Sources/SubscriptionBurnView.swift menubar/Tests/SubscriptionBurnLayoutTests.swift
git commit -m "feat(menubar): 구독 지출·소진 두 블록 그리기"
```

---

### Task 6: 대시보드 배선

**Files:**
- Modify: `menubar/Sources/main.swift` (섹션 목록 두 곳, `configure`/갱신 서명, 폴링 훅, 스냅샷 입력)
- Test: `menubar/Tests/test_dashboard_wiring.py` (클래스 추가, `if __name__` 블록 **위에**)

**Interfaces:**
- Consumes: `SubscriptionBurnModel`, `SubscriptionBurnView`, `LaneUsage`, `QuotaObservation`, `quotaCycleBoundary`, `burnProject`, `burnRecommendations`, `subscriptionRates`
- Produces: 대시보드 섹션 `id: "burn"`

- [ ] **Step 1: 실패하는 배선 테스트를 쓴다**

`menubar/Tests/test_dashboard_wiring.py`의 `if __name__` 블록 **위에** 추가한다:

```python
class SubscriptionBurnWiringTests(unittest.TestCase):
    """구독·소진 섹션이 모든 소비 지점에 연결됐는지 본다.

    상태를 계산해 놓고 화면 일부에만 전달하는 실수가 이 저장소에서 다섯 번 났다
    (2026-09-24 적대 리뷰). 섹션 등록·높이·갱신·스냅샷 네 곳을 각각 단언한다.
    """

    def setUp(self):
        self.main = MAIN.read_text()

    def test_section_is_registered_in_both_lists(self):
        # 높이 계산과 배치가 같은 섹션 목록을 봐야 잘리거나 빈 칸이 생기지 않는다.
        self.assertEqual(self.main.count('(id: "burn", title: "구독·소진"'), 2)

    def test_height_uses_the_view_metric(self):
        self.assertIn("SubscriptionBurnView.preferredHeight(", self.main)

    def test_model_reaches_the_view_on_refresh(self):
        self.assertIn("burnView?.model = burnModel", self.main)

    def test_history_is_recorded_from_polling(self):
        self.assertIn("quotaCycleBoundary(", self.main)
        self.assertIn("quotaHistoryTrimmed(", self.main)

    def test_snapshot_can_render_the_section(self):
        # 실패 화면은 실패했을 때만 나타나 평소 스냅샷에 걸리지 않는다.
        self.assertIn('fixture["burn"]', self.main)
```

- [ ] **Step 2: 실패를 확인한다**

```bash
python3 menubar/Tests/test_dashboard_wiring.py 2>&1 | tail -3
```
Expected: `FAILED (failures=5)`

- [ ] **Step 3: 배선한다**

**(a) 섹션 목록 두 곳.** `preferredHeight`의 배열과 `configure`의 배열 **맨 앞**(한 줄 요약 밴드 다음)에 넣는다. 두 배열이 같은 순서·같은 높이를 봐야 섹션이 잘리지 않는다.

```swift
            (id: "burn", title: "구독·소진", summary: "",
             height: SubscriptionBurnView.preferredHeight(burnModel)),
```

**(b) 서명과 호출부.** `configure`와 갱신 함수 둘 다에 파라미터를 더한다(`agy: AgyCardModel = …` 줄 바로 아래).

```swift
        burnModel: SubscriptionBurnModel = SubscriptionBurnModel(usages: [], rates: [:], recommendations: []),
```

호출부 세 곳(`agy: currentAgyCard,`가 나오는 자리)에 함께 넘긴다.

```swift
            burnModel: currentBurnModel,
```

**(c) 뷰 생성과 갱신.** `StatusMenuDashboardView`에 보관 변수를 두고, `case "cli":` 옆에 분기를 더한다.

```swift
    private var burnView: SubscriptionBurnView?
```

```swift
            case "burn":
                let view = SubscriptionBurnView(frame: NSRect(x: 0, y: bodyY,
                                                              width: bounds.width, height: bodyHeight))
                view.model = burnModel
                addSubview(view)
                burnView = view
```

갱신 경로(`cliLanesView?.grok = grok`가 있는 함수)에 한 줄 더한다.

```swift
        burnView?.model = burnModel
```

**(d) 이력 기록.** `AppDelegate`에 상태와 기록 함수를 둔다.

```swift
    var currentBurnModel = SubscriptionBurnModel(usages: [], rates: [:], recommendations: [])
    /// 레인·창별 직전 관측. 경계는 값이 바뀌는 순간이라 직전 값이 있어야 안다.
    var lastQuotaObservations: [String: QuotaObservation] = [:]
    var quotaHistory: [QuotaCycle] = quotaHistoryDecode((try? Data(contentsOf: quotaHistoryURL)) ?? Data())

    /// 폴링이 끝날 때마다 부른다. 경계가 넘어갔으면 직전 주기를 확정해 남긴다.
    func recordQuotaObservation(_ observation: QuotaObservation, now: Date = Date()) {
        let key = "\(observation.lane)/\(observation.window)"
        let previous = lastQuotaObservations[key]
        // 리셋 시각을 주는 레인은 그 변화로, 주지 않는 레인(Grok)은 큰 하락으로 경계를 본다.
        let closed = observation.resetAt == nil
            ? quotaDropBoundary(previous: previous, current: observation, now: now)
            : quotaCycleBoundary(previous: previous, current: observation, now: now)
        if let closed {
            quotaHistory = quotaHistoryTrimmed(quotaHistory + [closed])
            if let data = quotaHistoryEncode(quotaHistory) {
                try? FileManager.default.createDirectory(
                    at: quotaHistoryURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                try? data.write(to: quotaHistoryURL, options: [.atomic])
            }
        }
        lastQuotaObservations[key] = observation
    }
```

**(e) 모델 만들기.** 프록시 상태를 레인 사용량으로 옮긴다. 기여 계정은 오류·비활성을 뺀 수이고, 이 수가 지불 계정과 다른 것이 이 화면의 핵심이다.

```swift
    func claudeLaneUsage(_ health: TeamClaudeHealth?, now: Date) -> LaneUsage? {
        guard let health else { return nil }
        let rows = health.accounts
        let live = rows.filter { $0.enabled && $0.status != "error" }
        func mean(_ values: [Double]) -> Double? {
            values.isEmpty ? nil : values.reduce(0, +) / Double(values.count)
        }
        let laneHistory = quotaHistory.filter { $0.lane == "claude" }
        return LaneUsage(
            lane: "claude", paidAccounts: rows.count, contributingAccounts: live.count,
            errorAccounts: rows.filter { $0.status == "error" }.count,
            disabledAccounts: rows.filter { !$0.enabled }.count,
            weekly: burnProject(current: mean(live.compactMap { $0.weeklyPercent }.map { $0 / 100 }),
                                windowSeconds: 7 * 86_400,
                                resetAt: live.compactMap { $0.weeklyResetAt }.min(),
                                history: laneHistory.filter { $0.window == "7d" }, now: now),
            session: burnProject(current: mean(live.compactMap { $0.sessionPercent }.map { $0 / 100 }),
                                 windowSeconds: 5 * 3_600,
                                 resetAt: live.compactMap { $0.sessionResetAt }.min(),
                                 history: laneHistory.filter { $0.window == "5h" }, now: now),
            blockedMoments: laneHistory.filter { $0.window == "7d" }
                .reduce(0) { $0 + $1.blockedMoments }
        )
    }
```

Codex는 같은 모양이라 `lane: "codex"`와 `teamCodex?.accounts`로 같은 함수를 하나 더 쓴다. agy·Grok은 계정이 하나이므로 `paidAccounts: 1, contributingAccounts: 1, errorAccounts: 0, disabledAccounts: 0`으로 두고 사용률만 채운다. agy는 **잔량**을 주므로 `1 - remaining`으로 뒤집어 넣는다.

모델을 조립하는 자리:

```swift
        let usages = [claudeLaneUsage(currentTeamClaude, now: now),
                      codexLaneUsage(currentTeamCodex, now: now),
                      agyLaneUsage(currentAgyCard, now: now),
                      grokLaneUsage(currentGrokSlot, now: now)].compactMap { $0 }
        currentBurnModel = SubscriptionBurnModel(usages: usages, rates: subscriptionRates(),
                                                 recommendations: burnRecommendations(usages))
```

**(f) 스냅샷 입력.** `--dashboard-snapshot` 분기에서 픽스처를 모델로 옮긴다. 실패 화면은 실패했을 때만 나타나므로 이 경로가 없으면 눈으로 확인할 방법이 없다.

```swift
    let burnModel = subscriptionBurnFixture(fixture["burn"] as? [String: Any])
```

그리고 같은 파일에 픽스처 변환 함수를 둔다.

```swift
/// 스냅샷 픽스처를 모델로 옮긴다. 렌더 전용이라 프로덕션 경로와 섞이지 않는다.
func subscriptionBurnFixture(_ raw: [String: Any]?) -> SubscriptionBurnModel {
    guard let raw else { return SubscriptionBurnModel(usages: [], rates: [:], recommendations: []) }
    let rows = raw["usages"] as? [[String: Any]] ?? []
    let usages: [LaneUsage] = rows.map { row in
        func projection(_ key: String) -> BurnProjection {
            guard let value = (row[key] as? NSNumber)?.doubleValue else {
                return BurnProjection(current: nil, projected: nil, range: nil, basis: .collecting)
            }
            return BurnProjection(current: value, projected: value / 0.5, range: nil,
                                  basis: .extrapolation(confidence: .normal))
        }
        return LaneUsage(
            lane: row["lane"] as? String ?? "?",
            paidAccounts: (row["paid"] as? NSNumber)?.intValue ?? 0,
            contributingAccounts: (row["contributing"] as? NSNumber)?.intValue ?? 0,
            errorAccounts: (row["error"] as? NSNumber)?.intValue ?? 0,
            disabledAccounts: (row["disabled"] as? NSNumber)?.intValue ?? 0,
            weekly: projection("weekly"), session: projection("session"),
            blockedMoments: (row["blocked"] as? NSNumber)?.intValue ?? 0)
    }
    return SubscriptionBurnModel(
        usages: usages,
        rates: subscriptionRateParse(["version": 1, "lanes": raw["rates"] as? [String: Any] ?? [:]]),
        recommendations: burnRecommendations(usages))
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
python3 menubar/Tests/test_dashboard_wiring.py 2>&1 | tail -3
```
Expected: `OK`

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" --label t6-green -- \
  bash -c 'cd $PWD; bash menubar/build.sh > /tmp/t6.log 2>&1; echo "RC=$?"; grep -E "menubar tests:|✗|error:" /tmp/t6.log | head -5'
```
Expected: `RC=0`, `failed=0`

- [ ] **Step 5: 회귀를 심어 테스트가 잡는지 확인한다**

```bash
python3 - <<'PY'
import pathlib, subprocess
p = pathlib.Path('menubar/Sources/main.swift'); orig = p.read_text()
for label, broken in [
    ('모델 전달 제거', orig.replace("burnView?.model = burnModel", "")),
    ('이력 기록 제거', orig.replace("quotaCycleBoundary(", "noCycleBoundary(")),
]:
    p.write_text(broken)
    r = subprocess.run(['python3', 'menubar/Tests/test_dashboard_wiring.py'], capture_output=True)
    p.write_text(orig)
    print(label, '→', '잡음' if r.returncode else '못 잡음(문제)')
PY
```
Expected: 둘 다 `잡음`

- [ ] **Step 6: 커밋한다**

```bash
git add menubar/Sources/main.swift menubar/Tests/test_dashboard_wiring.py
git commit -m "feat(menubar): 구독·소진 섹션 배선과 이력 기록"
```

---

### Task 7: 빈 상태 렌더 검증

**Files:**
- Modify: `menubar/Tests/make_dash_fixture.py`

실패 화면은 실패했을 때만 나타나므로 평소 스냅샷에 걸리지 않는다. 다섯 가지를 직접 그려 눈으로 확인한다.

- [ ] **Step 1: 픽스처에 구독·소진 입력을 더한다**

`menubar/Tests/make_dash_fixture.py`의 `build()`에 추가한다:

```python
    fixture["burn"] = {
        "usages": [
            {"lane": "claude", "paid": 17, "contributing": 7, "error": 6, "disabled": 4,
             "weekly": 0.82, "session": 0.11, "blocked": 0},
            {"lane": "codex", "paid": 7, "contributing": 7, "error": 0, "disabled": 0,
             "weekly": 0.73, "session": 0.0, "blocked": 0},
            {"lane": "agy", "paid": 1, "contributing": 1, "error": 0, "disabled": 0,
             "weekly": 0.06, "session": 0.0, "blocked": 0},
            {"lane": "grok", "paid": 1, "contributing": 1, "error": 0, "disabled": 0,
             "weekly": None, "session": None, "blocked": 0},
        ],
        "rates": {},
    }
    if "--blocked" in sys.argv:
        # 가용 0이 관측된 주기. 전망과 무관하게 부족이어야 한다.
        fixture["burn"]["usages"][0]["blocked"] = 2
    if "--rates" in sys.argv:
        fixture["burn"]["rates"] = {
            "claude": {"plan": "Max 20x", "monthly": 280000},
            "codex": {"plan": "Pro", "monthly": 290000},
            "grok": {"plan": "SuperGrok", "monthly": 45000},
        }
```

- [ ] **Step 2: 다섯 화면을 그린다**

```bash
python3 ~/.claude/scripts/qworker.py run --detach --sync-dir "$PWD" \
  --pull 'burn-*.png' --label t7-render -- bash -c 'cd $PWD;
  bash menubar/build.sh > /tmp/t7.log 2>&1; echo "RC=$?";
  for mode in "" "--rates" "--blocked" "--stale"; do
    name=$(echo "burn${mode}" | tr -d " -" );
    python3 menubar/Tests/make_dash_fixture.py /tmp/f.json $mode > /dev/null;
    ./menubar/.build/cc-menubar --dashboard-snapshot /tmp/f.json "${name}.png" 2>&1 | tail -1;
  done'
```

- [ ] **Step 3: 네 이미지를 눈으로 확인한다**

확인할 것:
- 단가 미입력 화면에서 금액 자리가 모두 `미입력`이고 어떤 숫자도 없다.
- `--rates` 화면에서 합계와 레인별 금액이 계정 수를 곱한 값이다.
- `--blocked` 화면에서 Claude 판정이 `부족`(적색)이다.
- Grok 행이 `수집 중`이고 전망 숫자가 없다.
- 권고 줄이 `오류 6개 재인증이 먼저`로 시작한다.

- [ ] **Step 4: 커밋한다**

```bash
git add menubar/Tests/make_dash_fixture.py
git commit -m "test(menubar): 구독·소진 빈 상태 다섯 가지 렌더"
```

---

## 완료 후

1. `docs/specs/2026-09-26-subscription-burn-view.md`의 Acceptance 일곱 항목을 실제 화면에서 확인하고 결과를 스펙 하단 Verification에 기록한다.
2. 교차 벤더 적대 검토를 돌린다. 빌드 로그를 증거로 넘긴다(증거를 안 넘기면 "테스트 증거 없음"이 지적으로 올라온다).

```bash
bash ~/.claude/scripts/codex-astra-review.sh --evidence <빌드로그> \
  --label "메뉴바 구독 지출·한도 소진 전망 섹션"
```

3. 지적을 반영하고 재검토한 뒤 PR → CI → 머지 → 데몬 교체.
