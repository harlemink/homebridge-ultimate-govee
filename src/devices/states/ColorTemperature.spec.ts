import {State} from './State';
import {COMMAND_IDENTIFIER, REPORT_IDENTIFIER} from '../../util/const';
import {ColorRGB} from '../../util/colorUtils';
import {ColorTemperature, ColorTemperatureState} from './ColorTemperature';

class TestState extends ColorTemperature(State) {
  constructor(...args) {
    super(...args);
  }
}

let testState: ColorTemperatureState & State;

describe('ColorTemperatureState', () => {
  beforeEach(() => {
    testState = new TestState();
  });

  describe('constructor', () => {
    it('adds command identifier', () => {
      expect(testState.deviceStatusCodes).toHaveLength(1);
      expect(testState.deviceStatusCodes).toStrictEqual([[5, 2, 255, 255, 255, 1]]);
    });
  });

  describe('parse', () => {
    it('processes DeviceState.commands', () => {
      expect(testState.colorTemperature).toBeUndefined();
      testState.parse({
        deviceId: 'device',
        commands: [
          [REPORT_IDENTIFIER, 5, 2, 255, 255, 255, 1, 50, 51, 52],
        ],
      });
      expect(testState.colorTemperature).toBeDefined();
      expect(testState.colorTemperature?.red).toBe(50);
      expect(testState.colorTemperature?.green).toBe(51);
      expect(testState.colorTemperature?.blue).toBe(52);
    });

    it('ignores non-applicable DeviceState', () => {
      expect(testState.colorTemperature).toBeUndefined();
      testState.parse({
        deviceId: 'device',
        brightness: 100,
        commands: [
          [REPORT_IDENTIFIER, 1, 2],
        ],
      });
      expect(testState.colorTemperature).toBeUndefined();
    });
  });

  describe('colorTemperatureChange', () => {
    it('returns opcode array', () => {
      testState.colorTemperature = new ColorRGB(
        20,
        80,
        40,
      );
      expect(testState.colorTemperatureChange).toStrictEqual(
        [
          COMMAND_IDENTIFIER, 5, 2, 255, 255,
          255, 1, 20, 80, 40,
          0, 0, 0, 0, 0,
          0, 0, 0, 0, 166,
        ],
      );
    });
  });
});