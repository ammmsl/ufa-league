/** Converts a number to its ordinal string, e.g. 1 → "1st", 2 → "2nd", 11 → "11th" */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
