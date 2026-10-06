import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, BarChart } from '@mantine/charts';
import { Alert, Group, SegmentedControl, Table } from '@mantine/core';
import dayjs from 'dayjs';
import { qk } from '@expense/api-client';
import { api } from '../../lib/api';
import { formatNumber, label } from '../../lib/format';
import { getApiErrorMessage } from '../../lib/queryClient';
import PageBanner from '../../components/common/PageBanner';
import Skeleton from '../../components/common/Skeleton';
import { Section } from '../../components/common/widgets';

/** Screen route names from Expo Router, made readable: "room/[id]/settle" -> "Room › Settle". */
const screenLabel = (screen: string) =>
  screen
    .split('/')
    .filter((part) => part && !part.startsWith('[') && !part.startsWith('('))
    .map((part) => label(part === 'index' ? 'home' : part))
    .join(' › ') || 'Home';

export default function UsagePage() {
  const [days, setDays] = useState('30');
  const query = { from: dayjs().subtract(Number(days), 'day').startOf('day').toDate() };
  const { data, isLoading, error } = useQuery({
    queryKey: qk.admin.events({ days }),
    queryFn: () => api.events(query),
  });

  return (
    <div className="space-y-4">
      <PageBanner title="App usage" subtitle="Screen views, sessions and feature adoption from the mobile app">
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

      {error && <Alert color="red">{getApiErrorMessage(error)}</Alert>}
      {isLoading || !data ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <Section title="Events per day">
            {data.byDay.length ? (
              <AreaChart
                h={240}
                data={data.byDay.map((d) => ({ date: dayjs(d.date).format('D MMM'), Events: d.count }))}
                dataKey="date"
                curveType="monotone"
                series={[{ name: 'Events', color: 'brand.6' }]}
              />
            ) : (
              <p className="company-empty-desc">No events recorded in this period.</p>
            )}
          </Section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section title="Top screens">
              {data.topScreens.length ? (
                <BarChart
                  h={Math.max(200, data.topScreens.length * 28)}
                  orientation="vertical"
                  yAxisProps={{ width: 140 }}
                  data={data.topScreens.map((s) => ({ screen: screenLabel(s.screen), Views: s.count }))}
                  dataKey="screen"
                  series={[{ name: 'Views', color: 'teal.6' }]}
                />
              ) : (
                <p className="company-empty-desc">No screen views yet.</p>
              )}
            </Section>

            <Section title="Feature adoption">
              {data.features.length ? (
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Feature</Table.Th>
                      <Table.Th ta="right">Uses</Table.Th>
                      <Table.Th ta="right">Users</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.features.map((f) => (
                      <Table.Tr key={f.feature}>
                        <Table.Td>{label(f.feature)}</Table.Td>
                        <Table.Td ta="right">{formatNumber(f.count)}</Table.Td>
                        <Table.Td ta="right">{formatNumber(f.users)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <p className="company-empty-desc">No feature events yet.</p>
              )}
            </Section>
          </div>

          <Section title="All events">
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Event</Table.Th>
                  <Table.Th ta="right">Count</Table.Th>
                  <Table.Th ta="right">Unique users</Table.Th>
                  <Table.Th ta="right">Per user</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.byName.map((e) => (
                  <Table.Tr key={e.name}>
                    <Table.Td>
                      <Group gap={6}>
                        <code className="text-xs">{e.name}</code>
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">{formatNumber(e.count)}</Table.Td>
                    <Table.Td ta="right">{formatNumber(e.users)}</Table.Td>
                    <Table.Td ta="right">{e.users ? (e.count / e.users).toFixed(1) : '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Section>
        </>
      )}
    </div>
  );
}
