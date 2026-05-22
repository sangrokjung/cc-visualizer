#!/usr/bin/env bash
# cc-menubar 설치 스크립트
# 사용법: bash install.sh [--install-dir <경로>]
#
# 기본 설치 경로: ~/Applications/cc-menubar/
# LaunchAgent:   ~/Library/LaunchAgents/com.qjc.cc-menubar.plist

set -euo pipefail

# ── 색상 출력 헬퍼 ─────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── 경로 설정 ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${HOME}/Applications/cc-menubar"

# 인자 파싱 (--install-dir 옵션)
while [[ $# -gt 0 ]]; do
    case "$1" in
        --install-dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --help|-h)
            echo "사용법: bash install.sh [--install-dir <경로>]"
            echo "기본 설치 경로: ~/Applications/cc-menubar"
            exit 0
            ;;
        *)
            error "알 수 없는 옵션: $1"
            exit 1
            ;;
    esac
done

BINARY_SRC="${SCRIPT_DIR}/cc-menubar"
BINARY_DST="${INSTALL_DIR}/cc-menubar"
PLIST_TEMPLATE="${SCRIPT_DIR}/com.qjc.cc-menubar.plist.template"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
PLIST_DST="${LAUNCH_AGENTS_DIR}/com.qjc.cc-menubar.plist"
LABEL="com.qjc.cc-menubar"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " CC Menubar Daemon 설치"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. 사전 요건 확인 ──────────────────────────
info "사전 요건 확인..."

if [[ "$(uname)" != "Darwin" ]]; then
    error "macOS 전용 설치 스크립트입니다."
    exit 1
fi

if [[ ! -f "${BINARY_SRC}" ]]; then
    error "바이너리를 찾을 수 없습니다: ${BINARY_SRC}"
    error "압축 해제 후 설치 스크립트와 같은 폴더에서 실행하세요."
    exit 1
fi

if [[ ! -f "${PLIST_TEMPLATE}" ]]; then
    warn "plist 템플릿 없음: ${PLIST_TEMPLATE}"
    warn "LaunchAgent 자동 등록을 건너뜁니다 — 수동으로 등록하세요."
    SKIP_LAUNCHAGENT=1
else
    SKIP_LAUNCHAGENT=0
fi

success "사전 요건 확인 완료"

# ── 2. 미서명 Gatekeeper 우회 ──────────────────
info "미서명 바이너리 quarantine 제거 중..."

if xattr -l "${BINARY_SRC}" 2>/dev/null | grep -q "com.apple.quarantine"; then
    xattr -d com.apple.quarantine "${BINARY_SRC}"
    success "quarantine 속성 제거 완료"
else
    info "quarantine 속성 없음 — 건너뜀"
fi

# ── 3. 바이너리 설치 ───────────────────────────
info "바이너리 설치: ${BINARY_DST}"

mkdir -p "${INSTALL_DIR}"
cp -f "${BINARY_SRC}" "${BINARY_DST}"
chmod +x "${BINARY_DST}"

# 설치 후 quarantine 재제거 (cp가 속성 상속할 수 있음)
xattr -d com.apple.quarantine "${BINARY_DST}" 2>/dev/null || true

success "바이너리 설치 완료: ${BINARY_DST}"

# ── 4. LaunchAgent plist 생성 + 등록 ─────────
if [[ "${SKIP_LAUNCHAGENT:-0}" == "1" ]]; then
    warn "LaunchAgent 등록 건너뜀"
else
    info "LaunchAgent plist 생성 중..."

    mkdir -p "${LAUNCH_AGENTS_DIR}"

    # __INSTALL_DIR__ placeholder를 실제 경로로 치환
    # sed -i '' (BSD sed) — macOS 호환
    sed "s|__INSTALL_DIR__|${INSTALL_DIR}|g" "${PLIST_TEMPLATE}" > "${PLIST_DST}"

    success "plist 생성 완료: ${PLIST_DST}"

    # 기존 데몬 unload (이미 실행 중이면)
    if launchctl list "${LABEL}" &>/dev/null; then
        info "기존 LaunchAgent 언로드 중..."
        launchctl unload "${PLIST_DST}" 2>/dev/null || true
    fi

    # 새 plist 로드
    info "LaunchAgent 등록 중..."
    if launchctl load -w "${PLIST_DST}"; then
        success "LaunchAgent 등록 완료 — 로그인 시 자동 시작됩니다"
    else
        error "LaunchAgent 등록 실패"
        error "수동으로 실행하려면: launchctl load -w ${PLIST_DST}"
        exit 1
    fi
fi

# ── 5. 즉시 실행 여부 확인 ─────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 설치 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  설치 경로:   ${BINARY_DST}"
if [[ "${SKIP_LAUNCHAGENT:-0}" == "0" ]]; then
    echo "  LaunchAgent: ${PLIST_DST}"
fi
echo ""
echo "  메뉴바 아이콘(⚡)이 표시되지 않으면:"
echo "    ${BINARY_DST} &"
echo ""
echo "  제거 방법:"
echo "    launchctl unload ${PLIST_DST}"
echo "    rm -rf ${INSTALL_DIR}"
echo "    rm ${PLIST_DST}"
echo ""

# ── 6. Gatekeeper 수동 우회 안내 ───────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ⚠️  미서명 앱 안내"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  cc-menubar는 Apple 인증서로 서명되지 않았습니다."
echo "  Gatekeeper 경고가 표시될 경우 아래 방법 중 하나로 허용하세요:"
echo ""
echo "  방법 A (권장 — 터미널):"
echo "    xattr -d com.apple.quarantine ${BINARY_DST}"
echo ""
echo "  방법 B (시스템 설정):"
echo "    시스템 설정 → 개인정보 보호 및 보안 → 보안 섹션 아래"
echo "    '\"cc-menubar\"을(를) 확인 없이 열기' 버튼 클릭"
echo ""
