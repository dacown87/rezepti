export interface ParsedIngredient {
  amount: number | null;
  unit: string | null;
  food: string;
  note?: string;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

// Set of recognized German cooking units
const UNITS = new Set([
  'Messerspitze', 'Handvoll', 'Päckchen',
  'Scheiben', 'Blätter', 'Zweige', 'Prisen', 'Zehen', 'Dosen', 'Tassen', 'Gläser',
  'Scheibe', 'Blatt', 'Zweig', 'Prise', 'Zehe', 'Dose', 'Tasse', 'Glas', 'Becher',
  'Stück', 'Paket', 'Bund', 'Pkg',
  'Msp', 'EL', 'TL',
  'kg', 'dl', 'cl', 'ml', 'mg', 'cm',
  'l', 'g',
]);

function tryParseAmount(s: string): { amount: number; rest: string; rangeNote?: string } | null {
  // Unicode fraction, optionally preceded by a whole number ("1½")
  for (const [ch, val] of Object.entries(UNICODE_FRACTIONS)) {
    const re = new RegExp(`^(\\d+)?\\s*${ch}\\s*(.*)`);
    const m = re.exec(s);
    if (m) {
      const whole = m[1] ? parseInt(m[1], 10) : 0;
      return { amount: whole + val, rest: (m[2] || '').trim() };
    }
  }

  // Mixed number: "1 1/2"
  const mixedM = /^(\d+)\s+(\d+)\/(\d+)\s*(.*)/.exec(s);
  if (mixedM) {
    const den = parseInt(mixedM[3], 10);
    if (den !== 0) {
      return {
        amount: parseInt(mixedM[1], 10) + parseInt(mixedM[2], 10) / den,
        rest: (mixedM[4] || '').trim(),
      };
    }
  }

  // Fraction: "1/2"
  const fracM = /^(\d+)\/(\d+)\s*(.*)/.exec(s);
  if (fracM) {
    const den = parseInt(fracM[2], 10);
    if (den !== 0) {
      return { amount: parseInt(fracM[1], 10) / den, rest: (fracM[3] || '').trim() };
    }
  }

  // Range: "3-4" or "3–4" → take first number, save range as note
  const rangeM = /^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(.*)/.exec(s);
  if (rangeM) {
    return {
      amount: parseFloat(rangeM[1].replace(',', '.')),
      rest: (rangeM[3] || '').trim(),
      rangeNote: `${rangeM[1]}–${rangeM[2]}`,
    };
  }

  // Regular number: "200", "1,5", "1.5"
  const numM = /^(\d+(?:[.,]\d+)?)\s*(.*)/.exec(s);
  if (numM) {
    return { amount: parseFloat(numM[1].replace(',', '.')), rest: (numM[2] || '').trim() };
  }

  return null;
}

export function parseIngredient(raw: string): ParsedIngredient {
  let s = raw.trim();
  const notes: string[] = [];

  // Extract parenthetical notes first
  s = s
    .replace(/\(([^)]*)\)/g, (_: string, content: string) => {
      const n = content.trim();
      if (n) notes.push(n);
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();

  const parsed = tryParseAmount(s);
  if (!parsed) {
    return {
      amount: null,
      unit: null,
      food: s || raw.trim(),
      note: notes.join('; ') || undefined,
    };
  }

  const { amount, rest, rangeNote } = parsed;
  if (rangeNote) notes.unshift(rangeNote);

  // Try to match unit from the first token
  const tokens = rest.split(/\s+/).filter(Boolean);
  let unit: string | null = null;
  let foodStart = 0;

  if (tokens.length > 0) {
    const candidate = tokens[0].replace(/\.$/, ''); // strip trailing period (e.g. "Pkg.")
    if (UNITS.has(candidate)) {
      unit = candidate;
      foodStart = 1;
    }
  }

  // Build food string and extract comma-separated note
  const foodRaw = tokens.slice(foodStart).join(' ').trim();
  let food = foodRaw;

  const commaIdx = foodRaw.indexOf(',');
  if (commaIdx !== -1) {
    const before = foodRaw.slice(0, commaIdx).trim();
    const after = foodRaw.slice(commaIdx + 1).trim();
    if (before && after) {
      food = before;
      notes.push(after);
    }
  }

  return {
    amount,
    unit,
    food: food || raw.trim(),
    note: notes.join('; ') || undefined,
  };
}
