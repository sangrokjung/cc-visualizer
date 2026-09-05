# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Claude Code 시스템 시각화 도구. 에이전트, 스킬, 훅, 룰, 파이프라인, MCP 서버를 Palantir 다크 테마로 시각화하는 Tauri v2 데스크톱 앱.

## 기술 스택

- **런타임**: Tauri v2 (Rust 백엔드) + Vite 6 (프론트엔드 번들러)
- **프론트엔드**: React 19 + TypeScript 5.8 + Tailwind CSS 3.4
- **그래프/차트**: @xyflow/react 12 (React Flow) + dagre 0.8 + recharts 2.15
- **검증/테스트**: zod 3.25 + Vitest 3.2 + @testing-library/react 16
- **데이터**: 정적 JSON (`scripts/scan-system.ts` → `src/renderer/src/data/system-data.json`)
- **라우팅**: ViewType 상태 전환 (react-router-dom은 deps에 존재하나 미사용)

## 빌드 & 실행

```bash
npm run dev          # Vite 개발 서버 (포트 5173, --host 필수)
npm run build        # tsc && vite build (noEmit은 tsconfig)
npm run test         # vitest run
npm run scan         # system-data.json 재생성
npm run scan:usage   # 사용 통계 재생성 (usage 뷰용)
npm run tauri        # Tauri CLI (npm run tauri dev / build)
```

단일 테스트: `npx vitest run <파일패턴>`
Tauri 개발: `npm run tauri dev` (Rust 백엔드 + Vite 동시 실행)

## 맥 메뉴바 데몬 (menubar/)

cc-visualizer와 별개로, macOS 메뉴바에 Claude Code 사용량을 실시간 표시하는 Swift 네이티브 데몬.

```bash
bash menubar/build.sh                                          # swiftc 컴파일 (.build/cc-menubar)
launchctl load ~/Library/LaunchAgents/com.qjc.cc-menubar.plist # 로그인 자동 시작 등록
```

- 메뉴바: 펄스 도트(활성=초록/idle=회색) + 7일 비용 스파크라인 + 롤링 슬롯(오늘$/오늘₩/토큰/주간/이번달$/이번달₩/누적₩/병렬/코덱스$/최다모델)
- 드롭다운: 14일 추이 막대 차트 + 병렬 세션 게이지 + 오늘/이번주/이번달/누적 비용($+₩) + 환율 + **모델별 (이번 달)** 섹션(`ProviderSummaryView` 색점+분할 비례 바 + ModelRowView 상위 6모델 $/₩, codex 포함)
- 데이터: `npx ccusage {daily,weekly,monthly} --json` 순차 호출(isFetching 가드 → 좀비 방지) — 주간/월간/누적을 native CLI와 일치하게 산출, 실패 시 daily 파생 폴백. fnm symlink 직접 spawn, 142KB JSON은 tmp 파일 redirect로 pipe deadlock 회피
- 모델 추적: `parseModelBreakdown`(이번 달 modelBreakdowns) + `providerOf`(claude/gpt·codex/gemini 분류) → Claude/Codex/Gemini 제공자별 + 모델별 비용. codex(gpt-*) 가시 추적. `shortenModelName`은 8자리 날짜 접미사 제거+공백 버전(TS `modelLabel` 정합), `formatCost` 천단위 구분
- 환율: open.er-api.com 라이브 USD→KRW + UserDefaults 12h 캐시 + 폴백 1450 (`fetchUsdKrwRate`/`formatKRW`)
- AI 계정: TeamClaude + TeamCodex(`127.0.0.1:3457`) 다계정 상태, 5시간/7일 quota와 reset 남은 시간, OAuth 계정 추가 액션
- Codex 캐시: `~/.codex/cache/cc-menubar-session-stats-v1.json` 증분 파싱 캐시(0600) + 메뉴 prewarm
- 병렬 감지: Claude/Codex/Hermes 관련 프로세스 수

## 직원 배포 (docs/INSTALL-for-employees.md)

직원(전원 Mac)이 자기 Claude Code 상태를 보도록 배포. 본체 앱 + 메뉴바 데몬 둘 다.

