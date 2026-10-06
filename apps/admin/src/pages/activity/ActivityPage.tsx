import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge, CloseButton, Group, Select, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconFilter } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { qk } from '@expense/api-client';
import { ACTOR_TYPE_VALUES, type ActivityLogDTO, type ActorType, type AdminActivityQuery } from '@expense/shared';
import { api } from '../../lib/api';
import { formatDateTime, label } from '../../lib/format';
import { PAGE_SIZE } from '../../constants';
import { useListParams } from '../../hooks/useListParams';
import PageBanner from '../../components/common/PageBanner';
import DataTable, { type Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/widgets';

const ACTION_PRESETS = [
  { value: 'admin.', label: 'Admin actions (audit)' },
  { value: 'admin.viewed', label: 'Admin views of private data' },
  { value: 'user.', label: 'Accounts and sign-ins' },
  { value: 'transaction.', label: 'Transactions' },
  { value: 'room.', label: 'Rooms' },
  { value: 'export.', label: 'Exports' },
];

const entityLink = (a: ActivityLogDTO) => {
  if (!a.entityId) return null;
  if (a.entity === 'user') return `/users/${a.entityId}`;
  if (a.entity === 'room') return `/rooms/${a.entityId}`;
  return null;
};

export default function ActivityPage() {
  const list = useListParams(['actorType', 'actorId', 'action', 'from', 'to'] as const);
  const { actorType, actorId, action, from, to } = list.filters;
  const query: AdminActivityQuery = {
    page: list.page,
    limit: PAGE_SIZE,
    actorType: actorType as ActorType | undefined,
    actorId,
    action,
    from: from ? dayjs(from).startOf('day').toDate() : undefined,
    to: to ? dayjs(to).endOf('day').toDate() : undefined,
  };
  const { data, isLoading } = useQuery({
    queryKey: qk.admin.activity(query),
    queryFn: () => api.activity(query),
    placeholderData: keepPreviousData,
  });

  const columns: Column<ActivityLogDTO>[] = [
    { key: 'createdAt', header: 'When', width: 170, render: (a) => <span className="whitespace-nowrap">{formatDateTime(a.createdAt)}</span> },
    {
      key: 'actor',
      header: 'Actor',
      render: (a) => (
        <Group gap={6} wrap="nowrap">
          <StatusBadge value={a.actorType} />
          {a.actorId ? (
            <Tooltip label="Only show this actor">
              <button type="button" className="text-primary-700 hover:underline text-left" onClick={() => list.setFilter('actorId', a.actorId!)}>
                {a.actorName ?? 'Unknown'}
              </button>
            </Tooltip>
          ) : (
            <span>{a.actorName ?? 'System'}</span>
          )}
        </Group>
      ),
    },
    { key: 'action', header: 'Action', render: (a) => <code className="text-xs">{a.action}</code> },
    {
      key: 'entity',
      header: 'Target',
      render: (a) => {
        const to = entityLink(a);
        if (!a.entity) return '—';
        return to ? (
          <Link to={to} className="text-primary-700 hover:underline">
            {label(a.entity)}
          </Link>
        ) : (
          label(a.entity)
        );
      },
    },
    {
      key: 'meta',
      header: 'Details',
      render: (a) =>
        a.meta && Object.keys(a.meta).length ? (
          <span className="text-xs font-mono text-gray-500 block max-w-sm truncate" title={JSON.stringify(a.meta, null, 2)}>
            {JSON.stringify(a.meta)}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'ip', header: 'IP', render: (a) => a.ip ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <PageBanner title="Activity log" subtitle="What users and admins did, newest first. Entries older than the retention window are removed automatically." />
      <DataTable
        columns={columns}
        data={data?.items}
        loading={isLoading}
        emptyTitle="No activity matches these filters"
        pagination={data && { ...data.pagination, onPageChange: list.setPage }}
        header={
          <Group gap="sm" className="w-full" align="flex-end">
            <Select
              w={150}
              label="Actor type"
              placeholder="Anyone"
              clearable
              data={ACTOR_TYPE_VALUES.map((t) => ({ value: t, label: label(t) }))}
              value={actorType ?? null}
              onChange={(v) => list.setFilter('actorType', v)}
            />
            <Select
              w={220}
              label="Action"
              placeholder="Any action"
              clearable
              searchable
              leftSection={<IconFilter size={14} />}
              data={ACTION_PRESETS}
              value={ACTION_PRESETS.some((p) => p.value === action) ? action! : null}
              onChange={(v) => list.setFilter('action', v)}
            />
            <TextInput
              w={200}
              label="Action starts with"
              placeholder="e.g. room.member"
              value={action ?? ''}
              onChange={(e) => list.setFilter('action', e.currentTarget.value.trim() || null)}
            />
            <DatePickerInput
              type="range"
              w={260}
              label="Date range"
              placeholder="Any time"
              clearable
              maxDate={new Date()}
              value={[from ?? null, to ?? null]}
              onChange={([start, end]) =>
                list.setFilters({
                  from: start ? dayjs(start).format('YYYY-MM-DD') : null,
                  to: end ? dayjs(end).format('YYYY-MM-DD') : null,
                })
              }
            />
            {actorId && (
              <Badge size="lg" variant="light" rightSection={<CloseButton size="xs" onClick={() => list.setFilter('actorId', null)} aria-label="Clear actor filter" />}>
                One actor only
              </Badge>
            )}
          </Group>
        }
      />
    </div>
  );
}
