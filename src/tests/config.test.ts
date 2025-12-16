import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadEnv } from '../config';

const originalEnv = { ...process.env };

test('loadEnv falls back when poll interval is NaN', () => {
  process.env.POLL_INTERVAL_SECONDS = 'abc';
  const env = loadEnv();
  assert.equal(env.pollIntervalSeconds, undefined);
});

test('loadEnv parses poll interval when valid', () => {
  process.env.POLL_INTERVAL_SECONDS = '120';
  const env = loadEnv();
  assert.equal(env.pollIntervalSeconds, 120);
});

test('restore env', () => {
  process.env = { ...originalEnv };
});
