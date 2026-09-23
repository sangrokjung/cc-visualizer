# 실행 계획과 검증 기록

Spec: docs/specs/2026-09-09-teamclaude-availability.md

## 실행 순서

1. 기존 변경을 baseline으로 보존하고 격리 worktree에서 조사한다.
2. 세션·전체 주간·Fable, 최신성, 프록시 허용과 동시 요청 여유를 함께 판정한다.
3. 상단 가능 수와 계정별 사유·구독 상태·날짜 표시를 구현한다.
4. 실제 전체 최적화 바이너리와 production UI 테스트를 qgate에서 검증한다.
5. 실제 창 QA와 독립 goal-correctness/runtime-security 검토를 완료한다.
6. 원본 보존 검증 후 소스와 바이너리를 적용하고 메뉴바만 재기동한다.

## 완료한 구현·실행 검증

- 세 창의 측정과 미래 reset, 60초 미만 응답, proxy usable, 동시 요청 여유가 있어야 Fable 가능으로 센다. 오래된 throttled/exhausted도 미확인으로 처리한다.
- 실제 열린 창은 common-mode 1초 timer로 가용 수·접근성·세 창 countdown을 갱신한다.
- 서버 구독 기록 우선 및 직접 확인 기록을 표시한다. 서버 active는 해지 여부 미확인이다. 끝 시각은 마지막 이용일로 표시하며 OAuth 만료일은 쓰지 않는다.
- 1·2차 독립 검토의 시간 경과 HIGH 결함을 수정했고 자기 변경 정리 패스를 수행했다.
- 2026-09-10 qgate ticket 1788965734521179000-89493: gate-owned verifier 2개 PASS. 전체 main.swift 최적화 컴파일+dashboard selftest, production 경계·구독 집계 callback·16행·타이머 60초/리셋 경과를 실제 실행했다.
- CUA 00:05~00:12: 실제 편집 모달에서 잘못된 2026-02-30 저장 차단, 2026-09-01 저장 후 만료일 강조와 제외 수 4→5, 마지막 16번째 행 스크롤·재인증 버튼 비중첩 확인. 창 유지 중 60초 경과로 가능 0/16 전환도 확인. 최신 수동 회차는 편집 중 응답이 만료되어 가능 4→3을 시각 확인하지 않았으며, 구독 저장 callback의 count 변화는 자동 테스트에서 검증했다.
- 스크린샷: /private/tmp/teamclaude-fable-ui-evidence-20260909/fable-dashboard.png
- 비식별 수동 기록: /private/tmp/teamclaude-fable-ui-evidence-20260909/manual-qa.txt
- 추가 Claude 조사 2회, 검증 재시도는 --model fable --effort xhigh로 실제 실행했으나 계정 풀 소진(rc=1, is_error=true)으로 UNVERIFIED. 성공 gate receipt로 취급하지 않는다.

## 최종 검토·적용 기록 위치

독립 검토의 현재 판정은 adversarial-review-gate.py status가 관리한다. 이 문서는 완료 선언이 아니며, 최종 원본 보존·바이너리 hash·재기동·실표면 결과는 /private/tmp/teamclaude-fable-ui-evidence-20260909/completion.json에 기록한다. 적용 조건은 최신 필수 두 lane APPROVE와 실행 evidence PASS다.


3차 검토 수정: 서버 endsAt의 실제 시각을 표시 날짜와 별도로 보존하고 now >= endsAt에 미확인 전환. 60초 이내 실제 RunLoop 경계 테스트 추가. MEDIUM active 우선순위 의견은 실제 서버 계약과 다름: active는 모든 기록 필드 null인 기본값이므로 직접 확인 기록을 보존하는 것이 의도다. 이 의미를 spec에 명확히 기록했다.

동시 작업 병합(00:43): 원본 AccountSubscription.swift/Button.swift에 추가된 메일 모니터 캐시·상태 표시를 보존해 3-way 병합했다. 서버 확정 구독 기록은 모니터보다 우선하고 메일 확인 상태·지연/실패 안내는 유지한다. 통합 경계 테스트를 추가했다. 최초 baseline뿐 아니라 적용 직전 integration-baseline.json과도 원본 변경을 대조한다.

