/**
 * The event vocabulary (contract §13): names are `<subject>.<verb>`, unique, each with a payload
 * type, and docs/contract.md §13 lists exactly the events `EVENTS` has, so the shell's authors
 * (sounds, animations, announcements) and the rules agree on one list. `monster.joked` (added for
 * the battle's jokes) carries the monster and the joke's catalog key.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { EVENTS, EVENT_TYPES } from '../../../src/rules/contract';
import type { EventPayloads, EventType, GameEvent } from '../../../src/rules/contract';

const root = join(import.meta.dirname, '..', '..', '..');
const contractDoc = readFileSync(join(root, 'docs', 'contract.md'), 'utf8');

/** The event names in the backticks of docs/contract.md §13's table. */
function documentedEvents(): string[] {
  const start = contractDoc.indexOf('## 13. Events');
  const end = contractDoc.indexOf('## 14.', start);
  const section = contractDoc.slice(start, end);
  const rows = section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| Group'));
  return rows.flatMap((row) => {
    const cell = row.split('|')[2] ?? '';
    return [...cell.matchAll(/`([a-z-]+\.[a-z-]+)`/g)].map((match) => match[1]!);
  });
}

describe('the event vocabulary', () => {
  it('has unique <subject>.<verb> names', () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
    for (const type of EVENT_TYPES) expect(type).toMatch(/^[a-z]+(-[a-z]+)*\.[a-z]+(-[a-z]+)*$/);
  });

  it('is listed, exactly, in docs/contract.md §13', () => {
    expect([...documentedEvents()].sort()).toEqual([...EVENT_TYPES].sort());
  });

  it('has the battle joke with its monster and catalog key', () => {
    expect(EVENTS.monsterJoked).toBe('monster.joked');
    expectTypeOf<EventPayloads['monster.joked']>().toEqualTypeOf<{
      monster: string;
      joke: string;
    }>();
    const joked: GameEvent = {
      type: 'monster.joked',
      data: { monster: 'murena-mumla', joke: 'monster.murena-mumla.joke.1' },
    };
    expect(joked.type satisfies EventType).toBe(EVENTS.monsterJoked);
  });
});
