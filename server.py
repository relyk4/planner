#!/usr/bin/env python3
"""Planner: an offline dependency planner.

Runs with the Python 3 standard library only (3.8 or newer). No packages to
install and no internet needed. Data lives in one SQLite file.

    python3 server.py                 # http://127.0.0.1:8080
    python3 server.py --port 9000 --data /srv/planner-data
    python3 server.py --host 0.0.0.0  # let other machines on the network in

Environment variables PLANNER_HOST, PLANNER_PORT, PLANNER_DATA and
PLANNER_COALESCE_SECONDS do the same (the Docker image uses them).
"""
import argparse
import json
import mimetypes
import os
import re
import sqlite3
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

VERSION = "1.0.0"
ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(ROOT, "static")
MAX_BODY = 25 * 1024 * 1024
LOCK = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS plans(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created REAL, updated REAL,
  updated_by TEXT, rev INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS versions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  rev INTEGER, ts REAL, user TEXT, note TEXT, nchanges INTEGER DEFAULT 0,
  data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_versions_plan ON versions(plan_id, id);
CREATE TABLE IF NOT EXISTS changes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  rev INTEGER, ts REAL, user TEXT, item_id TEXT, item_type TEXT,
  item_name TEXT, field TEXT, old TEXT, new TEXT);