4차 검토 대응: 정수 초 올림보다 빠른 quota reset 경계도 절대 reset Date로 판정한다. 실제 AX group을 노출한다. QA는 실행마다 0700 임시 폴더를 생성하고 고정 출력 디렉터리는 소유권·심볼릭 링크·권한을 검증한다. 실제 CUA 모달 조작(잘못된 날짜 차단·정상 저장·가능 4→3)과 마지막 행 스크롤이 완료돼야 verifier가 성공하는 interactive 전략으로 전환했다. 스크린샷·실행 로그는 latest-run.json이 가리키는 비공개 회차 폴더에 저장한다.

5차 검토 대응: active/usable과 독립 errorReason이 상충하면 미확인으로 제외하고 병합 경로를 회귀 검증한다. verifier는 .build에 후보를 복사하지 않고 비공개 회차 폴더에서만 컴파일한다. 실제 UI 앱을 verifier의 자식 프로세스로 직접 실행·종료 코드 추적하고, stdout pipe의 구조화 결과에 회차 nonce·실제 executable SHA-256·세 필수 동작·4→3 집계를 엄격 대조한다. 외부 marker 파일 방식은 제거했다. 승인 후 배포는 해당 회차의 optimized binary를 사용한다.

검증 실행 전략 보완: gate containment에서 실행한 앱은 CUA 앱 목록에 등록되지 않아, gate 내부는 실제 AppKit 모달·버튼·날짜 필드를 구동하는 자동 통합 테스트로 검증한다. 수동 CUA QA는 같은 빌드의 별도 직접 추적 프로세스에서 수행하고 stdout·종료 상태를 보존한다. 검증 격리나 HOME은 해제하지 않는다.

## 최신 수동 CUA 실행 자료

자동 모달 테스트와 별도로 수행한 실제 도구 출력의 비식별 기록입니다. 아래 source hash는 현재 production 파일과 검증하며, 배포 후보는 이 회차의 optimized binary입니다. 이후 검토 문서·Python 증거 검증만 변경했으며 production/fixture Swift 코드는 같습니다.

<!-- MANUAL-CUA-JSON -->
```json
{
  "kind": "manual-cua-observation",
  "run_directory": "/private/tmp/teamclaude-fable-ui-evidence-20260909/run-jqqemzxg",
  "observed_at": "2026-09-09T19:45:12.278982+00:00",
  "process": {
    "mode": "manual-cua",
    "exit_status": 0,
    "result": {
      "executable_sha256": "6242cce057477fe661345107f307570f822cc0859691cd3bf47dd5716b71bf08",
      "invalid_date_blocked": true,
      "last_row_visible": true,
      "nonce": "dc186c2afba57ce4f8ef3c5f0a015213ada5c314154f0fc9",
      "ready_after": 3,
      "ready_before": 4,
      "saved": true
    }
  },
  "production_executable_sha256": "4e91394642d2da4a3d1faf6d2f2bd26d9f0ea3e8bfbf2c26a4ea6491b607b005",
  "production_sources": {
    "menubar/Sources/AccountSubscriptionButton.swift": "81f64c43b523e0a8f9e3933a60dca87e0617c473035e00ae16d419d9d82cb180",
    "menubar/Sources/CodexStatusLoader.swift": "19b729682d9a664135efca8f09b60c79d4856b817605b3aeb4d744ea08701b0b",
    "menubar/Sources/TeamClaudePresentationLogic.swift": "9820f6f288edae5633cdeba24062893bf1a2f8e4308711958f4e7e95bd5abd4f",
    "menubar/Sources/TeamCodexPoolStatus.swift": "a53673367b0da1ae4e6bee6fc885f2e9d3eadfad8711afce8c0054a9b3ce5e40",
    "menubar/Sources/CodexStatusParsing.swift": "62d87f6cf84be61266d86b180d18f5592b176b4d41c462a8d860f946bdcf9649",
    "menubar/Sources/CodexStatusLayout.swift": "ef87b34d2fcb37ae18bab6551e08d69cca4ad3014215908148cc3300dedb1cb4",
    "menubar/Sources/TeamClaudeStatusLogic.swift": "9f1fe15724edb904b60cc36cfd2a06c816553d318e7144872231e387b65800d2",
    "menubar/Sources/TeamClaudeAvailability.swift": "9e52b1284c6921daa9f420d47e7896cb4e2e0600ae08605889256e0daf7dd53b",
    "menubar/Sources/CodexStatusModels.swift": "4762e414399c26d471a0483840906e2fa4761d672c6c3e1bef66d50ea2f44ef0",
    "menubar/Sources/main.swift": "33741951afd4cca670945d92db35cea1bd18a807a9eb449fd500f76f18ee4cf2",
    "menubar/Sources/CodexStatusView.swift": "0ac565508d661c9e8aa431aebec3b8664ce428484bae9656a26ebee2b994b514",
    "menubar/Sources/AccountSubscription.swift": "a932be96254eb52a6164690b5725c7c06e32268697bbf32e0c03e253b9c1bd0d"
  },
  "fixture_source_sha256": "364a229c90c6a756667d547cb4dbcb095c007f9141392893681b038acac3c3fd",
  "layout_screenshot_sha256": "06bccfe88fa2208c2a6b03bdb5186dbd76611d6e7c986ef910ba64bab9e74cd6",
  "cua_observations": [
    "초기 AX container: Fable 사용 가능 4/16",
    "구독 확인 버튼을 눌러 구독 종료 확인 선택",
    "2026-02-30 저장 후 실제 날짜 오류 안내를 AX로 확인",
    "2026-09-01 저장 후 AX: Fable 사용 가능 3/16 및 만료일 2026-09-01",
    "scroll area 13 down 3 실행 후 fixture 정상 종료; 직접 추적한 자식 stdout의 last_row_visible=true와 exit_status=0 확인"
  ],
  "limits": "수동 CUA는 gate 바깥에서 직접 추적한 자식 프로세스에서 수행. 공식 receipt로 가장하지 않는다. screenshot은 동일 회차의 native bitmap 렌더이며, 실제 CUA 관측은 위 AX 기록이다."
}
```
<!-- END-MANUAL-CUA-JSON -->

