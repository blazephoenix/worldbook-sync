// src/canonical.ts
function canonicalizeFranchise(raw) {
  const normalized = raw.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return normalized.replace(/^the\s+/, "");
}

// src/books.ts
var BOOK_PREFIX = "Universe - ";
function universeBookName(display) {
  const safe = display.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return `${BOOK_PREFIX}${safe}`;
}

// src/detection.ts
var NON_FRANCHISE_SENTINELS = /* @__PURE__ */ new Set(["", "none", "null", "n/a", "na", "unknown", "original"]);
function extractJsonObject(raw) {
  const withoutFences = raw.replace(/```(?:json)?/gi, "");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("parseDetectionResponse: no JSON object found in response");
  }
  return JSON.parse(withoutFences.slice(start, end + 1));
}
function parseDetectionResponse(raw) {
  const parsed = extractJsonObject(raw);
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("parseDetectionResponse: response is not a JSON object");
  }
  const obj = parsed;
  const verdict = typeof obj.verdict === "string" ? obj.verdict.trim().toLowerCase() : void 0;
  const name = typeof obj.franchise === "string" ? obj.franchise.trim() : "";
  if (verdict === "multiversal") return { kind: "multiversal" };
  if (verdict === "original") return { kind: "original" };
  const looksLikeFranchise = verdict === "franchise" || verdict === void 0 && name !== "";
  if (looksLikeFranchise) {
    if (NON_FRANCHISE_SENTINELS.has(name.toLowerCase())) return { kind: "original" };
    const canonical = canonicalizeFranchise(name);
    if (canonical === "") return { kind: "original" };
    return { kind: "franchise", display: name, canonical };
  }
  return { kind: "original" };
}
var clip = (s, n) => s ? s.slice(0, n) : "";
function buildDetectionPrompt(input) {
  const tags = input.tags && input.tags.length > 0 ? input.tags.join(", ") : "(none)";
  return [
    "You are identifying which existing fictional FRANCHISE a roleplay character belongs to.",
    "A franchise is a recognizable published work or shared universe",
    '(e.g. "The Witcher", "Cyberpunk 2077", "Naruto", "Star Wars").',
    "",
    "Rules:",
    "- If the character clearly belongs to a well-known franchise, return its shortest canonical name.",
    '- If the character is original or not from any recognizable franchise, use verdict "original".',
    "- If the character is explicitly a cross-universe / world-hopping character with no single home,",
    '  use verdict "multiversal".',
    '- Do not guess wildly. When unsure, prefer "original".',
    "",
    "Respond with ONLY a JSON object \u2014 no prose, no code fence \u2014 in exactly this shape:",
    '{"verdict": "franchise" | "original" | "multiversal", "franchise": "<canonical name>" | null}',
    "",
    "--- CHARACTER ---",
    `Name: ${input.name}`,
    `Tags: ${tags}`,
    `Description: ${clip(input.description, 1500)}`,
    `Personality: ${clip(input.personality, 500)}`,
    `Scenario: ${clip(input.scenario, 500)}`
  ].join("\n");
}
async function detectFranchise(ctx, character) {
  const prompt = buildDetectionPrompt({
    name: character.name,
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    tags: character.tags ?? character.data?.tags
  });
  const maxAttempts = 2;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const raw = await ctx.generateQuietPrompt(prompt, false, true);
    try {
      return parseDetectionResponse(raw);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `detectFranchise: no parseable verdict after ${maxAttempts} attempts (${String(lastError)})`
  );
}

// src/settings.ts
var DEFAULT_SETTINGS = {
  enabled: true,
  autoBuild: false,
  bookDepth: 12,
  connectionProfile: null,
  verdicts: {},
  registry: {},
  ownership: {},
  backups: {}
};
function mergeSettings(stored) {
  return {
    enabled: stored.enabled ?? DEFAULT_SETTINGS.enabled,
    autoBuild: stored.autoBuild ?? DEFAULT_SETTINGS.autoBuild,
    bookDepth: stored.bookDepth ?? DEFAULT_SETTINGS.bookDepth,
    connectionProfile: stored.connectionProfile ?? DEFAULT_SETTINGS.connectionProfile,
    verdicts: { ...stored.verdicts ?? {} },
    registry: { ...stored.registry ?? {} },
    ownership: { ...stored.ownership ?? {} },
    backups: { ...stored.backups ?? {} }
  };
}
var MODULE_KEY = "worldbook-sync";
function loadSettings(ctx) {
  const raw = ctx.extensionSettings[MODULE_KEY] ?? {};
  const merged = mergeSettings(raw);
  ctx.extensionSettings[MODULE_KEY] = merged;
  return merged;
}
function persistSettings(ctx) {
  ctx.saveSettingsDebounced();
}

// src/ui.ts
var STYLE_ID = "wbs-styles";
function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .wbs-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10050;
      display: flex; align-items: center; justify-content: center; }
    .wbs-card { background: var(--SmartThemeBlurTintColor, #23272a); color: var(--SmartThemeBodyColor, #ddd);
      border: 1px solid var(--SmartThemeBorderColor, #444); border-radius: 10px; padding: 18px 20px;
      width: min(460px, 92vw); box-shadow: 0 8px 30px rgba(0,0,0,0.5); font-size: 0.95em; }
    .wbs-card h3 { margin: 0 0 8px; font-size: 1.05em; }
    .wbs-card p { margin: 0 0 10px; opacity: 0.85; }
    .wbs-card input[type=text] { width: 100%; box-sizing: border-box; padding: 7px 9px; margin-bottom: 14px;
      background: var(--black30a, rgba(0,0,0,0.3)); color: inherit;
      border: 1px solid var(--SmartThemeBorderColor, #555); border-radius: 6px; }
    .wbs-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .wbs-btn { cursor: pointer; padding: 7px 12px; border-radius: 6px; border: 1px solid var(--SmartThemeBorderColor, #555);
      background: var(--black30a, rgba(0,0,0,0.25)); color: inherit; }
    .wbs-btn.primary { background: var(--SmartThemeQuoteColor, #4a90d9); border-color: transparent; color: #fff; }
    .wbs-btn.ghost { opacity: 0.75; }
    .wbs-panel .wbs-field { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
    .wbs-panel .wbs-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .wbs-panel input[type=number] { width: 70px; }
  `;
  document.head.appendChild(style);
}
function confirmVerdict(characterName, verdict) {
  injectStylesOnce();
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "wbs-overlay";
    const prefill = verdict.kind === "franchise" ? verdict.display : "";
    overlay.innerHTML = `
      <div class="wbs-card" role="dialog" aria-modal="true">
        <h3>Worldbook Sync \u2014 universe for "${escapeHtml(characterName)}"</h3>
        <p>Detected franchise (edit if wrong):</p>
        <input type="text" class="wbs-input" placeholder="e.g. The Witcher" />
        <div class="wbs-row">
          <button class="wbs-btn ghost" data-act="cancel">Cancel</button>
          <button class="wbs-btn ghost" data-act="multiversal">Multiversal</button>
          <button class="wbs-btn ghost" data-act="original">Original / none</button>
          <button class="wbs-btn primary" data-act="franchise">Use this franchise</button>
        </div>
      </div>`;
    const input = overlay.querySelector(".wbs-input");
    input.value = prefill;
    const finish = (result) => {
      overlay.remove();
      resolve(result);
    };
    overlay.addEventListener("click", (e) => {
      const target = e.target;
      if (target === overlay) return finish({ action: "cancel" });
      const act = target.dataset.act;
      if (!act) return;
      if (act === "franchise") {
        const display = input.value.trim();
        finish(display ? { action: "franchise", display } : { action: "original" });
      } else if (act === "original") finish({ action: "original" });
      else if (act === "multiversal") finish({ action: "multiversal" });
      else finish({ action: "cancel" });
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const display = input.value.trim();
        finish(display ? { action: "franchise", display } : { action: "original" });
      } else if (e.key === "Escape") finish({ action: "cancel" });
    });
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}
function renderSettingsPanel(state, handlers) {
  injectStylesOnce();
  const container = document.getElementById("extensions_settings2") ?? document.getElementById("extensions_settings");
  if (!container) {
    console.warn("[worldbook-sync] extensions settings container not found; panel not rendered");
    return;
  }
  if (document.getElementById("wbs-panel")) return;
  const drawer = document.createElement("div");
  drawer.id = "wbs-panel";
  drawer.className = "inline-drawer wbs-panel";
  drawer.innerHTML = `
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>Worldbook Sync</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <label class="wbs-field"><input type="checkbox" id="wbs-enabled" /> Enabled</label>
      <label class="wbs-field"><input type="checkbox" id="wbs-autobuild" />
        Auto-build a universe book on first engage</label>
      <label class="wbs-field">Book depth (entries)
        <input type="number" id="wbs-depth" min="4" max="40" step="1" /></label>
      <div class="wbs-actions">
        <button class="wbs-btn" id="wbs-redetect">Re-detect franchise</button>
        <button class="wbs-btn primary" id="wbs-build">Build / regenerate book</button>
        <button class="wbs-btn ghost" id="wbs-restore">Restore last backup</button>
      </div>
      <p style="opacity:0.7;margin-top:10px;font-size:0.85em;">
        Acts on the currently open character. Uses your active LLM connection.</p>
    </div>`;
  container.appendChild(drawer);
  const enabled = drawer.querySelector("#wbs-enabled");
  const autoBuild = drawer.querySelector("#wbs-autobuild");
  const depth = drawer.querySelector("#wbs-depth");
  enabled.checked = state.enabled;
  autoBuild.checked = state.autoBuild;
  depth.value = String(state.bookDepth);
  enabled.addEventListener("change", () => handlers.onEnabledChange(enabled.checked));
  autoBuild.addEventListener("change", () => handlers.onAutoBuildChange(autoBuild.checked));
  depth.addEventListener("change", () => {
    const n = Number(depth.value);
    if (Number.isFinite(n) && n > 0) handlers.onDepthChange(Math.round(n));
  });
  drawer.querySelector("#wbs-redetect").addEventListener("click", () => handlers.onRedetect());
  drawer.querySelector("#wbs-build").addEventListener("click", () => handlers.onBuildOrRegenerate());
  drawer.querySelector("#wbs-restore").addEventListener("click", () => handlers.onRestore());
  drawer.querySelector(".inline-drawer-toggle").addEventListener("click", () => {
    drawer.querySelector(".inline-drawer-content").classList.toggle("open");
    drawer.querySelector(".inline-drawer-icon").classList.toggle("down");
    drawer.querySelector(".inline-drawer-icon").classList.toggle("up");
  });
}
function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

