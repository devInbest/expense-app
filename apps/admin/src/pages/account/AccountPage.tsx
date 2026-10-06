import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, PasswordInput, Stack } from '@mantine/core';
import { adminChangePasswordSchema } from '@expense/shared';
import { useChangePassword, useMe } from '../../hooks/useAuth';
import { formatDateTime, label } from '../../lib/format';
import { notifyError, notifySuccess } from '../../lib/queryClient';
import PageBanner from '../../components/common/PageBanner';
import { DetailRow, Section } from '../../components/common/widgets';

const formSchema = adminChangePasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Pick a different password' });

export default function AccountPage() {
  const { data: me } = useMe();
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(formSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) =>
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          notifySuccess('Password changed. Other sessions have been signed out.');
          reset();
        },
        onError: (e) => notifyError(e),
      },
    ),
  );

  return (
    <div className="space-y-4">
      <PageBanner title="Your account" subtitle={me ? `${me.name} · ${label(me.role)}` : undefined} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Profile">
          <DetailRow label="Name">{me?.name}</DetailRow>
          <DetailRow label="User name">{me?.userName}</DetailRow>
          <DetailRow label="Role">{label(me?.role)}</DetailRow>
          <DetailRow label="Last sign-in">{formatDateTime(me?.lastLogin)}</DetailRow>
        </Section>
        <Section title="Change password">
          <form onSubmit={onSubmit}>
            <Stack>
              <PasswordInput label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
              <PasswordInput label="New password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
              <PasswordInput label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
              <div>
                <Button type="submit" loading={changePassword.isPending}>
                  Change password
                </Button>
              </div>
            </Stack>
          </form>
        </Section>
      </div>
    </div>
  );
}
