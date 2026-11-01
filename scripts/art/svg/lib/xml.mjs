// @ts-check
/** Markup builders for static SVG files (ported from Dragon Valley). Children are trusted markup. */
import { f } from './num.mjs';

/** @typedef {string | number | undefined | null | false} AttrValue */
/** @typedef {Record<string, AttrValue>} Attrs */
/** @typedef {string | false | null | undefined} Child */

/** @param {string} s */
export function escAttr(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {Attrs | null | undefined} attrs */
function attrString(attrs) {
  if (!attrs) return '';
  let out = '';
  for (const key of Object.keys(attrs)) {
    const v = attrs[key];
    if (v === undefined || v === null || v === false) continue;
    out += ` ${key}="${typeof v === 'number' ? f(v) : escAttr(v)}"`;
  }
  return out;
}

/**
 * @param {Child[]} children
 */
function joinChildren(children) {
  return children.filter((c) => typeof c === 'string' && c !== '').join('');
}

/**
 * An element: numbers are formatted deterministically, nullish and false attributes omitted.
 *
 * @param {string} tag
 * @param {Attrs | null} [attrs]
 * @param {...Child} children
 */
export function h(tag, attrs, ...children) {
  const inner = joinChildren(children);
  const a = attrString(attrs);
  return inner === '' ? `<${tag}${a}/>` : `<${tag}${a}>${inner}</${tag}>`;
}

/**
 * A group, or nothing when it would be empty.
 *
 * @param {Attrs | null} attrs
 * @param {...Child} children
 */
export function g(attrs, ...children) {
  const inner = joinChildren(children);
  return inner === '' ? '' : `<g${attrString(attrs)}>${inner}</g>`;
}

/**
 * A standalone SVG file: the viewBox from the origin, its size as width and height (the catalog
 * publishes the same size), no text, and a final line feed.
 *
 * @param {number} width
 * @param {number} height
 * @param {...Child} children
 */
export function svgFile(width, height, ...children) {
  return `${h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${f(width)} ${f(height)}`,
      width,
      height,
    },
    ...children,
  )}\n`;
}
