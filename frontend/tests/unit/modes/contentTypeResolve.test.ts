import { describe, it, expect } from 'vitest';
import { getModeProfile, resolveContentType } from '../../../src/modes';
import { resolveScriptContentType } from '../../../src/lib/firebase/firestoreService';

/** 3-value contentType resolution (specs/003 FR-101). Unknown/missing → screenplay. */
describe('contentType resolution with storyboard', () => {
  it('resolves all three modes and falls back to screenplay', () => {
    expect(resolveContentType('screenplay')).toBe('screenplay');
    expect(resolveContentType('novel')).toBe('novel');
    expect(resolveContentType('storyboard')).toBe('storyboard');
    expect(resolveContentType(undefined)).toBe('screenplay');
    expect(resolveContentType(null)).toBe('screenplay');
    expect(resolveContentType('unknown')).toBe('screenplay');
  });

  it('firestore-side resolver matches', () => {
    expect(resolveScriptContentType('storyboard')).toBe('storyboard');
    expect(resolveScriptContentType('novel')).toBe('novel');
    expect(resolveScriptContentType(undefined)).toBe('screenplay');
  });

  it('registers a storyboard mode profile', () => {
    const profile = getModeProfile('storyboard');
    expect(profile.contentType).toBe('storyboard');
    expect(profile.label).toBe('絵コンテ');
    expect(profile.toolbar.map((a) => a.id)).toEqual(['scene', 'cut']);
    expect(profile.structure.kind).toBe('chapterList');
  });

  it('keeps screenplay and novel profiles unchanged', () => {
    expect(getModeProfile('screenplay').label).toBe('脚本');
    expect(getModeProfile('novel').label).toBe('小説');
  });
});
