import 'dotenv/config';

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';
const DB_NAME = process.env.MONGODB_DB_NAME || 'expense_app_db';

/** Ensure an Atlas URI has a database name + standard query params. */
export const normalizeMongoUri = (rawUri?: string): string | null => {
  if (!rawUri) return null;
  let uri = rawUri.trim();
  if (uri.includes('.mongodb.net') && !/\.mongodb\.net\/[a-zA-Z0-9_-]+/.test(uri)) {
    uri = uri.replace(/\.mongodb\.net\/?/, `.mongodb.net/${DB_NAME}`);
  }
  if (uri.includes('.mongodb.net') && !uri.includes('retryWrites=')) {
    uri += uri.includes('?') ? '&retryWrites=true&w=majority' : '?retryWrites=true&w=majority';
  }
  return uri;
};

const secret = (key: string, devFallback: string): string => {
  const value = process.env[key];
  if (value) return value;
  if (isProduction) throw new Error(`${key} must be set in production`);
  return devFallback;
};

const list = (value?: string) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: NODE_ENV,
  isProduction,
  isTest,
  isDev: !isProduction && !isTest,
  port: parseInt(process.env.PORT || '', 10) || 5099,
  mongodbUri: normalizeMongoUri(process.env.MONGODB_URI),

  jwt: {
    secret: secret('JWT_SECRET', 'dev-secret-change-me'),
    adminSecret: secret('ADMIN_JWT_SECRET', 'dev-admin-secret-change-me'),
    accessExpiresIn: (process.env.JWT_EXPIRES_IN || '15m') as `${number}m`,
    refreshTtlDays: parseInt(process.env.REFRESH_TTL_DAYS || '', 10) || 30,
    adminRefreshTtlDays: parseInt(process.env.ADMIN_REFRESH_TTL_DAYS || '', 10) || 7,
  },
  /** Used to hash OTP codes and refresh tokens. */
  hashSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret'),

  adminUrl: process.env.ADMIN_URL || process.env.FRONTEND_URL || 'http://localhost:5199',
  /** Public base for invite links; the mobile app registers it as a universal link domain. */
  appLinkBase: process.env.APP_LINK_BASE || 'expenseapp://',

  superadmin: {
    userName: (process.env.SUPERADMIN_USERNAME || 'superadmin').trim().toLowerCase(),
    password: process.env.SUPERADMIN_PASSWORD || 'super123',
  },

  sms: {
    provider: (process.env.SMS_PROVIDER || 'console') as 'console' | 'msg91' | 'twilio',
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || '',
    templateId: process.env.SMS_TEMPLATE_ID || '',
    inviteTemplateId: process.env.SMS_INVITE_TEMPLATE_ID || '',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioFrom: process.env.TWILIO_FROM || '',
  },

  google: {
    clientIds: list(process.env.GOOGLE_CLIENT_IDS),
  },

  storage: {
    bucket: process.env.STORAGE_BUCKET || '',
    region: process.env.STORAGE_REGION || 'auto',
    endpoint: process.env.STORAGE_ENDPOINT || '',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
    publicUrl: process.env.STORAGE_PUBLIC_URL || '',
  },

  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || '',
};

const requiredSmsVars: Record<typeof env.sms.provider, string[]> = {
  console: [],
  msg91: ['SMS_API_KEY', 'SMS_SENDER_ID', 'SMS_TEMPLATE_ID'],
  twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'],
};
const smsRequired = requiredSmsVars[env.sms.provider];
if (!smsRequired) throw new Error(`SMS_PROVIDER must be one of: ${Object.keys(requiredSmsVars).join(', ')}`);
const smsMissing = smsRequired.filter((key) => !process.env[key]?.trim());
if (smsMissing.length) throw new Error(`SMS_PROVIDER=${env.sms.provider} needs ${smsMissing.join(', ')}`);
