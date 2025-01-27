import {AccessoryService, IdentifiedService, ServiceSubType} from './AccessoryService';
import {Inject} from '@nestjs/common';
import {PLATFORM_CHARACTERISTICS, PLATFORM_SERVICES, SEGMENT_COUNT} from '../../../util/const';
import {Characteristic, CharacteristicValue, PlatformAccessory, Service, WithUUID} from 'homebridge';
import {GoveeDevice} from '../../../devices/GoveeDevice';
import {EventEmitter2} from '@nestjs/event-emitter';
import {DeviceCommandEvent} from '../../../core/events/devices/DeviceCommand';
import {LoggingService} from '../../../logging/LoggingService';
import {OnOffState} from '../../../devices/states/OnOff';
import {DeviceColorTransition} from '../../../core/structures/devices/transitions/DeviceColorTransition';
import {ColorRGB, hsvToRGB, kelvinToRGB, rgbToHSV, rgbToKelvin} from '../../../util/colorUtils';
import {DeviceColorTemperatureTransition} from '../../../core/structures/devices/transitions/DeviceColorTemperatureTransition';
import {GoveeLight} from '../../../devices/implmentations/GoveeLight';
import {DeviceTransition} from '../../../core/structures/devices/DeviceTransition';
import {GoveeRGBLight} from '../../../devices/implmentations/GoveeRGBLight';
import {ServiceRegistry} from '../ServiceRegistry';
import {DeviceBrightnessTransition} from '../../../core/structures/devices/transitions/DeviceBrightnessTransition';
import {SolidColorState} from '../../../devices/states/SolidColor';
import {ModesState} from '../../../devices/states/Modes';
import {DeviceMode} from '../../../devices/states/modes/DeviceMode';
import {GoveeRGBICLight} from '../../../devices/implmentations/GoveeRGBICLight';
import {ColorSegmentsMode} from '../../../devices/states/modes/ColorSegments';
import {
  DeviceBrightnessSegmentTransition,
  DeviceColorSegmentTransition,
} from '../../../core/structures/devices/transitions/DeviceColorSegmentTransition';
import {DeviceColorWCTransition} from '../../../core/structures/devices/transitions/DeviceColorWCTransition';
import {PlatformConfigService} from '../../config/PlatformConfigService';
import {GoveeDeviceOverride, GoveeRGBICLightOverride} from '../../config/GoveePluginConfig';
import {ColorMode} from '../../../devices/states/modes/Color';
import {DeviceOnOffTransition} from '../../../core/structures/devices/transitions/DeviceOnOffTransition';

abstract class BaseLightService<LightType extends GoveeDevice, IdentifierType> extends AccessoryService<IdentifierType> {
  protected readonly serviceType: WithUUID<typeof Service> = this.SERVICES.Lightbulb;

  protected constructor(
    eventEmitter: EventEmitter2,
    configService: PlatformConfigService,
    @Inject(PLATFORM_SERVICES) SERVICES: typeof Service,
    @Inject(PLATFORM_CHARACTERISTICS) CHARACTERISTICS: typeof Characteristic,
    log: LoggingService,
  ) {
    super(
      eventEmitter,
      configService,
      SERVICES,
      CHARACTERISTICS,
      log,
    );
  }

