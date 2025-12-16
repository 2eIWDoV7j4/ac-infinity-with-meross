import { EnvConfig } from './types';

export function loadEnv(): EnvConfig {
  const port = process.env.HOMEBRIDGE_PORT;
  const parsedPort = port ? parseInt(port, 10) : undefined;
  const pollIntervalSeconds = process.env.POLL_INTERVAL_SECONDS;
  const parsedPollInterval = pollIntervalSeconds ? parseInt(pollIntervalSeconds, 10) : undefined;
  return {
    homebridgeHost: process.env.HOMEBRIDGE_HOST,
    homebridgePort: Number.isNaN(parsedPort) ? undefined : parsedPort,
    homebridgeUsername: process.env.HOMEBRIDGE_USERNAME,
    homebridgePassword: process.env.HOMEBRIDGE_PASSWORD,
    merossDeviceId: process.env.MEROSS_DEVICE_ID,
    merossKey: process.env.MEROSS_KEY,
    merossAccessoryName: process.env.MEROSS_ACCESSORY_NAME,
    acInfinityControllerId: process.env.AC_INFINITY_CONTROLLER_ID,
    acInfinityAccessToken: process.env.AC_INFINITY_ACCESS_TOKEN,
    acInfinityAccessoryName: process.env.AC_INFINITY_ACCESSORY_NAME,
    pollIntervalSeconds: Number.isNaN(parsedPollInterval) ? undefined : parsedPollInterval,
    targetHumidity: process.env.TARGET_HUMIDITY ? parseFloat(process.env.TARGET_HUMIDITY) : undefined,
    tolerance: process.env.HUMIDITY_TOLERANCE ? parseFloat(process.env.HUMIDITY_TOLERANCE) : undefined
  };
}

export function envSummary(config: EnvConfig): string {
  const parts: string[] = [];
  parts.push(`Homebridge host: ${config.homebridgeHost ?? 'not set'}`);
  parts.push(`Homebridge port: ${config.homebridgePort ?? 'not set'}`);
  parts.push(`Homebridge username: ${config.homebridgeUsername ?? 'not set'}`);
  parts.push(`Meross device ID: ${mask(config.merossDeviceId)}`);
  parts.push(`Meross key: ${mask(config.merossKey)}`);
  parts.push(`Meross accessory name: ${config.merossAccessoryName ?? 'not set'}`);
  parts.push(`AC Infinity controller ID: ${mask(config.acInfinityControllerId)}`);
  parts.push(`AC Infinity access token: ${mask(config.acInfinityAccessToken)}`);
  parts.push(`AC Infinity accessory name: ${config.acInfinityAccessoryName ?? 'not set'}`);
  parts.push(`Target humidity: ${config.targetHumidity ?? 'not set'}`);
  parts.push(`Tolerance: ${config.tolerance ?? 'not set'}`);
  parts.push(`Poll interval (s): ${config.pollIntervalSeconds ?? 'not set'}`);
  return parts.join(' | ');
}

function mask(value?: string): string {
  if (!value) return 'not set';
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
