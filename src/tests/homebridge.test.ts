import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HomebridgeClient } from '../homebridge';
import { Logger } from '../logger';

test('homebridge client logs in before listing accessories', async () => {
  const calls: { url: string; body?: unknown; method: string; headers?: Record<string, string> }[] = [];
  const fakeFetch: typeof fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', body: (init as any).body, headers: init.headers as any });
    if (url.toString().endsWith('/api/auth/login')) {
      return new Response(JSON.stringify({ access_token: 'token123' }), { status: 200 });
    }
    if (url.toString().endsWith('/api/accessories')) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };

  const client = new HomebridgeClient({ baseUrl: 'http://localhost:8581', username: 'user', password: 'pass', fetchImpl: fakeFetch, logger: new Logger('test') });
  await client.listAccessories();

  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.endsWith('/api/auth/login'));
  assert.ok(calls[1].url.endsWith('/api/accessories'));
  assert.equal(calls[1].headers?.['Authorization'], 'Bearer token123');
});

test('setCharacteristic builds request with correct payload', async () => {
  const calls: { url: string; body?: string; method: string }[] = [];
  const fakeFetch: typeof fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', body: (init as any).body });
    if (url.toString().endsWith('/api/auth/login')) {
      return new Response(JSON.stringify({ access_token: 'tokenXYZ' }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };

  const client = new HomebridgeClient({ baseUrl: 'http://localhost:8581', username: 'user', password: 'pass', fetchImpl: fakeFetch, logger: new Logger('test') });
  await client.setCharacteristic('uuid-123', 'On', true);

  const setCall = calls.find((c) => c.url.includes('/api/accessories/uuid-123'));
  assert.ok(setCall);
  assert.equal(setCall?.method, 'PUT');
  assert.equal(setCall?.body, JSON.stringify({ characteristicType: 'On', value: true }));
});