  protected updateServiceCharacteristics(
    service: Service,
    device: GoveeDevice,
    serviceIdentifier?: IdentifierType,
  ) {
    const deviceColor =
      this.getColor(
        device as LightType,
        serviceIdentifier,
      );
    const isOn: boolean =
      (serviceIdentifier ?? -1) < 0
        ? (device as unknown as OnOffState).isOn ?? false
        : (
          this.getBrightness(
          device as LightType,
          serviceIdentifier,
          ) ?? 0) > 0;
    service
      .getCharacteristic(this.CHARACTERISTICS.On)
      .updateValue(isOn)
      .onSet(
        async (value: CharacteristicValue) =>
          this.emit(
            new DeviceCommandEvent(
              this.getPowerTransition(
                device as LightType,
                value as boolean,
                serviceIdentifier,
              ),
            ),
          ),
      );
    service
      .getCharacteristic(this.CHARACTERISTICS.Brightness)
      .updateValue(
        this.getBrightness(
          device as LightType,
          serviceIdentifier,
        ) || 0,
      )
      .onSet(
        async (value: CharacteristicValue) =>
          await this.emitAsync(
            new DeviceCommandEvent(
              this.getBrightnessTransition(
                device as LightType,
                value as number,
                serviceIdentifier,
              ),
            ),
          ),
      );
    service
      .getCharacteristic(this.CHARACTERISTICS.ColorTemperature)
      .onSet(
        async (value: CharacteristicValue) => {
          const color = kelvinToRGB(value as number || 0);
          await this.emitAsync(
            new DeviceCommandEvent(
              this.getColorTemperatureTransition(
                device as LightType,
                color,
                value as number,
                serviceIdentifier,
              ),
            ),
          );
        },
      );
    service
      .getCharacteristic(this.CHARACTERISTICS.Hue)
      .onSet(
        async (value: CharacteristicValue) =>
          await this.emitAsync(
            new DeviceCommandEvent(
              this.getColorTransition(
                device as LightType,
                hsvToRGB(
                  value as number || 0,
                  service.getCharacteristic(
                    this.CHARACTERISTICS.Saturation,
                  ).value as number || 0,
                ),
                serviceIdentifier,
              ),
            ),
          ),
      );
    service
      .getCharacteristic(this.CHARACTERISTICS.Saturation);
    if (deviceColor) {
      service.updateCharacteristic(
        this.CHARACTERISTICS.Hue,
        rgbToHSV(deviceColor).hue,
      );
      service.updateCharacteristic(
        this.CHARACTERISTICS.Saturation,
        rgbToHSV(deviceColor).saturation,
      );
      // service.updateCharacteristic(
      //   this.CHARACTERISTICS.ColorTemperature,
      //   rgbToKelvin(deviceColor),
      // );
    }
  }

  protected abstract getColor(
    device: LightType,
    identifier?: IdentifierType,
  ): ColorRGB | undefined;

  protected abstract getBrightness(
    device: LightType,
    identifier?: IdentifierType,
  ): number | undefined;

  protected abstract getPowerTransition(
    device: LightType,
    on: boolean,
    identifier?: IdentifierType,
  ): DeviceTransition<LightType>;

  protected abstract getBrightnessTransition(
    device: LightType,
    brightness: number,
    identifier?: IdentifierType,
  ): DeviceTransition<LightType>;

  protected abstract getColorTransition(
    device: LightType,
    color: ColorRGB,
    identifier?: IdentifierType,
  ): DeviceTransition<LightType>;

  protected abstract getColorTemperatureTransition(
    device: LightType,
    color: ColorRGB,
    temperature: number,
    identifier?: IdentifierType,
  ): DeviceTransition<LightType>;
}

@ServiceRegistry.register
export class WhiteLightService extends BaseLightService<GoveeLight, void> {

  constructor(
    eventEmitter: EventEmitter2,
    configService: PlatformConfigService,
    SERVICES: typeof Service,
    CHARACTERISTICS: typeof Characteristic,
    log: LoggingService,
  ) {
    super(
      eventEmitter,
      configService,
      SERVICES,
      CHARACTERISTICS,
      log,
    );
  }

  protected supports(device: GoveeDevice): boolean {
    return device instanceof GoveeLight
      && !(device instanceof GoveeRGBLight);
  }

  protected getBrightness(
    device: GoveeLight,
  ): number | undefined {
    return device.brightness;
  }

  protected getColor(
    device: GoveeLight,
  ): ColorRGB | undefined {
    return device.colorTemperature;
  }

  protected getPowerTransition(
    device: GoveeLight,
    on: boolean,
  ): DeviceTransition<GoveeLight> {
    return new DeviceOnOffTransition(
      device.deviceId,
      on,
    );
  }


  protected getBrightnessTransition(
    device: GoveeLight,
    brightness: number,
  ): DeviceTransition<GoveeLight> {
    return new DeviceBrightnessTransition(
      device.deviceId,
      brightness,
    );
  }

