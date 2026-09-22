# menubar/Tests/test_crash_recorder.py
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "menubar" / "Sources" / "main.swift"


class CrashRecorderWiringTests(unittest.TestCase):
    def setUp(self):
        self.source = SOURCE.read_text()

    def test_uncaught_exception_handler_is_installed_before_the_app_runs(self):
        self.assertIn("NSSetUncaughtExceptionHandler", self.source)
        self.assertIn("cc-menubar-crash.log", self.source)
        # main.swift에는 app.run()이 2곳이다(4821행 벤치마크 분기, 5399행 최상위 일반 실행).
        # 데몬이 실제로 도는 곳은 마지막(최상위) 호출이므로 rfind로 잡는다.
        run_at = self.source.rfind("app.run()")
        install_at = self.source.rfind("installCrashRecorder()")
        self.assertNotEqual(-1, run_at, "app.run() must remain discoverable")
        self.assertNotEqual(-1, install_at, "installCrashRecorder() must be called")
        self.assertLess(install_at, run_at, "the recorder must be installed before the daemon run loop starts")
        self.assertLess(run_at - install_at, 400, "installCrashRecorder() must sit right before the top-level app.run()")

    def test_team_claude_table_draw_leaves_breadcrumbs(self):
        match = re.search(
            r"final class TeamClaudeTableView: NSView \{(?P<body>.*?)\nfinal class ServiceAvailabilitySummaryView",
            self.source,
            re.DOTALL,
        )
        self.assertIsNotNone(match)
        crumbs = re.findall(r'markDraw\("TeamClaudeTableView\.[a-z]+"\)', match.group("body"))
        self.assertGreaterEqual(len(crumbs), 4, crumbs)

    def test_team_claude_table_uses_a_static_palette(self):
        self.assertIn("enum TeamClaudePalette", self.source)
        match = re.search(
            r"final class TeamClaudeTableView: NSView \{(?P<body>.*?)\nfinal class ServiceAvailabilitySummaryView",
            self.source,
            re.DOTALL,
        )
        body = match.group("body")
        self.assertNotIn("let titleFont = NSFont.systemFont", body)
        self.assertNotIn("let bg = NSColor(calibratedRed", body)
        self.assertIn("TeamClaudePalette.titleFont", body)


if __name__ == "__main__":
    unittest.main()
