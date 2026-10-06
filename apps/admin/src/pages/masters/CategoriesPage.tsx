import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionIcon, Button, ColorInput, Group, Modal, SegmentedControl, Stack, TextInput, Tooltip } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { qk } from '@expense/api-client';
import { createCategorySchema, UNCATEGORIZED_KEY, type CategoryDTO, type TransactionType } from '@expense/shared';
import { api } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/queryClient';
import { useIsSuperAdmin } from '../../hooks/useAuth';
import PageBanner from '../../components/common/PageBanner';
import DataTable, { type Column } from '../../components/common/DataTable';
import ConfirmModal from '../../components/common/ConfirmModal';
import { StatusBadge } from '../../components/common/widgets';

interface FormState {
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
}

const EMPTY: FormState = { name: '', icon: 'tag-outline', color: '#64748B', type: 'expense' };

function CategoryForm({ initial, onClose }: { initial: CategoryDTO | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(
    initial ? { name: initial.name, icon: initial.icon, color: initial.color, type: initial.type } : EMPTY,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = useMutation({
    mutationFn: ({ type, ...rest }: FormState) =>
      initial ? api.categories.update(initial._id, rest) : api.categories.create({ ...rest, type }),
    onSuccess: () => {
      notifySuccess(initial ? 'Category updated' : 'Category created');
      queryClient.invalidateQueries({ queryKey: qk.admin.categories });
      onClose();
    },
    onError: (e) => notifyError(e),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = createCategorySchema.safeParse(form);
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
          return;
        }
        save.mutate(parsed.data);
      }}
    >
      <Stack>
        {!initial && (
          <SegmentedControl
            data={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
            value={form.type}
            onChange={(v) => set('type', v as TransactionType)}
          />
        )}
        <TextInput label="Name" value={form.name} error={errors.name} onChange={(e) => set('name', e.currentTarget.value)} data-autofocus />
        <TextInput
          label="Icon"
          description="A Material Community Icons name used by the mobile app, e.g. food, car, shopping."
          value={form.icon}
          error={errors.icon}
          onChange={(e) => set('icon', e.currentTarget.value)}
        />
        <ColorInput label="Color" format="hex" value={form.color} error={errors.color} onChange={(v) => set('color', v)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {initial ? 'Save' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const isSuperAdmin = useIsSuperAdmin();
  const [editing, setEditing] = useState<CategoryDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CategoryDTO | null>(null);
  const { data, isLoading } = useQuery({ queryKey: qk.admin.categories, queryFn: api.categories.list });

  const remove = useMutation({
    mutationFn: (id: string) => api.categories.remove(id),
    onSuccess: () => {
      notifySuccess('Category deleted; its entries moved to Uncategorized');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: qk.admin.categories });
    },
    onError: (e) => notifyError(e),
  });

  const columns: Column<CategoryDTO>[] = [
    {
      key: 'name',
      header: 'Category',
      render: (c) => (
        <Group gap="sm" wrap="nowrap">
          <span className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
          <span className="font-medium">{c.name}</span>
        </Group>
      ),
    },
    { key: 'type', header: 'Type', render: (c) => <StatusBadge value={c.type} /> },
    { key: 'icon', header: 'Icon', render: (c) => <code className="text-xs">{c.icon}</code> },
    { key: 'key', header: 'Key', render: (c) => <code className="text-xs text-gray-500">{c.key ?? '—'}</code> },
  ];
  if (isSuperAdmin) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <Tooltip label="Edit">
            <ActionIcon variant="subtle" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          {c.key !== UNCATEGORIZED_KEY && (
            <Tooltip label="Delete">
              <ActionIcon variant="subtle" color="red" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <PageBanner
        title="Categories"
        subtitle="Default categories every user starts with. Users can add their own on top."
        actions={isSuperAdmin ? [{ label: 'New category', icon: <IconPlus size={16} />, onClick: () => setEditing('new') }] : []}
      />
      <DataTable columns={columns} data={data} loading={isLoading} emptyTitle="No categories" />

      <Modal opened={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New category' : 'Edit category'} centered>
        {editing !== null && <CategoryForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title={`Delete "${deleting?.name}"?`}
        message="Existing transactions and room expenses in this category move to Uncategorized. Users will no longer see it."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
