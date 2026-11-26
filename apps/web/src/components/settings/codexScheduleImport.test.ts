import { describe, expect, it } from "vite-plus/test";
import { parseCodexSchedule } from "./codexScheduleImport";

const automation = (rule: string) =>
  [
    'id = "weekly-check"',
    'name = "Weekly check"',
    'prompt = "Check the work."',
    'status = "PAUSED"',
    'target_thread_id = "thread-123"',
    'rrule = "' + rule + '"',
  ].join("\n");

describe("Codex schedule import", () => {
  it("preserves a paused weekly prompt and its destination", () => {
    expect(
      parseCodexSchedule(
        automation("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=9;BYMINUTE=5;BYSECOND=0"),
      ),
    ).toEqual({
      id: "weekly-check",
      targetThreadId: "thread-123",
      draft: {
        title: "Weekly check",
        prompt: "Check the work.",
        enabled: false,
        scheduleMode: "fixed",
        timeOfDay: "09:05",
        weekdays: new Set([1, 3]),
      },
    });
  });

  it("rejects rules whose end date would otherwise be discarded", () => {
    expect(
      parseCodexSchedule(automation("FREQ=MINUTELY;INTERVAL=10;UNTIL=20261122T160000Z")),
    ).toBeNull();
  });
});
