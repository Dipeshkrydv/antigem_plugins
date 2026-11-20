// DeepX Agent Mode page helper (MAIN world). Ported from the DeepX Chrome extension
// (service-worker.js agent functions + content-script-isolated.js autopilot watcher).
// Injected lazily by deepx-agent.js through chrome.scripting.executeScript({files}).
(function () {
  var VERSION = 3;
  if (window.__deepxAgent && window.__deepxAgent.v === VERSION) return;

  var BLOCK_RE = /unusual (?:activity|traffic|behaviou?r|request|usage)|suspicious (?:activity|traffic|request)|automated (?:queries|requests|traffic|software|access)|(?:browser )?extensions? (?:is|are|may be|might be)? ?(?:interfering|blocking|not (?:allowed|supported))|unsupported (?:browser|extension)|disable (?:your |any )?(?:browser )?extensions?|verify (?:that )?(?:you(?:'|’)re|you are) (?:a )?human|not a robot|re-?captcha|captcha (?:failed|required|verification)|couldn(?:'|’)t verify|PUBLIC_ERROR_UNUSUAL|UNUSUAL_ACTIVITY|PERMISSION_DENIED|request (?:was )?blocked by google/i;
  var NOTICE_SEL = 'mat-snack-bar-container, simple-snack-bar, .mdc-snackbar, .mat-mdc-snack-bar-container, [role="alert"], [role="status"], flow-toast, .toast, .error-message, .error, flow-grid-tile-container, flow-tile-container, [class*="error"], [class*="failed"]';

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function norm(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
  function shown(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) !== 0;
  }
  function isDisabled(el) { return !el || !!el.disabled || el.getAttribute('aria-disabled') === 'true'; }
  function mdcClick(el) {
    if (!el) return false;
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      if (typeof el.focus === 'function') el.focus();
      el.click();
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    } catch (e) { try { el.click(); } catch (_) {} }
    return true;
  }
  function tapPoint(el) {
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); } catch (e) {}
    var r = el.getBoundingClientRect();
    var v = window.visualViewport;
    var vw = v ? v.width : innerWidth, vh = v ? v.height : innerHeight;
    var ox = v ? v.offsetLeft : 0, oy = v ? v.offsetTop : 0;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var hit = document.elementFromPoint(cx, cy);
    return { fx: (cx - ox) / vw, fy: (cy - oy) / vh, canTap: !!hit && (hit === el || el.contains(hit)) };
  }

  // ---------- Agent pill ----------
  function agentPill() {
    var direct = document.querySelector('button.agent-mode-chip, button.agent-chip');
    if (direct && shown(direct)) return direct;
    var list = document.querySelectorAll('button[aria-pressed], flow-prompt-box button, button');
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!shown(b)) continue;
      var txt = norm(b.innerText || b.textContent);
      var aria = norm(b.getAttribute('aria-label'));
      if (/(^|\s)agent\s*$/i.test(txt) || /^agent( mode)?$/i.test(aria) || String(b.className || '').indexOf('agent-mode-chip') >= 0) return b;
    }
    return null;
  }
  function pillActive(p) {
    if (!p) return false;
    var cls = String(p.className || '');
    var sel = p.getAttribute('aria-pressed') || p.getAttribute('aria-selected');
    return sel === 'true' || cls.indexOf('agent-mode-chip-checked') >= 0 || /(^|\s)(active|selected)(\s|$)/.test(cls) || cls.indexOf('mat-mdc-tab-active') >= 0;
  }
  function status() {
    var p = agentPill();
    return {
      found: !!p,
      active: pillActive(p),
      label: p ? norm(p.innerText || p.getAttribute('aria-label') || 'Agent') : null,
      instructions_button: !!instructionsButton(),
      prompt_box: !!promptBox(),
      busy: busy().isBusy,
      url: location.href
    };
  }
  async function setAgent(desired) {
    var p = agentPill();
    if (!p) return { success: false, found: false, error: 'Google Flow Agent pill not found on this canvas. Open a project canvas first.' };
    var before = pillActive(p);
    var want = desired == null ? !before : !!desired;
    if (before !== want) {
      mdcClick(p);
      for (var i = 0; i < 25 && pillActive(agentPill()) !== want; i++) await sleep(60);
    }
    var now = pillActive(agentPill());
    return { success: now === want, found: true, active: now, changed: before !== now };
  }

  // ---------- Agent settings (Autopilot / models / ratio / quality) ----------
  function modelMatch(uiText, modelStr) {
    if (!uiText || !modelStr) return false;
    var txt = String(uiText).toLowerCase().replace(/[^\w\s\.]/g, ' ');
    var tm = String(modelStr).toLowerCase().replace(/[^\w\s\.]/g, ' ');
    if (tm.indexOf('1.2') >= 0) return txt.indexOf('1.2') >= 0;
    if (tm.indexOf('omni') >= 0) return (txt.indexOf('omni') >= 0 || txt.indexOf('1.1') >= 0) && txt.indexOf('1.2') < 0;
    if (tm.indexOf('quality') >= 0) return txt.indexOf('quality') >= 0;
    if (tm.indexOf('lite') >= 0 && tm.indexOf('banana') < 0) return txt.indexOf('lite') >= 0 && txt.indexOf('banana') < 0;
    if (tm.indexOf('fast') >= 0) return txt.indexOf('fast') >= 0;
    if (tm.indexOf('2.1') >= 0) return txt.indexOf('2.1') >= 0;
    if (tm.indexOf('pro') >= 0) return txt.indexOf('pro') >= 0;
    if (tm.indexOf('banana') >= 0 && (tm.indexOf('2') >= 0 || tm.indexOf('lite') >= 0)) return txt.indexOf('banana 2') >= 0 || txt.indexOf('lite') >= 0;
    if (tm.indexOf('imagen') >= 0) return txt.indexOf('imagen') >= 0;
    return tm.split(/\s+/).filter(function (w) { return w.length > 2; }).some(function (w) { return txt.indexOf(w) >= 0; });
  }
  function settingsPanel() { return document.querySelector("flow-agent-panel, flow-agent-settings, .agent-panel-animation-container, [class*='agent-settings-panel']"); }
  async function pickModel(panel, selector, model, applied) {
    var picker = panel.querySelector(selector);
    if (!picker || !model) return;
    if (modelMatch(norm(picker.innerText), model)) { applied.push('model ok: ' + model); return; }
    mdcClick(picker);
    await sleep(220);
    var opts = Array.prototype.slice.call(document.querySelectorAll(".flow-model-picker-panel flow-menu-item, .mat-mdc-menu-panel flow-menu-item, flow-menu-item.model-select-option, [role='menuitem'], .mat-mdc-menu-item, flow-menu-item"));
    var target = opts.find(function (m) { return modelMatch(m.innerText, model); });
    if (target) { mdcClick(target.querySelector('button') || target); applied.push('model set: ' + model); await sleep(140); }
    else { var bd = document.querySelector('.cdk-overlay-backdrop'); if (bd) bd.click(); applied.push('model not offered: ' + model); }
  }
  async function configure(cfg) {
    cfg = cfg || {};
    var applied = [];
    var panel = settingsPanel();
    if (!panel) {
      var tune = Array.prototype.slice.call(document.querySelectorAll('flow-prompt-box button, button.agent-action-button, button')).find(function (b) {
        var cls = String(b.className || ''), aria = b.getAttribute('aria-label') || '';
        return (cls.indexOf('agent-action-button') >= 0 || /settings/i.test(aria)) && /tune/.test(b.innerText || b.innerHTML || '');
      });
      if (tune) mdcClick(tune);
      for (var i = 0; i < 30 && !panel; i++) { await sleep(50); panel = settingsPanel(); }
    }
    if (!panel) return { success: false, reason: 'Agent settings panel could not be opened (Agent Mode may be off).' };

    if (cfg.autopilot !== false) {
      var never = Array.prototype.slice.call(panel.querySelectorAll('mat-radio-button, [role="radio"], label')).find(function (r) { return /\bnever\b/i.test(r.innerText || ''); });
      if (never) {
        var input = never.querySelector && never.querySelector("input[type='radio']");
        if (input && !input.checked) { mdcClick(input); input.dispatchEvent(new Event('change', { bubbles: true })); }
        else if (!input && never.getAttribute('aria-checked') !== 'true') mdcClick(never);
        applied.push('confirm before generating: Never');
        await sleep(90);
      }
    }
    if (cfg.aspectRatio) {
      var clean = String(cfg.aspectRatio).replace('_', ':');
      var icon = 'crop_' + clean.replace(':', '_');
      var ar = Array.prototype.slice.call(panel.querySelectorAll("button[role='radio'], mat-button-toggle button")).find(function (b) {
        var t = norm(b.innerText), h = b.innerHTML || '';
        return t.indexOf(clean) >= 0 || h.indexOf(icon) >= 0 || (clean === '1:1' && h.indexOf('crop_square') >= 0);
      });
      if (ar && ar.getAttribute('aria-checked') !== 'true') { mdcClick(ar); applied.push('aspect ' + clean); await sleep(70); }
    }
    if (cfg.quality) {
      var q = String(cfg.quality).toLowerCase();
      var want = /1080|2k|4k|high/.test(q) ? /^(high|1080p?|2k|4k)$/ : /720|med|standard/.test(q) ? /^(medium|720p?)$/ : /low|360/.test(q) ? /^(low|360p?)$/ : null;
      if (want) {
        var qb = Array.prototype.slice.call(panel.querySelectorAll("button, mat-button-toggle, [role='radio']")).find(function (b) { return want.test(norm(b.innerText).toLowerCase()); });
        if (qb && qb.getAttribute('aria-checked') !== 'true' && qb.getAttribute('aria-pressed') !== 'true') { mdcClick(qb); applied.push('quality ' + cfg.quality); await sleep(70); }
      }
    }
    await pickModel(panel, "button.video-model-picker-button, button[aria-label='Video generation default model']", cfg.agentVideoModel, applied);
    await pickModel(panel, "button.image-model-picker-button, button[aria-label='Image generation default model']", cfg.agentImageModel, applied);

    var save = panel.querySelector('button.settings-save-button') || Array.prototype.slice.call(panel.querySelectorAll('button')).find(function (b) { return /^save$/i.test(norm(b.innerText)); });
    if (save && !isDisabled(save)) { mdcClick(save); applied.push('saved'); await sleep(140); }
    var back = Array.prototype.slice.call(panel.querySelectorAll('button')).find(function (b) {
      var ic = norm((b.querySelector('mat-icon') || {}).textContent).toLowerCase(), aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return /arrow_back|chevron_left|close/.test(ic) || /back|close/.test(aria);
    });
    if (back) mdcClick(back);
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    await sleep(100);
    return { success: true, applied: applied };
  }

  // ---------- Custom instructions (article_spark panel) ----------
  function instructionsButton() {
    return Array.prototype.slice.call(document.querySelectorAll('button')).find(function (b) {
      return (String(b.className || '').indexOf('agent-action-button') >= 0 && (b.innerText || '').indexOf('article_spark') >= 0) || /^agent instructions$/i.test(b.getAttribute('aria-label') || '');
    }) || null;
  }
  function setValue(el, val) {
    if (!el) return;
    var proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    var d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(el, val); else el.value = val;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function syncInstructions(data) {
    var btn = instructionsButton();
    if (!btn) return { success: false, reason: 'Agent instructions button not found (turn Agent Mode on first).' };
    mdcClick(btn);
    var box = null;
    for (var i = 0; i < 30 && !box; i++) { await sleep(50); box = document.querySelector('.instructions-container'); }
    if (!box) return { success: false, reason: 'Instructions panel did not open.' };
    var existing = Array.prototype.slice.call(box.querySelectorAll('input.editable-text-input')).some(function (inp) { return norm(inp.value) === norm(data.title); });
    if (!existing) {
      var add = box.querySelector('button.add-instruction-button');
      if (add) { mdcClick(add); await sleep(150); }
    }
    var titles = box.querySelectorAll('input.editable-text-input');
    var descs = box.querySelectorAll('textarea.description-input');
    var title = titles[titles.length - 1], desc = descs[descs.length - 1];
    if (title) setValue(title, data.title);
    if (desc) setValue(desc, data.text);
    await sleep(140);
    var done = box.querySelector('button.done-button');
    if (done) { mdcClick(done); await sleep(140); }
    var close = document.querySelector(".agent-panel-animation-container button[aria-label='Close'], button.header-action[aria-label='Close']");
    if (close) mdcClick(close);
    return { success: !!(title || desc), instructionsSynced: !!(title || desc), reused_entry: existing };
  }

  // ---------- Autopilot approvals + question resolver ----------
  var handled = new WeakSet();
  function approve(keywords, allowReply) {
    var cards = Array.prototype.slice.call(document.querySelectorAll('flow-agent-chat-message, flow-agent-message, .agent-message-container, .choice-container, flow-agent-approval-card, [class*="approval"]'));
    var scope = cards.length ? cards : [document];
    for (var c = 0; c < scope.length; c++) {
      var buttons = Array.prototype.slice.call(scope[c].querySelectorAll("button, [role='button'], div.option-row"));
      var always = buttons.find(function (b) { return !isDisabled(b) && !b.classList.contains('read-only') && /always approve/i.test(b.innerText || ''); });
      if (always) { mdcClick(always); return { approved: true, type: 'always_approve', label: norm(always.innerText) }; }
      var appr = buttons.find(function (b) { var t = norm(b.innerText).toLowerCase(); return !isDisabled(b) && !b.classList.contains('read-only') && /^(✓ )?approve( and generate)?$/.test(t); });
      if (appr) { mdcClick(appr); return { approved: true, type: 'approve', label: norm(appr.innerText) }; }
    }
    var choices = document.querySelectorAll(".choice-container, [class*='choice-container']");
    for (var i = 0; i < choices.length; i++) {
      var box = choices[i];
      if (handled.has(box) || box.getAttribute('data-deepx-handled') === 'true') continue;
      var opts = Array.prototype.slice.call(box.querySelectorAll(".option-row:not(.read-only):not(.selected), mat-radio-button:not(.mat-mdc-radio-checked), [role='radio'][aria-checked='false']"));
      if (!opts.length) continue;
      var best = null;
      if (keywords && keywords.length > 2) {
        var kw = keywords.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; });
        best = opts.find(function (o) { var t = (o.innerText || '').toLowerCase(); return kw.some(function (k) { return t.indexOf(k) >= 0; }); });
      }
      var pick = best || opts[0];
      handled.add(box); box.setAttribute('data-deepx-handled', 'true');
      mdcClick(pick.querySelector("input[type='radio']") || pick);
      return { approved: true, type: 'interactive_choice', label: norm(pick.innerText).replace(/radio_button_\w+/g, '').trim() || 'Option 1' };
    }
    var confirm = document.querySelector('.cdk-overlay-pane button.mat-primary, .cdk-overlay-pane button.mat-mdc-unelevated-button');
    if (confirm && /confirm|continue|generate/i.test(confirm.innerText || '') && !isDisabled(confirm)) { mdcClick(confirm); return { approved: true, type: 'dialog_confirm', label: norm(confirm.innerText) }; }

    var msgs = document.querySelectorAll('flow-agent-chat-message, flow-agent-message, .agent-message-container');
    var last = msgs[msgs.length - 1];
    if (allowReply !== false && last && !handled.has(last) && last.getAttribute('data-deepx-handled') !== 'true' && !busy().isBusy) {
      var isUser = last.classList.contains('user-message') || !!last.querySelector('.user-message, [data-author="user"]');
      var text = norm(last.innerText);
      if (!isUser && text.length > 15) {
        var limitQ = /\b(?:up to 24|exceeds this 24|24-item limit|24 items per request|would you like to start with|first set of)\b/i.test(text);
        var generalQ = /\?/.test(text) && /\b(?:start|proceed|generate|first set|which option|should I|do you want|shall I|would you like)\b/i.test(text);
        if (limitQ || generalQ) {
          var reply = 'Yes, proceed now exactly as requested. Generate every listed item immediately without further questions.';
          var m = text.match(/(\d+\s*(?:letters?|images?|items?|videos?|clips?)\s*(?:\([^\)]+\))?)/i);
          if (limitQ && m) reply = 'Yes, start with ' + norm(m[1]) + ' now. Do not ask again; the remaining items will be sent in the next message.';
          handled.add(last); last.setAttribute('data-deepx-handled', 'true');
          return { approved: false, needs_reply: true, type: 'text_question', question: text.slice(0, 240), reply: reply };
        }
      }
    }
    return { approved: false };
  }

  // ---------- Prompt box + submit ----------
  function promptBox() {
    var el = document.querySelector('div.ProseMirror[contenteditable="true"]');
    if (el && shown(el)) return el;
    var list = document.querySelectorAll("flow-rich-text-editor div[role='textbox'], [contenteditable='true'], flow-prompt-box textarea, textarea");
    for (var i = 0; i < list.length; i++) if (shown(list[i])) return list[i];
    return null;
  }
  function submitButton() {
    var roots = [document.querySelector('flow-prompt-box, flow-base-prompt-box, .agent-prompt-box'), document];
    for (var r = 0; r < roots.length; r++) {
      if (!roots[r]) continue;
      var btns = Array.prototype.filter.call(roots[r].querySelectorAll('button'), shown);
      var b = btns.find(function (x) { return x.matches("button.generate-icon-button, button[aria-label='Start generation'], button[aria-label*='generat' i], button[aria-label*='send' i], button[aria-label*='submit' i], div.submit-controls button[type='submit'], button.submit-button"); })
        || btns.find(function (x) { var ic = norm((x.querySelector('mat-icon') || {}).textContent); return ic === 'arrow_forward' || ic === 'send' || ic === 'arrow_upward'; });
      if (b) return b;
    }
    return null;
  }
  function fillPrompt(text) {
    window.__agFlowExpect = null; // never let the standard-mode send guard block an Agent request
    var el = promptBox();
    if (!el) return { ok: false, error: 'Prompt box not found on the Flow canvas.' };
    el.focus();
    if (el.tagName === 'TEXTAREA') {
      el.select(); document.execCommand('insertText', false, text);
      if (norm(el.value) !== norm(text)) setValue(el, text);
    } else {
      var range = document.createRange(); range.selectNodeContents(el);
      var sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('delete', false);
      document.execCommand('insertText', false, text);
      if (norm(el.innerText).length < Math.min(40, norm(text).length)) {
        // Fallback: synthetic paste keeps ProseMirror paragraphs intact
        var dt = new DataTransfer(); dt.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    var value = norm(el.tagName === 'TEXTAREA' ? el.value : el.innerText);
    return { ok: value.length >= Math.min(20, norm(text).length) * 0.9, length: value.length };
  }
  async function submitPoint() {
    var btn = null;
    for (var i = 0; i < 60; i++) { btn = submitButton(); if (btn && !isDisabled(btn)) break; await sleep(50); }
    if (!btn) return { found: false, error: 'Submit button not found.' };
    if (isDisabled(btn)) return { found: true, disabled: true, error: 'Submit button stayed disabled.' };
    var p = tapPoint(btn);
    p.found = true; p.disabled = false;
    return p;
  }
  function clickSubmit() {
    var btn = submitButton();
    if (!btn || isDisabled(btn)) return { ok: false };
    mdcClick(btn);
    return { ok: true };
  }
  function pressEnter() {
    var el = promptBox() || document.activeElement || document.body;
    var ev = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', ev));
    el.dispatchEvent(new KeyboardEvent('keyup', ev));
    return { ok: true };
  }
  function busy() {
    var stop = document.querySelector("button.stop-icon-button, button.stop-button, button[aria-label*='stop' i]");
    var streaming = !!document.querySelector('flow-agent-message.streaming, .agent-streaming, flow-agent-chat mat-spinner, flow-agent-chat mat-progress-spinner');
    var sb = submitButton();
    var box = promptBox();
    var boxText = box ? norm(box.tagName === 'TEXTAREA' ? box.value : box.innerText) : '';
    return { isBusy: !!(stop && shown(stop)) || streaming, hasSubmit: !!sb && !isDisabled(sb), boxEmpty: !boxText, agentMessages: document.querySelectorAll('flow-agent-chat-message, flow-agent-message, .agent-message-container').length };
  }

  // ---------- "Unusual activity / extension" block detector ----------
  function noticeTexts() {
    var out = [];
    var nodes = document.querySelectorAll(NOTICE_SEL);
    for (var i = 0; i < nodes.length && out.length < 60; i++) {
      var t = norm(nodes[i].innerText || nodes[i].textContent);
      if (t && t.length < 600 && BLOCK_RE.test(t) && out.indexOf(t) < 0) out.push(t);
    }
    return out;
  }
  function blockMark() { return { texts: noticeTexts(), at: Date.now() }; }
  function blockScan(mark) {
    var before = (mark && mark.texts) || [];
    var now = noticeTexts();
    var fresh = now.filter(function (t) { return before.indexOf(t) < 0; });
    return { blocked: fresh.length > 0, texts: fresh.slice(0, 5), all: now.slice(0, 5) };
  }
  function isBlockText(t) { return BLOCK_RE.test(String(t || '')); }

  window.__deepxAgent = {
    v: VERSION,
    status: status, setAgent: setAgent, configure: configure, syncInstructions: syncInstructions,
    approve: approve, fillPrompt: fillPrompt, submitPoint: submitPoint, clickSubmit: clickSubmit,
    pressEnter: pressEnter, busy: busy, blockMark: blockMark, blockScan: blockScan, isBlockText: isBlockText
  };
})();
