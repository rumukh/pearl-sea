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
import { ART, COSMETIC_BASE_WIDTH, CROWN_ART_ID } from '../../rules/contract';
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
  egg: [120, 160],
  monster: [1024, 1024],
  inkoustik: [640, 640],
  scene: [1600, 900],
  map: [1600, 1000],
  character: [1024, 1024],
  avatar: [512, 512],
  cosmetic: [100, 100],
  sticker: [100, 100],
};

/** Where cosmetics sit on a placeholder friend (the real paintings publish their own). */
export const DEFAULT_ANCHORS: Readonly<Record<ArtAnchor, AnchorPoint>> = {
  head: { x: 500, y: 150, scale: 100, rotate: 0 },
  eyes: { x: 500, y: 360, scale: 100, rotate: 0 },
  neck: { x: 500, y: 640, scale: 100, rotate: 0 },
};

/**
 * The shell's own crown, until S5's `CROWN_ART_ID` is in the catalog: its width on `head` at scale
 * 100, in thousandths of the painting.
 */
export const CROWN_WIDTH = 300;

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

/** A five-pointed star of radius `r * 0.45` about (`cx`, `cy`). */
function starPath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r * 0.45} L ${cx + r * 0.14} ${cy - r * 0.12} L ${cx + r * 0.45} ${cy - r * 0.1} L ${cx + r * 0.2} ${cy + r * 0.1} L ${cx + r * 0.28} ${cy + r * 0.42} L ${cx} ${cy + r * 0.24} L ${cx - r * 0.28} ${cy + r * 0.42} L ${cx - r * 0.2} ${cy + r * 0.1} L ${cx - r * 0.45} ${cy - r * 0.1} L ${cx - r * 0.14} ${cy - r * 0.12} Z`;
}

/** A simple drawing of the art's kind, in the art's own pixel box. */
function placeholderDrawing(id: string, width: number, height: number): SVGSVGElement {
  const hue = hueOf(id);
  const fill = `hsl(${hue} 70% 72%)`;
  const deep = `hsl(${hue} 55% 42%)`;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2;
  // An outline in proportion to the box: 18 units on a 1024-pixel painting.
  const OUTLINE = { stroke: '#123a52', 'stroke-width': r * 0.035, 'stroke-linejoin': 'round' };
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
      parts.push(
        svg('circle', { cx, cy, r: r * 0.8, fill, ...OUTLINE }),
        svg('path', { d: starPath(cx, cy, r), fill: '#ffd166' }),
      );
      break;
    case 'sticker':
      // A sticker is composed (`stickerPicture`): the frame is a rim around the shell's disc,
      // the icon a picture on it.
      parts.push(
        id.startsWith('sticker/frame')
          ? svg('circle', {
              cx,
              cy,
              r: r * 0.84,
              fill: 'none',
              stroke: '#ffffff',
              'stroke-width': r * 0.12,
            })
          : svg('path', {
              d: starPath(cx, cy, r),
              fill: deep,
              stroke: '#ffffff',
              'stroke-width': r * 0.04,
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
          'stroke-width': r * 0.027,
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

/** A sticker's look, from its content record (`Sticker` in content.ts): two art IDs and a colour. */
export interface StickerLook {
  /** `sticker/<icon>`: the picture, in full colour. */
  readonly icon: string;
  /** `sticker/frame-…`: the rim, the white die-cut edge and the shadow. */
  readonly frame: string;
  /** The disc's colour, `#rrggbb`. */
  readonly color: string;
}

/** A sticker's box and the radius of its disc, in the units of S5's 100 × 100 sticker SVGs. */
const STICKER_BOX = 100;
const STICKER_DISC = 40;

/** One layer of a composed picture: its catalog file, or the kind's placeholder drawing. */
function layer(art: ArtLibrary, id: string): Element {
  const entry = art.entry(id);
  if (entry) {
    return h('img', {
      className: 'ps-sticker__layer',
      attributes: { src: art.url(entry), alt: '', decoding: 'async', draggable: 'false' },
    });
  }
  const [width, height] = pictureSize(art, id);
  const drawing = placeholderDrawing(id, width, height);
  drawing.classList.add('ps-sticker__layer');
  return drawing;
}

/**
 * A sticker, composed from its record as Dragon Valley's composer does: three layers filling one
 * square box of 100 × 100 units. The shell draws a flat disc in the sticker's colour (centre 50,
 * 50, radius 40); the frame's SVG goes over it (clear inside radius 38 but for a soft sheen, then
 * the shell rim, the white die-cut edge and the shadow, so the disc's edge never shows); the icon's
 * SVG goes on top, within radius 36. Until S5's SVGs are in the catalog, placeholders stand in.
 */
export function stickerPicture(
  art: ArtLibrary,
  look: StickerLook,
  options: PictureOptions = {},
): HTMLElement {
  const box = h('span', {
    className: ['ps-sticker', options.className ?? ''].join(' ').trim(),
    dataset: { icon: look.icon, frame: look.frame },
    ...(options.testId ? { testId: options.testId } : {}),
  });
  if (options.alt) {
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', options.alt);
  } else {
    box.setAttribute('aria-hidden', 'true');
  }
  const centre = STICKER_BOX / 2;
  box.append(
    svg(
      'svg',
      {
        class: 'ps-sticker__layer',
        viewBox: `0 0 ${STICKER_BOX} ${STICKER_BOX}`,
        'aria-hidden': 'true',
        focusable: 'false',
      },
      svg('circle', { cx: centre, cy: centre, r: STICKER_DISC, fill: look.color }),
    ),
    layer(art, look.frame),
    layer(art, look.icon),
  );
  const missing = [look.frame, look.icon].filter((id) => !art.entry(id));
  if (missing.length > 0) {
    box.dataset['placeholder'] = 'true';
    box.append(
      h('span', {
        className: 'ps-art__dev',
        text: `DEV ${missing.join(' + ')}`,
        attributes: { 'aria-hidden': 'true' },
      }),
    );
  }
  return box;
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
  /**
   * Put `element` on an anchor, `width` thousandths of the painting wide at scale 100: for a
   * cosmetic, the contract's anchor scale (`cosmeticPlacement`, `COSMETIC_BASE_WIDTH`) in percent.
   */
  const place = (element: Element, anchor: ArtAnchor, width: number): void => {
    const point = anchorOf(art, id, anchor);
    const holder = h('span', { className: 'ps-art__worn', dataset: { anchor } });
    holder.style.left = `${point.x / 10}%`;
    holder.style.top = `${point.y / 10}%`;
    holder.style.width = `${(width * point.scale) / 1000}%`;
    holder.style.transform = `translate(-50%, -50%) rotate(${point.rotate}deg)`;
    holder.append(element);
    base.append(holder);
  };
  for (const anchor of ['neck', 'eyes', 'head'] as const) {
    const item = look.outfit?.[anchor];
    if (item) place(picture(art, ART.cosmetic(item)), anchor, COSMETIC_BASE_WIDTH);
  }
  if (look.stage === 'crowned') {
    if (art.entry(CROWN_ART_ID)) place(picture(art, CROWN_ART_ID), 'head', COSMETIC_BASE_WIDTH);
    else place(shellCrown(), 'head', CROWN_WIDTH);
  }
  return base;
}
