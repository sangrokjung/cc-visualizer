import http.server
import json
import pathlib
import subprocess
import tempfile
import threading
import time
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class StatusHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.server.requests.append(dict(self.headers))
        mode = self.server.mode
        if mode == "redirect":
            self.send_response(302)
            self.send_header("Location", self.server.destination)
            self.end_headers()
            return
        self.send_response(503 if mode == "error" else 200)
        self.end_headers()
        if mode == "malformed":
            self.wfile.write(b"invalid JSON")
            return
        authenticated = (
            self.headers.get("x-api-key") == "fixture-value"
            and self.headers.get("x-teamcodex-status-identity") == "1"
        )
        rows = []
        for name in ["fixture-a", "fixture-b"]:
            row = {
                "name": name, "status": "active", "enabled": True, "usable": True,
                "quota": {"unified5h": 0.1, "unified7d": 0.2,
                          "unified5hReset": int((time.time() + 3600) * 1000),
                          "unified7dReset": int((time.time() + 86400) * 1000)},
                "usage": {}, "inflight": 0, "maxConcurrent": 3,
            }
            if not authenticated or mode == "anonymous" or (mode == "mixed" and name == "fixture-b"):
                del row["name"]
            rows.append(row)
        if mode == "drift":
            rows.pop()
        if mode == "empty":
            rows = []
        body = {"accounts": rows, "currentAccount": "fixture-a", "switchThreshold": 0.98}
        if mode == "missing-accounts":
            del body["accounts"]
        self.wfile.write(json.dumps(body).encode())

    def log_message(self, *_):
        pass


class TeamClaudeStatusIdentityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="teamclaude-identity-")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.binary = pathlib.Path(cls.temp.name) / "status-test"
        main = (ROOT / "menubar/Sources/main.swift").read_text()
        entry = "\nlet delegate = AppDelegate()\nlet app = NSApplication.shared"
        assert main.count(entry) == 1
        driver = r'''
let home = CommandLine.arguments[1]
let health = loadTeamClaudeHealth(home: home)
let displayed = teamClaudeHealthMergingQuota(candidate: health, previous: nil)
let recovery = teamClaudeRecoveryReason(
    serverReachable: displayed.serverReachable,
    configPresent: displayed.configPresent,
    accountConfigDrift: displayed.accountConfigDrift
)
let payload: [String: Any] = [
    "names": displayed.accounts.map(\.name),
    "rows": displayed.accounts.count,
    "drift": displayed.accountConfigDrift,
    "pending": displayed.measurementPendingCount,
    "usable": displayed.accountUsable,
    "reachable": displayed.serverReachable,
    "recovery": recovery != nil,
    "hints": displayed.hints,
    "title": displayed.titleSlot,
    "warning": displayed.isWarning,
]
print(String(decoding: try JSONSerialization.data(withJSONObject: payload), as: UTF8.self))
'''
        source = pathlib.Path(cls.temp.name) / "main.swift"
        source.write_text(main.split(entry)[0] + driver)
        dependencies = sorted((ROOT / "menubar/Sources").glob("*.swift"))
        subprocess.run(
            ["swiftc", "-framework", "Cocoa", "-framework", "Foundation",
             *[str(p) for p in dependencies if p.name != "main.swift"],
             str(source), "-o", str(cls.binary)],
            check=True, timeout=180,
        )

    def setUp(self):
        self.fixture = tempfile.TemporaryDirectory(prefix="teamclaude-config-")
        self.addCleanup(self.fixture.cleanup)
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), StatusHandler)
        self.server.requests = []
        self.server.mode = "normal"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def fetch(self, key="fixture-value"):
        config = pathlib.Path(self.fixture.name) / ".config/teamclaude.json"
        config.parent.mkdir(exist_ok=True)
        config.write_text(json.dumps({
            "proxy": {"port": self.server.server_port, "apiKey": key},
            "accounts": [{"name": name, "type": "oauth"} for name in ["fixture-a", "fixture-b"]],
        }))
        result = subprocess.run(
            [str(self.binary), self.fixture.name],
            capture_output=True, text=True, check=True, timeout=15,
        )
        return json.loads(result.stdout)

    def test_configured_key_restores_account_identity(self):
        result = self.fetch()
        self.assertEqual(result["names"], ["fixture-a", "fixture-b"])
        self.assertEqual(result["rows"], 2)
        self.assertEqual(result["drift"], 0)
        self.assertEqual(result["usable"], 2)
        self.assertFalse(result["recovery"])

    def test_anonymous_response_never_duplicates_or_restarts(self):
        for mode, key in [("normal", ""), ("normal", "wrong"), ("anonymous", "fixture-value"),
                          ("mixed", "fixture-value"), ("missing-accounts", "fixture-value"),
                          ("malformed", "fixture-value")]:
            with self.subTest(mode=mode, key=key):
                self.server.mode = mode
                result = self.fetch(key)
                self.assertEqual(result["names"], ["fixture-a", "fixture-b"])
                self.assertEqual(result["drift"], 0)
                self.assertEqual(result["pending"], 0)
                self.assertEqual(result["usable"], 0)
                self.assertTrue(result["reachable"])
                self.assertTrue(result["warning"])
                self.assertFalse(result["recovery"])
                self.assertIn("조회 인증", result["title"])
        self.server.mode = "normal"
        self.assertEqual(self.fetch()["usable"], 2)

    def test_empty_key_does_not_send_identity_headers(self):
        self.fetch("")
        headers = {key.lower(): value for key, value in self.server.requests[0].items()}
        self.assertNotIn("x-api-key", headers)
        self.assertNotIn("x-teamcodex-status-identity", headers)

    def test_actual_missing_accounts_still_report_drift(self):
        for mode, expected in [("drift", 1), ("empty", 2)]:
            self.server.mode = mode
            result = self.fetch()
            self.assertEqual(result["drift"], expected)
            self.assertTrue(result["recovery"])

    def test_http_errors_are_not_healthy(self):
        self.server.mode = "error"
        result = self.fetch()
        self.assertFalse(result["reachable"])
        self.assertEqual(result["usable"], 0)

    def test_redirect_does_not_forward_credentials(self):
        sink = http.server.ThreadingHTTPServer(("127.0.0.1", 0), StatusHandler)
        sink.requests = []
        sink.mode = "normal"
        thread = threading.Thread(target=sink.serve_forever, daemon=True)
        thread.start()
        try:
            self.server.mode = "redirect"
            self.server.destination = f"http://127.0.0.1:{sink.server_port}/unexpected"
            self.assertFalse(self.fetch()["reachable"])
            self.assertEqual(len(self.server.requests), 1)
            self.assertEqual(sink.requests, [])
        finally:
            sink.shutdown()
            sink.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
