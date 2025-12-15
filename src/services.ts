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

  constructor(client: HomebridgeClient, options: AcInfinityConnectorOptions = {}) {
    this.client = client;
    this.accessoryName = options.accessoryName;
    this.controllerId = options.controllerId;
    this.logger = options.logger ?? new Logger('ac-infinity');
  }

  async readHumidity(): Promise<number> {
    const accessories = await this.client.listAccessories();
    const sensor = this.pickAccessory(accessories);
    const humidityCharacteristic = sensor.services
      .flatMap((service) => service.characteristics.map((characteristic) => ({ characteristic, service })))
      .find(({ characteristic, service }) =>
        (service.type?.toLowerCase().includes('humidity') ?? false) || characteristic.type?.includes('RelativeHumidity')
      );

    if (!humidityCharacteristic) {
      throw new Error('Unable to find humidity characteristic on AC Infinity accessory');
    }

    const humidityValue = Number(humidityCharacteristic.characteristic.value);
    this.logger.info(`AC Infinity humidity read: ${humidityValue}% from ${sensor.displayName}`);
    return humidityValue;
  }

  private pickAccessory(accessories: HomebridgeAccessory[]): HomebridgeAccessory {
    const match = accessories.find((a) => {
      if (this.accessoryName && a.displayName === this.accessoryName) return true;
      if (this.controllerId && a.uuid === this.controllerId) return true;
      return false;
    });

    if (match) return match;
    const fallback = accessories.find((a) => a.services.some((service) => service.type?.includes('Humidity')));
    if (!fallback) {
      throw new Error('AC Infinity accessory not found. Ensure the plugin is installed and accessory is visible.');
    }
    return fallback;
  }
}

export class MerossConnector {
  private readonly client: HomebridgeClient;
  private readonly accessoryName?: string;
  private readonly deviceId?: string;
  private readonly logger: Logger;

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
    this.logger.info(`Meross humidifier ${on ? 'ON' : 'OFF'} via Homebridge (${accessory.displayName}).`);
  }

  private pickAccessory(accessories: HomebridgeAccessory[]): HomebridgeAccessory {
    const match = accessories.find((a) => {
      if (this.accessoryName && a.displayName === this.accessoryName) return true;
      if (this.deviceId && a.uuid === this.deviceId) return true;
      return false;
    });

    if (match) return match;
    const fallback = accessories.find((a) =>
      a.services.some((service) => service.type?.toLowerCase().includes('humidifier'))
    );
    if (!fallback) {
      throw new Error('Meross humidifier accessory not found. Check plugin setup.');
    }
    return fallback;
  }
}
