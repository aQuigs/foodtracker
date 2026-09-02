// The one form every search path compares names in: lowercased with
// diacritics stripped, so "jalapeno" typed on a plain keyboard reaches
// "Jalapeños" and "crème" reaches "Creme brulee". Whitespace and punctuation
// survive so callers can still tokenise the result.
export function searchKey(name: string): string {
  return name.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}
