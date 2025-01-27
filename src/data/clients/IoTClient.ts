import {device} from 'aws-iot-device-sdk';
import {GoveeClient} from './GoveeClient';
import {GOVEE_CLIENT_ID, IOT_CA_CERTIFICATE, IOT_CERTIFICATE, IOT_HOST, IOT_KEY} from '../../util/const';
import {Inject, Injectable} from '@nestjs/common';
import {EventEmitter2, OnEvent} from '@nestjs/event-emitter';
import {IoTConnectionStateEvent, IoTErrorEvent, IoTEventData} from '../../core/events/dataClients/iot/IoTEvent';
import {ConnectionState} from '../../core/events/dataClients/DataClientEvent';
import {IotReceive} from '../../core/events/dataClients/iot/IotReceive';
import {IoTSubscribedToEvent, IoTSubscribeToEvent} from '../../core/events/dataClients/iot/IotSubscription';
import {IoTUnsubscribedFromEvent} from '../../core/events/dataClients/iot/IotRemoveSubscription';
import {LoggingService} from '../../logging/LoggingService';
import {Lock} from 'async-await-mutex-lock';
import {promisify} from 'util';

@Injectable()
export class IoTClient
  extends GoveeClient {
  private readonly awsIOTDevice: device;
  private connected = false;
  private lock = new Lock<void>();
  private readonly subscriptions: Set<string> = new Set<string>();

  constructor(
    eventEmitter: EventEmitter2,
    @Inject(IOT_KEY) keyPath: string,
    @Inject(IOT_CERTIFICATE) certificatePath: string,
    @Inject(IOT_CA_CERTIFICATE) caPath: string,
    @Inject(GOVEE_CLIENT_ID) clientId: string,
    @Inject(IOT_HOST) host: string,
    private readonly log: LoggingService,
  ) {
    super(eventEmitter);
    this.awsIOTDevice = new device({
      clientId: clientId,
      certPath: certificatePath,
      keyPath: keyPath,
      caPath: caPath,
      host: host,
    });

    this.awsIOTDevice.on(
      'connect',
      async () => {
        if (!this.connected) {
          this.log.info(
            'IoTClient',
            'onConnect',
            'Connection Connected',
          );
          this.connected = true;
          await this.emitAsync(
            new IoTConnectionStateEvent(ConnectionState.Connected),
          );
          await this.resubscribe();
        }
      },
    );

    this.awsIOTDevice.on(
      'reconnect',
      async () => {
        this.log.info(
          'IoTClient',
          'onReconnect',
          'Connection Reconnected',
        );
        if (!this.connected) {
          this.connected = true;
          await this.emitAsync(
            new IoTConnectionStateEvent(ConnectionState.Connected),
          );
          await this.resubscribe();
        }
      },
    );

    this.awsIOTDevice.on(
      'error',
      (error: Error | string) => {
        this.log.error(
          'IoTClient',
          'onError',
          error,
        );
      },
    );
    this.awsIOTDevice.on(
      'offline',
      async () => {
        this.log.info(
          'IoTClient',
          'onOffline',
          'Connection Offline',
        );
        if (this.connected) {
          this.connected = false;
          await this.emitAsync(new IoTConnectionStateEvent(ConnectionState.Offline));
        }
      },
    );

    this.awsIOTDevice.on(
      'close',
      async () => {
        this.log.info(
          'IoTClient',
          'onClose',
          'Connection Closed',
        );
        if (this.connected) {
          this.connected = false;
          await this.emitAsync(new IoTConnectionStateEvent(ConnectionState.Closed));
        }
      },
    );

    this.awsIOTDevice.on(
      'message',
      async (topic: string, payload: string) => {
        this.log.debug(
          'IoTClient',
          'onMessage',
          topic,
          JSON.parse(payload.toString()),
        );
        await this.emitAsync(
          new IotReceive(
            topic,
            payload.toString(),
          ),
        );
      },
    );
  }

  @OnEvent(
    'IOT.Unsubscribe',
  )
  async unsubscribe(message: IoTEventData) {
    if (!message.topic) {
      this.log.info('No topic to unsubscribe from');
      return;
    }
    await this.lock.acquire();
    try {
      await promisify(this.awsIOTDevice.unsubscribe)(message.topic);
      this.subscriptions.delete(message.topic);
      await this.emitAsync(
        new IoTUnsubscribedFromEvent(message.topic),
      );
    } catch (error) {
      await this.emitAsync(new IoTErrorEvent(error as Error));
    } finally {
      this.lock.release();
    }
  }

  @OnEvent(
    'IOT.Subscribe',
  )
  async subscribe(message: IoTEventData) {
    if (!message.topic) {
      this.log.info('No topic to subscribe to');
      return;
    }
    await this.lock.acquire();
    try {
      if (!this.subscriptions.has(message.topic)) {
        this.log.info('Subscribing', message.topic);
        await promisify(this.awsIOTDevice.subscribe)(
          message.topic,
          undefined,
        );
        this.subscriptions.add(message.topic);
        await this.emitAsync(new IoTSubscribedToEvent(message.topic));
      }
    } catch (error) {
      await this.emitAsync(new IoTErrorEvent(error as Error));
    } finally {
      this.lock.release();
    }
  }

  @OnEvent(
    'IOT.Publish',
    {
      nextTick: true,
    },
  )
  async publishTo(message: IoTEventData) {
    if (!message.topic) {
      this.log.info(
        'IoTClient',
        'publishTo',
        'No topic to publish to',
      );
      return;
    }
    this.log.debug(
      'IoTClient',
      'publishTo',
      message.topic,
      message.payload,
    );
    await promisify(this.awsIOTDevice.publish)(
      message.topic,
      message.payload,
      undefined,
    );
  }

  private async resubscribe() {
    for (let i = 0; i < this.subscriptions.size; i++) {
      await this.emitAsync(
        new IoTSubscribeToEvent(
          this.subscriptions[i],
        ),
      );
    }
  }
}