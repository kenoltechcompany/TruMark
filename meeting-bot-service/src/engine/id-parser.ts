export interface IdRules {
  idHasNumbers?: boolean;
  idHasAlphabets?: boolean;
  idMinLength?: number;
  idMaxLength?: number;
  idPrefix?: string;
  idSuffix?: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class IdParser {
  private readonly regex: RegExp;

  constructor(private readonly rules: IdRules = {}) {
    const hasNumbers = rules.idHasNumbers !== false;
    const hasAlphabets = rules.idHasAlphabets === true;

    let charClass = '[0-9]';
    if (hasNumbers && hasAlphabets) {
      charClass = '[A-Za-z0-9]';
    } else if (hasAlphabets && !hasNumbers) {
      charClass = '[A-Za-z]';
    }

    const prefix = rules.idPrefix ? escapeRegex(rules.idPrefix.trim()) : '';
    const suffix = rules.idSuffix ? escapeRegex(rules.idSuffix.trim()) : '';

    const minLen = Math.max(1, rules.idMinLength ?? 10);
    const maxLen = Math.max(minLen, rules.idMaxLength ?? 10);

    // If prefix/suffix present, calculate variable length of inner body
    const prefixLen = rules.idPrefix?.trim().length || 0;
    const suffixLen = rules.idSuffix?.trim().length || 0;

    const innerMin = Math.max(1, minLen - prefixLen - suffixLen);
    const innerMax = Math.max(innerMin, maxLen - prefixLen - suffixLen);

    const lengthQuantifier = innerMin === innerMax ? `{${innerMin}}` : `{${innerMin},${innerMax}}`;

    // Construct robust word boundary regex with global flag to scan strings
    this.regex = new RegExp(
      `(?:^|[^A-Za-z0-9])(${prefix}${charClass}${lengthQuantifier}${suffix})(?:$|[^A-Za-z0-9])`,
      'gi',
    );
  }

  /**
   * Parses a single participant string.
   * If multiple index numbers appear in one participant string (suspicious),
   * strictly returns only the first valid detected index number and ignores the rest.
   */
  public extractFirstFromParticipant(nameString: string): string | null {
    if (!nameString || typeof nameString !== 'string') return null;

    // Reset regex index state
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    // Create fresh instance of regex for thread-safe matching
    const rx = new RegExp(this.regex.source, 'gi');
    while ((match = rx.exec(nameString)) !== null) {
      if (match[1]) {
        matches.push(match[1].toUpperCase());
      }
    }

    if (matches.length === 0) return null;

    // Return the FIRST detected index number
    return matches[0];
  }

  /**
   * Processes a list of raw participant strings from the meeting roster.
   * Deduplicates so that if multiple participants share the same index number
   * (e.g. laptop + phone login), it is marked only once in the returned Set.
   */
  public parseParticipantList(rawParticipants: string[]): {
    uniqueIndexNumbers: string[];
    participantCount: number;
    matchedCount: number;
  } {
    const uniqueSet = new Set<string>();

    for (const raw of rawParticipants) {
      const detectedId = this.extractFirstFromParticipant(raw);
      if (detectedId) {
        uniqueSet.add(detectedId);
      }
    }

    return {
      uniqueIndexNumbers: Array.from(uniqueSet),
      participantCount: rawParticipants.length,
      matchedCount: uniqueSet.size,
    };
  }
}
