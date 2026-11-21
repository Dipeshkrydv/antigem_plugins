// DeepX Agent Mode page helper (MAIN world). Ported from the DeepX Chrome extension
// (service-worker.js agent functions + content-script-isolated.js autopilot watcher).
// Injected lazily by deepx-agent.js through chrome.scripting.executeScript({files}).
//
// Flow UI map (Google help "Use the Google Flow Agent", support.google.com/flow/answer/17093911, Nov 2026):
//   Agent on/off ........ prompt box -> "Agent" (select again to turn off; prompt box changes when on)
//   Full chat ........... prompt box -> "Expand" -> expanded Agent side panel
//   Sessions ............ expanded side panel -> top "Menu" -> "Create a new session" / select / More > Rename|Delete
//   Agent Instructions .. bottom of prompt box -> "Agent Instructions" -> "Add instruction" -> "Done"
//   Settings ............ bottom of prompt box -> "Settings" (icon labelled "Options")
//       Confirm before generating: Always | Never
//       Image generation: default aspect ratio, number of outputs, image model
//       Video generation: default orientation, number of outputs, video model
//   References .......... bottom of prompt box -> "Add" (or drag assets into the prompt box)
(function () {
  var VERSION = 5; // v5: Google help-page locations (Agent button, Expand, Settings/Options, Image/Video sections, Sessions)
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

  // ---------- Agent toggle ----------
  // Nov 2026 Flow UI: the Agent is a "spark" switch INSIDE the prompt box, next to the generate
  // button. Older UI: an "Agent" pill/chip. Both are supported; the spark switch is tried first.
  function iconText(el) {
    var out = '';
    var ics = el.querySelectorAll ? el.querySelectorAll('mat-icon, .material-symbols-outlined, .material-symbols-rounded, .google-symbols, i') : [];
    for (var i = 0; i < ics.length; i++) out += ' ' + norm(ics[i].textContent);
    return out.toLowerCase();
  }
  function promptRoot() {
    var direct = document.querySelector('.agent-panel-prompt-box, flow-prompt-box, flow-base-prompt-box, flow-agent-prompt-box, .agent-prompt-box, div.prompt-box');
    if (direct && shown(direct)) return direct;
    if (direct) return direct;
    var pb = promptBox();
    return pb ? pb.closest('form, [class*="prompt-box"], [class*="composer"]') : null;
  }
  // Text the user sees on a control, without Material icon ligature names ("tune", "spark", ...)
  function visibleText(el) {
    var t = norm(el.innerText || el.textContent);
    var ics = el.querySelectorAll ? el.querySelectorAll('mat-icon, .material-symbols-outlined, .material-symbols-rounded, .google-symbols, i') : [];
    for (var i = 0; i < ics.length; i++) { var it = norm(ics[i].textContent); if (it) t = t.replace(it, ' '); }
    return norm(t);
  }
  function ariaOf(el) {
    return norm(el.getAttribute('aria-label') || el.getAttribute('mattooltip') || el.getAttribute('data-tooltip') || el.getAttribute('title') || '');
  }
  // Find a control by its label (aria-label / tooltip / visible text) or icon, searching the prompt box first.
  function findControl(labelRe, iconRe, root) {
    var scopes = root ? [root] : [promptRoot(), document];
    for (var s = 0; s < scopes.length; s++) {
      if (!scopes[s]) continue;
      var list = scopes[s].querySelectorAll("button, [role='button'], [role='switch'], a[role='menuitem'], mat-chip, mat-chip-option");
      var byIcon = null;
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        if (!shown(b)) continue;
        if (labelRe && (labelRe.test(ariaOf(b)) || labelRe.test(visibleText(b)))) return b;
        if (!byIcon && iconRe && iconRe.test(iconText(b).trim())) byIcon = b;
      }
      if (byIcon) return byIcon;
    }
    return null;
  }
  // Smallest visible overlay/panel whose text matches re (settings, instructions, side panel).
  function containerWithText(re) {
    var list = document.querySelectorAll(".cdk-overlay-pane, mat-dialog-container, [role='dialog'], aside, flow-agent-panel, flow-agent-settings, flow-agent-side-panel, [class*='side-panel'], [class*='settings'], [class*='instructions'], [class*='panel']");
    var best = null, bestLen = Infinity;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!shown(el)) continue;
      var t = el.innerText || '';
      if (re.test(t) && t.length < bestLen) { best = el; bestLen = t.length; }
    }
    return best;
  }
  function sparkSwitch() {
    var roots = [promptRoot(), document];
    for (var r = 0; r < roots.length; r++) {
      if (!roots[r]) continue;
      var list = roots[r].querySelectorAll("button[role='switch'], [role='switch'], mat-slide-toggle, mat-mdc-slide-toggle, .mat-mdc-slide-toggle, .mdc-switch, button.agent-toggle, button.spark-toggle, [class*='agent-switch'], [class*='agent-toggle'], [class*='spark-switch'], [class*='spark-toggle'], button[aria-pressed]");
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (!shown(el)) continue;
        var aria = norm((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('mattooltip') || el.getAttribute('title') || '')).toLowerCase();
        var ic = iconText(el), cls = String(el.className || '').toLowerCase();
        if (/article_spark|tune|settings/.test(ic) && !/agent/.test(aria)) continue; // instructions / settings buttons
        if (/agent|spark|brainstorm/.test(aria) || /(^|\s)(spark|auto_awesome|magic_button|wand_stars)(\s|$)/.test(ic) || /(agent|spark)[-_]?(switch|toggle)/.test(cls)) {
          // Prefer the actual clickable switch element
          var inner = el.matches("button, [role='switch']") ? el : (el.querySelector("button[role='switch'], [role='switch'], button, input[type='checkbox']") || el);
          return inner;
        }
      }
      if (r === 0 && roots[0]) {
        // Positional fallback: an icon-only toggle sitting right next to the generate button
        var sb = submitButton();
        if (sb && sb.parentElement) {
          var sibs = sb.parentElement.parentElement ? sb.parentElement.parentElement.querySelectorAll('button') : [];
          for (var k = 0; k < sibs.length; k++) {
            var b = sibs[k];
            if (b === sb || !shown(b)) continue;
            if (/(^|\s)(spark|auto_awesome)(\s|$)/.test(iconText(b))) return b;
          }
        }
      }
    }
    return null;
  }
  // Current location (Google help, Nov 2026): a control labelled "Agent" inside the prompt box.
  // Must NOT match "Agent Instructions" / "Agent settings", hence the anchored regex.
  var AGENT_LABEL_RE = /^(agent|agent mode|flow agent|google flow agent|turn (on|off) (the )?agent)$/i;
  function agentButton() {
    var root = promptRoot();
    var b = root && findControl(AGENT_LABEL_RE, null, root);
    if (b) return b.matches("button, [role='switch'], [role='button']") ? b : (b.querySelector("button, [role='switch']") || b);
    return null;
  }
  function agentPill() {
    var ab = agentButton();
    if (ab) return ab;
    var sw = sparkSwitch();
    if (sw) return sw;
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
    var sel = p.getAttribute('aria-pressed') || p.getAttribute('aria-selected') || p.getAttribute('aria-checked');
    var host = p.closest && p.closest('mat-slide-toggle, .mat-mdc-slide-toggle, .mdc-switch');
    var hostCls = host ? String(host.className || '') : '';
    var box = p.matches && p.matches("input[type='checkbox']") ? p : (p.querySelector && p.querySelector("input[type='checkbox']"));
    if (box && box.checked) return true;
    if (/mat-mdc-slide-toggle-checked|mat-checked|mdc-switch--selected|mdc-switch--checked/.test(cls + ' ' + hostCls)) return true;
    if (/(^|\s)(on|checked|is-on|agent-on|toggle-on)(\s|$)/.test(cls)) return true;
    if (sel === 'true' || cls.indexOf('agent-mode-chip-checked') >= 0 || /(^|\s)(active|selected)(\s|$)/.test(cls) || cls.indexOf('mat-mdc-tab-active') >= 0) return true;
    if (sel === 'false') return false;
    // Help page: "the prompt box changes when Agent is on" -> the Agent-only controls appear.
    return !!(instructionsButton() || document.querySelector('flow-agent-prompt-box, .agent-prompt-box'));
  }
  function isAgentPanelOpen() {
    var p = document.querySelector('.agent-panel-animation-container, .agent-panel-wrapper, flow-agent-side-panel, flow-agent-chat, .agent-side-panel, [class*="agent-panel"], [class*="agent-chat"]');
    return !!(p && (p.offsetWidth > 0 || p.offsetHeight > 0));
  }
  function agentActive() {
    if (isAgentPanelOpen()) return true;
    return pillActive(agentPill());
  }
  function status() {
    var panelOpen = isAgentPanelOpen();
    var p = agentPill();
    var cr = compactReply();
    var isFound = !!p || panelOpen;
    var isActive = panelOpen || pillActive(p);
    return {
      found: isFound,
      active: isActive,
      label: panelOpen ? 'Google Flow Agent (Side Panel Active)' : (p ? norm(ariaOf(p) || visibleText(p) || 'Agent') : null),
      control: panelOpen ? 'agent_panel' : (p ? (agentButton() === p ? 'agent_button' : sparkSwitch() === p ? 'spark_switch' : 'agent_pill') : null),
      location: panelOpen ? 'agent side panel (open)' : 'prompt box -> "Agent"',
      compact_reply: cr ? norm(cr.innerText).slice(0, 300) : null,
      full_chat_open: panelOpen || fullChatOpen(),
      expand_button: !!expandButton(),
      instructions_button: !!instructionsButton(),
      settings_button: !!settingsButton(),
      prompt_box: !!promptBox(),
      busy: busy().isBusy,
      url: location.href
    };
  }
  async function setAgent(desired) {
    var panelOpen = isAgentPanelOpen();
    var p = agentPill();
    var before = panelOpen || pillActive(p);
    var want = desired == null ? !before : !!desired;

    if (before === want) {
      return { success: true, found: true, active: before, changed: false };
    }

    if (!want && panelOpen) {
      // Close the agent side panel via the header close button (right_panel_close or aria-label="Close")
      var header = document.querySelector('.agent-panel-header, flow-agent-side-panel, .agent-side-panel');
      var closeBtn = header && (header.querySelector('button[aria-label="Close"], button[aria-label*="close" i]') ||
        Array.prototype.find.call(header.querySelectorAll('button'), function(b) {
          return /right_panel_close|close/i.test(iconText(b));
        }));
      if (closeBtn) {
        mdcClick(closeBtn);
        for (var i = 0; i < 30 && isAgentPanelOpen(); i++) await sleep(60);
      }
    } else if (want && !panelOpen) {
      if (p) {
        mdcClick(p);
        for (var i = 0; i < 30 && !agentActive(); i++) await sleep(60);
      } else {
        var exp = expandButton();
        if (exp) {
          mdcClick(exp);
          for (var i = 0; i < 30 && !agentActive(); i++) await sleep(60);
        }
      }
    } else if (p) {
      mdcClick(p);
      for (var i = 0; i < 30 && agentActive() !== want; i++) await sleep(60);
    }

    var now = agentActive();
    return { success: now === want, found: !!p || isAgentPanelOpen(), active: now, changed: before !== now };
  }

  // ---------- Agent settings (Autopilot / models / ratio / quality) ----------
  function modelMatch(uiText, modelStr) {
    if (!uiText || !modelStr) return false;
    var txt = String(uiText).toLowerCase().replace(/[^\w\s\.]/g, ' ');
    var tm = String(modelStr).toLowerCase().replace(/[^\w\s\.]/g, ' ');
    if (tm.indexOf('1.2') >= 0) return txt.indexOf('1.2') >= 0;
    if (tm.indexOf('1.1') >= 0) return txt.indexOf('1.1') >= 0; // Omni Flash 1.1 retires Dec 5 2026
    // Unversioned "omni"/"omni flash" = current Omni Flash (1.2 is the default since Nov 5 2026)
    if (tm.indexOf('omni') >= 0) return txt.indexOf('omni') >= 0 && txt.indexOf('1.1') < 0;
    if (tm.indexOf('quality') >= 0) return txt.indexOf('quality') >= 0;
    if (tm.indexOf('lite') >= 0 && tm.indexOf('banana') < 0) return txt.indexOf('lite') >= 0 && txt.indexOf('banana') < 0;
    if (tm.indexOf('fast') >= 0) return txt.indexOf('fast') >= 0;
    if (tm.indexOf('2.1') >= 0) return txt.indexOf('2.1') >= 0;
    if (tm.indexOf('pro') >= 0) return txt.indexOf('pro') >= 0;
    if (tm.indexOf('banana') >= 0 && (tm.indexOf('2') >= 0 || tm.indexOf('lite') >= 0)) return txt.indexOf('banana 2') >= 0 || txt.indexOf('lite') >= 0;
    if (tm.indexOf('imagen') >= 0) return txt.indexOf('imagen') >= 0;
    return tm.split(/\s+/).filter(function (w) { return w.length > 2; }).some(function (w) { return txt.indexOf(w) >= 0; });
  }
  // Settings: "At the bottom of your project's prompt box, select Settings" (icon labelled "Options").
  function settingsButton() {
    var root = promptRoot();
    var b = root && findControl(/^(settings|options|agent settings|agent options|prompt settings)$/i, /^(tune|settings|more_vert|page_info)$/, root);
    if (b) return b;
    return Array.prototype.slice.call(document.querySelectorAll('button.agent-action-button')).find(function (x) { return shown(x) && /tune/.test(iconText(x)); }) || null;
  }
  function settingsPanel() {
    var p = document.querySelector("flow-agent-panel, flow-agent-settings, .agent-panel-animation-container, [class*='agent-settings-panel']");
    if (p && shown(p) && /confirm before generating|generation/i.test(p.innerText || '')) return p;
    return containerWithText(/confirm before generating/i) || (p && shown(p) ? p : null);
  }
  function isOn(el) {
    if (!el) return false;
    var input = el.matches && el.matches('input') ? el : (el.querySelector && el.querySelector("input[type='radio'], input[type='checkbox']"));
    if (input && input.checked) return true;
    var a = el.getAttribute('aria-checked') || el.getAttribute('aria-pressed') || el.getAttribute('aria-selected');
    if (a === 'true') return true;
    var host = el.closest && el.closest('mat-radio-button, mat-button-toggle, mat-chip-option, mat-option');
    return /mat-mdc-radio-checked|mat-button-toggle-checked|mdc-evolution-chip--selected|mat-mdc-option-active|mdc-list-item--selected/.test(String((host || el).className || ''));
  }
  // The block under a heading such as "Image generation" / "Video generation" / "Confirm before generating".
  function sectionOf(panel, headRe, stopRe) {
    var nodes = panel.querySelectorAll("h1, h2, h3, h4, h5, h6, [role='heading'], legend, label, span, div, p");
    var head = null;
    for (var i = 0; i < nodes.length; i++) {
      var t = norm(nodes[i].innerText);
      if (t.length < 48 && nodes[i].childElementCount <= 3 && headRe.test(t)) { head = nodes[i]; break; }
    }
    if (!head) return null;
    var s = head;
    while (s.parentElement && s.parentElement !== panel && !(stopRe && stopRe.test(s.parentElement.innerText || ''))) s = s.parentElement;
    return s;
  }
  var OPTION_SEL = "[role='option'], [role='menuitem'], [role='menuitemradio'], [role='radio'], mat-option, flow-menu-item, .mat-mdc-menu-item, mat-button-toggle button, mat-chip-option, button";
  function closeOverlay() {
    var bd = document.querySelector('.cdk-overlay-backdrop');
    if (bd) bd.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  }
  // Set one setting: either click an inline option (radio / toggle / chip) or open its dropdown and pick.
  async function pickSetting(scope, labelRe, test, name, applied) {
    if (!scope) return false;
    var inline = Array.prototype.slice.call(scope.querySelectorAll("[role='radio'], mat-radio-button, mat-button-toggle, mat-button-toggle button, mat-chip-option, button[aria-pressed]")).filter(shown);
    var hit = inline.find(function (b) { return test(b); });
    if (hit) {
      if (!isOn(hit)) { mdcClick(hit.querySelector("input[type='radio']") || hit); await sleep(80); applied.push(name + ' set'); }
      else applied.push(name + ' ok');
      return true;
    }
    var triggers = Array.prototype.slice.call(scope.querySelectorAll("mat-select, [role='combobox'], button[aria-haspopup], button.mat-mdc-menu-trigger, button[class*='picker'], button[class*='select'], button[class*='dropdown']")).filter(shown);
    var trig = triggers.find(function (t) {
      var lab = ariaOf(t) + ' ' + norm((t.closest('label, .mat-mdc-form-field, [class*="row"], [class*="setting"]') || t).innerText);
      return labelRe.test(lab);
    }) || (triggers.length === 1 ? triggers[0] : null);
    if (!trig) { applied.push(name + ' control not found'); return false; }
    if (test(trig)) { applied.push(name + ' ok'); return true; }
    mdcClick(trig);
    var opt = null;
    for (var i = 0; i < 12 && !opt; i++) {
      await sleep(60);
      var pane = document.querySelectorAll(".cdk-overlay-pane, [role='listbox'], [role='menu'], .mat-mdc-menu-panel, .flow-model-picker-panel");
      for (var p = pane.length - 1; p >= 0 && !opt; p--) {
        if (!shown(pane[p]) || scope.contains(pane[p])) continue;
        opt = Array.prototype.slice.call(pane[p].querySelectorAll(OPTION_SEL)).filter(shown).find(function (o) { return test(o); });
      }
    }
    if (opt) { mdcClick(opt.querySelector('button') || opt); applied.push(name + ' set'); await sleep(120); return true; }
    closeOverlay(); applied.push(name + ' not offered'); return false;
  }
  function textTest(re) { return function (el) { return re.test(visibleText(el)) || re.test(ariaOf(el)); }; }
  function ratioTest(ratio) {
    var clean = String(ratio).replace('_', ':'), icon = 'crop_' + clean.replace(':', '_');
    var named = { '16:9': /landscape|horizontal|widescreen/i, '9:16': /portrait|vertical/i, '1:1': /square/i, '4:3': /standard/i, '3:4': /portrait 3/i };
    return function (el) {
      var t = visibleText(el) + ' ' + ariaOf(el), ic = iconText(el);
      return t.indexOf(clean) >= 0 || ic.indexOf(icon) >= 0 || (clean === '1:1' && ic.indexOf('crop_square') >= 0) || (!!named[clean] && named[clean].test(t) && !/\d+:\d+/.test(t.replace(clean, '')));
    };
  }
  function orientationTest(o) {
    var land = /^(land|horiz|16)/i.test(String(o));
    var re = land ? /landscape|horizontal|16:9/i : /portrait|vertical|9:16/i;
    return function (el) { return re.test(visibleText(el) + ' ' + ariaOf(el)) || iconText(el).indexOf(land ? 'crop_landscape' : 'crop_portrait') >= 0 || iconText(el).indexOf(land ? 'crop_16_9' : 'crop_9_16') >= 0; };
  }
  function countTest(n) {
    var re = new RegExp('^(?:[x×]\\s?' + n + '|' + n + '\\s?[x×]?|' + n + ' (?:outputs?|images?|videos?|results?))$', 'i');
    return function (el) { return re.test(visibleText(el)) || re.test(ariaOf(el)); };
  }
  function modelTest(model) { return function (el) { return modelMatch(visibleText(el) || ariaOf(el), model); }; }
  async function pickModel(panel, selector, model, applied, section) {
    if (!model) return;
    var picker = panel.querySelector(selector);
    if (!picker) { await pickSetting(section || panel, /model/i, modelTest(model), 'model ' + model, applied); return; }
    if (modelMatch(norm(picker.innerText), model)) { applied.push('model ok: ' + model); return; }
    mdcClick(picker);
    await sleep(220);
    var opts = Array.prototype.slice.call(document.querySelectorAll(".flow-model-picker-panel flow-menu-item, .mat-mdc-menu-panel flow-menu-item, flow-menu-item.model-select-option, [role='menuitem'], [role='option'], mat-option, .mat-mdc-menu-item, flow-menu-item"));
    var target = opts.find(function (m) { return modelMatch(m.innerText, model); });
    if (target) { mdcClick(target.querySelector('button') || target); applied.push('model set: ' + model); await sleep(140); }
    else { closeOverlay(); applied.push('model not offered: ' + model); }
  }
  async function openSettings() {
    var panel = settingsPanel();
    if (panel) return panel;
    var btn = settingsButton();
    if (!btn) return null;
    mdcClick(btn);
    for (var i = 0; i < 30 && !panel; i++) { await sleep(50); panel = settingsPanel(); }
    return panel;
  }
  // Veo 3.1 Fast / Veo 3.1 Quality / Omni Flash 1.1 retire Dec 5 2026 -> fall back to Omni Flash 1.2.
  function liveVideoModel(m, applied) {
    if (!m) return m;
    var t = String(m).toLowerCase();
    if (Date.now() >= Date.UTC(2026, 11, 5) && (/veo.*(fast|quality)/.test(t) || /1\.1/.test(t) || /^veo[-_ ]omni$/.test(t))) {
      applied.push('model "' + m + '" retired Dec 5 2026 -> Omni Flash 1.2');
      return 'Omni Flash 1.2';
    }
    return m;
  }
  async function configure(cfg) {
    cfg = Object.assign({}, cfg || {});
    var applied = [];
    cfg.agentVideoModel = liveVideoModel(cfg.agentVideoModel, applied);
    if (!agentActive()) await setAgent(true);
    var panel = await openSettings();
    if (!panel) return { success: false, reason: 'Agent Settings could not be opened. Location: bottom of the prompt box -> "Settings" (Options icon), with Agent turned on.' };

    // Confirm before generating: Always | Never (autopilot = Never)
    var confirmWant = cfg.confirmBeforeGenerating ? String(cfg.confirmBeforeGenerating).toLowerCase() : (cfg.autopilot === false ? 'always' : 'never');
    var confirmScope = sectionOf(panel, /^confirm before generating$/i, /image generation|video generation/i) || panel;
    await pickSetting(confirmScope, /confirm before generating/i, textTest(confirmWant === 'always' ? /^always$/i : /^never$/i), 'confirm before generating: ' + confirmWant, applied);

    var imgSec = sectionOf(panel, /^image generation$/i, /video generation|confirm before generating/i);
    var vidSec = sectionOf(panel, /^video generation$/i, /image generation|confirm before generating/i);

    // Image generation: default aspect ratio, number of outputs, image model
    var imgRatio = cfg.imageAspectRatio || cfg.aspectRatio;
    if (imgRatio) await pickSetting(imgSec || panel, /aspect|ratio/i, ratioTest(imgRatio), 'image aspect ' + imgRatio, applied);
    if (cfg.imageOutputs) await pickSetting(imgSec || panel, /output|number|count/i, countTest(cfg.imageOutputs), 'image outputs x' + cfg.imageOutputs, applied);
    await pickModel(panel, "button.image-model-picker-button, button[aria-label='Image generation default model']", cfg.agentImageModel, applied, imgSec);

    // Video generation: default orientation, number of outputs, video model
    var orient = cfg.orientation || (cfg.aspectRatio === '9:16' ? 'portrait' : cfg.aspectRatio === '16:9' ? 'landscape' : null);
    if (orient && vidSec) await pickSetting(vidSec, /orientation|aspect|ratio/i, orientationTest(orient), 'video orientation ' + orient, applied);
    if (cfg.videoOutputs) await pickSetting(vidSec || panel, /output|number|count/i, countTest(cfg.videoOutputs), 'video outputs x' + cfg.videoOutputs, applied);
    await pickModel(panel, "button.video-model-picker-button, button[aria-label='Video generation default model']", cfg.agentVideoModel, applied, vidSec);

    if (cfg.quality) {
      var q = String(cfg.quality).toLowerCase();
      var want = /1080|2k|4k|high/.test(q) ? /^(high|1080p?|2k|4k)$/i : /720|med|standard/.test(q) ? /^(medium|720p?)$/i : /low|360/.test(q) ? /^(low|360p?)$/i : null;
      if (want) await pickSetting(vidSec || panel, /quality|resolution/i, textTest(want), 'quality ' + cfg.quality, applied);
    }

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
  // "At the bottom of your project's prompt box, select Agent Instructions" -> "Add instruction" -> "Done"
  function instructionsButton() {
    var root = promptRoot();
    var b = root && findControl(/^(agent instructions|instructions|project instructions)$/i, /^article_spark$/, root);
    if (b) return b;
    return Array.prototype.slice.call(document.querySelectorAll('button')).find(function (x) {
      return shown(x) && ((String(x.className || '').indexOf('agent-action-button') >= 0 && iconText(x).indexOf('article_spark') >= 0) || /^agent instructions$/i.test(ariaOf(x)));
    }) || null;
  }
  function instructionsPanel() {
    var c = document.querySelector('.instructions-container');
    return (c && shown(c)) ? c : containerWithText(/add instruction|agent instructions/i);
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
    if (!btn && !agentActive()) { await setAgent(true); btn = instructionsButton(); }
    if (!btn) return { success: false, reason: 'Agent Instructions not found. Location: bottom of the prompt box -> "Agent Instructions", with Agent turned on.' };
    mdcClick(btn);
    var box = null;
    for (var i = 0; i < 30 && !box; i++) { await sleep(50); box = instructionsPanel(); }
    if (!box) return { success: false, reason: 'Instructions panel did not open.' };
    var titleSel = 'input.editable-text-input, input[type="text"], input:not([type])';
    var descSel = 'textarea.description-input, textarea';
    var existing = Array.prototype.slice.call(box.querySelectorAll(titleSel)).some(function (inp) { return norm(inp.value) === norm(data.title); });
    if (!existing) {
      var add = box.querySelector('button.add-instruction-button') || textButton(/^(\+ ?)?add (an )?instruction$/i, box) || textButton(/^(\+ ?)?add (an )?instruction$/i);
      if (add) { mdcClick(add); for (var w = 0; w < 10 && !box.querySelector(descSel); w++) await sleep(60); await sleep(80); }
    }
    var titles = box.querySelectorAll(titleSel);
    var descs = box.querySelectorAll(descSel);
    var title = titles[titles.length - 1], desc = descs[descs.length - 1];
    if (existing) { // update the matching entry in place
      for (var t = 0; t < titles.length; t++) if (norm(titles[t].value) === norm(data.title)) { title = titles[t]; desc = descs[t] || desc; break; }
    }
    if (title) setValue(title, data.title);
    if (desc) setValue(desc, data.text);
    await sleep(140);
    var done = box.querySelector('button.done-button') || textButton(/^(done|save)$/i, box);
    if (done && !isDisabled(done)) { mdcClick(done); await sleep(140); }
    var close = document.querySelector(".agent-panel-animation-container button[aria-label='Close'], button.header-action[aria-label='Close']") || findControl(/^close$/i, /^close$/, box);
    if (close && shown(close)) mdcClick(close);
    return { success: !!(title || desc), instructionsSynced: !!(title || desc), reused_entry: existing };
  }

  // ---------- Compact Agent replies (Nov 2026) ----------
  // Quick answers now appear right above the prompt box with "Read more" / "Use side panel".
  function textButton(re, root) {
    var list = (root || document).querySelectorAll("button, a, [role='button']");
    for (var i = 0; i < list.length; i++) if (shown(list[i]) && re.test(norm(list[i].innerText || list[i].getAttribute('aria-label')))) return list[i];
    return null;
  }
  function compactReply() {
    var direct = document.querySelector("flow-agent-quick-reply, flow-agent-inline-response, flow-agent-preview, [class*='agent-quick'], [class*='quick-answer'], [class*='agent-inline'], [class*='agent-preview']");
    if (direct && shown(direct)) return direct;
    var b = textButton(/^(read more|use side panel|open (in )?side panel)$/i);
    if (!b) return null;
    var el = b;
    for (var i = 0; i < 6 && el.parentElement; i++) { el = el.parentElement; if (norm(el.innerText).length > 40) break; }
    return el;
  }
  // "To open the expanded Agent side panel, select Expand" (in the Agent prompt box).
  var CHAT_SEL = '.agent-panel-animation-container, .agent-panel-wrapper, flow-agent-chat, flow-agent-side-panel, flow-agent-chat-message, flow-agent-message, .agent-message-container, .agent-side-panel, [class*="agent-side-panel"], [class*="agent-panel"]';
  function fullChatOpen() { var c = document.querySelector(CHAT_SEL); return !!(c && shown(c)); }
  function expandButton() {
    var root = promptRoot();
    return (root && findControl(/^(expand|expand agent|expand (agent )?(side )?panel|open (agent )?side panel)$/i, /^(open_in_full|expand_content|right_panel_open|left_panel_open|open_in_new_down|fullscreen|expand)$/, root))
      || textButton(/^(expand|use side panel|open (in )?side panel)$/i) || textButton(/^read more$/i);
  }
  async function openFullChat() {
    if (fullChatOpen()) return { open: true, already: true };
    var b = expandButton();
    if (!b) return { open: false, reason: 'Expand button not found. Location: Agent prompt box -> "Expand".' };
    mdcClick(b);
    for (var i = 0; i < 30; i++) { await sleep(60); if (fullChatOpen()) return { open: true, via: norm(ariaOf(b) || visibleText(b)) }; }
    return { open: false, clicked: norm(ariaOf(b) || visibleText(b)) };
  }

  // ---------- Sessions (expanded side panel -> Menu) ----------
  function sidePanel() { return document.querySelector('.agent-panel-animation-container, .agent-panel-wrapper, flow-agent-side-panel, flow-agent-chat, .agent-side-panel, [class*="agent-side-panel"], flow-agent-panel, [class*="agent-panel"]'); }
  async function openSessionMenu() {
    var o = await openFullChat();
    if (!o.open) return { ok: false, reason: o.reason || 'Expanded Agent side panel did not open.' };
    if (textButton(/^create a new session$|^new session$/i)) return { ok: true };
    var sp = sidePanel();
    var menu = findControl(/^(menu|sessions|session history|show sessions|open session history)$/i, /^(menu|history|view_list|forum)$/, sp || undefined);
    if (!menu) return { ok: false, reason: 'Session "Menu" not found at the top of the expanded Agent side panel.' };
    mdcClick(menu);
    for (var i = 0; i < 20; i++) { await sleep(60); if (textButton(/^create a new session$|^new session$/i)) return { ok: true }; }
    return { ok: true, partial: true };
  }
  async function newSession() {
    var m = await openSessionMenu();
    if (!m.ok) return { success: false, reason: m.reason };
    var b = textButton(/^create a new session$|^new session$/i);
    if (!b) return { success: false, reason: '"Create a new session" not found in the session Menu.' };
    mdcClick(b);
    await sleep(250);
    return { success: true };
  }
  async function listSessions() {
    var m = await openSessionMenu();
    if (!m.ok) return { success: false, reason: m.reason };
    var pane = containerWithText(/create a new session/i) || sidePanel() || document;
    var items = Array.prototype.slice.call(pane.querySelectorAll("[role='menuitem'], [role='option'], [role='listitem'], li, a, button")).filter(shown)
      .map(function (el) { return visibleText(el); })
      .filter(function (t, i, arr) { return t && t.length < 120 && !/^(create a new session|new session|more|rename|delete|menu|close)$/i.test(t) && arr.indexOf(t) === i; });
    closeOverlay();
    return { success: true, sessions: items.slice(0, 50) };
  }
  async function openSession(name) {
    var m = await openSessionMenu();
    if (!m.ok) return { success: false, reason: m.reason };
    var want = norm(name).toLowerCase();
    var pane = containerWithText(/create a new session/i) || sidePanel() || document;
    var hit = Array.prototype.slice.call(pane.querySelectorAll("[role='menuitem'], [role='option'], [role='listitem'], li, a, button")).filter(shown)
      .find(function (el) { return visibleText(el).toLowerCase() === want; }) ||
      Array.prototype.slice.call(pane.querySelectorAll("[role='menuitem'], [role='option'], [role='listitem'], li, a, button")).filter(shown)
      .find(function (el) { return visibleText(el).toLowerCase().indexOf(want) >= 0; });
    if (!hit) { closeOverlay(); return { success: false, reason: 'Session not found: ' + name }; }
    mdcClick(hit);
    await sleep(250);
    return { success: true, opened: visibleText(hit) };
  }

  // ---------- Autopilot approvals + question resolver ----------
  var handled = new WeakSet();
  function approve(keywords, allowReply) {
    // Compact strip may hide approval cards / questions: expand it into the full side-panel chat.
    var cr = !fullChatOpen() && compactReply();
    if (cr && !handled.has(cr)) {
      handled.add(cr); // expand once per reply; never toggle it back and forth
      var sp = expandButton();
      if (sp) mdcClick(sp);
    }
    var cards = Array.prototype.slice.call(document.querySelectorAll('flow-agent-chat-message, flow-agent-message, .agent-message-container, .choice-container, flow-agent-approval-card, [class*="approval"], flow-agent-quick-reply, flow-agent-inline-response, [class*="agent-quick"], [class*="quick-answer"], [class*="agent-inline"]'));
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
    var last = msgs[msgs.length - 1] || compactReply();
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
    var streaming = !!document.querySelector('flow-agent-message.streaming, .agent-streaming, flow-agent-chat mat-spinner, flow-agent-chat mat-progress-spinner, [class*="agent-quick"] mat-spinner, [class*="agent-quick"] mat-progress-spinner, [class*="agent-inline"] mat-progress-bar, [class*="thinking"]');
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

  // ---------- Project asset search (Nov 2026: exact matches first, then "Similar results") ----------
  function searchInput() {
    var list = document.querySelectorAll("input[type='search'], input[placeholder*='search' i], input[aria-label*='search' i], textarea[placeholder*='search' i]");
    for (var i = 0; i < list.length; i++) if (shown(list[i]) && !list[i].closest('flow-add-menu-popover-content, .cdk-overlay-pane')) return list[i];
    return null;
  }
  function tileInfo(t) {
    var img = t.querySelector('img'), vid = t.querySelector('video');
    var link = t.querySelector('a[href]');
    var href = link ? link.getAttribute('href') : '';
    var idm = (href || '').match(/\/(?:edit|media|asset|tile)s?\/([\w-]{6,})/i);
    return {
      id: t.getAttribute('data-tile-id') || t.getAttribute('data-media-id') || (idm && idm[1]) || null,
      type: vid ? 'video' : 'image',
      name: norm(t.getAttribute('aria-label') || t.getAttribute('title') || (img && img.alt) || t.innerText).slice(0, 160) || null,
      thumbnail: (img && img.src) || (vid && (vid.poster || vid.src)) || null,
      href: href || null
    };
  }
  async function searchAssets(query, opts) {
    opts = opts || {};
    var input = searchInput();
    if (!input) {
      var btn = Array.prototype.slice.call(document.querySelectorAll('button')).find(function (b) {
        return shown(b) && (/search/i.test(b.getAttribute('aria-label') || '') || /^search$/.test(iconText(b).trim()));
      });
      if (btn) { mdcClick(btn); for (var i = 0; i < 25 && !input; i++) { await sleep(60); input = searchInput(); } }
    }
    if (!input) return { success: false, error: 'Project search box not found. Open a Flow project first.' };
    input.focus();
    setValue(input, String(query || ''));
    var ev = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent('keydown', ev)); input.dispatchEvent(new KeyboardEvent('keyup', ev));
    var wait = Math.max(800, Math.min(15000, opts.waitMs || 3500));
    var t0 = Date.now(), lastCount = -1, stable = 0;
    var tileSel = 'flow-grid-tile-container, flow-tile-container, [data-tile-id], [data-media-id]';
    while (Date.now() - t0 < wait) { // wait until "Similar results" finish streaming in
      await sleep(300);
      var c = document.querySelectorAll(tileSel).length;
      if (c === lastCount) { if (++stable >= 3 && Date.now() - t0 > 900) break; } else { stable = 0; lastCount = c; }
    }
    var tiles = Array.prototype.filter.call(document.querySelectorAll(tileSel), shown);
    // Find a "Similar results" heading: tiles after it in document order are similar, before it exact.
    var heading = null;
    var hs = document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], .section-header, [class*="section-title"], [class*="similar"], span, div');
    for (var h = 0; h < hs.length; h++) {
      var tx = norm(hs[h].childElementCount <= 2 ? hs[h].innerText : '');
      if (/^similar( results)?$/i.test(tx) && shown(hs[h])) { heading = hs[h]; break; }
    }
    var exact = [], similar = [];
    for (var k = 0; k < tiles.length && exact.length + similar.length < (opts.limit || 60); k++) {
      var info = tileInfo(tiles[k]);
      var after = heading && (heading.compareDocumentPosition(tiles[k]) & Node.DOCUMENT_POSITION_FOLLOWING);
      (after ? similar : exact).push(info);
    }
    var empty = /no (results|assets) found/i.test(norm(document.body.innerText));
    return { success: true, query: query, exact: exact, similar: similar, similar_section_found: !!heading, no_results: empty || !tiles.length };
  }
  function clearSearch() {
    var input = searchInput();
    if (!input) return { cleared: false };
    setValue(input, '');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    return { cleared: true };
  }

  function getCompletedTiles(mediaType) {
    var tiles = document.querySelectorAll("flow-grid-tile-container, flow-video-tile, flow-image-tile, cdk-virtual-scroll-viewport [role='gridcell'], [class*='tile-container']");
    var list = [];
    for (var i = 0; i < tiles.length; i++) {
      var info = tileInfo(tiles[i]);
      var text = (tiles[i].innerText || "").trim();
      var isGenerating = /generating|rendering|queued|starting|preparing|in queue/i.test(text) ||
        !!tiles[i].querySelector("mat-progress-bar, mat-spinner, .progress-bar, .spinner, .generating");
      var isFailed = /failed|error|unable to generate|policy|violat/i.test(text);
      if (!isGenerating && !isFailed) {
        if (!mediaType || info.type === mediaType) {
          list.push(info);
        }
      }
    }
    return list;
  }

  window.__deepxAgent = {
    v: VERSION,
    status: status, setAgent: setAgent, configure: configure, syncInstructions: syncInstructions,
    approve: approve, fillPrompt: fillPrompt, submitPoint: submitPoint, clickSubmit: clickSubmit,
    pressEnter: pressEnter, busy: busy, blockMark: blockMark, blockScan: blockScan, isBlockText: isBlockText,
    openFullChat: openFullChat, compactReply: function () { var c = compactReply(); return c ? norm(c.innerText).slice(0, 2000) : null; },
    searchAssets: searchAssets, clearSearch: clearSearch, getCompletedTiles: getCompletedTiles,
    openSettings: function () { return openSettings().then(function (p) { return { open: !!p }; }); },
    newSession: newSession, listSessions: listSessions, openSession: openSession,
    agentToggle: agentPill, agentActive: agentActive
  };
})();
