#!/usr/bin/env bash
# menubar 테스트 일괄 실행.
#  - Swift: Tests/*Tests.swift 각각을 @main 실행 파일로 컴파일해 실행 (관례: precondition 기반)
#  - Python: Tests/test_*.py (소스 정규식 회귀 + 일부는 Swift 테스트를 직접 컴파일)
# 실패가 하나라도 있으면 exit 1 — build.sh는 이 종료 코드로 바이너리 교체를 막는다.
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
# 실제 외부 표면(브라우저 탭·브라우저 도구 바이너리·메일함 dry-run)을 건드리는 테스트.
# 게이트는 트리만의 함수여야 하므로 CC_MENUBAR_LIVE_SURFACES=1일 때만 돌리고, 아니면 env-skip으로 표시한다.
LIVE_SURFACE_TESTS=(test_live_subscription_surface.py)

LIB_SOURCES=()
for f in "$SRC"/*.swift; do
  b="$(basename "$f")"; excluded=0
  for e in "${EXCLUDE_SOURCES[@]}"; do [ "$b" = "$e" ] && excluded=1; done
  [ "$excluded" = 0 ] && LIB_SOURCES+=("$f")
done

fail=0; ran=0; failed=0; skipped=(); envskipped=()
for t in "$TESTS"/*Tests.swift; do
  b="$(basename "$t")"; skip=0
  for s in "${SKIP_TESTS[@]}"; do [ "$b" = "$s" ] && skip=1; done
  if [ "$skip" = 1 ]; then skipped+=("$b"); continue; fi
  name="${b%.swift}"
  if ! swiftc -parse-as-library -j 1 -num-threads 1 "${LIB_SOURCES[@]}" "$t" -o "$OUT/$name" 2>"$OUT/$name.compile.log"; then
    echo "✗ $name (compile)"; sed -n '1,25p' "$OUT/$name.compile.log"; fail=1; failed=$((failed + 1)); continue
  fi
  if "$OUT/$name" >"$OUT/$name.log" 2>&1; then
    echo "✓ $name"; ran=$((ran + 1))
  else
    echo "✗ $name"; sed -n '1,40p' "$OUT/$name.log"; fail=1; failed=$((failed + 1))
  fi
done

# 재귀 가드: 바이너리가 필요해 build.sh를 다시 띄우는 테스트의 안쪽 build.sh가 이 러너를 또 부르지 않게 한다.
# 기본 게이트에서 build.sh를 띄우는 테스트는 없다(라이브 표면 테스트는 opt-in). BuildGateTests는 게이트 자체를
# 검사하려고 임시 복사본의 run-tests.sh를 스텁으로 바꾼 뒤 이 변수를 일부러 지우고 build.sh를 띄운다.
export CC_MENUBAR_SKIP_TESTS=1
for p in "$TESTS"/test_*.py; do
  b="$(basename "$p")"; live=0
  for l in "${LIVE_SURFACE_TESTS[@]}"; do [ "$b" = "$l" ] && live=1; done
  if [ "$live" = 1 ] && [ "${CC_MENUBAR_LIVE_SURFACES:-0}" != "1" ]; then
    echo "env-skip $b"; envskipped+=("$b"); continue
  fi
  if python3 "$p" >"$OUT/$b.log" 2>&1; then
    echo "✓ $b"; ran=$((ran + 1))
  else
    echo "✗ $b"; sed -n '1,40p' "$OUT/$b.log"; fail=1; failed=$((failed + 1))
  fi
done

echo "menubar tests: ran=$ran failed=$failed skipped=${#skipped[@]} (${skipped[*]:-none}) env-skipped=${#envskipped[@]} (${envskipped[*]:-none})"
exit "$fail"
