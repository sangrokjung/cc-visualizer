---
status: COMPLETED
created: 2026-05-22
approved_by: auto-ship
scope: "Claude Code 상태 가시화 (맥 메뉴바) + cc-visualizer 데이터 정합 + 게이미피케이션"

restate: |
  Claude Code 현재 상태/사용량을 (1) macOS 메뉴바에 항상 표시하고,
  (2) cc-visualizer 시스템 개요·에이전트 오피스가 실제 ~/.claude 데이터와
  정확히 동기화되도록 하며, (3) 게이미피케이션(레벨/XP/스트릭/업적)을 추가한다.

acceptance_criteria:
  - id: AC1
    desc: "macOS 메뉴바에 오늘 Claude Code 비용/토큰이 표시되고 로그인 시 자동 실행"
    verifier: "test -f ~/Library/LaunchAgents/com.qjc.cc-menubar.plist && test -x cc-visualizer/menubar/.build/cc-menubar 또는 컴파일 산출물 존재"
    status: pending
  - id: AC2
    desc: "cc-visualizer dashboard/agent-office에 하드코딩된 옛 수치(99/162/49 등) 0건, 실데이터 바인딩"
    verifier: "grep -rE '\\b(99|162|49)\\b' src/renderer/src/features 결과가 실데이터 외 하드코딩 아님 + npm run test green"
    status: pending
  - id: AC3
    desc: "게이미피케이션 패널 — 레벨/XP/스트릭/업적이 ccusage+system-data 기반으로 계산"
    verifier: "npm run test (게이미피케이션 테스트 포함) green + npm run build exit 0"
    status: pending

constraints:
  - "트랙 A는 cc-visualizer 코드 수정 금지 (menubar/ 새 디렉토리 + ~/Library/LaunchAgents + ~/.claude/statusline.sh만)"
  - "트랙 C는 새 파일만 생성, 기존 뷰 파일 수정 금지 (통합은 메인 세션)"
  - "ccusage 호출은 commands.rs의 npx 다중 fallback PATH 패턴 재사용"
  - "zod 경계 검증 유지, 파일 800줄/함수 50줄 한계"
  - "Palantir 다크 테마 디자인 시스템 준수 (.claude/rules/architecture.md)"

out_of_scope:
  - "ccusage 자체 재구현 (기존 npx ccusage 위임 유지)"
  - "Tauri system tray (메뉴바는 독립 Swift 데몬으로)"
  - "온라인 리더보드/소셜 기능"

impact:
  files_changed: 12
  core_logic_changed: true
  hard_gate_required: true
---

# 구현 계획: Claude Code 상태 가시화 + 게이미피케이션

## 트랙 A — macOS 메뉴바 데몬 (독립, cc-visualizer 밖)
- Swift NSStatusItem 단일 앱 (`menubar/Sources/main.swift`)
- 메뉴바: `🤖 $X.XX` (오늘 비용), 드롭다운에 토큰/주간/세션
- ccusage daily --json 파싱 (npx 다중 fallback)
- LaunchAgent plist (로그인 자동 실행) + build.sh
- statusline.sh 개선 (모델 + 오늘 비용)

## 트랙 B — cc-visualizer 데이터 정합 (기존 컴포넌트)
- dashboard StatCards/MetricStrip 실데이터 바인딩 검증
- 하드코딩된 옛 수치 검색·제거
- agent-office 실제 에이전트 표시 검증
- DataProvider 폴백 로직 점검

## 트랙 C — 게이미피케이션 (새 파일만)
- `lib/gamification.ts` (XP/레벨/스트릭/업적 계산 + zod)
- `features/dashboard/GamificationPanel.tsx`
- `__tests__/gamification/` 테스트
- 통합(DashboardView import)은 메인 세션이 수행
