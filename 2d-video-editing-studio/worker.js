// 2D Video Editing Studio — AntiGem worker (v3.5.1).
// Google Flow asset generation uses the built-in DeepX engine (deepx-core.js): login check,
// Agent Mode / Standard mode choice, ≤24-per-part Agent queue and automatic Agent fallback.
import { configureDeepX, deepxExecute, deepxGenerate, loginCheck, jobs, snapshot, sleep, mcpListener } from './deepx-core.js';

const PLUGIN_ID = "2d-video-editing-studio";
const PLUGIN_VERSION = "3.5.1";
configureDeepX({ pluginId: PLUGIN_ID, version: PLUGIN_VERSION });

const STYLES = {
  documentary: {
    name: "Vox Documentary Explainer",
    recipes: ["stat_hero", "polaroid_pin", "arch_orb", "seesaw_compare", "light_cone", "selective_mono", "highlight_sweep"],
    palette: ["#F4ECE1", "#E63946", "#FFB703", "#1D3557", "#111111"],
    fonts: { headline: "Khand-Bold / PlayfairDisplay-Bold", body: "NotoSerifDevanagari / Lora-Bold", mono: "SpaceMono-Bold" }
  },
  box: {
    name: "Box / Bento Data Grid & Structured Cards",
    recipes: ["bento_card", "stat_hero", "split_compare", "progress_meter", "data_table"],
    palette: ["#101216", "#FF3B30", "#FFC400", "#1C2029", "#F7F8FA"],
    fonts: { headline: "Khand-Bold / Metropolis-Bold", body: "Mukta-Bold / Inter-Bold", mono: "SpaceMono-Bold" }
  },
  stickman: {
    name: "Stickman / Modern Storytelling Explainer",
    recipes: ["story_scene", "speech_bubble", "story_desk", "fork_in_road", "selective_color", "doodle_circle"],
    palette: ["#F8F6EF", "#FF6B35", "#1D3557", "#2B2D42", "#111111"],
    fonts: { headline: "Baloo2-ExtraBold / Kalam-Bold", body: "Kalam-Bold", mono: "SpaceMono-Bold" }
  },
  sticker: {
    name: "Pop-Art Vinyl Die-Cut Cutouts & Sticker Collage",
    recipes: ["diecut_hero", "duo_sticker", "trio_collage", "speech_sticker", "badge_pop"],
    palette: ["#F4F1EA", "#E63946", "#FFB703", "#06D6A0", "#111111"],
    fonts: { headline: "Classic tomato / Baloo2-ExtraBold", body: "Baloo2-Bold", mono: "SpaceMono-Bold" }
  },
  noir: {
    name: "Suspense Noir / Crime Documentary",
    recipes: ["redact_bar", "cctv_timestamp", "evidence_board", "case_file", "classified_seal"],
    palette: ["#0D0D0D", "#C1121F", "#FDF0D5", "#669BBC", "#222222"],
    fonts: { headline: "YatraOne-Regular / TheGodfather", body: "NotoSerifDevanagari / PlayfairDisplay-Bold", mono: "SpaceMono-Bold" }
  },
  arcade: {
    name: "Retro 8-Bit Arcade",
    recipes: ["rpg_dialogue", "hp_bar", "coin_counter", "pixel_stage"],
    palette: ["#1A1A2E", "#E94560", "#F8B500", "#00B4D8", "#0F3460"],
    fonts: { headline: "SpaceMono-Bold", body: "SpaceMono-Bold", mono: "SpaceMono-Bold" }
  },
  doodle: {
    name: "Hand-Drawn Doodle & Sketchbook",
    recipes: ["doodle_circle", "notebook_sketch", "marker_underline", "sticky_note"],
    palette: ["#FAF7EE", "#2B2D42", "#E63946", "#457B9D", "#333333"],
    fonts: { headline: "Kalam-Bold / Aakriti Bold", body: "Kalam-Bold", mono: "SpaceMono-Bold" }
  }
};


