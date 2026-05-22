# cc-visualizer 대시보드 UI/UX 정비 — 업무 기록

## 기본 정보

| 항목 | 내용 |
|------|------|
| **기록일** | 2026-05-22 |
| **프로젝트** | cc-visualizer (Tauri v2 데스크톱, Claude Code 시각화 도구) |
| **카테고리** | 개발 / 내부 도구 (QJC 사업 비공개·고객 무관) |
| **상태** | 완료 (release 빌드 + 앱 교체) |
| **세션 ID** | cc-visualizer-260522-2146 |

---

## 작업 내용

총 3차례 `/goal` cycle 동안 cc-visualizer 데스크톱 앱의 데이터 신선도와 시스템 개요 UI/UX를 종합 개선.

### Cycle 1 — 실시간 데이터 반영 인프라
1. **file_watcher.rs**: `~/.claude/{agents,commands,rules}` symlink 한정이던 watch를 실제 SSOT(`~/qjc-office/dotclaude/{agents,commands,rules}` + `reference/agent-pipeline.md`)로 확장. `notify` crate가 symlink target 미추적하는 문제 해소.
2. **commands.rs `rescan_system/usage`**: Tauri `.app` GUI가 fnm/nvm shell PATH 미상속 → `npm: command not found` 조용한 실패. `/opt/homebrew/bin/npm` 절대경로 순회 + PATH 보강하는 `run_npm_script` 헬퍼 도입 (이후 사용자가 더 견고한 `run_tsx_script` + 3단 폴백 구조로 재설계).
3. **use-system-data.ts**: AgentOfficeView가 쓰는 훅에 `claude-system-changed` listener 추가 (DataProvider와 동일 패턴) → 룰 변경 시 자동 reload.

### Cycle 2 — 토큰 추이 / 오늘 사용량 / 게임화 워딩 / 텍스트 확대
선행: `use-global-token-stats.ts`에 `recentDaily(14일)` 필드 추가 → 공유 훅으로 4개 에이전트가 충돌 없이 병렬 작업.
- **Agent 1**: `GamificationPanel.tsx` — "게임화/🎮/게임 데이터" → "활동 현황/📊/활동 데이터" 워딩 일괄 교체, 핵심 수치 한 단계 확대.
- **Agent 2**: `TokenFlowMini.tsx` — recharts `BarChart`로 "최근 14일 토큰 추이" 신규, 메가 비용 `text-4xl→5xl`.
- **Agent 3**: `UsageView.tsx` — 오늘 토큰/오늘 비용/어제 대비 %/7일·전체 누적 4카드 + 14일 추이 차트 신규.
- **Agent 4**: 나머지 11개 dashboard 컴포넌트 텍스트 한 단계씩 확대 (수치/라벨/축 fontSize).
- 추가: `gamification.ts` JSDoc 주석의 "게임화" 4건 → "활동 현황" 일괄 치환.

### Cycle 3 — 시스템 개요 텍스트 겹침/오버플로우 + UI/UX 폴리시
JS 객관 측정 스크립트(`scrollWidth/clientWidth`, `getBoundingClientRect` 비교)로 1440/1280 너비 결함 자동 진단.

| 결함 | 원인 | 수정 |
|------|------|------|
| `<span text-8xl leading-none>609</span>` Y-overflow 8px | gradient text가 라인박스 초과 | `leading-[1.05] pb-1` |
| 도메인 칩 "176+10스킬" oR=+35px | DiffBadge가 옆 칩 침범 | inline → `variant='corner'` (`absolute top-1.5 right-1.5`) |
| 도메인 칩 6열 좁아서 숫자 자체 잘림 | xl:grid-cols-6 + 1440에서 칩 ~110px | `xl:grid-cols-6` → `sm:grid-cols-3` (2행 3열) |
| ToolUsageChart Y축 긴 도구명 명백한 겹침 | `width=80` + fontSize 13 + 50+ 도구 전체 표시 | Top 15 + width 150 + 22자 ellipsis + height 250→360 |
| MemoryPanel 32개 자동 메모리 칩 텍스트 벽 | flex-wrap 전체 표시 + 행간 부족 | 12개만 + `+20개 더 보기` 토글, 에이전트는 상위 10개, 행간 보강 |

수정 후 1440/1280 결함 0건 재측정 확정.

---

## 진행 경과

