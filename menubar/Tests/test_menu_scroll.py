from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "menubar" / "Sources" / "main.swift"


class MenuScrollRegressionTests(unittest.TestCase):
    def test_cached_dashboard_refresh_preserves_existing_scroll_offset(self):
        source = SOURCE.read_text()
        match = re.search(
            r"    func updateCachedMenuPresentation\(\) \{(?P<body>.*?)\n    \}\n\n    func menuWillOpen",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(match, "cached dashboard presentation method must remain discoverable")
        body = match.group("body")
        self.assertIn(
            "let previousScrollOrigin = (dashboardItem.view as? NSScrollView)?.contentView.bounds.origin",
            body,
            "refresh must capture the user's existing dashboard scroll position",
        )
        self.assertIn(
            "scrollView.contentView.scroll(to: NSPoint(x: previousScrollOrigin.x",
            body,
            "refresh must restore the captured position after replacing the document view",
        )
        self.assertNotIn(
            "scrollView.contentView.scroll(to: .zero)",
            body,
            "periodic status refresh must not force the open menu back to the top",
        )

    def test_cached_menu_open_does_not_rebuild_dashboard_on_the_click(self):
        source = SOURCE.read_text()
        match = re.search(
            r"func menuWillOpen\(_ menu: NSMenu\) \{(?P<body>.*?)\n    func menuDidClose",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(match, "menu open method must remain discoverable")
        cache_hit = match.group("body").split("menu.removeAllItems()", 1)[0]
        self.assertNotIn(
            "updateCachedMenuPresentation()",
            cache_hit,
            "an open menu must not rebuild the scroll view, even on a later turn",
        )

    def test_open_menu_refresh_does_not_replace_document_view(self):
        source = SOURCE.read_text()
        match = re.search(
            r"    func refreshOpenDashboard\(\) \{(?P<body>.*?)\n    \}\n\n    func loadInBackground",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(match, "open dashboard refresh must remain discoverable")
        body = match.group("body")
        self.assertNotIn(
            "documentView",
            body,
            "a refresh while the menu is open must not reassign the scrolling document",
        )
        open_branch, _, after_open = body.partition("if openDashboardView != nil")
        self.assertNotEqual(after_open, "")
        before_rebuild, _, _ = after_open.partition("updateCachedMenuPresentation()")
        self.assertIn(
            "return",
            before_rebuild,
            "the open menu must return before any geometry rebuild",
        )
        self.assertNotIn("updateCachedMenuPresentation()", before_rebuild)
        self.assertNotIn("documentView", open_branch)

    def test_team_account_scroll_survives_dashboard_rebuild(self):
        source = SOURCE.read_text()
        match = re.search(
            r"    func updateContent\((?P<body>.*?)\n    \}\n}\n\nfinal class UsageDashboardView",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(match, "dashboard update method must remain discoverable")
        body = match.group("body")
        self.assertIn(
            "let previousTeamScrollOrigin = teamClaudeView?.enclosingScrollView?.contentView.bounds.origin",
            body,
            "a dashboard rebuild must capture the account-list scroll position",
        )
        self.assertIn(
            "teamScrollView.contentView.scroll(to: NSPoint(x: previousTeamScrollOrigin.x",
            body,
            "a dashboard rebuild must restore the account-list scroll position",
        )


if __name__ == "__main__":
    unittest.main()
