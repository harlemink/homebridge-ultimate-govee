import {State} from './State';
import {DeviceState} from '../../core/structures/devices/DeviceState';
import {MistLevelState} from './MistLevel';
import {StatusModeState} from './StatusMode';

const commandIdentifiers = [
  5,
  2,
];

export interface MistLevelProgram {
  mistLevel: number;
  duration: number;
  remaining: number;
}

export interface ProgrammableMistLevelState {
  mistProgramId?: number;
  mistPrograms: Map<number, MistLevelProgram>;
}

export function ProgrammableMistLevel<StateType extends State & MistLevelState & StatusModeState>(
  stateType: new (...args) => StateType,
) {
  // @ts-ignore
  return class extends stateType implements ProgrammableMistLevelState {
    public mistProgramId?: number;
    public mistPrograms = new Map<number, MistLevelProgram>();

    public constructor(...args) {
      super(...args);
    }

    public override parse(deviceState: DeviceState): ThisType<this> {
      super.parse(deviceState);
      const commandValues = this.getCommandValues(
        [170, ...commandIdentifiers],
        deviceState.commands,
      );
      if (commandValues) {
        this.mistProgramId = Math.floor(commandValues[0] / 16);
        for (let i = 0; i < 3; i++) {
          const program: MistLevelProgram = {
            mistLevel: commandValues[i * 5 + 1],
            duration: commandValues[i * 5 + 2] * 255 + commandValues[i * 5 + 3],
            remaining: commandValues[i * 5 + 4] * 255 + commandValues[i * 5 + 5],
          };
          this.mistPrograms.set(i, program);
        }
      }

      if (this.statusMode === 2 && this.mistProgramId !== undefined) {
        this.mistLevel = this.mistPrograms.get(this.mistProgramId)?.mistLevel;
      }

      return this;
    }
  };
}