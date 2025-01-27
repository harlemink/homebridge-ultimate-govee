import {AccessoryService} from './AccessoryService';
import {Inject} from '@nestjs/common';
import {PLATFORM_CHARACTERISTICS, PLATFORM_SERVICES} from '../../../util/const';
import {Characteristic, Service, WithUUID} from 'homebridge';
import {GoveeDevice} from '../../../devices/GoveeDevice';
import {EventEmitter2} from '@nestjs/event-emitter';
import {LoggingService} from '../../../logging/LoggingService';
import {ServiceRegistry} from '../ServiceRegistry';
import {PlatformConfigService} from '../../config/PlatformConfigService';

@ServiceRegistry.register
export class InformationService extends AccessoryService<void> {
  protected readonly serviceType: WithUUID<typeof Service> = this.SERVICES.AccessoryInformation;

  constructor(
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
  ) {
    const deviceConfig = this.configService.getDeviceConfiguration(device.deviceId);
    service.updateCharacteristic(this.CHARACTERISTICS.Manufacturer, 'Govee')
      .updateCharacteristic(this.CHARACTERISTICS.Name, deviceConfig?.displayName ?? device.name)
      .updateCharacteristic(this.CHARACTERISTICS.ConfiguredName, deviceConfig?.displayName ?? device.name)
      .updateCharacteristic(this.CHARACTERISTICS.Model, device.model)
      .updateCharacteristic(this.CHARACTERISTICS.SerialNumber, device.deviceId);
    if (device.hardwareVersion) {
      service.updateCharacteristic(this.CHARACTERISTICS.FirmwareRevision, device.hardwareVersion);
    }
    if (device.softwareVersion) {
      service.updateCharacteristic(this.CHARACTERISTICS.SoftwareRevision, device.softwareVersion);
    }
  }
}