// ============================================================================
// studio_generate_assets: ELEMENTS.tsv -> Google Flow (DeepX engine) -> elements/raw/<name>.<ext>
// ============================================================================
const IMG_EXT = ['png', 'jpg', 'jpeg', 'webp'];
const trimSlash = p => String(p || '').trim().replace(/\/+$/, '');

function parseTsv(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const head = lines[0].split('\t').map(h => h.trim());
  return lines.slice(1).map(l => { const cells = l.split('\t'); const o = {}; head.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); }); return o; });
}

async function bigFile(path) { try { const st = await chrome.antigem.stat({ path }); return st.isFile !== false && st.size > 1024 ? st.path : null; } catch { return null; } }
async function donePath(dir, name) {
  const cut = await bigFile(`${dir}/elements/cut/${name}.png`);
  if (cut) return cut;
  for (const e of IMG_EXT) { const p = await bigFile(`${dir}/elements/raw/${name}.${e}`); if (p) return p; }
  return null;
}
async function removeRaw(dir, name) {
  // AntiGem has no delete API: overwrite stale raw files with an empty marker so the asset is regenerated
  for (const e of IMG_EXT) { const p = `${dir}/elements/raw/${name}.${e}`; if (await bigFile(p)) await chrome.antigem.writeFile({ path: p, data: '' }).catch(() => {}); }
}

function studioAskMode(pendingCount, groups) {
  return {
    action_required: 'ASK_GENERATION_MODE', generated: false, pending_assets: pendingCount,
    question: `Generate the ${pendingCount} visual asset(s) with Google Flow Agent Mode, or Standard mode (without Agent)?`,
    options: [
      { value: 'agent', label: 'With Agent Mode', description: `All prompts pasted into Google Flow Agent in parts of ≤24 back-to-back (${Math.ceil(pendingCount / 24)} part(s)); auto-approved; fastest for big asset lists.` },
      { value: 'standard', label: 'Without Agent Mode', description: 'Exact per-asset generation (model, ratio, references, one file per asset); auto-switches to Agent Mode if Google shows an unusual-activity / extension error.' }
    ],
    groups,
    agent_instruction: 'This is the LAST question of the production. Ask it with your multiple-choice question tool, then call studio_generate_assets again with the same project_dir plus generation_mode. Everything after this runs on autopilot.'
  };
}

