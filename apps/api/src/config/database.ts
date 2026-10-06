import mongoose from 'mongoose';
import { env } from './env';

const ATLAS_CHECKLIST = [
  'Atlas checklist:',
  '  1. MONGODB_URI must include a database name, e.g. ...mongodb.net/expense_app_db',
  '  2. Atlas -> Network Access -> allow your IP (or 0.0.0.0/0 for dev)',
  '  3. Confirm username/password in Database Access',
].join('\n');

/** Options tuned for MongoDB Atlas on Windows (TLS / IPv6 issues). */
const connectionOptions: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 15000,
  autoSelectFamily: false,
  family: 4,
};

export const connectDatabase = async (uri = env.mongodbUri): Promise<void> => {
  if (!uri) {
    console.error('MongoDB connection error: MONGODB_URI is not set.');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, connectionOptions);
    console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
  } catch (error) {
    console.error(`MongoDB connection error: ${(error as Error).message}\n\n${ATLAS_CHECKLIST}`);
    process.exit(1);
  }
};

export const disconnectDatabase = () => mongoose.disconnect();
