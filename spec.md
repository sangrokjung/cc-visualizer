# cc-visualizer - 기능 명세

## Feature 1: Dashboard (시스템 개요)
### 요구사항
1. 스크롤 가능한 풀 대시보드 레이아웃 (max-w-[1400px])
2. HeroSection + StatCards(6개, 카운트업 애니메이션) + 차트 4종 + PipelineCards + McpGrid + MemoryPanel
3. 차트: SystemRadar(8카테고리), ModelRadialBar, SkillTreemap, ToolUsageChart
4. 전체 Palantir Blueprint 다크 테마 (#111418, #1C2127, #252A31, #404854)
### 현재 상태
- v6 완료: 9개 시각화 컴포넌트 통합, 팔란티어 테마 적용

## Feature 2: Agent Map
### 요구사항
1. React Flow 기반 에이전트 관계도 (dagre TB 레이아웃)
2. 파이프라인 기반 에이전트 연결/의존성 시각화 (smoothstep + ArrowClosed)
3. 카테고리별 색상 구분 (8개 카테고리), 필터 토글, 디테일 패널
4. 모델 뱃지 (Opus/Sonnet/Default), Handle 카테고리 색상, hover glow
### 현재 상태
- v2 완료: 팔란티어 테마, smoothstep 엣지, 모델 뱃지, 디테일 패널 개선

## Feature 3: Architecture View
### 요구사항
1. 시스템 아키텍처 다이어그램
2. 계층 구조 시각화 (Electron, Rules, Hooks, MCP 등)
3. 컴포넌트 간 데이터 흐름 표현
### 현재 상태
- 기본 구현 완료

## Feature 4: Live Monitor
### 요구사항
1. 실시간 세션 모니터링 (향후)
2. 현재는 정적 데이터 기반 모니터링 뷰
3. 토큰 사용량, 에이전트 실행 상태 표시
### 현재 상태
- 기본 구현 완료, 실시간 연동 미구현

## Feature 5: Catalog
### 요구사항
1. 에이전트, 스킬, 훅, 룰 전체 목록
2. 검색 및 필터링
3. 상세 정보 표시
### 현재 상태
- 기본 구현 완료

## Feature 6: 실시간 세션 연동
### 요구사항
1. Claude Code 세션 데이터 실시간 수집
2. 에이전트 실행 상태 라이브 업데이트
3. 토큰 사용량 실시간 추적
### 데이터 소스
- 정적: `scripts/scan-system.ts`
- 실시간: `src-tauri/src/session_watcher.rs` (~/.claude/projects/*/ JSONL tail → Tauri event emit)
### 현재 상태
- v1 완료 (Phase 2A): session_watcher.rs + SessionEventsProvider + agentActivityMap
- Agent Office 뷰 실시간 상태 연동 완료 (Phase 2B)

## Feature 7: Systems (자동화 생태계)
### 요구사항
1. QJC 외부 자동화 시스템 10개를 카드 그리드로 시각화
2. 카테고리별 필터 (자동화/콘텐츠/재무/교육/마케팅/영상)
3. 히어로 섹션 (운영중/개발중 카운트, 총 에이전트/스킬/MCP)
4. SystemCard (상태 도트, 기술 스택 뱃지, 에이전트/스킬/MCP 카운트, 핵심 기능)
5. SystemDetailPanel (우측 슬라이드 패널, 전체 상세 정보)
### 데이터 소스
- data/external-systems.json (정적 조사 데이터 10개 프로젝트)
### 현재 상태
- v1 완료: 카드 그리드 + 필터 + 디테일 패널, 팔란티어 테마

## Feature 8: Process (개발 프로세스 가이드)
### 요구사항
1. 8단계 개발 프로세스 시각화 (세션 시작→아이디어→계획→구현→검증→커밋→문서→종료)
2. 의사결정 플로차트 (애니메이션)
3. 구현 전략 선택 플로차트 (/tdd, /sdd, /orchestrate, /auto-loop)
4. 20개 상황별 레시피 카드 (카테고리 필터)
5. 13개 파이프라인 React Flow 인터랙티브 시각화
6. 일과 루틴 + 절대 게이트 + 단축 경로 테이블
### 데이터 소스
- 정적 데이터 (ProcessView 내 하드코딩)
- system-data.json pipelines (PipelineFlowChart)
### 현재 상태
- v2 완료: 의사결정 플로차트 + 파이프라인 React Flow 시각화

## Feature 9: Usage (사용 통계)
### 요구사항
1. 전체 세션 사용 통계 대시보드
2. 도구 사용 순위, 일별 활동, 프로젝트별 활동, 훅 이벤트 분포
3. 에이전트 스폰 테이블
### 데이터 소스
- data/usage-stats.json (scan-usage.ts 생성)
### 현재 상태
- v1 완료

## Feature 10: Agent Office (에이전트 오피스)
### 요구사항
1. 201개 에이전트를 픽셀아트 캐릭터 + 10개 부서 구역 메타포로 시각화
2. 3컬럼 BI 레이아웃: 좌 200px FilterPanel, 중 ReactFlow 오피스, 우 280px InsightPanel
3. 상단 KPI Strip: Working/Recent/Idle/Offline/Pipelines/Tools 6개 카드 (카운트업 애니메이션)
4. 실시간 상태 (working 30s / recent 5min / idle / offline) — 세션 이벤트 매칭, DEMO MODE 폴백
5. 파이프라인 엣지: 에이전트 선택 시 in/out 흐름 하이라이트
6. 우측 탭 3개: Selected (AgentProfilePanel) / Events (최근 20개) / Stats (부서 분포 + 도구 호출 TOP)
7. 접근성: ARIA role/tabIndex/focus-ring, 라이브 리전 3초 디바운스 (WCAG AA)
8. 에러 바운더리 + 로딩 Skeleton
### 데이터 소스
- system-data.json (agents, pipelines)
- SessionEventsProvider (agentActivityMap, recentTools)
### 성능 최적화 (Phase 2B)
- use-office-layout: `statuses` deps 제거 → 5초 tick에서 레이아웃 재계산 안 함
- use-agent-node-data: 변경된 에이전트만 새 참조 생성 → AgentAvatarNode memo skip
### 현재 상태
- Phase 1+2A 완료 (PR #4): 접근성 + 실데이터 연동 + 파이프라인 엣지
- Phase 2B 완료 (PR #5, 2026-04-14): BI 패널 + 성능 최적화, AgentOfficeView 285→141줄

## Feature 11: Dashboard 게이미피케이션 패널
### 요구사항
1. 레벨/XP 시스템 (13단계 비선형 곡선, 한국어 칭호 — 수습 빌더~퀀텀 마스터)
2. 스트릭 (ccusage 연속 사용일 + 최장 기록)
3. 업적 12종 (토큰/비용/스트릭/시스템 다양성, bronze/silver/gold tier, 진행률 바)
4. Palantir 다크 테마 + 업적 그리드
### 데이터 소스
- ccusage daily (api.fetchCcusageDaily, 브라우저 dev는 ccusage-snapshot.json 폴백)
- system-data.json stats (에이전트/스킬 수)
### 구현
- lib/gamification.ts (zod 순수 함수) + features/dashboard/GamificationPanel.tsx
### 현재 상태
- v1 완료 (2026-05-22): 47 단위 테스트, DashboardView 통합

## Feature 12: macOS 메뉴바 데몬 (menubar/)
### 요구사항
1. cc-visualizer와 독립된 Swift NSStatusItem 네이티브 데몬 (LSUIElement)
2. 메뉴바: 펄스 도트(활성 초록/idle 회색) + 7일 비용 스파크라인(NSImage) + 7슬롯 5초 롤링
3. 7슬롯: 오늘 비용/오늘 토큰/누적 비용/누적 토큰/병렬 세션/주간 비용/주력 모델
4. 드롭다운 일별 추이:
   - 14일 추이 막대 차트(TrendChartView) — 날짜축 라벨 + 피크 일자/금액 표시
   - 최근 7일 일별 상세(DailyRowView × 7) — 날짜 + 인라인 미니바 + 비용 + 토큰 (오늘 초록 강조)
   - 병렬 세션 게이지(ParallelGaugeView) — 비율별 색변화(청록→주황)
5. 활동 감지: ~/.claude/projects/ 디렉토리 mtime 60초 이내 → ⚡ 활성 표시
6. 병렬 감지: `pgrep -f '^claude'` 인스턴스 수
### 데이터 소스
- `npx ccusage daily --json` (fnm symlink 직접 spawn, tmp 파일 redirect로 142KB pipe deadlock 회피)
- 동시 호출 가드(`isFetching`) — 60초 주기 호출이 겹쳐 ccusage 자식 무한 누적되는 버그 차단 (426 좀비 사고)
### 빌드/배포
- menubar/build.sh (swiftc -O) → LaunchAgent (com.qjc.cc-menubar.plist, 로그인 자동시작)
### 현재 상태
- v1 완료 (2026-05-22): CPU 0.7~1.7%, 60초 ccusage 갱신, 1초 펄스/5초 슬롯/15초 활동 타이머
- 일별 추이 추가 (2026-05-22): 14일 차트 날짜축 + 7일 상세 리스트 + 동시 호출 가드

## 공통: 검색
### 요구사항
1. Cmd+K 글로벌 검색
2. 에이전트, 스킬, 훅, 룰 통합 검색
3. 검색 결과 선택 시 해당 뷰로 네비게이션
### 현재 상태
- SearchBar 구현 완료
