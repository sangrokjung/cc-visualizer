# menubar/Tests/test_dashboard_wiring.py
"""연속 페이지 배선 회귀(소스 정규식). 대시보드는 한 겹 스크롤이고, 섹션 배치는 DashboardSections.swift의
순수 함수가 맡으며, 고정 헤더는 addFloatingSubview로 얹는다. 섹션별 안쪽 NSScrollView와 936/596 상한이
되살아나면 여기서 잡는다."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "menubar" / "Sources"
MAIN = SOURCES / "main.swift"
SECTIONS = SOURCES / "DashboardSections.swift"
PALETTE = SOURCES / "TeamClaudePalette.swift"


def class_body(source, name):
    match = re.search(r"final class " + re.escape(name) + r"\b(?P<body>.*?)\nfinal class ", source, re.DOTALL)
    assert match is not None, f"{name} must remain discoverable"
    return match.group("body")


class DashboardWiringTests(unittest.TestCase):
    def setUp(self):
        self.main = MAIN.read_text()

    def test_no_per_section_clamp_remains(self):
        self.assertNotIn("maxTeamHeight", self.main)
        self.assertNotIn("maxMenuDashboardHeight", self.main)

    def test_dashboard_view_has_no_inner_scroll_view(self):
        body = class_body(self.main, "StatusMenuDashboardView")
        self.assertNotIn("NSScrollView(", body, "the account table must render at full height inside the one page")
        self.assertNotIn("enclosingScrollView", body)
        self.assertIn("private(set) var sections: [DashboardSection]", body)
        self.assertIn("DashboardSectionHeaderView(", body)
        self.assertIn("dashboardSectionLayout(startY:", body)
        self.assertIn("dashboardSectionBodyY(", body)

    def test_menu_hosting_is_one_helper_with_a_pinned_header(self):
        self.assertEqual(1, self.main.count("func hostDashboard("), "both hosting sites must share one helper")
        self.assertIn("addFloatingSubview(", self.main)
        self.assertIn("verticalScrollElasticity = .allowed", self.main)
        self.assertNotIn("verticalScrollElasticity = .none", self.main)
        self.assertIn("DashboardSectionHeaderView(", self.main)
        self.assertIn("dashboardCurrentSection(", self.main)
        self.assertIn("NSView.boundsDidChangeNotification", self.main)
        self.assertIn("postsBoundsChangedNotifications = true", self.main)
        for site in ("func updateCachedMenuPresentation()", "func menuWillOpen(_ menu: NSMenu)"):
            self.assertIn(site, self.main)
        rebuild = self.main.split("func menuWillOpen(_ menu: NSMenu)", 1)[1].split("func menuDidClose", 1)[0]
        self.assertIn("hostDashboard(dashboard, in: dashboardItem, previousScrollOrigin: nil)", rebuild)
        refresh = self.main.split("func updateCachedMenuPresentation()", 1)[1].split("func menuWillOpen", 1)[0]
        self.assertIn("hostDashboard(dashboard, in: dashboardItem, previousScrollOrigin: previousScrollOrigin)", refresh)

    def test_sections_file_uses_the_palette_only(self):
        sections = SECTIONS.read_text()
        self.assertNotIn("NSColor(", sections)
        self.assertNotIn("NSFont.", sections)
        self.assertIn("TeamClaudePalette.", sections)
        for symbol in ("struct DashboardSection", "func dashboardSectionLayout(", "func dashboardCurrentSection(",
                       "func dashboardSectionBodyY(", "final class DashboardSectionHeaderView"):
            self.assertIn(symbol, sections)

    def test_palette_lives_in_its_own_file(self):
        self.assertTrue(PALETTE.exists())
        self.assertIn("enum TeamClaudePalette", PALETTE.read_text())
        self.assertNotIn("enum TeamClaudePalette", self.main)

    def test_section_order_is_the_same_in_layout_and_configure(self):
        body = class_body(self.main, "StatusMenuDashboardView")
        ids = re.findall(r'\(id: "([a-z]+)", title: "([^"]+)"', body)
        self.assertEqual(len(ids), 10, "preferredHeight and configure each list the five sections")
        expected = [("claude", "Claude 풀"), ("codex", "Codex 풀"), ("higgsfield", "Higgsfield"),
                    ("cli", "CLI 쿼터"), ("usage", "사용량")]
        self.assertEqual(ids[:5], expected)
        self.assertEqual(ids[5:], expected)


class DashboardRefreshCostTests(unittest.TestCase):
    """성능 회귀: Codex 세션 스캔은 10초 틱 밖(60초 타이머, background QoS), 열린 대시보드 리드로는 합쳐서 한 번."""

    def setUp(self):
        self.main = (SOURCES / "main.swift").read_text()

    def test_fast_tick_no_longer_scans_codex_sessions(self):
        start = self.main.index("func loadFastStatusInBackground()")
        end = self.main.index("\n    }\n", start)
        self.assertNotIn("loadCodexStatusInBackground", self.main[start:end])
        self.assertIn("codexScanTimer = Timer.scheduledTimer(withTimeInterval: 60.0", self.main)

    def test_codex_scan_runs_at_background_qos(self):
        start = self.main.index("func loadCodexStatusInBackground()")
        end = self.main.index("\n    }\n\n", start)
        self.assertIn("DispatchQueue.global(qos: .background)", self.main[start:end])
        self.assertNotIn("qos: .utility", self.main[start:end])
        self.assertIn("scan=files:", self.main[start:end])

    def test_open_dashboard_redraws_are_coalesced(self):
        self.assertIn("func scheduleDashboardRefresh(reason: String, immediate: Bool = false)", self.main)
        self.assertGreaterEqual(self.main.count("scheduleDashboardRefresh(reason:"), 12)
        self.assertEqual(0, self.main.count("refreshOpenDashboard()"), "call sites must go through scheduleDashboardRefresh")
        self.assertIn('print("DASHBOARD-REFRESH: reason=', self.main)


if __name__ == "__main__":
    unittest.main()
