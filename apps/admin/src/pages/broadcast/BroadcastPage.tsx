import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { IconBell, IconLock, IconSend } from '@tabler/icons-react';
import { broadcastSchema, PLATFORM_VALUES, type BroadcastInput } from '@expense/shared';
import { api } from '../../lib/api';
import { label } from '../../lib/format';
import { notifyError, notifySuccess } from '../../lib/queryClient';
import { useIsSuperAdmin } from '../../hooks/useAuth';
import PageBanner from '../../components/common/PageBanner';
import ConfirmModal from '../../components/common/ConfirmModal';
import { Section } from '../../components/common/widgets';

const SEGMENTS = [
  { value: 'all', label: 'Everyone' },
  { value: 'active_7d', label: 'Active in the last 7 days' },
  { value: 'inactive_30d', label: 'Inactive for 30+ days' },
  { value: 'platform', label: 'One platform' },
];

export default function BroadcastPage() {
  const isSuperAdmin = useIsSuperAdmin();
  const [pending, setPending] = useState<BroadcastInput | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(broadcastSchema),
    defaultValues: { title: '', body: '', segment: 'all' },
  });
  const [title, body, segment] = watch(['title', 'body', 'segment']);

  const send = useMutation({
    mutationFn: (input: BroadcastInput) => api.broadcast(input),
    onSuccess: ({ recipients }) => {
      notifySuccess(`Sent to ${recipients} ${recipients === 1 ? 'user' : 'users'}`);
      setPending(null);
      reset();
    },
    onError: (e) => notifyError(e),
  });

  if (!isSuperAdmin) {
    return (
      <Alert color="gray" icon={<IconLock size={18} />} title="Superadmin only">
        Only a superadmin can send broadcast notifications.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <PageBanner title="Broadcast" subtitle="Send a push notification and in-app message to a group of users" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="Message" className="lg:col-span-2">
          <form onSubmit={handleSubmit((values) => setPending(values))}>
            <Stack>
              <TextInput label="Title" maxLength={80} error={errors.title?.message} {...register('title')} />
              <Textarea
                label="Message"
                description={`${body?.length ?? 0}/240`}
                maxLength={240}
                autosize
                minRows={3}
                error={errors.body?.message}
                {...register('body')}
              />
              <Controller
                control={control}
                name="segment"
                render={({ field }) => (
                  <Select label="Audience" data={SEGMENTS} allowDeselect={false} value={field.value} onChange={field.onChange} />
                )}
              />
              {segment === 'platform' && (
                <Controller
                  control={control}
                  name="platform"
                  render={({ field }) => (
                    <Select
                      label="Platform"
                      placeholder="Pick a platform"
                      data={PLATFORM_VALUES.map((p) => ({ value: p, label: label(p) }))}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ?? undefined)}
                    />
                  )}
                />
              )}
              <Alert color="blue" variant="light">
                Users who turned off product updates in their notification settings are skipped.
              </Alert>
              <div>
                <Button type="submit" leftSection={<IconSend size={16} />}>
                  Review and send
                </Button>
              </div>
            </Stack>
          </form>
        </Section>

        <Section title="Preview">
          <div className="rounded-2xl bg-gray-900 p-4 text-white shadow-lg">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white/15 p-2">
                <IconBell size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/60">Expense App · now</p>
                <p className="font-semibold truncate">{title || 'Notification title'}</p>
                <p className="text-sm text-white/80 break-words">{body || 'Your message appears here.'}</p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <ConfirmModal
        open={pending !== null}
        variant="warning"
        title="Send this broadcast?"
        message={`"${pending?.title}" goes to: ${SEGMENTS.find((s) => s.value === pending?.segment)?.label ?? ''}${
          pending?.platform ? ` (${label(pending.platform)})` : ''
        }. This cannot be undone.`}
        confirmLabel="Send"
        loading={send.isPending}
        onConfirm={() => pending && send.mutate(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
