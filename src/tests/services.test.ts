import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AcInfinityConnector, MerossConnector } from '../services';
import { HomebridgeAccessory } from '../types';
import { Logger } from '../logger';

const accessories: HomebridgeAccessory[] = [
  {
    aid: 1,
    uuid: 'ac-uuid',
    displayName: 'AC Infinity Grow Tent',
    plugin: 'homebridge-acinfinity',
    services: [
      {
        iid: 1,
        type: 'HumiditySensor',
        name: 'Tent Humidity',
        characteristics: [
          { iid: 2, type: 'CurrentRelativeHumidity', value: 45 }
        ]
      }
    ]
  },
  {
    aid: 2,
    uuid: 'meross-uuid',
    displayName: 'Meross Humidifier',
    plugin: 'homebridge-meross',
    services: [
      {
        iid: 3,
        type: 'HumidifierDehumidifier',
        characteristics: [
          { iid: 4, type: 'On', value: false }
        ]
      }
    ]
  }
];

test('ac infinity connector verifies humidity sensor and reads humidity', async () => {
  const client = {
    listAccessories: async () => accessories
  } as unknown as any;

  const connector = new AcInfinityConnector(client, { logger: new Logger('test-ac') });
  await connector.verifyHumiditySensor();
  const humidity = await connector.readHumidity();
  assert.equal(humidity, 45);
});

test('meross connector verifies power characteristic and sets power', async () => {
  const calls: { uuid: string; value: boolean }[] = [];
  const client = {
    listAccessories: async () => accessories,
    setCharacteristic: async (uuid: string, _characteristic: string, value: boolean) => {
      calls.push({ uuid, value });
    }
  } as unknown as any;

  const connector = new MerossConnector(client, { logger: new Logger('test-meross') });
  await connector.verifyPowerCharacteristic();
  await connector.setPower(true);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.uuid, 'meross-uuid');
  assert.equal(calls[0]?.value, true);
});
