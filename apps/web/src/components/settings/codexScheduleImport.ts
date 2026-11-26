import { parse } from "smol-toml";
import type { DraftState } from "./scheduledTasksSettings.logic";

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export interface CodexScheduleImport {
  readonly id: string;
  readonly targetThreadId?: string;
  readonly cwd?: string;
  readonly draft: Pick<DraftState, "title" | "prompt" | "enabled"> &
    Partial<Pick<DraftState, "scheduleMode" | "timeOfDay" | "weekdays" | "intervalMinutes">>;
}

export function parseCodexSchedule(source: string): CodexScheduleImport | null {
  const { id, name, prompt, status, rrule, target_thread_id, cwds } = parse(source);
  if (
    typeof id !== "string" ||
    !id.trim() ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof prompt !== "string" ||
    !prompt.trim() ||
    (status !== "ACTIVE" && status !== "PAUSED") ||
    typeof rrule !== "string"
  )
    return null;
  const terms = new Map<string, string>();
  for (const term of rrule.replace(/^RRULE:/i, "").split(";")) {
    const [key, value, extra] = term.split("=");
    if (!key || !value || extra !== undefined || terms.has(key)) return null;
    terms.set(key, value);
  }
  const frequency = terms.get("FREQ");
  const rawInterval = terms.get("INTERVAL") ?? "1";
  if (!/^\d+$/.test(rawInterval)) return null;
  const interval = Number(rawInterval);
  const draft = { title: name, prompt, enabled: status === "ACTIVE" };
  const target = {
    id,
    ...(typeof target_thread_id === "string" ? { targetThreadId: target_thread_id } : {}),
    ...(Array.isArray(cwds) && cwds.length === 1 && typeof cwds[0] === "string"
      ? { cwd: cwds[0] }
      : {}),
  };
  if (frequency === "MINUTELY" || frequency === "HOURLY") {
    if ([...terms.keys()].some((key) => key !== "FREQ" && key !== "INTERVAL")) return null;
    const minutes = interval * (frequency === "HOURLY" ? 60 : 1);
    if (!Number.isSafeInteger(minutes * 60_000) || minutes < 1) return null;
    return {
      ...target,
      draft: { ...draft, scheduleMode: "interval", intervalMinutes: String(minutes) },
    };
  }
  if (
    (frequency !== "DAILY" && frequency !== "WEEKLY") ||
    interval !== 1 ||
    [...terms.keys()].some(
      (key) => !["FREQ", "INTERVAL", "BYDAY", "BYHOUR", "BYMINUTE", "BYSECOND"].includes(key),
    ) ||
    (terms.has("BYSECOND") && terms.get("BYSECOND") !== "0")
  )
    return null;
  const hour = terms.get("BYHOUR") ?? "";
  const minute = terms.get("BYMINUTE") ?? "0";
  if (
    !/^\d{1,2}$/.test(hour) ||
    Number(hour) > 23 ||
    !/^\d{1,2}$/.test(minute) ||
    Number(minute) > 59
  )
    return null;
  const days = terms
    .get("BYDAY")
    ?.split(",")
    .map((day) => WEEKDAYS.indexOf(day));
  if (days?.includes(-1) || (frequency === "WEEKLY" && days === undefined)) return null;
  return {
    ...target,
    draft: {
      ...draft,
      scheduleMode: "fixed",
      timeOfDay: hour.padStart(2, "0") + ":" + minute.padStart(2, "0"),
      weekdays: new Set(days ?? [0, 1, 2, 3, 4, 5, 6]),
    },
  };
}
