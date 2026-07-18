import type { Verdict } from './types';

/** Result of the confirm-once prompt (ADR-0003). */
export type ConfirmResult =
  | { action: 'franchise'; display: string }
  | { action: 'original' }
  | { action: 'multiversal' }
  | { action: 'cancel' };

const STYLE_ID = 'wbs-styles';

function injectStylesOnce(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
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

/**
 * Show the confirm-once franchise prompt. The input is prefilled with the detected
 * franchise and is freely editable, so "Use this franchise" doubles as "change".
 */
export function confirmVerdict(characterName: string, verdict: Verdict): Promise<ConfirmResult> {
  injectStylesOnce();
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'wbs-overlay';
    const prefill = verdict.kind === 'franchise' ? verdict.display : '';

    overlay.innerHTML = `
      <div class="wbs-card" role="dialog" aria-modal="true">
        <h3>Worldbook Sync — universe for "${escapeHtml(characterName)}"</h3>
        <p>Detected franchise (edit if wrong):</p>
        <input type="text" class="wbs-input" placeholder="e.g. The Witcher" />
        <div class="wbs-row">
          <button class="wbs-btn ghost" data-act="cancel">Cancel</button>
          <button class="wbs-btn ghost" data-act="multiversal">Multiversal</button>
          <button class="wbs-btn ghost" data-act="original">Original / none</button>
          <button class="wbs-btn primary" data-act="franchise">Use this franchise</button>
        </div>
      </div>`;

    const input = overlay.querySelector<HTMLInputElement>('.wbs-input')!;
    input.value = prefill;

    const finish = (result: ConfirmResult): void => {
      overlay.remove();
      resolve(result);
    };

    overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === overlay) return finish({ action: 'cancel' });
      const act = target.dataset.act;
      if (!act) return;
      if (act === 'franchise') {
        const display = input.value.trim();
        finish(display ? { action: 'franchise', display } : { action: 'original' });
      } else if (act === 'original') finish({ action: 'original' });
      else if (act === 'multiversal') finish({ action: 'multiversal' });
      else finish({ action: 'cancel' });
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const display = input.value.trim();
        finish(display ? { action: 'franchise', display } : { action: 'original' });
      } else if (e.key === 'Escape') finish({ action: 'cancel' });
    });

    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}

export interface PanelState {
  enabled: boolean;
  autoBuild: boolean;
  bookDepth: number;
}

export interface PanelHandlers {
  onEnabledChange(value: boolean): void;
  onAutoBuildChange(value: boolean): void;
  onDepthChange(value: number): void;
  onRedetect(): void;
  onBuildOrRegenerate(): void;
  onRestore(): void;
}

/** Render the settings drawer under ST's extensions settings container. */
export function renderSettingsPanel(state: PanelState, handlers: PanelHandlers): void {
  injectStylesOnce();
  const container =
    document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
  if (!container) {
    console.warn('[worldbook-sync] extensions settings container not found; panel not rendered');
    return;
  }
  if (document.getElementById('wbs-panel')) return;

  const drawer = document.createElement('div');
  drawer.id = 'wbs-panel';
  drawer.className = 'inline-drawer wbs-panel';
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

  const enabled = drawer.querySelector<HTMLInputElement>('#wbs-enabled')!;
  const autoBuild = drawer.querySelector<HTMLInputElement>('#wbs-autobuild')!;
  const depth = drawer.querySelector<HTMLInputElement>('#wbs-depth')!;
  enabled.checked = state.enabled;
  autoBuild.checked = state.autoBuild;
  depth.value = String(state.bookDepth);

  enabled.addEventListener('change', () => handlers.onEnabledChange(enabled.checked));
  autoBuild.addEventListener('change', () => handlers.onAutoBuildChange(autoBuild.checked));
  depth.addEventListener('change', () => {
    const n = Number(depth.value);
    if (Number.isFinite(n) && n > 0) handlers.onDepthChange(Math.round(n));
  });
  drawer.querySelector('#wbs-redetect')!.addEventListener('click', () => handlers.onRedetect());
  drawer.querySelector('#wbs-build')!.addEventListener('click', () => handlers.onBuildOrRegenerate());
  drawer.querySelector('#wbs-restore')!.addEventListener('click', () => handlers.onRestore());

  // ST's inline-drawer expand/collapse.
  drawer.querySelector('.inline-drawer-toggle')!.addEventListener('click', () => {
    drawer.querySelector('.inline-drawer-content')!.classList.toggle('open');
    drawer.querySelector('.inline-drawer-icon')!.classList.toggle('down');
    drawer.querySelector('.inline-drawer-icon')!.classList.toggle('up');
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
