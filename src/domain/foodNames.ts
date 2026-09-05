// Live food names are unique, case-insensitively: the picker shows names
// alone, so two live "Apple"s would be indistinguishable. Case-only by
// design — "Café" and "Cafe" read as different foods in the list. A
// soft-deleted food frees its name. Recipes share the same rule and the
// same helper, since a recipe picker row is just as name-only as a food's.
export function foodNameKey(name: string): string {
  return name.toLowerCase();
}

type Named = { id: string; name: string; deletedAt: string | null };

export function nameTaken(name: string, items: Named[], ignoreId: string | null = null): boolean {
  const key = foodNameKey(name);
  return items.some((x) => x.deletedAt === null && x.id !== ignoreId && foodNameKey(x.name) === key);
}
