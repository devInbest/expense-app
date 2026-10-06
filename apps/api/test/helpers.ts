import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { bootstrap } from '../src/seed/bootstrap';
import { OtpRequest } from '../src/modules/auth/otp.model';

let mongo: MongoMemoryServer;

export const startTestServer = async (): Promise<Express> => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await bootstrap();
  return createApp();
};

export const stopTestServer = async () => {
  await mongoose.disconnect();
  await mongo?.stop();
};

let phoneSeq = 0;
export const nextPhone = () => `+9198765${String(43210 + (phoneSeq += 1)).padStart(5, '0')}`;

export interface TestUser {
  id: string;
  phone: string;
  accessToken: string;
  refreshToken: string;
  auth: { Authorization: string };
}

/** Signs a phone number in through the real OTP flow (dev code) and finishes onboarding. */
export const signUp = async (app: Express, name: string, phone = nextPhone()): Promise<TestUser> => {
  // Bypass the 30s resend cooldown between tests that reuse a number.
  await OtpRequest.deleteMany({ phone });
  const sent = await request(app).post('/api/v1/auth/otp/request').send({ phone }).expect(200);
  const code = sent.body.data.devCode as string;
  const verified = await request(app)
    .post('/api/v1/auth/otp/verify')
    .send({ phone, code, device: { deviceId: `dev-${phone}`, platform: 'android', appVersion: '1.0.0' } })
    .expect(200);
  const { accessToken, refreshToken, user } = verified.body.data;
  const auth = { Authorization: `Bearer ${accessToken}` };
  if (!user.onboarded) {
    await request(app)
      .post('/api/v1/me/onboarding')
      .set(auth)
      .send({ name, defaultCurrency: 'INR', timezone: 'Asia/Kolkata' })
      .expect(200);
  }
  return { id: user._id, phone, accessToken, refreshToken, auth };
};

export const adminLogin = async (app: Express) => {
  const res = await request(app).post('/api/v1/admin/auth/login').send({ userName: 'superadmin', password: 'super123' }).expect(200);
  return { Authorization: `Bearer ${res.body.data.accessToken}` };
};
