# M13 — Recipes

## Goal
Log a dish made of several foods in one go. A recipe is a named preset of foods with portions ("Omelette: 3 eggs, 2 oz ham, 1 oz cheddar"). Picking it in the log view shows the portions prefilled and editable plus a servings count; logging writes one ordinary entry per item, grouped under a header that names the recipe and how many were eaten, and deletes as one. Rationale: [ADR 0009](../decisions/0009-recipes-expand-into-grouped-entries.md).

## In scope
- Recipes tab (`Log · Foods · Recipes · Catalog`): fuzzy-searched list, add/edit form, soft delete.
- Form: name; an "Add a food" search over live user foods not already in the recipe (click appends an item at the food's serving size and unit); one row per item with an amount input, a unit picker limited to the food's compatible units, and a remove button; Add recipe / Save / Cancel; one error line.
- List rows: name, `N items · C cal` (nutrition of one serving from the live foods), Edit, ×.
- Log picker lists live recipes beside foods, each with a `Recipe` tag; one ordering across both: match tier, then most recently logged, then name.
- Picking a recipe opens a card under its row: one line per item with an editable amount, the item's unit and live calories; a Total line for the current amounts × servings. Clicking the selected row again collapses the card, as for foods.
- With a recipe selected the log row shows `Servings` (default 1) in place of Amount, Unit and the chips. Log it writes one entry per item whose amount is above 0, amount × servings, all into the latest meal, tagged with one recipe log. After logging, the card resets to the recipe's portions and servings 1.
- Entries of a recipe log render inside their meal under a group header `Omelette ×2 · 976 cal` with × that deletes every entry in the group. `×N` shows only when servings ≠ 1. Item rows keep their own ×; a recipe log whose last entry goes is removed with it.
- Food guards: deleting a food a live recipe uses is refused with a message on the Foods tab; changing a food's count/weight axis while a live recipe item uses it is refused (extends the existing entry rule).
- State: `recipes`, `recipeLogs`, `entry.recipeLogId`, all additive on `version: 2`.

## Out of scope
- Nested recipes; recipes built from catalog rows directly (add the food first).
- Editing a logged group's amounts or servings afterwards (delete and re-log).
- Changing an item's unit at log time (the editor sets it).
- Reviving a deleted recipe.
- Renaming the day's "Meal N" groups.

## Data
```ts
type RecipeItem = { foodId: string; amount: number; unit: Unit };
type Recipe = { id: string; name: string; items: RecipeItem[]; createdAt: string; deletedAt: string | null };
type RecipeLog = { id: string; recipeId: string; servings: number };   // one logged instance
type Entry = { /* existing */ recipeLogId?: string };
type State = { version: 2; enabledSources; foods; meals; entries; recipes: Recipe[]; recipeLogs: RecipeLog[] };
type RecipeUpdates = Partial<Pick<Recipe, 'name' | 'items'>>;
```

**Reducer invariants (`domain/reducer.ts`):**
- A recipe is valid when: id non-empty, name non-empty and unique among live recipes (same case-insensitive key as foods), at least one item, no two items share a food, every item's food is live, amount > 0, unit compatible with the food.
- `AddRecipe { recipe }`: valid and the id is new. `EditRecipe { recipeId; updates }`: the merged recipe is valid; refused for a deleted recipe. `SoftDeleteRecipe { recipeId; deletedAt }`: no-op for a missing or deleted recipe.
- `LogRecipe { recipeLog; entries: EntryDraft[]; newMealId }`: recipe live; `recipeLog.id` new; servings > 0; at least one entry, each valid as for `LogEntry`, all on one date. The reducer stamps `recipeLogId` and the latest meal's id on every entry, creating the meal as `LogEntry` does.
- `DeleteRecipeLog { recipeLogId }`: removes the record and every entry that carries it, then applies `DeleteEntry`'s empty-meal rule.
- `DeleteEntry`: a recipe log left with no entries is removed.
- `SoftDeleteFood`: refused while a live recipe has an item with that food.
- `EditFood` / `ReviveFood`: the count/weight axis guard also counts live recipe items.

**Validator (`parseState`):**
- `recipes` / `recipeLogs` absent → `[]`. Present → every element must validate (item foods exist; `recipeId` names a recipe) or the blob is rejected.
- `entry.recipeLogId` naming no recipe log is dropped, so the entry loads ungrouped: the live site and PR previews share one localStorage blob, and a build without recipes re-saves entries verbatim but drops `recipeLogs`. A recipe log no entry references is dropped.

**Calc:** `recipeNutrition(recipe, foodsById)` sums `servingsFor` over items; a deleted or missing food contributes nothing. Group totals reuse `sumNutrition`.

## UI sketch
```
Log
[ omel                         ]
Omelette  ⟨Recipe⟩                          ← picker row with tag
  Egg        [3] count    234 cal            ← card: editable amounts, fixed units
  Ham        [2] oz       140 cal
  Cheddar    [1] oz       114 cal
  Total  488 cal · P 40g · C 2g · F 36g      ← amounts × servings
Servings [1]   [Log it]                      ← replaces Amount / Unit / chips

[ + New meal ]
─── Meal 1 ──────────── 976 cal · P 80g · C 4g · F 72g ───
Omelette ×2                       976 cal  ×  ← group header; × deletes the group
  Egg       6 count    468 cal    ×
  Ham       4 oz       280 cal    ×
  Cheddar   2 oz       228 cal    ×

Recipes
[ Search recipes               ]
Add new recipe
Name [Omelette          ]
Add a food [ ha         ]
  Ham                                        ← live foods not already in the recipe
Egg       [3]  (g oz lb count)   ×
Ham       [2]  (g oz lb count)   ×
[Add recipe]
Omelette          3 items · 488 cal   Edit ×
```
Messages: `Enter a name.` · `A recipe with this name already exists.` · `Add at least one food.` · `Every item needs an amount greater than 0.` · `Enter at least one amount greater than 0.` · `Enter servings greater than 0.` · `Ham is in the Omelette recipe. Remove it from the recipe first.`

## Acceptance
1. A fresh state has empty `recipes` and `recipeLogs`; a blob without either field loads with every food, meal and entry intact; a malformed recipe or recipe log rejects the blob; an entry whose `recipeLogId` names nothing loads ungrouped; a recipe log with no entries is dropped.
2. `AddRecipe` refuses an empty name, a taken live name, no items, a duplicate food, a deleted food, a non-positive amount, an incompatible unit; a deleted recipe frees its name.
3. `EditRecipe` applies name and item changes under the same rules and refuses a deleted recipe.
4. `LogRecipe` writes one entry per draft entry with `recipeLogId` set and the latest meal's id (creating Meal 1 on a fresh day), appends the recipe log, and refuses a deleted recipe, a used id, zero entries, or servings ≤ 0.
5. `DeleteRecipeLog` removes the record and all its entries and garbage-collects an empty non-latest meal; deleting a group's last item row removes the recipe log.
6. `SoftDeleteFood` on a food a live recipe uses returns the state unchanged; on one only a deleted recipe used, it deletes. `EditFood` refuses a count↔weight change while a live recipe item uses the food.
7. Recipes tab: adding Omelette (Egg 3 count, Ham 2 oz) lists it as `2 items · 374 cal`; the item picker hides Egg and Ham once added; Edit prefills the form; Save applies; Cancel restores; × removes the row from the list.
8. Foods tab: × on Ham while Omelette is live shows the message above the list and keeps Ham; after deleting Omelette, × removes Ham.
9. Log picker: `omel` shows the Omelette row with a `Recipe` tag; a recipe logged today outranks a food never logged; picking it opens the card with amounts 3 and 2 and the Servings field, and hides Amount, Unit and the chips.
10. Card: changing Egg to 2 and Servings to 2 updates the Total to 2×(2 eggs + 2 oz ham); a blank or 0 amount shows `—` and is skipped on log.
11. Log it with Egg 2, Ham 2, Servings 2 writes Egg 4 count and Ham 4 oz into the latest meal under one group header `Omelette ×2` whose total equals the sum of the two rows; servings 1 renders `Omelette`; the day total and macro chart include them.
12. Log it with every amount blank shows `Enter at least one amount greater than 0.`; Servings `0` shows `Enter servings greater than 0.`.
13. The group's × removes both rows and the header; × on one item leaves the other under the header; × on the last item removes the header.
14. Reload preserves recipes, groups and servings; Export → Import round-trips them.
