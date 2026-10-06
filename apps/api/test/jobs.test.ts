import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { JOBS } from '../src/jobs';
import { Notification } from '../src/modules/notifications/notification.model';
import { RoomInvite } from '../src/modules/rooms/room.models';
import { DailyStat } from '../src/modules/stats/dailyStat.model';
import { Transaction } from '../src/modules/transactions/transaction.model';
import { nextPhone, signUp, startTestServer, stopTestServer } from './helpers';

let app: Express;
const api = (path: string) => `/api/v1${path}`;

beforeAll(async () => {
  app = await startTestServer();
});

afterAll(stopTestServer);

describe('cron jobs', () => {
  it('creates recurring transactions once per occurrence, with catch-up', async () => {
    const user = await signUp(app, 'Subscriber');
    const cats = await request(app).get(api('/categories')).set(user.auth);
    const startDate = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await request(app)
      .post(api('/recurring'))
      .set(user.auth)
      .send({ template: { amount: 19900, categoryId: cats.body.data[0]._id, note: 'Gym' }, frequency: 'daily', startDate })
      .expect(201);

    await JOBS.recurring!();
    const first = await Transaction.countDocuments({ userId: user.id, note: 'Gym' });
    expect(first).toBeGreaterThanOrEqual(2);

    await JOBS.recurring!();
    expect(await Transaction.countDocuments({ userId: user.id, note: 'Gym' })).toBe(first);
    expect(await Notification.countDocuments({ userId: user.id, type: 'recurring_created' })).toBeGreaterThan(0);

    // Generated rows reach devices through the normal sync pull.
    const pull = await request(app).get(api('/transactions/sync')).set(user.auth).expect(200);
    expect(pull.body.data.changes.filter((t: { note: string }) => t.note === 'Gym')).toHaveLength(first);
  });

  it('sends each budget threshold alert once per period, even when checks race', async () => {
    const user = await signUp(app, 'Overspender');
    const cats = await request(app).get(api('/categories')).set(user.auth);
    const categoryId = cats.body.data[0]._id;
    await request(app).post(api('/budgets')).set(user.auth).send({ amount: 10000, period: 'monthly' }).expect(201);
    const spend = (amount: number) =>
      request(app).post(api('/transactions')).set(user.auth).send({ amount, categoryId, occurredAt: new Date().toISOString() }).expect(201);

    await spend(8500);
    await Promise.all([JOBS.budgets!(), JOBS.budgets!(), JOBS.budgets!()]);
    let alerts = await Notification.find({ userId: user.id, type: 'budget_threshold' }).lean();
    expect(alerts.map((a) => a.title)).toEqual(['Budget alert']);

    await spend(2000);
    await Promise.all([JOBS.budgets!(), JOBS.budgets!()]);
    alerts = await Notification.find({ userId: user.id, type: 'budget_threshold' }).sort({ createdAt: 1 }).lean();
    expect(alerts.map((a) => a.title)).toEqual(['Budget alert', 'Budget exceeded']);
  });

  it('expires stale invites', async () => {
    const owner = await signUp(app, 'Host');
    const room = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Old', type: 'split' }).expect(201);
    const inv = await request(app)
      .post(api(`/rooms/${room.body.data._id}/invites`))
      .set(owner.auth)
      .send({ channel: 'phone', phone: nextPhone() })
      .expect(201);
    await RoomInvite.updateOne({ _id: inv.body.data._id }, { expiresAt: new Date(Date.now() - 1000) });

    await JOBS.invites!();
    const after = await RoomInvite.findById(inv.body.data._id).lean();
    expect(after?.status).toBe('expired');
  });

  it('aggregates daily stats for the admin dashboard', async () => {
    await JOBS.stats!();
    const today = new Date().toISOString().slice(0, 10);
    const stat = await DailyStat.findOne({ date: today }).lean();
    expect(stat?.newUsers).toBeGreaterThan(0);
  });
});
