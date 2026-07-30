import { describe, expect, it, vi } from "vitest";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { PanelCollapseController } from "./panelCollapseController";

describe("PanelCollapseController", () => {
  it("toggles the workspace panel and requests a render for each change", () => {
    const host = new ControllerHost();
    const controller = new PanelCollapseController(host);

    controller.toggleWorkspacePanel();
    expect(controller.workspacePanelCollapsed).toBe(true);

    controller.toggleWorkspacePanel();
    expect(controller.workspacePanelCollapsed).toBe(false);
    expect(host.requestUpdate).toHaveBeenCalledTimes(2);
  });
});

class ControllerHost implements ReactiveControllerHost {
  readonly requestUpdate = vi.fn();
  readonly updateComplete = Promise.resolve(true);

  addController(controller: ReactiveController): void {
    void controller;
  }

  removeController(controller: ReactiveController): void {
    void controller;
  }
}
