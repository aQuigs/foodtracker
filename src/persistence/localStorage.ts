import { freshState } from '../domain/seed.js';
import type { Entry, Food, State } from '../domain/types.js';
import type { StateRepository } from './repository.js';

export const STORAGE_KEY = 'foodtracker:v1';

function isNonNegFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function isFood(x: unknown): x is Food {
  if (typeof x !== 'object' || x === null) return false;
  const f = x as Record<string, unknown>;
  return typeof f.id === 'string' && f.id.length > 0
    && typeof f.name === 'string' && f.name.length > 0
    && isNonNegFinite(f.kcalPer100g)
    && isNonNegFinite(f.proteinPer100g)
    && isNonNegFinite(f.carbsPer100g)
    && isNonNegFinite(f.fatPer100g)
    && typeof f.createdAt === 'string'
    && (f.deletedAt === null || typeof f.deletedAt === 'string');
}

function isEntry(x: unknown): x is Entry {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Record<string, unknown>;
  return typeof e.id === 'string' && e.id.length > 0
    && typeof e.date === 'string'
    && typeof e.foodId === 'string' && e.foodId.length > 0
    && typeof e.grams === 'number' && Number.isFinite(e.grams) && e.grams > 0
    && typeof e.loggedAt === 'string';
}

function parseState(raw: string | null): State | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const s = parsed as Record<string, unknown>;
  if (s.version !== 1) return null;
  if (!Array.isArray(s.foods) || !s.foods.every(isFood)) return null;
  if (!Array.isArray(s.entries) || !s.entries.every(isEntry)) return null;
  return { version: 1, foods: s.foods, entries: s.entries };
}

export class LocalStorageRepository implements StateRepository {
  load(): State {
    return parseState(localStorage.getItem(STORAGE_KEY)) ?? freshState();
  }

  save(state: State): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
