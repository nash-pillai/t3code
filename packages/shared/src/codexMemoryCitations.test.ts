import { describe, expect, it } from "vite-plus/test";
import { extractCodexMemoryCitations } from "./codexMemoryCitations.ts";

const citation = [
  "<oai-mem-citation>",
  "<citation_entries>",
  "MEMORY.md:10-12|note=[Used account settings]",
  "</citation_entries>",
  "<rollout_ids>",
  "00000000-0000-0000-0000-000000000001",
  "</rollout_ids>",
  "</oai-mem-citation>",
].join("\n");

describe("Codex memory citations", () => {
  it("separates structured citations from the conversation text", () => {
    expect(extractCodexMemoryCitations("Done.\n\n" + citation)).toEqual({
      text: "Done.",
      citations: [{ source: "MEMORY.md:10-12", note: "[Used account settings]" }],
    });
  });

  it("keeps literal examples inside fenced code", () => {
    const fence = String.fromCharCode(96).repeat(3);
    const text = fence + "\n" + citation + "\n" + fence;
    expect(extractCodexMemoryCitations(text)).toEqual({ text, citations: [] });
  });
});
