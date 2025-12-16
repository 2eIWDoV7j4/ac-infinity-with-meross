import { HomebridgeClient } from './homebridge';
import { Logger } from './logger';
import { HomebridgeAccessory } from './types';

export interface AcInfinityConnectorOptions {
  accessoryName?: string;
  controllerId?: string;
  logger?: Logger;
}

export interface MerossConnectorOptions {
  accessoryName?: string;
  deviceId?: string;
  logger?: Logger;
}

export class AcInfinityConnector {
  private readonly client: HomebridgeClient;
  private readonly accessoryName?: string;
  private readonly controllerId?: string;
  private readonly logger: Logger;
  private lastAccessory?: HomebridgeAccessory;

  constructor(client: HomebridgeClient, options: AcInfinityConnectorOptions = {}) {
    this.client = client;
    this.accessoryName = options.accessoryName;
    this.controllerId = options.controllerId;
    this.logger = options.logger ?? new Logger('ac-infinity');
  }

  async readHumidity(): Promise<number> {
    const accessories = await this.client.listAccessories();
    const sensor = this.pickAccessory(accessories);
    const humidityCharacteristic = this.findHumidity(sensor);

    if (!humidityCharacteristic) {
      const available = sensor.services.map((service) => service.type).join(', ');
      throw new Error(`Unable to find humidity characteristic on AC Infinity accessory (services: ${available})`);
    }

    const humidityValue = Number(humidityCharacteristic.characteristic.value);
    this.logger.info(
      `AC Infinity humidity read: ${humidityValue}% from ${sensor.displayName} (${sensor.plugin ?? 'unknown plugin'})`
    );
    this.lastAccessory = sensor;
    return humidityValue;
  }

  private pickAccessory(accessories: HomebridgeAccessory[]): HomebridgeAccessory {
    const match = accessories.find((a) => {
      if (this.accessoryName && a.displayName === this.accessoryName) return true;
      if (this.controllerId && a.uuid === this.controllerId) return true;
      return false;
    });

    if (match) return match;

    const pluginMatch = accessories.find((a) => (a.plugin ?? '').toLowerCase().includes('acinfinity'));
    if (pluginMatch) return pluginMatch;

    const fallback = accessories.find((a) =>
      a.services.some((service) => service.type?.toLowerCase().includes('humidity'))
    );
    if (!fallback) {
      throw new Error('AC Infinity accessory not found. Ensure the plugin is installed and accessory is visible.');
    }
    return fallback;
  }

  private findHumidity(accessory: HomebridgeAccessory):
    | { characteristic: { value: unknown }; service: { type: string | undefined } }
    | undefined {
    return accessory.services
      .flatMap((service) => service.characteristics.map((characteristic) => ({ characteristic, service })))
      .find(({ characteristic, service }) => {
        const serviceType = service.type?.toLowerCase() ?? '';
        const characteristicType = characteristic.type?.toLowerCase() ?? '';
        return (
          characteristicType.includes('relativehumidity') ||
          serviceType.includes('humidity') ||
          serviceType.includes('airquality')
        );
      });
  }

  async verifyHumiditySensor(): Promise<void> {
    const accessories = await this.client.listAccessories();
    const sensor = this.pickAccessory(accessories);
    const humidity = this.findHumidity(sensor);

    if (!humidity) {
      throw new Error('AC Infinity humidity sensor reachable but missing humidity characteristic.');
    }

    this.logger.info(
      `Verified AC Infinity accessory ${sensor.displayName} via ${sensor.plugin ?? 'unknown plugin'} exposes humidity.`
    );
    this.lastAccessory = sensor;
  }
}

export class MerossConnector {
  private readonly client: HomebridgeClient;
  private readonly accessoryName?: string;
  private readonly deviceId?: string;
  private readonly logger: Logger;
  private lastAccessory?: HomebridgeAccessory;

  constructor(client: HomebridgeClient, options: MerossConnectorOptions = {}) {
    this.client = client;
    this.accessoryName = options.accessoryName;
    this.deviceId = options.deviceId;
    this.logger = options.logger ?? new Logger('meross');
  }

  async setPower(on: boolean): Promise<void> {
    const accessories = await this.client.listAccessories();
    const accessory = this.pickAccessory(accessories);
    await this.client.setCharacteristic(accessory.uuid, 'On', on);
    this.logger.info(
      `Meross humidifier ${on ? 'ON' : 'OFF'} via Homebridge (${accessory.displayName}, ${accessory.plugin ?? 'unknown plugin'}).`
    );
    this.lastAccessory = accessory;
  }

  private pickAccessory(accessories: HomebridgeAccessory[]): HomebridgeAccessory {
    const match = accessories.find((a) => {
      if (this.accessoryName && a.displayName === this.accessoryName) return true;
      if (this.deviceId && a.uuid === this.deviceId) return true;
      return false;
    });

    if (match) return match;
    const pluginMatch = accessories.find((a) => (a.plugin ?? '').toLowerCase().includes('meross'));
    if (pluginMatch) return pluginMatch;

    const fallback = accessories.find((a) =>
      a.services.some((service) => service.type?.toLowerCase().includes('humidifier'))
    );
    if (!fallback) {
      throw new Error('Meross humidifier accessory not found. Check plugin setup.');
    }
    return fallback;
  }

  async verifyPowerCharacteristic(): Promise<void> {
    const accessories = await this.client.listAccessories();
    const accessory = this.pickAccessory(accessories);
    const hasOn = accessory.services.some((service) =>
      service.characteristics.some((characteristic) => (characteristic.type ?? '').toLowerCase().includes('on'))
    );

    if (!hasOn) {
      throw new Error('Meross accessory reachable but missing On characteristic.');
    }

    this.logger.info(
      `Verified Meross accessory ${accessory.displayName} via ${accessory.plugin ?? 'unknown plugin'} exposes power control.`
    );
    this.lastAccessory = accessory;
  }
}
