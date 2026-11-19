/**
 * Antigravity Meta Bridge Extension - Browser Anti-Detection & Algorithmic Protection Suite
 * Native browser ES Module port of AlgorithmicQueue, CreativeMutator, HumanizedBridge, and CircuitBreaker.
 */

// ============================================================================
// 1. ALGORITHMIC QUEUE & 2026 RATE-LIMIT ENGINE
// ============================================================================
export const DEFAULT_RATE_LIMIT_POLICY = {
  facebook: {
    max24h: 20,              // 20 posts per rolling 24h
    max1h: 2,                // 2 posts per rolling 1h
    minGapMinutes: 35,
    maxGapMinutes: 65,
  },
  instagram: {
    max24h: 45,              // 45 posts per rolling 24h
    max1h: 4,                // 4 posts per rolling 1h
    maxOpenContainers: 40,
    minGapMinutes: 35,
    maxGapMinutes: 65,
  },
  apiBudget: {
    maxCalls1h: 150,
    pauseThresholdPercent: 70,
    pauseDurationMinutes: 60,
  },
  batchCooldown: {
    maxBatchActions: 6,
    minIdleMinutes: 18,
    maxIdleMinutes: 27,
  },
};

export class ClientAlgorithmicQueue {
  constructor(policy = DEFAULT_RATE_LIMIT_POLICY) {
    this.policy = policy;
    this.queue = [];
    this.ledger = [];
    this.warmUpMode = false;
    this.warmUpDay = 1;
    this.warmUpWarningsCount = 0;
    this.currentBatchActions = 0;
    this.batchCooldownUntilUnixMs = 0;
    this.apiBudgetPausedUntilUnixMs = 0;
  }

