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
  let ready = false;
  let state: DeviceState = { isOn: false, lastToggledAt: null };
  const cancelScheduledBackups = scheduleBackupsFromEnv(logger);

  logger.info(
    `Starting background loop. Target ${thresholds.targetHumidity}% ± ${thresholds.tolerance}%. Polling every ${pollIntervalMs / 1000}s.`
  );

  while (!stopRequested) {
    try {
      if (!ready) {
        logger.info('Attempting to verify Homebridge accessories before starting automation loop...');
        await acInfinity.verifyHumiditySensor();
        await meross.verifyPowerCharacteristic();
        const initialPowerState = await meross.readPowerState();
        state = { isOn: initialPowerState, lastToggledAt: null };
        ready = true;
        logger.info('Homebridge accessories verified; automation loop is live.');
      }

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
      ready = false;
      logger.warn('Homebridge not reachable yet or request failed; will retry after delay.', error);
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