async function studioGenerateAssets(args) {
  const dir = trimSlash(args.project_dir);
  if (!dir) throw new Error('project_dir is required (the video project folder containing ELEMENTS.tsv).');
  const tsvPath = `${dir}/${args.elements || 'ELEMENTS.tsv'}`;
  let text;
  try { text = await chrome.antigem.readFile({ path: tsvPath }); }
  catch { throw new Error(`Missing ${tsvPath}. Run \`python studio.py prompts\` in the project first.`); }
  let rows = parseTsv(text).filter(r => r.kind !== 'video').map(r => ({
    name: String(r.name || r.id || '').trim(), prompt: String(r.prompt || '').trim(), kind: r.kind || '',
    aspect: r.aspect_ratio || (r.kind === 'bg' ? '16:9' : '1:1'), ref: String(r.ref || '').trim()
  })).filter(r => r.name && r.prompt);
  const regen = new Set(args.regen || []);
  if (args.only?.length) rows = rows.filter(r => args.only.includes(r.name));
  for (const n of regen) await removeRaw(dir, n);

  const pending = [], twins = [], doneAlready = [];
  const leaderByKey = new Map();
  for (const r of rows) {
    if (!regen.has(r.name) && await donePath(dir, r.name)) { doneAlready.push(r.name); continue; }
    const key = `${r.aspect}|${r.prompt}`;
    if (leaderByKey.has(key)) { twins.push({ name: r.name, of: leaderByKey.get(key) }); continue; }
    leaderByKey.set(key, r.name); pending.push(r);
  }
  if (!pending.length && !twins.length) return { all_done: true, generated: false, total: rows.length, message: `All ${rows.length} assets already exist in elements/ — zero Google Flow calls. Continue with \`python studio.py key\`.` };

  const login = await loginCheck();
  if (!login.logged_in) return login;

  const mode = ['agent', 'standard'].includes(String(args.generation_mode || '').toLowerCase()) ? String(args.generation_mode).toLowerCase()
    : /^(with[_ -]?agent|agent[_ -]?mode)$/i.test(args.generation_mode || '') ? 'agent' : /^(without[_ -]?agent|no[_ -]?agent)$/i.test(args.generation_mode || '') ? 'standard' : null;
  const byAspect = {}; pending.forEach(r => { byAspect[r.aspect] = (byAspect[r.aspect] || 0) + 1; });
  if (!mode) return studioAskMode(pending.length, byAspect);

  const job = {
    job_id: crypto.randomUUID().slice(0, 8), type: 'workflow', kind: 'studio_assets', mode, status: 'running',
    stage: `generating ${pending.length} asset(s) in ${mode === 'agent' ? 'Agent Mode' : 'Standard mode'}`,
    project_dir: dir, total: pending.length + twins.length, already_done: doneAlready.length, saved: [], missing: [], child_job_ids: [],
    request: args, abort: new AbortController()
  };
  jobs.set(job.job_id, job);
  job.completion = (async () => {
    const save = async (row, file) => {
      if (!file?.path) return false;
      const ext = (file.path.split('.').pop() || 'jpg').toLowerCase();
      const dst = `${dir}/elements/raw/${row.name}.${IMG_EXT.includes(ext) ? ext : 'jpg'}`;
      await chrome.antigem.copyFile({ from: file.path, to: dst });
      job.saved.push(row.name);
      return dst;
    };
    // Phase 1: assets whose reference is ready (or none); phase 2: assets that reference a phase-1 asset
    const phase1 = [], phase2 = [];
    for (const r of pending) (!r.ref || mode === 'agent' || await donePath(dir, r.ref) || !pending.some(p => p.name === r.ref) ? phase1 : phase2).push(r);
    for (const phase of [phase1, phase2]) {
      if (!phase.length) continue;
      const groups = new Map();
      for (const r of phase) {
        const refPath = mode === 'standard' && r.ref ? await donePath(dir, r.ref) : null;
        const key = `${r.aspect}|${refPath || ''}`;
        if (!groups.has(key)) groups.set(key, { aspect: r.aspect, refPath, rows: [] });
        groups.get(key).rows.push(r);
      }
      for (const g of groups.values()) {
        job.abort.signal.throwIfAborted();
        job.stage = `${mode === 'agent' ? 'Agent Mode' : 'Standard mode'}: ${g.rows.length} asset(s) at ${g.aspect}`;
        const res = await deepxGenerate({
          prompts: g.rows.map(r => r.prompt), generation_mode: mode, media_type: 'image', aspect_ratio: g.aspect,
          image_model: args.model || 'Nano Banana 2.1', references: g.refPath ? [g.refPath] : [], download: true,
          expand_bulk: false, skip_login_check: true, wait_seconds: 0, style_lock: args.style_lock
        });
        const child = jobs.get(res.job_id);
        if (!child) throw new Error(res.error || 'Generation could not start');
        job.child_job_ids.push(child.job_id);
        const onAbort = () => { child.abort.abort(); };
        job.abort.signal.addEventListener('abort', onAbort, { once: true });
        await child.completion;
        job.abort.signal.removeEventListener('abort', onAbort);
        const perItem = child.mode === 'agent' ? (child.items || []) : (child.scenes || []);
        for (let i = 0; i < g.rows.length; i++) {
          const ok = await save(g.rows[i], perItem[i]?.files?.[0]).catch(() => false);
          if (!ok) job.missing.push(g.rows[i].name);
        }
        if (child.fallback_job_id) job.switched_to_agent = true;
      }
    }
    for (const t of twins) {
      const src = await donePath(dir, t.of);
      if (src) { const ext = src.split('.').pop(); await chrome.antigem.copyFile({ from: src, to: `${dir}/elements/raw/${t.name}.${ext}` }); job.saved.push(t.name); }
      else job.missing.push(t.name);
    }
    job.status = job.missing.length && !job.saved.length ? 'failed' : 'done';
    job.stage = `saved ${job.saved.length}/${job.total} asset(s) to elements/raw/${job.switched_to_agent ? ' (standard mode was blocked → switched to Agent Mode automatically)' : ''}${job.missing.length ? `; ${job.missing.length} not matched — run studio_generate_assets again (only missing ones are generated)` : ''}`;
    job.next_step = job.missing.length ? 'Call studio_generate_assets again with the same project_dir and generation_mode to fill the missing assets, then run `python studio.py key`.' : 'Run `python studio.py key` and continue the autopilot (check → mix → render).';
  })().catch(e => { job.status = job.abort.signal.aborted ? 'cancelled' : 'failed'; job.stage = job.status; job.error = e.message; });
  await Promise.race([job.completion, sleep(Math.max(0, Math.min(40, args.wait_seconds ?? 20)) * 1000)]);
  return { ...snapshot(job), poll: `deepx_job_status {"job_id":"${job.job_id}","wait_seconds":30}` };
}

