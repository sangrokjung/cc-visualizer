---
description: "cc-visualizer 코딩 컨벤션 - feature 구조, zod 경계, React Flow memo"
paths:
  - "src/renderer/**/*.ts"
  - "src/renderer/**/*.tsx"
---

# cc-visualizer 코딩 컨벤션

## feature 폴더 구조

각 뷰는 `features/<name>/` 하위에 뷰 + 하위 컴포넌트 + 커스텀 훅을 함께 배치.
- 파일 크기: 800줄 이하 유지 (컴포넌트는 150줄 목표)
- 함수 크기: 50줄 이하
- 중첩 깊이: 4단계 이하

## 경계 검증

- **zod 경계 검증**: 외부 데이터(JSON import, Tauri IPC) 진입점에서 zod 스키마로 검증
- 스키마 정의 위치: `lib/types.ts` 중앙 관리
- 런타임 타입 + 정적 타입 동시 제공

## React Flow 노드

- 반드시 `React.memo()`로 래핑 (성능)
- 커스텀 노드에 `<Handle type="target/source">` 필수 (엣지 연결점)
- 커스텀 비교 함수 권장: `data` 객체가 매 렌더 새로 생성되면 memo 효과 없음

## useMemo deps 최소화 (성능)

- 자주 변하는 값(5초 tick 등)을 useMemo deps에 포함하면 메모이제이션 무력화
- 레이아웃(static)과 상태(dynamic)를 별도 훅으로 분리하여 재계산 방지
- 예: `use-office-layout` (static) + `use-agent-node-data` (dynamic) 2단계 패턴

## 경로 별칭

- `@/` → `src/renderer/src/` (vite.config.ts + tsconfig.json)
- `vite-tsconfig-paths` 플러그인으로 Vite와 tsc 모두 인식

## tsconfig.json 중요 옵션

- **`noEmit: true` 필수**: `tsc`가 `src/`에 `.js`/`.d.ts` 자동 생성 차단 → Vite stale 파일 오염 방지
- `npm run build`는 `tsc && vite build`로 타입 체크만 수행하고 번들은 Vite가 담당

## 테스트 관행

- 위치: `__tests__/<feature>/` (프로젝트 루트)
- `vitest.config.ts` `include: ['__tests__/**/*.test.ts(x)']`
- `vi.hoisted()` 필수: `vi.mock` 팩토리에서 외부 변수 참조 시
- `agentIds` 등 인라인 배열 전달 금지 → stable 참조 배열 사용
