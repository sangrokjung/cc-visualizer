# CC Visualizer 설치 가이드

> QJC 직원 전용. 설치 중 막히는 부분이 있으면 대표님께 문의해 주세요.

---

## CC Visualizer가 뭔가요?

CC Visualizer는 내가 지금 Claude Code를 얼마나, 어떻게 쓰고 있는지 바로 확인할 수 있는 사내 전용 도구예요. 메뉴바 아이콘 하나로 오늘 토큰 사용량·병렬 실행 현황·일별 추이를 실시간으로 볼 수 있고, 클릭 한 번으로 에이전트 맵·스킬·훅·파이프라인까지 한눈에 시각화된 풀 대시보드를 열 수 있어요.

두 가지를 설치해요.

| 구성 | 설명 | 실행 방식 |
|------|------|----------|
| **메뉴바 데몬** | 상단 메뉴바에 상주하며 실시간 사용량 표시 | 로그인 시 자동 시작 |
| **본체 앱 (CC Visualizer.app)** | 풀 대시보드, 에이전트/스킬/훅 시각화 | 메뉴바 아이콘 클릭 또는 직접 실행 |

---

## 사전 요구사항

- macOS 13 (Ventura) 이상
- **Node.js / npx** — Claude Code를 이미 쓰고 계시면 거의 설치돼 있어요. 확인하려면 터미널에서 `node -v` 입력. 버전이 나오면 OK.

---

## 1단계: 설치 파일 다운로드

아래 두 파일을 다운로드해 주세요. 다운로드 링크는 QJC 내부 채널(또는 [qjc.kr/admin/tools](https://qjc.kr/admin/tools))에서 확인하실 수 있어요.

- `CC-Visualizer-v2.0.0.dmg` — 본체 앱
- `cc-menubar-install.zip` — 메뉴바 데몬 (바이너리 + 설치 스크립트 포함)

---

## 2단계: 메뉴바 데몬 설치

메뉴바 데몬은 **설치 스크립트 한 번 실행**으로 끝나요.

### 2-1. 압축 해제

다운로드한 `cc-menubar-install.zip`을 더블클릭해서 압축을 풀어 주세요.

### 2-2. 터미널 실행 후 설치

```bash
# 압축 해제된 폴더로 이동 후
chmod +x install.sh
./install.sh
```

스크립트가 알아서 바이너리를 `~/.local/bin/cc-menubar`에 복사하고, 로그인 시 자동 시작을 등록해요.

### 2-3. 결과 확인

설치가 완료되면 메뉴바 우측 상단에 작은 아이콘이 나타나요.

> **메뉴바에 아이콘이 안 보인다면:** 아래 "미서명 우회" 섹션을 먼저 적용한 뒤, 터미널에서 `~/.local/bin/cc-menubar &` 를 직접 실행해 보세요.

---

## 3단계: 본체 앱 설치

### 3-1. DMG 열기

`CC-Visualizer-v2.0.0.dmg`를 더블클릭하면 설치 창이 열려요.

### 3-2. Applications로 드래그

CC Visualizer 아이콘을 Applications 폴더로 드래그하면 설치 완료예요.

<!-- 스크린샷 placeholder -->
<!-- ![DMG 설치 화면](./screenshots/dmg-install.png) -->

### 3-3. 앱 실행

Launchpad 또는 Spotlight(`Cmd + Space` → "CC Visualizer")로 실행하면 돼요.

---

## 미서명 우회 (CRITICAL — 반드시 해야 해요)

QJC 내부 배포 빌드는 Apple 공식 서명이 없어서, 처음 실행할 때 "확인되지 않은 개발자" 경고가 나와요. 아래 방법 중 하나로 우회하면 다음부터는 자동으로 열려요.

### 방법 1: 우클릭으로 열기 (가장 쉬움)

1. Finder에서 `CC Visualizer.app`을 **우클릭 (또는 Ctrl + 클릭)**
2. 메뉴에서 "열기" 선택
3. 경고 창이 뜨면 "열기" 버튼 클릭

한 번만 하면 이후로는 그냥 더블클릭으로 열려요.

<!-- 스크린샷 placeholder -->
<!-- ![우클릭 열기](./screenshots/gatekeeper-open.png) -->

### 방법 2: 시스템 설정에서 허용

1. 시스템 설정 → 개인정보 보호 및 보안
2. 하단 "보안" 섹션에서 "확인 없이 열기" 버튼 클릭

<!-- 스크린샷 placeholder -->
<!-- ![시스템 설정 보안](./screenshots/security-settings.png) -->

### 방법 3: 터미널 명령어 (한 방에 해결)

터미널에 다음 두 줄을 붙여넣고 Enter:

```bash
# 본체 앱 격리 속성 제거
xattr -dr com.apple.quarantine /Applications/CC\ Visualizer.app

# 메뉴바 바이너리 격리 속성 제거
xattr -d com.apple.quarantine ~/.local/bin/cc-menubar
```

명령 실행 후 앱을 열면 경고 없이 바로 실행돼요.

---

## 사용 방법

### 메뉴바에서 바로 확인

- 메뉴바 아이콘을 클릭하면 오늘 토큰 소비·비용·병렬 실행 현황이 팝업으로 보여요
- "대시보드 열기" 클릭 → 본체 앱이 실행돼요

<!-- 스크린샷 placeholder -->
<!-- ![메뉴바 팝업](./screenshots/menubar-popup.png) -->

### 본체 앱 대시보드

- **에이전트 맵** — 에이전트 연결 관계와 상태
- **에이전트 오피스** — 실시간 활성 에이전트 현황
- **토큰 Economy** — 오늘/어제/주간/전체 사용량
- **파이프라인** — 에이전트 실행 흐름
- 그 외 스킬·훅·룰·MCP 서버 시각화

<!-- 스크린샷 placeholder -->
<!-- ![대시보드 전체](./screenshots/dashboard-full.png) -->

---

## 트러블슈팅

### 메뉴바 아이콘에 데이터가 안 떠요

1. 터미널에서 `node -v` 확인 → 버전이 안 나오면 [Node.js 설치](https://nodejs.org/ko/)
2. `~/.local/bin/cc-menubar &` 로 데몬 직접 시작해 보세요
3. 로그 확인: `cat ~/.local/share/cc-menubar/cc-menubar.log`

### 본체 앱 화면이 비어 있어요

데이터 파일이 아직 생성되지 않았을 수 있어요.

1. 앱 좌측 하단의 **"Rescan"** 버튼 클릭
2. 그래도 안 되면 Claude Code를 한 번 실행해서 세션을 생성한 뒤 다시 시도해 보세요

### "확인되지 않은 개발자" 경고가 계속 나와요

위 "미서명 우회 방법 3 (터미널)"을 적용해 주세요. 방법 1, 2로도 안 해결될 때 가장 확실해요.

### 앱이 갑자기 꺼져요 (M1/M2/M3 Mac)

터미널에서 다음 명령 실행 후 재시도:

```bash
xattr -dr com.apple.quarantine /Applications/CC\ Visualizer.app
```

---

## 업데이트

새 버전이 나오면 내부 채널로 공지가 가요. 업데이트 방법:

1. 기존 `CC Visualizer.app`을 Applications에서 삭제
2. 새 `.dmg`로 다시 설치 (설정은 그대로 유지돼요)
3. 메뉴바 데몬은 `./install.sh`를 다시 실행하면 돼요

---

*설치 중 막히는 부분이 있으면 편하게 알려 주세요.*
