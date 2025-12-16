import { AutomationThresholds, DeviceState, HumidifierAction, HumiditySample, SimulationAction, SimulationResult } from './types';
import { Logger } from './logger';

export interface DryRunOptions {
  thresholds: AutomationThresholds;
  sensorLabel: string;
  humidifierLabel: string;
  humiditySequence: number[];
  sampleIntervalMinutes: number;
}

export class HumidityAutomation {
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger('automation');
  }

  decideAction(currentHumidity: number, thresholds: AutomationThresholds, state: DeviceState): { action: HumidifierAction; reason: string } {
    if (currentHumidity < thresholds.targetHumidity - thresholds.tolerance) {
      if (state.isOn) {
        return { action: 'hold', reason: 'Already on and still below target window' };
      }
      return { action: 'turnOn', reason: 'Humidity below target window' };
    }

    if (currentHumidity > thresholds.targetHumidity + thresholds.tolerance) {
      if (!state.isOn) {
        return { action: 'hold', reason: 'Already off and above target window' };
      }
      return { action: 'turnOff', reason: 'Humidity above target window' };
    }

    return { action: 'hold', reason: 'Within target window' };
  }

  simulate(options: DryRunOptions, initialState: DeviceState): SimulationResult {
    const actions: SimulationAction[] = [];
    const samples: HumiditySample[] = [];
    let state: DeviceState = { ...initialState };

    this.logger.info(`Starting dry run for ${options.sensorLabel} -> ${options.humidifierLabel}`);
    this.logger.info(`Target ${options.thresholds.targetHumidity}% ± ${options.thresholds.tolerance}% with ${options.sampleIntervalMinutes}m intervals.`);

    options.humiditySequence.forEach((reading, index) => {
      const timestamp = new Date(Date.now() + index * options.sampleIntervalMinutes * 60 * 1000);
      const sample: HumiditySample = { timestamp, humidity: reading };
      samples.push(sample);

      const decision = this.decideAction(sample.humidity, options.thresholds, state);
      if (decision.action === 'turnOn' || decision.action === 'turnOff') {
        state = { isOn: decision.action === 'turnOn', lastToggledAt: sample.timestamp };
      }

      actions.push({
        at: sample.timestamp,
        humidity: sample.humidity,
        action: decision.action,
        reason: decision.reason
      });

      this.logger.info(
        `Sample ${index + 1}: humidity ${sample.humidity}% -> action=${decision.action} (${decision.reason})`
      );
    });

    this.logger.info('Dry run finished.');

    return { actions, samples };
  }
}
