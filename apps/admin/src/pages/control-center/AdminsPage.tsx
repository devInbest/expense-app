import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Button,
  CopyButton,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Switch,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconCopy, IconKey, IconPlus, IconTrash } from '@tabler/icons-react';
import { qk } from '@expense/api-client';
import { ADMIN_ROLE_VALUES, createAdminSchema, type AdminDTO, type AdminRole, type CreateAdminInput } from '@expense/shared';
import { api } from '../../lib/api';
import { formatDate, fromNow, label } from '../../lib/format';
import { notifyError, notifySuccess } from '../../lib/queryClient';
import { useMe } from '../../hooks/useAuth';
import DataTable, { type Column } from '../../components/common/DataTable';
import ConfirmModal from '../../components/common/ConfirmModal';
import { StatusBadge } from '../../components/common/widgets';

const ROLE_OPTIONS = ADMIN_ROLE_VALUES.map((r) => ({ value: r, label: label(r) }));
const ROLE_HELP = 'Support can view users, rooms and usage, and block users. Superadmins also see private money data and manage settings and admins.';

function CreateAdminForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateAdminInput>({ name: '', userName: '', password: '', role: 'support' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof CreateAdminInput>(key: K, value: CreateAdminInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const create = useMutation({
    mutationFn: (body: CreateAdminInput) => api.admins.create(body),
    onSuccess: (admin) => {
      notifySuccess(`${admin.name} can now sign in as ${admin.userName}`);
      queryClient.invalidateQueries({ queryKey: qk.admin.admins });
      onClose();
    },
    onError: (e) => notifyError(e),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = createAdminSchema.safeParse(form);
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
          return;
        }
        create.mutate(parsed.data);
      }}
    >
      <Stack>
        <TextInput label="Name" value={form.name} error={errors.name} onChange={(e) => set('name', e.currentTarget.value)} data-autofocus />
        <TextInput label="User name" description="Used to sign in. Lowercase." value={form.userName} error={errors.userName} onChange={(e) => set('userName', e.currentTarget.value)} />
        <PasswordInput label="Temporary password" description="At least 8 characters. Ask them to change it after signing in." value={form.password} error={errors.password} onChange={(e) => set('password', e.currentTarget.value)} />
        <Select label="Role" description={ROLE_HELP} data={ROLE_OPTIONS} allowDeselect={false} value={form.role} onChange={(v) => set('role', v as AdminRole)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create admin
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<AdminDTO | null>(null);
  const [deleting, setDeleting] = useState<AdminDTO | null>(null);
  const [newPassword, setNewPassword] = useState<{ admin: AdminDTO; password: string } | null>(null);
  const { data, isLoading } = useQuery({ queryKey: qk.admin.admins, queryFn: api.admins.list });
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.admin.admins });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Pick<AdminDTO, 'role' | 'isActive'>> }) => api.admins.update(id, body),
    onSuccess: (admin) => {
      notifySuccess(`${admin.name} updated`);
      refresh();
    },
    onError: (e) => notifyError(e),
  });
  const reset = useMutation({
    mutationFn: (admin: AdminDTO) => api.admins.resetPassword(admin._id).then(({ password }) => ({ admin, password })),
    onSuccess: (result) => {
      setResetting(null);
      setNewPassword(result);
    },
    onError: (e) => notifyError(e),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.admins.remove(id),
    onSuccess: () => {
      notifySuccess('Admin deleted');
      setDeleting(null);
      refresh();
    },
    onError: (e) => notifyError(e),
  });

  const columns: Column<AdminDTO>[] = [
    {
      key: 'name',
      header: 'Admin',
      render: (a) => (
        <div>
          <p className="font-medium">
            {a.name} {a._id === me?._id && <span className="text-xs text-gray-500">(you)</span>}
          </p>
          <p className="text-xs text-gray-500">{a.userName}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (a) =>
        a._id === me?._id ? (
          <StatusBadge value={a.role} />
        ) : (
          <Select
            size="xs"
            w={140}
            data={ROLE_OPTIONS}
            allowDeselect={false}
            value={a.role}
            onChange={(v) => v && v !== a.role && update.mutate({ id: a._id, body: { role: v as AdminRole } })}
          />
        ),
    },
    {
      key: 'isActive',
      header: 'Can sign in',
      render: (a) => (
        <Switch
          checked={a.isActive}
          disabled={a._id === me?._id}
          onChange={(e) => update.mutate({ id: a._id, body: { isActive: e.currentTarget.checked } })}
          aria-label={a.isActive ? 'Deactivate' : 'Activate'}
        />
      ),
    },
    { key: 'lastLogin', header: 'Last sign-in', render: (a) => fromNow(a.lastLogin) },
    { key: 'createdAt', header: 'Added', render: (a) => formatDate(a.createdAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (a) =>
        a._id === me?._id ? null : (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Tooltip label="Reset password">
              <ActionIcon variant="subtle" onClick={() => setResetting(a)} aria-label={`Reset password for ${a.name}`}>
                <IconKey size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete">
              <ActionIcon variant="subtle" color="red" onClick={() => setDeleting(a)} aria-label={`Delete ${a.name}`}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 max-w-2xl">{ROLE_HELP}</p>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
          New admin
        </Button>
      </div>
      <DataTable columns={columns} data={data} loading={isLoading} emptyTitle="No admins" />

      <Modal opened={creating} onClose={() => setCreating(false)} title="New admin" centered>
        {creating && <CreateAdminForm onClose={() => setCreating(false)} />}
      </Modal>

      <Modal opened={newPassword !== null} onClose={() => setNewPassword(null)} title="New password" centered>
        {newPassword && (
          <Stack>
            <Alert color="yellow">
              Share this with {newPassword.admin.name} securely. It is shown only once, and their existing sessions have been signed out.
            </Alert>
            <Group gap="xs" wrap="nowrap">
              <TextInput className="flex-1" readOnly value={newPassword.password} styles={{ input: { fontFamily: 'monospace' } }} />
              <CopyButton value={newPassword.password}>
                {({ copied, copy }) => (
                  <Button variant="light" onClick={copy} leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </CopyButton>
            </Group>
          </Stack>
        )}
      </Modal>

      <ConfirmModal
        open={resetting !== null}
        variant="warning"
        title={`Reset password for ${resetting?.name}?`}
        message="A new random password is generated and they are signed out everywhere."
        confirmLabel="Reset password"
        loading={reset.isPending}
        onConfirm={() => resetting && reset.mutate(resetting)}
        onCancel={() => setResetting(null)}
      />
      <ConfirmModal
        open={deleting !== null}
        title={`Delete ${deleting?.name}?`}
        message="They lose access to the portal immediately. Their past actions stay in the audit log."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
