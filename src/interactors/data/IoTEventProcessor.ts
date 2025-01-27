import {IoTAccountMessage} from '../../core/structures/iot/IoTAccountMessage';
import {DeviceState} from '../../core/structures/devices/DeviceState';
import {Injectable} from '@nestjs/common';
import {Emitter} from '../../util/types';
import {EventEmitter2, OnEvent} from '@nestjs/event-emitter';
import {IoTEventData} from '../../core/events/dataClients/iot/IoTEvent';
import {plainToInstance} from 'class-transformer';
import {DeviceStateReceived} from '../../core/events/devices/DeviceReceived';
import {base64ToHex} from '../../util/encodingUtils';
import {IoTPublishToEvent} from '../../core/events/dataClients/iot/IoTPublish';
import {GoveeDevice} from '../../devices/GoveeDevice';
import {LoggingService} from '../../logging/LoggingService';
import {ConnectionState} from '../../core/events/dataClients/DataClientEvent';
import {PersistService} from '../../persist/PersistService';
import {IoTSubscribeToEvent} from '../../core/events/dataClients/iot/IotSubscription';

@Injectable()
export class IoTEventProcessor extends Emitter {
  private iotConnected = false;

  constructor(
    private readonly log: LoggingService,
    private persist: PersistService,
    eventEmitter: EventEmitter2,
  ) {
    super(eventEmitter);
  }

  @OnEvent(
    'IOT.CONNECTION',
  )
  async onIoTConnection(connection: ConnectionState) {
    this.iotConnected = connection === ConnectionState.Connected;
    const accountTopic = this.persist.oauthData?.accountIoTTopic;
    if (connection !== ConnectionState.Connected || !accountTopic) {
      return;
    }
    await this.emitAsync(
      new IoTSubscribeToEvent(accountTopic),
    );
  }

  @OnEvent(
    'IOT.Received',
  )
  async onIoTMessage(message: IoTEventData) {
    try {
      const acctMessage = plainToInstance(
        IoTAccountMessage,
        JSON.parse(message.payload),
      );

      const devState = toDeviceState(acctMessage);
      await this.emitAsync(
        new DeviceStateReceived(devState),
      );
    } catch (err) {
      this.log.error(err);
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
    if (!device.iotTopic) {
      this.log.info(
        'IoTEventProcessor',
        'RequestDeviceState',
        'No topic',
        device.deviceId,
      );
      return;
    }
    this.log.debug(
      'IoTEventProcessor',
      'RequestDeviceState',
      device.deviceId,
    );
    await this.emitAsync(
      new IoTPublishToEvent(
        device.iotTopic,
        JSON.stringify({
          topic: device.iotTopic,
          msg: {
            accountTopic: this.persist.oauthData?.accountIoTTopic,
            cmd: 'status',
            cmdVersion: 0,
            transaction: `u_${Date.now()}`,
            type: 0,
          },
        }),
      ),
    );
  }
}

export function toDeviceState(
  message: IoTAccountMessage,
): DeviceState {
  return {
    deviceId: message.deviceId,
    model: message.model,
    command: message.command,
    on: message?.state?.onOff === undefined
      ? undefined
      : message?.state?.onOff === 1,
    connected: message?.state?.connected,
    brightness: message?.state?.brightness,
    colorTemperature: message?.state?.colorTemperature,
    mode: message?.state?.mode,
    color: message?.state?.color === undefined
      ? undefined
      : {
        red: message.state.color.red,
        green: message.state.color.green,
        blue: message.state.color.blue,
      },
    commands: message.operatingState?.commands?.map(base64ToHex),
  };
}