CREATE INDEX IF NOT EXISTS ix_changes_plan ON changes(plan_id, id);
CREATE INDEX IF NOT EXISTS ix_changes_item ON changes(plan_id, item_id, id);
"""

CFG = {"data": None, "coalesce": 120}


def db():
    con = sqlite3.connect(os.path.join(CFG["data"], "planner.db"), timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


def init_db():
    os.makedirs(CFG["data"], exist_ok=True)
    with db() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.executescript(SCHEMA)


# ---------------------------------------------------------------- change log

ITEM_FIELDS = [
    ("name", "Name"), ("key", "Ticket key"), ("url", "Link override"), ("parent", "Parent"),
    ("owner", "Owner"), ("team", "Team"), ("status", "Status"),
    ("startBy", "Start by"), ("due", "Due"), ("startedOn", "Started"),
    ("doneOn", "Done"), ("blocker", "External blocker"), ("rel", "Release"),
    ("earliest", "Pinned step"), ("gate", "Pinned gate"), ("target", "Target"), ("ref", "Their ticket"),
    ("color", "Color"), ("notes", "Notes"),
]
REL_FIELDS = [("name", "Name"), ("target", "Target"), ("status", "Status"),
              ("due", "Due"), ("notes", "Notes")]
STATUS = {"todo": "Not started", "doing": "In progress", "done": "Done", "blocked": "Blocked",
          "pending": "Not delivered", "committed": "Committed", "atrisk": "At risk", "delivered": "Delivered",
          "planned": "Planned", "active": "In progress", "released": "Released"}
KIND = {"obj": "objective", "feat": "feature", "task": "task",
        "ms": "milestone", "ext": "external"}


def _s(v):
    if v is None:
        return ""
    if isinstance(v, (dict, list)):
        return json.dumps(v, sort_keys=True)
    return str(v)


def _clip(v, n=600):
    v = _s(v)
    return v if len(v) <= n else v[: n - 1] + "…"


def diff(old, new):
    """Return a list of (item_id, item_type, item_name, field, old, new)."""
    old = old or {}
    out = []
    oi = {i["id"]: i for i in old.get("items", []) if isinstance(i, dict) and "id" in i}
    ni = {i["id"]: i for i in new.get("items", []) if isinstance(i, dict) and "id" in i}
    names = {k: v.get("name", "") for k, v in oi.items()}
    names.update({k: v.get("name", "") for k, v in ni.items()})
    rels = {r.get("id"): r.get("name", "") for r in old.get("releases", []) + new.get("releases", []) if isinstance(r, dict)}

    def show(field, v):
        if field == "status":
            return STATUS.get(v, _s(v))
        if field == "parent":
            return names.get(v, "") if v else ""
        if field == "rel":
            return "None" if v == "-" else rels.get(v, "") if v else ""
        return _s(v)

    def dep_txt(d):
        lag = d.get("lag") or 0
        lag_s = (("+" if lag > 0 else "-") + str(abs(lag))) if lag else ""
        return "%s %s%s%s" % (names.get(d.get("id"), "?"), d.get("type", "FS"), lag_s,
                             " blocked" if d.get("st") == "blocked" else "")

    if _s(old.get("title")) != _s(new.get("title")) and old:
        out.append(("plan", "plan", new.get("title", ""), "Plan name", old.get("title", ""), new.get("title", "")))

    for iid, it in ni.items():
        kind = KIND.get(it.get("type"), it.get("type", ""))
        if iid not in oi:
            out.append((iid, kind, it.get("name", ""), "Created", "", it.get("name", "")))
            continue
        was = oi[iid]
        for f, label in ITEM_FIELDS:
            a, b = was.get(f), it.get(f)
            if _s(a) != _s(b) and not (a in (None, "") and b in (None, "")):
                out.append((iid, kind, it.get("name", ""), label, show(f, a), show(f, b)))
        od = {d.get("id"): d for d in was.get("deps", []) if isinstance(d, dict)}
        nd = {d.get("id"): d for d in it.get("deps", []) if isinstance(d, dict)}
        for did, d in nd.items():
            if did not in od:
                out.append((iid, kind, it.get("name", ""), "Link added", "", dep_txt(d)))
            elif json.dumps(od[did], sort_keys=True) != json.dumps(d, sort_keys=True):
                out.append((iid, kind, it.get("name", ""), "Link changed", dep_txt(od[did]) + _note(od[did]), dep_txt(d) + _note(d)))
        for did, d in od.items():
            if did not in nd:
                out.append((iid, kind, it.get("name", ""), "Link removed", dep_txt(d), ""))
    for iid, it in oi.items():
        if iid not in ni:
            out.append((iid, KIND.get(it.get("type"), ""), it.get("name", ""), "Deleted", it.get("name", ""), ""))

    orl = {r.get("id"): r for r in old.get("releases", []) if isinstance(r, dict)}
    nrl = {r.get("id"): r for r in new.get("releases", []) if isinstance(r, dict)}
    for rid, r in nrl.items():
        if rid not in orl:
            out.append((rid, "release", r.get("name", ""), "Created", "", r.get("name", "")))
            continue
        for f, label in REL_FIELDS:
            if _s(orl[rid].get(f)) != _s(r.get(f)):
                out.append((rid, "release", r.get("name", ""), label, _s(orl[rid].get(f)), _s(r.get(f))))
    for rid, r in orl.items():
        if rid not in nrl:
            out.append((rid, "release", r.get("name", ""), "Deleted", r.get("name", ""), ""))
    return out


def _note(d):
    return " (%s)" % d["note"] if d.get("note") else ""


# ------------------------------------------------------------------- storage

def plan_row(r, with_data=False):
    p = {"id": r["id"], "name": r["name"], "created": r["created"], "updated": r["updated"],
         "updated_by": r["updated_by"], "rev": r["rev"], "archived": bool(r["archived"])}
    if with_data:
        p["data"] = json.loads(r["data"])
    return p


def create_plan(con, name, data, user):
    pid = uuid.uuid4().hex[:12]
    now = time.time()
    data = data if isinstance(data, dict) else {}
    data["title"] = name or data.get("title") or "Untitled plan"
    blob = json.dumps(data, separators=(",", ":"))
    con.execute("INSERT INTO plans(id,name,created,updated,updated_by,rev,archived,data) VALUES(?,?,?,?,?,1,0,?)",
                (pid, data["title"], now, now, user, blob))
    con.execute("INSERT INTO versions(plan_id,rev,ts,user,note,nchanges,data) VALUES(?,?,?,?,?,?,?)",
                (pid, 1, now, user, "Created", 0, blob))
    con.execute("INSERT INTO changes(plan_id,rev,ts,user,item_id,item_type,item_name,field,old,new) VALUES(?,?,?,?,?,?,?,?,?,?)",
                (pid, 1, now, user, "plan", "plan", data["title"], "Plan created", "", data["title"]))
    return pid


def save_plan(con, pid, data, user, note=None, force_version=False):
    r = con.execute("SELECT * FROM plans WHERE id=?", (pid,)).fetchone()
    old = json.loads(r["data"])
    rev = r["rev"] + 1
    now = time.time()
    changes = diff(old, data)
    blob = json.dumps(data, separators=(",", ":"))
    name = (data.get("title") or r["name"] or "Untitled plan")[:200]
    con.execute("UPDATE plans SET name=?,updated=?,updated_by=?,rev=?,data=? WHERE id=?",
                (name, now, user, rev, blob, pid))
    con.executemany(
        "INSERT INTO changes(plan_id,rev,ts,user,item_id,item_type,item_name,field,old,new) VALUES(?,?,?,?,?,?,?,?,?,?)",
        [(pid, rev, now, user, c[0], c[1], _clip(c[2], 200), c[3], _clip(c[4]), _clip(c[5])) for c in changes])
    last = con.execute("SELECT * FROM versions WHERE plan_id=? ORDER BY id DESC LIMIT 1", (pid,)).fetchone()
    if (not force_version and not note and last is not None and not last["note"]
            and last["user"] == user and now - last["ts"] < CFG["coalesce"]):
        con.execute("UPDATE versions SET rev=?,ts=?,nchanges=nchanges+?,data=? WHERE id=?",
                    (rev, now, len(changes), blob, last["id"]))
    else:
        con.execute("INSERT INTO versions(plan_id,rev,ts,user,note,nchanges,data) VALUES(?,?,?,?,?,?,?)",
                    (pid, rev, now, user, note, len(changes), blob))
    return rev, now, len(changes)


# -------------------------------------------------------------------- server

class Api(BaseHTTPRequestHandler):
    server_version = "Planner/" + VERSION
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        if os.environ.get("PLANNER_QUIET"):
            return
        sys.stderr.write("%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    # helpers
    def user(self):
        u = unquote(self.headers.get("X-User", "") or "").strip()
        return (u or "unknown")[:80]

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def fail(self, code, msg, **extra):
        self.send_json(dict(error=msg, **extra), code)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("Request is too large")
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def serve_static(self, path):
        rel = path.lstrip("/") or "index.html"
        full = os.path.realpath(os.path.join(STATIC, rel))
        if not full.startswith(os.path.realpath(STATIC) + os.sep) or not os.path.isfile(full):
            full = os.path.join(STATIC, "index.html") if "." not in os.path.basename(rel) else None
        if not full or not os.path.isfile(full):
            return self.fail(404, "Not found")
        with open(full, "rb") as fh:
            data = fh.read()
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # routing
    def handle_any(self, method):
        url = urlparse(self.path)
        q = {k: v[-1] for k, v in parse_qs(url.query).items()}
        parts = [p for p in url.path.split("/") if p]
        if not parts or parts[0] != "api":
            if method != "GET":
                return self.fail(405, "Method not allowed")
            return self.serve_static(url.path)
        try:
            with LOCK:
                con = db()
                try:
                    with con:
                        return self.route(method, parts[1:], q, con)
                finally:
                    con.close()
        except json.JSONDecodeError:
            return self.fail(400, "Body is not valid JSON")
        except ValueError as e:
            return self.fail(400, str(e))
        except Exception as e:  # keep the server up; report the problem
            self.log_message("error: %r", e)
            return self.fail(500, "Server error: %s" % e)

    def route(self, method, p, q, con):
        user = self.user()
        if p == ["health"]:
            return self.send_json({"ok": True, "version": VERSION, "data": CFG["data"]})
        if p == ["plans"] and method == "GET":
            arch = q.get("archived") == "1"
            rows = con.execute("SELECT * FROM plans WHERE archived=? ORDER BY updated DESC", (1 if arch else 0,)).fetchall()
            return self.send_json([plan_row(r) for r in rows])
        if p == ["plans"] and method == "POST":
            b = self.body()
            data = b.get("data")
            if b.get("copy_from"):
                src = con.execute("SELECT data,name FROM plans WHERE id=?", (b["copy_from"],)).fetchone()
                if not src:
                    return self.fail(404, "Plan to copy not found")
                data = json.loads(src["data"])
                data.pop("sample", None)
                b.setdefault("name", "Copy of " + src["name"])
            pid = create_plan(con, b.get("name"), data, user)
            return self.send_json(plan_row(con.execute("SELECT * FROM plans WHERE id=?", (pid,)).fetchone(), True), 201)
        if p == ["export"]:
            rows = con.execute("SELECT * FROM plans ORDER BY name").fetchall()
            return self.send_json({"exported": time.time(), "version": VERSION, "plans": [plan_row(r, True) for r in rows]})
        if len(p) >= 2 and p[0] == "plans":
            pid = p[1]
            r = con.execute("SELECT * FROM plans WHERE id=?", (pid,)).fetchone()
            if not r:
                return self.fail(404, "Plan not found")
            rest = p[2:]
            if not rest:
                if method == "GET":
                    return self.send_json(plan_row(r, True))
                if method == "PUT":
                    b = self.body()
                    if not isinstance(b.get("data"), dict):
                        return self.fail(400, "Missing plan data")
                    if "base_rev" in b and int(b["base_rev"]) != r["rev"] and not b.get("force"):
                        return self.fail(409, "conflict", rev=r["rev"], updated=r["updated"], updated_by=r["updated_by"])
                    rev, ts, n = save_plan(con, pid, b["data"], user, b.get("note"))
                    return self.send_json({"rev": rev, "updated": ts, "changes": n})
                if method == "PATCH":
                    b = self.body()
                    if "archived" in b:
                        con.execute("UPDATE plans SET archived=? WHERE id=?", (1 if b["archived"] else 0, pid))
                        con.execute("INSERT INTO changes(plan_id,rev,ts,user,item_id,item_type,item_name,field,old,new) VALUES(?,?,?,?,?,?,?,?,?,?)",
                                    (pid, r["rev"], time.time(), user, "plan", "plan", r["name"], "Archived" if b["archived"] else "Restored from archive", "", ""))
                    if b.get("name"):
                        data = json.loads(r["data"])
                        data["title"] = str(b["name"])[:200]
                        save_plan(con, pid, data, user)
                    return self.send_json(plan_row(con.execute("SELECT * FROM plans WHERE id=?", (pid,)).fetchone()))
                if method == "DELETE":
                    if not r["archived"]:
                        return self.fail(400, "Archive a plan before deleting it")
                    con.execute("DELETE FROM plans WHERE id=?", (pid,))
                    return self.send_json({"deleted": pid})
            if rest == ["versions"] and method == "GET":
                lim = min(int(q.get("limit", 200)), 2000)
                rows = con.execute("SELECT id,rev,ts,user,note,nchanges FROM versions WHERE plan_id=? ORDER BY id DESC LIMIT ?", (pid, lim)).fetchall()
                return self.send_json([dict(x) for x in rows])
            if rest == ["versions"] and method == "POST":
                b = self.body()
                note = (b.get("note") or "Saved version").strip()[:200]
                rev, ts, n = save_plan(con, pid, json.loads(r["data"]), user, note=note, force_version=True)
                return self.send_json({"rev": rev, "updated": ts})
            if len(rest) == 2 and rest[0] == "versions" and method == "GET":
                v = con.execute("SELECT * FROM versions WHERE plan_id=? AND id=?", (pid, rest[1])).fetchone()
                if not v:
                    return self.fail(404, "Version not found")
                d = dict(v)
                d["data"] = json.loads(v["data"])
                return self.send_json(d)
            if rest == ["restore"] and method == "POST":
                b = self.body()
                v = con.execute("SELECT * FROM versions WHERE plan_id=? AND id=?", (pid, b.get("version_id"))).fetchone()
                if not v:
                    return self.fail(404, "Version not found")
                note = "Restored version from %s" % time.strftime("%b %d %H:%M", time.localtime(v["ts"]))
                rev, ts, n = save_plan(con, pid, json.loads(v["data"]), user, note=note, force_version=True)
                return self.send_json({"rev": rev, "updated": ts, "changes": n,
                                       "data": json.loads(v["data"])})
            if rest == ["changes"] and method == "GET":
                lim = min(int(q.get("limit", 300)), 5000)
                sql = "SELECT * FROM changes WHERE plan_id=?"
                args = [pid]
                if q.get("item"):
                    sql += " AND item_id=?"
                    args.append(q["item"])
                if q.get("before"):
                    sql += " AND id<?"
                    args.append(int(q["before"]))
                sql += " ORDER BY id DESC LIMIT ?"
                args.append(lim)
                return self.send_json([dict(x) for x in con.execute(sql, args).fetchall()])
        return self.fail(404, "Unknown endpoint")

    def do_GET(self):
        self.handle_any("GET")

    def do_POST(self):
        self.handle_any("POST")

    def do_PUT(self):
        self.handle_any("PUT")

    def do_PATCH(self):
        self.handle_any("PATCH")

    def do_DELETE(self):
        self.handle_any("DELETE")


def main():
    ap = argparse.ArgumentParser(description="Offline dependency planner")
    ap.add_argument("--host", default=os.environ.get("PLANNER_HOST", "127.0.0.1"),
                    help="Address to listen on. 127.0.0.1 keeps it to this machine; 0.0.0.0 opens it to the network.")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PLANNER_PORT", "8080")))
    ap.add_argument("--data", default=os.environ.get("PLANNER_DATA", os.path.join(ROOT, "data")),
                    help="Folder for planner.db")
    ap.add_argument("--coalesce", type=int, default=int(os.environ.get("PLANNER_COALESCE_SECONDS", "120")),
                    help="Seconds within which one person's autosaves merge into one version")
    a = ap.parse_args()
    CFG["data"] = os.path.abspath(a.data)
    CFG["coalesce"] = a.coalesce
    init_db()
    # Pin these: on Windows the registry can map them to text/plain, and
    # browsers refuse a stylesheet served as text/plain.
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    srv = ThreadingHTTPServer((a.host, a.port), Api)
    shown = "localhost" if a.host in ("127.0.0.1", "0.0.0.0") else a.host
    print("Planner %s running at http://%s:%d  (data: %s)" % (VERSION, shown, a.port, CFG["data"]), flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
