import { css, html } from "lit";

/** Shared native control, rendered in the picker's DOM beside (never inside) its row button. */
export function defaultPin(label: string, active: boolean, disabled: boolean, onClick: () => void) {
  const help = `Set ${label} as default for future sessions`;
  return html`<button type="button" class="default-pin" aria-label=${help} title=${help}
    aria-pressed=${String(active)} ?disabled=${disabled} @click=${onClick}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill=${active ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.8">
      <path d="M9 3h6l-1 6 4 4v2H6v-2l4-4zM12 15v7" />
    </svg>
  </button>`;
}

export const defaultPinHelp = html`<div class="default-help"><strong>Default</strong><span>Pin an option for future sessions.</span></div>`;

export const defaultPinStyles = css`
  .default-help { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; color: var(--pi-muted); }
  .default-row { display: flex; align-items: center; border-bottom: 1px solid var(--pi-border-muted); }
  .options .default-row > button:not(.default-pin) { flex: 1; min-width: 0; width: auto; display: block; padding: 10px 12px; text-align: left; border-bottom: 0; }
  .options .default-row > button.selected { background: var(--pi-selection-bg); }
  .options button.default-pin { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; margin: 0 6px; border: 0; border-radius: 6px; }
  .default-pin[aria-pressed="true"] { color: var(--pi-accent); }
  .default-pin:disabled { opacity: 0.45; cursor: default; }
  .default-pin:focus-visible { outline: 2px solid var(--pi-accent); outline-offset: -2px; }
`;
