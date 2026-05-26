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
npm run test         # vitest run (23 files, 193 tests)
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

- 메뉴바: 펄스 도트(활성=초록/idle=회색) + 7일 비용 스파크라인 + 7슬롯 롤링(오늘/토큰/누적/총/병렬/주간/모델)
- 드롭다운: 14일 추이 막대 차트 + 병렬 세션 게이지
- 데이터: `npx ccusage daily --json` (fnm symlink 직접 spawn, 142KB JSON은 tmp 파일 redirect로 pipe deadlock 회피)
- 병렬 감지: `pgrep -f '^claude'` 인스턴스 수

## 직원 배포 (docs/INSTALL-for-employees.md)

직원(전원 Mac)이 자기 Claude Code 상태를 보도록 배포. 본체 앱 + 메뉴바 데몬 둘 다.

- **빌드**: `git tag v* && git push` → `.github/workflows/release.yml`이 GitHub Release에 .dmg + 메뉴바 zip 자동 첨부 (미서명)
- **본체 앱 직원 동작**: commands.rs 3단계 폴백 — 사용자 캐시(app_data_dir) → 번들 스냅샷(resources) → 개발 소스. node 있으면 rescan으로 자기 ~/.claude 스캔, 없으면 번들 스냅샷.
- **웹 다운로드**: qjc-webapp `/admin/tools` (GitHub Releases API fetch + requireManager) — 설계는 docs/qjc-webapp-download-page-spec.md
- 상세 계획: `.claude/plan-employee-distribution.md`

## 주요 디렉토리 구조

```
src/renderer/src/
├── features/     # 9개 뷰 (dashboard, agent-map, agent-office 등)
│   └── dashboard/GamificationPanel.tsx  # 레벨/XP/스트릭/업적 (lib/gamification.ts)
├── lib/          # types.ts(zod), gamification.ts, DataProvider.tsx, api.ts, agent-category-map.ts, parsers/
├── data/         # system-data.json (정적 스냅샷) + ccusage-snapshot.json (dev 폴백, gitignore)
└── App.tsx       # ViewType 상태로 뷰 전환
src-tauri/src/    # Rust 백엔드 (commands, file_watcher, session_watcher)
menubar/Sources/  # macOS 메뉴바 Swift 데몬 (main.swift) — 위 "맥 메뉴바 데몬" 참조
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
