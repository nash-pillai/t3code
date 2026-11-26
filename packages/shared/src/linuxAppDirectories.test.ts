import { describe, expect, it } from "vite-plus/test";
import { linuxAppDirectories } from "./linuxAppDirectories.ts";

describe("Linux T3 Code paths", () => {
  it("uses the user's XDG roots and ignores relative overrides", () => {
    expect(
      linuxAppDirectories("/home/user", {
        XDG_CONFIG_HOME: "/config",
        XDG_DATA_HOME: "/data",
        XDG_STATE_HOME: "relative",
        XDG_CACHE_HOME: "/cache",
      }),
    ).toEqual({
      config: "/config/t3code",
      data: "/data/t3code",
      state: "/home/user/.local/state/t3code",
      cache: "/cache/t3code",
    });
  });
});
