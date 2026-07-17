import { describe, expect, it } from "vitest";
import {
  parseAngleAmount,
  parseDistanceAmount,
  parseScaleAmount
} from "./units";

describe("voice command units", () => {
  it.each([
    ["3 meters", 3],
    ["3 m", 3],
    ["3 centimeters", 0.03],
    ["3 cm", 0.03],
    ["3 millimeters", 0.003],
    ["3 mm", 0.003],
    ["3 kilometers", 3000],
    ["3 km", 3000],
    ["3 inches", 0.0762],
    ["3 in", 0.0762],
    ["3 feet", 0.9144],
    ["3 ft", 0.9144],
    ["3 yards", 2.7432],
    ["3 yd", 2.7432],
    ["3 miles", 4828.032],
    ["3 mi", 4828.032],
    ["3 furlongs", 603.504]
  ])("normalizes %s to meters", (phrase, meters) => {
    const amount = parseDistanceAmount(phrase);

    expect(amount?.meters).toBeCloseTo(meters);
    expect(amount?.originalPhrase).toBe(phrase);
  });

  it("preserves spoken number words in the original phrase", () => {
    const amount = parseDistanceAmount("three feet");

    expect(amount).toMatchObject({
      meters: expect.closeTo(0.9144),
      originalValue: 3,
      originalUnit: "feet",
      originalPhrase: "three feet"
    });
  });

  it.each([
    ["thirteen feet", 13 * 0.3048, 13],
    ["twenty one feet", 21 * 0.3048, 21],
    ["twenty-one feet", 21 * 0.3048, 21],
    ["one hundred feet", 100 * 0.3048, 100]
  ])("parses spoken distance %s", (phrase, meters, originalValue) => {
    const amount = parseDistanceAmount(phrase);

    expect(amount).toMatchObject({
      meters: expect.closeTo(meters),
      originalValue,
      originalUnit: "feet",
      originalPhrase: phrase
    });
  });

  it.each([
    ["90 degrees", 90, Math.PI / 2],
    ["ninety degrees", 90, Math.PI / 2],
    ["90 deg", 90, Math.PI / 2],
    ["1.57079632679 radians", 90, Math.PI / 2],
    ["1 rad", 180 / Math.PI, 1]
  ])("normalizes %s to radians", (phrase, degrees, radians) => {
    const amount = parseAngleAmount(phrase);

    expect(amount?.degrees).toBeCloseTo(degrees);
    expect(amount?.radians).toBeCloseTo(radians);
    expect(amount?.originalPhrase).toBe(phrase);
  });

  it.each([
    ["twice as big", 2],
    ["double size", 2],
    ["half size", 0.5],
    ["2x", 2],
    ["1.5 times", 1.5],
    ["150 percent", 1.5]
  ])("normalizes scale phrase %s", (phrase, factor) => {
    expect(parseScaleAmount(phrase)).toMatchObject({
      factor,
      originalPhrase: phrase
    });
  });
});
