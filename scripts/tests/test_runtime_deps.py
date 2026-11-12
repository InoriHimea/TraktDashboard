import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "apps/api/install-runtime-deps.sh"
DEFAULT_MIRROR = "https://dl-cdn.alpinelinux.org/alpine"
FAKE_BINARY = r'''
import json
import os
from pathlib import Path
import sys

name = Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ["FAKE_LOG"], "a") as log:
    log.write(json.dumps({"name": name, "args": args}) + "\n")
if name == "busybox":
    assert args[:5] == ["timeout", "-s", "TERM", "-k", "10"]
    command = args[6:]
    stage = "postgres-tools" if command[0] == "sh" else (
        "curl" if command[-1] == "curl" else "postgres-client"
    )
    if os.environ.get("FAIL_TIMEOUT_STAGE") == stage:
        sys.exit(int(os.environ["FAKE_STATUS"]))
    os.execvp(command[0], command)
if name == "apk":
    if os.environ.get("FAIL_PACKAGE") == args[-1]:
        sys.exit(int(os.environ["FAKE_STATUS"]))
elif name in ["pg_dump", "pg_restore", "psql"]:
    if os.environ.get("FAIL_TOOL") == name:
        sys.exit(int(os.environ["FAKE_STATUS"]))
    print(name + " (PostgreSQL) 17.0-synthetic")
elif os.environ.get("FAIL_PROGRAM") == name:
    sys.exit(int(os.environ["FAKE_STATUS"]))
'''


class RuntimeDependencyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="runtime-deps-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.log = self.root / "commands.jsonl"
        for name in ["busybox", "apk", "pg_dump", "pg_restore", "psql", "sed", "rm"]:
            file = self.bin / name
            file.write_text("#!" + sys.executable + "\n" + FAKE_BINARY)
            file.chmod(0o700)

    def run_script(self, args=None, docker_run=False, **extra_env):
        self.log.write_text("")
        # No Docker, real apk, database credentials, network or inherited application environment.
        env = {
            "PATH": str(self.bin) + ":/usr/bin:/bin",
            "HOME": str(self.root), "LANG": "C", "FAKE_LOG": str(self.log),
            **extra_env,
        }
        command = ["/bin/sh", str(SCRIPT), *(args if args is not None else [DEFAULT_MIRROR])]
        if docker_run:
            dockerfile = (ROOT / "apps/api/Dockerfile").read_text()
            block = "APK_MIRROR=" + dockerfile.split("RUN APK_MIRROR=", 1)[1].split("\n\n", 1)[0]
            # Execute the actual RUN shell with fake apk/sed/rm; never touch /etc or remove source.
            block = block.replace("/tmp/install-runtime-deps.sh", shlex.quote(str(SCRIPT)))
            command = ["/bin/sh", "-c", block]
        result = subprocess.run(
            command, cwd=self.root, env=env, text=True, capture_output=True, timeout=10,
        )
        calls = [json.loads(line) for line in self.log.read_text().splitlines()]
        return result, calls

    def test_default_mirror_and_version_diagnostics(self):
        result, calls = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        apk_calls = [c["args"] for c in calls if c["name"] == "apk"]
        self.assertEqual(apk_calls, [
            ["add", "--no-cache", "curl"],
            ["add", "--no-cache", "--repository", DEFAULT_MIRROR + "/v3.21/main",
             "--repository", DEFAULT_MIRROR + "/v3.21/community", "postgresql17-client"],
        ])
        self.assertEqual([c["name"] for c in calls if c["name"] not in ["busybox", "apk"]],
                         ["pg_dump", "pg_restore", "psql"])
        self.assertEqual([c["args"] for c in calls if c["name"] not in ["busybox", "apk"]],
                         [["--version"], ["--version"], ["--version"]])
        self.assertNotIn("--allow-untrusted", json.dumps(calls))

    def test_custom_mirror_is_used_for_both_pg_repositories(self):
        for mirror in ["https://mirror.invalid/alpine", "https://mirror.invalid/alpine/"]:
            with self.subTest(mirror=mirror):
                result, calls = self.run_script([mirror])
                self.assertEqual(result.returncode, 0, result.stderr)
                pg = [c["args"] for c in calls if c["name"] == "apk"][-1]
                self.assertIn(mirror.rstrip("/") + "/v3.21/main", pg)
                self.assertIn(mirror.rstrip("/") + "/v3.21/community", pg)
                self.assertNotIn("dl-cdn.alpinelinux.org", json.dumps(calls))

    def test_mirror_argument_is_not_evaluated_as_shell(self):
        marker = self.root / "must-not-exist"
        mirror = "https://mirror.invalid/$(touch " + str(marker) + ")"
        result, calls = self.run_script([mirror])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(marker.exists())
        pg = [c["args"] for c in calls if c["name"] == "apk"][-1]
        self.assertIn(mirror + "/v3.21/main", pg)

    def test_rejects_missing_empty_or_extra_arguments_before_commands(self):
        for args in [[], [""], ["/"], [DEFAULT_MIRROR, "extra"]]:
            with self.subTest(args=args):
                result, calls = self.run_script(args)
                self.assertEqual(result.returncode, 64)
                self.assertEqual(calls, [])
                self.assertIn("nonempty APK mirror", result.stderr)

    def test_every_stage_has_a_deadline_and_kill_grace(self):
        result, calls = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        wrappers = [c["args"] for c in calls if c["name"] == "busybox"]
        self.assertEqual([c[:6] for c in wrappers], [
            ["timeout", "-s", "TERM", "-k", "10", "180"],
            ["timeout", "-s", "TERM", "-k", "10", "300"],
            ["timeout", "-s", "TERM", "-k", "10", "15"],
        ])

    def test_stage_logs_include_start_end_duration_and_status(self):
        result, _ = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        for stage, limit in [("curl", 180), ("postgres-client", 300), ("postgres-tools", 15)]:
            self.assertRegex(result.stdout, rf"APK_STAGE_START {stage} limit_seconds={limit} started_epoch=\d+")
            self.assertRegex(result.stdout, rf"APK_STAGE_END {stage} exit=0 elapsed_seconds=\d+ limit_seconds={limit}")
        self.assertNotIn(DEFAULT_MIRROR, result.stdout)

    def test_curl_failure_stops_before_postgres_without_retry(self):
        result, calls = self.run_script(FAIL_PACKAGE="curl", FAKE_STATUS="7")
        self.assertEqual(result.returncode, 7)
        self.assertEqual([c["args"][-1] for c in calls if c["name"] == "apk"], ["curl"])
        self.assertIn("APK_STAGE_END curl exit=7", result.stdout)
        self.assertNotIn("APK_STAGE_START postgres-client", result.stdout)

    def test_postgres_failure_skips_tool_checks_without_retry(self):
        result, calls = self.run_script(FAIL_PACKAGE="postgresql17-client", FAKE_STATUS="9")
        self.assertEqual(result.returncode, 9)
        self.assertEqual(sum(c["name"] == "apk" for c in calls), 2)
        self.assertNotIn("APK_STAGE_START postgres-tools", result.stdout)
        self.assertFalse(any(c["name"] == "pg_dump" for c in calls))

    def test_timeout_and_signal_exit_codes_are_preserved_without_guessing_cause(self):
        for stage, count in [("curl", 1), ("postgres-client", 2), ("postgres-tools", 3)]:
            for status in [124, 137, 143]:
                with self.subTest(stage=stage, status=status):
                    result, calls = self.run_script(FAIL_TIMEOUT_STAGE=stage, FAKE_STATUS=str(status))
                    self.assertEqual(result.returncode, status)
                    self.assertEqual(sum(c["name"] == "busybox" for c in calls), count)
                    self.assertIn(f"APK_STAGE_END {stage} exit={status}", result.stdout)
                    self.assertNotIn("network timeout", result.stdout.lower())

    def test_actual_docker_run_passes_normalized_mirror_to_both_install_sources(self):
        for mirror in [DEFAULT_MIRROR, "https://mirror.invalid/alpine/"]:
            with self.subTest(mirror=mirror):
                result, calls = self.run_script(docker_run=True, APK_MIRROR=mirror)
                self.assertEqual(result.returncode, 0, result.stderr)
                normalized = mirror.rstrip("/")
                sed_calls = [c["args"] for c in calls if c["name"] == "sed"]
                expected_sed = [] if mirror == DEFAULT_MIRROR else [[
                    "-i", f"s|{DEFAULT_MIRROR}|{normalized}|g", "/etc/apk/repositories",
                ]]
                self.assertEqual(sed_calls, expected_sed)
                pg = [c["args"] for c in calls if c["name"] == "apk"][-1]
                self.assertIn(normalized + "/v3.21/main", pg)
                self.assertIn(normalized + "/v3.21/community", pg)
                self.assertEqual(calls[-1], {"name": "rm", "args": [str(SCRIPT)]})

    def test_actual_docker_run_rejects_empty_mirror_before_install(self):
        result, calls = self.run_script(docker_run=True, APK_MIRROR="")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])

    def test_actual_docker_run_stops_on_mirror_configuration_failure(self):
        result, calls = self.run_script(docker_run=True, APK_MIRROR="https://mirror.invalid/alpine",
                                        FAIL_PROGRAM="sed", FAKE_STATUS="4")
        self.assertEqual(result.returncode, 4)
        self.assertEqual([c["name"] for c in calls], ["sed"])

    def test_actual_docker_run_preserves_install_failure_without_cleanup_or_retry(self):
        result, calls = self.run_script(docker_run=True, APK_MIRROR=DEFAULT_MIRROR,
                                        FAIL_TIMEOUT_STAGE="postgres-client", FAKE_STATUS="143")
        self.assertEqual(result.returncode, 143)
        self.assertNotIn("rm", [c["name"] for c in calls])
        self.assertNotIn("pg_dump", [c["name"] for c in calls])

    def test_version_tool_failure_stops_the_remaining_commands(self):
        tools = ["pg_dump", "pg_restore", "psql"]
        for i, tool in enumerate(tools):
            with self.subTest(tool=tool):
                result, calls = self.run_script(FAIL_TOOL=tool, FAKE_STATUS="6")
                self.assertEqual(result.returncode, 6)
                self.assertEqual([c["name"] for c in calls if c["name"] in tools], tools[:i + 1])
                self.assertIn("APK_STAGE_END postgres-tools exit=6", result.stdout)


