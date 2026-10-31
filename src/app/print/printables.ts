/**
 * A child's printables, in Czech: flashcards of the words the child finds hardest (the word with
 * its spelling point left blank on the front, the whole word on the back, so the card asks the
 * very letter the child keeps missing) and diplomas for a monster set free and for a whole grade.
 * Only words' spelling points make cards: other items (a case, a word's family) have no blank.
 */
import { parseItemId } from '../../rules/contract';
import type { Grade, GrownUpsView } from '../../rules/contract';
import type { Translate } from '../i18n/messages';
import { czechDate } from '../i18n/typography';
import type { CardText, CertificateText } from './documents';

/** The blank on a card's front, as Czech workbooks write it. */
export const BLANK = '_';

/** Flashcards for the hardest items that are a word's spelling point, hardest first. */
export function hardestCards(hardest: GrownUpsView['hardest']): CardText[] {
  const cards: CardText[] = [];
  for (const entry of hardest) {
    const parsed = parseItemId(entry.item);
    if (parsed?.kind !== 'spell') continue;
    const letters = [...entry.text];
    if (parsed.at >= letters.length) continue;
    const front = letters.map((letter, index) => (index === parsed.at ? BLANK : letter)).join('');
    cards.push({ id: entry.item, front: [front], back: [entry.text] });
  }
  return cards;
}

/** A diploma for washing a monster's ink away, dated the day it was freed. */
export function monsterDiploma(
  t: Translate,
  child: string,
  monster: { readonly id: string; readonly name: string; readonly day: string },
): CertificateText {
  return {
    id: `certificate:monster:${monster.id}`,
    heading: t('diploma.heading'),
    body: [child, t('diploma.monster', { monster: monster.name }), czechDate(monster.day)],
  };
}

/** A diploma for a whole grade's sea, dated the day it is printed. */
export function gradeDiploma(
  t: Translate,
  child: string,
  grade: Grade,
  day: string,
): CertificateText {
  return {
    id: `certificate:grade:${grade}`,
    heading: t('diploma.heading'),
    body: [child, t('diploma.grade', { grade }), czechDate(day)],
  };
}
