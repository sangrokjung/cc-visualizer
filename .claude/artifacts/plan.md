---
status: APPROVED
created: 2026-03-14
---

# Implementation Plan: Claude Code System Visualizer (Electron)

## Overview

비유: 자동차 대시보드처럼, Claude Code 시스템의 32개 에이전트/40개 훅/20개 MCP/27개 Rules를 한눈에 보여주는 "조종실 계기판"을 만든다. 실제 설정 파일(`~/.claude/`)을 파싱하여 노드 그래프, 타임라인, 레이어드 다이어그램으로 시각화한다.

## Requirements

- 에이전트 32개를 노드 그래프로 시각화 (카테고리별 색상, 파이프라인 연결선, 클릭 시 상세)
- 실시간 세션 모니터링 (파일시스템 워치 기반 타임라인)
- 시스템 아키텍처 다이어그램 (훅/MCP/Rules/Memory 레이어)
- 한국어 UI, 800줄/50줄 제한 준수
- 데이터 소스: `~/.claude/agents/*.md`, `~/.claude/settings.json`, `~/qjc-office/dotclaude/rules/*.md`, `~/.claude/work-log/`, `~/.claude/agent-memory/`

## Architecture

```
cc-visualizer/
  electron/
    main.ts              -- Electron 메인 프로세스 (IPC 핸들러)
    preload.ts           -- preload 스크립트 (IPC 브릿지)
    file-watcher.ts      -- chokidar 기반 파일시스템 워치
  src/
    App.tsx              -- 라우터 + 레이아웃
    lib/
      parsers/
        agent-parser.ts  -- .md frontmatter 파싱 -> AgentNode 타입
        hook-parser.ts   -- settings.json hooks 섹션 파싱
        mcp-parser.ts    -- permissions.allow에서 MCP 서버 추출
        rule-parser.ts   -- rules/*.md 메타데이터 추출
        pipeline-parser.ts -- agent-pipeline.md 파싱
        session-parser.ts  -- session-summary JSON 파싱
      types.ts           -- 공유 타입 정의
    features/
      agent-map/
        AgentMapView.tsx     -- React Flow 기반 노드 그래프
        AgentNode.tsx        -- 커스텀 노드 컴포넌트
        AgentDetailPanel.tsx -- 사이드패널 상세 정보
        use-agent-graph.ts   -- 그래프 데이터 훅
      live-monitor/
        LiveMonitorView.tsx  -- 실시간 타임라인
        TimelineEvent.tsx    -- 이벤트 아이템
        StatsPanel.tsx       -- 통계 대시보드
        use-file-watcher.ts  -- IPC 기반 실시간 데이터 훅
      architecture/
        ArchitectureView.tsx -- 레이어드 다이어그램
        HookLayer.tsx        -- 훅 이벤트별 레이어
        McpLayer.tsx         -- MCP 서버 노드
        RulesList.tsx        -- Rules 목록
        FilePreview.tsx      -- 파일 내용 미리보기 모달
    components/
      Layout.tsx         -- 사이드바 + 콘텐츠
      Sidebar.tsx        -- 네비게이션
      SearchBar.tsx      -- 전역 검색
```

## Implementation Steps

### Phase 1: 프로젝트 스캐폴딩 + 데이터 파서

**목표**: Electron+Vite+React+TypeScript 프로젝트 생성, 모든 데이터 소스를 파싱하는 순수 함수 구현

**파일**:
- `package.json` -- 의존성 (electron, vite, react, react-flow, chokidar, gray-matter, zod)
- `electron/main.ts` -- Electron 메인 프로세스 + IPC 핸들러
- `electron/preload.ts` -- contextBridge
- `vite.config.ts` -- Electron + React 설정
- `src/lib/types.ts` -- AgentNode, HookEvent, McpServer, Rule, Pipeline, SessionLog 타입 (zod 스키마)
- `src/lib/parsers/agent-parser.ts` -- .md frontmatter 파싱
- `src/lib/parsers/hook-parser.ts` -- settings.json hooks 파싱
- `src/lib/parsers/mcp-parser.ts` -- MCP 서버 추출
- `src/lib/parsers/rule-parser.ts` -- rules 메타데이터
- `src/lib/parsers/pipeline-parser.ts` -- 에이전트 파이프라인 관계
- `src/lib/parsers/session-parser.ts` -- 세션 로그

**수락 기준**:
- [ ] `npm run dev`로 Electron 창이 열린다
- [ ] 각 파서에 대한 단위 테스트가 통과한다 (vitest)
- [ ] `agent-parser`가 32개 에이전트의 name, tools, model, color, isolation, maxTurns를 정확히 추출한다
- [ ] `hook-parser`가 10개 이벤트 타입, 40개 훅의 matcher/command/timeout/async를 추출한다
- [ ] `mcp-parser`가 20개+ MCP 서버명을 추출한다
- [ ] 모든 타입에 zod 검증이 적용된다

