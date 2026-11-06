import { describe, expect, it } from 'vitest';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';
import arTN from './locales/ar-TN.json';
import arIQ from './locales/ar-IQ.json';
import arSY from './locales/ar-SY.json';

// Full locales carry every French key; dialect files only override keys that exist in French.
type Tree = { [key: string]: string | Tree };
const leaves = (node: Tree, prefix = ''): string[] => Object.entries(node).flatMap(([key, value]) =>
  typeof value === 'object' ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
const french = new Set(leaves(fr as Tree));

describe('locale files', () => {
  it.each([['en', en], ['ar', ar]])('%s has every French key', (_code, locale) => {
    const keys = new Set(leaves(locale as Tree));
    expect([...french].filter((key) => !keys.has(key))).toEqual([]);
  });
  it.each([['ar-TN', arTN], ['ar-IQ', arIQ], ['ar-SY', arSY]])('%s only overrides keys that exist', (_code, locale) => {
    expect(leaves(locale as Tree).filter((key) => !french.has(key))).toEqual([]);
  });
});
