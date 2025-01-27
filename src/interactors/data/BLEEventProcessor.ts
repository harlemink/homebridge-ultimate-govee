import {DeviceState} from '../../core/structures/devices/DeviceState';
import {Injectable} from '@nestjs/common';
import {Emitter} from '../../util/types';
import {EventEmitter2, OnEvent} from '@nestjs/event-emitter';
import {DeviceStateReceived} from '../../core/events/devices/DeviceReceived';
import {GoveeDevice} from '../../devices/GoveeDevice';
import {LoggingService} from '../../logging/LoggingService';
import {ConnectionState} from '../../core/events/dataClients/DataClientEvent';
import {
  BLEPeripheralCommandSend,
  BLEPeripheralSendEvent,
  BLEPeripheralStateReceive,
} from '../../core/events/dataClients/ble/BLEPeripheral';
import {getCommandCodes} from '../../util/opCodeUtils';
import {REPORT_IDENTIFIER} from '../../util/const';

@Injectable()
export class BLEEventProcessor extends Emitter {
  private bleConnected = false;

  constructor(
    private readonly log: LoggingService,
    eventEmitter: EventEmitter2,
  ) {
    super(eventEmitter);
  }

  @OnEvent(
    'BLE.CONNECTION',
  )
  async onBLEConnection(connection: ConnectionState) {
    this.bleConnected = connection === ConnectionState.Connected;
  }

  @OnEvent(
    'BLE.PERIPHERAL.Receive',
  )
  async onPeripheralReceive(state: BLEPeripheralStateReceive) {
    this.log.debug(
      'BLEEventProcessor',
      'onPeripheralReceive',
      state,
    );
    try {
      const devState = toDeviceState(
        state.deviceId,
        state.state,
      );
      await this.emitAsync(
        new DeviceStateReceived(devState),
      );
    } catch (err) {
      this.log.error(
        'BLEEventProcessor',
        'onPeripheralReceive',
        err,
      );
    }
  }

  @OnEvent(
    'DEVICE.REQUEST.State',
    {
      nextTick: true,
    },
  )
  async onRequestDeviceState(
    device: GoveeDevice,
  ) {
    const bleAddress = device.bleAddress?.toLowerCase();
    if (!bleAddress || !device.deviceStatusCodes) {
      return;
    }
    this.log.debug(
      'BLEEventProcessor',
      'RequestDeviceState',
      device.deviceId,
      device.deviceStatusCodes,
    );
    await this.emitAsync(
      new BLEPeripheralSendEvent(
        new BLEPeripheralCommandSend(
          bleAddress,
          device.deviceId,
          device.deviceStatusCodes.map(
            (statusCodes) =>
              getCommandCodes(
                REPORT_IDENTIFIER,
                statusCodes,
              ),
          ),
        ),
      ),
    );
  }
}

export function toDeviceState(
  deviceId: string,
  state: number[],
): DeviceState {
  return {
    deviceId: deviceId,
    commands: [state],
  };
}