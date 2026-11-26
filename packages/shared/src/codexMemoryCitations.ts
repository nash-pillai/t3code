const CITATION_BLOCK =
  /^<oai-mem-citation>\r?\n<citation_entries>\r?\n([\s\S]*?)\r?\n<\/citation_entries>(?:\r?\n<rollout_ids>\r?\n[\s\S]*?\r?\n<\/rollout_ids>)?\r?\n<\/oai-mem-citation>[ \t]*(?=\r?$)/gm;

export function extractCodexMemoryCitations(text: string) {
  if (!text.includes("<oai-mem-citation>")) return { text, citations: [] };
  const citations = new Map<string, { source: string; note: string }>();
  const fences = [...text.matchAll(/^ {0,3}(\x60{3,}|~{3,})[^\r\n]*/gm)];
  let fenceIndex = 0;
  let fence: string | undefined;
  const visible = text.replace(CITATION_BLOCK, (block, entries: string, offset: number) => {
    for (; fenceIndex < fences.length; fenceIndex++) {
      const match = fences[fenceIndex]!;
      if (match.index >= offset) break;
      const marker = match[1]!;
      if (!fence) fence = marker;
      else if (
        marker[0] === fence[0] &&
        marker.length >= fence.length &&
        match[0].trim() === marker
      ) {
        fence = undefined;
      }
    }
    if (fence) return block;
    const parsed = entries.split(/\r?\n/).map((entry) => {
      const match = /^(.+:\d+(?:-\d+)?)\|note=(.*)$/.exec(entry);
      return match ? { source: match[1]!, note: match[2]! } : null;
    });
    if (parsed.some((entry) => entry === null)) return block;
    for (const entry of parsed) {
      if (entry) citations.set(JSON.stringify(entry), entry);
    }
    return "";
  });
  return {
    text: citations.size > 0 ? visible.trimEnd() : visible,
    citations: [...citations.values()],
  };
}
