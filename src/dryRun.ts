import { HumidityAutomation } from './automation';
import { loadEnv, envSummary } from './config';
import { Logger } from './logger';
import { DeviceState } from './types';

const logger = new Logger('dry-run');

function main(): void {
  const config = loadEnv();
  logger.info('Environment summary:', envSummary(config));

  const automation = new HumidityAutomation(logger);
  const initialState: DeviceState = { isOn: false, lastToggledAt: null };

  const result = automation.simulate(
    {
      thresholds: { targetHumidity: 62, tolerance: 3 },
      sensorLabel: config.acInfinityControllerId ?? 'AC Infinity Controller',
      humidifierLabel: config.merossDeviceId ?? 'Meross Humidifier',
      humiditySequence: [70, 65, 62, 58, 60, 63, 66, 61, 59, 62],
      sampleIntervalMinutes: 5
    },
    initialState
  );

  logger.info('Action timeline:');
  result.actions.forEach((action) => {
    logger.info(
      `${action.at.toISOString()} | humidity=${action.humidity}% | action=${action.action} | reason=${action.reason}`
    );
  });
}

main();
