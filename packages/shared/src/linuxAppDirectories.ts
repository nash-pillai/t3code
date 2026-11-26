// @effect-diagnostics-next-line nodeBuiltinImport:off -- This helper resolves POSIX paths even when called by tests on Windows.
import * as NodePath from "node:path";

const path = NodePath.posix;

export function linuxAppDirectories(
  home: string,
  env: Readonly<Record<string, string | undefined>>,
) {
  const root = (value: string | undefined, ...fallback: string[]) =>
    path.join(value && path.isAbsolute(value) ? value : path.join(home, ...fallback), "t3code");
  return {
    config: root(env.XDG_CONFIG_HOME, ".config"),
    data: root(env.XDG_DATA_HOME, ".local", "share"),
    state: root(env.XDG_STATE_HOME, ".local", "state"),
    cache: root(env.XDG_CACHE_HOME, ".cache"),
  };
}
