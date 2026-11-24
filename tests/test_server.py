"""Server API tests. Standard library only.

    python3 -m unittest discover -s tests -v

Each run starts server.py on a free port with a throwaway data folder, so it
never touches data/planner.db.
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def plan(name="Obj", status="todo"):
    return {
        "title": "Test plan",
        "releases": [],
        "items": [
            {"id": "o1", "type": "obj", "parent": None, "name": name, "deps": []},
            {"id": "f1", "type": "feat", "parent": "o1", "name": "Feature", "deps": []},
            {"id": "t1", "type": "task", "parent": "f1", "name": "Task", "status": status, "deps": []},
        ],
    }


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="planner-test-")
        cls.port = free_port()
        env = dict(os.environ, PLANNER_QUIET="1")
        cls.proc = subprocess.Popen(
            [sys.executable, os.path.join(ROOT, "server.py"), "--port", str(cls.port), "--data", cls.tmp],
            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        for _ in range(50):
            try:
                cls.call("GET", "/api/health")
                return
            except OSError:
                time.sleep(0.1)
        raise RuntimeError("server did not start: " + cls.proc.stderr.read().decode())

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(5)
        cls.proc.stderr.close()
        shutil.rmtree(cls.tmp, ignore_errors=True)

    @classmethod
    def call(cls, method, path, body=None, user="Tester"):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request("http://127.0.0.1:%d%s" % (cls.port, path), data=data, method=method,
                                     headers={"Content-Type": "application/json", "X-User": user})
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if r.headers.get_content_type() == "application/json" else raw)
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, raw

    def new_plan(self, name="Plan"):
        code, p = self.call("POST", "/api/plans", {"name": name, "data": plan()})
        self.assertEqual(code, 201)
        return p

    def test_health(self):
        code, h = self.call("GET", "/api/health")
        self.assertEqual(code, 200)
        self.assertTrue(h["ok"])
        self.assertEqual(os.path.realpath(h["data"]), os.path.realpath(self.tmp))

    def test_page_is_served(self):
        code, body = self.call("GET", "/")
        self.assertEqual(code, 200)
        self.assertIn(b"<!DOCTYPE html>", body[:200])

    def test_no_path_traversal(self):
        code, _ = self.call("GET", "/../server.py")
        self.assertEqual(code, 404)
        code, _ = self.call("GET", "/%2e%2e/server.py")
        self.assertEqual(code, 404)

    def test_create_get_list(self):
        p = self.new_plan("Listed")
        code, got = self.call("GET", "/api/plans/" + p["id"])
        self.assertEqual(code, 200)
        self.assertEqual(got["data"]["items"][0]["name"], "Obj")
        code, lst = self.call("GET", "/api/plans")
        self.assertIn(p["id"], [x["id"] for x in lst])

    def test_save_bumps_rev_and_logs_change(self):
        p = self.new_plan()
        rev = p["rev"]
        code, r = self.call("PUT", "/api/plans/" + p["id"], {"data": plan(status="done"), "base_rev": rev})
        self.assertEqual(code, 200)
        self.assertEqual(r["rev"], rev + 1)
        self.assertGreaterEqual(r["changes"], 1)
        code, ch = self.call("GET", "/api/plans/%s/changes?item=t1" % p["id"])
        self.assertEqual(code, 200)
        self.assertTrue(ch, "expected a change row for t1")
        self.assertEqual(ch[0]["user"], "Tester")

    def test_conflict_on_stale_rev(self):
        p = self.new_plan()
        self.call("PUT", "/api/plans/" + p["id"], {"data": plan(name="A"), "base_rev": p["rev"]})
        code, r = self.call("PUT", "/api/plans/" + p["id"], {"data": plan(name="B"), "base_rev": p["rev"]})
        self.assertEqual(code, 409)
        code, r = self.call("PUT", "/api/plans/" + p["id"], {"data": plan(name="B"), "base_rev": p["rev"], "force": True})
        self.assertEqual(code, 200)

    def test_named_version_and_restore(self):
        p = self.new_plan()
        code, _ = self.call("POST", "/api/plans/%s/versions" % p["id"], {"note": "Baseline"})
        self.assertEqual(code, 200)
        code, vs = self.call("GET", "/api/plans/%s/versions" % p["id"])
        base = next(v for v in vs if v["note"] == "Baseline")
        code, cur = self.call("GET", "/api/plans/" + p["id"])
        self.call("PUT", "/api/plans/" + p["id"], {"data": plan(name="Changed"), "base_rev": cur["rev"]})
        code, r = self.call("POST", "/api/plans/%s/restore" % p["id"], {"version_id": base["id"]})
        self.assertEqual(code, 200)
        code, got = self.call("GET", "/api/plans/" + p["id"])
        self.assertEqual(got["data"]["items"][0]["name"], "Obj")

    def test_archive_then_delete(self):
        p = self.new_plan()
        code, _ = self.call("DELETE", "/api/plans/" + p["id"])
        self.assertEqual(code, 400, "unarchived plans must not be deletable")
        self.call("PATCH", "/api/plans/" + p["id"], {"archived": True})
        code, arch = self.call("GET", "/api/plans?archived=1")
        self.assertIn(p["id"], [x["id"] for x in arch])
        code, _ = self.call("DELETE", "/api/plans/" + p["id"])
        self.assertEqual(code, 200)
        code, _ = self.call("GET", "/api/plans/" + p["id"])
        self.assertEqual(code, 404)

    def test_copy_and_export(self):
        p = self.new_plan("Source")
        code, c = self.call("POST", "/api/plans", {"copy_from": p["id"]})
        self.assertEqual(code, 201)
        self.assertEqual(c["name"], "Copy of Source")
        code, ex = self.call("GET", "/api/export")
        self.assertIn(c["id"], [x["id"] for x in ex["plans"]])

    def test_bad_json_is_400(self):
        req = urllib.request.Request("http://127.0.0.1:%d/api/plans" % self.port, data=b"{nope", method="POST")
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req, timeout=5)
        self.assertEqual(cm.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
