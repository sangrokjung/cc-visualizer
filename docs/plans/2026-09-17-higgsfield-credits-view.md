# plan: 힉스필드 크레딧 뷰

- STATUS: APPROVED (대표 직접 지시 "힉스필드 사용량 뷰 추가 + 재구독일·D-day")
- spec: `docs/specs/2026-09-17-higgsfield-credits-view.md`
- 브랜치: `feat/higgsfield-credits-view` (worktree: `~/projects/cc-visualizer-worktrees/higgsfield-credits`)

## Phase 1. Rust 백엔드 (CLI 경유 조회)

`src-tauri/src/commands.rs`

- `higgsfield_bin_candidates()`: Tauri .app은 shell PATH를 상속하지 않는다. `run_ccusage`와 같은 다중 후보 탐색을 쓴다.
  `~/.local/share/fnm/aliases/default/bin/higgsfield` → `/opt/homebrew/bin/higgsfield` → `/usr/local/bin/higgsfield` → PATH.
  후보는 `canonicalize`로 중복 제거한다(PATH 보강 뒤 절대경로 후보와 bare 후보가 같은 파일이 된다).
- `higgsfield_path_env()`: **CLI는 `#!/usr/bin/env node` 스크립트라 PATH에 node가 있어야 한다.**
  표준 4경로만 주면 exit 127로 죽으므로 fnm bin을 덧붙인다(`run_tsx_script` 선례).
- `output_with_timeout()` + `RunFailure`: CLI 호출에 30초 상한. 타임아웃은 다음 후보를 시도해도 같으므로 거기서 끝내고,
  spawn 실패만 다음 후보로 넘어간다.
- `fetch_higgsfield_account()`: `account status --json`. 블로킹 호출이라 `spawn_blocking` 안에서 돈다.
- `parse_transaction_page()`: 한 페이지에서 items와 다음 cursor를 뽑는 순수 함수(테스트 대상).
  가득 차지 않은 페이지는 cursor와 무관하게 종료한다.
- `collect_higgsfield_transactions(pages)`: `--size 100` + `--cursor`로 최대 `pages`(기본 3) 수집. 부분 실패 사유를 함께 반환.
- 실패는 throw 대신 `{ok:false, error, ...}` 형태로 내려 프론트가 사유를 렌더한다.

`src-tauri/src/lib.rs`: 두 커맨드를 `invoke_handler`에 등록.

## Phase 2. 순수 로직 + 스키마

- `src/renderer/src/lib/types.ts`: `HiggsfieldAccountSchema`, `HiggsfieldTransactionsSchema`(zod).
- `src/renderer/src/lib/api.ts`: `fetchHiggsfieldAccount`, `fetchHiggsfieldTransactions` IPC 래퍼.
- `src/renderer/src/features/higgsfield/higgsfieldCredits.ts` (뷰와 분리된 계산 전담):
  - `subscriptionGrants(items)` · `subscriptionResets(items)`
  - `regularGrants(grants)`: 보정성 지급을 주기 시작에서 제외한다. **판정은 금액이 아니라 간격**이다
    (금액 최빈값으로 거르면 요금제 변경 시 최신 갱신이 탈락한다). 임계는 `min(최대 간격, 기본 주기)/2`.
  - `estimateCycle(items, now)`: 간격 중앙값 → `cycleDays` · `nextRenewalAt` · `daysRemaining`(달력 날짜 차이) ·
    `grantAmount` · `assumedCycle` · `grantCount`
  - `dayKey` / `calendarDayDiff`: 표시·판정 시간대를 `Asia/Seoul`로 고정한다(머신 로컬 설정에 흔들리지 않게).
  - `netUsageSince(items, since)`: `grant`/`deduct`만 빼고 나머지는 부호대로 집계(미지 액션 누락 방지) ·
    `unknownUsageActions(events)` · `usageByModel` · `usageByDay`(키 `YYYY-MM-DD`, 120일 상한)
  - `projectExpiry(...)`: 현 페이스 기준 주기말 잔여 = 소멸 예상. **근거가 없으면 숫자를 만들지 않는다**
    (`unavailableReason`: `no-grant-history` | `too-early`). `perDay`는 0 이상, `projectedExpiry`는 잔액 이하로 클램프.

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

- `__tests__/higgsfield/`: 주기 실측(2건/1건/0건), D-day 경계, 요금제 변경·같은 날 중복 지급 회귀,
  사용량 집계(환불·미지 액션), 소멸 예측(근거 부족·순환불 클램프), 뷰 렌더·실패 상태.
- `src-tauri` 단위 테스트: PATH에 fnm bin 포함, 페이지 병합·cursor 분기.
- **실 CLI 통합 테스트 2건** (`cargo test -- --ignored`): 실제 호출 왕복 + `env_clear`로 GUI PATH 조건 근사.
  프론트 mock QA는 spawn 경로를 지나지 않으므로 이 층은 여기서만 지켜진다.
- `npx vitest run` · `npx tsc --noEmit`. (`eslint`는 main에 설정 파일이 없어 실행 불가. 별건)
- 브라우저로 시나리오 3종(정상 / 지급이력 없음 / 미지 액션) + 폭 1400·1280·1024 넘침 확인.
- `npm run tauri dev` 육안 확인은 남은 항목(대표 머신 화면 잠금으로 미실시).
- maker와 다른 fresh checker의 적대 검토 후 PR·머지.

## Out of scope

메뉴바 Swift 데몬 반영, 힉스필드 쓰기 동작(구매·생성), 웹 API 직접 호출.
