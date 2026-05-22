---
description: "cc-visualizer 아키텍처 - 데이터 흐름, Tauri 백엔드, 프론트엔드 라우팅"
paths:
  - "src/renderer/**/*.ts"
  - "src/renderer/**/*.tsx"
  - "src-tauri/src/**/*.rs"
---

# cc-visualizer 아키텍처

## 데이터 흐름 (핵심)

```
~/.claude/ (에이전트/스킬/훅/룰 원본)
  ↓ scan-system.ts (Node.js 스크립트, gray-matter로 frontmatter 파싱)
src/renderer/src/data/system-data.json (정적 스냅샷)
  ↓ DataProvider (React Context)
각 feature 뷰 컴포넌트
```

Tauri 실행 시: Rust 백엔드(`commands.rs`)가 JSON 파일을 직접 읽어 IPC로 전달. `DataProvider`가 Rust 데이터를 우선 사용하고, 실패 시 정적 JSON import로 폴백.

## Tauri 백엔드 (src-tauri/src/)

| 파일 | 역할 |
|------|------|
| `lib.rs` | Tauri 앱 엔트리. 커맨드 등록 + 워처 시작 |
| `commands.rs` | IPC 커맨드 8개: read_file, list_dir, get_system_paths, rescan_system/usage, load_*_data |
| `file_watcher.rs` | `~/.claude/work-log`, `agent-memory` 디렉토리 감시 → `file-changed` 이벤트 emit |
| `session_watcher.rs` | `~/.claude/projects/*/` 에서 최신 JSONL 세션 파일 tail → `session-event` 이벤트 emit |

## 프론트엔드 라우팅

`App.tsx`의 `ViewType` 상태로 9개 뷰를 전환 (react-router 미사용). `Layout.tsx`에서 `React.lazy`로 코드 스플리팅.

| ViewType | Feature 폴더 | 설명 |
|----------|-------------|------|
| dashboard | dashboard/ | 온톨로지 그래프 + 9개 시각화 (StatCards, SystemRadar, SkillTreemap 등) |
| agent-map | agent-map/ | React Flow 에이전트 관계도 (dagre 레이아웃) |
| agent-office | agent-office/ | 에이전트 픽셀아트 + 3컬럼 BI 레이아웃 (KPI/Filter/Insight, Phase 2B) |
| architecture | architecture/ | 훅/파이프라인/메모리/룰 레이어 시각화 |
| live-monitor | live-monitor/ | 실시간 세션 JSONL 파싱 + 파일 변경 모니터링 |
| catalog | catalog/ | 에이전트/스킬/훅/룰 카탈로그 (검색/필터) |
| systems | systems/ | 외부 QJC 프로젝트 10개 연동 현황 |
| usage | usage/ | Claude Code 사용 통계 분석 |
| process | process/ | 개발 프로세스 가이드 + 파이프라인 React Flow |

## 데이터 레이어

- **`lib/types.ts`**: 모든 도메인 타입을 zod 스키마로 정의 (AgentNode, HookEvent, McpServer, PipelineEdge 등). 타입과 런타임 검증 동시 제공.
- **`lib/agent-category-map.ts`**: 에이전트→카테고리 매핑의 단일 진실점 (Single Source of Truth). `scan-system.ts`와 프론트엔드 양쪽에서 import.
- **`lib/DataProvider.tsx`**: Tauri IPC → React Context. 정적 JSON 폴백 내장.
- **`lib/api.ts`**: Tauri `invoke()`/`listen()` 래퍼. 모든 IPC 호출 한 곳에서 관리.
- **`lib/SessionEventsProvider.tsx`**: 세션 이벤트 전역 Context. `agentActivityMap`, `stats`, `recentTools` 제공 (Phase 2A).
- **`lib/hooks/use-count-up.ts`**: 공유 카운트업 애니메이션 훅 (Phase 2B).
- **`lib/parsers/`**: 각 도메인별 파서 (agent, hook, mcp, pipeline, rule, session).

## 디자인 시스템

Palantir Blueprint 다크 테마 기반:
- 배경: `#111418` → `#1C2127` → `#252A31`
- 보더/텍스트: `#404854` / `#ABB3BF`
- React Flow 노드: `memo()` 필수 (리렌더 방지)
