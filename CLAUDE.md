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
npm run test         # vitest run (14 files, 100 tests)
npm run scan         # system-data.json 재생성
npm run scan:usage   # 사용 통계 재생성 (usage 뷰용)
npm run tauri        # Tauri CLI (npm run tauri dev / build)
```

단일 테스트: `npx vitest run <파일패턴>`
Tauri 개발: `npm run tauri dev` (Rust 백엔드 + Vite 동시 실행)

## 주요 디렉토리 구조

```
src/renderer/src/
├── features/     # 9개 뷰 (dashboard, agent-map, agent-office 등)
├── lib/          # types.ts(zod), DataProvider.tsx, api.ts, agent-category-map.ts, parsers/
├── data/         # system-data.json (정적 스냅샷)
└── App.tsx       # ViewType 상태로 뷰 전환
src-tauri/src/    # Rust 백엔드 (commands, file_watcher, session_watcher)
__tests__/        # Vitest 테스트 (프로젝트 루트)
```

## 주요 데이터 (system-data.json 기준)

agents(99), skills(162), hooks(97), rules(49), pipelines(18), mcpServers(47)

*수치는 scan-system.ts 파싱 결과 — hooks는 settings.json 등록 command 단위 (29 matchers / 97 commands), skills는 ~/.claude/commands 하위 디렉토리+파일, rules는 ~/qjc-office/dotclaude/rules 기준. 2026-05-13 스캔.*

## Git 워크플로우

- 브랜치: `feat/<기능명>` → PR 생성 → 머지 후 `--delete-branch`
- 커밋: Conventional Commits (feat/fix/refactor/docs/test/chore)
- 검증: `npm run test` → `/handoff-verify` 스킬로 fresh-context 독립 검증

## Rules 참조

상세 규칙은 `.claude/rules/` 참조:
- `architecture.md` — 데이터 흐름, Tauri 백엔드, 프론트엔드 라우팅, 데이터 레이어, 디자인 시스템
- `coding-conventions.md` — feature 구조, zod 경계, React Flow memo, useMemo deps, tsconfig
