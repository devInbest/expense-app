import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Group, Select, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { qk } from '@expense/api-client';
import { ROOM_TYPE_VALUES, type AdminRoomRowDTO, type AdminRoomsQuery, type RoomType } from '@expense/shared';
import { api } from '../../lib/api';
import { formatDate, formatNumber, fromNow, label, money } from '../../lib/format';
import { PAGE_SIZE } from '../../constants';
import { useListParams } from '../../hooks/useListParams';
import PageBanner from '../../components/common/PageBanner';
import DataTable, { type Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/widgets';

const columns: Column<AdminRoomRowDTO>[] = [
  {
    key: 'name',
    header: 'Room',
    render: (r) => (
      <div className="min-w-0">
        <p className="font-medium truncate">{r.name}</p>
        <p className="text-xs text-gray-500">by {r.createdBy?.name ?? 'Unknown'}</p>
      </div>
    ),
  },
  { key: 'type', header: 'Type', render: (r) => <StatusBadge value={r.type} /> },
  { key: 'memberCount', header: 'Members', align: 'right', render: (r) => formatNumber(r.memberCount) },
  { key: 'expenseCount', header: 'Expenses', align: 'right', render: (r) => formatNumber(r.expenseCount) },
  { key: 'totalSpent', header: 'Total spent', align: 'right', render: (r) => money(r.totalSpent, r.currency) },
  { key: 'lastActivityAt', header: 'Last activity', render: (r) => fromNow(r.lastActivityAt) },
  { key: 'createdAt', header: 'Created', render: (r) => formatDate(r.createdAt) },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.archivedAt ? 'archived' : 'active'} /> },
];

export default function RoomsPage() {
  const navigate = useNavigate();
  const list = useListParams(['type', 'archived'] as const);
  const query: AdminRoomsQuery = {
    page: list.page,
    limit: PAGE_SIZE,
    q: list.q,
    type: list.filters.type as RoomType | undefined,
    archived: list.filters.archived as AdminRoomsQuery['archived'],
  };
  const { data, isLoading } = useQuery({
    queryKey: qk.admin.rooms(query),
    queryFn: () => api.rooms.list(query),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <PageBanner title="Rooms" subtitle="Split groups and shared budgets" />
      <DataTable
        columns={columns}
        data={data?.items}
        loading={isLoading}
        onRowClick={(r) => navigate(`/rooms/${r._id}`)}
        emptyTitle="No rooms found"
        pagination={data && { ...data.pagination, onPageChange: list.setPage }}
        header={
          <Group gap="sm" className="w-full">
            <TextInput
              className="flex-1 min-w-[220px]"
              placeholder="Search by room name"
              leftSection={<IconSearch size={16} />}
              value={list.search}
              onChange={(e) => list.setSearch(e.currentTarget.value)}
            />
            <Select
              w={170}
              placeholder="Any type"
              clearable
              data={ROOM_TYPE_VALUES.map((t) => ({ value: t, label: label(t) }))}
              value={list.filters.type ?? null}
              onChange={(v) => list.setFilter('type', v)}
            />
            <Select
              w={150}
              placeholder="Any status"
              clearable
              data={[
                { value: 'false', label: 'Active' },
                { value: 'true', label: 'Archived' },
              ]}
              value={list.filters.archived ?? null}
              onChange={(v) => list.setFilter('archived', v)}
            />
          </Group>
        }
      />
    </div>
  );
}
