export function toPercent(numerator: number, denominator: number): string {
  return ((numerator / denominator) * 100).toFixed(2) + "%";
}
