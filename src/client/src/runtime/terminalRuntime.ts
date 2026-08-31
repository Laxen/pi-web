import { terminalsApi as defaultApi, type RunTerminalCommandInput, type TerminalCommandRun, type TerminalCommandRunFilter, type Workspace } from "../api";
import type { NavigationSelection } from "../controllers/types";
import type { TerminalCommandRunsInternalRuntime } from "../plugins/types";

type TimerId = ReturnType<typeof globalThis.setTimeout>;
type SetTimer = (handler: () => void, timeout: number) => TimerId;
type ClearTimer = (id: TimerId) => void;

export interface TerminalCommandNavigationContext {
  readonly selection: NavigationSelection;
  readonly tool: string | undefined;
  readonly view: string | undefined;
  readonly url: string;
}

export interface TerminalCommandRunsRuntimeDependencies {
  api?: Pick<typeof defaultApi, "runTerminalCommand" | "listCommandRuns" | "getCommandRun">;
  captureNavigation?: () => TerminalCommandNavigationContext;
  openTerminal: (workspace: Workspace | undefined, options?: { terminalId?: string | undefined }, expected?: TerminalCommandNavigationContext) => void | Promise<void>;
  pollIntervalMs?: number;
  setTimeout?: SetTimer;
  clearTimeout?: ClearTimer;
}

export function createTerminalCommandRunsRuntime(origin: string, deps: TerminalCommandRunsRuntimeDependencies): TerminalCommandRunsInternalRuntime {
  const api = deps.api ?? defaultApi;
  const pollIntervalMs = deps.pollIntervalMs ?? 1000;
  const setTimer = deps.setTimeout ?? defaultSetTimeout();
  const clearTimer = deps.clearTimeout ?? defaultClearTimeout();

  return {
    async runCommand(input: RunTerminalCommandInput) {
      const expected = deps.captureNavigation?.();
      const run = await api.runTerminalCommand(origin, input);
      if (input.open === true) {
        if (expected === undefined) void deps.openTerminal(input.workspace, { terminalId: run.terminalId });
        else void deps.openTerminal(input.workspace, { terminalId: run.terminalId }, expected);
      }
      return { run, completed: waitForCommandRunCompletion(run, api, pollIntervalMs, setTimer, clearTimer) };
    },
    listCommandRuns: (filter?: TerminalCommandRunFilter) => api.listCommandRuns(filter),
    getCommandRun: (runId: string) => api.getCommandRun(runId),
    open: (options?: { terminalId?: string | undefined }) => {
      const expected = deps.captureNavigation?.();
      if (expected === undefined) void deps.openTerminal(undefined, options);
      else void deps.openTerminal(undefined, options, expected);
    },
  };
}

function waitForCommandRunCompletion(
  initialRun: TerminalCommandRun,
  api: Pick<typeof defaultApi, "getCommandRun">,
  pollIntervalMs: number,
  setTimer: SetTimer,
  clearTimer: ClearTimer,
): Promise<TerminalCommandRun> {
  if (isTerminalCommandRunFinal(initialRun)) return Promise.resolve(initialRun);
  return new Promise((resolve, reject) => {
    let timer: TimerId | undefined;
    let settled = false;

    const finish = (result: TerminalCommandRun) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimer(timer);
      resolve(result);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimer(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const poll = () => {
      void api.getCommandRun(initialRun.id).then((run) => {
        if (run !== undefined && isTerminalCommandRunFinal(run)) {
          finish(run);
          return;
        }
        timer = setTimer(poll, pollIntervalMs);
      }).catch(fail);
    };

    timer = setTimer(poll, pollIntervalMs);
  });
}

function isTerminalCommandRunFinal(run: TerminalCommandRun): boolean {
  return run.status === "succeeded" || run.status === "failed";
}

function defaultSetTimeout(): SetTimer {
  return (handler, timeout) => globalThis.setTimeout(handler, timeout);
}

function defaultClearTimeout(): ClearTimer {
  return (id) => { globalThis.clearTimeout(id); };
}
