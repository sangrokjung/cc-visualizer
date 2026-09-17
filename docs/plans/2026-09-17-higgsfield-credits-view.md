# plan: 힉스필드 크레딧 뷰

- STATUS: APPROVED (대표 직접 지시 "힉스필드 사용량 뷰 추가 + 재구독일·D-day")
- spec: `docs/specs/2026-09-17-higgsfield-credits-view.md`
- 브랜치: `feat/higgsfield-credits-view` (worktree: `~/projects/cc-visualizer-worktrees/higgsfield-credits`)

## Phase 1. Rust 백엔드 (CLI 경유 조회)

`src-tauri/src/commands.rs`

- `higgsfield_bin()`: Tauri .app은 shell PATH를 상속하지 않는다. `run_ccusage`와 같은 다중 후보 탐색을 쓴다.
  `~/.local/share/fnm/aliases/default/bin/higgsfield` → `/opt/homebrew/bin/higgsfield` → `/usr/local/bin/higgsfield` → PATH.
- `fetch_higgsfield_account()`: `account status --json` 실행 후 JSON 반환.
- `fetch_higgsfield_transactions(pages)`: `account transactions --size 100 --json` 실행, `cursor`가 있으면 `--after`로 최대 `pages`(기본 3)까지 이어 받아 items를 합쳐 반환.
- 실패는 throw 대신 `{error, ...}` 형태로 내려 프론트가 사유를 렌더한다.

`src-tauri/src/lib.rs`: 두 커맨드를 `invoke_handler`에 등록.

## Phase 2. 순수 로직 + 스키마

- `src/renderer/src/lib/types.ts`: `HiggsfieldAccountSchema`, `HiggsfieldTransactionsSchema`(zod).
- `src/renderer/src/lib/api.ts`: `fetchHiggsfieldAccount`, `fetchHiggsfieldTransactions` IPC 래퍼.
- `src/renderer/src/features/higgsfield/higgsfieldCredits.ts` (뷰와 분리된 계산 전담):
  - `subscriptionGrants(items)` · `estimateCycleDays(grants)` · `nextRenewal(...)` · `daysUntil(...)`
  - `cycleUsage(items, since)` · `usageByModel` · `usageByDay`
  - `projectExpiry(balance, spentPerDay, daysLeft)` (현 페이스 기준 주기말 잔여 = 소멸 예상)
  - `lastResetLoss(items)` (직전 `Subscription Credits Reset` 금액)

## Phase 3. 뷰

`src/renderer/src/features/higgsfield/HiggsfieldView.tsx` (runtime-health의 색 토큰·카드 패턴 재사용)

1. 상단 카드 4: 잔여 크레딧 / 플랜·이메일 / 이번 주기 사용 / **다음 리셋 D-N**
2. 재구독 카드: 예정일(KST) + 진행바(주기 경과) + 주기 근거 문구
3. 소멸 카드: 현 페이스 기준 주기말 잔여(=소멸 예상) + 직전 주기 실제 소멸량
4. 일별 사용 추이(recharts Bar) + 모델별 사용 순위
5. 최근 거래내역 표(grant/deduct/spend 색 구분)
6. 실패 상태: 사유 + `higgsfield auth login` 안내

## Phase 4. 배선

`App.tsx`(ViewType에 `higgsfield` 추가) · `Sidebar.tsx`(`🎬 힉스필드 크레딧`) · `Layout.tsx`(lazy + ErrorBoundary).

## Phase 5. 검증

- `__tests__/higgsfield/higgsfieldCredits.test.ts`: 주기 실측(2건/1건/0건), D-day 경계, 사용량 집계, 소멸 예측.
- `npx vitest run` · `npx tsc --noEmit` · `npx eslint`.
- `npm run tauri dev`로 실제 화면 확인(대표 화면 확인까지가 완료 기준).
- maker와 다른 fresh checker의 적대 검토 후 PR·머지.

## Out of scope

메뉴바 Swift 데몬 반영, 힉스필드 쓰기 동작(구매·생성), 웹 API 직접 호출.