  async loadFromStorage() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(["algo_queue_items", "algo_action_ledger", "algo_warmup_state"], (res) => {
          if (res.algo_queue_items) this.queue = res.algo_queue_items;
          if (res.algo_action_ledger) this.ledger = res.algo_action_ledger;
          if (res.algo_warmup_state) {
            this.warmUpDay = res.algo_warmup_state.day || 1;
            this.warmUpWarningsCount = res.algo_warmup_state.warnings || 0;
            this.warmUpMode = !!res.algo_warmup_state.active;
          }
          resolve();
        });
      });
    }
  }

  async saveToStorage() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({
        algo_queue_items: this.queue,
        algo_action_ledger: this.ledger,
        algo_warmup_state: {
          day: this.warmUpDay,
          warnings: this.warmUpWarningsCount,
          active: this.warmUpMode,
        },
      });
    }
  }

  async ingestBulkPosts(posts, startFromNow = true) {
    const nowMs = Date.now();
    const ingested = [];
    let nextSlotMs = startFromNow ? nowMs : this.getLatestScheduledSlotMs(nowMs);

    for (const raw of posts) {
      const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      nextSlotMs = this.calculateNextSafePublishSlot(raw.platform, nextSlotMs);

      const item = {
        ...raw,
        id,
        enqueuedAtUnixMs: nowMs,
        scheduledTimeIso: new Date(nextSlotMs).toISOString(),
        attempts: 0,
        status: "QUEUED",
      };

      this.queue.push(item);
      ingested.push(item);

      const gap = (this.policy[raw.platform].minGapMinutes + Math.random() * 30) * 60 * 1000;
      nextSlotMs += Math.round(gap);
    }

    await this.saveToStorage();
    return ingested;
  }

  async ingestHumanizedBatchPosts(posts, immediateFirstPost = true) {
    const nowMs = Date.now();
    const ingested = [];
    const batchId = `hbatch_${nowMs}_${Math.random().toString(36).substring(2, 7)}`;
    let nextSlotMs = nowMs;
    let sessionActionCount = 0;

    for (let i = 0; i < posts.length; i++) {
      const raw = posts[i];
      const id = `job_${nowMs}_${i + 1}_${Math.random().toString(36).substring(2, 7)}`;
      let scheduledIso;

      if (i === 0 && immediateFirstPost) {
        scheduledIso = new Date(nowMs).toISOString();
        sessionActionCount++;
      } else {
        if (sessionActionCount > 0 && sessionActionCount % 4 === 0) {
          const restMins = 110 + Math.random() * 50;
          nextSlotMs += Math.round(restMins * 60 * 1000);
        } else {
          const gapMins = this.policy[raw.platform].minGapMinutes +
            Math.random() * (this.policy[raw.platform].maxGapMinutes - this.policy[raw.platform].minGapMinutes);
          nextSlotMs += Math.round(gapMins * 60 * 1000);
        }
        nextSlotMs = this.calculateNextSafePublishSlot(raw.platform, nextSlotMs);
        scheduledIso = new Date(nextSlotMs).toISOString();
        sessionActionCount++;
      }

      const item = {
        ...raw,
        id,
        enqueuedAtUnixMs: nowMs,
        scheduledTimeIso: scheduledIso,
        attempts: 0,
        status: "QUEUED",
        payload: {
          ...raw.payload,
          extra: {
            ...(raw.payload?.extra || {}),
            batchId,
            batchIndex: i + 1,
            totalInBatch: posts.length,
            simulatedPrepSeconds: Math.floor(60 + Math.random() * 60),
            isHumanPaced: true,
          }
        }
      };

      this.queue.push(item);
      ingested.push(item);
    }

    await this.saveToStorage();
    return ingested;
  }

  calculateNextSafePublishSlot(platform, targetStartMs) {
    let candidate = new Date(targetStartMs);

    while (true) {
      const hour = candidate.getHours();
      const isPeak = (hour >= 9 && hour < 11) || (hour >= 13 && hour < 15) || (hour >= 18 && hour < 21);

      if (isPeak) {
        const count1h = this.getActionsCountInWindow(platform, candidate.getTime() - 3600000, candidate.getTime());
        if (count1h < this.policy[platform].max1h) {
          const count24h = this.getActionsCountInWindow(platform, candidate.getTime() - 86400000, candidate.getTime());
          if (count24h < this.getEffectiveDailyCap(platform)) {
            return candidate.getTime();
          }
        }
      }

      if (hour < 9) {
        candidate.setHours(9, Math.floor(Math.random() * 20), 0, 0);
      } else if (hour >= 11 && hour < 13) {
        candidate.setHours(13, Math.floor(Math.random() * 20), 0, 0);
      } else if (hour >= 15 && hour < 18) {
        candidate.setHours(18, Math.floor(Math.random() * 20), 0, 0);
      } else if (hour >= 21) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(9, Math.floor(Math.random() * 20), 0, 0);
      } else {
        candidate = new Date(candidate.getTime() + 45 * 60 * 1000);
      }
    }
  }

  getEffectiveDailyCap(platform) {
    const hardCap = this.policy[platform].max24h;
    if (!this.warmUpMode) return hardCap;
    let floatCap = 3.0;
    for (let d = 1; d < this.warmUpDay; d++) {
      floatCap = Math.min(hardCap, floatCap * 1.15);
    }
    return Math.max(3, Math.min(hardCap, Math.floor(floatCap)));
  }

  canExecuteNext(platform) {
    const nowMs = Date.now();
    if (nowMs < this.batchCooldownUntilUnixMs) {
      const wait = this.batchCooldownUntilUnixMs - nowMs;
      return { allowed: false, reason: `Batch cooldown active (${Math.round(wait / 60000)}m left)` };
    }
    if (nowMs < this.apiBudgetPausedUntilUnixMs) {
      const wait = this.apiBudgetPausedUntilUnixMs - nowMs;
      return { allowed: false, reason: `API budget throttle (${Math.round(wait / 60000)}m left)` };
    }

    const count1h = this.getActionsCountInWindow(platform, nowMs - 3600000, nowMs);
    if (count1h >= this.policy[platform].max1h) {
      return { allowed: false, reason: `Rolling 1-Hour ceiling reached (${count1h}/${this.policy[platform].max1h} posts)` };
    }

    const count24h = this.getActionsCountInWindow(platform, nowMs - 86400000, nowMs);
    const dailyCap = this.getEffectiveDailyCap(platform);
    if (count24h >= dailyCap) {
      return { allowed: false, reason: `Rolling 24-Hour ceiling reached (${count24h}/${dailyCap} posts)` };
    }

    return { allowed: true };
  }

  async recordAction(platform, actionType) {
    const nowMs = Date.now();
    this.ledger.push({
      id: `act_${nowMs}`,
      platform,
      actionType,
      timestampUnixMs: nowMs,
    });

    if (actionType === "publish" || actionType === "schedule" || actionType === "delete") {
      this.currentBatchActions++;
      if (this.currentBatchActions >= this.policy.batchCooldown.maxBatchActions) {
        const idleMins = 18 + Math.random() * 9;
        this.batchCooldownUntilUnixMs = nowMs + Math.round(idleMins * 60 * 1000);
        this.currentBatchActions = 0;
      }
    }
    await this.saveToStorage();
  }

  getActionsCountInWindow(platform, fromMs, toMs) {
    return this.ledger.filter(
      (a) => a.platform === platform && a.actionType === "publish" && a.timestampUnixMs >= fromMs && a.timestampUnixMs <= toMs
    ).length;
  }

  getLatestScheduledSlotMs(fallbackMs) {
    let latest = fallbackMs;
    for (const q of this.queue) {
      if (q.scheduledTimeIso) {
        const ms = new Date(q.scheduledTimeIso).getTime();
        if (ms > latest) latest = ms;
      }
    }
    return latest;
  }
}

