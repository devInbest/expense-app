import type { Request } from 'express';
import type { ActorType } from '@expense/shared';
import { ActivityLog } from './activity.model';

export interface ActivityInput {
  actorType: ActorType;
  actorId?: unknown;
  action: string;
  entity?: string;
  entityId?: unknown;
  roomId?: unknown;
  meta?: Record<string, unknown>;
  req?: Request;
}

/** Fire-and-forget: activity logging must never fail the request that triggered it. */
export const logActivity = (input: ActivityInput): void => {
  const { req, ...rest } = input;
  ActivityLog.create({ ...rest, ip: req?.ip }).catch((err) => {
    console.error('Failed to write activity log:', err.message);
  });
};

export const logUser = (req: Request, action: string, extra: Omit<ActivityInput, 'actorType' | 'actorId' | 'action' | 'req'> = {}) =>
  logActivity({ actorType: 'user', actorId: req.user?._id, action, req, ...extra });

export const logAdmin = (req: Request, action: string, extra: Omit<ActivityInput, 'actorType' | 'actorId' | 'action' | 'req'> = {}) =>
  logActivity({ actorType: 'admin', actorId: req.admin?._id, action, req, ...extra });
