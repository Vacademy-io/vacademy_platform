import convert from "color-convert";

/**
 * Shade-ramp math shared by every brand-color path (preset, custom hex,
 * secondary/tertiary overrides, nav tints) in both learner and admin.
 *
 * A shade is the base color mixed toward white — a real tint. The previous
 * formula instead kept the hue and *raised* saturation as lightness rose
 * (`min(s + 40, 100)` / `min(l + 45, 96)`). That reads fine for the stock
 * presets, which are all mid-tone (orange S85 L54, blue S79 L51), but it
 * broke exactly where institute brand colors live — its "-50" tint of a
 * maroon came out hot pink, of a navy came out periwinkle, of a teal came
 * out neon, and of a charcoal grey came out PINK (a grey's hue is 0 = red,
 * and the formula saturates it).
 *
 * Mid-tone colors land in nearly the same place under either curve, so the
 * switch costs institutes on the stock presets nothing visible while making
 * dark, saturated, and neutral brand colors usable at all.
 */

export type Shade = "50" | "100" | "200" | "300" | "400" | "500";

/** How far each shade is mixed toward white. 500 is the base color itself. */
const TINT_FRACTION: Record<Exclude<Shade, "500">, number> = {
  "400": 0.24,
  "300": 0.48,
  "200": 0.68,
  "100": 0.84,
  "50": 0.92,
};

export const SHADES: Shade[] = ["50", "100", "200", "300", "400", "500"];

const wrapHue = (deg: number) => ((deg % 360) + 360) % 360;
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(n, max));

/** Base HSL -> every shade as an HSL triplet. */
export function rampFromHsl(
  hue: number,
  sat: number,
  light: number
): Record<Shade, [number, number, number]> {
  const base: [number, number, number] = [wrapHue(hue), clamp(sat), clamp(light)];
  const [r, g, b] = convert.hsl.rgb(base);
  const tint = (f: number): [number, number, number] =>
    convert.rgb.hsl([
      Math.round(r + (255 - r) * f),
      Math.round(g + (255 - g) * f),
      Math.round(b + (255 - b) * f),
    ]);

  return {
    "500": base,
    "400": tint(TINT_FRACTION["400"]),
    "300": tint(TINT_FRACTION["300"]),
    "200": tint(TINT_FRACTION["200"]),
    "100": tint(TINT_FRACTION["100"]),
    "50": tint(TINT_FRACTION["50"]),
  };
}

/** Base hex -> every shade as a hex string (for previews / static data). */
export function rampHexFromHex(hex: string): Record<Shade, string> {
  const [h, s, l] = convert.hex.hsl(hex.replace("#", ""));
  const ramp = rampFromHsl(h, s, l);
  const out = {} as Record<Shade, string>;
  SHADES.forEach((shade) => {
    out[shade] = `#${convert.hsl.hex(ramp[shade])}`;
  });
  // Keep the caller's exact base rather than a round-tripped approximation.
  out["500"] = hex.startsWith("#") ? hex : `#${hex}`;
  return out;
}

/** `"H S% L%"` — the format every CSS custom property in this app expects. */
export function hslVar([h, s, l]: [number, number, number]): string {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}