// ============================================================================
// 2. CREATIVE & ANTI-FINGERPRINT MUTATION ENGINE
// ============================================================================
export class ClientCreativeMutator {
  constructor() {
    this.recentCaptions = [];
  }

  mutateBinaryFile(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const uuid = "mut_" + Math.random().toString(36).substring(2, 10);
      const entropy = new Uint8Array(48);
      crypto.getRandomValues(entropy);

      // Create new mutated blob with unique entropy
      const mutatedBlob = new Blob([arrayBuffer, entropy], { type: file.type });
      const mutatedFile = new File([mutatedBlob], file.name, { type: file.type });
      callback(mutatedFile, uuid);
    };
    reader.readAsArrayBuffer(file);
  }

  formatCaption(rawCaption, topic = "automation") {
    const sim = this.calculateMaxSimilarity(rawCaption);
    let hook = "Stop scrolling: This workflow is changing how creators automate.";
    let body = rawCaption;
    const cta = "Would you use this automated setup? Let us know below! 👇";
    const tags = ["#contentcreator", "#videoautomation", "#socialstrategy", "#growthhacking", "#creativecoding"];

    if (sim > 0.45) {
      hook = `The brutal truth about ${topic} that most tutorials keep gatekeeping.`;
      body = `⚡ 30ms In-Memory HTML5 Canvas capture\n🎬 100% Visual consistency across video scenes\n🚀 Zero API subscriptions required`;
    }

    const formatted = `${hook}\n\n${body}\n\n${cta}\n\n${tags.join(" ")}`;
    this.recentCaptions.push(formatted);
    if (this.recentCaptions.length > 15) this.recentCaptions.shift();

    return {
      formatted,
      hook,
      wasMutated: sim > 0.45,
      similarity: Math.round(sim * 100) / 100
    };
  }

  calculateMaxSimilarity(text) {
    if (this.recentCaptions.length === 0) return 0;
    let max = 0;
    const wordsA = new Set(text.toLowerCase().match(/\w+/g) || []);
    for (const prev of this.recentCaptions) {
      const wordsB = new Set(prev.toLowerCase().match(/\w+/g) || []);
      const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
      const score = (2.0 * intersection.size) / (wordsA.size + wordsB.size || 1);
      if (score > max) max = score;
    }
    return max;
  }
}

