# -*- coding: utf-8 -*-
"""flow_guard.py: device-wide pacing ledger for Google Flow generations.

Policy (chosen by the studio owner):
  * 0.8 s between prompt submissions to Flow (images generate in parallel)   FLOW_GUARD_GAP (default 0.8)
  * prompts are submitted one by one, never as one big batch call
  * the FIRST "unusual activity" answer stops generation: the queue is cancelled
    and nothing more is sent until the user resumes (`python studio.py generate`
    resumes where it stopped and never regenerates finished images)

Paths that go through this gate:
  * core/flow_safe.py        (`python studio.py generate`)
  * hooks/flow_guard_hook.py (Claude Code hook on google_flow_mcp tools, see .claude/settings.json)

State lives in ONE ledger per device (~/.deepesh_flow_guard.json, file-locked), so two
terminals/agents can't interleave faster than the gap.

CLI:
  python core/flow_guard.py status     last submission, pause state
  python core/flow_guard.py reset      clear the pause after you have checked Flow by hand
"""

import json, os, sys, time
from contextlib import contextmanager

try:                                    # Linux / macOS / Android
    import fcntl

    def _lock(fh):
        fcntl.flock(fh, fcntl.LOCK_EX)

    def _unlock(fh):
        fcntl.flock(fh, fcntl.LOCK_UN)
except ImportError:                     # Windows
    import msvcrt

    def _lock(fh):
        fh.seek(0)
        msvcrt.locking(fh.fileno(), msvcrt.LK_LOCK, 1)

    def _unlock(fh):
        fh.seek(0)
        msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)

LEDGER = os.path.expanduser(os.environ.get("FLOW_GUARD_LEDGER", "~/.deepesh_flow_guard.json"))
GAP = float(os.environ.get("FLOW_GUARD_GAP", "1.2"))
MAX_ITEMS = 1                      # one prompt per submission; the gap is what paces Flow
FLAG_MARKERS = ("UNUSUAL_ACTIVITY", "unusual activity")


@contextmanager
def _ledger():
    os.makedirs(os.path.dirname(LEDGER) or ".", exist_ok=True)
    with open(LEDGER, "a+") as fh:
        _lock(fh)
        fh.seek(0)
        try:
            data = json.loads(fh.read() or "{}")
        except ValueError:
            data = {}
        data.setdefault("last", 0.0)
        data.setdefault("paused", False)
        data.setdefault("flags", 0)
        data.setdefault("sent_total", 0)
        data.pop("sent", None)            # legacy keys from the old quota ledger
        data.pop("cooldown_until", None)
        yield data
        fh.seek(0)
        fh.truncate()
        fh.write(json.dumps(data))
        fh.flush()
        fcntl.flock(fh, fcntl.LOCK_UN)


def check(n=1):
    """(allowed_now, wait_seconds, reason) without recording anything."""
    if n > MAX_ITEMS:
        return False, 0.0, (f"{n} prompts in one call; submit prompts one at a time "
                            f"(`python studio.py generate` does this with the {GAP:g}s gap).")
    with _ledger() as d:
        if d["paused"]:
            return False, 0.0, ("Flow guard PAUSED: Flow reported unusual activity. Generation is stopped. "
                                "Check Flow in the browser, then `python studio.py guard reset` and resume.")
        w = max(0.0, d["last"] + GAP - time.time())
        return (w <= 0), w, ("ok" if w <= 0 else f"pacing: next submission in {w:.2f}s")


def acquire(n=1, max_wait=None, log=print):
    """Wait for the gap, then record the submission. Returns False if paused (or wait > max_wait)."""
    if n > MAX_ITEMS:
        raise ValueError(f"one prompt per submission (got {n})")
    while True:
        with _ledger() as d:
            if d["paused"]:
                return False
            now = time.time()
            w = d["last"] + GAP - now
            if w <= 0:
                d["last"] = now
                d["sent_total"] += 1
                return True
        if max_wait is not None and w > max_wait:
            return False
        time.sleep(w)


def mark_submitted():
    """Call when Flow has ACCEPTED a prompt: the gap is measured from acceptance, not from queueing."""
    with _ledger() as d:
        d["last"] = time.time()


def record_ok():
    with _ledger() as d:
        d["flags"] = 0


def record_flag():
    with _ledger() as d:
        d["flags"] += 1
        d["paused"] = True


def reset():
    with _ledger() as d:
        d["paused"] = False
        d["flags"] = 0


def is_flag(text):
    return any(m in str(text) for m in FLAG_MARKERS)


def status():
    with _ledger() as d:
        return {"gap_s": GAP, "paused": d["paused"], "flags": d["flags"],
                "seconds_since_last_submission": round(time.time() - d["last"], 1) if d["last"] else None,
                "submitted_total": d["sent_total"]}


if __name__ == "__main__":
    cmd = (sys.argv[1:] or ["status"])[0]
    if cmd == "status":
        print(json.dumps(status(), indent=2))
    elif cmd == "reset":
        reset(); print("Flow guard: pause cleared")
    else:
        sys.exit(__doc__)
