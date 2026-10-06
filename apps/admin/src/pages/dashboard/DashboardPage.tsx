import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, BarChart, DonutChart } from '@mantine/charts';
import { Alert, SegmentedControl, Table } from '@mantine/core';
import {
  IconActivity,
  IconReceipt,
  IconUserCheck,
  IconUserOff,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { qk } from '@expense/api-client';
import { api } from '../../lib/api';
import { formatNumber, label, percent } from '../../lib/format';
import { getApiErrorMessage } from '../../lib/queryClient';
import { useMe } from '../../hooks/useAuth';
import PageBanner from '../../components/common/PageBanner';
import Skeleton from '../../components/common/Skeleton';
import { Section, StatCard } from '../../components/common/widgets';

const DONUT_COLORS = ['blue.6', 'teal.6', 'orange.6', 'grape.6', 'red.6', 'cyan.6', 'gray.5'];

const toDonut = <T,>(rows: T[], name: (r: T) => string, value: (r: T) => number) =>
  rows.map((r, i) => ({ name: name(r), value: value(r), color: DONUT_COLORS[i % DONUT_COLORS.length]! }));

export default function DashboardPage() {
  const { data: admin } = useMe();
  const [days, setDays] = useState('30');
  const { data, isLoading, error } = useQuery({
    queryKey: qk.admin.dashboard(Number(days)),
    queryFn: () => api.dashboard(Number(days)),
  });

  const trend = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, { date: string; Signups: number; Active: number; Transactions: number }>();
    const row = (date: string) => {
      let r = byDate.get(date);
      if (!r) byDate.set(date, (r = { date, Signups: 0, Active: 0, Transactions: 0 }));
      return r;
    };
    data.signupsSeries.forEach((p) => (row(p.date).Signups = p.count));
    data.activeSeries.forEach((p) => (row(p.date).Active = p.count));
    data.transactionsSeries.forEach((p) => (row(p.date).Transactions = p.count));
    return [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ ...r, date: dayjs(r.date).format('D MMM') }));
  }, [data]);

  return (
    <div className="space-y-4">
      <PageBanner title={`Welcome${admin?.name ? `, ${admin.name}` : ''}`} subtitle="How people are using the app">
        <SegmentedControl
          className="mt-2"
          size="xs"
          value={days}
          onChange={setDays}
          data={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
        />
      </PageBanner>

      {error && (
        <Alert color="red" title="Could not load the dashboard">
          {getApiErrorMessage(error)}
        </Alert>
      )}

      {isLoading || !data ? (
        <div className="dashboard-grid-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <>
          <div className="dashboard-grid-4">
            <StatCard label="Daily active" value={formatNumber(data.dau)} hint={`${percent(data.dau, data.mau)} of monthly`} Icon={IconActivity} />
            <StatCard label="Weekly active" value={formatNumber(data.wau)} Icon={IconUserCheck} tone="bg-emerald-100 text-emerald-700" />
            <StatCard label="Monthly active" value={formatNumber(data.mau)} hint={`${percent(data.mau, data.totals.users)} of all users`} Icon={IconUsers} tone="bg-amber-100 text-amber-700" />
            <StatCard label="Total users" value={formatNumber(data.totals.users)} hint={`${formatNumber(data.totals.activeUsers)} active`} Icon={IconUsers} tone="bg-violet-100 text-violet-700" />
            <StatCard label="Blocked users" value={formatNumber(data.totals.blockedUsers)} Icon={IconUserOff} tone="bg-rose-100 text-rose-700" />
            <StatCard label="Rooms" value={formatNumber(data.totals.rooms)} Icon={IconUsersGroup} tone="bg-teal-100 text-teal-700" />
            <StatCard label="Personal transactions" value={formatNumber(data.totals.transactions)} Icon={IconReceipt} tone="bg-sky-100 text-sky-700" />
            <StatCard label="Room expenses" value={formatNumber(data.totals.roomExpenses)} Icon={IconReceipt} tone="bg-orange-100 text-orange-700" />
          </div>

          <Section title="Activity over time">
            {trend.length === 0 ? (
              <p className="company-empty-desc">No activity in this period yet.</p>
            ) : (
              <AreaChart
                h={280}
                data={trend}
                dataKey="date"
                curveType="monotone"
                withLegend
                series={[
                  { name: 'Active', color: 'brand.6' },
                  { name: 'Signups', color: 'teal.6' },
                  { name: 'Transactions', color: 'orange.6' },
                ]}
              />
            )}
          </Section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Section title="Platforms (active devices)">
              {data.platformSplit.length ? (
                <DonutChart mx="auto" withLabelsLine withLabels data={toDonut(data.platformSplit, (r) => label(r.platform), (r) => r.count)} />
              ) : (
                <p className="company-empty-desc">No devices yet.</p>
              )}
            </Section>
            <Section title="App versions">
              {data.appVersionSplit.length ? (
                <BarChart
                  h={220}
                  data={data.appVersionSplit.map((r) => ({ version: r.appVersion || 'unknown', Devices: r.count }))}
                  dataKey="version"
                  series={[{ name: 'Devices', color: 'brand.6' }]}
                />
              ) : (
                <p className="company-empty-desc">No version data yet.</p>
              )}
            </Section>
            <Section title="Room types">
              {data.roomTypeSplit.length ? (
                <DonutChart mx="auto" withLabelsLine withLabels data={toDonut(data.roomTypeSplit, (r) => label(r.type), (r) => r.count)} />
              ) : (
                <p className="company-empty-desc">No rooms yet.</p>
              )}
            </Section>
          </div>

          <Section title="Retention by signup week">
            {data.retention.length === 0 ? (
              <p className="company-empty-desc">Not enough signups yet to measure retention.</p>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Signup week</Table.Th>
                    <Table.Th ta="right">New users</Table.Th>
                    <Table.Th ta="right">Back in week 1</Table.Th>
                    <Table.Th ta="right">Back in week 4</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.retention.map((r) => (
                    <Table.Tr key={r.cohort}>
                      <Table.Td>{r.cohort}</Table.Td>
                      <Table.Td ta="right">{formatNumber(r.size)}</Table.Td>
                      <Table.Td ta="right">{percent(r.week1, r.size)}</Table.Td>
                      <Table.Td ta="right">{percent(r.week4, r.size)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
