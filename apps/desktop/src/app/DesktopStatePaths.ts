import * as Option from "effect/Option";
import { linuxAppDirectories } from "@t3tools/shared/linuxAppDirectories";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- The early Electron startup hook resolves desktop settings before the Effect runtime starts.
import * as NodeFS from "node:fs";

export type JoinPath = (first: string, ...segments: string[]) => string;

function normalizeConfiguredBaseDir(t3Home: Option.Option<string>): Option.Option<string> {
  if (Option.isNone(t3Home)) {
    return Option.none();
  }
  const trimmed = t3Home.value.trim();
  return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
}

export function resolveDesktopBaseDir(input: {
  readonly homeDirectory: string;
  readonly joinPath: JoinPath;
  readonly t3Home: Option.Option<string>;
  readonly platform?: NodeJS.Platform;
  readonly xdgStateHome?: string | undefined;
}): string {
  const configured = normalizeConfiguredBaseDir(input.t3Home);
  if (Option.isSome(configured)) return configured.value;
  const legacy = input.joinPath(input.homeDirectory, ".t3");
  if (input.platform !== "linux") return legacy;
  const { state } = linuxAppDirectories(input.homeDirectory, {
    XDG_STATE_HOME: input.xdgStateHome,
  });
  if (NodeFS.existsSync(input.joinPath(state, "userdata"))) return state;
  return NodeFS.existsSync(input.joinPath(legacy, "userdata")) ||
    NodeFS.existsSync(input.joinPath(legacy, "service.env"))
    ? legacy
    : state;
}

export function resolveDesktopStateDir(input: {
  readonly baseDir: string;
  readonly isDevelopment: boolean;
  readonly joinPath: JoinPath;
  readonly t3Home: Option.Option<string>;
}): string {
  const useDevSubdir =
    input.isDevelopment && Option.isNone(normalizeConfiguredBaseDir(input.t3Home));
  return input.joinPath(input.baseDir, useDevSubdir ? "dev" : "userdata");
}
