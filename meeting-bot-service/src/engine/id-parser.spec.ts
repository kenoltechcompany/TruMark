import { describe, it, expect } from 'bun:test';
import { IdParser } from './id-parser';

describe('IdParser', () => {
  it('parses standard 10-digit numeric index numbers by default', () => {
    const parser = new IdParser(); // defaults: numbers=true, min=10, max=10

    expect(parser.extractFirstFromParticipant('John Doe (1092837482)')).toBe('1092837482');
    expect(parser.extractFirstFromParticipant('1092837482 - Kwame Mensah')).toBe('1092837482');
    expect(parser.extractFirstFromParticipant('Sarah Boateng [1092837482]')).toBe('1092837482');
    expect(parser.extractFirstFromParticipant('No index number here')).toBeNull();
    expect(parser.extractFirstFromParticipant('Short 12345')).toBeNull(); // 5 digits < 10
  });

  it('anti-cheat: extracts only first index number when multiple IDs appear in a single name', () => {
    const parser = new IdParser();
    // Suspicious: student puts two IDs in one name
    const suspicious = 'Kwame & Kofi (1092837482, 1092837499)';
    const result = parser.extractFirstFromParticipant(suspicious);
    expect(result).toBe('1092837482'); // only first one extracted
  });

  it('anti-cheat: deduplicates when multiple participants have the same index number', () => {
    const parser = new IdParser();
    const rawRoster = [
      'John Doe (1092837482)',
      'John Phone (1092837482)', // duplicate account
      'Sarah Mensah (1092837483)',
      'Unknown Guest',
    ];

    const parsed = parser.parseParticipantList(rawRoster);
    expect(parsed.participantCount).toBe(4);
    expect(parsed.matchedCount).toBe(2);
    expect(parsed.uniqueIndexNumbers).toEqual(['1092837482', '1092837483']);
  });

  it('supports alphanumeric index numbers with prefix and suffix', () => {
    const parser = new IdParser({
      idHasAlphabets: true,
      idHasNumbers: true,
      idMinLength: 8,
      idMaxLength: 8,
      idPrefix: 'UG',
      idSuffix: 'B',
    });

    // UG + 5 alphanumeric + B = 8 chars
    expect(parser.extractFirstFromParticipant('Student (UG12345B)')).toBe('UG12345B');
    expect(parser.extractFirstFromParticipant('Student (UG99999X)')).toBeNull(); // wrong suffix
    expect(parser.extractFirstFromParticipant('Student (KN12345B)')).toBeNull(); // wrong prefix
  });
});
