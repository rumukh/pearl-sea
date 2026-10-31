/**
 * Pictures by art ID (`ART` in media.ts): a published painting or SVG from S5's catalog, or, for
 * an ID the catalog lacks, a **visibly labelled dev placeholder** of the same kind and shape
 * ("DEV friend/krab-tvrdak/baby"), so screens are laid out for the real art and the files drop in
 * without code changes (art/library.ts).
 *
 * A picture keeps its aspect ratio (the catalog's pixel size, or the kind's default) and fills the
 * width it is given. With `alt` it is an image for screen readers; without, it is decoration.
 * Painted friends carry SVG cosmetics on their published anchors (`dressedFriend`): the crowned
 * stage is the grown painting with a golden shell crown on `head`.
 */
import type { AnchorPoint, ArtAnchor, ArtEntry, FriendStage } from '../../rules/contract';
import { ART } from '../../rules/contract';
import { h, svg } from '../ui/dom';
import type { ArtLibrary } from './library';

export interface PictureOptions {
  /** What the picture shows, for screen readers; omit for a decorative picture. */
  readonly alt?: string;
  readonly className?: string;
  readonly testId?: string;
}

/** The art kind of an ID: its first segment (`friend`, `monster`, `scene`, …). */
export function artKind(id: string): string {
  return id.split('/')[0] ?? '';
}

/** Pixel sizes S5 paints at, for placeholders until the catalog has the real size. */
const DEFAULT_SIZES: Readonly<Record<string, readonly [number, number]>> = {
  friend: [1024, 1024],
  egg: [600, 800],
  monster: [1024, 1024],
  inkoustik: [640, 640],
  scene: [1600, 900],
  map: [1600, 1000],
  character: [1024, 1024],
  avatar: [512, 512],
  cosmetic: [256, 256],
  sticker: [256, 256],
};

/** Where cosmetics sit on a placeholder friend (the real paintings publish their own). */
export const DEFAULT_ANCHORS: Readonly<Record<ArtAnchor, AnchorPoint>> = {
  head: { x: 500, y: 150, scale: 100, rotate: 0 },
  eyes: { x: 500, y: 360, scale: 100, rotate: 0 },
  neck: { x: 500, y: 640, scale: 100, rotate: 0 },
};

export function pictureSize(art: ArtLibrary, id: string): readonly [number, number] {
  const entry = art.entry(id);
  return entry ? [entry.width, entry.height] : (DEFAULT_SIZES[artKind(id)] ?? [1000, 1000]);
}

export function anchorOf(art: ArtLibrary, id: string, anchor: ArtAnchor): AnchorPoint {
  return art.entry(id)?.anchors?.[anchor] ?? DEFAULT_ANCHORS[anchor];
}

/** A hue from the ID's letters, so each placeholder keeps its own colour. */
function hueOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  return hash;
}

const OUTLINE = { stroke: '#123a52', 'stroke-width': 18, 'stroke-linejoin': 'round' } as const;

