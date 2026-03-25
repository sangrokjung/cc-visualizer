# cc-visualizer

Claude Code 시스템 시각화 도구. 에이전트, 스킬, 훅, 룰, 파이프라인, MCP 서버를 팔란티어 다크 테마로 시각화한다.

## 기술 스택

- **런타임**: Electron 36 + electron-vite 3
- **프론트엔드**: React 19 + TypeScript 5.8 + Tailwind CSS 3.4
- **그래프**: @xyflow/react 12 (React Flow) + dagre 0.8 (자동 레이아웃)
- **차트**: recharts 2.15
- **검증**: zod 3.25
- **테스트**: Vitest 3.2 + @testing-library/react 16 + jsdom
- **데이터**: 정적 JSON (`scripts/scan-system.ts` -> `src/renderer/src/data/system-data.json`)

## 빌드 & 테스트

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run test         # Vitest 실행
npm run test:watch   # Vitest 워치 모드
npm run scan         # system-data.json 재생성
npm run dist         # Electron 패키징 (macOS)
```

## 디렉토리 구조

```
src/
  main/              # Electron 메인 프로세스
  preload/           # Electron 프리로드 스크립트
  renderer/src/
    App.tsx           # 앱 셸 (ViewType 라우팅)
    components/       # Layout, Sidebar, SearchBar
    data/             # system-data.json + external-systems.json
    features/
      dashboard/      # 시스템 개요 대시보드 (9개 시각화 컴포넌트)
      agent-map/      # React Flow 에이전트 관계도 (팔란티어 테마)
      architecture/   # 시스템 아키텍처 뷰
      live-monitor/   # 실시간 모니터링 뷰
      catalog/        # 카탈로그 뷰
      systems/        # 외부 시스템 생태계 뷰 (10개 프로젝트)
    lib/
      parsers/        # 데이터 파서
      types.ts        # 공용 타입 정의
      search-index.ts # 검색 인덱스
scripts/
  scan-system.ts      # Claude Code 시스템 스캔 -> JSON 생성
```

## 코딩 컨벤션

- **디자인**: Palantir Blueprint 다크 (#111418, #1C2127, #252A31, #404854)
- **패턴**: feature 폴더 구성, memo(React Flow 노드), zod(경계 검증)
- **데이터**: scan-system.ts → system-data.json → 뷰 컴포넌트

## 주요 데이터 (system-data.json)

agents(46), skills(131), hooks(53), rules(34), pipelines(13), mcpServers(48), memory
