import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Group, Table } from '@mantine/core';
import { IconArrowLeft, IconLock } from '@tabler/icons-react';
import { qk } from '@expense/api-client';
import { api } from '../../lib/api';
import { formatDate, label, money } from '../../lib/format';
import { getApiErrorMessage } from '../../lib/queryClient';
import { useIsSuperAdmin } from '../../hooks/useAuth';
import PageBanner from '../../components/common/PageBanner';
import Skeleton from '../../components/common/Skeleton';
import { DetailRow, Section, StatusBadge } from '../../components/common/widgets';

export default function RoomDetailPage() {
  const { id = '' } = useParams();
  const isSuperAdmin = useIsSuperAdmin();
  const { data, isLoading, error } = useQuery({ queryKey: qk.admin.room(id), queryFn: () => api.rooms.get(id) });

  if (error) {
    return (
      <Alert color="red" title="Could not load this room">
        {getApiErrorMessage(error)}
      </Alert>
    );
  }
  if (isLoading || !data) return <Skeleton className="h-64" />;

  const { room, members, recentExpenses } = data;
  const nameOf = new Map(members.map((m) => [m.user._id, m.user.name]));

  return (
    <div className="space-y-4">
      <Link to="/rooms" className="expense-view-back-btn inline-flex items-center gap-1 text-sm">
        <IconArrowLeft size={16} /> All rooms
      </Link>
      <PageBanner title={room.name} subtitle={`${label(room.type)} · ${room.currency}`}>
        <Group gap={6} mt={6}>
          <StatusBadge value={room.archivedAt ? 'archived' : 'active'} />
        </Group>
      </PageBanner>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="Details">
          <DetailRow label="Created">{formatDate(room.createdAt)}</DetailRow>
          <DetailRow label="Active members">{room.memberCount ?? 0}</DetailRow>
          <DetailRow label="Has expenses">{room.hasExpenses ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Members add expenses">{room.settings.membersCanAddExpense ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Members can invite">{room.settings.membersCanInvite ? 'Yes' : 'No'}</DetailRow>
          {room.type === 'split' && <DetailRow label="Simplify debts">{room.settings.simplifyDebts ? 'Yes' : 'No'}</DetailRow>}
          {room.archivedAt && <DetailRow label="Archived">{formatDate(room.archivedAt)}</DetailRow>}
        </Section>

        <Section title={`Members (${members.length})`} className="lg:col-span-2">
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Member</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Joined</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {members.map((m) => (
                <Table.Tr key={m._id}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <Avatar src={m.user.avatarUrl} size="sm" radius="xl">
                        {m.user.name.charAt(0)}
                      </Avatar>
                      {m.user.deleted ? (
                        <span className="text-gray-500">{m.user.name}</span>
                      ) : (
                        <Link to={`/users/${m.user._id}`} className="text-primary-700 hover:underline">
                          {m.user.name}
                        </Link>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge value={m.role} />
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge value={m.status} />
                  </Table.Td>
                  <Table.Td>{formatDate(m.joinedAt)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Section>
      </div>

      <Section title="Recent expenses">
        {!isSuperAdmin ? (
          <Alert color="gray" icon={<IconLock size={18} />}>
            Expense details are private. Only a superadmin can see them, and each view is audited.
          </Alert>
        ) : recentExpenses.length === 0 ? (
          <p className="company-empty-desc">No expenses yet.</p>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Note</Table.Th>
                <Table.Th>Paid by</Table.Th>
                <Table.Th>Split</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recentExpenses.map((e) => (
                <Table.Tr key={e._id}>
                  <Table.Td>{formatDate(e.occurredAt)}</Table.Td>
                  <Table.Td className="max-w-xs truncate">{e.note || '—'}</Table.Td>
                  <Table.Td>{e.paidBy.map((p) => nameOf.get(p.userId) ?? 'Unknown').join(', ')}</Table.Td>
                  <Table.Td>
                    {label(e.splitType)} · {e.splits.length} people
                  </Table.Td>
                  <Table.Td ta="right">{money(e.amount, room.currency)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Section>
    </div>
  );
}
