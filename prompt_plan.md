# cc-visualizer - 구현 계획

## Phase 1: 5개 뷰 품질 완성
- [x] Dashboard: 스크롤 가능한 풀 대시보드로 재설계 (9개 시각화 컴포넌트 통합, 팔란티어 테마)
- [x] Agent Map: 카테고리 필터, 팔란티어 테마, smoothstep 엣지, 모델 뱃지, 디테일 패널 개선
- [x] Process: 개발 프로세스 가이드 + 파이프라인 React Flow 인터랙티브 시각화
- [x] UI 워딩 한국어 통일 (45개 라벨), 앱 타이틀 QJC OS Visualizer
- [ ] Architecture: 인터랙티브 요소 추가 (클릭 -> 상세)
- [ ] Live Monitor: 정적 데이터 기반 차트/메트릭 완성
- [ ] Catalog: 정렬, 페이지네이션, 상세 뷰 연동

## Phase 2: Agent Office (에이전트 오피스 뷰)
- [x] Phase 1: 접근성 + 에러 내성 (PR #4 머지) — ARIA/키보드/focus-ring, ErrorBoundary, Skeleton
- [x] Phase 2A: 실데이터 연동 + 파이프라인 엣지 (PR #4 머지) — SessionEventsProvider, use-agent-status 실데이터, use-pipeline-edges
- [x] Phase 2B: BI 패널 + 성능 최적화 (PR #5 머지, 2026-04-14) — 3컬럼 레이아웃 (KPI/Filter/Insight), use-office-layout statuses deps 분리, AgentOfficeView 285→141줄
- [ ] Phase 3: Cmd+K 검색 팔레트, 화살표 키 그리드 네비게이션, 모바일 fallback, 출근 시퀀스 애니메이션

## Phase 3: UX 통합
- [ ] 뷰 간 네비게이션 연동 (Dashboard 노드 클릭 -> Catalog 상세)
- [ ] 검색 결과에서 뷰 전환 + 엔티티 하이라이트
- [ ] 키보드 네비게이션 (Tab, Arrow, Enter)
- [ ] 반응형 레이아웃 (Tauri 윈도우 리사이즈)

## Phase 4: 실시간 세션 연동
- [x] 세션 데이터 수집 방식 설계 (Tauri session_watcher JSONL tail 방식 채택)
- [x] Tauri Rust 백엔드에 session_watcher 구현 (~/.claude/projects/*/ JSONL tail)
- [x] SessionEventsProvider로 renderer에 실시간 반영 (Phase 2A)
- [x] Agent Office 뷰 실시간 상태 연동 (Phase 2B)
- [ ] Live Monitor 뷰 추가 시각화 (차트/메트릭 세분화)

## Phase 5: 테스트 & 패키징
- [x] 주요 컴포넌트 단위 테스트 — 100 tests (14 files) 달성
- [x] React Flow 노드/엣지 상호작용 테스트 (use-pipeline-edges, use-agent-node-data)
- [ ] Tauri 빌드 검증 (macOS)
- [x] 데이터 스캔 스크립트 안정화 (tsconfig noEmit로 stale 파일 근본 차단)

## 의존성
- Phase 2 (Agent Office)는 Phase 1 완료 후 진행 — **완료 (Phase 2B까지)**
- Phase 3 (UX 통합)은 Phase 2 완료 후 진행 — 다음 작업
- Phase 4 (실시간 세션)는 Phase 2와 병렬 진행 — **부분 완료 (기반 + Agent Office 연동)**
- Phase 5 (테스트/패키징)는 Phase 1-4 완료 후 진행 — 테스트 완료, 패키징 남음