/** A simple drawing of the art's kind, in the art's own pixel box. */
function placeholderDrawing(id: string, width: number, height: number): SVGSVGElement {
  const hue = hueOf(id);
  const fill = `hsl(${hue} 70% 72%)`;
  const deep = `hsl(${hue} 55% 42%)`;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2;
  const parts: SVGElement[] = [];
  switch (artKind(id)) {
    case 'scene':
    case 'map':
      parts.push(
        svg('rect', {
          x: 0,
          y: 0,
          width,
          height,
          fill: id.endsWith('deep') ? '#0f3d63' : '#5cc6d6',
        }),
        svg('ellipse', {
          cx: width * 0.3,
          cy: height * 0.62,
          rx: width * 0.16,
          ry: height * 0.12,
          fill: '#f2dfae',
          ...OUTLINE,
        }),
        svg('ellipse', {
          cx: width * 0.72,
          cy: height * 0.38,
          rx: width * 0.12,
          ry: height * 0.1,
          fill: '#f2dfae',
          ...OUTLINE,
        }),
        svg('rect', { x: 0, y: height * 0.86, width, height: height * 0.14, fill: '#e8cf8f' }),
      );
      break;
    case 'egg':
      parts.push(
        svg('ellipse', { cx, cy, rx: width * 0.38, ry: height * 0.44, fill, ...OUTLINE }),
        svg('circle', { cx: cx - width * 0.12, cy: cy - height * 0.1, r: r * 0.1, fill: deep }),
        svg('circle', { cx: cx + width * 0.14, cy: cy + height * 0.12, r: r * 0.08, fill: deep }),
      );
      break;
    case 'monster':
    case 'inkoustik': {
      const inked = id.endsWith('/inked') || artKind(id) === 'inkoustik';
      const body = inked ? '#2b2f5a' : fill;
      for (let arm = 0; arm < 5; arm++) {
        const x = width * (0.2 + arm * 0.15);
        parts.push(
          svg('path', {
            d: `M ${x} ${height * 0.6} q ${width * 0.04} ${height * 0.2} ${-width * 0.03} ${height * 0.32}`,
            fill: 'none',
            stroke: body,
            'stroke-width': width * 0.06,
            'stroke-linecap': 'round',
          }),
        );
      }
      parts.push(
        svg('ellipse', {
          cx,
          cy: height * 0.42,
          rx: width * 0.36,
          ry: height * 0.3,
          fill: body,
          ...OUTLINE,
        }),
        svg('circle', { cx: cx - width * 0.12, cy: height * 0.38, r: r * 0.09, fill: '#ffffff' }),
        svg('circle', { cx: cx + width * 0.12, cy: height * 0.38, r: r * 0.09, fill: '#ffffff' }),
      );
      break;
    }
    case 'cosmetic':
    case 'sticker':
      parts.push(
        svg('circle', { cx, cy, r: r * 0.8, fill, ...OUTLINE }),
        svg('path', {
          d: `M ${cx} ${cy - r * 0.45} L ${cx + r * 0.14} ${cy - r * 0.12} L ${cx + r * 0.45} ${cy - r * 0.1} L ${cx + r * 0.2} ${cy + r * 0.1} L ${cx + r * 0.28} ${cy + r * 0.42} L ${cx} ${cy + r * 0.24} L ${cx - r * 0.28} ${cy + r * 0.42} L ${cx - r * 0.2} ${cy + r * 0.1} L ${cx - r * 0.45} ${cy - r * 0.1} L ${cx - r * 0.14} ${cy - r * 0.12} Z`,
          fill: '#ffd166',
        }),
      );
      break;
    case 'avatar':
      parts.push(
        svg('circle', { cx, cy, r: r * 0.86, fill: '#f6c453', ...OUTLINE }),
        svg('circle', { cx, cy, r: r * 0.52, fill: '#bfe9f2', ...OUTLINE }),
        svg('circle', { cx: cx - r * 0.16, cy: cy - r * 0.04, r: r * 0.06, fill: '#123a52' }),
        svg('circle', { cx: cx + r * 0.16, cy: cy - r * 0.04, r: r * 0.06, fill: '#123a52' }),
      );
      break;
    default:
      // Friends and characters: a round sea creature with a fin and a smile.
      parts.push(
        svg('path', {
          d: `M ${width * 0.82} ${cy} l ${width * 0.14} ${-height * 0.14} l 0 ${height * 0.28} z`,
          fill: deep,
          ...OUTLINE,
        }),
        svg('ellipse', {
          cx: cx - width * 0.04,
          cy,
          rx: width * 0.36,
          ry: height * 0.3,
          fill,
          ...OUTLINE,
        }),
        svg('circle', {
          cx: cx - width * 0.2,
          cy: cy - height * 0.06,
          r: r * 0.07,
          fill: '#123a52',
        }),
        svg('path', {
          d: `M ${cx - width * 0.26} ${cy + height * 0.08} q ${width * 0.08} ${height * 0.08} ${width * 0.16} 0`,
          fill: 'none',
          stroke: '#123a52',
          'stroke-width': 14,
          'stroke-linecap': 'round',
        }),
      );
  }
  return svg(
    'svg',
    {
      class: 'ps-art__drawing',
      viewBox: `0 0 ${width} ${height}`,
      // Scenes fill a backdrop of any shape, as a painting does with object-fit: cover.
      ...(artKind(id) === 'scene' || artKind(id) === 'map'
        ? { preserveAspectRatio: 'xMidYMid slice' }
        : {}),
      'aria-hidden': 'true',
      focusable: 'false',
    },
    ...parts,
  );
}