6차 검토 수정: 실제 JSON boolean을 quota/threshold 숫자로 읽지 않고 usable/enabled에 명시적 Boolean만 허용한다. 원시 JSON → 파싱 → retained quota 병합 → 최종 집계 64개 경계와 자동·수동 모달 모두 통과했다. 수동 CUA는 위 회차의 앱을 직접 추적하며 오류 날짜 거부·저장·4→3·마지막 행을 확인했고 실제 exit=0을 받았다.

최신 오류 타입 보완: errorReason의 부재/null과 객체·배열·Boolean을 구분한다. 잘못된 타입은 invalid-error-state로 유지하여 미확인 처리하며 병합 후에도 제외한다. 현재 70개 경계·자동 모달·수동 CUA를 통과했다. 수동 보고서 hash 검사는 동등성 검사이고 악의적 작성자에 대한 서명 증명이 아니라는 증거 경계를 spec에 명시했다.

## 변경 범위 대조: 기존 호스트 사용률 표시

runtime-security의 hostSummaryText Int 범위 의견은 기존 결함이다. 원본을 직접 비교했다. 작업 시작 baseline main.swift, 현재 운영 원본 main.swift, 이 작업 main.swift의 hostSummaryText 본문 SHA-256이 모두 `5bceed07945cf1687f5c3243c0edbade7ff6fdb55366bce3359d33098e4ad15f`로 동일하다. CPU/RAM의 tcDouble 파싱과 hostSummaryText를 layout에서 호출하는 기존 경로 역시 이 변경에서 도입하지 않았다. Fable 가용성이나 구독 만료일과 별도 기능이며 이번 변경이 이 경로의 입력·판정·실행 조건을 바꾸지 않았다. 극단적 host 사용률을 정수로 바꾸는 기존 잠재적 crash는 현재 production source의 알려진 범위 밖 항목으로 남긴다. 사용자 요청의 수술적 변경 원칙에 따라 임의 수정하지 않는다.

기존/현재 공통 코드(두 줄):
```swift
if let cpu = host.cpuPercent, cpu.isFinite { parts.append("CPU \(Int(cpu.rounded()))%") }
if let mem = host.memUsedPercent, mem.isFinite { parts.append("RAM \(Int(mem.rounded()))%") }
```
가용성에 새로 소비하는 quota/Boolean/errorReason의 타입 경계는 이번 변경에 포함하여 회귀 검증했다. 새 동작의 문제와 기존 호스트 텔레메트리 표시의 문제를 구분한다.

최종 서버 기준 보완: switchThreshold가 누락된 응답은 로컬 설정·98%로 추정하지 않고 미확인으로 유지한다. 실제 로더가 쓰는 parseTeamClaudeHealth에 원시 JSON을 넣어 누락·null·Boolean·서버 95%/98%와 상충하는 로컬 설정을 회귀 검증했다. 총 80개 경계·최적화 전체 빌드·자동 모달 PASS. 최신 위 수동 CUA 회차에서 날짜 오류 차단·정상 저장·4→3·마지막 행 스크롤과 자식 exit=0을 확인했다.