  protected getColorTransition(
    device: GoveeLight,
    color: ColorRGB,
  ): DeviceTransition<GoveeLight> {
    return this.getColorTemperatureTransition(
      device,
      color,
      rgbToKelvin(color),
    );
  }

  protected getColorTemperatureTransition(
    device: GoveeLight,
    color: ColorRGB,
    temperature: number,
  ): DeviceColorTemperatureTransition {
    return new DeviceColorTemperatureTransition(
      device.deviceId,
      color,
      temperature,
    );
  }
}

@ServiceRegistry.register
export class RGBLightService extends BaseLightService<GoveeRGBLight, void> {
  constructor(
    eventEmitter: EventEmitter2,
    configService: PlatformConfigService,
    SERVICES: typeof Service,
    CHARACTERISTICS: typeof Characteristic,
    log: LoggingService,
  ) {
    super(
      eventEmitter,
      configService,
      SERVICES,
      CHARACTERISTICS,
      log,
    );
  }

  protected supports(device: GoveeDevice): boolean {
    return device instanceof GoveeRGBLight;
  }

  protected getBrightness(
    device: GoveeRGBLight,
  ): number | undefined {
    if (device.pactType === 1 && device.brightness !== undefined) {
      return Math.round(device.brightness / 255 * 100);
    }
    return device.brightness;
  }

  protected getColor(
    device: GoveeRGBLight,
  ): ColorRGB | undefined {
    const colorState = device as unknown as SolidColorState;
    const modeState = device as unknown as ModesState;
    if (colorState) {
      return colorState.solidColor;
    } else if (modeState) {
      const colorMode = Array.from(
        modeState.modes.values(),
      ).find(
        (deviceMode: DeviceMode) => deviceMode instanceof ColorMode,
      ) as ColorMode;
      return colorMode.solidColor;
    }
  }

  protected getPowerTransition(
    device: GoveeRGBLight,
    on: boolean,
  ): DeviceTransition<GoveeLight> {
    return new DeviceOnOffTransition(
      device.deviceId,
      on,
    );
  }

  protected getBrightnessTransition(
    device: GoveeLight,
    brightness: number,
  ): DeviceTransition<GoveeLight> {
    if (device.pactType === 1) {
      brightness = Math.floor(brightness / 100 * 255);
    }
    return new DeviceBrightnessTransition(
      device.deviceId,
      brightness,
    );
  }

  protected getColorTransition(
    device: GoveeRGBLight,
    color: ColorRGB,
  ): DeviceTransition<GoveeRGBLight> {
    return new DeviceColorTransition(
      device.deviceId,
      color,
    );
  }

  protected getColorTemperatureTransition(
    device: GoveeRGBLight,
    color: ColorRGB,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    temperature: number,
  ): DeviceTransition<GoveeRGBLight> {
    return new DeviceColorTransition(
      device.deviceId,
      color,
    );
  }
}


@ServiceRegistry.register
export class SegmentedLightService extends BaseLightService<GoveeRGBICLight, number> {
  protected readonly subTypes?: ServiceSubType<number>[] =
    Array.of(
      new ServiceSubType(
        'All Segments',
        -1,
        'All Segments',
        true,
      ),
    ).concat(
      ...Array.from(
        new Array(SEGMENT_COUNT),
        (value, index: number) => {
          const name = `Segment ${index + 1}`;
          return new ServiceSubType(
            name,
            index,
            name,
            undefined,
            true,
          );
        },
      ),
    );

  constructor(
    eventEmitter: EventEmitter2,
    configService: PlatformConfigService,
    SERVICES: typeof Service,
    CHARACTERISTICS: typeof Characteristic,
    log: LoggingService,
  ) {
    super(
      eventEmitter,
      configService,
      SERVICES,
      CHARACTERISTICS,
      log,
    );
  }

  protected supports(device: GoveeDevice): boolean {
    return device instanceof GoveeRGBICLight;
  }

