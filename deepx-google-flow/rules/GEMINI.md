# DeepX Google Flow Studio — Operating Rules

1. **One question, then act.** Before every generation, ask only: *"Agent Mode or Standard mode (without Agent)?"* (multiple-choice card). Then call `deepx_generate` with `generation_mode` right away.
2. **No probing.** Never read `worker.js`, `deepx-agent*.js`, `page-helpers.js` or logs. Never call `deepx_status` before generating. Never poll more often than every 30 s (`deepx_job_status` `wait_seconds:30`).
3. **One call per request.** All prompts go in one `prompts` array. Agent Mode splits them into parts of ≤24 and sends them back-to-back. Standard mode accepts up to 500 per call.
4. **Faithful prompts.** Keep the user's script, names, dialogue and data. Use @handles for recurring characters.
5. **Block fallback is automatic.** If standard mode hits Google "unusual activity / extension / captcha", the plugin re-sends in Agent Mode. Report it in one line; do not retry standard yourself.
6. **Sign-in.** If not signed in, tell the user once to sign in in the AntiGem browser Flow tab, then stop.
7. **Short replies.** Report job id, parts, and the final result in one or two lines. No raw JSON dumps.
