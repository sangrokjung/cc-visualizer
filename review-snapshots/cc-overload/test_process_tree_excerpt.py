import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = ROOT / "process_tree_excerpt.swift"


class ProcessTreeExcerptTests(unittest.TestCase):
    def test_excerpt_typechecks_and_rejects_identity_races(self):
        binary = ROOT / ".process-tree-excerpt-tests"
        subprocess.run(
            [
                "swiftc",
                "-parse-as-library",
                "-D",
                "PROCESS_TREE_SELFTEST",
                str(SOURCE),
                "-o",
                str(binary),
            ],
            cwd=ROOT,
            check=True,
            timeout=30,
        )
        try:
            result = subprocess.run(
                [str(binary)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertIn("ProcessTreeExcerptTests: 5 passed, 0 failed", result.stdout)
        finally:
            binary.unlink(missing_ok=True)

        source = SOURCE.read_text()
        self.assertIn("POSIX_SPAWN_SETPGROUP", source)
        self.assertIn("WEXITED | WNOHANG | WNOWAIT", source)
        self.assertIn("Darwin.killpg(childPid, SIGTERM)", source)
        self.assertIn("Darwin.killpg(childPid, SIGKILL)", source)
        self.assertNotIn("/bin/ps", source)
        self.assertNotIn("proc_pidinfo(", source)


if __name__ == "__main__":
    unittest.main()