  protected getBrightness(
    device: GoveeRGBICLight,
    identifier: number,
  ): number | undefined {
    const colorSegmentMode = Array.from(
      device.modes.values(),
    ).find(
      (deviceMode: DeviceMode) => deviceMode instanceof ColorSegmentsMode,
    ) as ColorSegmentsMode;
    if (!colorSegmentMode) {
      return undefined;
    }

    if (identifier < 0) {
      return colorSegmentMode.wholeBrightness;
    }
    return colorSegmentMode.colorSegments[identifier].brightness;
  }

  protected getColor(
    device: GoveeRGBICLight,
    identifier: number,
  ): ColorRGB | undefined {
    const colorSegmentMode = Array.from(
      device.modes.values(),
    ).find(
      (deviceMode: DeviceMode) => deviceMode instanceof ColorSegmentsMode,
    ) as ColorSegmentsMode;
    if (!colorSegmentMode) {
      return undefined;
    }

    if (identifier < 0) {
      return colorSegmentMode.wholeColor;
    }
    return colorSegmentMode.colorSegments[identifier].color;
  }

  protected getPowerTransition(
    device: GoveeRGBICLight,
    on: boolean,
    serviceIdentifier: number,
  ): DeviceTransition<GoveeRGBICLight> {
    if (serviceIdentifier < 0) {
      return new DeviceOnOffTransition(
        device.deviceId,
        on,
      );
    }

    return this.getBrightnessTransition(
      device,
      on && 100 || 0,
      serviceIdentifier,
    );
  }


  protected getBrightnessTransition(
    device: GoveeRGBICLight,
    brightness: number,
    identifier: number,
  ): DeviceTransition<GoveeRGBICLight> {
    if (identifier < 0) {
      return new DeviceBrightnessTransition(
        device.deviceId,
        brightness,
      );
    }
    return new DeviceBrightnessSegmentTransition(
      device.deviceId,
      identifier,
      brightness,
    );
  }

  protected getColorTemperatureTransition(
    device: GoveeRGBICLight,
    color: ColorRGB,
    temperature: number,
    identifier: number,
  ): DeviceTransition<GoveeRGBICLight> {
    return SegmentedLightService.getSegmentColorTransition(
      device,
      color,
      identifier,
    );
  }

  protected getColorTransition(
    device: GoveeRGBICLight,
    color: ColorRGB,
    identifier: number,
  ): DeviceTransition<GoveeRGBICLight> {
    return SegmentedLightService.getSegmentColorTransition(
      device,
      color,
      identifier,
    );
  }

  private static getSegmentColorTransition(
    device: GoveeRGBICLight,
    color: ColorRGB,
    identifier: number,
  ): DeviceTransition<GoveeRGBICLight> {
    if (identifier < 0) {
      return new DeviceColorWCTransition(
        device.deviceId,
        color,
      );
    }
    return new DeviceColorSegmentTransition(
      device.deviceId,
      identifier,
      color,
    );
  }


  protected shouldAddService(
    deviceOverride?: GoveeDeviceOverride,
    subType?: ServiceSubType<number>,
  ): boolean {
    if (subType?.primary) {
      return true;
    }
    return (deviceOverride as GoveeRGBICLightOverride)?.hideSegments !== true
      && !subType?.primary;
  }

  protected processDeviceOverrides(
    accessory: PlatformAccessory,
    identifiedService: IdentifiedService<number>,
    device: GoveeDevice,
    deviceOverride?: GoveeDeviceOverride,
  ): IdentifiedService<number> | undefined {
    const rgbicOverride =
      this.configService.getDeviceConfiguration<GoveeRGBICLightOverride>(
        device.deviceId,
      );

    if (!rgbicOverride) {
      return identifiedService;
    }

    if (!identifiedService.service) {
      return undefined;
    }

    const subType = identifiedService.subType;
    if (rgbicOverride.hideSegments && !subType?.primary) {
      accessory.removeService(identifiedService.service);
      return undefined;
    }
    const infoService = accessory.getService(this.SERVICES.AccessoryInformation);
    const name = deviceOverride?.displayName ?? infoService?.displayName ?? device.name;
    if (subType?.nameSuffix) {
      identifiedService.service.displayName =
        `${name} ${subType.nameSuffix}`;
    }

    return identifiedService;
  }
}