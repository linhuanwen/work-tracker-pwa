// ============================================================
// Color calculation utilities — pure functions
// ============================================================

/**
 * Parse a hex color string (3 or 6 chars, with or without #) to RGB channels.
 * Returns [r, g, b] as 0-255 integers, or null for invalid input.
 */
function parseHex(hex: string): [number, number, number] | null {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

/** Clamp a number to 0-255 and format as 2-digit hex. */
function toHex(channel: number): string {
  return Math.max(0, Math.min(255, Math.round(channel)))
    .toString(16)
    .padStart(2, '0');
}

/**
 * Lighten a hex color by moving each RGB channel toward 255 by `amount` (0–1).
 * amount=0.1 → 10% closer to 255.
 */
export function lightenColor(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const nr = r + (255 - r) * amount;
  const ng = g + (255 - g) * amount;
  const nb = b + (255 - b) * amount;
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

/**
 * Darken a hex color by moving each RGB channel toward 0 by `amount` (0–1).
 * amount=0.12 → 12% closer to 0.
 */
export function darkenColor(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const nr = r * (1 - amount);
  const ng = g * (1 - amount);
  const nb = b * (1 - amount);
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

/**
 * Given a primary hex color, compute the full variant triplet:
 * - primary: the base color unchanged
 * - hover:   10% lighter (toward white)
 * - active:  12% darker  (toward black)
 */
export function computeColorVariants(hex: string): {
  primary: string;
  hover: string;
  active: string;
} {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  return {
    primary: normalized,
    hover: lightenColor(normalized, 0.1),
    active: darkenColor(normalized, 0.12),
  };
}