**위험도**: 낮음
**의존성**: 없음

---

### Phase 2: 에이전트 맵 (Agent Map)

**목표**: React Flow 기반 인터랙티브 노드 그래프로 32개 에이전트와 파이프라인 시각화

**파일**:
- `src/features/agent-map/AgentMapView.tsx` -- React Flow 캔버스 + 자동 레이아웃 (dagre)
- `src/features/agent-map/AgentNode.tsx` -- 커스텀 노드 (카테고리 색상, 모델 아이콘, 도구 수 배지)
- `src/features/agent-map/AgentDetailPanel.tsx` -- 클릭 시 사이드 패널 (용도, 트리거 키워드, 도구 목록, 원본 .md 미리보기)
- `src/features/agent-map/use-agent-graph.ts` -- 파서 데이터 -> React Flow nodes/edges 변환
- `src/components/Layout.tsx` -- 사이드바 + 콘텐츠 레이아웃
- `src/components/Sidebar.tsx` -- 3탭 네비게이션 (에이전트맵, 모니터, 아키텍처)
- `src/App.tsx` -- 라우터 연결

**수락 기준**:
- [ ] 32개 에이전트가 노드로 렌더링된다
- [ ] 8개 카테고리별 색상이 구분된다 (개발=blue, 비즈니스=green, 크리에이티브=magenta 등)
- [ ] 8개 파이프라인의 연결선(edge)이 방향성 화살표로 표시된다
- [ ] 노드 클릭 시 상세 패널이 열리고, 에이전트의 description, tools, model, triggers가 표시된다
- [ ] 카테고리별 필터링이 가능하다
- [ ] dagre 자동 레이아웃으로 겹침 없이 배치된다

**위험도**: 중간 (React Flow 자동 레이아웃 + 32노드 성능)
**의존성**: Phase 1

---

### Phase 3: 시스템 아키텍처 뷰 (Architecture View)

**목표**: 훅/MCP/Rules/Memory를 레이어드 다이어그램으로 시각화, 각 컴포넌트 클릭 시 파일 미리보기

**파일**:
- `src/features/architecture/ArchitectureView.tsx` -- 전체 레이아웃 (이벤트 흐름 중심)
- `src/features/architecture/HookLayer.tsx` -- 이벤트 타입별 훅 그룹 (수영장 레인 스타일)
- `src/features/architecture/McpLayer.tsx` -- MCP 서버 노드 그리드
- `src/features/architecture/RulesList.tsx` -- Rules 파일 목록 (CRITICAL/IMPORTANT 태그 하이라이트)
- `src/features/architecture/MemoryLayer.tsx` -- Memory 시스템 (Auto/Agent/Project 구분)
- `src/features/architecture/FilePreview.tsx` -- 모달: 파일 경로 + 내용 하이라이트 미리보기
- `electron/main.ts` -- IPC: 파일 내용 읽기 핸들러 추가

**수락 기준**:
- [ ] 10개 이벤트 타입이 수영장 레인(swim lane)으로 구분된다
- [ ] 각 레인 안에 해당 훅들이 카드로 표시된다 (matcher, async 여부 시각적 구분)
- [ ] MCP 서버 20개+가 그리드로 표시되고, permissions 상태(allow/deny 범위)가 보인다
- [ ] Rules 27개가 목록으로 표시되고, CRITICAL/IMPORTANT 배지가 있다
- [ ] 아무 컴포넌트나 클릭하면 실제 파일 경로와 내용(앞 50줄)이 모달로 표시된다
- [ ] Memory 시스템 구조 (Auto Memory, Agent Memory, Personal OS)가 시각화된다

**위험도**: 중간 (레이어드 다이어그램 커스텀 렌더링)
**의존성**: Phase 1

---

### Phase 4: 실시간 모니터 (Live Monitor)

**목표**: chokidar 기반 파일시스템 감시로 세션 활동을 실시간 타임라인으로 표시

**파일**:
- `electron/file-watcher.ts` -- chokidar 워치 (work-log/, agent-memory/, settings.json 등)
- `src/features/live-monitor/LiveMonitorView.tsx` -- 타임라인 뷰 + 활성 에이전트 하이라이트
- `src/features/live-monitor/TimelineEvent.tsx` -- 이벤트 아이템 (타입별 아이콘, 타임스탬프)
- `src/features/live-monitor/StatsPanel.tsx` -- 통계 (세션별 에이전트 호출 빈도, 도구 사용 분포)
- `src/features/live-monitor/use-file-watcher.ts` -- IPC 이벤트 구독 훅
- `electron/main.ts` -- IPC: 파일 변경 이벤트 -> renderer 전달