- **빌드**: `git tag v* && git push` → `.github/workflows/release.yml`이 GitHub Release에 .dmg + 메뉴바 zip 자동 첨부 (미서명)
- **본체 앱 직원 동작**: commands.rs 3단계 폴백 — 사용자 캐시(app_data_dir) → 번들 스냅샷(resources) → 개발 소스. node 있으면 rescan으로 자기 ~/.claude 스캔, 없으면 번들 스냅샷.
- **웹 다운로드**: qjc-webapp `/admin/tools` (GitHub Releases API fetch + requireManager) — 설계는 docs/qjc-webapp-download-page-spec.md
- 상세 계획: `.claude/plan-employee-distribution.md`

## 주요 디렉토리 구조

```
src/renderer/src/
├── features/     # 10개 뷰 (dashboard, agent-map, agent-office, runtime-health 등)
│   └── dashboard/GamificationPanel.tsx  # 레벨/XP/스트릭/업적 (lib/gamification.ts)
├── lib/          # types.ts(zod), gamification.ts, DataProvider.tsx, api.ts, agent-category-map.ts, parsers/
│                 # token-aggregation.ts(ccusage 주/월/누적 집계 + 모델/제공자 분해 codex 추적), fx.ts(USD→KRW), hooks/{use-global-token-stats,use-usd-krw-rate}.ts
├── data/         # system-data.json (정적 스냅샷) + ccusage-snapshot.json (dev 폴백, gitignore)
└── App.tsx       # ViewType 상태로 뷰 전환
src-tauri/src/    # Rust 백엔드 (commands, file_watcher, session_watcher)
menubar/Sources/  # macOS 메뉴바 Swift 데몬 — main.swift + CodexStatus* + TeamClaude/TeamCodex 로직
menubar/Tests/    # 메뉴바 파싱·상태·레이아웃 Swift 테스트
__tests__/        # Vitest 테스트 (프로젝트 루트)
```

## 주요 데이터 (system-data.json 기준)

agents(207), skills(191), hooks(100), rules(74), pipelines(18), mcpServers(46)

*수치는 scan-system.ts 파싱 결과 — hooks는 settings.json 등록 command 단위 (29 matchers / 100 commands), skills는 ~/.claude/commands 하위 디렉토리+파일, rules는 ~/qjc-office/dotclaude/rules 기준. 2026-05-22 재스캔.*

## Git 워크플로우

- 브랜치: `feat/<기능명>` → PR 생성 → 머지 후 `--delete-branch`
- 커밋: Conventional Commits (feat/fix/refactor/docs/test/chore)
- 검증: `npm run test` → `/handoff-verify` 스킬로 fresh-context 독립 검증

## Rules 참조

상세 규칙은 `.claude/rules/` 참조:
- `architecture.md` — 데이터 흐름, Tauri 백엔드, 프론트엔드 라우팅, 데이터 레이어, 디자인 시스템
- `coding-conventions.md` — feature 구조, zod 경계, React Flow memo, useMemo deps, tsconfig

## TeamClaude/TeamCodex status 소비 지도 (2026-08-06 신설 — 대시보드 미표시 사고 재발 방지)

메뉴바 대시보드는 프록시 status(JSON)를 그리는 **별도 렌더러**다. 프록시에 필드를 추가해도 여기 렌더러를 배선하지 않으면 화면에 안 나온다 (2026-08-06 조직 접근 차단 라벨 2회 미표시 사고).

| 표면 | 파일 | 주의 |
|---|---|---|
| Codex 풀 패널 (계정별 상태 텍스트 컬럼 있음) | `menubar/Sources/CodexStatusView.swift` statusText switch + `TeamCodexPoolStatus.swift` 디코드 | 새 필드는 디코드(builder)와 뷰 양쪽 배선. 라벨은 `teamCodexAccountState`(우선순위) → `teamCodexAccountStateLabel`(낱말) → `teamCodexAccountNote`(보조줄) 3단을 거치므로 뷰에 문자열을 직접 쓰지 말 것 |
| **Claude 풀 테이블 (상태 텍스트 컬럼 없음!)** | `menubar/Sources/main.swift` — `TeamClaudeAccountHealth` 구조체 + 파싱(`accountRows.append`) + 행 렌더 루프(측정 컬럼 자리에 error 사유 라벨) | 색점+쿼터만 그리는 구조라 텍스트는 측정 컬럼(innerX+790)에 그린다. 구조체는 memberwise init — 새 필드는 `var x: T? = nil` 기본값으로 4개 생성 지점 호환 |
| **Tauri 앱 표면 (미갱신, 2026-09-06 확인)** | `src/renderer/src/features/runtime-health/RuntimeHealthView.tsx` + `src-tauri/src/commands.rs` | 빌드된 `CC Visualizer.app`이 쓰는 별도 렌더러. `errorReason`·`usable`·`subscription`을 **디코드하지 않아** 꺼 둔 계정을 초록 "사용 가능"으로, 구독 종료를 "오류"로 그린다. 상시 실행이 아니라 이번 정리에서 제외했다 — 이 앱을 다시 쓰기 전에 메뉴바와 같은 낱말로 맞출 것 |
| 프록시 자체 표면 | teamclaude repo: CLI `status`(index.js) · TUI(tui.js) | 프록시 repo에서 함께 배선. **낱말·우선순위 SSOT는 프록시다** — tui.js `_renderAccounts`(disabled → ended → error → end-date-reached → cancellation-scheduled → status)와 index.js `subscriptionDisplay`/`ERROR_REASON_LABELS`를 먼저 읽고 맞춘다 |

