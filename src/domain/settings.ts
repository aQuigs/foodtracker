import type { MacroDisplay, Settings } from './types.js';

export const MEAL_MACRO_DISPLAYS: Record<MacroDisplay, { label: string }> = {
  percent: { label: '%' },
  grams:   { label: 'g' },
};

export const MACRO_DISPLAY_KEYS = Object.keys(MEAL_MACRO_DISPLAYS) as MacroDisplay[];

export function isMacroDisplay(x: unknown): x is MacroDisplay {
  return typeof x === 'string' && Object.hasOwn(MEAL_MACRO_DISPLAYS, x);
}

export const DEFAULT_SETTINGS: Settings = { mealMacros: 'percent' };

export function defaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS };
}