/** A painting or SVG by art ID, or its labelled placeholder. */
export function picture(art: ArtLibrary, id: string, options: PictureOptions = {}): HTMLElement {
  const [width, height] = pictureSize(art, id);
  const frame = h('span', {
    className: ['ps-art', `ps-art--${artKind(id)}`, options.className ?? ''].join(' ').trim(),
    dataset: { artId: id },
    ...(options.testId ? { testId: options.testId } : {}),
  });
  frame.style.aspectRatio = `${width} / ${height}`;
  const entry: ArtEntry | undefined = art.entry(id);
  if (entry) {
    const image = h('img', {
      className: 'ps-art__image',
      attributes: {
        src: art.url(entry),
        alt: options.alt ?? '',
        width: String(width),
        height: String(height),
        decoding: 'async',
        draggable: 'false',
      },
    });
    frame.append(image);
    return frame;
  }
  frame.dataset['placeholder'] = 'true';
  if (options.alt) {
    frame.setAttribute('role', 'img');
    frame.setAttribute('aria-label', options.alt);
  } else {
    frame.setAttribute('aria-hidden', 'true');
  }
  frame.append(
    placeholderDrawing(id, width, height),
    h('span', {
      className: 'ps-art__dev',
      text: `DEV ${id}`,
      attributes: { 'aria-hidden': 'true' },
    }),
  );
  return frame;
}

/** The golden shell crown of a crowned friend, drawn by the shell on the `head` anchor. */
function shellCrown(): SVGSVGElement {
  return svg(
    'svg',
    { class: 'ps-crown', viewBox: '0 0 120 80', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', {
      d: 'M10 70 L18 20 L40 46 L60 8 L80 46 L102 20 L110 70 Z',
      fill: '#ffd166',
      stroke: '#8a5a00',
      'stroke-width': 6,
      'stroke-linejoin': 'round',
    }),
    svg('circle', { cx: 60, cy: 52, r: 9, fill: '#fff6dc', stroke: '#8a5a00', 'stroke-width': 4 }),
  );
}

export interface FriendLook {
  readonly friend: string;
  readonly stage: FriendStage;
  /** Cosmetic item IDs worn on `head`, `eyes` and `neck`. */
  readonly outfit?: Partial<Record<ArtAnchor, string | null>>;
}

/** The art ID that shows a friend at a stage: its egg, or its baby or grown painting. */
export function friendArtId(friend: string, stage: FriendStage): string {
  if (stage === 'egg') return ART.egg(friend);
  return ART.friend(friend, stage === 'baby' ? 'baby' : 'grown');
}

/**
 * A friend as the child sees it: the painting of its stage with what it wears on its anchors,
 * and the shell crown when crowned. Cosmetics are decoration; `alt` names the friend.
 */
export function dressedFriend(
  art: ArtLibrary,
  look: FriendLook,
  options: PictureOptions = {},
): HTMLElement {
  const id = friendArtId(look.friend, look.stage);
  const base = picture(art, id, options);
  if (look.stage === 'egg') return base;
  const place = (element: Element, anchor: ArtAnchor, width: number): void => {
    const point = anchorOf(art, id, anchor);
    const holder = h('span', { className: 'ps-art__worn', dataset: { anchor } });
    holder.style.left = `${point.x / 10}%`;
    holder.style.top = `${point.y / 10}%`;
    holder.style.width = `${(width * point.scale) / 100}%`;
    holder.style.transform = `translate(-50%, -50%) rotate(${point.rotate}deg)`;
    holder.append(element);
    base.append(holder);
  };
  for (const anchor of ['neck', 'eyes', 'head'] as const) {
    const item = look.outfit?.[anchor];
    if (item) place(picture(art, ART.cosmetic(item)), anchor, 34);
  }
  if (look.stage === 'crowned') place(shellCrown(), 'head', 30);
  return base;
}
