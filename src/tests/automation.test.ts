import test from 'node:test';
import { strict as assert } from 'node:assert';
import { HumidityAutomation } from '../automation';
import { DeviceState } from '../types';

const automation = new HumidityAutomation();

const thresholds = { targetHumidity: 62, tolerance: 3 };

const baselineState: DeviceState = { isOn: false, lastToggledAt: null };

const belowState: DeviceState = { isOn: false, lastToggledAt: null };

test('turns humidifier on when humidity is below window and off when above', () => {
  const low = automation.decideAction(55, thresholds, belowState);
  assert.equal(low.action, 'turnOn');
  assert.equal(low.reason, 'Humidity below target window');

  const high = automation.decideAction(70, thresholds, { isOn: true, lastToggledAt: null });
  assert.equal(high.action, 'turnOff');
  assert.equal(high.reason, 'Humidity above target window');
});

test('holds when humidity is in acceptable window', () => {
  const hold = automation.decideAction(62, thresholds, baselineState);
  assert.equal(hold.action, 'hold');
  assert.equal(hold.reason, 'Within target window');
});

test('avoids redundant toggles when already in desired state', () => {
  const alreadyOn = automation.decideAction(50, thresholds, { isOn: true, lastToggledAt: null });
  assert.equal(alreadyOn.action, 'hold');

  const alreadyOff = automation.decideAction(80, thresholds, baselineState);
  assert.equal(alreadyOff.action, 'hold');
});

test('simulate produces timeline entries for each humidity reading', () => {
  const timeline = automation.simulate(
    {
      thresholds,
      sensorLabel: 'AC Infinity Controller',
      humidifierLabel: 'Meross Humidifier',
      humiditySequence: [70, 60, 58],
      sampleIntervalMinutes: 5
    },
    baselineState
  );

  assert.equal(timeline.actions.length, 3);
  assert.equal(timeline.actions[0].action, 'hold');
  assert.equal(timeline.actions[2].action, 'turnOn');
});
