import { describe, expect, it } from "vitest";
import {
  looksLikeVoiceCommandAttempt,
  looksLikeWorldGenerationPrompt,
  parseVoiceCommandIntent
} from "./intent";

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

  it.each([
    ["hide holodeck", "holodeck", false, "Hiding holodeck."],
    ["show the holodeck", "holodeck", true, "Showing holodeck."],
    ["hide arch", "arch", false, "Hiding arch."],
    ["restore the archway", "arch", true, "Showing arch."]
  ])(
    "parses visibility command %s",
    (text, target, visible, response) => {
      expect(parseVoiceCommandIntent(text)).toEqual({
        kind: "setVisibility",
        target,
        visible,
        response
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

  it("parses me move commands with normalized distances", () => {
    expect(parseVoiceCommandIntent("move me forward 2 meters")).toMatchObject({
      kind: "transformObject",
      target: "me",
      operation: "move",
      axis: "z",
      direction: -1,
      amount: {
        meters: 2,
        originalPhrase: "2 meters"
      },
      response: "Moving me forward 2 meters."
    });
  });

  it("parses my-view commands as me commands", () => {
    expect(parseVoiceCommandIntent("move my view right 1 foot")).toMatchObject({
      kind: "transformObject",
      target: "me",
      operation: "move",
      axis: "x",
      direction: 1,
      amount: {
        meters: expect.closeTo(0.3048),
        originalPhrase: "1 foot"
      },
      response: "Moving me right 1 foot."
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

  it.each(["reset world", "restore the world transform", "world position reset"])(
    "parses reset transform command %s",
    (text) => {
      expect(parseVoiceCommandIntent(text)).toEqual({
        kind: "transformObject",
        target: "world",
        operation: "resetTransform",
        response: "Resetting world transform."
      });
    }
  );

  it.each(["reset me", "reset my position", "player pose reset"])(
    "parses me reset transform command %s",
    (text) => {
      expect(parseVoiceCommandIntent(text)).toEqual({
        kind: "transformObject",
        target: "me",
        operation: "resetTransform",
        response: "Resetting me transform."
      });
    }
  );

  it.each(["recenter world", "center the world", "move world back to center"])(
    "parses recenter command %s",
    (text) => {
      expect(parseVoiceCommandIntent(text)).toEqual({
        kind: "transformObject",
        target: "world",
        operation: "recenter",
        response: "Recentering world."
      });
    }
  );

  it.each(["recenter me", "center my view"])(
    "parses me recenter command %s",
    (text) => {
      expect(parseVoiceCommandIntent(text)).toEqual({
        kind: "transformObject",
        target: "me",
        operation: "recenter",
        response: "Recentering me."
      });
    }
  );

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

  it.each([
    ["hide dark"],
    ["turn my view left"],
    ["reset position"],
    ["move darch"]
  ])("classifies command-like misses without parsing them as prompts: %s", (text) => {
    expect(parseVoiceCommandIntent(text)).toBeNull();
    expect(looksLikeVoiceCommandAttempt(text)).toBe(true);
  });

  it("does not classify descriptive world prompts as command attempts", () => {
    expect(
      looksLikeVoiceCommandAttempt("a large park in autumn with benches")
    ).toBe(false);
  });

  it.each([
    "Hi to Arch.",
    "I'd fart.",
    "hide dark",
    "No thanks.",
    "hello there"
  ])("does not route non-generation transcript to WorldLabs: %s", (text) => {
    expect(looksLikeWorldGenerationPrompt(text)).toBe(false);
  });

  it.each([
    "create a world with a three ring circus",
    "put me in a large autumn park",
    "a large park in autumn with benches",
    "a vast desert city with towers"
  ])("routes generation-like transcript to WorldLabs: %s", (text) => {
    expect(looksLikeWorldGenerationPrompt(text)).toBe(true);
  });
});
