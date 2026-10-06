import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge, Group, Select, TextInput } from '@mantine/core';
import { IconBrandGoogle, IconSearch } from '@tabler/icons-react';
import { qk } from '@expense/api-client';
import { USER_STATUS_VALUES, type AdminUserRowDTO, type AdminUsersQuery, type UserStatus } from '@expense/shared';
import { api } from '../../lib/api';
import { formatDate, formatNumber, fromNow, label } from '../../lib/format';
import { PAGE_SIZE } from '../../constants';
import { useListParams } from '../../hooks/useListParams';
import PageBanner from '../../components/common/PageBanner';
import DataTable, { type Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/widgets';

const SORTS = [
  { value: 'createdAt', label: 'Newest first' },
  { value: 'lastActiveAt', label: 'Recently active' },
  { value: 'name', label: 'Name' },
];

const columns: Column<AdminUserRowDTO>[] = [
  {
    key: 'name',
    header: 'User',
    render: (u) => (
      <div className="min-w-0">
        <p className="font-medium truncate">{u.name || 'Unnamed'}</p>
        {u.username && <p className="text-xs text-gray-500">@{u.username}</p>}
      </div>
    ),
  },
  {
    key: 'contact',
    header: 'Contact',
    render: (u) => (
      <div className="text-sm">
        <p>{u.phone ?? '—'}</p>
        {u.email && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            {u.hasGoogle && <IconBrandGoogle size={12} />}
            {u.email}
          </p>
        )}
      </div>
    ),
  },
  { key: 'status', header: 'Status', render: (u) => <StatusBadge value={u.status} /> },
  { key: 'transactionCount', header: 'Transactions', align: 'right', render: (u) => formatNumber(u.transactionCount) },
  { key: 'roomCount', header: 'Rooms', align: 'right', render: (u) => formatNumber(u.roomCount) },
  { key: 'lastActiveAt', header: 'Last active', render: (u) => fromNow(u.lastActiveAt) },
  { key: 'createdAt', header: 'Joined', render: (u) => formatDate(u.createdAt) },
];

export default function UsersPage() {
  const navigate = useNavigate();
  const list = useListParams(['status', 'sort'] as const);
  const query: AdminUsersQuery = {
    page: list.page,
    limit: PAGE_SIZE,
    q: list.q,
    status: list.filters.status as UserStatus | undefined,
    sort: (list.filters.sort as AdminUsersQuery['sort']) ?? 'createdAt',
  };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.admin.users(query),
    queryFn: () => api.users.list(query),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <PageBanner title="Users" subtitle="Customers of the mobile app">
        {data && (
          <Badge variant="white" color="dark" mt={6}>
            {formatNumber(data.pagination.total)} {list.filters.status ? label(list.filters.status).toLowerCase() : 'total'}
          </Badge>
        )}
      </PageBanner>

      <DataTable
        columns={columns}
        data={data?.items}
        loading={isLoading}
        onRowClick={(u) => navigate(`/users/${u._id}`)}
        emptyTitle="No users found"
        emptyDescription={list.q ? 'Try a different name, phone number or email.' : undefined}
        pagination={data && { ...data.pagination, onPageChange: list.setPage }}
        header={
          <Group gap="sm" className="w-full" wrap="wrap">
            <TextInput
              className="flex-1 min-w-[220px]"
              placeholder="Search by name, username, phone or email"
              leftSection={<IconSearch size={16} />}
              value={list.search}
              onChange={(e) => list.setSearch(e.currentTarget.value)}
              rightSection={isFetching && !isLoading ? <span className="text-xs text-gray-400">…</span> : null}
            />
            <Select
              w={160}
              placeholder="Any status"
              clearable
              data={USER_STATUS_VALUES.map((s) => ({ value: s, label: label(s) }))}
              value={list.filters.status ?? null}
              onChange={(v) => list.setFilter('status', v)}
            />
            <Select
              w={170}
              data={SORTS}
              value={list.filters.sort ?? 'createdAt'}
              onChange={(v) => list.setFilter('sort', v === 'createdAt' ? null : v)}
              allowDeselect={false}
            />
          </Group>
        }
      />
    </div>
  );
}
