// Frame-exact capture through headless Chrome. No npm packages (Node 22+). Run from the project folder.
//   node tools/capture.mjs check                         boot, list shots + captions, report errors
//   node tools/capture.mjs cues                          write data/cues.json (the sound cues, for tools/mix.py)
//   node tools/capture.mjs sheet review/all.jpg [step=0.5] [cols=9]   contact sheet, a frame every `step` s, time-stamped
//   node tools/capture.mjs frames review/full "1.2,8.4"  full-size JPEGs of those times
//   node tools/capture.mjs video renders/out.mp4 [start end] [--turbo|--fast|--draft|--1080p] [--fps 24] the film
//   node tools/capture.mjs preview                       serve the project and print a URL to watch it in a browser
// CHROME=/path/to/chrome overrides the browser.
// Mobile / Termux friendly: LMK protection, single-process, dev-shm bypass, periodic V8 GC flushes.
// High-Speed Engine: Pipelined double-buffering, dynamic canvas scaling, multi-threaded ffmpeg encoding.
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), flags = new Set(args.filter((a) => a.startsWith('--')));
const [mode, ...rest] = args.filter((a) => !a.startsWith('--'));

// Parse optional --fps argument or FPS env
let parsedFps = null;
const fpsIdx = args.findIndex((a) => a === '--fps');
if (fpsIdx !== -1 && args[fpsIdx + 1] && !isNaN(+args[fpsIdx + 1])) {
  parsedFps = +args[fpsIdx + 1];
}

// Hardcoded Mobile / Low-Memory Anti-LMK Protection Shield
const isAndroidTermux = Boolean(
  process.env.TERMUX_VERSION ||
  fs.existsSync('/data/data/com.termux') ||
  fs.existsSync('/data/user/0/com.termux') ||
  fs.existsSync('/system/build.prop') ||
  (process.env.CHROME && process.env.CHROME.includes('com.termux'))
);

const isTermux = isAndroidTermux || Boolean(
  process.env.IS_MOBILE === '1' ||
  os.arch() === 'arm' ||
  os.arch() === 'arm64' ||
  (typeof os.totalmem === 'function' && os.totalmem() <= 6 * 1024 * 1024 * 1024) ||
  flags.has('--mobile')
);

// Speed & Resolution Preset Config:
// --turbo:  720x1280 @ 24fps (Blazing fast, 4x-6x speedup, ideal for quick Shorts production)
// --fast:   720x1280 @ 24/30fps (Default on mobile, sharp HD, 3x-4x speedup)
// --draft:  540x960  @ 24fps (Instant test render, 8x-10x speedup)
// --1080p:  1080x1920 @ 30fps (Full master broadcast quality)
const isDraft = flags.has('--draft');
const isTurbo = flags.has('--turbo');
const is1080p = flags.has('--1080p') || flags.has('--full');
const isFast = flags.has('--fast') || (!isDraft && !isTurbo && !is1080p && isTermux);

let renderW = 1080, renderH = 1920, defaultFps = 30, qLevel = 0.92, x264Preset = 'veryfast', crf = '18';
if (isDraft) {
  renderW = 540; renderH = 960; defaultFps = 24; qLevel = 0.78; x264Preset = 'ultrafast'; crf = '28';
} else if (isTurbo) {
  renderW = 720; renderH = 1280; defaultFps = 24; qLevel = 0.82; x264Preset = 'ultrafast'; crf = '24';
} else if (isFast) {
  renderW = 720; renderH = 1280; defaultFps = isTermux ? 24 : 30; qLevel = 0.85; x264Preset = isTermux ? 'ultrafast' : 'veryfast'; crf = '22';
} else {
  // 1080p master
  renderW = 1080; renderH = 1920; defaultFps = isTermux ? 24 : 30; qLevel = isTermux ? 0.85 : 0.92; x264Preset = isTermux ? 'ultrafast' : 'veryfast'; crf = isTermux ? '22' : '18';
}

const FPS = +(parsedFps || process.env.FPS || defaultFps);
const renderScale = renderW / 1080;

