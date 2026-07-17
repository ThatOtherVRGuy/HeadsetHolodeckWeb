import { describe, expect, it } from "vitest";
import { parseVoiceCommandIntent } from "./intent";

describe("parseVoiceCommandIntent", () => {
  it.each(["end program", "end the program", "computer end program"])(
    "parses end program command %s",
    (text) => {
      expect(parseVoiceCommandIntent(text)).toEqual({
        kind: "endProgram",
        response: "Ending program."
      });
    }
  );

  it("parses world move commands with normalized distances", () => {
    expect(parseVoiceCommandIntent("move the world up 3 feet")).toMatchObject({
      kind: "transformObject",
      target: "world",
      operation: "move",
      axis: "y",
      amount: {
        meters: expect.closeTo(0.9144),
        originalPhrase: "3 feet"
      },
      response: "Moving world up 3 feet."
    });
  });

  it("parses transcribed spoken-number move commands", () => {
    expect(
      parseVoiceCommandIntent("Move the world up thirteen feet.")
    ).toMatchObject({
      kind: "transformObject",
      target: "world",
      operation: "move",
      axis: "y",
      amount: {
        meters: expect.closeTo(3.9624),
        originalPhrase: "thirteen feet"
      },
      response: "Moving world up thirteen feet."
    });
  });

  it("uses world as the target for pronoun-based commands", () => {
    expect(parseVoiceCommandIntent("move it down 50 centimeters")).toMatchObject(
      {
        kind: "transformObject",
        target: "world",
        operation: "move",
        axis: "y",
        direction: -1,
        amount: {
          meters: 0.5,
          originalPhrase: "50 centimeters"
        },
        response: "Moving world down 50 centimeters."
      }
    );
  });

  it("parses default world rotation on the up axis", () => {
    expect(parseVoiceCommandIntent("rotate world 90 degrees")).toMatchObject({
      kind: "transformObject",
      target: "world",
      operation: "rotate",
      axis: "y",
      amount: {
        degrees: 90,
        radians: expect.closeTo(Math.PI / 2),
        originalPhrase: "90 degrees"
      },
      response: "Rotating world 90 degrees on up axis."
    });
  });

  it("parses explicit rotation axes", () => {
    expect(parseVoiceCommandIntent("rotate world 90 degrees on Z axis")).toMatchObject(
      {
        kind: "transformObject",
        target: "world",
        operation: "rotate",
        axis: "z",
        amount: {
          degrees: 90,
          originalPhrase: "90 degrees"
        },
        response: "Rotating world 90 degrees on z axis."
      }
    );
  });

  it.each([
    ["make world twice as big", 2, "twice as big"],
    ["make the world half size", 0.5, "half size"],
    ["scale world 150 percent", 1.5, "150 percent"]
  ])("parses scale command %s", (text, factor, originalPhrase) => {
    expect(parseVoiceCommandIntent(text)).toMatchObject({
      kind: "transformObject",
      target: "world",
      operation: "scale",
      amount: {
        factor,
        originalPhrase
      },
      response: `Scaling world ${originalPhrase}.`
    });
  });

  it("ignores world generation prompts", () => {
    expect(
      parseVoiceCommandIntent("a large park in autumn with benches")
    ).toBeNull();
  });
});
