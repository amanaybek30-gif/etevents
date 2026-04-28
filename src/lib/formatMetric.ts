/**
 * Format an analytics metric (percentage, rate, score, average) to exactly
 * ONE decimal place for display.
 *
 * Rule (mem://preferences/analytics-numbers):
 *  - Always round metrics/percentages to 1 decimal (e.g., 47.4%).
 *  - Integer counts stay as integers — do NOT pass them through this.
 */
export const round1 = (n: number | null | undefined): number => {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return Number(v.toFixed(1));
};

export const fmt1 = (n: number | null | undefined): string => {
  return round1(n).toFixed(1);
};
