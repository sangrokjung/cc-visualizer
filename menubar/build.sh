#!/bin/bash
# cc-menubar 빌드 스크립트
# swiftc로 메뉴바 앱 바이너리 컴파일

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/.build"
BINARY="$BUILD_DIR/cc-menubar"
SOURCES=("$SCRIPT_DIR"/Sources/*.swift)

echo "▶ cc-menubar 빌드 시작..."
echo "  소스: ${SOURCES[*]}"
echo "  출력: $BINARY"

mkdir -p "$BUILD_DIR"

swiftc \
    -O \
    -framework Cocoa \
    -framework Foundation \
    -target arm64-apple-macosx13.0 \
    "${SOURCES[@]}" \
    -o "$BINARY"

chmod +x "$BINARY"

echo ""
echo "✅ 빌드 완료"
echo "  바이너리: $BINARY"
echo "  크기: $(du -sh "$BINARY" | cut -f1)"
echo ""
echo "실행 방법:"
echo "  $BINARY &"
echo ""
echo "LaunchAgent 등록 방법:"
echo "  launchctl load ~/Library/LaunchAgents/com.qjc.cc-menubar.plist"
