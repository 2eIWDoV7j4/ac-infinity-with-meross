import { HumidityAutomation } from './automation';
import { loadEnv, envSummary } from './config';
import { HomebridgeClient } from './homebridge';
import { Logger } from './logger';
import { AcInfinityConnector, MerossConnector } from './services';
import { AutomationThresholds, DeviceState } from './types';

const logger = new Logger('app');

async function main(): Promise<void> {
  const env = loadEnv();
  logger.info('Environment summary:', envSummary(env));

  if (!env.homebridgeHost || !env.homebridgeUsername || !env.homebridgePassword) {
    throw new Error('HOMEBRIDGE_HOST, HOMEBRIDGE_USERNAME, and HOMEBRIDGE_PASSWORD are required to run the service.');
  }

  const baseUrl = `http://${env.homebridgeHost}:${env.homebridgePort ?? 8581}`;
  const client = new HomebridgeClient({
    baseUrl,
    username: env.homebridgeUsername,
    password: env.homebridgePassword,
    logger
  });

  const acInfinity = new AcInfinityConnector(client, {
    accessoryName: env.acInfinityAccessoryName,
    controllerId: env.acInfinityControllerId,
    logger
  });

  const meross = new MerossConnector(client, {
    accessoryName: env.merossAccessoryName,
    deviceId: env.merossDeviceId,
    logger
  });

  const automation = new HumidityAutomation(logger);
  const thresholds: AutomationThresholds = {
    targetHumidity: env.targetHumidity ?? 62,
    tolerance: env.tolerance ?? 3
  };

  const pollIntervalMs = (env.pollIntervalSeconds ?? 60) * 1000;
  let state: DeviceState = { isOn: false, lastToggledAt: null };

  logger.info(
    `Starting background loop. Target ${thresholds.targetHumidity}% ± ${thresholds.tolerance}%. Polling every ${pollIntervalMs / 1000}s.`
  );

  while (true) {
    try {
      const humidity = await acInfinity.readHumidity();
      const decision = automation.decideAction(humidity, thresholds, state);
      logger.info(`Decision: humidity=${humidity}% -> ${decision.action} (${decision.reason})`);

      if (decision.action === 'turnOn') {
        await meross.setPower(true);
        state = { isOn: true, lastToggledAt: new Date() };
      } else if (decision.action === 'turnOff') {
        await meross.setPower(false);
        state = { isOn: false, lastToggledAt: new Date() };
      }
    } catch (error) {
      logger.error('Loop error:', error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
