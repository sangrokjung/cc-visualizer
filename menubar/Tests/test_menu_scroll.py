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
