import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Group, Pagination, Table, Tabs, Textarea, Timeline } from '@mantine/core';
import {
  IconArrowLeft,
  IconBan,
  IconCircleCheck,
  IconDeviceMobile,
  IconEye,
  IconLock,
  IconLogout,
  IconReceipt,
  IconUsersGroup,
} from '@tabler/icons-react';
import { qk } from '@expense/api-client';
import { blockUserSchema, type ActivityLogDTO } from '@expense/shared';
import { api } from '../../lib/api';
import { formatDate, formatDateTime, formatNumber, fromNow, label, money } from '../../lib/format';
import { getApiErrorMessage, notifyError, notifySuccess } from '../../lib/queryClient';
import { useIsSuperAdmin } from '../../hooks/useAuth';
import PageBanner from '../../components/common/PageBanner';
import ConfirmModal from '../../components/common/ConfirmModal';
import Skeleton from '../../components/common/Skeleton';
import { DetailRow, Section, StatCard, StatusBadge } from '../../components/common/widgets';

type Action = 'block' | 'unblock' | 'revoke' | null;

export function ActivityTimeline({ items }: { items: ActivityLogDTO[] }) {
  if (!items.length) return <p className="company-empty-desc">No activity recorded.</p>;
  return (
    <Timeline bulletSize={10} lineWidth={2}>
      {items.map((a) => (
        <Timeline.Item key={a._id} title={label(a.action)}>
          <p className="text-xs text-gray-500">
            {formatDateTime(a.createdAt)}
            {a.actorName ? ` · ${a.actorName}` : ''}
            {a.ip ? ` · ${a.ip}` : ''}
          </p>
          {a.meta && Object.keys(a.meta).length > 0 && (
            <p className="text-xs text-gray-500 font-mono truncate max-w-xl">{JSON.stringify(a.meta)}</p>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

function UserTransactions({ userId, currency }: { userId: string; currency: string }) {
  const [page, setPage] = useState(1);
  const { data: categories } = useQuery({ queryKey: qk.admin.categories, queryFn: api.categories.list });
  const { data, isLoading, error } = useQuery({
    queryKey: qk.admin.userTransactions(userId, page),
    queryFn: () => api.users.transactions(userId, page),
    placeholderData: keepPreviousData,
  });
  const catName = new Map(categories?.map((c) => [c._id, c.name]));

  if (error) return <Alert color="red">{getApiErrorMessage(error)}</Alert>;
  if (isLoading || !data) return <Skeleton className="h-40" />;
  if (!data.items.length) return <p className="company-empty-desc">No transactions.</p>;
  return (
    <>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Note</Table.Th>
            <Table.Th>Method</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.items.map((t) => (
            <Table.Tr key={t._id}>
              <Table.Td>{formatDateTime(t.occurredAt)}</Table.Td>
              <Table.Td>{catName.get(t.categoryId) ?? 'Custom category'}</Table.Td>
              <Table.Td className="max-w-xs truncate">{t.note || '—'}</Table.Td>
              <Table.Td>{label(t.paymentMethod)}</Table.Td>
              <Table.Td ta="right" c={t.type === 'income' ? 'green' : undefined}>
                {t.type === 'income' ? '+' : '−'}
                {money(t.amount, t.currency || currency)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {data.pagination.pages > 1 && (
        <Group justify="flex-end" mt="md">
          <Pagination size="sm" total={data.pagination.pages} value={page} onChange={setPage} />
        </Group>
      )}
    </>
  );
}

export default function UserDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const isSuperAdmin = useIsSuperAdmin();
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const [showMoney, setShowMoney] = useState(false);

  const { data, isLoading, error } = useQuery({ queryKey: qk.admin.user(id), queryFn: () => api.users.get(id) });
  const activity = useQuery({
    queryKey: qk.admin.userActivity(id, activityPage),
    queryFn: () => api.users.activity(id, activityPage),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: async (a: Exclude<Action, null>) => {
      if (a === 'block') await api.users.block(id, reason.trim());
      else if (a === 'unblock') await api.users.unblock(id);
      else await api.users.revokeSessions(id);
      return a;
    },
    onSuccess: (a) => {
      notifySuccess(a === 'block' ? 'User blocked and signed out' : a === 'unblock' ? 'User unblocked' : 'All sessions signed out');
      setAction(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => notifyError(e),
  });

  const confirm = () => {
    if (!action) return;
    if (action === 'block') {
      const parsed = blockUserSchema.safeParse({ reason });
      if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message ?? 'Give a reason');
    }
    mutation.mutate(action);
  };

  if (error) {
    return (
      <Alert color="red" title="Could not load this user">
        {getApiErrorMessage(error)}
      </Alert>
    );
  }
  if (isLoading || !data) return <Skeleton className="h-64" />;

  const { user, sessions, rooms, stats } = data;
  const deleted = user.status === 'deleted';

  return (
    <div className="space-y-4">
      <Link to="/users" className="expense-view-back-btn inline-flex items-center gap-1 text-sm">
        <IconArrowLeft size={16} /> All users
      </Link>
      <PageBanner
        title={deleted ? 'Deleted user' : user.name || 'Unnamed user'}
        subtitle={[user.username && `@${user.username}`, user.phone, user.email].filter(Boolean).join(' · ') || undefined}
        actions={
          deleted
            ? []
            : [
                user.status === 'blocked'
                  ? { label: 'Unblock', icon: <IconCircleCheck size={16} />, onClick: () => setAction('unblock') }
                  : { label: 'Block', icon: <IconBan size={16} />, onClick: () => setAction('block') },
                { label: 'Sign out everywhere', icon: <IconLogout size={16} />, onClick: () => setAction('revoke'), disabled: !sessions.length },
              ]
        }
      >
        <Group gap={6} mt={6}>
          <StatusBadge value={user.status} />
          {user.hasGoogle && <StatusBadge value="Google linked" color="blue" />}
          {!user.onboarded && <StatusBadge value="Not onboarded" color="yellow" />}
        </Group>
      </PageBanner>

      {user.status === 'blocked' && (
        <Alert color="red" icon={<IconBan size={18} />} title={`Blocked ${fromNow(user.blockedAt)}`}>
          {user.blockedReason}
        </Alert>
      )}

      <div className="dashboard-grid-4">
        <StatCard label="Transactions" value={formatNumber(stats.transactionCount)} hint={`Last ${fromNow(stats.lastTransactionAt)}`} Icon={IconReceipt} />
        <StatCard label="Spent / earned" value={money(stats.totalExpense, user.defaultCurrency)} hint={`${money(stats.totalIncome, user.defaultCurrency)} income`} Icon={IconReceipt} tone="bg-rose-100 text-rose-700" />
        <StatCard label="App opens (30d)" value={formatNumber(stats.appOpens30d)} hint={`${formatNumber(stats.screenViews30d)} screen views`} Icon={IconDeviceMobile} tone="bg-emerald-100 text-emerald-700" />
        <StatCard label="Rooms" value={formatNumber(rooms.filter((r) => r.status === 'active').length)} hint={`${stats.categoriesUsed} categories used`} Icon={IconUsersGroup} tone="bg-amber-100 text-amber-700" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="Profile">
          <DetailRow label="Joined">{formatDate(user.createdAt)}</DetailRow>
          <DetailRow label="Last active">{fromNow(user.lastActiveAt)}</DetailRow>
          <DetailRow label="Phone">{user.phone ? `${user.phone}${user.phoneVerified ? ' (verified)' : ''}` : '—'}</DetailRow>
          <DetailRow label="Email">{user.email ?? '—'}</DetailRow>
          <DetailRow label="Currency">{user.defaultCurrency}</DetailRow>
          <DetailRow label="Timezone">{user.timezone}</DetailRow>
          <DetailRow label="Locale">{user.locale}</DetailRow>
        </Section>

        <Section title={`Devices (${sessions.length})`} className="lg:col-span-2">
          {sessions.length === 0 ? (
            <p className="company-empty-desc">No active sessions.</p>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Device</Table.Th>
                  <Table.Th>Platform</Table.Th>
                  <Table.Th>App version</Table.Th>
                  <Table.Th>IP</Table.Th>
                  <Table.Th>Last used</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sessions.map((s) => (
                  <Table.Tr key={s._id}>
                    <Table.Td>{s.deviceName ?? s.deviceId.slice(0, 8)}</Table.Td>
                    <Table.Td>{label(s.platform)}</Table.Td>
                    <Table.Td>{s.appVersion ?? '—'}</Table.Td>
                    <Table.Td>{s.ip ?? '—'}</Table.Td>
                    <Table.Td>{fromNow(s.lastUsedAt)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Section>
      </div>

      <div className="card p-5">
        <Tabs defaultValue="activity" keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="activity">Activity</Tabs.Tab>
            <Tabs.Tab value="rooms">Rooms ({rooms.length})</Tabs.Tab>
            {isSuperAdmin && (
              <Tabs.Tab value="transactions" leftSection={<IconLock size={14} />}>
                Transactions
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="activity">
            {activity.isLoading || !activity.data ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                <ActivityTimeline items={activity.data.items} />
                {activity.data.pagination.pages > 1 && (
                  <Group justify="flex-end" mt="md">
                    <Pagination size="sm" total={activity.data.pagination.pages} value={activityPage} onChange={setActivityPage} />
                  </Group>
                )}
              </>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="rooms">
            {rooms.length === 0 ? (
              <p className="company-empty-desc">Not in any rooms.</p>
            ) : (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Room</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Membership</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rooms.map((r) => (
                    <Table.Tr key={r._id}>
                      <Table.Td>
                        <Link to={`/rooms/${r._id}`} className="text-primary-700 hover:underline">
                          {r.name}
                        </Link>
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge value={r.type} />
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge value={r.role} />
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge value={r.status} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          {isSuperAdmin && (
            <Tabs.Panel value="transactions">
              {showMoney ? (
                <UserTransactions userId={id} currency={user.defaultCurrency} />
              ) : (
                <Alert color="yellow" icon={<IconLock size={18} />} title="Private financial data">
                  <p className="mb-3">Viewing this user's transactions is recorded in the audit log. Only open it when you need to, for example to handle a support request.</p>
                  <Button size="xs" leftSection={<IconEye size={14} />} onClick={() => setShowMoney(true)}>
                    Show transactions
                  </Button>
                </Alert>
              )}
            </Tabs.Panel>
          )}
        </Tabs>
      </div>

      <ConfirmModal
        open={action !== null}
        variant={action === 'unblock' ? 'primary' : action === 'block' ? 'danger' : 'warning'}
        title={action === 'block' ? 'Block this user?' : action === 'unblock' ? 'Unblock this user?' : 'Sign out all devices?'}
        message={
          action === 'block'
            ? 'They are signed out everywhere and cannot sign in until unblocked.'
            : action === 'unblock'
              ? 'They will be able to sign in again.'
              : 'Every session for this user ends; they need to sign in again.'
        }
        confirmLabel={action === 'block' ? 'Block' : action === 'unblock' ? 'Unblock' : 'Sign out'}
        loading={mutation.isPending}
        onConfirm={confirm}
        onCancel={() => {
          setAction(null);
          setReasonError(null);
        }}
      >
        {action === 'block' && (
          <Textarea
            label="Reason"
            description="Shown to other admins in the audit log."
            autosize
            minRows={2}
            value={reason}
            error={reasonError}
            onChange={(e) => {
              setReason(e.currentTarget.value);
              setReasonError(null);
            }}
            data-autofocus
          />
        )}
      </ConfirmModal>
    </div>
  );
}
