import {Exclude, Expose, Type} from 'class-transformer';
import {GoveeDevice} from '../../devices/GoveeDevice';
import {PLATFORM_NAME, PLUGIN_NAME} from '../../settings';

type LightType = 'WW' | 'RGB' | 'RGBIC';

export class GoveeDeviceOverride {
  constructor(device?: GoveeDevice) {
    this.ignore = false;
    this.deviceId = device?.deviceId;
    this.model = device?.model;
    this.displayName = device?.name;
  }

  @Expose({name: 'deviceId'})
  deviceId?: string;

  @Expose({name: 'model'})
  model?: string;

  @Expose({name: 'ignore'})
  ignore?: boolean;

  @Expose({name: 'displayName'})
  displayName?: string;
}

export class GoveeLightOverride extends GoveeDeviceOverride {
  constructor(device?: GoveeDevice) {
    super(device);
    this._lightType = 'RGB';
  }

  @Expose({name: '_lightType'})
  _lightType?: LightType;
}

export class GoveeRGBICLightOverride extends GoveeLightOverride {
  constructor(device?: GoveeDevice) {
    super(device);
    this._lightType = 'RGBIC';
    this.hideSegments = false;
  }

  @Expose({name: 'hideSegments'})
  hideSegments?: boolean;
}

export class GoveeDeviceOverrides {
  constructor(
    humidifiers: GoveeDeviceOverride[],
    purifiers: GoveeDeviceOverride[],
    lights: GoveeDeviceOverride[],
  ) {
    this.humidifiers = humidifiers;
    this.airPurifiers = purifiers;
    this.lights = lights;
  }

  @Expose({name: 'airPurifiers'})
  @Type(() => GoveeDeviceOverrides)
  airPurifiers?: GoveeDeviceOverride[];

  @Expose({name: 'humidifiers'})
  @Type(() => GoveeDeviceOverrides)
  humidifiers?: GoveeDeviceOverride[];

  @Expose({name: 'lights'})
  @Type(
    () => GoveeLightOverride,
    {
      discriminator: {
        property: '_lightType',
        subTypes: [
          {
            value: GoveeRGBICLightOverride,
            name: 'RGBIC',
          },
        ],
      },
    },
  )
  lights?: GoveeDeviceOverride[];
}

export class GoveeConnections {
  @Expose({name: 'iot'})
  iot = true;

  @Expose({name: 'ble'})
  ble = true;

  @Expose({name: 'api'})
  api = true;
}

export class GoveePluginConfig {
  @Expose({name: 'name'})
  name: string = PLUGIN_NAME;

  @Expose({name: 'platform'})
  platform: string = PLATFORM_NAME;

  @Expose({name: 'username'})
  username?: string;

  @Expose({name: 'password'})
  password?: string;

  @Expose({name: 'connections'})
  @Type(() => GoveeConnections)
  connections?: GoveeConnections;

  @Expose({name: 'devices'})
  @Type(() => GoveeDeviceOverrides)
  devices?: GoveeDeviceOverrides;

  @Exclude()
  isValid(): boolean {
    return this.username !== undefined || this.password !== undefined;
  }
}