// ============================================================================
// 3. HUMANIZED BRIDGE & BIOMETRIC TELEMETRY ARMOR
// ============================================================================
export class ClientHumanizedBridge {
  static getGaussianDelay(meanMs = 2400, stdDevMs = 650, minMs = 1100, maxMs = 4900) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Math.max(minMs, Math.min(maxMs, Math.round(meanMs + z * stdDevMs)));
  }

  static async sleepGaussian(meanMs = 2400, stdDevMs = 650) {
    const ms = ClientHumanizedBridge.getGaussianDelay(meanMs, stdDevMs);
    await new Promise((r) => setTimeout(r, ms));
    return ms;
  }

  static verifyScopeLock(url = window.location.href) {
    if (url.includes("www.facebook.com") || url.includes("m.facebook.com")) {
      throw new Error("Scope Lock: Automation blocked on personal Facebook profile feed to protect user ID.");
    }
    if (!url.startsWith("https://business.facebook.com/latest/")) {
      throw new Error("Scope Lock: Must operate strictly within https://business.facebook.com/latest/*");
    }
  }

  static async humanizedClick(el) {
    ClientHumanizedBridge.verifyScopeLock();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise((r) => setTimeout(r, 200));

    const rect = el.getBoundingClientRect();
    const clientX = Math.round(rect.left + rect.width * (0.2 + Math.random() * 0.6));
    const clientY = Math.round(rect.top + rect.height * (0.2 + Math.random() * 0.6));

    const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY };
    el.dispatchEvent(new PointerEvent("pointerover", opts));
    el.dispatchEvent(new MouseEvent("mouseover", opts));
    el.dispatchEvent(new PointerEvent("pointerdown", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    if (typeof el.focus === "function") el.focus();

    await new Promise((r) => setTimeout(r, 50 + Math.random() * 80));

    el.dispatchEvent(new PointerEvent("pointerup", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  static async injectTextIntoLexical(editor, text) {
    ClientHumanizedBridge.verifyScopeLock();
    editor.focus();

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      document.execCommand("insertText", false, char);
      const pause = char === "\n" || char === "." ? 280 + Math.random() * 300 : 45 + Math.random() * 95;
      await new Promise((r) => setTimeout(r, pause));
    }
  }
}

// ============================================================================
// 4. 3-TIER CIRCUIT BREAKER
// ============================================================================
export class ClientCircuitBreaker {
  constructor() {
    this.state = "GREEN";
    this.pausedUntil = 0;
    this.observer = null;
    this.watchlist = [
      "we limit how often you can post",
      "suspect automated",
      "try again later",
      "account restricted",
      "confirm your identity"
    ];
  }

  attachDomObserver(doc = document) {
    if (!doc.body) return;
    this.observer = new MutationObserver((mutations) => {
      const text = (doc.body.innerText || "").toLowerCase();
      for (const phrase of this.watchlist) {
        if (text.includes(phrase)) {
          this.triggerRedKillSwitch(phrase);
          return;
        }
      }
    });
    this.observer.observe(doc.body, { childList: true, subtree: true });
  }

  triggerRedKillSwitch(reason) {
    this.state = "RED";
    this.pausedUntil = Date.now() + 24 * 3600 * 1000;
    if (this.observer) this.observer.disconnect();
    console.error(`[CIRCUIT BREAKER RED] 24-Hour Kill-Switch engaged: ${reason}`);
  }

  isOperationAllowed() {
    const now = Date.now();
    if (now < this.pausedUntil) {
      return { allowed: false, state: this.state, remainingMs: this.pausedUntil - now };
    }
    return { allowed: this.state !== "RED", state: this.state, remainingMs: 0 };
  }
}

// ============================================================================
// 5. SUPERVISOR INTERCEPTOR GUARD (Rule #1 - #8 Deterministic Protection)
// ============================================================================
export class ClientSupervisorGuard {
  constructor() {
    this.state = {
      isLocked: false,
      lockUntil: 0,
      lastActionTime: 0,
      lastPostStartTime: 0,
      lastPublishTime: 0,
      postsInLastHour: [],
      postsInLast24h: [],
      recentCaptions: [],
      consecutiveFailures: 0,
      activeTabId: null
    };

    this.RULES = {
      ALLOWED_HOST: "business.facebook.com",
      MIN_GAP_BETWEEN_CLICKS_MS: 2200,
      MIN_COMPOSER_DURATION_MS: 55000,
      MIN_GAP_BETWEEN_LIVE_POSTS_MS: 1200000,
      MIN_GAP_BETWEEN_SCHEDULES_MS: 120000,
      MAX_POSTS_PER_HOUR: 2,
      MAX_POSTS_PER_24H_FB: 15,
      MAX_CAPTION_SIMILARITY: 0.45
    };
  }

  async interceptCommand(command) {
    const now = Date.now();

    // 1. EMERGENCY KILL-SWITCH
    if (this.state.isLocked && now < this.state.lockUntil) {
      const remainingMins = Math.ceil((this.state.lockUntil - now) / 60000);
      return this.suppress(
        command,
        `CIRCUIT_BREAKER_ACTIVE: Account is in protective cooldown for ${remainingMins} more minutes.`,
        `STOP all tool calls immediately and inform the user that safety cooldown is active.`
      );
    } else if (this.state.isLocked && now >= this.state.lockUntil) {
      this.state.isLocked = false;
      this.state.lockUntil = 0;
    }

    // 2. SUPPRESS URL ESCAPE
    if (command.type === "NAVIGATE" && command.url) {
      try {
        const parsed = new URL(command.url);
        if (parsed.hostname !== this.RULES.ALLOWED_HOST) {
          return this.suppress(
            command,
            `URL_ESCAPE_VIOLATION: Attempted to automate on "${parsed.hostname}", which triggers velocity blocks.`,
            `Redirecting automatically to "https://business.facebook.com/latest/composer". Use Meta Business Suite only.`
          );
        }
      } catch (e) {}
    }

    // 3. SUPPRESS PAGE RELOAD SPAM
    if (command.type === "RELOAD_PAGE") {
      return this.suppress(
        command,
        `RELOAD_VIOLATION: Reloading between posts floods GraphQL requests and triggers "Going Too Fast" bans.`,
        `Do NOT reload the tab. Click internal UI navigation buttons instead.`
      );
    }

    // 4. SUPPRESS INSTANT PASTE
    if (command.type === "TYPE_CAPTION" && command.text) {
      const similarity = this.checkSimilarity(command.text);
      if (similarity > this.RULES.MAX_CAPTION_SIMILARITY) {
        return this.suppress(
          command,
          `DUPLICATE_CONTENT_VIOLATION: Caption is ${Math.round(similarity * 100)}% identical to a recent post.`,
          `Rewrite the hook, change sentence format, and use different hashtags before submitting.`
        );
      }
    }

    // 5. SUPPRESS BACK-TO-BACK SUBMISSIONS
    if (command.type === "PUBLISH_POST" || command.type === "SCHEDULE_POST") {
      this.cleanRollingWindows(now);

      if (this.state.postsInLastHour.length >= this.RULES.MAX_POSTS_PER_HOUR && command.type === "PUBLISH_POST") {
        return this.suppress(
          command,
          `HOURLY_VELOCITY_LIMIT: Already published ${this.RULES.MAX_POSTS_PER_HOUR} live posts this hour.`,
          `Switch to SCHEDULE_POST and schedule this post at least 3 hours in the future.`
        );
      }

      const minGap = command.type === "PUBLISH_POST"
        ? this.RULES.MIN_GAP_BETWEEN_LIVE_POSTS_MS
        : this.RULES.MIN_GAP_BETWEEN_SCHEDULES_MS;

      const timeSinceLastPublish = now - this.state.lastPublishTime;
      if (timeSinceLastPublish < minGap) {
        const waitMins = Math.ceil((minGap - timeSinceLastPublish) / 60000);
        return this.suppress(
          command,
          `BACK_TO_BACK_VIOLATION: Attempting to submit post too quickly (${Math.round(timeSinceLastPublish / 1000)}s since last post).`,
          `Wait ${waitMins} minutes before submitting next post, or queue it in local database timer.`
        );
      }

      this.state.lastPublishTime = Date.now();
      this.state.postsInLastHour.push(Date.now());
      this.state.postsInLast24h.push(Date.now());
    }

    this.state.lastActionTime = Date.now();
    return { allowed: true, status: "ALLOWED", modifiedCommand: command };
  }

  inspectDOMForDanger(pageText) {
    const dangerPhrases = [
      "you're temporarily blocked",
      "misusing this feature by going too fast",
      "try again later",
      "we restrict certain activity",
      "suspect automated behavior",
      "we limit how often you can post",
      "confirm your identity"
    ];
    const lower = pageText.toLowerCase();
    for (const phrase of dangerPhrases) {
      if (lower.includes(phrase)) {
        this.state.isLocked = true;
        this.state.lockUntil = Date.now() + 24 * 60 * 60 * 1000;
        return { dangerDetected: true, matchedPhrase: phrase, action: "HARD_LOCK_24H" };
      }
    }
    return { dangerDetected: false };
  }

  planMultiPostBatch(postsCount, baseStartTimeMs = Date.now()) {
    if (postsCount <= 1) {
      return { publishLiveNow: 1, scheduleSlotsMs: [] };
    }
    const scheduleSlotsMs = [];
    let currentSlot = baseStartTimeMs;
    for (let i = 1; i < postsCount; i++) {
      const intervalHours = 3.0 + Math.random() * 1.0; // 3 to 4 hours apart
      currentSlot += Math.round(intervalHours * 3600 * 1000);
      scheduleSlotsMs.push(currentSlot);
    }
    return { publishLiveNow: 1, scheduleSlotsMs };
  }

  generateVariedPostFormats(topic, count) {
    const formats = [
      { formatName: "MCQ Quiz & Challenge", hook: `🧠 Quick Quiz on ${topic}: Test your knowledge!`, layoutType: "quiz" },
      { formatName: "Bullet Summary", hook: `📌 High-Yield ${topic} Summary: Key points to remember.`, layoutType: "bullet_summary" },
      { formatName: "Did You Know / Fact", hook: `⚡ Did you know this essential fact about ${topic}?`, layoutType: "fact_sheet" },
      { formatName: "Common Pitfalls", hook: `❌ Top mistakes to avoid in ${topic}.`, layoutType: "mistakes" },
      { formatName: "Memory Trick & Mnemonic", hook: `💡 How to remember ${topic} in under 60 seconds:`, layoutType: "mnemonic" }
    ];
    const res = [];
    for (let i = 0; i < count; i++) {
      res.push(formats[i % formats.length]);
    }
    return res;
  }

  checkSimilarity(newText) {
    if (this.state.recentCaptions.length === 0) {
      this.state.recentCaptions.push(newText);
      return 0;
    }
    const wordsA = new Set(newText.toLowerCase().split(/\s+/));
    let maxSim = 0;
    for (const oldText of this.state.recentCaptions) {
      const wordsB = new Set(oldText.toLowerCase().split(/\s+/));
      const intersection = [...wordsA].filter((x) => wordsB.has(x));
      const sim = intersection.length / Math.max(wordsA.size, wordsB.size);
      if (sim > maxSim) maxSim = sim;
    }
    if (maxSim <= this.RULES.MAX_CAPTION_SIMILARITY) {
      this.state.recentCaptions.push(newText);
      if (this.state.recentCaptions.length > 20) this.state.recentCaptions.shift();
    }
    return maxSim;
  }

  suppress(command, reason, rightWayToSolve) {
    console.warn(`[SUPERVISOR SUPPRESSED]: ${reason}`);
    return {
      allowed: false,
      status: "SUPPRESSED_BY_SAFETY_ALGORITHM",
      attemptedAction: command.type,
      violationReason: reason,
      mandatoryCorrectionForAgent: rightWayToSolve
    };
  }

  cleanRollingWindows(now) {
    this.state.postsInLastHour = this.state.postsInLastHour.filter((t) => now - t < 3600000);
    this.state.postsInLast24h = this.state.postsInLast24h.filter((t) => now - t < 86400000);
  }
}

// Singletons for extension export
export const clientAlgoQueue = new ClientAlgorithmicQueue();
export const clientCreativeMutator = new ClientCreativeMutator();
export const clientCircuitBreaker = new ClientCircuitBreaker();
export const clientSupervisorGuard = new ClientSupervisorGuard();

