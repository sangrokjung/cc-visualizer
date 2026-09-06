# TeamClaude 메뉴바 identity 조회 복구

Intent: docs/intents/2026-09-06-teamclaude-menubar-identity.md

## Problem / Goal
Claude 메뉴바 조회는 인증 헤더 없이 status를 받아 이름 없는 행을 unknown으로 만들고, 설정의 모든 계정을 미반영 행으로 추가한다. 기존 인증 조회 계약에 맞춰 실제 행과 설정을 연결한다.

## Requirements / Acceptance
- 로컬 설정의 proxy.apiKey를 기존 teamCodexFetchStatus(port:apiKey:)에 전달한다.
- 기존 localhost URL, identity 헤더, 리다이렉트 차단을 재사용한다. 새 외부 수신자는 없다.
- 정상 응답은 JSON object로 파싱하며 실패/비정상 JSON은 nil을 반환한다.
- 실제 서버 조회 시 unknown과 허위 configured 행은 0이고 표시 계정 수는 실제 계정 수와 같다.
- 앱 재빌드 및 재기동을 확인한다. 프록시/계정 설정은 변경하지 않는다.

## Non-goals
CLI/Tauri 수정, 프록시 인증 정책 변경, 계정 추가/삭제/재인증, 공개 API 변경.

## 재발 방지 및 GitHub 반영
사용자 후속 요청 “재발방지하고 깃헙 머지해”에 따라 정상 identity 조회와 별개로 익명/불완전 응답의 실패 처리를 보강한다.
- 이름 없는 응답은 설정 계정별 미확인 행으로만 표시하며 unknown 중복 행이나 허위 drift를 만들지 않는다.
- 식별 정보 미확인은 서버 오프라인과 구분하고 자동 재시작·자동 측정을 유발하지 않는다.
- 오류가 해소된 다음 정상 응답부터 이름·쿼터를 복구한다.
- 로컬 HTTP fixture가 실제 Swift loader와 렌더링에 쓰는 상태 변환을 실행한다. 정상/빈 키/잘못된 키/혼합 익명/잘못된 JSON/redirect/실제 drift를 검증한다.
- GitHub Actions에서 메뉴바 변경 PR 및 릴리스 전에 회귀 테스트와 Swift 빌드를 실행한다.
- main에는 메뉴바 기반 기능이 아직 없어 기존 GitHub 작업 브랜치를 PR의 base로 사용한다. 미공개 다른 기능 커밋은 포함하지 않는다.

## Risks / Concerns
기존 키를 사용하는 클라이언트 배선이므로 L 등급으로 검토한다. 키를 로그·증거·리뷰 번들에 기록하지 않는다. 운영 원본 config는 읽기 전용. 관련 없는 작업트리 변경은 제외한다. 사용자 “문제 해결해”가 직전 설명한 수정의 승인이다.

## Alternatives / Decision
서버의 익명화 해제 대신 이미 검증된 Codex 상태 HTTP 함수를 재사용한다. 새 HTTP 구현이나 계정 순서에 의존한 추측 매칭을 추가하지 않는다.

## Migration / Rollout / Rollback
스키마 이관 없음. 기존 실행 바이너리 백업 후 qgate에서 새 바이너리 빌드·검증, 메뉴바 프로세스만 재기동한다. 실패 시 백업 바이너리를 복원하고 메뉴바만 재기동한다.

## Verification / Observability / Runbook
실제 기존 바이너리 --selftest에서 32행, unknown 16행, configured 16행을 재현했다. 회귀 테스트는 익명 응답과 인증 응답의 차이, 헤더 전달, 실패 JSON, 리다이렉트 차단을 확인한다. 새 바이너리 --selftest 및 앱 화면/런타임 로그에서 정상 계정 수와 drift=0을 확인한다. 독립 정확성·보안 검토 결과는 연결된 plan에 기록한다.