const CHROME = [
  process.env.CHROME,
  '/data/user/0/com.termux/files/usr/bin/chromium-browser',
  '/data/data/com.termux/files/usr/bin/chromium-browser',
  '/data/user/0/com.termux/files/usr/bin/chromium',
  '/data/data/com.termux/files/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find((p) => p && fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

function serve(port = 0) {
  return new Promise((res) => {
    const srv = http.createServer((req, r) => {
      const u = decodeURIComponent(req.url.split('?')[0]), f = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(r);
    });
    srv.listen(port, '127.0.0.1', () => res(srv));
  });
}

async function openPage(port) {
  if (!CHROME) throw new Error('Chrome not found: install Google Chrome or set CHROME=/path/to/chrome');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-chrome-'));

  // Android Termux / Low-RAM Chrome flags to prevent LMK kills & /dev/shm exhaustion
  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${prof}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--window-size=${renderW},${renderH}`,
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-ipc-flooding-protection',
    '--disable-breakpad',
    '--disable-dev-shm-usage', // Mandatory: avoids /dev/shm starvation crash on Android & containers
    '--no-sandbox',            // Mandatory: avoids Termux user namespace permission failure
    '--disable-setuid-sandbox',
    '--renderer-process-limit=1',
    '--js-flags=--expose-gc --max-old-space-size=512',
    ...(isAndroidTermux ? ['--single-process'] : []),
    ...(isAndroidTermux || process.env.SOFTWARE_GL ? [
      '--use-angle=swiftshader',
      '--disable-gpu'
    ] : []),
    'about:blank'
  ];

  const chrome = spawn(CHROME, chromeArgs, { stdio: 'ignore' });
  let dbg;
  for (let i = 0; i < 200 && !dbg; i++) {
    try { dbg = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); }
    catch { await sleep(100); }
  }
  if (!dbg) throw new Error('Chrome did not start');

  // Dynamic query params: pass res & shadow settings for 3D WebGL engine
  const qRes = renderScale.toFixed(3);
  const fastQS = `&res=${qRes}&aa=0&shadow=1024&bokeh=0`;
  const draftQS = `&res=${qRes}&aa=0&shadow=512&bokeh=0&bloom=0`;
  const fullQS = renderScale < 1 ? `&res=${qRes}&shadow=1024` : '';
  let autoQS = isDraft ? draftQS : (isTurbo ? fastQS : (isFast ? fastQS : fullQS));
  if (isTermux && !isDraft && !isTurbo) autoQS = fastQS;
  const qs = process.env.QS !== undefined ? process.env.QS : autoQS;
  const targetUrl = `http://127.0.0.1:${port}/index.html?capture=1${qs}`;

  const r = await fetch(`http://127.0.0.1:${dbg}/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' });
  const target = await r.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0; const pend = new Map(), logs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      logs.push('ERROR ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  };

  ws.onerror = (err) => {
    console.error('Chrome DevTools WebSocket error:', err?.message || err);
  };

  ws.onclose = (code, reason) => {
    if (pend.size > 0) {
      for (const [, p] of pend.entries()) {
        p.rej(new Error(`WebSocket closed unexpectedly (${code}: ${reason || 'connection lost'}). Device memory limit reached. Try using --mobile or lower FPS.`));
      }
      pend.clear();
    }
  };

  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, { res, rej });
    try { ws.send(JSON.stringify({ id: i, method, params })); }
    catch (e) { pend.delete(i); rej(e); }
  });

  const ev = async (expr) => {
    const x = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (x.exceptionDetails) throw new Error(x.exceptionDetails.exception?.description || x.exceptionDetails.text);
    return x.result.value;
  };

  await send('Runtime.enable');
  for (let i = 0; ; i++) {
    const st = await ev('window.OP ? (OP.bootError ? "ERR:" + OP.bootError : OP.ready) : false').catch(() => false);
    if (st === true) break;
    if (typeof st === 'string') throw new Error('boot failed: ' + st + '\n' + logs.join('\n'));
    if (i > 1200) throw new Error('boot timeout\n' + logs.join('\n'));
    await sleep(100);
  }

  // Universal Canvas Scaling Engine: if resolution scaled, wrap 2D context affine transform seamlessly
  if (renderScale !== 1.0) {
    await ev(`(() => {
      const targetW = ${renderW}, targetH = ${renderH};
      const cv = document.getElementById('cv');
      if (!cv) return;
      const scale = targetW / 1080;
      const origDraw = OP.draw;
      const ctx = cv.getContext('2d');
      const origSetTransform = ctx.setTransform.bind(ctx);
      ctx.setTransform = function(a, b, c, d, e, f) {
        if (arguments.length === 6 && a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0) {
          return origSetTransform(scale, 0, 0, scale, 0, 0);
        }
        return origSetTransform.apply(ctx, arguments);
      };
      cv.width = targetW;
      cv.height = targetH;
      OP.frame = (t, q = ${qLevel}) => {
        origDraw(t);
        return cv.toDataURL('image/jpeg', q);
      };
    })()`);
  }

  const close = () => {
    try { ws.close(); } catch {}
    try { chrome.kill('SIGKILL'); } catch {}
    try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
  };
  return { ev, logs, close };
}

const jpg = (d) => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
const FRAME = (t, q, label) => `(() => { const d = OP.frame(${t}, ${q}); ${label ? `const cv = document.getElementById('cv'), c = cv.getContext('2d'); c.setTransform(1,0,0,1,0,0); c.fillStyle = '#000'; c.fillRect(0, 0, 250, 86); c.fillStyle = '#fff'; c.font = '700 60px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText('${(+t).toFixed(2)}', 14, 64); return cv.toDataURL('image/jpeg', ${q});` : 'return d;'} })()`;

const srv = await serve(mode === 'preview' ? 8765 : 0), port = srv.address().port;
if (mode === 'preview') {
  console.log(`open http://127.0.0.1:${port}/  (Ctrl+C to stop)`);
} else {
  const P = await openPage(port);
  try {
    const dur = await P.ev('OP.duration()');
    if (mode === 'check') {
      const presetLabel = isDraft ? 'draft 540p' : (isTurbo ? 'turbo 720p' : (isFast ? 'fast 720p' : '1080p full'));
      console.log(`duration ${dur.toFixed(2)} s [${presetLabel} @ ${FPS}fps] ${isTermux ? '(Mobile / Termux mode active)' : ''}`);
      const shots = await P.ev('OP.shots()');
      for (const s of shots) console.log(`${s.id.padEnd(5)} ${s.at.toFixed(2).padStart(6)} → ${s.end.toFixed(2).padStart(6)}  (${(s.end - s.at).toFixed(2)} s)  ${s.note}`);
      console.log('captions:'); for (const c of await P.ev('OP.captions()')) console.log(`  ${c.s.toFixed(2).padStart(6)}–${c.e.toFixed(2).padEnd(6)} ${c.text}`);
      let bad = 0;
      process.stdout.write(`verifying ${shots.length} shots: `);
      for (const s of shots) {
        try {
          await P.ev(`OP.draw(${s.at + 0.05})`);
          process.stdout.write('.');
        } catch (e) {
          bad++;
          console.log(`\nERROR at shot ${s.id} (${s.at.toFixed(2)}s): ${e.message.split('\n')[0]}`);
        }
      }
      process.stdout.write(' done\n');
      if (P.logs.length) console.log(P.logs.join('\n'));
      console.log(bad || P.logs.length ? 'CHECK FAILED' : 'CHECK OK');
    } else if (mode === 'cues') {
      const cues = await P.ev('OP.cues()');
      fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, 'data/cues.json'), JSON.stringify({ duration: dur, cues }, null, 1));
      console.log(`data/cues.json: ${cues.length} cues, ${dur.toFixed(2)} s`);
    } else if (mode === 'frames') {
      const dir = path.resolve(ROOT, rest[0] || 'review/frames'); fs.mkdirSync(dir, { recursive: true });
      for (const t of (rest[1] || '0').split(',').map(Number)) { fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.jpg`), jpg(await P.ev(FRAME(t, 0.92)))); }
      console.log(dir);
    } else if (mode === 'sheet') {
      const out = path.resolve(ROOT, rest[0] || 'review/all.jpg'), step = +(rest[1] || 0.5), cols = +(rest[2] || 9);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-sheet-')); let n = 0;
      for (let t = step / 2; t < dur; t += step) {
        fs.writeFileSync(path.join(tmp, `f${String(n++).padStart(4, '0')}.jpg`), jpg(await P.ev(FRAME(t, 0.8, true))));
        if (n % 20 === 0) { await P.ev('if (window.gc) window.gc();').catch(() => {}); await sleep(10); }
      }
      const rows = Math.ceil(n / cols); fs.mkdirSync(path.dirname(out), { recursive: true });
      const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, 'f%04d.jpg'), '-vf', `scale=216:384,tile=${cols}x${rows}:padding=4:color=black`, '-frames:v', '1', '-q:v', '3', out]);
      fs.rmSync(tmp, { recursive: true, force: true });
      if (r.status) throw new Error('ffmpeg: ' + r.stderr); console.log(`${out} (${n} frames, every ${step} s)`);
    } else if (mode === 'video') {
      const out = path.resolve(ROOT, rest[0] || 'renders/video.mp4'); fs.mkdirSync(path.dirname(out), { recursive: true });
      const mix = path.join(ROOT, 'data/mix.wav'), hasMix = fs.existsSync(mix), a0 = rest[1] ? +rest[1] : 0, a1 = rest[2] ? Math.min(+rest[2], dur) : dur, n = Math.round((a1 - a0) * FPS);
      
      const threadCount = String(Math.min(os.cpus().length || 4, 8));
      const shouldUpscale = flags.has('--upscale');
      const videoFilter = shouldUpscale ? ['-vf', 'scale=1080:1920:flags=bicubic'] : [];
      
      const ffArgs = [
        '-v', 'error', '-y',
        '-f', 'image2pipe',
        '-framerate', String(FPS),
        '-i', '-',
        ...(hasMix ? ['-ss', String(a0), '-t', String(a1 - a0), '-i', mix] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']),
        '-map', '0:v', '-map', '1:a',
        ...videoFilter,
        '-c:v', 'libx264',
        '-preset', x264Preset,
        '-crf', crf,
        '-pix_fmt', 'yuv420p',
        '-threads', threadCount,
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        out
      ];

      const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
      const t0 = Date.now();
      const presetLabel = isDraft ? 'draft 540p' : (isTurbo ? 'turbo 720p' : (isFast ? 'fast 720p' : '1080p full'));
      console.log(`[High-Speed Render] ${presetLabel} (${renderW}x${renderH} @ ${FPS}fps) | ${n} frames | encoder: ${x264Preset} (crf ${crf})`);

      // Pipelined Double-Buffering: browser renders frame i+1 in parallel while Node/FFmpeg process frame i
      let nextPromise = n > 0 ? P.ev(FRAME(a0, qLevel)) : null;
      let lastReport = Date.now();

      for (let i = 0; i < n; i++) {
        const curRes = await nextPromise;
        if (i + 1 < n) {
          const nextTime = a0 + (i + 1) / FPS;
          nextPromise = P.ev(FRAME(nextTime, qLevel));
        }

        const b = jpg(curRes);
        if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r));
        
        // Android LMK Protection: periodically flush V8 garbage collection & yield event loop
        if (i % 25 === 0) {
          await P.ev('if (window.gc) window.gc();').catch(() => {});
          await sleep(isTermux ? 15 : 2);
        }

        const now = Date.now();
        if (now - lastReport >= 500 || i === n - 1) {
          lastReport = now;
          const elapsedSec = (now - t0) / 1000;
          const curFps = elapsedSec > 0 ? ((i + 1) / elapsedSec).toFixed(1) : '0.0';
          const remFrames = n - (i + 1);
          const etaSec = +curFps > 0 ? (remFrames / +curFps).toFixed(0) : '?';
          process.stdout.write(`\r  → ${i + 1}/${n} frames (${Math.round(((i + 1) / n) * 100)}%) | ${curFps} fps | ETA: ${etaSec}s   `);
        }
      }
      ff.stdin.end(); await new Promise((r) => ff.on('close', r));
      const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
      const avgFps = totalSec > 0 ? (n / +totalSec).toFixed(1) : '0';
      console.log(`\n✔ Render Complete: ${out}\n  • Total frames: ${n} (${dur.toFixed(1)}s film)\n  • Render time: ${totalSec}s (avg ${avgFps} fps)\n  • Audio: ${hasMix ? 'data/mix.wav' : 'SILENT (no data/mix.wav)'}`);
    } else console.log('modes: check · cues · sheet · frames · video · preview\nflags: --turbo (720p 24fps) · --fast (720p) · --draft (540p) · --1080p (full master) · --fps <n>');
  } finally {
    P.close();
    try { srv.closeAllConnections?.(); } catch {}
    srv.close();
    process.exit(0);
  }
}
