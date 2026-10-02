# 메뉴바 대시보드 회귀 복구

- Goal: 최신 main의 연속 페이지·구독 지출·소진 전망 화면을 복구하고, 삭제한 과거 해지 메일이 다시 반영되지 않도록 유지한다.
- Non-goals: UI 재설계, 계정 구성·인증·프록시 변경, 기존 작업 폴더의 미커밋 변경 정리.
- Acceptance: 최신 main에서 빌드한 앱에 DashboardSections·구독 지출·소진 전망이 존재한다. 해지 확인 삭제 후 store 재생성·재조회에도 과거 이벤트가 복원되지 않고 새로운 이벤트와 직접 확인은 반영된다. 개발용 빌드 파일을 다시 만들어도 운영 앱은 교체되지 않는다.
- Test: menubar/build.sh의 전체 러너와 후보 바이너리 스냅샷, SubscriptionMonitorTests의 저장·재시작·재조회 검사, 실제 운영 메뉴 접근성 확인, Claude Opus 독립 검토.

## 원인

운영 LaunchAgent가 오래된 작업 폴더의 menubar/.build/cc-menubar를 직접 실행하고 있었다. 10월 2일 00:43의 계정 표시 수정 빌드가 그 파일을 교체했다. 해당 폴더의 main.swift는 9월 22일 버전이었으며, 9월 23~27일 main에 반영된 연속 페이지·레이아웃·구독 지출 개선이 빠져 있었다. 00:46 재기동 이후 전체 대시보드가 과거 화면으로 바뀌었다. 서명 오류의 과거 종료 기록만으로 이번 회귀를 설명하지 않는다.

## 복구

최신 origin/main(27083cb)에서 독립 worktree를 만들고, 과거 해지 메일의 삭제 기준 시각 보존 변경만 이식한다. 최신 AccountSubscriptionFileCache를 유지한다. 기존 버튼 테스트는 고정된 store 시각과 동일한 시각으로 refreshTitle을 호출해 실행 날짜에 따른 오판을 제거한다. 기존 assertion은 유지한다.

검증된 바이너리는 개발 폴더와 분리된 ~/Applications/cc-menubar/cc-menubar에 원자적으로 설치하고 LaunchAgent가 그 경로를 실행하도록 한다. 운영 교체 전 기존 plist·바이너리를 백업한다. 이후 배포도 최신 main 확인 → 테스트·빌드·검토 → 설치 경로 교체 → 재기동 순서로 수행한다. build.sh 실행만으로 운영 파일을 교체하지 않는다.

## Verification

- qworker `1790911516220404000-2542`: exit 0. Swift 20개, Python 11개 통과, known-red 1개 묶음, env-skip 1개. 후보 바이너리 오프스크린 스냅샷도 통과했다.
- GitHub Actions run `36960234733`: `build-and-test` 성공. 동일한 `menubar/build.sh`와 스냅샷 스모크를 macOS 14에서 실행했다.
- 설치 바이너리 `/Users/sangrok/Applications/cc-menubar/cc-menubar`: SHA-256 `feb02718e2e1bf4961fbea7aa50bd501c733469ad1cee13fa07ec081cd99de80`.
- 운영 LaunchAgent는 개발 worktree가 아니라 `/Users/sangrok/Applications/cc-menubar/cc-menubar`를 실행하도록 변경했다. 기존 plist와 바이너리는 `backups/`에 보존했다.
- 실제 운영 QA: 12:35 재기동 후 PID 4535, `runs=1`, `last exit code=(never exited)`. 메뉴를 열어 접근성 트리의 단일 스크롤 영역, `구독 지출과 한도 소진`, `해지 미확인`을 확인했다. 메뉴 열기 로그 15ms. 설치 바이너리의 `--dashboard-snapshot`도 880×1316 PNG 생성에 성공했다.
- 한계: 기존 known-red는 초/일 단위 종료 경계와 과거 수동 QA 해시 검사 2건이다. 이번 작업에서 허용 목록·assertion을 완화하지 않았다. 메일함 브라우저 라이브 검사는 기존 러너의 opt-in 정책을 유지했다.
