import { useAtomValue } from "@effect/atom-react";
import { deriveThreadTitleSeed } from "@t3tools/client-runtime/operations";
import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import { CommandId, type EnvironmentId, type ScheduledTaskUpsertInput } from "@t3tools/contracts";
import { T, useGT, useMessages } from "gt-react";
import { useId, useRef, useState, type MouseEvent } from "react";
import { randomUUID } from "~/lib/utils";
import { contextMenuSourceOf } from "../../contextMenuSource";
import { useStableCallback } from "../../hooks/useStableCallback";
import { readLocalApi } from "../../localApi";
import { useEnvironment } from "../../state/environments";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { toDateTimeLocalValue } from "../settings/scheduledTasksSettings.logic";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { toastManager } from "../ui/toast";

type Target = Omit<ScheduledTaskUpsertInput, "schedule" | "title" | "enabled" | "commandId">;
type Selection = { readonly target: Target; readonly commandId: CommandId };

export function useComposerPromptSchedule({
  environmentId,
  targetKey,
  readTarget,
  onScheduled,
}: {
  readonly environmentId: EnvironmentId;
  readonly targetKey: string;
  readonly readTarget: (() => Target | null) | null;
  readonly onScheduled: (target: Target) => void;
}) {
  const gt = useGT();
  const environment = useEnvironment(environmentId);
  const permitted = useAtomValue(
    serverEnvironment.upsertScheduledTask.permissionAtom(environmentId),
  );
  const available =
    permitted &&
    environment?.connection.phase === "connected" &&
    environment.serverConfig?.environment.capabilities.oneTimeSchedules === true;
  const [selection, setSelection] = useState<
    (Selection & { targetKey: string; onScheduled: (target: Target) => void }) | null
  >(null);
  const showMenu = useStableCallback((event: MouseEvent<HTMLButtonElement>) => {
    const api = readLocalApi();
    const target = readTarget?.();
    if (!api || !available || !target) return;
    event.preventDefault();
    event.stopPropagation();
    void api.contextMenu
      .show(
        [{ id: "schedule-prompt", label: gt("Schedule for later…") }] as const,
        { x: event.clientX, y: event.clientY },
        contextMenuSourceOf(event),
      )
      .then((clicked) => {
        if (clicked === "schedule-prompt") {
          setSelection({
            targetKey,
            target,
            onScheduled,
            commandId: CommandId.make(randomUUID()),
          });
        }
      })
      .catch(() => toastManager.add({ type: "error", title: gt("Could not open the menu.") }));
  });
  return {
    onContextMenu: available && readTarget !== null ? showMenu : undefined,
    dialog:
      selection?.targetKey === targetKey ? (
        <ScheduleComposerPromptDialog
          key={selection.commandId}
          selection={selection}
          environmentId={environmentId}
          available={available}
          onClose={() => setSelection(null)}
          onScheduled={selection.onScheduled}
        />
      ) : null,
  };
}

function ScheduleComposerPromptDialog({
  selection,
  environmentId,
  available,
  onClose,
  onScheduled,
}: {
  readonly selection: Selection;
  readonly environmentId: EnvironmentId;
  readonly available: boolean;
  readonly onClose: () => void;
  readonly onScheduled: (target: Target) => void;
}) {
  const gt = useGT();
  const m = useMessages();
  const dateId = useId();
  const dateInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => toDateTimeLocalValue(new Date(Date.now() + 3_600_000)));
  const upsert = useAtomCommand(serverEnvironment.upsertScheduledTask, {
    label: "schedule composer prompt",
  });

  async function schedule() {
    if (!available || pending.current) return;
    const runAt = new Date(date);
    if (!Number.isFinite(runAt.getTime()) || runAt.getTime() <= Date.now()) {
      setError(gt("Choose a future date and time."));
      return;
    }
    if (toDateTimeLocalValue(runAt) !== date) {
      setError(gt("That time does not exist in your time zone."));
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    const result = await upsert({
      environmentId,
      input: {
        ...selection.target,
        commandId: selection.commandId,
        title: deriveThreadTitleSeed({ text: selection.target.prompt, attachments: [] }, m),
        enabled: true,
        schedule: { type: "once", runAt: runAt.toISOString() },
      },
    });
    if (result._tag === "Success") {
      onScheduled(selection.target);
      toastManager.add({ type: "success", title: gt("Prompt scheduled") });
      onClose();
      return;
    }
    pending.current = false;
    setSaving(false);
    if (!isAtomCommandInterrupted(result)) setError(gt("Could not save scheduled task"));
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogPopup initialFocus={dateInput} showCloseButton={!saving}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void schedule();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              <T>Schedule prompt</T>
            </DialogTitle>
            <DialogDescription>
              {selection.target.threadId ? (
                <T>Send this prompt once in this thread at the time you choose.</T>
              ) : (
                <T>Send this prompt once in a new thread at the time you choose.</T>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <label htmlFor={dateId} className="mb-2 block text-sm font-medium">
              <T>Date and time</T>
            </label>
            <Input
              ref={dateInput}
              id={dateId}
              type="datetime-local"
              required
              value={date}
              disabled={saving}
              onChange={(event) => {
                setDate(event.currentTarget.value);
                setError(null);
              }}
            />
            {error ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              <T>Cancel</T>
            </Button>
            <Button type="submit" disabled={saving || !available}>
              <T>Schedule</T>
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
