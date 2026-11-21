import { h } from '../ui/dom';

export type PortraitMotion = 'greet' | 'idle';
type Hinge = 'sides' | 'below' | 'right' | 'above' | 'whole';
const HINGES = {
  crab: 'sides',
  star: 'sides',
  wave: 'sides',
  jelly: 'below',
  turtle: 'below',
  jet: 'below',
  curl: 'below',
  scuttle: 'below',
  swim: 'right',
  dart: 'right',
  perch: 'above',
  leap: 'above',
  peek: 'above',
  puff: 'whole',
  spring: 'whole',
  drift: 'whole',
} as const satisfies Record<string, Hinge>;
type Profile = readonly [keyof typeof HINGES, root?: number, tip?: number];

/** Hinges are percentages of the trimmed painting, not of the screen. Props painted into a
 * portrait (the moray's rock, the seal's ice, the dolphin's wave) need a stationary base. */
const CAST: Readonly<Record<string, Profile>> = {
  'friend/krab-tvrdak': ['crab'],
  'friend/meduzka-mekulka': ['jelly', 42, 70],
  'friend/meduzka-mekulka/baby': ['jelly', 71, 84],
  'friend/zelva-obojka': ['turtle', 61, 79],
  'friend/zelva-obojka/baby': ['turtle', 65, 79],
  'friend/barakuda-bystrinka': ['dart', 66, 83],
  'friend/delfin-skokanek': ['leap', 69],
  'friend/hvezdice-rodinka': ['star'],
  'friend/jazyk-jazycek': ['swim', 63, 82],
  'friend/jezik-sycik': ['puff'],
  'friend/kalmar-desetiruky': ['jet', 69, 84],
  'friend/klauni-dvojcata': ['swim', 68, 84],
  'friend/klipka-vzorna': ['swim', 72, 87],
  'friend/konik-mydlinek': ['curl', 61, 80],
  'friend/lachtan-lyzar': ['perch', 71],
  'friend/pyskoun-pysny': ['swim', 74, 88],
  'friend/rak-korinek': ['scuttle', 76, 87],
  'friend/stitovec-prisavka': ['dart', 67, 85],
  'friend/tulen-padik': ['perch', 50],
  'friend/vydra-vyskalka': ['wave'],
  'monster/chobotnice-napodobnice': ['jelly', 54, 78],
  'monster/das-lucernik': ['swim', 75, 88],
  'monster/had-zamotal': ['curl', 48, 75],
  'monster/humr-nuzkar': ['dart', 68, 84],
  'monster/krakatice-inkoustova': ['jet', 61, 80],
  'monster/meduza-lepka': ['jelly', 46, 70],
  'monster/murena-mumla': ['peek', 65],
  'monster/san-ledana': ['swim', 72, 88],
  'monster/uhor-zhavak': ['curl', 43, 72],
  'monster/vir-casoplet': ['curl', 52, 77],
  'monster/zeva-lakoma': ['peek', 52],
  'monster/zralok-zrout': ['swim', 66, 85],
  'character/osmicka': ['wave'],
  'character/osmicka/happy': ['star'],
  'character/mroz-vousac': ['wave'],
  'character/bublinka': ['drift'],
  'inkoustik/inkoustik-kanka': ['jelly', 67, 84],
  'inkoustik/inkoustik-smouha': ['puff'],
  'inkoustik/inkoustik-cmara': ['curl', 42, 74],
  'inkoustik/inkoustik-klikyhak': ['spring'],
};

/** Install the body and all its joints together. In a wash, both paintings must be ready:
 * they start on the same frame and the original opacity transition stays on the ink layer. */
export function articulatePortrait(
  root: HTMLElement,
  artId: string,
  motion: PortraitMotion,
  frames: HTMLElement[] = [root],
): void {
  const profile = CAST[artId] ?? CAST[artId.split('/').slice(0, 2).join('/')];
  if (!profile) return;
  const images = frames.flatMap((frame) => {
    const image = frame.querySelector<HTMLImageElement>(':scope > .ps-art__image');
    return image ? [{ frame, image }] : [];
  });
  if (!images.length || images.length !== frames.length) return;
  const [gesture, pivot, tip] = profile;
  const hinge = HINGES[gesture];
  const attach = (): void => {
    root.classList.add('ps-puppet', `ps-puppet--${gesture}`);
    root.dataset['hinge'] = hinge;
    root.dataset['motion'] = motion;
    if (pivot !== undefined) root.style.setProperty('--ps-root', `${pivot}%`);
    if (tip !== undefined) root.style.setProperty('--ps-tip', `${tip}%`);
    if (hinge === 'whole') return;
    for (const { frame, image } of images) {
      const first = h('span', { className: 'ps-joint ps-joint--first' });
      const layers = h(
        'span',
        { className: 'ps-puppet__parts', attributes: { 'aria-hidden': 'true' } },
        first,
      );
      if (hinge !== 'above') {
        const second = h('span', { className: 'ps-joint ps-joint--second' });
        (hinge === 'sides' ? layers : first).append(second);
      }
      frame.classList.add('ps-puppet__cut');
      layers.style.setProperty(
        '--ps-skin',
        `url(${JSON.stringify(image.currentSrc || image.src)})`,
      );
      image.after(layers);
    }
  };
  const pending = images.filter(({ image }) => !image.complete || image.naturalWidth === 0);
  let left = pending.length;
  if (left === 0) attach();
  for (const { image } of pending) {
    image.addEventListener(
      'load',
      () => {
        if (--left === 0) attach();
      },
      { once: true },
    );
  }
}
