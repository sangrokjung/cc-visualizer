#!/usr/bin/env bash
# menubar 테스트 일괄 실행.
#  - Swift: Tests/*Tests.swift 각각을 @main 실행 파일로 컴파일해 실행 (관례: precondition 기반)
#  - Python: Tests/test_*.py (소스 정규식 회귀 + 일부는 Swift 테스트를 직접 컴파일)
# 스냅샷 스모크(snapshot_test_*.py)는 빌드된 바이너리가 필요해 build.sh가 빌드 뒤에 따로 돌린다.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/menubar/Sources"
TESTS="$ROOT/menubar/Tests"
OUT="$ROOT/menubar/.build/tests"
mkdir -p "$OUT"

# main.swift는 최상위 코드가 있어 -parse-as-library 바이너리에 못 들어간다.
# 아래 두 파일은 main.swift의 TeamClaudeHealth / UsageData에 의존한다.
EXCLUDE_SOURCES=(main.swift TeamClaudeAvailability.swift CodexStatusView.swift)
# main.swift 심볼을 쓰는 테스트. main.swift 분할(후속 계획) 전까지 러너에서 못 돌린다.
# (세 파일 모두 짝이 되는 test_*.py가 main.swift의 진입점 앞부분을 잘라 붙여 직접 컴파일·실행하므로 실제로는 돈다.)
SKIP_TESTS=(AccountSubscriptionLayoutTests.swift TeamClaudeAvailabilityTests.swift TeamCodexDashboardSourceTests.swift)
# CodexStatusLoaderTests는 $TMPDIR 아래 menubar-usage-check-* 격리 홈(CFFIXED_USER_HOME + CC_MENUBAR_CODEX_* 3종)이
# 없으면 "Refusing fixture writes"로 exit 2 한다. 그 격리 홈은 test_usage_regressions.py가 만들어 돌린다.
SKIP_TESTS+=(CodexStatusLoaderTests.swift)

LIB_SOURCES=()
for f in "$SRC"/*.swift; do
  b="$(basename "$f")"; excluded=0
  for e in "${EXCLUDE_SOURCES[@]}"; do [ "$b" = "$e" ] && excluded=1; done
  [ "$excluded" = 0 ] && LIB_SOURCES+=("$f")
done

fail=0; ran=0; skipped=()
for t in "$TESTS"/*Tests.swift; do
  b="$(basename "$t")"; skip=0
  for s in "${SKIP_TESTS[@]}"; do [ "$b" = "$s" ] && skip=1; done
  if [ "$skip" = 1 ]; then skipped+=("$b"); continue; fi
  name="${b%.swift}"
  if ! swiftc -parse-as-library -j 1 -num-threads 1 "${LIB_SOURCES[@]}" "$t" -o "$OUT/$name" 2>"$OUT/$name.compile.log"; then
    echo "✗ $name (compile)"; sed -n '1,25p' "$OUT/$name.compile.log"; fail=1; continue
  fi
  if "$OUT/$name" >"$OUT/$name.log" 2>&1; then
    echo "✓ $name"; ran=$((ran + 1))
  else
    echo "✗ $name"; sed -n '1,40p' "$OUT/$name.log"; fail=1
  fi
done

# 일부 Python 테스트(test_live_subscription_surface.py, test_usage_regressions.py의 BuildGateTests)는
# build.sh를 다시 띄워 바이너리를 만든다. 그 안쪽 build.sh가 이 러너를 또 부르면 무한 재귀이므로 건너뛰게 한다.
export CC_MENUBAR_SKIP_TESTS=1
for p in "$TESTS"/test_*.py; do
  b="$(basename "$p")"
  # BuildGateTests는 build.sh를 띄워 게이트 자체(실패 시 바이너리 미교체)를 검사하므로 게이트 안에서는 못 돈다
  # (위 SKIP을 상속하면 게이트가 안 걸리고, 상속하지 않으면 재귀). build.sh가 늘 그랬듯 UsageRegressionTests만 돌리고
  # BuildGateTests는 수동 실행(python3 Tests/test_usage_regressions.py BuildGateTests)으로 남긴다.
  cls=""
  [ "$b" = test_usage_regressions.py ] && cls=UsageRegressionTests
  if python3 "$p" ${cls:+"$cls"} >"$OUT/$b.log" 2>&1; then
    echo "✓ $b"; ran=$((ran + 1))
  else
    echo "✗ $b"; sed -n '1,40p' "$OUT/$b.log"; fail=1
  fi
done

echo "menubar tests: ran=$ran skipped=${#skipped[@]} (${skipped[*]:-none})"
exit "$fail"