// src/generation.ts
function coerceEntry(x) {
  if (!x || typeof x !== "object") return null;
  const o = x;
  const title = typeof o.title === "string" ? o.title.trim() : typeof o.comment === "string" ? o.comment.trim() : "";
  const content = typeof o.content === "string" ? o.content.trim() : "";
  const rawKeys = Array.isArray(o.keys) ? o.keys : Array.isArray(o.key) ? o.key : [];
  const keys = [
    ...new Set(
      rawKeys.filter((k) => typeof k === "string").map((k) => k.trim()).filter(Boolean)
    )
  ];
  if (!title || !content || keys.length === 0) return null;
  return { title, keys, content };
}
function extractEntriesArray(raw) {
  const stripped = raw.replace(/```(?:json)?/gi, "").trim();
  const lb = stripped.indexOf("[");
  const rb = stripped.lastIndexOf("]");
  const lc = stripped.indexOf("{");
  const rc = stripped.lastIndexOf("}");
  let jsonText;
  if (lb !== -1 && rb > lb) jsonText = stripped.slice(lb, rb + 1);
  else if (lc !== -1 && rc > lc) jsonText = stripped.slice(lc, rc + 1);
  else throw new Error("parseGenerationResponse: no JSON array or object found");
  const parsed = JSON.parse(jsonText);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.entries)) {
    return parsed.entries;
  }
  throw new Error("parseGenerationResponse: expected an array of entries");
}
function parseGenerationResponse(raw) {
  return extractEntriesArray(raw).map(coerceEntry).filter((e) => e !== null);
}
function buildGenerationPrompt(franchiseDisplay, targetCount) {
  return [
    `You are writing a shared WORLD-LORE reference for the "${franchiseDisplay}" universe,`,
    "to be used as SillyTavern World Info shared across characters from that setting.",
    "",
    "Produce concise, factual, WORLD-level lore only \u2014 factions, locations, technology, history,",
    "core rules, and major recurring characters of the setting. Do NOT write about any single",
    'roleplay character, and do NOT invent deep-cut "canon": stick to well-established facts you',
    "are confident about. Prefer fewer accurate entries over many shaky ones.",
    "",
    `Write about ${targetCount} entries (a focused core, not an exhaustive wiki).`,
    "For each entry:",
    '- "title": a short human label (not shown to the AI).',
    '- "keys": trigger keywords \u2014 proper nouns, common synonyms, and plurals people would actually',
    "  type. Avoid generic words. These decide when the entry is injected.",
    '- "content": 1\u20134 concise sentences of prose. No bracket/attribute-list formatting.',
    "",
    "Respond with ONLY a JSON array \u2014 no prose, no code fence \u2014 of objects:",
    '[{"title": "...", "keys": ["...", "..."], "content": "..."}]'
  ].join("\n");
}
async function generateUniverseEntries(ctx, franchiseDisplay, targetCount) {
  const prompt = buildGenerationPrompt(franchiseDisplay, targetCount);
  const maxAttempts = 2;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const raw = await ctx.generateQuietPrompt(prompt, false, true, void 0, void 0, 2048);
    try {
      const entries = parseGenerationResponse(raw);
      if (entries.length > 0) return entries;
      lastError = new Error("generation returned an empty entry list");
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `generateUniverseEntries: no usable entries after ${maxAttempts} attempts (${String(lastError)})`
  );
}

// src/host.ts
var moduleCache;
async function loadWorldInfoModule() {
  if (moduleCache !== void 0) return moduleCache;
  try {
    moduleCache = await import("../../../world-info.js");
  } catch (error) {
    console.warn(
      "[worldbook-sync] could not import world-info.js \u2014 some actions will be unavailable",
      error
    );
    moduleCache = null;
  }
  return moduleCache;
}
async function getCreateEntry(ctx) {
  if (typeof ctx.createWorldInfoEntry === "function") {
    const fn = ctx.createWorldInfoEntry;
    return (name, data) => fn.call(ctx, name, data);
  }
  const mod = await loadWorldInfoModule();
  return mod?.createWorldInfoEntry ?? null;
}
async function getLinkAux(_ctx) {
  const mod = await loadWorldInfoModule();
  return mod?.charUpdateAddAuxWorld ?? null;
}

// src/ownership.ts
function normalize(content) {
  return content.replace(/\r\n/g, "\n").trim();
}
function hashContent(content) {
  const s = normalize(content);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function planRegeneration(ownedHashes, currentEntries) {
  const plan = { removableUids: [], releasedUids: [], vanishedUids: [] };
  for (const [uid, storedHash] of Object.entries(ownedHashes)) {
    const entry = currentEntries[uid];
    if (!entry) {
      plan.vanishedUids.push(uid);
    } else if (hashContent(entry.content) === storedHash) {
      plan.removableUids.push(uid);
    } else {
      plan.releasedUids.push(uid);
    }
  }
  return plan;
}

// src/worldbook.ts
function entryFieldsFor(gen) {
  return {
    key: [...gen.keys],
    keysecondary: [],
    comment: gen.title,
    content: gen.content,
    constant: false,
    vectorized: false,
    selective: false,
    disable: false,
    matchWholeWords: true,
    order: 100,
    position: 0,
    probability: 100,
    useProbability: false,
    // Also scan the character's own card text (ADR-0005) so entries can fire from it.
    matchCharacterDescription: true,
    matchCharacterPersonality: true,
    matchScenario: true
  };
}
async function ensureBook(ctx, bookName) {
  const names = ctx.getWorldInfoNames?.() ?? [];
  if (names.includes(bookName)) return true;
  await ctx.saveWorldInfo(bookName, { entries: {} }, true);
  await ctx.updateWorldInfoList();
  return false;
}
async function linkAuxBook(ctx, characterAvatar, bookName) {
  const linkAux = await getLinkAux(ctx);
  if (!linkAux) {
    toastr.warning(
      `Couldn't auto-link "${bookName}". Link it to this character manually via the globe menu.`,
      "Worldbook Sync"
    );
    return false;
  }
  await linkAux(characterAvatar, bookName);
  return true;
}
async function backupBook(ctx, settings, bookName) {
  const data = await ctx.loadWorldInfo(bookName);
  if (!data) return;
  settings.backups[bookName] = { data: structuredClone(data), at: Date.now() };
}
async function appendEntries(ctx, settings, bookName, data, gen) {
  const createEntry = await getCreateEntry(ctx);
  if (!createEntry) {
    throw new Error("createWorldInfoEntry is unavailable (world-info.js import failed)");
  }
  const owned = settings.ownership[bookName] ?? (settings.ownership[bookName] = {});
  let added = 0;
  for (const g of gen) {
    const entry = createEntry(bookName, data);
    if (!entry) continue;
    Object.assign(entry, entryFieldsFor(g));
    entry.addMemo = true;
    owned[String(entry.uid)] = hashContent(g.content);
    added++;
  }
  return added;
}
function contentMap(entries) {
  const out = {};
  for (const [uid, entry] of Object.entries(entries)) {
    out[uid] = { content: String(entry.content ?? "") };
  }
  return out;
}
async function buildBook(ctx, settings, bookName, franchiseDisplay, depth) {
  const gen = await generateUniverseEntries(ctx, franchiseDisplay, depth);
  await backupBook(ctx, settings, bookName);
  const data = await ctx.loadWorldInfo(bookName) ?? { entries: {} };
  const added = await appendEntries(ctx, settings, bookName, data, gen);
  await ctx.saveWorldInfo(bookName, data);
  ctx.reloadWorldInfoEditor?.(bookName);
  persistSettings(ctx);
  return added;
}
async function regenerateBook(ctx, settings, bookName, franchiseDisplay, depth) {
  const createEntry = await getCreateEntry(ctx);
  if (!createEntry) {
    throw new Error("createWorldInfoEntry is unavailable (world-info.js import failed)");
  }
  const data = await ctx.loadWorldInfo(bookName);
  if (!data) throw new Error(`Universe book not found: ${bookName}`);
  await backupBook(ctx, settings, bookName);
  const owned = settings.ownership[bookName] ?? {};
  const plan = planRegeneration(owned, contentMap(data.entries));
  for (const uid of plan.removableUids) delete data.entries[uid];
  const gen = await generateUniverseEntries(ctx, franchiseDisplay, depth);
  const nextOwned = {};
  for (const g of gen) {
    const entry = createEntry(bookName, data);
    if (!entry) continue;
    Object.assign(entry, entryFieldsFor(g));
    entry.addMemo = true;
    nextOwned[String(entry.uid)] = hashContent(g.content);
  }
  settings.ownership[bookName] = nextOwned;
  await ctx.saveWorldInfo(bookName, data);
  ctx.reloadWorldInfoEditor?.(bookName);
  persistSettings(ctx);
  return gen.length;
}
async function restoreBackup(ctx, settings, bookName) {
  const backup = settings.backups[bookName];
  if (!backup) return false;
  await ctx.saveWorldInfo(bookName, structuredClone(backup.data), true);
  ctx.reloadWorldInfoEditor?.(bookName);
  return true;
}

