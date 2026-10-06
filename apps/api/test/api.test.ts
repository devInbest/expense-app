import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { adminLogin, nextPhone, signUp, startTestServer, stopTestServer } from './helpers';

let app: Express;

beforeAll(async () => {
  app = await startTestServer();
});

afterAll(stopTestServer);

const api = (path: string) => `/api/v1${path}`;

describe('auth', () => {
  it('reports health', async () => {
    const res = await request(app).get(api('/health')).expect(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('signs up with OTP, then blocks app routes until onboarding', async () => {
    const phone = nextPhone();
    const sent = await request(app).post(api('/auth/otp/request')).send({ phone }).expect(200);
    expect(sent.body.data.devCode).toMatch(/^\d{6}$/);

    const wrong = await request(app).post(api('/auth/otp/verify')).send({ phone, code: '000000' });
    if (sent.body.data.devCode !== '000000') {
      expect(wrong.status).toBe(400);
      expect(wrong.body.code).toBe('OTP_INVALID');
    }

    const ok = await request(app).post(api('/auth/otp/verify')).send({ phone, code: sent.body.data.devCode }).expect(200);
    expect(ok.body.data.isNewUser).toBe(true);
    const auth = { Authorization: `Bearer ${ok.body.data.accessToken}` };

    await request(app).get(api('/categories')).set(auth).expect(403);
    await request(app).post(api('/me/onboarding')).set(auth).send({ name: 'Asha', defaultCurrency: 'INR', timezone: 'Asia/Kolkata' }).expect(200);
    const cats = await request(app).get(api('/categories')).set(auth).expect(200);
    expect(cats.body.data.length).toBeGreaterThan(10);
  });

  it('enforces the OTP resend cooldown', async () => {
    const phone = nextPhone();
    await request(app).post(api('/auth/otp/request')).send({ phone }).expect(200);
    const again = await request(app).post(api('/auth/otp/request')).send({ phone });
    expect(again.status).toBe(429);
  });

  it('rotates refresh tokens and revokes the session on reuse', async () => {
    const user = await signUp(app, 'Rotator');
    const first = await request(app).post(api('/auth/refresh')).send({ refreshToken: user.refreshToken }).expect(200);
    const second = first.body.data.refreshToken;
    expect(second).not.toBe(user.refreshToken);

    await request(app).post(api('/auth/refresh')).send({ refreshToken: second }).expect(200);
    // `second` is now the previous token; replaying it after the grace window would revoke.
    // Replaying the original (two rotations old) is treated as theft immediately.
    const replay = await request(app).post(api('/auth/refresh')).send({ refreshToken: user.refreshToken });
    expect(replay.status).toBe(401);
  });

  it('keeps customer and admin tokens separate', async () => {
    const user = await signUp(app, 'Sneaky');
    await request(app).get(api('/admin/dashboard')).set(user.auth).expect(401);
    const admin = await adminLogin(app);
    await request(app).get(api('/me')).set(admin).expect(401);
  });
});

describe('personal tracking', () => {
  it('creates idempotently, lists, and syncs with last-write-wins', async () => {
    const user = await signUp(app, 'Tracker');
    const cats = await request(app).get(api('/categories')).set(user.auth).expect(200);
    const food = cats.body.data.find((c: { key: string }) => c.key === 'food');

    const body = { clientId: 'client-abc-123', amount: 25000, categoryId: food._id, occurredAt: new Date().toISOString(), note: 'Lunch' };
    const a = await request(app).post(api('/transactions')).set(user.auth).send(body).expect(201);
    const b = await request(app).post(api('/transactions')).set(user.auth).send(body).expect(201);
    expect(b.body.data._id).toBe(a.body.data._id);

    const list = await request(app).get(api('/transactions')).set(user.auth).expect(200);
    expect(list.body.data.items).toHaveLength(1);

    const old = new Date(Date.now() - 60_000).toISOString();
    const newer = new Date(Date.now() + 1000).toISOString();
    const push = await request(app)
      .post(api('/transactions/sync'))
      .set(user.auth)
      .send({
        changes: [
          { clientId: 'client-abc-123', clientUpdatedAt: old, data: { note: 'stale edit' } },
          { clientId: 'offline-new-0001', clientUpdatedAt: newer, data: { amount: 9900, categoryId: food._id, occurredAt: newer } },
          { clientId: 'offline-bad-0002', clientUpdatedAt: newer, data: { amount: 100 } },
        ],
      })
      .expect(200);
    const statuses = push.body.data.results.map((r: { status: string }) => r.status);
    expect(statuses).toEqual(['conflict', 'applied', 'error']);

    const pull = await request(app).get(api('/transactions/sync')).set(user.auth).expect(200);
    expect(pull.body.data.changes).toHaveLength(2);

    const insights = await request(app)
      .get(api('/insights/summary'))
      .query({ from: new Date(Date.now() - 86400_000).toISOString(), to: new Date(Date.now() + 86400_000).toISOString() })
      .set(user.auth)
      .expect(200);
    expect(insights.body.data.totalExpense).toBe(34900);
  });

  it('locks saved transactions and only allows moving them to and from the bin', async () => {
    const user = await signUp(app, 'Binner');
    const cats = await request(app).get(api('/categories')).set(user.auth).expect(200);
    const food = cats.body.data.find((c: { key: string }) => c.key === 'food');
    const t = await request(app)
      .post(api('/transactions'))
      .set(user.auth)
      .send({ clientId: 'bin-client-0001', amount: 5000, categoryId: food._id, occurredAt: new Date().toISOString() })
      .expect(201);
    const url = api(`/transactions/${t.body.data._id}`);

    await request(app).patch(url).set(user.auth).send({ note: 'edit' }).expect(403);
    await request(app).delete(url).set(user.auth).expect(403);

    const later = (ms: number) => new Date(Date.now() + ms).toISOString();
    const push = await request(app)
      .post(api('/transactions/sync'))
      .set(user.auth)
      .send({ changes: [{ clientId: 'bin-client-0001', clientUpdatedAt: later(1000), deleted: true }] })
      .expect(200);
    expect(push.body.data.results[0].status).toBe('error');

    const binned = await request(app)
      .post(api('/transactions/sync'))
      .set(user.auth)
      .send({ changes: [{ clientId: 'bin-client-0001', clientUpdatedAt: later(2000), binned: true, data: { amount: 1 } }] })
      .expect(200);
    expect(binned.body.data.results[0].transaction.binnedAt).toBeTruthy();
    expect(binned.body.data.results[0].transaction.amount).toBe(5000);
    const list = await request(app).get(api('/transactions')).set(user.auth).expect(200);
    expect(list.body.data.items).toHaveLength(0);

    const restored = await request(app).post(`${url}/restore`).set(user.auth).expect(200);
    expect(restored.body.data.binnedAt).toBeNull();
    const after = await request(app).get(api('/transactions')).set(user.auth).expect(200);
    expect(after.body.data.items).toHaveLength(1);
  });

  it('moves transactions to Uncategorized when a custom category is deleted', async () => {
    const user = await signUp(app, 'Organizer');
    const cat = await request(app).post(api('/categories')).set(user.auth).send({ name: 'Pets', color: '#123456' }).expect(201);
    const t = await request(app)
      .post(api('/transactions'))
      .set(user.auth)
      .send({ amount: 5000, categoryId: cat.body.data._id, occurredAt: new Date().toISOString() })
      .expect(201);
    await request(app).delete(api(`/categories/${cat.body.data._id}`)).set(user.auth).expect(200);
    const after = await request(app).get(api(`/transactions/${t.body.data._id}`)).set(user.auth).expect(200);
    expect(after.body.data.categoryId).not.toBe(cat.body.data._id);
  });

  it('tracks budget progress', async () => {
    const user = await signUp(app, 'Budgeter');
    await request(app).post(api('/budgets')).set(user.auth).send({ amount: 10000, period: 'monthly' }).expect(201);
    const cats = await request(app).get(api('/categories')).set(user.auth);
    await request(app)
      .post(api('/transactions'))
      .set(user.auth)
      .send({ amount: 8500, categoryId: cats.body.data[0]._id, occurredAt: new Date().toISOString() })
      .expect(201);
    const budgets = await request(app).get(api('/budgets')).set(user.auth).expect(200);
    expect(budgets.body.data[0].spent).toBe(8500);
    expect(budgets.body.data[0].percent).toBe(85);
  });

  it('exports PDF statements, and guards uploads', async () => {
    const user = await signUp(app, 'Exporter');
    const cats = await request(app).get(api('/categories')).set(user.auth);
    await request(app)
      .post(api('/transactions'))
      .set(user.auth)
      .send({ amount: 12345, categoryId: cats.body.data[0]._id, occurredAt: new Date().toISOString(), note: 'Groceries' })
      .expect(201);
    const range = { from: new Date(Date.now() - 86400_000).toISOString(), to: new Date(Date.now() + 86400_000).toISOString() };

    const pdf = await request(app).get(api('/exports/transactions')).query(range).set(user.auth).buffer(true).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toMatch(/\.pdf"$/);
    expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe('%PDF-');

    await request(app).post(api('/uploads/sign')).set(user.auth).send({ purpose: 'receipt', contentType: 'image/gif', size: 10 }).expect(400);
    await request(app).post(api('/uploads/sign')).set(user.auth).send({ purpose: 'receipt', contentType: 'image/png', size: 10 }).expect(503);
  });
});

describe('rooms', () => {
  it('runs a split room end to end: join, split, settle, leave', async () => {
    const owner = await signUp(app, 'Owner');
    const friend = await signUp(app, 'Friend');
    const third = await signUp(app, 'Third');

    const room = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Goa trip', type: 'split' }).expect(201);
    const roomId = room.body.data._id;
    const code = room.body.data.inviteCode;
    expect(code).toBeTruthy();

    const preview = await request(app).get(api(`/rooms/join/${code}`)).set(friend.auth).expect(200);
    expect(preview.body.data.alreadyMember).toBe(false);
    await request(app).post(api('/rooms/join')).set(friend.auth).send({ code }).expect(200);
    await request(app).post(api('/rooms/join')).set(third.auth).send({ code }).expect(200);

    const dinner = await request(app)
      .post(api(`/rooms/${roomId}/expenses`))
      .set(owner.auth)
      .send({ amount: 10000, note: 'Dinner', occurredAt: new Date().toISOString(), splitType: 'equal' })
      .expect(201);

    const balances = await request(app).get(api(`/rooms/${roomId}/balances`)).set(friend.auth).expect(200);
    expect(balances.body.data.net[owner.id]).toBe(6666);
    expect(balances.body.data.net[friend.id] + balances.body.data.net[third.id]).toBe(-6666);

    const leave = await request(app).post(api(`/rooms/${roomId}/leave`)).set(friend.auth);
    expect(leave.status).toBe(400);
    expect(leave.body.code).toBe('UNSETTLED_BALANCE');

    // Free-form "settle up" payments are gone; shares are settled per expense by its creator.
    await request(app).post(api(`/rooms/${roomId}/settlements`)).set(friend.auth).send({ fromUserId: friend.id, toUserId: owner.id, amount: 3333 }).expect(404);
    const paid = await request(app)
      .post(api(`/rooms/${roomId}/expenses/${dinner.body.data._id}/shares/${friend.id}/paid`))
      .set(owner.auth)
      .send({ paid: true })
      .expect(200);
    expect(paid.body.data.settledAt).toBeNull();
    const payments = await request(app).get(api(`/rooms/${roomId}/settlements`)).set(friend.auth).expect(200);
    expect(payments.body.data[0]).toMatchObject({ fromUserId: friend.id, toUserId: owner.id, expenseId: dinner.body.data._id });
    expect(payments.body.data[0].confirmedAt).toBeTruthy();

    await request(app).post(api(`/rooms/${roomId}/leave`)).set(friend.auth).expect(200);

    const ownerLeave = await request(app).post(api(`/rooms/${roomId}/leave`)).set(owner.auth);
    expect(ownerLeave.body.code).toBe('OWNER_MUST_TRANSFER');

    // Non-members cannot see the room at all.
    const outsider = await signUp(app, 'Outsider');
    await request(app).get(api(`/rooms/${roomId}`)).set(outsider.auth).expect(404);
  });

  it('shares a profile UPI ID with room members only', async () => {
    const owner = await signUp(app, 'Payee');
    const friend = await signUp(app, 'Payer');
    await request(app).patch(api('/me')).set(owner.auth).send({ upiId: 'bad id' }).expect(400);
    const me = await request(app).patch(api('/me')).set(owner.auth).send({ upiId: 'payee@okicici', username: 'payee_upi' }).expect(200);
    expect(me.body.data.upiId).toBe('payee@okicici');

    const search = await request(app).get(api('/users/search')).query({ q: 'payee_upi' }).set(friend.auth).expect(200);
    expect(search.body.data[0].upiId).toBeUndefined();

    const room = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Rent', type: 'split' }).expect(201);
    await request(app).post(api('/rooms/join')).set(friend.auth).send({ code: room.body.data.inviteCode }).expect(200);
    const detail = await request(app).get(api(`/rooms/${room.body.data._id}`)).set(friend.auth).expect(200);
    expect(detail.body.data.members.find((m: { user: { _id: string } }) => m.user._id === owner.id).user.upiId).toBe('payee@okicici');

    // Pay links can only carry a UPI ID, so a bare UPI number is rejected.
    await request(app).patch(api('/me')).set(owner.auth).send({ upiId: '9876543210' }).expect(400);
  });

  it('lets someone who owes mark their own share paid after paying by UPI', async () => {
    const owner = await signUp(app, 'Collector');
    const friend = await signUp(app, 'Debtor');
    const other = await signUp(app, 'Bystander');
    const room = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Trip', type: 'split' }).expect(201);
    const roomId = room.body.data._id;
    await request(app).post(api('/rooms/join')).set(friend.auth).send({ code: room.body.data.inviteCode }).expect(200);
    await request(app).post(api('/rooms/join')).set(other.auth).send({ code: room.body.data.inviteCode }).expect(200);
    const created = await request(app)
      .post(api(`/rooms/${roomId}/expenses`))
      .set(owner.auth)
      .send({ amount: 3000, note: 'Hotel', occurredAt: new Date().toISOString(), splitType: 'equal' })
      .expect(201);
    const paidUrl = (userId: string) => api(`/rooms/${roomId}/expenses/${created.body.data._id}/shares/${userId}/paid`);

    // Without a UPI report, or for someone else's share, it's still creator-only.
    await request(app).post(paidUrl(friend.id)).set(friend.auth).send({ paid: true }).expect(403);
    await request(app).post(paidUrl(other.id)).set(friend.auth).send({ paid: true, upi: { txnId: 'X' } }).expect(403);
    await request(app).post(paidUrl(friend.id)).set(friend.auth).send({ paid: false, upi: {} }).expect(403);

    const res = await request(app).post(paidUrl(friend.id)).set(friend.auth).send({ paid: true, upi: { txnId: 'T123', app: 'PhonePe' } }).expect(200);
    const share = res.body.data.splits.find((s: { userId: string }) => s.userId === friend.id);
    expect(share.paidAt).toBeTruthy();
    expect(share.paidViaUpi).toBe(true);
    expect(share.upiTxnId).toBe('T123');
    const balances = await request(app).get(api(`/rooms/${roomId}/balances`)).set(owner.auth).expect(200);
    expect(balances.body.data.net[friend.id]).toBe(0);

    // The creator can undo it if the money never arrived.
    const undone = await request(app).post(paidUrl(friend.id)).set(owner.auth).send({ paid: false }).expect(200);
    expect(undone.body.data.splits.find((s: { userId: string }) => s.userId === friend.id).paidAt).toBeNull();
  });

  it('lets only the creator edit, mark shares paid, and locks the expense once settled', async () => {
    const owner = await signUp(app, 'Host');
    const friend = await signUp(app, 'Guest');
    const third = await signUp(app, 'Plus one');
    const room = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Weekend', type: 'split' }).expect(201);
    const roomId = room.body.data._id;
    await request(app).post(api('/rooms/join')).set(friend.auth).send({ code: room.body.data.inviteCode }).expect(200);
    await request(app).post(api('/rooms/join')).set(third.auth).send({ code: room.body.data.inviteCode }).expect(200);

    const created = await request(app)
      .post(api(`/rooms/${roomId}/expenses`))
      .set(friend.auth)
      .send({ amount: 9000, note: 'Cab', occurredAt: new Date().toISOString(), paidBy: [{ userId: owner.id, amount: 9000 }], splitType: 'equal' })
      .expect(201);
    // Whoever adds the expense is the payer, whatever the client sends.
    expect(created.body.data.paidBy).toEqual([{ userId: friend.id, amount: 9000 }]);
    expect(created.body.data.paymentMethod).toBe('upi');
    expect(created.body.data.upiId).toBeUndefined();
    const expenseUrl = api(`/rooms/${roomId}/expenses/${created.body.data._id}`);
    const paidUrl = (userId: string) => `${expenseUrl}/shares/${userId}/paid`;

    // Even the room owner can't change someone else's expense.
    await request(app).patch(expenseUrl).set(owner.auth).send({ note: 'Taxi' }).expect(403);
    await request(app).delete(expenseUrl).set(owner.auth).expect(403);
    await request(app).post(paidUrl(third.id)).set(owner.auth).send({ paid: true }).expect(403);
    // The payer owes nothing, so there's nothing to mark.
    await request(app).post(paidUrl(friend.id)).set(friend.auth).send({ paid: true }).expect(400);

    const partly = await request(app).post(paidUrl(owner.id)).set(friend.auth).send({ paid: true }).expect(200);
    expect(partly.body.data.splits.find((s: { userId: string }) => s.userId === owner.id).paidAt).toBeTruthy();
    expect(partly.body.data.settledAt).toBeNull();
    const balances = await request(app).get(api(`/rooms/${roomId}/balances`)).set(owner.auth).expect(200);
    expect(balances.body.data.net[owner.id]).toBe(0);

    // With a paid share, money can't change and the expense can't be deleted, but the note can.
    await request(app).patch(expenseUrl).set(friend.auth).send({ amount: 6000 }).expect(400);
    await request(app).delete(expenseUrl).set(friend.auth).expect(400);
    await request(app).patch(expenseUrl).set(friend.auth).send({ note: 'Airport cab' }).expect(200);
    await request(app).patch(expenseUrl).set(friend.auth).send({ upiId: 'not-a-upi' }).expect(400);
    const payTo = await request(app).patch(expenseUrl).set(friend.auth).send({ paymentMethod: 'upi', upiId: 'guest@okicici' }).expect(200);
    expect(payTo.body.data.upiId).toBe('guest@okicici');

    const settled = await request(app).post(paidUrl(third.id)).set(friend.auth).send({ paid: true }).expect(200);
    expect(settled.body.data.settledAt).toBeTruthy();
    await request(app).patch(expenseUrl).set(friend.auth).send({ note: 'Changed' }).expect(403);
    await request(app).delete(expenseUrl).set(friend.auth).expect(403);
    const after = await request(app).get(api(`/rooms/${roomId}/balances`)).set(owner.auth).expect(200);
    expect(Object.values(after.body.data.net).every((v) => v === 0)).toBe(true);

    // Linked payments are undone from the expense, not deleted directly.
    const payments = await request(app).get(api(`/rooms/${roomId}/settlements`)).set(friend.auth).expect(200);
    expect(payments.body.data).toHaveLength(2);
    await request(app).delete(api(`/rooms/${roomId}/settlements/${payments.body.data[0]._id}`)).set(friend.auth).expect(400);

    const undone = await request(app).post(paidUrl(third.id)).set(friend.auth).send({ paid: false }).expect(200);
    expect(undone.body.data.settledAt).toBeNull();
    const reopened = await request(app).get(api(`/rooms/${roomId}/balances`)).set(owner.auth).expect(200);
    expect(reopened.body.data.net[third.id]).toBe(-3000);
  });

  it('lets only the owner delete a room, and only once balances are settled', async () => {
    const owner = await signUp(app, 'Founder');
    const friend = await signUp(app, 'Mate');
    const room = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Trip', type: 'split' }).expect(201);
    const roomId = room.body.data._id;
    await request(app).post(api('/rooms/join')).set(friend.auth).send({ code: room.body.data.inviteCode }).expect(200);
    const expense = await request(app)
      .post(api(`/rooms/${roomId}/expenses`))
      .set(owner.auth)
      .send({ amount: 2000, occurredAt: new Date().toISOString(), paidBy: [{ userId: owner.id, amount: 2000 }], splitType: 'equal' })
      .expect(201);

    await request(app).delete(api(`/rooms/${roomId}`)).set(friend.auth).expect(403);
    const notArchived = await request(app).delete(api(`/rooms/${roomId}`)).set(owner.auth).expect(400);
    expect(notArchived.body.code).not.toBe('UNSETTLED_BALANCE');

    await request(app).post(api(`/rooms/${roomId}/archive`)).set(owner.auth).expect(200);
    const blocked = await request(app).delete(api(`/rooms/${roomId}`)).set(owner.auth).expect(400);
    expect(blocked.body.code).toBe('UNSETTLED_BALANCE');

    await request(app).post(api(`/rooms/${roomId}/unarchive`)).set(owner.auth).expect(200);
    await request(app).post(api(`/rooms/${roomId}/expenses/${expense.body.data._id}/shares/${friend.id}/paid`)).set(owner.auth).send({ paid: true }).expect(200);
    await request(app).post(api(`/rooms/${roomId}/archive`)).set(owner.auth).expect(200);
    await request(app).delete(api(`/rooms/${roomId}`)).set(owner.auth).expect(200);
    await request(app).get(api(`/rooms/${roomId}`)).set(owner.auth).expect(404);
    const friendRooms = await request(app).get(api('/rooms')).set(friend.auth).expect(200);
    expect(friendRooms.body.data.map((r: { _id: string }) => r._id)).not.toContain(roomId);
  });

  it("reports a user's share of room expenses for their totals", async () => {
    const owner = await signUp(app, 'Spender');
    const friend = await signUp(app, 'Sharer');
    const split = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Dinners', type: 'split', currency: 'INR' }).expect(201);
    await request(app).post(api('/rooms/join')).set(friend.auth).send({ code: split.body.data.inviteCode }).expect(200);
    const flat = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Flat', type: 'shared_budget', currency: 'INR' }).expect(201);
    const abroad = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Abroad', type: 'split', currency: 'USD' }).expect(201);
    const now = new Date().toISOString();
    await request(app).post(api(`/rooms/${split.body.data._id}/expenses`)).set(owner.auth).send({ amount: 1000, occurredAt: now, splitType: 'equal' }).expect(201);
    await request(app).post(api(`/rooms/${flat.body.data._id}/expenses`)).set(owner.auth).send({ amount: 300, occurredAt: now }).expect(201);
    await request(app).post(api(`/rooms/${abroad.body.data._id}/expenses`)).set(owner.auth).send({ amount: 999, occurredAt: now, splitType: 'equal' }).expect(201);

    const range = { from: new Date(Date.now() - 86_400_000).toISOString(), to: new Date(Date.now() + 86_400_000).toISOString() };
    const mine = await request(app).get(api('/rooms/spending')).query(range).set(owner.auth).expect(200);
    // Half of the split dinner plus what I paid in the shared flat; the USD room is left out.
    expect(mine.body.data.total).toBe(800);
    expect(mine.body.data.count).toBe(2);
    const theirs = await request(app).get(api('/rooms/spending')).query(range).set(friend.auth).expect(200);
    expect(theirs.body.data.total).toBe(500);

    const feed = await request(app).get(api('/rooms/spending/items')).query(range).set(friend.auth).expect(200);
    expect(feed.body.data).toHaveLength(1);
    expect(feed.body.data[0]).toMatchObject({ roomName: 'Dinners', amount: 1000, share: 500 });
  });

  it('locks currency after room creation', async () => {
    const owner = await signUp(app, 'Currency');
    const room = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Flat', type: 'shared_budget', currency: 'USD' }).expect(201);
    const roomId = room.body.data._id;
    const locked = await request(app).patch(api(`/rooms/${roomId}`)).set(owner.auth).send({ currency: 'INR' });
    expect(locked.body.code).toBe('CURRENCY_LOCKED');
    await request(app)
      .post(api(`/rooms/${roomId}/expenses`))
      .set(owner.auth)
      .send({ amount: 500, occurredAt: new Date().toISOString(), paidBy: [{ userId: owner.id, amount: 500 }] })
      .expect(201);

    const summary = await request(app).get(api(`/rooms/${roomId}/budget-summary`)).set(owner.auth).expect(200);
    expect(summary.body.data.totalSpent).toBe(500);
  });

  it('delivers phone invites to people who sign up later', async () => {
    const owner = await signUp(app, 'Inviter');
    const room = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Office lunch', type: 'split' }).expect(201);
    const newcomerPhone = nextPhone();
    await request(app).post(api(`/rooms/${room.body.data._id}/invites`)).set(owner.auth).send({ channel: 'phone', phone: newcomerPhone }).expect(201);
    // Re-inviting is a reminder, not a duplicate.
    await request(app).post(api(`/rooms/${room.body.data._id}/invites`)).set(owner.auth).send({ channel: 'phone', phone: newcomerPhone }).expect(201);
    const pending = await request(app).get(api(`/rooms/${room.body.data._id}/invites`)).set(owner.auth).expect(200);
    expect(pending.body.data).toHaveLength(1);

    const newcomer = await signUp(app, 'Newcomer', newcomerPhone);
    const inbox = await request(app).get(api('/invites')).set(newcomer.auth).expect(200);
    expect(inbox.body.data).toHaveLength(1);
    await request(app).post(api(`/invites/${inbox.body.data[0]._id}/accept`)).set(newcomer.auth).expect(200);
    const rooms = await request(app).get(api('/rooms')).set(newcomer.auth).expect(200);
    expect(rooms.body.data.map((r: { _id: string }) => r._id)).toContain(room.body.data._id);
  });
});

describe('admin', () => {
  it('shows the dashboard and can block a user', async () => {
    const admin = await adminLogin(app);
    const victim = await signUp(app, 'Spammer');

    const dash = await request(app).get(api('/admin/dashboard')).set(admin).expect(200);
    expect(dash.body.data.totals.users).toBeGreaterThan(0);

    const users = await request(app).get(api('/admin/users')).query({ q: 'Spammer' }).set(admin).expect(200);
    expect(users.body.data[0]._id).toBe(victim.id);

    await request(app).post(api(`/admin/users/${victim.id}/block`)).set(admin).send({ reason: 'Abuse reports' }).expect(200);
    const blocked = await request(app).get(api('/me')).set(victim.auth);
    expect(blocked.status).toBe(401);

    const login = await request(app).post(api('/auth/refresh')).send({ refreshToken: victim.refreshToken });
    expect(login.status).toBe(401);

    const activity = await request(app).get(api('/admin/activity')).query({ action: 'admin.' }).set(admin).expect(200);
    expect(activity.body.data.some((a: { action: string }) => a.action === 'admin.user_blocked')).toBe(true);
  });

  it('deletes accounts and keeps room history as Former member', async () => {
    const owner = await signUp(app, 'Leaver');
    const friend = await signUp(app, 'Stayer');
    const room = await request(app).post(api('/rooms')).set(owner.auth).send({ name: 'Trip', type: 'split' }).expect(201);
    await request(app).post(api('/rooms/join')).set(friend.auth).send({ code: room.body.data.inviteCode }).expect(200);

    await request(app).delete(api('/me')).query({ confirm: 'DELETE' }).set(owner.auth).expect(200);
    const detail = await request(app).get(api(`/rooms/${room.body.data._id}`)).set(friend.auth).expect(200);
    expect(detail.body.data.myRole).toBe('owner');
    const former = detail.body.data.members.find((m: { user: { _id: string } }) => m.user._id === owner.id);
    expect(former.user.name).toBe('Former member');
  });
});