- 계정 error 사유 라벨: `errorReason` → 조직차단/**구독종료**/인증만료/인증거부/갱신실패/송신실패 (프록시 계약: teamclaude CLAUDE.md 참조). `teamAccountErrorReasonLabel`은 두 렌더러가 공유하는 canonical 라벨이다.
- **계정 상태 낱말 (2026-09-06 신설 — "돌아온다 / 돌아오지 않는다"를 화면이 말하게)**: `subscription`(state·endsAt)과 `planType`도 디코드한다. 상태 칸은 `구독종료`(영구) / `비활성`(운영자가 끔, 보조줄 "직접 꺼 둔 계정") / 오류 사유 라벨 / `한도소진`(초기화되면 복귀) / `일시대기` / `사용 중` 중 하나이고, 요약줄은 `사용 가능 · 풀 · 제외`로 센다.
  - 우선순위: 구독종료 → 오류 → 비활성 → 설정/대기 → 한도 → 사용 중. **꺼 둔 계정이라도 오류는 삼키지 않는다**(다시 켤 때 처음 알게 되면 늦다).
  - `enabled`와 `status`는 독립이다 — 꺼 둔 계정도 프록시는 `status:"active"`로 준다. 색만 흐리게 하는 것으로는 구분이 안 되니 반드시 텍스트로 쓴다.
  - `end-date-reached`는 **종료가 아니다**. 프록시는 그 상태에서도 계속 라우팅하고(tui.js 노랑 `sub due`), 인증 실패로 `ended`가 되어야 확정이다. 종료로 접으면 서빙 중인 계정을 화면에서 지워 "사용 가능 0"이라 말하게 된다 → 별도 칸 `종료확인중`(보조줄 "종료일 지남 · 연결 확인 중")으로 두고 풀에는 남긴다. `cancellation-scheduled`인데 `endsAt`이 지난 경우도 같은 칸.
  - 확정 종료(`ended`·`errorReason=subscription-ended`)와 꺼 둔 계정에만 초기화 카운트다운을 그리지 않는다.
  - 요약줄은 `제외`라고만 쓴다. 구독 종료(영구)와 운영자가 끈 계정(되돌릴 수 있음)이 같이 들어가므로 **집계 문구에서 "영구"라고 단정하지 않는다** — 영구 여부는 각 줄의 낱말이 말한다.
  - 행 라벨·보조줄·카운트다운은 집계와 **같은 시각(`pool.checkedAt`)**으로 판정한다. 서로 다른 `now`를 쓰면 한 화면에서 줄과 요약이 어긋난다.
  - `usable` 필드가 없는 행(오프라인 스냅샷·프록시 미로드 계정)은 "사용 가능"으로 세지 않는다 — 요약줄과 행 라벨(`설정됨`)이 어긋나면 안 된다.
  - 낱말은 Claude 풀 표(`TeamClaudeMeasurementIssue`)와 맞춘다. 같은 개념에 두 단어를 만들지 말 것(`비활성` ↔ 구 `사용안함`).
- 빌드: `bash menubar/build.sh` (SwiftPM 아님 — Package.swift 없음, swiftc 직접). 배포: KeepAlive라 기존 `cc-menubar` 프로세스 kill이면 launchd가 새 바이너리로 재기동. `launchctl kickstart`는 권한 정책상 거부될 수 있음.
- **완료 기준: 코드 수정이 아니라 재빌드+재기동+사용자 화면 확인까지.** "프록시에 데이터 있음"은 완료가 아니다.