class RuntimeDependencyWiringTests(unittest.TestCase):
    def test_dockerfile_copies_calls_and_removes_helper_without_changing_runtime(self):
        dockerfile = (ROOT / "apps/api/Dockerfile").read_text()
        copy = dockerfile.index("COPY apps/api/install-runtime-deps.sh /tmp/install-runtime-deps.sh")
        install = dockerfile.index('sh /tmp/install-runtime-deps.sh "$APK_MIRROR"')
        self.assertLess(copy, install)
        self.assertIn("rm /tmp/install-runtime-deps.sh", dockerfile)
        self.assertIn("FROM oven/bun:1.2-alpine AS runner", dockerfile)
        self.assertIn('ENTRYPOINT ["./docker-entrypoint.sh"]', dockerfile)
        self.assertNotIn("--repository https://dl-cdn.alpinelinux.org", dockerfile)
        self.assertIn('APK_MIRROR="${APK_MIRROR%/}"', dockerfile)
        self.assertIn('test -n "$APK_MIRROR"', dockerfile)

    def test_ci_runs_runtime_dependency_contracts(self):
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        self.assertIn("python3 -m unittest discover -s scripts/tests -p 'test_runtime_deps.py'", workflow)

    def test_pr_build_gate_is_bounded_and_does_not_publish_or_start_services(self):
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        build = workflow.split("    docker-build:\n", 1)[1].split("    smoke-test:", 1)[0]
        self.assertIn("if: github.event_name == 'pull_request'", build)
        self.assertIn("timeout-minutes: 35", build)
        self.assertEqual(build.count("timeout-minutes: 15"), 2)
        self.assertEqual(build.count("run: docker build --progress=plain"), 2)
        for forbidden in ["docker push", "--push", "docker compose", "docker run", "secrets."]:
            self.assertNotIn(forbidden, build)
        smoke = workflow.split("    smoke-test:\n", 1)[1].split("    notify-failure:", 1)[0]
        self.assertIn("if: github.event_name == 'push'", smoke)

    def test_e2e_uses_matching_preinstalled_image_with_scoped_cleanup(self):
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        e2e = workflow.split("    e2e:\n", 1)[1].split("    docker-build:", 1)[0]
        for expected in ["persist-credentials: false", "contents: read", "timeout-minutes: 25",
                         "mcr.microsoft.com/playwright:v1.60.0-noble@sha256:",
                         "require('@playwright/test/package.json').version", ".Config.Volumes",
                         "--mount \"type=bind,source=$GITHUB_WORKSPACE,target=/workspace\"",
                         "--cpus 2 --memory 4g --memory-swap 4g --pids-limit 512",
                         "--cap-drop ALL --security-opt no-new-privileges",
                         '--user "$(id -u):$(id -g)" --env HOME=/tmp',
                         "--prefix /tmp/pnpm pnpm@10.19.0 --ignore-scripts",
                         "--filter \"label=com.trakt-dashboard.e2e=$E2E_CONTAINER\"",
                         "pnpm test:e2e", "if: always()"]:
            self.assertIn(expected, e2e)
        for forbidden in ["--with-deps", "apt-get", "--privileged", "--network host",
                          "--ipc=host", "docker.sock", "--publish", "secrets.", "docker volume"]:
            self.assertNotIn(forbidden, e2e)


if __name__ == "__main__":
    unittest.main()