async function execute(tool, args = {}) {
  if (tool === 'studio_status') {
    const login = await loginCheck({ force: true }).catch(e => ({ logged_in: false, error: e.message }));
    return {
      id: PLUGIN_ID, name: '2D Video Editing Studio', version: PLUGIN_VERSION, status: 'ready',
      flow_connected: !!login.logged_in, flow_account: login.account || null,
      ...(login.logged_in ? {} : { action_required: 'LOGIN_REQUIRED', message: login.message }),
      supported_styles: Object.keys(STYLES),
      asset_engine: 'DeepX Google Flow engine (built in): Agent Mode or Standard mode, auto Agent fallback on unusual-activity blocks'
    };
  }
  if (tool === 'studio_generate_assets') return studioGenerateAssets(args);
  if (tool === "studio_list_styles") {
    if (args.style && STYLES[args.style]) {
      return { style: args.style, details: STYLES[args.style] };
    }
    return { styles: STYLES };
  }

  if (tool === "studio_plan_project") {
    const topic = args.topic || "Untitled Video";
    const style = args.style || "documentary";
    const aspect = args.aspect || "9:16";
    const lines = args.lines || ["Hook: The untold secret.", "Development: How the system works.", "Climax: The truth revealed."];

    const beats = lines.map((text, idx) => ({
      index: idx + 1,
      line: text,
      suggested_recipe: (STYLES[style] && STYLES[style].recipes[idx % STYLES[style].recipes.length]) || "hero",
      layout: idx % 2 === 0 ? "hero" : "duo"
    }));

    return {
      project: topic.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      style,
      aspect,
      line_count: lines.length,
      visual_beats: beats,
      next_step: "Run python studio.py voice followed by python studio.py plan on device."
    };
  }

  if (tool === "studio_render_command") {
    const projectDir = args.project_dir || "projects/my_video";
    const isPreview = Boolean(args.preview_only);

    return {
      project_dir: projectDir,
      fast_command: `python studio.py render --fast --project "${projectDir}"`,
      turbo_command: `python studio.py render --turbo --project "${projectDir}"`,
      full_hd_command: `python studio.py render --1080p --project "${projectDir}"`,
      preview_command: `python studio.py preview --project "${projectDir}"`,
      master_command: `python studio.py render --fast --project "${projectDir}"`,
      recommended: isPreview
        ? `python studio.py preview --project "${projectDir}"`
        : `python studio.py render --fast --project "${projectDir}"`
    };
  }


  return deepxExecute(tool, args);
}

chrome.runtime.onMessage.addListener(mcpListener(execute));
