// src/config/env.js

import dotenv from 'dotenv';
import { cleanEnv, str, port, url } from 'envalid';

dotenv.config();

export const env = cleanEnv(process.env, {
    NODE_ENV: str({ choices: ['development', 'test', 'production'] }),
    PORT: port({ default: 3000 }),
    MONGODB_URI: url(),
    REDIS_URL: url(),
    PERPLEXITY_API_KEY: str(),
    ZOHO_CLIENT_ID: str(),
    ZOHO_CLIENT_SECRET: str(),
    JWT_SECRET: str()
});