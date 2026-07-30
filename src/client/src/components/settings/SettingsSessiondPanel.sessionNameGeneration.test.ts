// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PiWebConfigResponse } from "../../api";
import { SettingsSessiondPanel } from "./SettingsSessiondPanel";

beforeEach(() => {
  document.body.replaceChildren();
});

describe("SettingsSessiondPanel AI session titles setting", () => {
  it("lets the user disable LLM-generated session titles with a daemon config patch", async () => {
    const panel = new SettingsSessiondPanel();
    const onSave = vi.fn();
    panel.configResponse = configResponse(true);
    panel.onSave = onSave;
    document.body.append(panel);
    await panel.updateComplete;

    const toggle = sessionNameGenerationToggle(panel);
    expect(toggle.checked).toBe(true);
    expect(toggle.disabled).toBe(false);

    toggle.click();
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledWith({ generateSessionNames: false });
  });

  it("does not offer the setting from an older selected machine", async () => {
    const panel = new SettingsSessiondPanel();
    panel.configResponse = configResponse(undefined);
    document.body.append(panel);
    await panel.updateComplete;

    const toggle = sessionNameGenerationToggle(panel);
    expect(toggle.checked).toBe(true);
    expect(toggle.disabled).toBe(true);
  });
});

function sessionNameGenerationToggle(panel: SettingsSessiondPanel): HTMLInputElement {
  const toggle = panel.shadowRoot?.querySelector<HTMLInputElement>('input[aria-label="Enable AI Session Titles"]');
  if (toggle === undefined || toggle === null) throw new Error("AI Session Titles toggle was not rendered");
  return toggle;
}

function configResponse(generateSessionNames: boolean | undefined): PiWebConfigResponse {
  const config = generateSessionNames === undefined ? {} : { generateSessionNames };
  return {
    path: "/tmp/pi-web/config.json",
    exists: true,
    config,
    effectiveConfig: config,
    envOverrides: {
      host: false,
      port: false,
      allowedHosts: false,
      spawnSessions: false,
      subsessions: false,
      askUser: false,
    },
  };
}
