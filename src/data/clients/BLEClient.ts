import {GoveeClient} from './GoveeClient';
import {Injectable} from '@nestjs/common';
import {AsyncLock} from 'async-lock';
import {EventEmitter2, OnEvent} from '@nestjs/event-emitter';
import {ConnectionState} from '../../core/events/dataClients/DataClientEvent';
import {LoggingService} from '../../logging/LoggingService';
import noble, {Characteristic, Peripheral, Service} from '@abandonware/noble';
import {BLEDeviceIdentification} from '../../core/events/dataClients/ble/BLEEvent';
import {Emitter} from '../../util/types';
import {
  BLEPeripheralConnectionEvent,
  BLEPeripheralDiscoveredEvent,
  PeripheralConnectionState,
} from '../../core/events/dataClients/ble/BLEPeripheral';
import fs from 'fs';

@Injectable()
export class BLEClient
  extends GoveeClient {
  private static readonly STATE_POWERED_ON = 'poweredOn';

  private subscriptions: Map<string, BLEDeviceIdentification> = new Map<string, BLEDeviceIdentification>();
  private connections: Map<string, BLEPeripheralConnection> = new Map<string, BLEPeripheralConnection>();
  private scanning = false;

  constructor(
    eventEmitter: EventEmitter2,
    private readonly log: LoggingService,
  ) {
    super(eventEmitter);
    noble.on(
      'stateChange',
      async (state) => {
        this.log.info('BLEClient', 'StateChange', state);
        if (state === BLEClient.STATE_POWERED_ON) {
          await noble.startScanningAsync([], false);
        } else {
          await noble.stopScanningAsync();
        }
      },
    );

    noble.on(
      'scanStart',
      async () => {
        this.scanning = true;
        this.log.info('BLEClient', 'ScanStart');
      },
    );

    noble.on(
      'scanStop',
      async () => {
        this.scanning = false;
        this.log.info('BLEClient', 'ScanStop');
      },
    );

    noble.on(
      'discover',
      async (peripheral: Peripheral) => {
        this.emit(
          new BLEPeripheralDiscoveredEvent(peripheral),
        );
      },
    );
  }

  @OnEvent(
    'BLE.Subscribe',
    {
      async: true,
    },
  )
  onBLEDeviceSubscribe(bleDeviceId: BLEDeviceIdentification) {
    this.log.info('BLEClient', 'Subscribing', bleDeviceId.deviceId, bleDeviceId.bleAddress);
    this.subscriptions.set(bleDeviceId.bleAddress, bleDeviceId);
  }

  @OnEvent(
    'BLE.PERIPHERAL.Discovered',
    {
      async: true
    },
  )
  async onPeripheralDiscovered(peripheral: Peripheral) {
    if (!this.subscriptions.has(peripheral.address)) {
      this.log.info('BLEClient', 'Unknown Address', peripheral.address);
      return;
    }
    if (this.connections.has(peripheral.address)) {
      this.log.info('BLEClient', 'Already Connected', peripheral.address);
      return;
    }
    this.log.info('BLEClient', 'Creating Connection', peripheral.address);
    const peripheralConnection = new BLEPeripheralConnection(
      this.emitter,
      this.subscriptions[peripheral.address],
      peripheral,
      this.log,
    );
    this.log.info('BLEClient', 'Stop Scanning', peripheral.address);
    await noble.stopScanningAsync();
    await peripheralConnection.connect();
  }

  @OnEvent(
    'BLE.PERIPHERAL.Connection',
    {
      async: true
    },
  )
  async onPeripheralConnection(connectionState: PeripheralConnectionState) {
    if (connectionState.connectionState === ConnectionState.Connected) {
      this.connections.set(connectionState.bleAddress, connectionState.connection);
    } else {
      this.connections.delete(connectionState.bleAddress);
      if (!this.scanning) {
        await noble.startScanningAsync();
      }
    }
  }
}

export class BLEPeripheralConnection
  extends Emitter {

  constructor(
    eventEmitter: EventEmitter2,
    private readonly deviceIdentification: BLEDeviceIdentification,
    private readonly peripheral: Peripheral,
    private readonly log: LoggingService,
  ) {
    super(eventEmitter);
    peripheral.removeAllListeners();

    peripheral.on(
      'connect',
      async (error: string) => {
        if (error) {
          this.log.info('TODO?');
          return;
        }
        this.emit(
          new BLEPeripheralConnectionEvent(
            new PeripheralConnectionState(
              this.deviceIdentification.bleAddress,
              this.deviceIdentification.deviceId,
              ConnectionState.Connected,
              this,
            ),
          ),
        );
      },
    );

    peripheral.on(
      'disconnect',
      async (error: string) =>
        error
          ? this.log.info('TODO?')
          : this.emit(
            new BLEPeripheralConnectionEvent(
              new PeripheralConnectionState(
                this.deviceIdentification.bleAddress,
                this.deviceIdentification.deviceId,
                ConnectionState.Closed,
                this,
              ),
            ),
          ),
    );

    peripheral.on(
      'rssiUpdate',
      async (rssi: number) => this.log.info(rssi),
    );
  }

  async connect() {
    const path = `/tmp/${this.peripheral.address}/`;
    if (fs.existsSync(path)) {
      return;
    }
    await this.peripheral.connectAsync();
    await fs.mkdir.__promisify__(path);
    await fs.writeFile.__promisify__(
      `${path}advertisement.json`,
      JSON.stringify(this.peripheral.advertisement, null, 2),
      {encoding: 'utf8'},
    );

    const services = await this.peripheral.discoverServicesAsync();
    for (let i = 0; i < services.length; i++) {
      await this.discoverServiceCharacteristics(path, services[i]);
    }

    await this.peripheral.disconnectAsync();
  }

  async discoverServiceCharacteristics(path: string, service: Service) {
    const servicePath = `${path}/${service.uuid}/`;
    await fs.mkdir.__promisify__(servicePath);
    await fs.writeFile.__promisify__(
      `${servicePath}${service.name}.json`,
      JSON.stringify(service, null, 2),
      {encoding: 'utf8'},
    );
    const characteristics: Characteristic[] = await service.discoverCharacteristicsAsync();
    for (let i = 0; i < characteristics.length; i++) {
      await this.inspectCharacteristic(servicePath, characteristics[i]);
    }
  }

  async inspectCharacteristic(path: string, characteristic: Characteristic) {
    const charPath = `${path}/${characteristic.uuid}/`;
    await fs.mkdir.__promisify__(charPath);
    await fs.writeFile.__promisify__(
      `${charPath}${characteristic.name}.json`,
      JSON.stringify(characteristic, null, 2),
      {encoding: 'utf8'},
    );
  }
}