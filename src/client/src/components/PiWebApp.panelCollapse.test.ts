// @vitest-environment happy-dom
import { render as renderTemplate } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import type { AppAction } from "../actions";
import type { PiWebConfigValues } from "../api";
import { PiWebApp } from "./PiWebApp";

type ActionProvider = () => AppAction[];
type KeyboardHandler = (event: KeyboardEvent) => void;
type ConfigHandler = (config: PiWebConfigValues) => void;

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe("PiWebApp panel actions", () => {
  it("registers the View actions, toggles their rendered collapsed states, and handles their default shortcuts", () => {
    const app = new PiWebApp();
    const navigationAction = panelAction(app, "app.layout.toggle-navigation-panel");
    const workspaceAction = panelAction(app, "app.layout.toggle-workspace-panel");

    expect(navigationAction).toMatchObject({
      id: "app.layout.toggle-navigation-panel",
      title: "Toggle Navigation Panel",
      description: "Show or hide the navigation side panel",
      shortcut: "mod+g n",
      group: "View",
    });
    expect(workspaceShell(app).classList.contains("navigation-panel-collapsed")).toBe(false);

    void navigationAction.run();
    expect(workspaceShell(app).classList.contains("navigation-panel-collapsed")).toBe(true);

    const navigationEvent = globalShortcut(app, "g", { ctrlKey: true }, "n");
    expect(navigationEvent.defaultPrevented).toBe(true);
    expect(workspaceShell(app).classList.contains("navigation-panel-collapsed")).toBe(false);

    expect(workspaceAction).toMatchObject({
      id: "app.layout.toggle-workspace-panel",
      title: "Toggle Workspace Panel",
      description: "Show or hide the workspace side panel",
      shortcut: "mod+g e",
      group: "View",
    });
    expect(workspaceShell(app).classList.contains("workspace-panel-collapsed")).toBe(false);

    void workspaceAction.run();
    expect(workspaceShell(app).classList.contains("workspace-panel-collapsed")).toBe(true);

    const workspaceEvent = globalShortcut(app, "g", { ctrlKey: true }, "e");
    expect(workspaceEvent.defaultPrevented).toBe(true);
    expect(workspaceShell(app).classList.contains("workspace-panel-collapsed")).toBe(false);
  });

  it("uses a configured shortcut override after configuration is reloaded", () => {
    const config = { shortcuts: { "app.layout.toggle-workspace-panel": "mod+shift+x" } };
    const app = new PiWebApp();
    applyClientConfig(app, config);

    const defaultEvent = globalShortcut(app, "g", { ctrlKey: true }, "e");
    expect(defaultEvent.defaultPrevented).toBe(false);
    expect(workspaceShell(app).classList.contains("workspace-panel-collapsed")).toBe(false);

    globalKeyDown(app, "x", { ctrlKey: true, shiftKey: true });
    expect(workspaceShell(app).classList.contains("workspace-panel-collapsed")).toBe(true);

    const reloadedApp = new PiWebApp();
    applyClientConfig(reloadedApp, config);
    globalKeyDown(reloadedApp, "x", { ctrlKey: true, shiftKey: true });
    expect(workspaceShell(reloadedApp).classList.contains("workspace-panel-collapsed")).toBe(true);
  });
});

function panelAction(app: PiWebApp, id: string): AppAction {
  const actions = defaultActions(app);
  const action = actions.find((candidate) => candidate.id === id);
  if (action === undefined) throw new Error(`Panel action was not registered: ${id}`);
  return action;
}

function defaultActions(app: PiWebApp): AppAction[] {
  const value: unknown = Reflect.get(app, "getDefaultActions");
  if (!isActionProvider(value)) throw new Error("PiWebApp default actions were unavailable");
  return value.call(app);
}

function globalKeyDown(app: PiWebApp, key: string, options: KeyboardEventInit): KeyboardEvent {
  const value: unknown = Reflect.get(app, "onKeyDown");
  if (!isKeyboardHandler(value)) throw new Error("PiWebApp global keyboard handler was unavailable");
  const event = new KeyboardEvent("keydown", { key, cancelable: true, ...options });
  value.call(app, event);
  return event;
}

function globalShortcut(app: PiWebApp, firstKey: string, firstOptions: KeyboardEventInit, secondKey: string): KeyboardEvent {
  globalKeyDown(app, firstKey, firstOptions);
  return globalKeyDown(app, secondKey, {});
}

function applyClientConfig(app: PiWebApp, config: PiWebConfigValues): void {
  const value: unknown = Reflect.get(app, "applyClientConfig");
  if (!isConfigHandler(value)) throw new Error("PiWebApp client configuration handler was unavailable");
  value.call(app, config);
}

function workspaceShell(app: PiWebApp): HTMLElement {
  const container = document.createElement("div");
  renderTemplate(app.render(), container);
  const shell = container.querySelector<HTMLElement>(".shell");
  if (shell === null) throw new Error("PiWebApp shell was not rendered");
  return shell;
}

function isActionProvider(value: unknown): value is ActionProvider {
  return typeof value === "function";
}

function isKeyboardHandler(value: unknown): value is KeyboardHandler {
  return typeof value === "function";
}

function isConfigHandler(value: unknown): value is ConfigHandler {
  return typeof value === "function";
}
