import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { qk } from '@expense/api-client';
import type { RoomDTO, RoomExpenseDTO, RoomMemberDTO } from '@expense/shared';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';

export const useRoom = (id: string) => {
  const user = useUser();
  const query = useQuery({ queryKey: qk.room(id), queryFn: () => api.rooms.get(id) });
  const room = query.data;

  const helpers = useMemo(() => {
    const members: RoomMemberDTO[] = room?.members ?? [];
    const active = members.filter((m) => m.status === 'active');
    const byUser = new Map(members.map((m) => [m.user._id, m]));
    const role = room?.myRole ?? 'member';
    const isManager = role === 'owner' || role === 'admin';
    const archived = Boolean(room?.archivedAt);
    return {
      members,
      active,
      role,
      isManager,
      archived,
      name: (userId: string) => (userId === user._id ? 'You' : byUser.get(userId)?.user.name ?? 'Former member'),
      /** Props for <Avatar>: the real name (so "You" doesn't show a "Y") and the member's photo. */
      avatar: (userId: string) =>
        userId === user._id
          ? { name: user.name, uri: user.avatarUrl }
          : { name: byUser.get(userId)?.user.name ?? 'Former member', uri: byUser.get(userId)?.user.avatarUrl },
      canAddExpense: !archived && (isManager || (room?.settings.membersCanAddExpense ?? true)),
      canInvite: !archived && (isManager || (room?.settings.membersCanInvite ?? true)),
      /** Only the person who added an expense can change it, and never once it's fully settled. */
      canEditExpense: (e: RoomExpenseDTO) => !archived && e.createdBy === user._id && !e.settledAt,
      canMarkPaid: (e: RoomExpenseDTO) => !archived && room?.type === 'split' && e.createdBy === user._id,
    };
  }, [room, user._id, user.name, user.avatarUrl]);

  return { ...query, room: room as RoomDTO | undefined, me: user._id, ...helpers };
};
