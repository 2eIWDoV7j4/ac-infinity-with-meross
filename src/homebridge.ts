import { Logger } from './logger';
import { HomebridgeAccessory } from './types';

interface HomebridgeClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  fetchImpl?: typeof fetch;
  logger?: Logger;
}

interface AuthResponse {
  access_token: string;
}

interface SetCharacteristicRequest {
  characteristicType: string;
  value: unknown;
}

export class HomebridgeClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Logger;
  private token?: string;

  constructor(options: HomebridgeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.username = options.username;
    this.password = options.password;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? new Logger('homebridge-client');
  }

  async login(): Promise<void> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Homebridge login failed: ${response.status} ${body}`);
    }

    const json = (await response.json()) as AuthResponse;
    this.token = json.access_token;
    this.logger.info('Authenticated with Homebridge UI.');
  }

  private async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.token) {
      await this.login();
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {})
      }
    });

    if (response.status === 401) {
      this.logger.info('Token expired, re-authenticating...');
      await this.login();
      return this.authorizedFetch(path, init);
    }

    return response;
  }

  async listAccessories(): Promise<HomebridgeAccessory[]> {
    const response = await this.authorizedFetch('/api/accessories');
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to list accessories: ${response.status} ${body}`);
    }

    return (await response.json()) as HomebridgeAccessory[];
  }

  async setCharacteristic(accessoryUUID: string, characteristicType: string, value: unknown): Promise<void> {
    const response = await this.authorizedFetch(`/api/accessories/${accessoryUUID}`, {
      method: 'PUT',
      body: JSON.stringify(<SetCharacteristicRequest>{ characteristicType, value })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to update ${characteristicType} on ${accessoryUUID}: ${response.status} ${body}`);
    }
  }
}
