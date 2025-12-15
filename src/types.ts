export interface HumiditySensor {
  id: string;
  location?: string;
}

export interface Humidifier {
  id: string;
  name: string;
}

export interface AutomationThresholds {
  /** Target humidity percentage for the grow tent */
  targetHumidity: number;
  /** Allowed swing around the target to avoid rapid toggling */
  tolerance: number;
}

export interface DeviceState {
  isOn: boolean;
  lastToggledAt: Date | null;
}

export type HumidifierAction = 'turnOn' | 'turnOff' | 'hold';

export interface HumiditySample {
  timestamp: Date;
  humidity: number;
}

export interface EnvConfig {
  homebridgeHost?: string;
  homebridgePort?: number;
  homebridgeUsername?: string;
  homebridgePassword?: string;
  merossDeviceId?: string;
  merossKey?: string;
  merossAccessoryName?: string;
  acInfinityControllerId?: string;
  acInfinityAccessToken?: string;
  acInfinityAccessoryName?: string;
  pollIntervalSeconds?: number;
  targetHumidity?: number;
  tolerance?: number;
}

export interface SimulationResult {
  samples: HumiditySample[];
  actions: SimulationAction[];
}

export interface SimulationAction {
  at: Date;
  humidity: number;
  action: HumidifierAction;
  reason: string;
}

export interface HomebridgeService {
  iid: number;
  type: string;
  characteristics: HomebridgeCharacteristic[];
}

export interface HomebridgeCharacteristic {
  iid: number;
  type: string;
  value: unknown;
  perms?: string[];
}

export interface HomebridgeAccessory {
  aid: number;
  uuid: string;
  displayName: string;
  services: HomebridgeService[];
}
