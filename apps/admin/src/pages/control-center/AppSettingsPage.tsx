import { useEffect, useState } from 'react';
import { Alert, Button, Group, Stack, Switch, Textarea, TextInput } from '@mantine/core';
import { IconDeviceFloppy, IconTool } from '@tabler/icons-react';
import { appSettingsSchema } from '@expense/shared';
import { useIsSuperAdmin } from '../../hooks/useAuth';
import { useAppSettings, useUpdateAppSettings } from '../../hooks/useAppSettings';
import { notifyError, notifySuccess } from '../../lib/queryClient';
import Skeleton from '../../components/common/Skeleton';
import { Section } from '../../components/common/widgets';

interface FormState {
  minAppVersion: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

export default function AppSettingsPage() {
  const isSuperAdmin = useIsSuperAdmin();
  const { data: settings, isLoading } = useAppSettings();
  const update = useUpdateAppSettings();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        minAppVersion: settings.minAppVersion,
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
      });
    }
  }, [settings]);

  if (isLoading || !form || !settings) return <Skeleton className="h-64" />;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm({ ...form, [key]: value });
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const dirty =
    form.minAppVersion !== settings.minAppVersion ||
    form.maintenanceMode !== settings.maintenanceMode ||
    form.maintenanceMessage !== settings.maintenanceMessage;

  const save = () => {
    const parsed = appSettingsSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    update.mutate(parsed.data, {
      onSuccess: () => notifySuccess('Settings saved. Apps pick them up the next time they open.'),
      onError: (e) => notifyError(e),
    });
  };

  return (
    <Stack>
      {!isSuperAdmin && (
        <Alert color="gray" variant="light">
          Only a superadmin can change these settings.
        </Alert>
      )}
      <Section title="Maintenance mode">
        <Stack>
          <Switch
            size="md"
            label="Block the mobile app with a maintenance screen"
            description="Signed-in users see the message below until you turn this off. The admin portal keeps working."
            checked={form.maintenanceMode}
            disabled={!isSuperAdmin}
            onChange={(e) => set('maintenanceMode', e.currentTarget.checked)}
            color="orange"
            thumbIcon={form.maintenanceMode ? <IconTool size={12} /> : undefined}
          />
          <Textarea
            label="Message shown to users"
            placeholder="We're upgrading things. Back in a few minutes."
            maxLength={240}
            autosize
            minRows={2}
            disabled={!isSuperAdmin}
            value={form.maintenanceMessage}
            error={errors.maintenanceMessage}
            onChange={(e) => set('maintenanceMessage', e.currentTarget.value)}
          />
        </Stack>
      </Section>

      <Section title="Minimum supported version">
        <TextInput
          label="Minimum app version"
          description="Older app builds are asked to update before they can continue. Use the version from app.config (for example 1.2.0)."
          w={320}
          disabled={!isSuperAdmin}
          value={form.minAppVersion}
          error={errors.minAppVersion}
          onChange={(e) => set('minAppVersion', e.currentTarget.value.trim())}
        />
      </Section>

      {isSuperAdmin && (
        <Group justify="flex-end">
          <Button leftSection={<IconDeviceFloppy size={16} />} disabled={!dirty} loading={update.isPending} onClick={save}>
            Save changes
          </Button>
        </Group>
      )}
    </Stack>
  );
}
