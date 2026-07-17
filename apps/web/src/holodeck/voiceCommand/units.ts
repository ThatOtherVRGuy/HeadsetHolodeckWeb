export interface DistanceAmount {
  meters: number;
  originalValue: number;
  originalUnit: string;
  originalPhrase: string;
}

export interface AngleAmount {
  radians: number;
  degrees: number;
  originalValue: number;
  originalUnit: string;
  originalPhrase: string;
}

export interface ScaleAmount {
  factor: number;
  originalPhrase: string;
}

const NUMBER_WORDS = new Map<string, number>([
  ["zero", 0],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
  ["thirteen", 13],
  ["fourteen", 14],
  ["fifteen", 15],
  ["sixteen", 16],
  ["seventeen", 17],
  ["eighteen", 18],
  ["nineteen", 19],
  ["twenty", 20],
  ["thirty", 30],
  ["forty", 40],
  ["fifty", 50],
  ["sixty", 60],
  ["seventy", 70],
  ["eighty", 80],
  ["ninety", 90],
  ["hundred", 100],
  ["half", 0.5]
]);

const DISTANCE_UNITS = new Map<string, number>([
  ["millimeter", 0.001],
  ["millimeters", 0.001],
  ["mm", 0.001],
  ["centimeter", 0.01],
  ["centimeters", 0.01],
  ["cm", 0.01],
  ["meter", 1],
  ["meters", 1],
  ["m", 1],
  ["kilometer", 1000],
  ["kilometers", 1000],
  ["km", 1000],
  ["inch", 0.0254],
  ["inches", 0.0254],
  ["in", 0.0254],
  ["foot", 0.3048],
  ["feet", 0.3048],
  ["ft", 0.3048],
  ["yard", 0.9144],
  ["yards", 0.9144],
  ["yd", 0.9144],
  ["mile", 1609.344],
  ["miles", 1609.344],
  ["mi", 1609.344],
  ["furlong", 201.168],
  ["furlongs", 201.168]
]);

const ANGLE_UNITS = new Map<string, "degrees" | "radians">([
  ["degree", "degrees"],
  ["degrees", "degrees"],
  ["deg", "degrees"],
  ["radian", "radians"],
  ["radians", "radians"],
  ["rad", "radians"]
]);

const NUMBER_WORD_PATTERN = Array.from(NUMBER_WORDS.keys())
  .sort((left, right) => right.length - left.length)
  .join("|");
const NUMBER_PATTERN = String.raw`(?:\d+(?:\.\d+)?|(?:${NUMBER_WORD_PATTERN})(?:[-\s]+(?:${NUMBER_WORD_PATTERN}))*)`;

export function parseDistanceAmount(text: string): DistanceAmount | null {
  const unitPattern = Array.from(DISTANCE_UNITS.keys())
    .sort((left, right) => right.length - left.length)
    .join("|");
  const match = new RegExp(
    String.raw`\b(${NUMBER_PATTERN})\s+(${unitPattern})\b`,
    "i"
  ).exec(text);

  if (!match) {
    return null;
  }

  const value = parseNumber(match[1]);
  const unit = match[2].toLowerCase();
  const metersPerUnit = DISTANCE_UNITS.get(unit);

  if (value === null || metersPerUnit === undefined) {
    return null;
  }

  return {
    meters: value * metersPerUnit,
    originalValue: value,
    originalUnit: match[2],
    originalPhrase: match[0]
  };
}

export function parseAngleAmount(text: string): AngleAmount | null {
  const unitPattern = Array.from(ANGLE_UNITS.keys())
    .sort((left, right) => right.length - left.length)
    .join("|");
  const match = new RegExp(
    String.raw`\b(${NUMBER_PATTERN})\s+(${unitPattern})\b`,
    "i"
  ).exec(text);

  if (!match) {
    return null;
  }

  const value = parseNumber(match[1]);
  const unit = match[2].toLowerCase();
  const unitKind = ANGLE_UNITS.get(unit);

  if (value === null || !unitKind) {
    return null;
  }

  const radians = unitKind === "degrees" ? degreesToRadians(value) : value;
  const degrees = unitKind === "degrees" ? value : radiansToDegrees(value);

  return {
    radians,
    degrees,
    originalValue: value,
    originalUnit: match[2],
    originalPhrase: match[0]
  };
}

export function parseScaleAmount(text: string): ScaleAmount | null {
  const normalized = text.toLowerCase();
  const phraseMatch = /\b(twice as big|double size|half size)\b/i.exec(text);

  if (phraseMatch) {
    return {
      factor: phraseMatch[1].toLowerCase() === "half size" ? 0.5 : 2,
      originalPhrase: phraseMatch[0]
    };
  }

  const multiplierMatch = new RegExp(
    String.raw`\b(${NUMBER_PATTERN})\s*(x|times)\b`,
    "i"
  ).exec(text);

  if (multiplierMatch) {
    const value = parseNumber(multiplierMatch[1]);
    if (value !== null) {
      return {
        factor: value,
        originalPhrase: multiplierMatch[0]
      };
    }
  }

  const percentMatch = new RegExp(
    String.raw`\b(${NUMBER_PATTERN})\s*(percent|%)\b`,
    "i"
  ).exec(normalized);

  if (percentMatch) {
    const value = parseNumber(percentMatch[1]);
    if (value !== null) {
      return {
        factor: value / 100,
        originalPhrase: percentMatch[0]
      };
    }
  }

  return null;
}

function parseNumber(value: string): number | null {
  const normalized = value.toLowerCase();
  const numberWord = NUMBER_WORDS.get(normalized);

  if (numberWord !== undefined) {
    return numberWord;
  }

  const spokenNumber = parseSpokenNumber(normalized);
  if (spokenNumber !== null) {
    return spokenNumber;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSpokenNumber(value: string): number | null {
  const tokens = value
    .toLowerCase()
    .split(/[-\s]+/)
    .filter((token) => token.length > 0 && token !== "and");

  if (tokens.length === 0) {
    return null;
  }

  let total = 0;
  let current = 0;

  for (const token of tokens) {
    const number = NUMBER_WORDS.get(token);
    if (number === undefined) {
      return null;
    }

    if (token === "half") {
      if (tokens.length === 1) {
        return 0.5;
      }

      return null;
    }

    if (token === "hundred") {
      current = Math.max(current, 1) * 100;
      continue;
    }

    current += number;
  }

  total += current;
  return total > 0 || tokens.includes("zero") ? total : null;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
