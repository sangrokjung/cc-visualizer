# 실행 계획 및 검증 기록

Spec: docs/specs/2026-09-06-teamclaude-menubar-identity.md

## GitHub 재발 방지 반영

- 대상: fix/teamclaude-status-identity → feat/weekly-monthly-krw-usage. 기반 메뉴바 기능이 main에 없어 기존 PR #9를 확대 머지하지 않는다.
- 완료: 인증 상태 조회 및 리다이렉트 차단을 원격 기반 브랜치에 이식했다. 이름 없는/불완전 상태 응답은 조회 인증 경고로 처리하며 중복 행과 허위 drift 및 자동 복구를 막는다.
- 완료: 실제 Swift 앱의 loader와 표시 상태 변환을 로컬 HTTP fixture로 실행하는 6개 테스트를 추가했다. PR 및 릴리스 workflow에 같은 테스트와 빌드를 배선했다.
- RED: qgate 1788676694826045000-20780, 6개 테스트 실행 중 9개 assertion 실패. 중복 unknown 행, 잘못된 drift, redirect 수락을 재현했다.
- GREEN: qgate 1788677237971107000-12254, 6개 테스트 통과. fixture 사용량에 유효한 미래 reset을 추가해 실제 quota 계약을 반영했다.
- 빌드: qgate 1788677238196377000-12273, rc=0. 실제 새 바이너리 --selftest는 16개 계정과 unknown/configured 0개를 확인했다.
- 문서 동기화: 구현 계약과 이 문서를 대조했다. housekeeping scan에서 민감 정보 발견 0건. 관련 없는 소스 Claude 설정은 변경하지 않았다.
- 린트: 새 workflow actionlint 통과. release workflow의 기존 SC2086은 기준 커밋에도 있어 범위 밖으로 유지, 두 workflow의 비-ShellCheck 검사 통과.
- 디버깅 가설: 서버 장애는 HTTP 200으로 배제, stale 화면만의 문제는 독립 바이너리 재현으로 배제, identity 헤더 누락은 헤더 유무에 따른 실제 HTTP 결과로 확인했다.
- 리뷰·머지 절차: 커밋 후 full SHA를 고정해 목표/QA/품질/보안/맥락 5개 독립 lane과 runtime audit를 수행하고, 결과는 작업트리 외부 원장에 보관한다. GitHub CI 통과 후 해당 SHA를 지정해 PR 머지한다.
- 롤백: PR revert로 GitHub 변경을 되돌릴 수 있다. 운영 바이너리는 이전 긴급 수정 버전을 유지하므로 원격 이전 기능으로 덮어쓰지 않는다.

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
