import { useAtomValue } from "@effect/atom-react";
import { errorDisplayMessage } from "@t3tools/client-runtime/errors";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  isManagedSettingPath,
  type ProviderInstanceConfig,
  type ServerProvider,
} from "@t3tools/contracts";
import { useGT } from "gt-react-native";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
import { ControlPill } from "../../components/ui/ControlPill";
import { m } from "../../i18n/messages";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import type { SettingsTarget } from "./settings-environment-filter";

type PathField = "homePath" | "shadowHomePath" | "launchArgs";

function configOf(instance: ProviderInstanceConfig | undefined): Record<string, unknown> {
  const config = instance?.config;
  return config !== null && typeof config === "object" ? (config as Record<string, unknown>) : {};
}

export function CodexAccountSettings({
  environment,
  provider,
  readOnly,
}: {
  readonly environment: SettingsTarget;
  readonly provider: ServerProvider;
  readonly readOnly: boolean;
}) {
  const gt = useGT();
  const mutate = useAtomCommand(serverEnvironment.mutateProviderInstance, { reportFailure: false });
  const canWrite = useAtomValue(
    serverEnvironment.mutateProviderInstance.permissionAtom(environment.environmentId),
  );
  const running = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Partial<Record<PathField, string>> | null>(null);
  const instance = environment.serverConfig.settings.providerInstances[provider.instanceId];
  const config = configOf(instance);
  const policy = environment.serverConfig.managedPolicy;
  const lockPath = "providerInstances." + provider.instanceId;
  const editable = !readOnly && canWrite && !isManagedSettingPath(policy, lockPath);
  const fields: ReadonlyArray<{ key: PathField; label: string; placeholder?: string }> = [
    { key: "homePath", label: gt("CODEX_HOME path"), placeholder: "~/.codex" },
    { key: "shadowHomePath", label: gt("Shadow home path") },
    { key: "launchArgs", label: gt("Launch arguments") },
  ];
  const name = provider.displayName ?? "Codex";

  async function save() {
    if (!editable || running.current || !edits) return;
    const nextConfig = { ...config };
    for (const { key } of fields) {
      const value = edits[key]?.trim();
      if (value === undefined || isManagedSettingPath(policy, lockPath + ".config." + key))
        continue;
      if (value) nextConfig[key] = value;
      else delete nextConfig[key];
    }
    running.current = true;
    setSaving(true);
    setError(null);
    const result = await mutate({
      environmentId: environment.environmentId,
      input: {
        patch: {},
        providerInstanceMutation: {
          operation: "upsert",
          instanceId: provider.instanceId,
          instance: { ...(instance ?? { driver: provider.driver }), config: nextConfig },
        },
      },
    });
    running.current = false;
    setSaving(false);
    if (result._tag === "Success") {
      setEdits(null);
    } else if (!isAtomCommandInterrupted(result)) {
      const failure = squashAtomCommandFailure(result);
      setError(errorDisplayMessage(failure, m) ?? gt("Could not save Codex settings."));
    }
  }

  return (
    <View className="gap-2 border-t border-border-subtle px-4 py-3">
      <View className="min-h-10 flex-row items-center gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text textRole="body" className="text-foreground">
            {name}
          </Text>
          <Text textRole="footnote" className="text-foreground-muted" numberOfLines={2}>
            {provider.auth.email ??
              (provider.auth.status === "authenticated" ? gt("Signed in") : gt("CLI sign-in"))}
          </Text>
        </View>
        {editable && edits === null ? (
          <ControlPill variant="pill" label={gt("Edit")} onPress={() => setEdits({})} />
        ) : null}
      </View>
      {edits !== null ? (
        <>
          {fields.map(({ key, label, placeholder }) => (
            <View key={key} className="gap-1">
              <Text textRole="footnote" className="text-foreground-muted">
                {label}
              </Text>
              <TextInput
                accessibilityLabel={label}
                className="rounded-lg border border-border-subtle px-3 py-2 text-base text-foreground"
                placeholderTextColorClassName="accent-foreground-muted"
                placeholder={placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                editable={
                  editable && !saving && !isManagedSettingPath(policy, lockPath + ".config." + key)
                }
                value={edits[key] ?? (typeof config[key] === "string" ? config[key] : "")}
                onChangeText={(value) => setEdits((previous) => ({ ...previous, [key]: value }))}
              />
            </View>
          ))}
          {error ? (
            <Text accessibilityRole="alert" className="text-danger-foreground">
              {error}
            </Text>
          ) : null}
          <View className="flex-row justify-end gap-2">
            <ControlPill
              variant="pill"
              label={gt("Cancel")}
              disabled={saving}
              onPress={() => {
                setEdits(null);
                setError(null);
              }}
            />
            <ControlPill
              variant="primary"
              label={gt("Save")}
              disabled={!editable || saving || !Object.keys(edits).length}
              onPress={() => void save()}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}
