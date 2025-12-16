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
      throw new Error(
        `Unable to find humidity characteristic on AC Infinity accessory (services: ${available}). ` +
          'Ensure the homebridge-acinfinity plugin has `exposeSensors: true` so humidity is published.'
      );
    }

    const humidityValue = this.normalizeHumidityValue(humidityCharacteristic.characteristic.value);
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
        const name = (service as { name?: string }).name?.toLowerCase() ?? '';
        const characteristicType = characteristic.type?.toLowerCase() ?? '';
        return (
          characteristicType.includes('relativehumidity') ||
          serviceType.includes('humidity') ||
          name.includes('humidity') ||
          serviceType === 'humidity sensor' ||
          serviceType.includes('airquality')
        );
      });
  }

  private normalizeHumidityValue(value: unknown): number {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      throw new Error(`AC Infinity humidity value is not numeric: ${String(value)}`);
    }

    if (numeric > 0 && numeric <= 1) {
      this.logger.warn('Humidity value appears fractional; assuming percentage and scaling by 100.');
      return numeric * 100;
    }

    return numeric;
  }

  async verifyHumiditySensor(): Promise<void> {
    const accessories = await this.client.listAccessories();
    const sensor = this.pickAccessory(accessories);
    const humidity = this.findHumidity(sensor);

    if (!humidity) {
      throw new Error(
        'AC Infinity humidity sensor reachable but missing humidity characteristic. ' +
          'Enable exposeSensors: true in the homebridge-acinfinity configuration.'
      );
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

  async readPowerState(): Promise<boolean> {
    const accessories = await this.client.listAccessories();
    const accessory = this.pickAccessory(accessories);
    const onCharacteristic = this.findPowerCharacteristic(accessory);

    if (!onCharacteristic) {
      throw new Error('Meross accessory reachable but missing On characteristic.');
    }

    const isOn = this.normalizeOnValue(onCharacteristic.characteristic.value);
    this.logger.info(
      `Meross humidifier state read: ${isOn ? 'ON' : 'OFF'} (${accessory.displayName}, ${accessory.plugin ?? 'unknown plugin'}).`
    );
    this.lastAccessory = accessory;
    return isOn;
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
      a.services.some((service) => {
        const type = service.type?.toLowerCase() ?? '';
        const name = (service as { name?: string }).name?.toLowerCase() ?? '';
        return type.includes('humidifier') || type.includes('fan') || name.includes('humidifier');
      })
    );
    if (!fallback) {
      throw new Error('Meross humidifier accessory not found. Check plugin setup.');
    }
    return fallback;
  }

  async verifyPowerCharacteristic(): Promise<void> {
    const accessories = await this.client.listAccessories();
    const accessory = this.pickAccessory(accessories);
    const onCharacteristic = this.findPowerCharacteristic(accessory);

    if (!onCharacteristic) {
      throw new Error('Meross accessory reachable but missing On characteristic.');
    }

    this.logger.info(
      `Verified Meross accessory ${accessory.displayName} via ${accessory.plugin ?? 'unknown plugin'} exposes power control.`
    );
    this.lastAccessory = accessory;
  }

  private findPowerCharacteristic(
    accessory: HomebridgeAccessory
  ): { characteristic: { value: unknown }; service: { type: string | undefined } } | undefined {
    return accessory.services
      .flatMap((service) => service.characteristics.map((characteristic) => ({ characteristic, service })))
      .find(({ characteristic, service }) => {
        const type = (characteristic.type ?? '').toLowerCase();
        const serviceType = service.type?.toLowerCase() ?? '';
        const name = (service as { name?: string }).name?.toLowerCase() ?? '';
        return type.includes('on') || serviceType.includes('humidifier') || name.includes('humidifier');
      });
  }

  private normalizeOnValue(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
    throw new Error(`Meross On characteristic is not readable: ${String(value)}`);
  }
}
