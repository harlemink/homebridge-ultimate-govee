import {Inject, Injectable} from '@nestjs/common';
import {GOVEE_CLIENT_ID, GOVEE_PASSWORD, GOVEE_USERNAME, PLATFORM_LOGGER} from '../util/const';
import {PlatformAccessory} from 'homebridge';
import {Emitter} from '../util/types';
import {EventEmitter2} from '@nestjs/event-emitter';
import {RestAuthenticateEvent} from '../core/events/dataClients/rest/RestAuthentication';
import {AccessoryManager} from './accessories/AccessoryManager';
import {Logging} from 'homebridge/lib/logger';

@Injectable()
export class PlatformService extends Emitter {

  constructor(
    eventEmitter: EventEmitter2,
    private readonly accessoryManager: AccessoryManager,
    @Inject(PLATFORM_LOGGER) private readonly log: Logging,
  ) {
    super(eventEmitter);
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessoryManager.onDeviceDiscovered(accessory.context.device);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    console.log("DISCOVER DEVICES");
    this.emit(
      new RestAuthenticateEvent(),
    );
  }
}