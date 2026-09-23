# 힉스필드 크레딧 뷰 (Higgsfield Credits)

- 작성: 2026-09-17
- 등급: M (파일 9개 · 신규 뷰 1 + Tauri 커맨드 2)
- 브랜치: `feat/higgsfield-credits-view`

## Goal

cc-visualizer 앱에 힉스필드(Higgsfield AI) 크레딧 사용량 뷰를 추가한다. 잔액뿐 아니라 **다음 재구독일과 D-day**, 그리고 **갱신 때 소멸하는 미사용 크레딧**까지 한 화면에서 본다.

## 왜 소멸까지 보여주는가 (실측 근거)

거래내역 실측에서 갱신 직전에 잔여분이 통째로 회수된다:

```
2026-09-17T08:00:24.719803Z  grant   +3000    Subscription Credits
2026-09-17T08:00:24.711140Z  deduct  -2395.1  Subscription Credits Reset   ← 미사용분 소멸
2026-08-18T08:00:22.447444Z  grant   +3000    Subscription Credits
2026-08-18T08:00:22.438500Z  deduct  -2.83    Subscription Credits Reset
```

직전 주기에 3,000 중 2,395(79.8%)가 쓰이지 않고 사라졌다. 잔액만 보여주는 화면은 이 손실을 못 잡는다.

## 데이터 소스와 제약

`higgsfield` CLI(`@higgsfield/cli` 1.1.24, 전역 설치) 두 명령이 전부다.

| 명령 | 응답 |
|---|---|
| `higgsfield account status --json` | `{credits, email, subscription_plan_type}` |
| `higgsfield account transactions --size <=100 [--cursor <cursor>] --json` | `{cursor, items:[{action, created_at, credits, display_name}]}` |

- `action` (실측): `spend`(음수) · `grant`(양수, 구독 지급) · `deduct`(음수, 갱신 시 회수) · `refund`(양수, 생성 실패 환불)
- **재구독일 필드는 API에 없다.** 갱신 시각은 `grant` + `display_name="Subscription Credits"` 이벤트로만 알 수 있다.
- `--size` 상한 100 (초과 시 `query.size: Input should be less than or equal to 100`). 주기 2개를 덮으려면 `--cursor`로 2페이지 필요(플래그는 `--after`가 아니다).
- **CLI는 `#!/usr/bin/env node` 스크립트다.** spawn할 때 PATH에 node가 없으면 `env: node: No such file or directory`(exit 127)로 죽는다. Tauri .app은 shell PATH를 상속하지 않으므로 fnm bin 디렉토리를 PATH에 덧붙인다(`run_tsx_script` 선례).

## 재구독일 산출 (추정임을 화면에 명시)

1. `grant`("Subscription Credits") 이벤트를 최신순으로 모은다.
2. 최근 grant = 현재 주기 시작.
3. 인접 grant 간격(일)의 **중앙값** = 주기. 실측 8/18→9/17 = **30일**(캘린더 월이 아니라 30일 고정).
4. 다음 갱신 = 최근 grant + 주기. D-day = 남은 일수(올림).
5. grant가 1건뿐이면 기본 30일을 쓰고 화면에 `기본값 30일 가정`이라고 쓴다.

**화면은 이 값이 추정임을 숨기지 않는다.** "API 미제공 · grant N건 간격 실측" 근거를 함께 표시한다.

## Acceptance

1. 사이드바에 `힉스필드 크레딧` 항목이 있고 클릭하면 뷰가 열린다.
2. 잔여 크레딧·플랜·이메일이 CLI `account status`와 일치한다.
3. 다음 재구독 예정일(KST)과 `D-N`이 표시되고, 주기 근거(30일·grant 2건)가 함께 보인다.
4. 주기 경과율 진행바와 남은 일수가 보인다.
5. 이번 주기 사용량, 현 페이스 기준 주기말 잔여 예측, **소멸 예상량**이 보인다.
6. 직전 주기 실제 소멸량(2,395.1)이 보인다.
7. 일별 사용 추이 차트와 모델별(`display_name`) 사용량 순위가 보인다.
8. 최근 거래내역 표에 grant/deduct/spend가 구분되어 보인다.
9. CLI 미설치·미로그인·호출 실패 시 빈 화면이 아니라 사유와 복구 명령(`higgsfield auth login`)을 보여준다.

## Non-goals

- 힉스필드 웹 API 직접 호출(브라우저 CSP·인증 문제). CLI만 경유한다.
- 크레딧 구매·플랜 변경 등 쓰기 동작. 본 뷰는 읽기 전용이다.
- 메뉴바 데몬(Swift) 반영. 이번 범위는 Tauri 앱 뷰 1개다.
- 생성 작업(generate) 실행. 사용량 관찰만 한다.

## Test

- 순수 로직(`higgsfieldCredits.ts`) 단위 테스트: 주기 실측(2건·1건·0건), D-day 경계(당일·자정 넘김), 요금제 변경·보정 지급·같은 날 중복, 주기 사용량 합산(환불·미지 액션), 소멸 예측(근거 부족·순환불), 모델별 집계.
- 뷰 렌더 테스트: 정상 데이터·CLI 실패 상태·지급 이력 부재·미지 액션 배너.
- Rust: 페이지 병합·cursor 분기 단위 테스트 + **실 CLI 통합 2건**(`cargo test -- --ignored`).

## Verification (2026-09-18 실측)

AC가 실제로 무엇으로 검증됐는지 기록한다. **패키징된 앱(`npm run tauri dev`) 육안 확인은 하지 못했다**
(작업 시점에 머신 화면이 잠겨 있었음). 그 층을 무엇이 대신하는지도 함께 적는다.

| AC | 검증 수단 | 결과 |
|---|---|---|
| 1 사이드바 진입 | 브라우저(Vite dev)에서 버튼 클릭 → 뷰 전환 | 확인 |
| 2 잔액·플랜 일치 | CLI 실응답을 주입해 렌더 대조 + 뷰 렌더 테스트 | 확인 |
| 3 다음 갱신일·D-day·근거 | 브라우저 5시나리오 + 단위 테스트(경계 포함) | 확인 |
| 4 진행바·남은 일수 | 브라우저 렌더 | 확인 |
| 5 이번 주기 사용·예측·소멸 | 브라우저 + 단위 테스트 | 확인 |
| 6 직전 주기 실제 소멸 | 브라우저 렌더(2,395.1 표시) | 확인 |
| 7 일별 추이·모델별 | 브라우저 렌더 | 확인 |
| 8 거래 표 구분 | 브라우저 렌더 + 뷰 테스트 | 확인 |
| 9 실패 시 사유·복구 안내 | 뷰 테스트 + 브라우저 실패 시나리오 | 확인 |

- **브라우저 확인은 Tauri IPC를 mock으로 대체한 것이다.** 화면에 그린 값은 CLI 실응답이지만 spawn 경로는 지나지 않는다.
- 그 spawn 층은 실 CLI 통합 테스트 2건이 덮는다: 실제 호출 왕복, 그리고 `env_clear`로 부모 PATH를 비운 GUI 근사.
  PATH에 node가 빠져 exit 127로 죽던 결함은 이 테스트로만 잡힌다.
- IPC 배선(`lib.rs` 등록 → `invoke` → `api.ts` 호출 문자열)은 정적 대조로만 확인했다. 틀리면 실패 카드로 드러난다.
- 화면 잠금이 풀리면 앱을 1회 열어 확인하고 이 절을 갱신한다.
