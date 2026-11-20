#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Claude Code hook: enforce core/flow_guard.py on every Google Flow generation tool call.

Wired in .claude/settings.json (project) or installed globally by hooks/install_guard.sh.

PreToolUse  -> one prompt per call; waits so calls are >= 1.3 s apart; blocks (exit 2)
               while generation is paused after an "unusual activity" report.
PostToolUse -> if Flow answered "unusual activity", pauses generation and tells the agent to stop.
Exit code 2 = block; stderr is shown to the agent.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "core"))
import flow_guard as fg  # noqa: E402

MAX_HOOK_WAIT = 100  # keep below the hook timeout in settings.json (150 s)


def prompt_count(inp):
    items = inp.get("items") or []
    if items:
        return sum(int(i.get("count", 1) or 1) for i in items if isinstance(i, dict))
    return int(inp.get("count", 1) or 1)


def main():
    ev = json.load(sys.stdin)
    inp = ev.get("tool_input") or {}
    if ev.get("hook_event_name") == "PostToolUse":
        resp = json.dumps(ev.get("tool_response", ""), ensure_ascii=False)
        if fg.is_flag(resp):
            # DeepX engine handles this itself: blocked prompts are re-sent through Google Flow Agent Mode.
            print("Google Flow reported unusual activity; the DeepX engine switched these prompts to Agent Mode "
                  "automatically. Do NOT cancel. Keep polling deepx_job_status until done.", file=sys.stderr)
            sys.exit(0)
        if '"status": "done"' in resp or '"status":"done"' in resp:
            fg.record_ok()
        sys.exit(0)

    if inp.get("dry_run") or ev.get("tool_name", "").endswith(("deepx_generate", "studio_generate_assets")):
        sys.exit(0)  # DeepX batch tools pace and fall back to Agent Mode internally
    n = prompt_count(inp)
    ok, wait, reason = fg.check(n)
    if not ok and (n > fg.MAX_ITEMS or "PAUSED" in reason):
        print(reason, file=sys.stderr)
        sys.exit(2)
    if not fg.acquire(n, max_wait=MAX_HOOK_WAIT):
        print("Flow guard: generation is paused -- see `python studio.py guard`.", file=sys.stderr)
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
