# CC Visualizer

> Claude Code와 Codex 운영 상태를 한 화면에서 확인하는 macOS 네이티브 관제 도구

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-087EA4?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Swift](https://img.shields.io/badge/macOS_Menu_Bar-Swift-F05138?logo=swift&logoColor=white)](./menubar)
[![GitHub Release](https://img.shields.io/github/v/release/sangrokjung/cc-visualizer?display_name=tag)](https://github.com/sangrokjung/cc-visualizer/releases/latest)

CC Visualizer는 Claude Code의 에이전트·스킬·훅·룰·파이프라인을 시각화하고, Claude/Codex 계정 상태와 토큰 사용량을 실시간에 가깝게 보여주는 Tauri 데스크톱 앱입니다. 별도의 Swift 메뉴바 앱을 함께 제공해 대시보드를 열지 않아도 사용량과 계정 풀 상태를 확인할 수 있습니다.

## 핵심 기능

| 영역 | 제공 기능 |
|---|---|
| 시스템 시각화 | Dashboard, Agent Map, Agent Office, Architecture, Catalog, Process |
| 실시간 모니터링 | Claude Code JSONL 세션 tail, 도구 호출·에이전트 활동·토큰 흐름 |
| 사용량 분석 | 오늘·주간·월간·누적 비용, USD/KRW 환산, 제공자·모델별 집계 |
| AI 계정 진단 | TeamClaude와 TeamCodex 서버 상태, 계정별 5시간/7일 사용량, 동시 요청 |
| macOS 메뉴바 | Claude/Codex 사용량, reset 남은 시간, 모델 현황, 계정 추가·전환 상태 |
| 직원 배포 | macOS arm64 DMG와 메뉴바 ZIP을 GitHub Release로 자동 생성 |

### 2026-07 업데이트

- TeamCodex 다계정 풀을 앱의 **AI 계정 진단**과 macOS 메뉴바에 연결했습니다.
- Codex 계정별 5시간·7일 사용률과 reset 남은 시간을 표시하고, 한도 도달 계정을 구분합니다.
- Claude/Codex/Gemini를 제공자·모델별로 분리해 월간 비용과 토큰을 집계합니다.
- Codex 세션 로그를 증분 캐시해 메뉴 클릭 때 전체 로그를 다시 읽지 않도록 개선했습니다.
- 메뉴 UI를 사전 구성해 반복 클릭 시 즉시 열리고, 새 데이터만 비동기로 반영됩니다.

## 동작 구조

```mermaid
flowchart LR
    Claude["~/.claude<br/>sessions · agents · skills"] --> Rust["Tauri Rust<br/>commands · watchers"]
    Codex["~/.codex<br/>sessions · account"] --> Rust
    TeamClaude["TeamClaude API"] --> Rust
    TeamCodex["TeamCodex API<br/>127.0.0.1:3457"] --> Rust
    Rust --> React["React 19 Dashboard"]

    Claude --> Swift["Swift Menu Bar"]
    Codex --> Swift
    TeamClaude --> Swift
    TeamCodex --> Swift
    Swift --> Cache["Local incremental cache<br/>permission 0600"]
```

데스크톱 앱은 Tauri command와 file watcher를 통해 로컬 데이터를 읽고, React 화면은 zod 스키마로 IPC 경계를 검증합니다. Swift 메뉴바는 독립 실행되며 Codex 세션 통계와 메뉴 구성을 로컬 캐시에 보관합니다. OAuth credential 원문은 화면이나 캐시에 저장하지 않습니다.

## 빠른 시작

### 요구사항

- macOS
- Node.js 20+
- Rust stable
- Xcode Command Line Tools

```bash
git clone https://github.com/sangrokjung/cc-visualizer.git
cd cc-visualizer
npm ci
npm run tauri dev
```

브라우저 UI만 확인하려면 다음 명령을 사용합니다.

```bash
npm run dev
```

### macOS 메뉴바 앱

```bash
bash menubar/build.sh
./menubar/.build/cc-menubar
```

로그인 시 자동 시작 설치와 직원 배포 방법은 [CC Visualizer 설치 가이드](./docs/INSTALL-for-employees.md)를 참고하세요.

## TeamClaude / TeamCodex 연동

AI 계정 진단 화면과 메뉴바는 로컬 런타임을 자동 감지합니다.

| 런타임 | 기본 확인 대상 | 표시 정보 |
|---|---|---|
| TeamClaude | 로컬 TeamClaude 상태 | 활성 계정, quota, Fable 주간 한도, 프록시 상태 |
| TeamCodex | `http://127.0.0.1:3457/teamclaude/status` | 계정 상태, 5시간/7일 사용률, reset, inflight, 요청·토큰 |
| Codex CLI | `~/.codex/sessions` | 현재 계정, 모델별 호출·토큰, 최근 활동 |

TeamCodex 서버가 꺼져 있거나 quota가 아직 측정되지 않은 계정은 값을 추측하지 않고 `오프라인` 또는 `—`로 표시합니다. 실제 quota는 upstream 응답 헤더가 들어온 뒤 갱신됩니다.

## 사용량과 환율

- `ccusage daily`, `weekly`, `monthly` 결과를 합쳐 오늘·주간·월간·누적 통계를 계산합니다.
- Claude, Codex, Gemini 등 provider와 model별 비용·토큰을 분리합니다.
- USD/KRW 환율은 공개 환율 API를 사용하고 12시간 로컬 캐시 후, 네트워크 실패 시 fallback 값을 사용합니다.
- 실사용 스냅샷과 개인별 통계 파일은 Git에 포함하지 않습니다.

## 반응속도 최적화

2026-07-24 로컬 대용량 세션 데이터 기준 측정이며, 실제 값은 세션 수와 디스크 상태에 따라 달라집니다.

| 경로 | 개선 전 | 개선 후 |
|---|---:|---:|
| Codex 세션 통계 새 프로세스 로드 | 약 111초 전체 스캔 | 약 42ms 증분 캐시 |
| 메뉴 재오픈 | 매번 전체 구성 | 약 5ms 사전 구성 메뉴 |
| 전체 상태 스냅샷 렌더 | 약 142초 | 약 0.26초 |

캐시는 `~/.codex/cache/cc-menubar-session-stats-v1.json`에 `0600` 권한으로 저장하며, 파일 크기·수정 시각이 바뀐 세션만 다시 읽습니다.

## 개발 명령

```bash
npm run build                         # TypeScript + Vite
npm test                              # Vitest
cargo test --manifest-path src-tauri/Cargo.toml
bash menubar/build.sh                 # Swift 메뉴바 컴파일
npm run scan                          # Claude 시스템 스냅샷 재생성
npm run scan:usage                    # 사용량 스냅샷 재생성
```

주요 디렉토리:

```text
src/renderer/src/     React UI와 데이터 집계
src-tauri/src/        Tauri IPC command와 file/session watcher
menubar/Sources/      Swift 메뉴바 앱
menubar/Tests/        Swift 로직 테스트
scripts/              로컬 Claude 시스템·사용량 스캐너
__tests__/            Vitest 테스트
docs/                 설치·배포 문서
```

## 배포

`v*` 태그를 push하면 [Release workflow](./.github/workflows/release.yml)가 다음 산출물을 생성합니다.

- macOS arm64 `.dmg`
- Tauri `.app.tar.gz`
- Swift 메뉴바 `cc-menubar-<tag>.zip`

최신 설치 파일은 [GitHub Releases](https://github.com/sangrokjung/cc-visualizer/releases/latest)에서 받을 수 있습니다. 현재 배포본은 미서명이므로 최초 실행 시 설치 가이드의 Gatekeeper 허용 절차가 필요합니다.

## 보안·개인정보

- OAuth token과 credential 원문을 UI, README, Git 스냅샷에 기록하지 않습니다.
- `.codex`, `.omo`, 개인 사용량 스냅샷과 이메일 초안은 Git에서 제외합니다.
- 로컬 캐시는 사용자만 읽을 수 있도록 `0600` 권한을 적용합니다.
- TeamCodex 상태 API는 기본적으로 localhost 경로만 사용합니다.

## 문서

- [직원 설치 가이드](./docs/INSTALL-for-employees.md)
- [기능 명세](./spec.md)
- [구현 계획](./prompt_plan.md)
- [qjc-webapp 다운로드 페이지 연동 스펙](./docs/qjc-webapp-download-page-spec.md)
