---
status: COMPLETED
created: 2026-05-22
decisions: "D1=본체+메뉴바 둘다 / D3=GitHub Releases+qjc-webapp 둘다 / D4=미서명+우회안내 / D2=번들스크립트 하이브리드(직원 node로 자기데이터 스캔, 폴백 스냅샷)"
scope: "cc-visualizer를 QJC 직원(3명, 전원 Mac)이 웹에서 다운로드해 쓸 수 있게 배포"

restate: |
  cc-visualizer(메뉴바 데몬 + Tauri 본체 앱)를 회사 직원이 자기 Mac에서 자기 Claude Code
  상태/사용량을 보도록 배포한다. 웹 다운로드 경로 + 직원 머신에서 동작하도록 하드코딩/스캔
  아키텍처 해결이 핵심.
---

# cc-visualizer 직원 배포 계획

## 조사 결과 (완료)
- **직원 3명 전원 Mac** (대표·PM 김광오·사원 장소영) — `company-docs/인사/pre-arrival.md`
- **qjc-webapp**: Next.js 15 + Vercel + Supabase RBAC(`requireManager`) + 다운로드 패턴(`useTemplateDownload`/`DownloadButton`) 이미 존재
- **qjc-os**: Edge Functions 백엔드, `download.html` 빈 파일 — 다운로드 페이지 부적합
- 회사 바이너리 앱 배포 전례 없음 (managed-settings.json sudo 배포가 가장 가까운 선례)

## 핵심 블로커 (직원 머신에서 안 되는 이유)
| # | 문제 | 위치 |
|---|------|------|
| B1 | `project_dir() = ~/projects/cc-visualizer` — 데이터를 외부 소스에서 읽음 | commands.rs:11 |
| B2 | `rescan`이 `npm run scan` 의존 (직원 머신에 npm+소스 없음) | commands.rs:129 |
| B3 | 데이터 JSON이 앱 번들 리소스 미포함 | tauri.conf.json |
| ✅ | scan-system.ts `-Users-sangrok` 하드코딩 | **수정 완료** (encodeHomeProjectDir) |
| ✅ | commands.rs npx fnm 특정 multishell 경로 | **수정 완료** (fnm default symlink) |

## 통찰: 두 컴포넌트의 배포 난이도가 다름
- **메뉴바 데몬** (menubar/) — ccusage를 각자 머신에서 호출 = **각자 데이터**. 거의 배포 가능 (fnm 경로만 검증).
- **본체 앱** (Tauri) — 빌드타임 스캔이라 직원이 자기 ~/.claude를 못 봄. 아키텍처 결정 필요.

## 사용자 결정 필요 사항 (DECISION GATE)

### D1. 배포 범위
- (a) **메뉴바 데몬만** — 빠름, 직원이 각자 사용량/병렬 즉시 확인. 사용자 이전 goal들과 일치.
- (b) 본체 앱도 — 풀 시각화. 단 아키텍처 변경 필요(아래 D2).
- (c) 둘 다

### D2. 본체 앱 아키텍처 (D1이 b/c일 때)
- (A) **번들 스냅샷** — sangrok 데이터를 앱에 포함. 직원은 "회사 시스템 뷰어"로 봄(자기 데이터 X). 최소 변경.
- (B) **런타임 스캔** — scan-system.ts(530줄)를 Rust 포팅. 직원이 자기 ~/.claude 시각화. 대규모 작업.

### D3. 배포 경로
- (a) **GitHub Releases + tauri-action** — qjc-webapp 수정 0, git tag push 시 .dmg 자동 빌드. 직원 GitHub 계정 필요.
- (b) **qjc-webapp /admin/tools + Supabase Storage** — 기존 RBAC/다운로드 UI 재사용. Next.js PR 필요.

### D4. 코드 서명 (notarization)
- (a) **미서명 + 우회 안내** — 직원에게 "시스템 설정 → 보안 → 열기 허용" 안내. 비용 0, 내부 3명엔 충분.
- (b) Apple Developer 서명 — $99/년, 경고 없음. 외부 배포 대비.

## 자율 진행 가능 (사용자 승인 무관, 즉시)
1. ✅ 하드코딩 제거 (scan-system.ts, commands.rs)
2. 메뉴바 빌드 스크립트는 이미 있음 (menubar/build.sh)
3. GitHub Actions tauri-action 워크플로우 작성 (D3-a 채택 시)
4. 직원 설치 안내 문서 (README 또는 company-docs)

## 사용자 승인 필수 (외부 발행 / 회사 인프라)
- git tag push → GitHub Release 발행
- Apple 서명 인증서 설정
- qjc-webapp PR (D3-b 채택 시)
- 직원 안내 발송

## 권장 (최소 비용 MVP)
**D1=a(메뉴바 우선) + D3=a(GitHub Releases) + D4=a(미서명+안내)**
→ 직원이 가장 빨리 자기 사용량/병렬 상태를 메뉴바에서 확인. 본체 앱은 D2 결정 후 후속.

## 구현 완료 (2026-05-22)
사용자 결정: D1=둘다 / D2=번들스크립트 하이브리드 / D3=둘다 / D4=미서명+안내

| 항목 | 산출물 | 검증 |
|------|--------|------|
| 본체 앱 직원 동작 | commands.rs 3단계 폴백(캐시→번들→개발) + tauri.conf resources 6개 + scan SCAN_OUTPUT_DIR | cargo check 0, build 0, test 197 |
| 빌드 파이프라인 | .github/workflows/release.yml (tauri-action 미서명 + 메뉴바 zip) | YAML valid |
| 메뉴바 설치 | menubar/install.sh + com.qjc.cc-menubar.plist.template (__INSTALL_DIR__ 치환) | bash -n OK |
| 직원 안내 | docs/INSTALL-for-employees.md (미서명 우회 3방법) | — |
| 웹 다운로드 설계 | docs/qjc-webapp-download-page-spec.md (/admin/tools + GitHub Releases API) | — |

직원 머신 동작: node 있으면 rescan으로 자기 데이터 스캔(app_data_dir 캐시), 없으면 번들 스냅샷 표시.

## 사용자 승인 대기 (외부 발행 — 미실행)
1. `git tag v1.0.0 && git push origin v1.0.0` → GitHub Release 자동 빌드
2. qjc-webapp `/admin/tools` PR (spec 문서 기반, GitHub Releases API fetch)
3. 직원 Supabase role=manager 확인 (김광오/장소영)
4. cc-visualizer 리포 private 시 Vercel GITHUB_TOKEN(read:releases) 추가
5. 직원에게 INSTALL 문서 발송
