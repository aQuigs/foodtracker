# M9 — Fuzzy search

## Goal

Replace the case-insensitive substring filter in the Log picker and Foods picker with a typo-tolerant fuzzy match so users can find foods despite small spelling mistakes or partial word queries.

## Algorithm: subsequence scoring with gap penalty

All query characters must appear in the food name **in order** (subsequence match). Every character in the query is matched greedily to the earliest available character in the name, and a score is computed as:

```
score = matchedChars - gapPenalty
gapPenalty = totalSkippedChars * 0.1
```

Where `totalSkippedChars` is the sum of gaps between matched characters in the name. Higher score = better match.

### Why this algorithm

- **Typo-tolerant via reordering tolerance:** "chiken" matches "Chicken breast" because all letters of "chiken" appear in order in the name (c-h-i-c-k-e-n maps to c-h-i-c-k-e-n). One-letter omissions ("bana" → "Banana") match naturally.
- **Multi-word queries work:** "olv ol" matches "Olive oil" because all letters appear in order across words.
- **Gibberish is rejected:** "zzzzqq" returns no results because no food name contains those letters in sequence.
- **Simple and zero-dependency:** a single scoring function with no external library, consistent with this project's deliberate avoidance of runtime deps beyond Vite/test runner.
- **Gap penalty ranks tighter matches higher:** "ban" scores higher against "Banana" than against "Cranberry" (fewer gaps) so the most relevant results bubble up.

### Worked examples

| Query | Name | Match? | Why |
|-------|------|--------|-----|
| `bana` | Banana | yes | b-a-n-a appear in order, 0 skips between first 4 letters |
| `chiken` | Chicken breast | yes | c-h-i-c-k-e-n — skips one 'c' (off by one letter) |
| `olv ol` | Olive oil | yes | o-l-v appear early, then o-l later |
| `zzzzqq` | any food | no | 'z' not found, no match |

## Scoring tie-break

Results are sorted by score descending, then alphabetically by name (case-insensitive) as a stable secondary key.

## In scope

- `fuzzyScore(name, query): number | null` — pure scorer in `src/ui/search.ts`. Returns `null` when no match (query letters not all found in order).
- `filterFoods(foods, query)` updated to use `fuzzyScore` for non-empty queries.
- Empty query returns all live foods (unchanged behavior — recent-usage sort is applied by the caller for the Log picker, not here).
- Soft-deleted foods remain excluded regardless of query.

## Out of scope

- Highlighting matched characters in the UI.
- Per-field weighting (name only, no separate prefix bonus).
- Swapping the recent-usage sort (`sortFoodsForLog`) — that applies only on empty query and is untouched.

## Acceptance criteria

1. Empty query returns all non-deleted foods.
2. Whitespace-only query treated as empty.
3. Exact substring match scores and returns a result.
4. Single-letter omission ("bana" → "Banana") matches.
5. One-character typo / transposition ("chiken" → "Chicken breast") matches.
6. Multi-word query ("olv ol" → "Olive oil") matches.
7. All-gibberish query ("zzzzqq") returns empty list.
8. Case-insensitive matching (uppercase query matches lowercase name and vice versa).
9. Results are sorted by score descending; ties are sorted alphabetically.
10. Soft-deleted foods excluded even when query would otherwise match.
11. Foods with higher letter density (fewer gaps) rank above sparser matches.
12. Query that spans two words in the name ("ck br" → "Chicken breast") matches.
