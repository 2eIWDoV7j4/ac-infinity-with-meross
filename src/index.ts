import { HumidityAutomation } from './automation';
import { loadEnv, envSummary } from './config';
import { runBackupFromEnv, scheduleBackupsFromEnv } from './backup';
import { HomebridgeClient } from './homebridge';
import { Logger } from './logger';
import { AcInfinityConnector, MerossConnector } from './services';
import { AutomationThresholds, DeviceState } from './types';

const logger = new Logger('app');
let stopRequested = false;
let wakeLoop: (() => void) | undefined;

function requestStop(signal: NodeJS.Signals): void {
  if (stopRequested) return;
  stopRequested = true;
  logger.info(`${signal} received. Stopping automation loop and running backup...`);
  if (wakeLoop) {
    wakeLoop();
  }
}

process.once('SIGTERM', () => requestStop('SIGTERM'));
process.once('SIGINT', () => requestStop('SIGINT'));

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
  await acInfinity.verifyHumiditySensor();
  await meross.verifyPowerCharacteristic();

  const initialPowerState = await meross.readPowerState();
  let state: DeviceState = { isOn: initialPowerState, lastToggledAt: null };
  const cancelScheduledBackups = scheduleBackupsFromEnv(logger);

  logger.info(
    `Starting background loop. Target ${thresholds.targetHumidity}% ± ${thresholds.tolerance}%. Polling every ${pollIntervalMs / 1000}s.`
  );

  while (!stopRequested) {
    try {
      const isOn = await meross.readPowerState();
      state = { ...state, isOn };

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

    await new Promise<void>((resolve) => {
      wakeLoop = resolve;
      setTimeout(() => {
        wakeLoop = undefined;
        resolve();
      }, pollIntervalMs);
    });
  }

  cancelScheduledBackups();
  logger.info('Automation loop stopped. Triggering final backup before exit...');
  try {
    await runBackupFromEnv(logger);
    logger.info('Final backup completed.');
  } catch (error) {
    logger.error('Failed to run final backup:', error);
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
