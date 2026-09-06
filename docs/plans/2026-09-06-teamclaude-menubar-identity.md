# 실행 계획 및 검증 기록

Spec: docs/specs/2026-09-06-teamclaude-menubar-identity.md

## 최종 결과 — 2026-09-06

- [PR #10](https://github.com/sangrokjung/cc-visualizer/pull/10)을 `feat/weekly-monthly-krw-usage`에 머지했다. 머지 시각은 2026-09-06 18:14:25 KST다. `main` 반영 및 PR #9 머지는 이번 범위에 포함하지 않았다.
- 검토·실행 대상 소스: `3c12a232ab221615220d163b7b31161e1aa08268`.
- 머지 커밋: `7a382dce4853e1847e07bbfda13c0d7473b7f0fa`.
- 원인: 앱의 상태 조회에 인증·계정 식별 헤더가 빠져 서버가 이름 없는 응답을 반환했다. 앱은 이를 `unknown` 행으로 만들고 같은 로컬 설정 계정들을 미반영 행으로 추가해 16개 계정을 32행으로 표시했다. 이 잘못된 차이를 자동 복구 판단에도 사용했다.
- 수정: 기존 HTTP helper에 설정의 조회 키를 전달하고 redirect를 거부한다. 익명·혼합·불완전·malformed JSON의 HTTP 성공 응답은 식별 미확인으로 구분해 중복 행, 허위 drift, 과거 quota 복원, 불필요한 복구 판단을 막는다. 실제 빈 계정 배열·누락 계정의 drift는 유지한다.
- 재발 방지: 실제 Swift loader·표시 상태 변환·복구 판단을 실행하는 회귀 테스트 6개를 추가했다. 메뉴바 관련 PR 및 대상 브랜치 push와 릴리스 workflow에 테스트·빌드를 연결했다.

## 최종 검증 증거

| 검증 | 결과 | 근거 |
|---|---|---|
| 최종 소스 회귀 테스트 및 Swift 빌드 | PASS, 테스트 6개 | [CI 34023414237](https://github.com/sangrokjung/cc-visualizer/actions/runs/34023414237), checkout SHA 별도 assertion |
| 동일 프로세스의 완전한 quota cache 전이 | PASS, 추가 테스트 1개 | [CI 34023902208](https://github.com/sangrokjung/cc-visualizer/actions/runs/34023902208) |
| PR의 회귀 테스트 및 빌드 | PASS | [CI 34024001918](https://github.com/sangrokjung/cc-visualizer/actions/runs/34024001918) |
| 머지 후 대상 브랜치 테스트 및 빌드 | PASS | [CI 34024085839](https://github.com/sangrokjung/cc-visualizer/actions/runs/34024085839) |
| 최종 소스의 CI 바이너리로 실제 서버 조회 | rc=0, reachable=true, 16행, unknown=0, configured=0 | [CI 34023685001](https://github.com/sangrokjung/cc-visualizer/actions/runs/34023685001) artifact와 로컬 바이너리 바이트 일치 확인 후 `--selftest` 실행 |
| 독립 검토 | 목표·품질·보안·맥락·QA·runtime audit PASS, CRITICAL/HIGH 없음 | full SHA에 연결된 로컬 검토 원장 및 PR 본문 |

추가 전이 검증은 한 프로세스에서 `normal → anonymous → normal`을 순서대로 처리하고 직전 표시 상태를 다음 호출에 넘겼다. 주간/Fable quota pair와 usable 수는 각각 `2 → 0 → 2`, 행 수는 `2 → 2 → 2`, drift는 항상 0, recovery는 항상 false였다. 이 추가 harness는 임시 CI 브랜치에서만 실행했으며 제품 저장소의 상시 테스트 6개에 포함된 것으로 세지 않는다. 추후 같은 검증을 재실행할 때는 [해당 CI 커밋의 harness](https://github.com/sangrokjung/cc-visualizer/blob/9bd253a034973aed2810b33221b8417fe9d2e2b1/ci_transition_audit.py)와 [workflow](https://github.com/sangrokjung/cc-visualizer/blob/9bd253a034973aed2810b33221b8417fe9d2e2b1/.github/workflows/menubar-status.yml)를 참조한다.

실제 바이너리 SHA-256: `bd654f75a61c9f49a1b8065dd8591bb82e3d0746124f4a3eef898cfa77dfcbd6`. GUI 픽셀 검증은 수행하지 않았다. 실제 바이너리의 상태 파싱, HTTP fixture, 표시모델·복구 판단을 검증했으며 GUI 전체 동작 검증으로 확대 해석하지 않는다.

## 검증 경로 전환 및 공식 승인 한계

- 최종 로컬 테스트 `1788678804121564000-11966`와 빌드 `1788678804338089000-11987`는 머신 부하 게이트에서 실행 전 대기했다. 부하 기준 변경이나 다른 작업 프로세스 종료 없이 임시 CI 브랜치의 GitHub macOS 러너로 같은 소스 SHA를 검증했다.
- 클라우드 검증 성공 후 실행 전이던 해당 두 잡만 취소했다. 로컬 대기·취소를 성공 증거로 기록하지 않는다.
- 공식 gate receipt는 **UNVERIFIED / 미발급**이다. 이전 dispatch는 기존 GitHub secrets 참조 및 Swift optional binding을 오탐했고, 최종 SHA의 재시도는 `stale-evidence`로 거절됐다. 클라우드 CI 결과는 공식 로컬 evidence로 자동 수락되지 않았다.
- 위 제한을 사용자에게 공개한 뒤 후속 “적대적 검토하고 머지해” 요청에 따라 새 독립 적대 검토·runtime audit와 exact SHA CI를 근거로 머지했다. 일반 reviewer PASS를 공식 gate APPROVE로 기록하지 않는다. 자동 승인 인프라의 오탐·evidence 연동 문제 자체는 미해결 상태다.
- 검증용 원격 `ci/identity-3c12a23` 브랜치와 임시 CI 작업트리는 정리했다. PR의 수정 원격 브랜치도 머지 후 삭제했다. CI 실행 기록은 위 링크로 남긴다.

## 운영 반영 및 롤백 상태

운영 앱에는 아래의 이전 로컬 긴급 수정이 적용되어 있다. 최종 GitHub 재발 방지 소스의 CI 바이너리는 `--selftest`로 실행했으며 운영 바이너리를 덮어쓰거나 재설치하지 않았다. 기존 운영 작업트리의 다른 미공개 기능을 되돌리지 않기 위한 구분이다. 따라서 **GitHub 머지 완료와 최종 재발 방지 버전의 운영 재배포 완료는 같은 상태가 아니다.**

GitHub 변경은 PR #10의 revert PR로 되돌릴 수 있다. 운영 긴급 수정 롤백은 아래 기록된 백업 바이너리를 복원한 뒤 메뉴바만 재기동하는 절차이며, 프록시·계정 설정은 변경하지 않는다.

## GitHub 재발 방지 구현 이력

- 대상: fix/teamclaude-status-identity → feat/weekly-monthly-krw-usage. 이번 수정이 의존하는 최신 TeamClaude·TeamCodex 메뉴바 기반이 main에 없어 기존 PR #9는 머지하지 않았다. main에도 메뉴바 소스 자체는 존재한다.
- 완료: 인증 상태 조회 및 리다이렉트 차단을 원격 기반 브랜치에 이식했다. 이름 없는/불완전 상태 응답은 조회 인증 경고로 처리하며 중복 행과 허위 drift 및 자동 복구를 막는다.
- 완료: 실제 Swift 앱의 loader와 표시 상태 변환을 로컬 HTTP fixture로 실행하는 6개 테스트를 추가했다. PR 및 릴리스 workflow에 같은 테스트와 빌드를 배선했다.
- RED: qgate 1788676694826045000-20780, 6개 테스트 실행 중 9개 assertion 실패. 중복 unknown 행, 잘못된 drift, redirect 수락을 재현했다.
- GREEN: qgate 1788677237971107000-12254, 6개 테스트 통과. fixture 사용량에 유효한 미래 reset을 추가해 실제 quota 계약을 반영했다.
- 빌드: qgate 1788677238196377000-12273, rc=0. 실제 새 바이너리 --selftest는 16개 계정과 unknown/configured 0개를 확인했다.
- 문서 동기화: 구현 계약과 이 문서를 대조했다. housekeeping scan에서 민감 정보 발견 0건. 관련 없는 소스 Claude 설정은 변경하지 않았다.
- 린트: 새 workflow actionlint 통과. release workflow의 기존 SC2086은 기준 커밋에도 있어 범위 밖으로 유지, 두 workflow의 비-ShellCheck 검사 통과.
- 디버깅 가설: 서버 장애는 HTTP 200으로 배제, stale 화면만의 문제는 독립 바이너리 재현으로 배제, identity 헤더 누락은 헤더 유무에 따른 실제 HTTP 결과로 확인했다.
- 리뷰·머지: 위 최종 SHA에 고정해 독립 검토 및 runtime audit를 완료했다. 결과는 작업트리 외부 원장에 보관하며, PR CI 통과 후 `--match-head-commit`으로 검토 SHA를 지정해 머지했다.
- 롤백: PR revert로 GitHub 변경을 되돌릴 수 있다. 운영 바이너리는 이전 긴급 수정 버전을 유지하므로 원격 이전 기능으로 덮어쓰지 않는다.
- 보안 리뷰 보강: HTTP 200의 malformed JSON도 네트워크 장애와 구분해 조회 인증 경고로 처리한다. 자동 재시작 금지를 회귀 케이스에 포함했다.
- 공식 게이트: 격리 작업트리에서 begin과 unittest run-evidence는 정상 수락했다. dispatch-review의 secret scanner는 기존 GitHub secrets 참조 두 줄과 Swift optional binding 한 줄을 비밀 값으로 오탐했다. 값 유출은 없으며 설정 변경·스캐너 우회는 하지 않는다. 독립 lane 결과 및 GitHub CI와 이 인프라 제한을 분리 기록한다.

## 이전 로컬 긴급 수정 이력

아래 기록은 GitHub 반영 전의 운영 앱 긴급 수정이며, 현재 재발 방지 브랜치의 해시·테스트 수와 구분한다.

1. [완료] 기존 HTTP helper 재사용 및 config 키 배선. 익명/인증/실패/redirect 경계 회귀 테스트 추가.
2. [완료] qgate 빌드 및 실제 --selftest. 이전 바이너리 보관.
3. [완료] 테스트 4개 통과, 일반 독립 정확성·보안 검토, 앱 재기동 및 실제 갱신 로그 drift=0 확인.
4. [차단] gate-owned 공식 승인 receipt: 메인/독립 세션 모두 scope-conflict 또는 unstable-worktree 후 missing-state. 일반 검토를 공식 승인으로 간주하지 않는다. 게이트 작업 범위 충돌 해소 후 재검토가 재개 조건이다.

## Verification
- 변경 전 --selftest: reachable=true, accounts=32, unknown=16, configured=16.
- 메인 리뷰 게이트 begin: scope-conflict. 운영 규칙에 따라 별도 세션에서 독립 게이트를 준비한다.
- 빌드: qgate ticket 1788675955587618000-24650, rc=0.
- 변경 후 --selftest: reachable=true, accounts=16, unknown=0, configured=0.
- 이전 바이너리: menubar/.build/identity-fix-backup/cc-menubar (SHA-256 da28893583a904d28b0547b99a55f36689f98f537877942512f0509873f25ecb).
- 테스트: qgate ticket 1788676034164948000-31902.
- 정리 패스: 중복 HTTP 코드를 제거해 기존 helper로 통합, 이번 변경분만 검토.
- LSP 도구는 현재 요청 cwd가 teamclaude라 인접 cc-visualizer 경로를 거부했다. 실제 cc-visualizer 디렉터리에서 Swift 컴파일로 타입·문법 검증을 완료했다.
- 첫 fixture 컴파일은 config 비옵셔널 선언 오류로 실패했다. 실제 타입과 같은 optional로 수정 후 qgate 1788676183820808000-48302, rc=0, 4 tests OK (3.045s).
- 일반 독립 정확성 리뷰 identity_review_gate: APPROVE, CRITICAL/HIGH 없음. 일반 독립 보안 리뷰 identity_security_review: CRITICAL/HIGH 수정 요청 없음. 두 검토의 공식 gate 결과는 UNVERIFIED로 분리한다.
- 배포: 메뉴바 PID 57344 → 59823, 프록시 PID 27895 유지. 새 앱 로그에서 연속 3회 drift=0 pending=0, AUTOSYNC 재시작 0회. 한도소진 15개에 따른 주의 표시는 실제 상태이므로 유지한다.
- GUI 자동화는 cua.getState 시간 초과로 직접 화면 캡처를 확보하지 못했다. 실제 앱 바이너리의 --selftest 및 재기동된 앱이 화면에 적용하는 TEAMCLAUDE-REFRESH 로그로 검증했다.
- SHA-256 main.swift: fb4424b2eb3902363c93b3dad85ea886a432b19e6be9f4694f39277537c5ae81
- SHA-256 test_teamclaude_status_identity.py: cdcbacc8be826b47bd18ec3c3657647bfbfd8fe80cf1088bba19e066c1743b95
- SHA-256 배포 바이너리: 62f782ee762525635b9c0629d90dc5aa6cddaf3dbd0cf0f685c85fa4be8ee378

## 변경 파일
- /Users/sangrok/projects/cc-visualizer/menubar/Sources/main.swift
- /Users/sangrok/projects/cc-visualizer/menubar/Tests/test_teamclaude_status_identity.py
- /Users/sangrok/projects/cc-visualizer/docs/intents/2026-09-06-teamclaude-menubar-identity.md
- /Users/sangrok/projects/cc-visualizer/docs/specs/2026-09-06-teamclaude-menubar-identity.md
- /Users/sangrok/projects/cc-visualizer/docs/plans/2026-09-06-teamclaude-menubar-identity.md
- /Users/sangrok/projects/cc-visualizer/menubar/.build/cc-menubar
- /Users/sangrok/projects/cc-visualizer/menubar/.build/identity-fix-backup/cc-menubar
