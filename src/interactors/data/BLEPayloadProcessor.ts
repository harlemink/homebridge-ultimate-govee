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
  BLEPeripheralConnectionState,
  BLEPeripheralSendEvent,
  BLEPeripheralStateReceive,
} from '../../core/events/dataClients/ble/BLEPeripheral';
import {getCommandCodes} from '../../util/opCodeUtils';
import {REPORT_IDENTIFIER} from '../../util/const';

@Injectable()
export class BLEPayloadProcessor extends Emitter {
  private bleConnected = false;
  private peripheralConnected: Map<string, boolean> = new Map<string, boolean>();

  constructor(
    private readonly log: LoggingService,
    eventEmitter: EventEmitter2,
  ) {
    super(eventEmitter);
  }

  @OnEvent(
    'BLE.CONNECTION',
    {
      async: true,
    },
  )
  onBLEConnection(connection: ConnectionState) {
    this.bleConnected = connection === ConnectionState.Connected;
  }

  @OnEvent(
    'BLE.PERIPHERAL.Connection',
    {
      async: true,
    },
  )
  onBLEPeripheralConnection(connection: BLEPeripheralConnectionState) {
    this.peripheralConnected.set(
      connection.bleAddress.toLowerCase(),
      connection.connectionState === ConnectionState.Connected,
    );
  }

  @OnEvent(
    'BLE.PERIPHERAL.Receive',
    {
      async: true,
    },
  )
  onPeripheralReceive(state: BLEPeripheralStateReceive) {
    try {
      const devState = toDeviceState(
        state.deviceId,
        state.state,
      );
      this.emit(
        new DeviceStateReceived(devState),
      );
    } catch (err) {
      this.log.error(err);
    }
  }

  @OnEvent(
    'DEVICE.REQUEST.State',
    {
      async: true,
    },
  )
  onRequestDeviceState(
    device: GoveeDevice,
  ) {
    if (!device.bleAddress) {
      return;
    }
    if (!this.bleConnected) {
      this.log.info('RequestDeviceState', 'BLE is not connected');
      return;
    }
    if (!this.peripheralConnected.get(device.bleAddress.toLowerCase())) {
      this.log.info('RequestDeviceState', `BLE Peripheral ${device.deviceId} is not connected`);
      return;
    }
    device.deviceStatusCodes.forEach(
      (statusCodes) =>
        this.emit(
          new BLEPeripheralSendEvent(
            new BLEPeripheralCommandSend(
              device.bleAddress!.toLowerCase(),
              device.deviceId,
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