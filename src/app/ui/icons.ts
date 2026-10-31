/**
 * Interface icons, drawn here on a 24-unit grid on one principle: round caps and joins, a stroke
 * of about a tenth of the grid, in `currentColor`, so an icon takes the colour of its control.
 * The few full-colour marks (the gold coin, stars, the correct and almost badges) colour their
 * parts through classes and tokens. Icons are decorative: the control around them carries the
 * words.
 */
import { svg } from './dom';

interface Shape {
  readonly d: string;
  readonly fill?: boolean;
}

const GLYPHS = {
  check: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }],
  question: [{ d: 'M9 9.2a3 3 0 1 1 4.3 2.7c-.8.4-1.3 1.1-1.3 2v.6' }, { d: 'M12 18.3v.2' }],
  back: [{ d: 'M14.5 5.5L8 12l6.5 6.5' }],
  forward: [{ d: 'M9.5 5.5L16 12l-6.5 6.5' }],
  lock: [{ d: 'M6 11h12v9H6z' }, { d: 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3' }, { d: 'M12 14.5v2' }],
  speaker: [
    { d: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4z' },
    { d: 'M15.5 9.2a4 4 0 0 1 0 5.6' },
    { d: 'M18 6.6a7.6 7.6 0 0 1 0 10.8' },
  ],
  settings: [{ d: 'M4 7h8M16 7h4M4 17h4M12 17h8' }, { d: 'M14 4.5v5M10 14.5v5' }],
  home: [{ d: 'M4 11.5L12 5l8 6.5' }, { d: 'M6.5 10v9.5h11V10' }, { d: 'M10 19.5v-5h4v5' }],
  close: [{ d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }],
  grownups: [
    { d: 'M9 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
    { d: 'M3.5 19.5a5.5 5.5 0 0 1 11 0' },
    { d: 'M15.5 4.8a3 3 0 0 1 0 5.4' },
    { d: 'M17 13.6a5.5 5.5 0 0 1 3.5 5.9' },
  ],
  hint: [
    { d: 'M9.5 17h5M10.5 20h3' },
    {
      d: 'M12 3.5a5.5 5.5 0 0 0-3.2 10c.4.3.7.8.7 1.3v.2h5v-.2c0-.5.3-1 .7-1.3A5.5 5.5 0 0 0 12 3.5z',
    },
  ],
  print: [
    { d: 'M7 9V4h10v5' },
    { d: 'M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2' },
    { d: 'M7 14h10v6H7z' },
  ],
  pause: [{ d: 'M9 6v12M15 6v12' }],
  play: [{ d: 'M8 5.5v13l10.5-6.5z', fill: true }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  minus: [{ d: 'M5 12h14' }],
  pencil: [{ d: 'M5 19l1-4L16 5l3 3L9 18z' }, { d: 'M14 7l3 3' }],
  download: [{ d: 'M12 4v11M7.5 10.5L12 15l4.5-4.5' }, { d: 'M5 19.5h14' }],
  upload: [{ d: 'M12 15V4M7.5 8.5L12 4l4.5 4.5' }, { d: 'M5 19.5h14' }],
  trash: [{ d: 'M5 7h14M10 7V5h4v2' }, { d: 'M7 7l1 13h8l1-13' }, { d: 'M10.5 11v5M13.5 11v5' }],
  warning: [{ d: 'M12 4.5l8.5 15h-17z' }, { d: 'M12 10v4' }, { d: 'M12 17v.2' }],
  retry: [{ d: 'M19 12a7 7 0 1 1-2.05-4.95' }, { d: 'M17.5 3.8v3.7h-3.7' }],
  backspace: [{ d: 'M9 6h11v12H9l-6-6z' }, { d: 'M12.5 9.5l5 5M17.5 9.5l-5 5' }],
  shield: [{ d: 'M12 3.5l7 2.6v5.4c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6.1z' }, { d: 'M9 12l2 2 4-4' }],
  sparkle: [{ d: 'M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z', fill: true }],
  book: [
    { d: 'M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z' },
    { d: 'M5 19.5A1.5 1.5 0 0 0 6.5 21H19' },
  ],
  map: [{ d: 'M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z' }, { d: 'M9 4.5v13M15 6.5v13' }],
  gift: [
    { d: 'M4.5 10.5h15v9h-15zM3.5 7.5h17v3h-17zM12 7.5v12' },
    {
      d: 'M12 7.5c-2-3.5-5.5-3-4.5-.5.6 1.4 4.5.5 4.5.5zM12 7.5c2-3.5 5.5-3 4.5-.5-.6 1.4-4.5.5-4.5.5z',
    },
  ],
  bag: [{ d: 'M5.5 8h13l-1 12h-11z' }, { d: 'M9 8V6.5a3 3 0 0 1 6 0V8' }],
  pearl: [{ d: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z' }, { d: 'M8.8 10.4a3.4 3.4 0 0 1 2.9-2.6' }],
} satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof GLYPHS;
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

function frame(className: string): SVGSVGElement {
  return svg('svg', {
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    focusable: 'false',
    class: className,
  });
}

export function icon(name: IconName, className = 'ps-icon'): SVGSVGElement {
  const node = frame(className);
  node.dataset['icon'] = name;
  for (const shape of GLYPHS[name] as readonly Shape[]) {
    node.appendChild(
      svg('path', {
        d: shape.d,
        fill: shape.fill ? 'currentColor' : 'none',
        stroke: 'currentColor',
        'stroke-width': shape.fill ? 0 : 2.4,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
  }
  return node;
}

/** A gold coin from sunken treasure, with an anchor on its face. */
export function coinIcon(className = 'ps-coin'): SVGSVGElement {
  const node = frame(className);
  node.append(
    svg('circle', { class: 'ps-coin__rim', cx: 12, cy: 12, r: 10.5 }),
    svg('circle', { class: 'ps-coin__face', cx: 12, cy: 12, r: 8 }),
    svg('path', {
      class: 'ps-coin__mark',
      d: 'M12 8.6v7.6M9.6 10.6h4.8M8.4 13.4a3.6 3.6 0 0 0 7.2 0M12 6.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z',
    }),
  );
  return node;
}

const STAR = 'M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.1 5.9L12 16.5l-5.3 2.9 1.1-5.9L3.4 9.4l6-.7z';

/** An earned star is filled gold; a missing one only its outline, so shape tells them apart too. */
export function starIcon(earned: boolean, className = 'ps-star'): SVGSVGElement {
  const node = frame(`${className} ${earned ? 'ps-star--earned' : 'ps-star--empty'}`);
  node.append(svg('path', { class: 'ps-star__shape', d: STAR }));
  return node;
}

/** The badge on a choice: a green disc with a check, or an orange disc with a question mark. */
export function badgeIcon(kind: 'correct' | 'almost', className = 'ps-badge-art'): SVGSVGElement {
  const node = frame(`${className} ${className}--${kind}`);
  node.append(
    svg('circle', { class: 'ps-badge-art__disc', cx: 12, cy: 12, r: 11 }),
    svg('path', {
      class: 'ps-badge-art__mark',
      d:
        kind === 'correct'
          ? 'M7 12.5l3.2 3.2L17 9'
          : 'M9.4 9.4a2.7 2.7 0 1 1 3.9 2.4c-.7.4-1.3 1-1.3 1.9v.4M12 17.4v.1',
    }),
  );
  return node;
}