1. Cycle 1: file_watcher SSOT 경로 + rescan PATH 방어 → release 빌드 + 앱 교체 (PID 9111 → 97305)
2. Cycle 2: 공유 훅 선행 + 4 에이전트 병렬 디스패치 → 통합 검증 → release 빌드 + 앱 교체 (PID 97305 → 47564)
3. Cycle 3: JS 진단 → HeroSection/ToolUsageChart/MemoryPanel 수정 → release 빌드 + 앱 교체 (PID 47564 → 93645)
4. dev 서버 vite HMR 캐시 깨짐 발견 → `--force` 클린 재시작
5. dev 환경의 "토큰 추이 비어있음"이 사용자 정책(api.ts에서 ccusage-snapshot.json import 폴백 의도적 제거, "개인 비용 데이터라 git 제외")임 확인 → 되돌리지 않음
6. `/sync-all --apply` 호출: changelog 2개 파일에 append + save-work 진입

---

## 검증 증거

| 항목 | 결과 |
|------|------|
| 신규 테스트 추가 | `__tests__/lib/use-system-data-watcher.test.tsx` (4 tests) |
| 전체 테스트 | 197/197 통과 (모든 cycle) |
| typecheck + vite build | 통과 |
| cargo check | 통과 (기존 dead code 경고 2건만, 신규 무관) |
| release 빌드 | 3회 성공 (각 ~30초, .app + .dmg) |
| file-watcher 실증 | rules SSOT touch → `claude-system-changed` emit 로그로 end-to-end 확인 |
| 시스템 개요 결함 객관 측정 | 1440 4→0건, 1280 0건 |
| 시각 검증 | Playwright로 HeroSection / TokenFlow / UsageView / 에이전트 오피스 전부 스크린샷 확인 |

---

## 생성/수정 문서

| 문서 | 파일명 |
|------|--------|
| 신규 테스트 | `__tests__/lib/use-system-data-watcher.test.tsx` |
| 본 업무 기록 | `.claude/work-log/260522_dashboard-uiux-overhaul.md` |
| changelog 엔트리 | `~/qjc-office/dotclaude/CHANGELOG.jsonl`, `~/qjc-office/company-claude/CHANGELOG.jsonl` |

---

## 미커밋 변경 파일 (24)

- **Rust 백엔드 (1)**: `src-tauri/src/file_watcher.rs` (commands.rs는 사용자/linter가 추가 리팩토링)
- **frontend lib (3)**: `lib/use-system-data.ts`, `lib/gamification.ts`, `lib/hooks/use-global-token-stats.ts`
- **dashboard 컴포넌트 (15)**: DashboardView · GamificationPanel · HeroSection · LiveActivityPulse · McpGrid · MemoryPanel · MetricStrip · ModelRadialBar · PipelineCards · SkillTreemap · StatCards · SystemPulse · SystemRadar · TokenFlowMini · ToolUsageChart
- **usage (1)**: `features/usage/UsageView.tsx`
- **신규 (2)**: 테스트 파일 + `.claude/settings.local.json`

---

## 동기화 정책 결정

| 채널 | 상태 | 사유 |
|------|------|------|
| 로컬 (프로젝트 .claude/work-log/) | ✓ | 본 .md 저장 |
| QJC iCloud | ⊘ skip | `QJC_BASE` 미설정 + 개인 도구라 사업 폴더 부적합 |
| GitHub company-docs | ⊘ skip | UNKNOWN tier (B2B/B2C 아님) → fail-closed |
| Supabase `os_outreach_leads`/`os_customer_pipeline` | ⊘ skip | cc-visualizer 미등록 + 고객 컨텍스트 없음 |
| Supabase `os_tasks` | ⊘ skip | TODAY.md 미사용 (TDL 없음) |
| CHANGELOG.jsonl (sync-all C-6) | ✓ | 2개 파일 append 완료 |

---

## 다음 액션

- 사용자 판단으로 미커밋 24파일 의미 단위로 commit (예: `feat(dashboard): 실시간 SSOT 반영 + 토큰 추이 + 텍스트 겹침 해결`)
- `git push` → GitHub Actions release.yml 트리거 시 새 .dmg 배포
- 필요 시 README.md 신설 + `<!-- qjc-auto-status -->` 블록 (도구 프로젝트라 선택)

---

## 히스토리

| 날짜 | 내용 |
|------|------|
| 2026-05-22 | Cycle 1 — file_watcher SSOT 경로 + rescan PATH 방어 + use-system-data 리스너 |
| 2026-05-22 | Cycle 2 — 공유 훅 recentDaily + 4 에이전트 병렬 (게임화/추이/오늘/텍스트) |
| 2026-05-22 | Cycle 3 — 시스템 개요 텍스트 겹침 0건 + UI/UX 폴리시 |
| 2026-05-22 | /sync-all --apply — CHANGELOG append + save-work |
