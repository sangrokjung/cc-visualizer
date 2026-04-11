# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Claude Code 시스템 시각화 도구. 에이전트, 스킬, 훅, 룰, 파이프라인, MCP 서버를 Palantir 다크 테마로 시각화하는 Tauri v2 데스크톱 앱.

## 기술 스택

- **런타임**: Tauri v2 (Rust 백엔드) + Vite 6 (프론트엔드 번들러)
- **프론트엔드**: React 19 + TypeScript 5.8 + Tailwind CSS 3.4
- **라우팅**: react-router-dom 7 (미사용, ViewType 상태 기반 전환)
- **그래프**: @xyflow/react 12 (React Flow) + dagre 0.8 (자동 레이아웃)
- **차트**: recharts 2.15
- **검증**: zod 3.25 (경계 타입 검증)
- **테스트**: Vitest 3.2 + @testing-library/react 16 + jsdom
- **데이터**: 정적 JSON (`scripts/scan-system.ts` -> `src/renderer/src/data/system-data.json`)

## 빌드 & 실행

```bash
npm run dev          # Vite 개발 서버 (포트 5173)
npm run build        # tsc + vite build -> dist/
npm run test         # vitest run
npm run test:watch   # vitest (워치 모드)
npm run scan         # system-data.json 재생성 (npx tsx scripts/scan-system.ts)
npm run scan:usage   # usage-stats.json 재생성
npm run tauri        # Tauri CLI (npm run tauri dev / npm run tauri build)
```

단일 테스트 실행: `npx vitest run <파일패턴>`

Tauri 개발 모드: `npm run tauri dev` (Rust 백엔드 + Vite 프론트엔드 동시 실행)

## 아키텍처

### 데이터 흐름 (핵심)

```
~/.claude/ (에이전트/스킬/훅/룰 원본)
  ↓ scan-system.ts (Node.js 스크립트, gray-matter로 frontmatter 파싱)
src/renderer/src/data/system-data.json (정적 스냅샷)
  ↓ DataProvider (React Context)
각 feature 뷰 컴포넌트
```

Tauri 실행 시: Rust 백엔드(`commands.rs`)가 JSON 파일을 직접 읽어 IPC로 전달. `DataProvider`가 Rust 데이터를 우선 사용하고, 실패 시 정적 JSON import로 폴백.

### Tauri 백엔드 (src-tauri/src/)

| 파일 | 역할 |
|------|------|
| `lib.rs` | Tauri 앱 엔트리. 커맨드 등록 + 워처 시작 |
| `commands.rs` | IPC 커맨드 8개: read_file, list_dir, get_system_paths, rescan_system/usage, load_*_data |
| `file_watcher.rs` | `~/.claude/work-log`, `agent-memory` 디렉토리 감시 → `file-changed` 이벤트 emit |
| `session_watcher.rs` | `~/.claude/projects/*/` 에서 최신 JSONL 세션 파일 tail → `session-event` 이벤트 emit |

### 프론트엔드 라우팅

`App.tsx`의 `ViewType` 상태로 9개 뷰를 전환 (react-router 미사용). `Layout.tsx`에서 `React.lazy`로 코드 스플리팅.

| ViewType | Feature 폴더 | 설명 |
|----------|-------------|------|
| dashboard | dashboard/ | 온톨로지 그래프 + 9개 시각화 (StatCards, SystemRadar, SkillTreemap 등) |
| agent-map | agent-map/ | React Flow 에이전트 관계도 (dagre 레이아웃) |
| agent-office | agent-office/ | 에이전트를 오피스 공간 메타포로 시각화 |
| architecture | architecture/ | 훅/파이프라인/메모리/룰 레이어 시각화 |
| live-monitor | live-monitor/ | 실시간 세션 JSONL 파싱 + 파일 변경 모니터링 |
| catalog | catalog/ | 에이전트/스킬/훅/룰 카탈로그 (검색/필터) |
| systems | systems/ | 외부 QJC 프로젝트 10개 연동 현황 |
| usage | usage/ | Claude Code 사용 통계 분석 |
| process | process/ | 개발 프로세스 가이드 + 파이프라인 React Flow |

### 데이터 레이어

- **`lib/types.ts`**: 모든 도메인 타입을 zod 스키마로 정의 (AgentNode, HookEvent, McpServer, PipelineEdge 등). 타입과 런타임 검증 동시 제공.
- **`lib/agent-category-map.ts`**: 에이전트→카테고리 매핑의 단일 진실점 (Single Source of Truth). `scan-system.ts`와 프론트엔드 양쪽에서 import.
- **`lib/DataProvider.tsx`**: Tauri IPC → React Context. 정적 JSON 폴백 내장.
- **`lib/api.ts`**: Tauri `invoke()`/`listen()` 래퍼. 모든 IPC 호출 한 곳에서 관리.
- **`lib/parsers/`**: 각 도메인별 파서 (agent, hook, mcp, pipeline, rule, session).

### 디자인 시스템

Palantir Blueprint 다크 테마 기반:
- 배경: `#111418` → `#1C2127` → `#252A31`
- 보더/텍스트: `#404854` / `#ABB3BF`
- React Flow 노드: `memo()` 필수 (리렌더 방지)

## 코딩 컨벤션

- **feature 폴더 구조**: 각 뷰는 `features/<name>/` 하위에 뷰 + 하위 컴포넌트 + 커스텀 훅을 함께 배치
- **zod 경계 검증**: 외부 데이터(JSON, IPC) 진입점에서 zod 스키마로 검증
- **React Flow 노드**: 반드시 `React.memo()`로 래핑 (성능)
- **경로 별칭**: `@/` → `src/renderer/src/` (vite.config.ts + tsconfig.json)

## 주요 데이터 (system-data.json)

agents(50), skills(131), hooks(55), rules(39), pipelines(15), mcpServers(48), memory
