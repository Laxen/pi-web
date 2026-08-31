import { describe, expect, it, vi } from "vitest";
import type { AppState } from "../appState";
import { initialAppState } from "../appState";
import type { Project, Workspace } from "../api";
import { ProjectController } from "./projectController";

function project(id: string, path: string): Project {
  return { id, name: id, path, createdAt: "now" };
}

function workspace(projectId: string, path: string): Workspace {
  return { id: path, projectId, path, label: path, isMain: true, effectiveConfig: {} };
}

describe("ProjectController", () => {
  it("drops cached workspaces for projects a reload no longer lists", async () => {
    const currentProject = project("current", "/current");
    const removedProject = project("removed", "/removed");
    let state: AppState = {
      ...initialAppState(),
      projects: [removedProject],
      workspacesByProjectId: {
        [currentProject.id]: [workspace(currentProject.id, currentProject.path)],
        [removedProject.id]: [workspace(removedProject.id, removedProject.path)],
      },
    };
    const controller = new ProjectController(
      () => state,
      (patch) => { state = { ...state, ...patch }; },
      { selectProject: vi.fn(), forgetProject: vi.fn(), clearSelection: vi.fn() },
      {
        api: {
          projects: vi.fn().mockResolvedValue([currentProject]),
          addProject: vi.fn(),
          closeProject: vi.fn(),
          setWorkspaceTrust: vi.fn(),
        },
      },
    );

    await controller.loadProjects();

    expect(state.projects).toEqual([currentProject]);
    expect(state.workspacesByProjectId).toEqual({
      [currentProject.id]: [workspace(currentProject.id, currentProject.path)],
    });
  });

  it("follows a close when the user selects the project before the request settles", async () => {
    const closingProject = project("closing", "/closing");
    const otherProject = project("other", "/other");
    let state: AppState = {
      ...initialAppState(),
      projects: [closingProject, otherProject],
      selectedProject: otherProject,
    };
    let resolveClose: (() => void) | undefined;
    const closeRequest = new Promise<{ closed: true }>((resolve) => { resolveClose = () => { resolve({ closed: true }); }; });
    const selectedAtNavigation: string[] = [];
    const controller = new ProjectController(
      () => state,
      (patch) => { state = { ...state, ...patch }; },
      { selectProject: vi.fn(), forgetProject: vi.fn(), clearSelection: vi.fn() },
      {
        api: {
          projects: vi.fn(),
          addProject: vi.fn(),
          closeProject: () => closeRequest,
          setWorkspaceTrust: vi.fn(),
        },
        navigateToProject: (next, options) => {
          selectedAtNavigation.push(`${state.selectedProject?.id ?? "none"}:${options?.expected?.projectId ?? "none"}`);
          state = { ...state, selectedProject: next };
          return Promise.resolve(true);
        },
      },
    );

    const close = controller.closeProject(closingProject.id);
    state = { ...state, selectedProject: closingProject };
    resolveClose?.();
    await close;

    expect(selectedAtNavigation).toEqual([`${closingProject.id}:${closingProject.id}`]);
    expect(state.selectedProject).toBeUndefined();
    expect(state.projects).toEqual([otherProject]);
  });

  it("closes the project dialog before selecting the project it added", async () => {
    const addedProject = project("added", "/added");
    let state: AppState = { ...initialAppState(), projectDialogOpen: true };
    const selectProject = vi.fn((selected: Project): Promise<void> => {
      expect(selected).toBe(addedProject);
      expect(state.projects).toEqual([addedProject]);
      expect(state.projectDialogOpen).toBe(false);
      return Promise.resolve();
    });
    const controller = new ProjectController(
      () => state,
      (patch) => { state = { ...state, ...patch }; },
      { selectProject, forgetProject: vi.fn(), clearSelection: vi.fn() },
      {
        api: {
          projects: vi.fn(),
          addProject: vi.fn().mockResolvedValue(addedProject),
          closeProject: vi.fn(),
          setWorkspaceTrust: vi.fn(),
        },
      },
    );

    await controller.addProject(" /added ");

    expect(selectProject).toHaveBeenCalledOnce();
  });

  it("publishes the created project before route reconciliation selects it", async () => {
    const addedProject = project("added", "/added");
    let state: AppState = { ...initialAppState(), projectDialogOpen: true };
    let selectedAtNavigation: string | undefined;
    let navigatedProject: string | undefined;
    const controller = new ProjectController(
      () => state,
      (patch) => { state = { ...state, ...patch }; },
      { selectProject: vi.fn(), forgetProject: vi.fn(), clearSelection: vi.fn() },
      {
        api: {
          projects: vi.fn(),
          addProject: vi.fn().mockResolvedValue(addedProject),
          closeProject: vi.fn(),
          setWorkspaceTrust: vi.fn(),
        },
        navigateToProject: (next) => {
          selectedAtNavigation = state.selectedProject?.id;
          navigatedProject = next?.id;
          state = { ...state, selectedProject: next };
          return Promise.resolve(true);
        },
      },
    );

    await controller.addProject("/added");

    expect(selectedAtNavigation).toBeUndefined();
    expect(navigatedProject).toBe(addedProject.id);
    expect(state.selectedProject?.id).toBe(addedProject.id);
  });

  it("pins a touched trust choice on the project's main workspace after adding it", async () => {
    const addedProject = project("added", "/added");
    const addedWorkspace = workspace(addedProject.id, addedProject.path);
    let state: AppState = { ...initialAppState(), projectDialogOpen: true };
    const setWorkspaceTrust = vi.fn().mockResolvedValue({ path: "/added", decision: true, trusted: true });
    const selectProject = vi.fn((): Promise<void> => {
      state = { ...state, selectedProject: addedProject, workspaces: [addedWorkspace] };
      return Promise.resolve();
    });
    const controller = new ProjectController(
      () => state,
      (patch) => { state = { ...state, ...patch }; },
      { selectProject, forgetProject: vi.fn(), clearSelection: vi.fn() },
      {
        api: {
          projects: vi.fn(),
          addProject: vi.fn().mockResolvedValue(addedProject),
          closeProject: vi.fn(),
          setWorkspaceTrust,
        },
      },
    );

    await controller.addProject("/added", true, { trusted: true, changed: true });

    expect(setWorkspaceTrust).toHaveBeenCalledOnce();
    expect(setWorkspaceTrust).toHaveBeenCalledWith(addedProject.id, addedWorkspace.id, true, "local");
  });

  it("does not write trust after navigation declines the added project", async () => {
    const addedProject = project("added", "/added");
    let state: AppState = { ...initialAppState(), projectDialogOpen: true };
    const setWorkspaceTrust = vi.fn();
    const controller = new ProjectController(
      () => state,
      (patch) => { state = { ...state, ...patch }; },
      { selectProject: vi.fn(), forgetProject: vi.fn(), clearSelection: vi.fn() },
      {
        api: {
          projects: vi.fn(),
          addProject: vi.fn().mockResolvedValue(addedProject),
          closeProject: vi.fn(),
          setWorkspaceTrust,
        },
        navigateToProject: vi.fn().mockResolvedValue(false),
      },
    );

    await controller.addProject("/added", true, { trusted: true, changed: true });

    expect(setWorkspaceTrust).not.toHaveBeenCalled();
  });

  it("does not trust a workspace from an unrelated project after navigation", async () => {
    const addedProject = project("added", "/added");
    const unrelatedProject = project("unrelated", "/unrelated");
    const unrelatedWorkspace = workspace(unrelatedProject.id, unrelatedProject.path);
    let state: AppState = {
      ...initialAppState(),
      projectDialogOpen: true,
      selectedProject: unrelatedProject,
      workspaces: [unrelatedWorkspace],
    };
    const setWorkspaceTrust = vi.fn();
    const controller = new ProjectController(
      () => state,
      (patch) => { state = { ...state, ...patch }; },
      { selectProject: vi.fn(), forgetProject: vi.fn(), clearSelection: vi.fn() },
      {
        api: {
          projects: vi.fn(),
          addProject: vi.fn().mockResolvedValue(addedProject),
          closeProject: vi.fn(),
          setWorkspaceTrust,
        },
        navigateToProject: () => {
          state = { ...state, selectedProject: addedProject };
          return Promise.resolve(true);
        },
      },
    );

    await controller.addProject("/added", true, { trusted: true, changed: true });

    expect(setWorkspaceTrust).not.toHaveBeenCalled();
  });

  it("does not write trust when the dialog choice was not touched", async () => {
    const addedProject = project("added", "/added");
    let state: AppState = { ...initialAppState(), projectDialogOpen: true };
    const setWorkspaceTrust = vi.fn();
    const selectProject = vi.fn((): Promise<void> => {
      state = { ...state, workspaces: [workspace(addedProject.id, addedProject.path)] };
      return Promise.resolve();
    });
    const controller = new ProjectController(
      () => state,
      (patch) => { state = { ...state, ...patch }; },
      { selectProject, forgetProject: vi.fn(), clearSelection: vi.fn() },
      {
        api: {
          projects: vi.fn(),
          addProject: vi.fn().mockResolvedValue(addedProject),
          closeProject: vi.fn(),
          setWorkspaceTrust,
        },
      },
    );

    await controller.addProject("/added");
    await controller.addProject("/added", undefined, { trusted: true, changed: false });

    expect(setWorkspaceTrust).not.toHaveBeenCalled();
  });

  it("forgets a closed project's workspaces before clearing the selection it held", async () => {
    const closedProject = project("closed", "/closed");
    const remainingProject = project("remaining", "/remaining");
    let state: AppState = {
      ...initialAppState(),
      projects: [closedProject, remainingProject],
      selectedProject: closedProject,
      workspacesByProjectId: {
        [closedProject.id]: [workspace(closedProject.id, closedProject.path)],
        [remainingProject.id]: [workspace(remainingProject.id, remainingProject.path)],
      },
    };
    const events: string[] = [];
    const forgetProject = vi.fn((projectId: string) => {
      events.push("forget");
      state = {
        ...state,
        workspacesByProjectId: Object.fromEntries(Object.entries(state.workspacesByProjectId).filter(([id]) => id !== projectId)),
      };
    });
    const clearSelection = vi.fn(() => { events.push("clear"); });
    const controller = new ProjectController(
      () => state,
      (patch) => { state = { ...state, ...patch }; },
      { selectProject: vi.fn(), forgetProject, clearSelection },
      {
        api: {
          projects: vi.fn(),
          addProject: vi.fn(),
          closeProject: vi.fn().mockResolvedValue(undefined),
          setWorkspaceTrust: vi.fn(),
        },
      },
    );

    await controller.closeProject(closedProject.id);

    expect(events).toEqual(["forget", "clear"]);
    expect(state.projects).toEqual([remainingProject]);
    expect(state.workspacesByProjectId[closedProject.id]).toBeUndefined();
    expect(clearSelection).toHaveBeenCalledOnce();
  });
});
