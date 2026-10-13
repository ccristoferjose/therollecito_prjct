import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// All APIs are mocked; no database or Stripe service is needed.
export default defineConfig({ ...base, testDir: './tests/session', timeout: 30000 });
