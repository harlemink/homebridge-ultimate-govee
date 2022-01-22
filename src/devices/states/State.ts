import {DeviceState} from '../../core/structures/devices/DeviceState';

export interface OpCodeSpec {
  val: number;
}

export class State {
  getCommandCodes(
    opCode: number,
    identifier: number[],
    ...values: number[]
  ): number[] {
    const cmdFrame = Buffer.from([
      opCode,
      ...identifier,
      ...values,
    ]);
    const cmdPaddedFrame = Buffer.concat([
      cmdFrame,
      Buffer.from(
        new Array(19 - cmdFrame.length)
          .fill(0),
      ),
    ]);
    return Array.from(Buffer.concat([
      cmdPaddedFrame,
      Buffer.from([
        cmdPaddedFrame.reduce(
          (checksum, val) => checksum ^ val,
          0,
        ),
      ]),
    ]));
  }

  getCommandValues(
    identifier: number[],
    commands?: number[][],
  ): number[] | undefined {
    return commands
      ?.filter(
        (cmd) =>
          identifier.reduce(
            (
              match: boolean,
              identifier: number,
              idx: number,
            ) => (
              match
              && identifier === cmd[idx]
            ),
            true,
          ),
      )[0]?.slice(identifier.length);
  }


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public constructor(...args) {

  }

  parse(deviceState: DeviceState): ThisType<this> {
    return this;
  }
}