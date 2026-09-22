import type { MacroDisplay, Settings } from './types.js';

export const MACRO_DISPLAYS: Record<MacroDisplay, { label: string }> = {
  percent: { label: '%' },
  grams:   { label: 'g' },
};

export const MACRO_DISPLAY_KEYS = Object.keys(MACRO_DISPLAYS) as MacroDisplay[];

export function isMacroDisplay(x: unknown): x is MacroDisplay {
  return typeof x === 'string' && Object.hasOwn(MACRO_DISPLAYS, x);
}

type SettingSpec<T> = { default: T; isValid: (x: unknown) => x is T };

export const SETTINGS_SPEC: { [K in keyof Settings]: SettingSpec<Settings[K]> } = {
  mealMacros: { default: 'percent', isValid: isMacroDisplay },
};

export const SETTINGS_KEYS = Object.keys(SETTINGS_SPEC) as (keyof Settings)[];

export function defaultSettings(): Settings {
  return Object.fromEntries(SETTINGS_KEYS.map((key) => [key, SETTINGS_SPEC[key].default])) as Settings;
}
