// DeepX Google Flow Agent Mode engine for AntiGem.
// Ported from the DeepX Chrome extension: agent pill toggle, 100% autopilot settings,
// persistent custom instructions, credit auto-approval, question auto-resolver and the
// 24-item back-to-back batch queue. Page DOM work lives in deepx-agent-page.js (MAIN world).

export const AGENT_MAX_PER_PART = 24;
export const AGENT_PAGE_VERSION = 6;
export const AGENT_DOWNLOAD_CONCURRENCY = 8;

/**
 * Universal Orderly Media Filename Formatter
 * Generates strict zero-padded chronological filenames (e.g. 01_scene_01.mp4, 02_scene_02.mp4, 001_... for >=100)
 * to guarantee 100% alphabetical and chronological ordering in video editing tools (Premiere, CapCut, DaVinci, 2D Studio).
 */
export function formatOrderlyFilename(promptText, index = 0, total = 0, isImage = false, customExt = null) {
  const ext = customExt || (isImage ? 'png' : 'mp4');
  const padDigits = total >= 100 ? 3 : 2;
  const numPrefix = String((index ?? 0) + 1).padStart(padDigits, '0');
  const text = String(promptText || '').trim();
  const tagMatch = text.match(/#([a-zA-Z0-9_\-\.]+)/);
  let tag = tagMatch ? tagMatch[1] : '';
  tag = tag.replace(/^[0-9]+[_\-\.]*/, '');
  if (!tag) {
    const sceneMatch = text.match(/\b(?:scene|shot|sequence|take|image|photo|frame|दृश्य|सीन)[_\-\s]*(\d+)\b/iu);
    if (sceneMatch) tag = `scene_${String(sceneMatch[1]).padStart(padDigits, '0')}`;
    else tag = `scene_${numPrefix}`;
  }
  const cleanTag = tag.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'scene';
  return `${numPrefix}_${cleanTag}.${ext}`;
}

export const DEFAULT_MASTER_AGENT_INSTRUCTIONS =
`DEEPX MASTER AUTOPILOT & VISUAL CONSISTENCY MANDATE:

1. 100% AUTOPILOT MODE (NEVER ASK QUESTIONS):
- Execute all generations, storyboards, image batches and video requests IMMEDIATELY.
- Never pause to ask clarifying questions, never ask for credit confirmation, never present multiple-choice questions.
- When a request is split into parts ("Part 1 of 5"), generate every item of the current part right away; the next part follows automatically.

2. UNCOMPROMISING MULTI-SCENE & BATCH CONSISTENCY:
- All images, items and scenes in one collection or story keep 100% uniform visual consistency.
- Same background environment, canvas texture, color palette and rendering medium across the sequence.
- Zero style drift between items. Lock characters with their @handles: same face, hair, clothing and proportions, no morphing.
- Keep lighting physics (key light angle, shadow density, temperature) and camera framing unified.
- Follow the user's prompts faithfully: do not rewrite the story, skip items or merge items.`;

const BLOCK_RE = /unusual (?:activity|traffic|behaviou?r|request|usage)|suspicious (?:activity|traffic|request)|automated (?:queries|requests|traffic|software|access)|extensions? (?:is |are |may be |might be )?(?:interfering|blocking|not (?:allowed|supported))|unsupported (?:browser|extension)|disable (?:your |any )?(?:browser )?extensions?|verify (?:that )?(?:you(?:'|’)re|you are) (?:a )?human|not a robot|re-?captcha|captcha|couldn(?:'|’)t verify|PUBLIC_ERROR_UNUSUAL|UNUSUAL_ACTIVITY|PERMISSION_DENIED|HTTP 403|status 403|request (?:was )?blocked by google/i;
export const isBlockError = text => BLOCK_RE.test(String(text || ''));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clampPart = n => Math.max(1, Math.min(AGENT_MAX_PER_PART, Math.floor(Number(n) || AGENT_MAX_PER_PART)));

export const AGENT_IMAGE_MODELS = ['Nano Banana 2.1', 'Nano Banana Pro', 'Nano Banana 2 Lite', 'Imagen 3'];
export const AGENT_VIDEO_MODELS = ['Omni Flash 1.2', 'Omni 1.1 Flash', 'Veo 3.1 - Quality', 'Veo 3.1 - Fast', 'Veo 3.1 - Lite'];

export function agentImageModel(value) {
  const v = String(value || '').replace(/^🍌\s*/, '').trim().toLowerCase();
  if (!v || v.includes('2.1') || v === 'nano banana' || v === 'nano-banana-2' || v === 'imagen-3' || v === 'narwhal') return 'Nano Banana 2.1';
  if (v.includes('pro')) return 'Nano Banana Pro';
  if (v.includes('lite') || v === 'nano banana 2') return 'Nano Banana 2 Lite';
  if (v.includes('imagen')) return 'Imagen 3';
  return String(value).replace(/^🍌\s*/, '');
}
export function agentVideoModel(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v || v.includes('1.2') || v === 'omni-flash-1.2') return 'Omni Flash 1.2';
  if (v.includes('omni')) return 'Omni 1.1 Flash';
  if (v.includes('quality')) return 'Veo 3.1 - Quality';
  if (v.includes('fast')) return 'Veo 3.1 - Fast';
  if (v.includes('lite')) return 'Veo 3.1 - Lite';
  return String(value);
}

/** Split a free-text bulk request ("100 images of cars", "1 to 1000 numbers") into numbered items. */
export function expandBulkRequest(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const range = t.match(/^(?:(?:generate|create|make|produce)\s+)?(?:\d+\+?\s*(?:images?|videos?|items?|numbers?|prompts?|photos?|clips?)\s*(?:of\s+|from\s+)?)?(?:from\s+)?(\d+)\s*(?:to|-|–)\s*(\d+)\s*(.*)$/i);
  const count = t.match(/^(?:(?:generate|create|make|produce)\s+)?(\d+)\+?\s+(images?|videos?|items?|scenes?|photos?|pictures?|clips?|wallpapers?|stickers?)\b\s*(?:of|for|about|with|showing)?\s*(.*)$/i);
  if (range) {
    let a = +range[1], b = +range[2];
    if (a > b) [a, b] = [b, a];
    if (b - a + 1 < 2 || b - a + 1 > 5000) return null;
    const subject = (range[3] || '').replace(/^(?:numbered\s+)?(?:images?|videos?|items?|photos?)?\s*(?:of|for|about|with)?\s*/i, '').trim();
    return { type: 'range', start: a, end: b, subject: subject || 'number designs', total: b - a + 1 };
  }
  if (count && +count[1] > 1 && +count[1] <= 5000) {
    return { type: 'count', start: 1, end: +count[1], subject: (count[3] || '').trim() || count[2], total: +count[1], unit: count[2] };
  }
  return null;
}

/** Turn prompts into Agent Mode parts of at most 24 items each. */
export function buildAgentParts({ items = [], bulk = null, mediaType = 'image', aspectRatio = '16:9', imageModel, videoModel, duration, maxPerPart = AGENT_MAX_PER_PART, styleLock = '' }) {
  const per = clampPart(maxPerPart);
  const video = mediaType === 'video';
  const model = video ? agentVideoModel(videoModel) : agentImageModel(imageModel);
  const unit = video ? 'video' : 'image';
  const units = video ? 'videos' : 'images';
  const mandate = `RULES: Generate every item now in parallel, exactly one ${unit} per numbered item, in order. Do not ask questions, do not skip, merge or rewrite items. Keep 100% consistent style, lighting, palette and character identity (@handles) across all items${styleLock ? `. Style lock: ${styleLock}` : ''}.`;
  const spec = `using ${model} in ${aspectRatio} ratio${video && duration ? `, ${duration}s per clip` : ''}`;
  const parts = [];
  if (bulk) {
    const total = bulk.total, partsCount = Math.ceil(total / per);
    for (let cur = bulk.start, p = 1; cur <= bulk.end; cur += per, p++) {
      const end = Math.min(cur + per - 1, bulk.end), n = end - cur + 1;
      parts.push({
        part: p, total_parts: partsCount, start: cur - bulk.start + 1, end: end - bulk.start + 1, count: n, label: `${cur}–${end}`,
        prompt: `Generate all ${n} ${units} at once ${spec} (Part ${p} of ${partsCount}, items ${cur} to ${end} of ${bulk.start}–${bulk.end}) of ${bulk.subject}. Item k shows ${bulk.type === 'range' ? 'the number/entry k' : `variation k of ${bulk.subject}`} for k = ${cur} to ${end}, as one cohesive collection.\n\n${mandate}`
      });
    }
    return { parts, total, model };
  }
  const list = items.map(x => (typeof x === 'string' ? x : (x?.prompt || x?.text || '')).trim()).filter(Boolean);
  const total = list.length, partsCount = Math.ceil(total / per);
  for (let i = 0, p = 1; i < total; i += per, p++) {
    const slice = list.slice(i, i + per);
    const numbered = slice.map((s, k) => `[${unit[0].toUpperCase() + unit.slice(1)} ${i + k + 1}/${total}] ${s}`).join('\n\n');
    const head = total === 1
      ? `Generate 1 ${unit} ${spec}:`
      : `Generate all ${slice.length} ${units} at once ${spec} (Part ${p} of ${partsCount}, items ${i + 1} to ${i + slice.length} of ${total}). One dedicated ${unit} for each prompt below:`;
    parts.push({ part: p, total_parts: partsCount, start: i + 1, end: i + slice.length, count: slice.length, label: `${i + 1}–${i + slice.length}`, items: slice, prompt: `${head}\n\n${numbered}\n\n${mandate}` });
  }
  return { parts, total, model };
}

const wordSet = t => new Set(String(t || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2));
/** Best-effort mapping of new Flow media to the prompts that produced them (prompt/title word overlap, then order). */
export function assignMediaToItems(prompts, media, mediaType) {
  const assigned = prompts.map(() => []);
  const pool = media.filter(m => !mediaType || !m.type || m.type === mediaType);
  const iw = prompts.map(wordSet);
  const pairs = [];
  pool.forEach((m, mi) => {
    const mw = wordSet(`${m.prompt || ''} ${m.title || ''}`);
    if (!mw.size) return;
    iw.forEach((w, ii) => {
      let inter = 0; for (const x of mw) if (w.has(x)) inter++;
      const score = inter / Math.max(1, Math.min(w.size, mw.size));
      if (score >= 0.2) pairs.push({ mi, ii, score });
    });
  });
  pairs.sort((a, b) => b.score - a.score);
  const used = new Set();
  for (const { mi, ii } of pairs) { if (used.has(mi) || assigned[ii].length) continue; assigned[ii].push(pool[mi].mediaId); used.add(mi); }
  // Leftovers: fill still-empty items in creation order (Flow lists newest last after reversal)
  const left = pool.filter((m, mi) => !used.has(mi));
  const empty = assigned.map((a, i) => a.length ? -1 : i).filter(i => i >= 0);
  if (left.length && left.length === empty.length) { empty.forEach((ii, k) => { assigned[ii].push(left[k].mediaId); used.add(pool.indexOf(left[k])); }); }
  const unassigned = pool.filter((m, mi) => !used.has(mi)).map(m => m.mediaId);
  return { assigned, unassigned };
}

export function createDeepXAgent({ chrome, client, jobs, awaitJobs }) {
  const instructionsSynced = new Map(); // projectId -> instructions hash
  const watchers = new Map();           // tabId -> interval

  async function page(tabId, method, ...args) {
    const call = () => client.evaluate(tabId, (m, a, v) => {
      const s = window.__deepxAgent;
      if (!s || s.v !== v) return { __missing: true };
      return s[m](...a);
    }, [method, args, AGENT_PAGE_VERSION]);
    let res = await call();
    if (res && res.__missing) {
      await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['deepx-agent-page.js'] });
      res = await call();
    }
    return res;
  }

  async function canvasTab(projectId) {
    const tabId = await client.tab();
    const ui = await client.js(tabId, 's.ui()').catch(() => ({}));
    if (projectId && ui?.projectId !== projectId) await client.page(tabId, projectId);
    else if (!ui?.projectId) await client.project(tabId);
    return tabId;
  }

  async function tap(tabId, point) {
    if (point && point.found && !point.disabled && point.canTap !== false && chrome.antigem?.automation) {
      try { await chrome.antigem.automation({ tabId, tap: { fx: point.fx, fy: point.fy } }); return 'trusted_touch'; } catch (_) {}
    }
    const r = await page(tabId, 'clickSubmit');
    return r?.ok ? 'dom_click' : 'none';
  }

  // v1.2.4: verified instant paste (panel auto-close), then send with trusted tap -> DOM click -> Enter,
  // checking after each step whether Flow accepted it. Typical send now < 1 s instead of up to 10 s.
  async function submit(tabId, text) {
    let filled = await page(tabId, 'fillPrompt', text);
    if (!filled?.ok) {
      await page(tabId, 'closePanels').catch(() => {});
      filled = await page(tabId, 'fillPrompt', text);
    }
    if (!filled?.ok) {
      // Fall back to the AntiGem Flow helper's ProseMirror writer
      const alt = await client.js(tabId, `s.setPrompt(${JSON.stringify(text)})`).catch(() => null);
      if (!alt?.ok && !alt?.success) throw new Error(filled?.error || 'Could not paste the prompt into Google Flow Agent.');
    }
    const started = async ms => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        const b = await page(tabId, 'busy').catch(() => null);
        if (b && (b.isBusy || b.boxEmpty)) return true;
        await sleep(120);
      }
      return false;
    };
    let point = await page(tabId, 'submitPoint');
    let method = 'none';
    if (point?.found && !point.disabled) {
      method = await tap(tabId, point);
      if (await started(1800)) return { submitted: true, method, paste: filled?.method };
    }
    const c = await page(tabId, 'clickSubmit');
    if (c?.ok) { method = `${method}+dom_click`; if (await started(1500)) return { submitted: true, method, paste: filled?.method }; }
    await page(tabId, 'pressEnter');
    method += '+enter';
    if (await started(1500)) return { submitted: true, method, paste: filled?.method };
    // Last try: panel may have re-opened over the composer -> close, re-paste, tap again.
    await page(tabId, 'closePanels').catch(() => {});
    const again = await page(tabId, 'fillPrompt', text);
    point = await page(tabId, 'submitPoint');
    if (again?.ok && point?.found && !point.disabled) {
      method += '+retry_' + await tap(tabId, point);
      if (await started(2500)) return { submitted: true, method, paste: again.method };
    }
    throw new Error(point?.error || 'Google Flow Agent did not accept the prompt (submit had no effect).');
  }

  /** Wait until no fresh media of this job is still rendering (or the cap expires). */
  async function settledFresh(tabId, projectId, known, capMs) {
    const end = Date.now() + capMs;
    let items = [];
    while (true) {
      items = (await client.contents(tabId, projectId).catch(() => [])) || [];
      const fresh = items.filter(m => !known.has(m.mediaId) && !m.trashed);
      if (!fresh.some(m => m.pending) || Date.now() > end) return fresh.filter(m => !m.pending);
      await sleep(1500);
    }
  }

  function startWatcher(tabId, keywords = '') {
    stopWatcher(tabId);
    let ticks = 0;
    const id = setInterval(async () => {
      if (++ticks > 1200) return stopWatcher(tabId); // 10 minutes safety cap
      try {
        await page(tabId, 'approve', keywords, false); // approvals only; typed replies stay with waitIdle
      } catch (_) {}
    }, 500);
    watchers.set(tabId, id);
  }
  function stopWatcher(tabId) {
    const id = watchers.get(tabId);
    if (id) clearInterval(id);
    watchers.delete(tabId);
  }

  async function waitIdle(tabId, job, timeoutMs, keywords) {
    const t0 = Date.now();
    for (let i = 0; i < 30; i++) { // phase 1: wait until Flow Agent starts working (<=15s)
      job?.abort?.signal.throwIfAborted();
      const r = await page(tabId, 'approve', keywords, true).catch(() => null);
      if (r?.needs_reply && r.reply) { await submit(tabId, r.reply).catch(() => {}); job?.approvals?.push({ type: 'auto_reply', question: r.question, reply: r.reply }); }
      else if (r?.approved) job?.approvals?.push({ type: r.type, label: r.label });
      const b = await page(tabId, 'busy').catch(() => null);
      if (b?.isBusy) break;
      await sleep(500);
    }
    let stable = 0;
    while (Date.now() - t0 < timeoutMs) { // phase 2: wait for Flow Agent to settle
      job?.abort?.signal.throwIfAborted();
      await sleep(1000);
      const r = await page(tabId, 'approve', keywords, true).catch(() => null);
      if (r?.needs_reply && r.reply) { await submit(tabId, r.reply).catch(() => {}); job?.approvals?.push({ type: 'auto_reply', question: r.question, reply: r.reply }); stable = 0; continue; }
      if (r?.approved) { job?.approvals?.push({ type: r.type, label: r.label }); stable = 0; continue; }
      const b = await page(tabId, 'busy').catch(() => null);
      if (b && !b.isBusy && (b.hasSubmit || b.boxEmpty)) { if (++stable >= 3) return true; }
      else stable = 0;
    }
    return false;
  }

  async function prepare(tabId, cfg = {}) {
    const steps = [];
    const on = await page(tabId, 'setAgent', true);
    steps.push({ step: 'agent_mode_on', ...on });
    if (!on?.active) throw new Error(on?.error || 'Could not switch Google Flow to Agent Mode. Open a project canvas and try again.');
    await sleep(300);
    const conf = await page(tabId, 'configure', {
      autopilot: cfg.autopilot !== false,
      aspectRatio: cfg.aspectRatio,
      quality: cfg.quality,
      agentVideoModel: cfg.mediaType === 'video' ? agentVideoModel(cfg.videoModel) : null,
      agentImageModel: cfg.mediaType === 'image' ? agentImageModel(cfg.imageModel) : null
    }).catch(e => ({ success: false, reason: e.message }));
    steps.push({ step: 'agent_settings', ...conf });
    if (cfg.syncInstructions !== false) {
      const text = cfg.customInstructions || DEFAULT_MASTER_AGENT_INSTRUCTIONS;
      const ui = await client.js(tabId, 's.ui()').catch(() => ({}));
      const key = `${ui?.projectId || 'none'}`;
      const hash = `${text.length}:${text.slice(0, 64)}`;
      if (instructionsSynced.get(key) !== hash || cfg.customInstructions) {
        const sync = await page(tabId, 'syncInstructions', { title: cfg.instructionsTitle || 'DeepX Master Autopilot Director', text }).catch(e => ({ success: false, reason: e.message }));
        if (sync?.success) instructionsSynced.set(key, hash);
        steps.push({ step: 'custom_instructions', ...sync });
      } else steps.push({ step: 'custom_instructions', success: true, cached: true });
    }
    return steps;
  }

  async function knownMedia(tabId) {
    try {
      const ui = await client.js(tabId, 's.ui()');
      if (!ui?.projectId) return { projectId: null, ids: [] };
      const items = await client.contents(tabId, ui.projectId);
      return { projectId: ui.projectId, ids: (items || []).map(m => m.mediaId), items: items || [] };
    } catch (_) { return { projectId: null, ids: [], items: [] }; }
  }

  /** Background Agent Mode job: prepare canvas, then paste each <=24-item part back-to-back. */
  function runAgentJob(opts) {
    const mediaType = opts.mediaType === 'video' ? 'video' : 'image';
    const plan = opts.parts ? { parts: opts.parts, total: opts.total } : buildAgentParts({ ...opts, mediaType });
    if (!plan.parts.length) throw new Error('Nothing to generate: give prompt, prompts or script_text.');
    const job = {
      job_id: crypto.randomUUID().slice(0, 8), type: 'agent_queue', kind: opts.kind || 'agent_mode', mode: 'agent', media_type: mediaType,
      status: 'queued', stage: 'queued', total_items: plan.total, total_parts: plan.parts.length, parts_done: 0,
      parts: plan.parts.map(p => ({ part: p.part, items: p.label, count: p.count, status: 'queued' })),
      approvals: [], setup: [], media_ids: [], files: [], child_job_ids: [], fallback_from: opts.fallbackFrom || null,
      note: opts.note || null, request: opts, abort: new AbortController()
    };
    jobs.set(job.job_id, job);
    const partTimeout = Math.max(60, Math.min(3600, opts.partTimeoutSec || (mediaType === 'video' ? 900 : 480))) * 1000;
    job.completion = client.exclusive(async () => {
      job.abort.signal.throwIfAborted();
      job.status = 'running'; job.stage = 'opening Google Flow canvas';
      const tabId = await canvasTab(opts.projectId);
      await client.begin(tabId);
      try {
        const before = await knownMedia(tabId);
        job.project_id = before.projectId;
        const known = new Set(before.ids), claimed = new Set(), downloads = [], byId = new Map();
        const totalItems = plan.total;
        job.items = [];
        // Assign one part's fresh media to its prompts and start parallel, ordered downloads (not awaited here).
        const queuePart = (part, media, rec) => {
          const prompts = part.items || Array.from({ length: part.count }, (_, k) => `item ${part.start + k}`);
          const { assigned, unassigned } = part.items ? assignMediaToItems(prompts, media, mediaType) : { assigned: prompts.map((_, k) => media[k] ? [media[k].mediaId] : []), unassigned: media.slice(prompts.length).map(m => m.mediaId) };
          const list = [];
          prompts.forEach((prompt, k) => {
            const index = part.start - 1 + k;
            const it = { index, prompt: String(prompt).slice(0, 160), media_ids: assigned[k], files: [] };
            job.items[index] = it;
            assigned[k].forEach((mid, n) => { claimed.add(mid); list.push({ id: mid, it, name: formatOrderlyFilename(it.prompt + (assigned[k].length > 1 ? `_${n + 1}` : ''), index, totalItems, mediaType === 'image'), type: mediaType }); });
          });
          unassigned.forEach((mid, n) => { claimed.add(mid); list.push({ id: mid, name: formatOrderlyFilename('extra_media', totalItems + (job.unassigned_media_ids || []).length + n, totalItems + 100, mediaType === 'image'), type: mediaType, extra: true }); });
          job.unassigned_media_ids = [...(job.unassigned_media_ids || []), ...unassigned];
          if (!list.length || opts.download === false) return;
          rec.download = 'downloading';
          downloads.push(client.files(tabId, list.map(x => ({ id: x.id, name: x.name, type: x.type })), opts.downloadConcurrency || AGENT_DOWNLOAD_CONCURRENCY).then(files => {
            files.forEach(f => { const x = list.find(y => y.id === f.media_id); byId.set(f.media_id, f); if (x?.it) x.it.files.push(f); });
            job.files.push(...files);
            if (files.errors?.length) job.download_errors = (job.download_errors || 0) + files.errors.length;
            rec.download = `done (${files.length}/${list.length})`;
          }).catch(e => { rec.download = 'failed: ' + e.message; }));
        };
        job.stage = 'switching to Agent Mode + 100% autopilot';
        job.setup = await prepare(tabId, { ...opts, mediaType });
        const keywords = String(opts.keywords || plan.parts[0]?.items?.[0] || '').slice(0, 120);
        if (opts.autopilot !== false) startWatcher(tabId, keywords);
        for (let i = 0; i < plan.parts.length; i++) {
          job.abort.signal.throwIfAborted();
          const part = plan.parts[i], rec = job.parts[i];
          job.stage = `Part ${part.part}/${plan.parts.length}: pasting items ${part.label}`;
          rec.status = 'submitting'; rec.submitted_at = new Date().toISOString();
          const sent = await submit(tabId, part.prompt);
          rec.method = sent.method;
          rec.status = 'generating';
          job.stage = `Part ${part.part}/${plan.parts.length}: Flow Agent generating items ${part.label}`;
          const idle = await waitIdle(tabId, job, partTimeout, keywords);
          rec.status = idle ? 'done' : 'timeout_continued';
          rec.finished_at = new Date().toISOString();
          job.parts_done = i + 1;
          // v1.2.4: collect this part's media now and download it in parallel while the next part generates.
          if (opts.download !== false && before.projectId) {
            const isLast = i + 1 === plan.parts.length;
            const fresh = await settledFresh(tabId, before.projectId, known, isLast ? 90000 : 4000);
            fresh.sort((a, b) => String(a.created || '').localeCompare(String(b.created || '')));
            const mine = fresh.filter(m => !claimed.has(m.mediaId) && (!m.type || m.type === mediaType) && !m.pending);
            if (mine.length) queuePart(part, mine, rec);
          }
          if (i + 1 < plan.parts.length) await sleep(opts.partGapMs ?? 1200);
        }
        await Promise.all(downloads);
        job.stage = 'collecting new media';
        const after = await knownMedia(tabId);
        const fresh = after.ids.filter(id => !known.has(id));
        job.media_ids = fresh;
        // Late media that appeared after its part was collected: download in parallel as extras (never lost).
        let late = after.items.filter(m => fresh.includes(m.mediaId) && !claimed.has(m.mediaId) && !m.trashed && (!m.type || m.type === mediaType));
        if (late.some(m => m.pending)) { const settled = await settledFresh(tabId, after.projectId || before.projectId, new Set([...known, ...claimed]), 60000); late = settled.filter(m => fresh.includes(m.mediaId) || !known.has(m.mediaId)); }
        late = late.filter(m => !m.pending).sort((a, b) => String(a.created || '').localeCompare(String(b.created || '')));
        if (late.length && opts.download !== false) {
          // First fill numbered slots that are still empty (same order), only the rest become extras.
          const empty = job.items.filter(it => it && !it.media_ids.length);
          const { assigned } = assignMediaToItems(empty.map(it => it.prompt), late, mediaType);
          const used = new Set(assigned.flat());
          const rest = late.filter(m => !used.has(m.mediaId));
          empty.forEach((it, k) => { if (!assigned[k].length && rest.length && !plan.parts[0]?.items) assigned[k].push(rest.shift().mediaId); });
          const list = [];
          empty.forEach((it, k) => assigned[k].forEach(mid => { claimed.add(mid); it.media_ids.push(mid); list.push({ id: mid, it, name: formatOrderlyFilename(it.prompt, it.index, totalItems, mediaType === 'image'), type: mediaType }); }));
          const base = totalItems + (job.unassigned_media_ids || []).length;
          const extras = late.filter(m => !claimed.has(m.mediaId));
          extras.forEach((m, n) => list.push({ id: m.mediaId, name: formatOrderlyFilename('extra_media', base + n, base + extras.length, mediaType === 'image'), type: mediaType }));
          job.unassigned_media_ids = [...(job.unassigned_media_ids || []), ...extras.map(m => m.mediaId)];
          const files = await client.files(tabId, list.map(x => ({ id: x.id, name: x.name, type: x.type })), opts.downloadConcurrency || AGENT_DOWNLOAD_CONCURRENCY);
          files.forEach(f => { const x = list.find(y => y.id === f.media_id); if (x?.it) x.it.files.push(f); });
          job.files.push(...files);
        }
        job.items = job.items.filter(Boolean);
        job.matched_items = job.items.filter(it => it.media_ids.length).length;
        job.files.sort((a, b) => String(a.filename || '').localeCompare(String(b.filename || '')));
        job.status = 'done';
        job.stage = `done: ${plan.parts.length} part(s), ${plan.total} item(s) sent to Flow Agent${fresh.length ? `, ${fresh.length} new media in project` : ''}`;
      } finally {
        stopWatcher(tabId);
        await client.end(tabId);
      }
    }).catch(e => {
      if (job.status !== 'cancelled') { job.status = job.abort.signal.aborted ? 'cancelled' : 'failed'; job.stage = job.status; job.error = e.message; }
    });
    return job;
  }

  return {
    page, canvasTab, prepare, submit, waitIdle, startWatcher, stopWatcher, runAgentJob,
    async status() { const tabId = await canvasTab(); return page(tabId, 'status'); },
    async toggle(active) { const tabId = await canvasTab(); return page(tabId, 'setAgent', active ?? null); },
    async configure(cfg) { const tabId = await canvasTab(); await page(tabId, 'setAgent', true); return page(tabId, 'configure', cfg); },
    async setInstructions(text, title) { const tabId = await canvasTab(); await page(tabId, 'setAgent', true); return page(tabId, 'syncInstructions', { text: text || DEFAULT_MASTER_AGENT_INSTRUCTIONS, title: title || 'DeepX Master Autopilot Director' }); },
    async openChat() { const tabId = await canvasTab(); return page(tabId, 'openFullChat'); },
    async searchAssets(query, opts = {}) {
      if (!String(query || '').trim()) throw new Error('query is required (a name, prompt text, or a description like "red sports car at sunset").');
      const tabId = await canvasTab(opts.projectId);
      const res = await page(tabId, 'searchAssets', String(query), { waitMs: opts.waitMs, limit: opts.limit });
      if (opts.clear) await page(tabId, 'clearSearch').catch(() => {});
      return { ...res, note: 'Exact matches = name/prompt text matches. Similar results = Flow semantic matches on the image/video content (color, subject, mood).' };
    },
    async approveAll(keywords) { const tabId = await canvasTab(); const r = await page(tabId, 'approve', keywords || '', true); if (r?.needs_reply && r.reply) { await submit(tabId, r.reply); return { ...r, replied: true }; } return r; },
    async blockMark(tabId) { return page(tabId, 'blockMark').catch(() => ({ texts: [] })); },
    async blockScan(tabId, mark) { return page(tabId, 'blockScan', mark || { texts: [] }).catch(() => ({ blocked: false, texts: [] })); },
    awaitJobs
  };
}
