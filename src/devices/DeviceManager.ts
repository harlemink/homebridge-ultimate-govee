import {Injectable} from '@nestjs/common';
import {EventEmitter2, OnEvent} from '@nestjs/event-emitter';
import {Emitter, sleep} from '../util/types';
import {ModuleRef} from '@nestjs/core';
import {DeviceState} from '../core/structures/devices/DeviceState';
import {DeviceConfig} from '../core/structures/devices/DeviceConfig';
import {DevicePollRequest, DeviceStateRequest} from '../core/events/devices/DeviceRequests';
import {GoveeDevice} from './GoveeDevice';
import {DeviceDiscoveredEvent} from '../core/events/devices/DeviceDiscovered';
import {DeviceUpdatedEvent} from '../core/events/devices/DeviceUpdated';
import {DeviceTransition} from '../core/structures/devices/DeviceTransition';
import {LoggingService} from '../logging/LoggingService';


@Injectable()
export class DeviceManager extends Emitter {
  private readonly devices = new Map<string, GoveeDevice>();

  constructor(
    eventEmitter: EventEmitter2,
    private readonly log: LoggingService,
    public moduleRef: ModuleRef,
  ) {
    super(eventEmitter);
    this.emit(
      new DevicePollRequest(),
    );
  }

  @OnEvent(
    'DEVICE.RECEIVED.Settings',
  )
  async onDeviceSetting(deviceSettings: DeviceConfig) {
    if (!deviceSettings) {
      this.log.info('No device settings');
      return;
    }
    if (!this.devices.has(deviceSettings.deviceId)) {
      try {
        // @ts-ignore
        const deviceCtor = this.moduleRef.get(deviceSettings.model)();
        const device = deviceCtor(deviceSettings);
        this.devices.set(
          deviceSettings.deviceId,
          device,
        );
        this.emit(
          new DeviceDiscoveredEvent(device),
        );
        this.pollDeviceStates(
          device,
        );
      } catch (err) {
        this.log.error(err);
      }
    }
  }

  @OnEvent(
    'DEVICE.RECEIVED.State',
  )
  async onDeviceState(deviceState: DeviceState) {
    if (!this.devices.has(deviceState.deviceId)) {
      this.log.info('Unknown Device');
      return;
    }
    const device = this.devices.get(deviceState.deviceId);
    if (device) {
      device.updateState(deviceState);
      this.emit(
        new DeviceUpdatedEvent(device),
      );
    }
    return;
  }

  @OnEvent(
    'DEVICE.Command',
  )
  async onDeviceCommand(deviceTransition: DeviceTransition<GoveeDevice>) {
    const device = this.devices.get(deviceTransition.deviceId);
    if (!device) {
      this.log.info('Unknown Device');
      return;
    }
    if (!device.iotTopic) {
      return;
    }
    deviceTransition.apply(
      device,
      this,
    );
  }

  @OnEvent(
    'DEVICE.REQUEST.Poll',
  )
  async pollDeviceStates(
    device?: GoveeDevice,
  ) {
    (
      device
        ? [device]
        : Array.from(this.devices.values())
    )
      ?.forEach(
        (device) => {
          this.emit(
            new DeviceStateRequest(device),
          );
        },
      );
    if (!device) {
      this.log.debug('Setting timeout');
      await sleep(10000);
      this.emit(
        new DevicePollRequest(),
      );
    }
  }
}