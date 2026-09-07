// Servings as people type them: whole numbers stay whole, fractions keep two
// decimals, and float noise such as 1.999999999999 reads as 2.
export function formatServings(servings: number): string {
  return String(Number(servings.toFixed(2)));
}