// src/index.ts
var LOG = "[worldbook-sync]";
var busy = false;
function getCtx() {
  return SillyTavern.getContext();
}
function activeCharacter(ctx) {
  if (ctx.groupId) return null;
  const id = ctx.characterId;
  if (id === void 0 || id === null) return null;
  return ctx.characters[id] ?? null;
}
function resultToVerdict(result) {
  switch (result.action) {
    case "franchise":
      return { kind: "franchise", display: result.display, canonical: canonicalizeFranchise(result.display) };
    case "original":
      return { kind: "original" };
    case "multiversal":
      return { kind: "multiversal" };
    case "cancel":
      return null;
  }
}
async function ensureVerdict(ctx, settings, character, forceRedetect = false) {
  if (!forceRedetect) {
    const cached = settings.verdicts[character.avatar];
    if (cached) return cached.verdict;
  }
  let detected;
  try {
    detected = await detectFranchise(ctx, character);
  } catch (error) {
    console.warn(LOG, "detection failed; defaulting to original", error);
    detected = { kind: "original" };
  }
  const verdict = resultToVerdict(await confirmVerdict(character.name, detected));
  if (!verdict) return null;
  settings.verdicts[character.avatar] = { verdict, confirmedAt: Date.now() };
  persistSettings(ctx);
  return verdict;
}
function bookNameFor(settings, verdict) {
  if (verdict.kind !== "franchise") throw new Error("bookNameFor: verdict is not a franchise");
  const existing = settings.registry[verdict.canonical];
  if (existing) return existing;
  const name = universeBookName(verdict.display);
  settings.registry[verdict.canonical] = name;
  return name;
}
async function processCharacter(ctx, settings, character, forceRedetect = false) {
  const verdict = await ensureVerdict(ctx, settings, character, forceRedetect);
  if (!verdict || verdict.kind !== "franchise") return;
  const bookName = bookNameFor(settings, verdict);
  persistSettings(ctx);
  const existed = await ensureBook(ctx, bookName);
  await linkAuxBook(ctx, character.avatar, bookName);
  if (existed) return;
  if (settings.autoBuild) {
    toastr.info(`Building universe book "${bookName}"\u2026`, "Worldbook Sync");
    const added = await buildBook(ctx, settings, bookName, verdict.display, settings.bookDepth);
    toastr.success(`Added ${added} lore entries to "${bookName}".`, "Worldbook Sync");
  } else {
    toastr.info(
      `Linked "${bookName}". Use "Build" in Worldbook Sync settings to fill it.`,
      "Worldbook Sync"
    );
  }
}
function onChatChanged(settings) {
  if (!settings.enabled || busy) return;
  const ctx = getCtx();
  const character = activeCharacter(ctx);
  if (!character) return;
  busy = true;
  processCharacter(ctx, settings, character).catch((error) => {
    console.error(LOG, "processCharacter failed", error);
    toastr.error("Worldbook Sync hit an error \u2014 see the console.", "Worldbook Sync");
  }).finally(() => {
    busy = false;
  });
}
async function runAction(label, fn) {
  if (busy) {
    toastr.info("Worldbook Sync is busy \u2014 try again in a moment.", "Worldbook Sync");
    return;
  }
  busy = true;
  try {
    await fn();
  } catch (error) {
    console.error(LOG, `${label} failed`, error);
    toastr.error(`${label} failed \u2014 see the console.`, "Worldbook Sync");
  } finally {
    busy = false;
  }
}
function buildHandlers(settings) {
  const requireCharacter = () => {
    const ctx = getCtx();
    const character = activeCharacter(ctx);
    if (!character) {
      toastr.warning("Open a single character first (group chats not supported yet).", "Worldbook Sync");
      return null;
    }
    return { ctx, character };
  };
  return {
    onEnabledChange: (value) => {
      settings.enabled = value;
      persistSettings(getCtx());
    },
    onAutoBuildChange: (value) => {
      settings.autoBuild = value;
      persistSettings(getCtx());
    },
    onDepthChange: (value) => {
      settings.bookDepth = value;
      persistSettings(getCtx());
    },
    onRedetect: () => {
      const active = requireCharacter();
      if (active) {
        void runAction(
          "Re-detect",
          () => processCharacter(active.ctx, settings, active.character, true)
        );
      }
    },
    onBuildOrRegenerate: () => {
      const active = requireCharacter();
      if (!active) return;
      const { ctx, character } = active;
      void runAction("Build/regenerate", async () => {
        const verdict = await ensureVerdict(ctx, settings, character);
        if (!verdict || verdict.kind !== "franchise") {
          toastr.info("No franchise for this character \u2014 nothing to build.", "Worldbook Sync");
          return;
        }
        const bookName = bookNameFor(settings, verdict);
        persistSettings(ctx);
        const existed = await ensureBook(ctx, bookName);
        await linkAuxBook(ctx, character.avatar, bookName);
        const data = await ctx.loadWorldInfo(bookName);
        const hasEntries = existed && data && Object.keys(data.entries).length > 0;
        if (hasEntries) {
          toastr.info(`Regenerating "${bookName}" (your edits are preserved)\u2026`, "Worldbook Sync");
          const n = await regenerateBook(ctx, settings, bookName, verdict.display, settings.bookDepth);
          toastr.success(`Regenerated "${bookName}" with ${n} entries.`, "Worldbook Sync");
        } else {
          toastr.info(`Building "${bookName}"\u2026`, "Worldbook Sync");
          const n = await buildBook(ctx, settings, bookName, verdict.display, settings.bookDepth);
          toastr.success(`Added ${n} entries to "${bookName}".`, "Worldbook Sync");
        }
      });
    },
    onRestore: () => {
      const active = requireCharacter();
      if (!active) return;
      const { ctx, character } = active;
      void runAction("Restore", async () => {
        const cached = settings.verdicts[character.avatar]?.verdict;
        if (!cached || cached.kind !== "franchise") {
          toastr.info("No franchise book for this character.", "Worldbook Sync");
          return;
        }
        const bookName = bookNameFor(settings, cached);
        const restored = await restoreBackup(ctx, settings, bookName);
        toastr[restored ? "success" : "info"](
          restored ? `Restored the last backup of "${bookName}".` : "No backup to restore.",
          "Worldbook Sync"
        );
      });
    }
  };
}
function boot() {
  const ctx = getCtx();
  if (!ctx) {
    console.error(LOG, "no SillyTavern context; extension not started");
    return;
  }
  const settings = loadSettings(ctx);
  const eventTypes = ctx.eventTypes ?? ctx.event_types ?? {};
  const renderPanel = () => renderSettingsPanel(
    { enabled: settings.enabled, autoBuild: settings.autoBuild, bookDepth: settings.bookDepth },
    buildHandlers(settings)
  );
  renderPanel();
  ctx.eventSource.on(eventTypes.APP_READY ?? "app_ready", renderPanel);
  ctx.eventSource.on(eventTypes.CHAT_CHANGED ?? "chat_id_changed", () => onChatChanged(settings));
  console.log(LOG, "loaded");
}
boot();
//# sourceMappingURL=index.js.map
