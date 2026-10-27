import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { Env } from '../config/env';
import { InfraToken } from './Container';

export const CONFIG = new InfraToken<Env>('Config');
export const LOGGER = new InfraToken<Logger>('Logger');
export const REDIS = new InfraToken<Redis>('Redis');
