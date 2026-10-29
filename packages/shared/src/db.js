import mongoose from 'mongoose';
import { config } from './config.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectMongo(url = config.MONGO_URL) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(url, { serverSelectionTimeoutMS: 5000 });
  logger.debug({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose.connection;
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

export { mongoose };