**수락 기준**:
- [ ] `~/.claude/work-log/` 파일 생성/변경 시 타임라인에 실시간 반영된다
- [ ] 에이전트 메모리 파일 변경 시 해당 에이전트가 "활성" 상태로 하이라이트된다
- [ ] 세션 로그의 status(success/failure/partial)별 색상 구분이 된다
- [ ] 통계 패널에서 에이전트별 호출 빈도 바 차트가 표시된다
- [ ] 타임라인이 시간순으로 자동 스크롤된다
- [ ] 워치 대상 경로가 존재하지 않아도 에러 없이 대기한다

**위험도**: 중간 (IPC 기반 실시간 이벤트 스트리밍 안정성)
**의존성**: Phase 1, Phase 2 (에이전트 맵 하이라이트 연동)

---

### Phase 5: 전역 검색 + 크로스 뷰 연동

**목표**: 전역 검색으로 에이전트/훅/MCP/Rule을 찾고, 뷰 간 네비게이션 연동

**파일**:
- `src/components/SearchBar.tsx` -- cmdk 스타일 커맨드 팔레트 (Cmd+K)
- `src/lib/search-index.ts` -- 모든 엔티티의 검색 인덱스 구성
- `src/features/agent-map/AgentMapView.tsx` -- 검색 결과 노드 포커스/줌
- `src/features/architecture/ArchitectureView.tsx` -- 검색 결과 컴포넌트 하이라이트
- `src/features/live-monitor/LiveMonitorView.tsx` -- 검색 결과 이벤트 필터

**수락 기준**:
- [ ] Cmd+K로 검색 팔레트가 열린다
- [ ] "planner" 검색 시 에이전트맵에서 해당 노드로 줌인한다
- [ ] "PreToolUse" 검색 시 아키텍처 뷰에서 해당 레인이 하이라이트된다
- [ ] 에이전트맵의 노드 클릭 -> 아키텍처 뷰에서 관련 훅/MCP 하이라이트 연동
- [ ] 모니터의 에이전트 이름 클릭 -> 에이전트맵의 해당 노드로 이동

**위험도**: 낮음
**의존성**: Phase 2, 3, 4

---

### Phase 6: 빌드 + 패키징

**목표**: macOS용 .dmg 빌드, 앱 아이콘, 자동 데이터 새로고침

**파일**:
- `electron-builder.config.js` -- electron-builder 설정
- `src/assets/icon.icns` -- 앱 아이콘
- `electron/main.ts` -- 자동 새로고침 (5분 간격 또는 수동)
- `package.json` -- build 스크립트 추가

**수락 기준**:
- [ ] `npm run build`로 macOS .dmg가 생성된다
- [ ] .dmg 설치 후 앱이 정상 실행된다
- [ ] 데이터 소스 경로 변경 시 설정 화면에서 커스터마이징 가능하다
- [ ] 앱 시작 시 자동으로 최신 데이터를 로딩한다

**위험도**: 낮음
**의존성**: Phase 1-5

---

## Testing Strategy

- **단위 테스트** (vitest): 모든 파서 함수 (`src/lib/parsers/*`), 타입 검증 (`types.ts`), 검색 인덱스
- **컴포넌트 테스트** (vitest + @testing-library/react): AgentNode, TimelineEvent, FilePreview 등 핵심 UI
- **E2E 테스트** (playwright): Electron 앱 실행 -> 3탭 네비게이션 -> 노드 클릭 -> 검색 동작

## Risks & Mitigations

- **Risk**: 에이전트 .md frontmatter 포맷이 일관되지 않을 수 있음
  - Mitigation: zod 스키마로 필수/선택 필드 구분, 파싱 실패 시 graceful fallback (이름만 표시)

- **Risk**: React Flow에서 32노드 + 파이프라인 edge 성능
  - Mitigation: dagre 자동 레이아웃 + 가상화(viewport 밖 노드 렌더링 생략)

- **Risk**: chokidar 파일 워치가 macOS에서 이벤트 누락
  - Mitigation: polling 폴백 옵션, 수동 새로고침 버튼

- **Risk**: 사용자 홈 디렉토리 접근 권한
  - Mitigation: Electron main 프로세스에서만 파일 읽기, preload로 IPC 브릿지

## Success Criteria

- [ ] 32개 에이전트가 카테고리별 색상으로 노드 그래프에 표시된다
- [ ] 8개 파이프라인이 방향성 화살표로 연결된다
- [ ] 노드 클릭 시 description, tools, model, triggers가 패널에 표시된다
- [ ] 40개 훅이 이벤트 타입별 swim lane으로 시각화된다
- [ ] 20개+ MCP 서버가 그리드로 표시된다
- [ ] 실시간 파일 변경이 타임라인에 1초 이내 반영된다
- [ ] Cmd+K 검색으로 모든 엔티티를 찾을 수 있다
- [ ] macOS .dmg로 패키징되어 독립 실행 가능하다
