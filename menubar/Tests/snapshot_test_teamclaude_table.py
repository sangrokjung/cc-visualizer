# menubar/Tests/snapshot_test_teamclaude_table.py
"""빌드된 cc-menubar로 TeamClaude 표를 오프스크린 렌더한다.
프록시 status 모양의 픽스처 5종이 NSException 없이 PNG를 내면 통과.
build.sh가 빌드 직후 실행한다(러너의 test_*.py 글롭 밖)."""
import json
import os
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
BINARY = ROOT / "menubar" / ".build" / "cc-menubar"


def account(status="active", usable=True, enabled=True, error=None,
            unified5h=0.5, unified7d=0.9, unified_status="allowed", fable=0.1, name=None):
    quota = {
        "unified5h": unified5h, "unified7d": unified7d,
        "unified5hReset": 1790078400000, "unified7dReset": 1790449200000,
        "unifiedStatus": unified_status,
        "modelWeekly": {"7d_oi": {"utilization": fable, "reset": 1790449200000}} if fable is not None else {},
    }
    row = {
        "type": "oauth", "provider": "anthropic", "status": status, "errorReason": error,
        "planType": None, "subscription": {"state": "active", "endsAt": None},
        "usable": usable, "enabled": enabled, "priority": None, "quota": quota,
        "usage": {"totalInputTokens": 1, "totalOutputTokens": 1, "totalRequests": 1, "lastUsed": None},
        "inflight": 0, "maxConcurrent": 3, "rateLimitedUntil": None, "unsupportedModels": [],
    }
    if name:
        row["name"] = name
    return row


FIXTURES = {
    "empty": [],
    "all-error": [account(status="error", usable=False, enabled=False, error="subscription-disabled",
                          unified5h=None, unified7d=None, unified_status=None, fable=None) for _ in range(5)],
    "no-quota": [account(usable=False, unified5h=None, unified7d=None, unified_status=None, fable=None)],
    "rejected": [account(usable=False, unified5h=0, unified7d=1, unified_status="rejected", fable=1)],
    "named-mixed": [
        account(name="a0"),
        account(name="a1", usable=False, unified7d=1, unified_status="rejected", fable=1),
        account(name="a2", status="error", usable=False, error="refresh-failed",
                unified5h=None, unified7d=None, unified_status=None, fable=None),
    ],
}


class TeamClaudeTableSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not BINARY.exists():
            subprocess.run(["bash", str(ROOT / "menubar" / "build.sh")], cwd=ROOT, check=True, timeout=900,
                           env={**os.environ, "CC_MENUBAR_SKIP_TESTS": "1", "CC_MENUBAR_SKIP_SNAPSHOT": "1"})

    def test_every_fixture_renders_without_an_uncaught_exception(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name, accounts in FIXTURES.items():
                with self.subTest(fixture=name):
                    fixture = pathlib.Path(tmp) / f"{name}.json"
                    fixture.write_text(json.dumps({
                        "accounts": accounts,
                        "usableCount": sum(1 for a in accounts if a["usable"]),
                        "totalCount": len(accounts),
                        "switchThreshold": 1,
                    }))
                    out = pathlib.Path(tmp) / f"{name}.png"
                    result = subprocess.run(
                        [str(BINARY), "--teamclaude-table-snapshot", str(fixture), str(out)],
                        cwd=ROOT, capture_output=True, text=True, timeout=60,
                    )
                    self.assertEqual(0, result.returncode, f"{name}: {result.stderr[-2000:]}")
                    self.assertNotIn("CRASH", result.stderr, name)
                    self.assertTrue(out.exists() and out.stat().st_size > 1000, name)


if __name__ == "__main__":
    unittest.main()
