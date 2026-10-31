// @vitest-environment happy-dom
/**
 * Art by ID: a painting from S5's catalog, or a visibly labelled dev placeholder of the same
 * kind and shape, so the real files drop in without code changes; friends dressed with SVG
 * cosmetics on their anchors and the shell crown when crowned; and a catalog that cannot be
 * trusted is an empty one (placeholders everywhere), never a failed boot.
 */
import { describe, expect, it } from 'vitest';
import { createArtLibrary, loadArtLibrary } from '../../../src/app/art/library';
import {
  anchorOf,
  artKind,
  DEFAULT_ANCHORS,
  dressedFriend,
  friendArtId,
  picture,
  pictureSize,
} from '../../../src/app/art/picture';
import { ART, ART_CATALOG_PATH, ART_CATALOG_FORMAT } from '../../../src/rules/contract';
import type { ArtEntry } from '../../../src/rules/contract';

const BASE = 'https://example.test/pearl-sea/';
const KRAB: ArtEntry = {
  id: ART.friend('krab-tvrdak', 'baby'),
  kind: 'painted',
  file: 'friends/krab-tvrdak-baby.webp',
  width: 800,
  height: 600,
  anchors: {
    head: { x: 400, y: 100, scale: 80, rotate: -10 },
    eyes: { x: 420, y: 300, scale: 60, rotate: 0 },
    neck: { x: 400, y: 520, scale: 90, rotate: 5 },
  },
};

describe('pictures', () => {
  const art = createArtLibrary(BASE, [KRAB]);

  it('draws a published painting at its size, below the art directory', () => {
    const shown = picture(art, KRAB.id, { alt: 'Krab Tvrďák', className: 'ps-avatar' });
    const image = shown.querySelector('img')!;
    expect(image.getAttribute('src')).toBe(`${BASE}assets/art/friends/krab-tvrdak-baby.webp`);
    expect(image.getAttribute('alt')).toBe('Krab Tvrďák');
    expect([image.getAttribute('width'), image.getAttribute('height')]).toEqual(['800', '600']);
    expect(shown.style.aspectRatio).toBe('800 / 600');
    expect(shown.dataset['artId']).toBe(KRAB.id);
    expect(shown.dataset['placeholder']).toBeUndefined();
    expect(shown.classList.contains('ps-art--friend')).toBe(true);
    expect(shown.classList.contains('ps-avatar')).toBe(true);
    expect(picture(art, KRAB.id).querySelector('img')!.getAttribute('alt')).toBe('');
  });

  it('labels a placeholder with its art ID, in the shape of its kind', () => {
    const egg = picture(art, ART.egg('krab-tvrdak'), { alt: 'Vajíčko' });
    expect(egg.dataset['placeholder']).toBe('true');
    expect(egg.querySelector('.ps-art__dev')?.textContent).toBe('DEV egg/krab-tvrdak');
    expect(egg.querySelector('img')).toBeNull();
    expect(egg.getAttribute('role')).toBe('img');
    expect(egg.getAttribute('aria-label')).toBe('Vajíčko');
    expect(egg.style.aspectRatio).toBe('600 / 800');
    const scene = picture(art, ART.scene('sunny-lagoon'));
    expect(scene.getAttribute('aria-hidden')).toBe('true');
    expect(scene.style.aspectRatio).toBe('1600 / 900');
    // A scene covers a backdrop of any shape, as a painting does.
    expect(scene.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
    expect(
      picture(art, ART.egg('x')).querySelector('svg')?.getAttribute('preserveAspectRatio'),
    ).toBe(null);
  });

  it('knows each kind’s size until the catalog says otherwise', () => {
    expect(artKind('monster/murena-mumla/inked')).toBe('monster');
    expect(pictureSize(art, KRAB.id)).toEqual([800, 600]);
    expect(pictureSize(art, ART.map('shallows'))).toEqual([1600, 1000]);
    expect(pictureSize(art, 'unknown/thing')).toEqual([1000, 1000]);
  });

  it('shows a friend by stage: its egg, its baby or grown painting', () => {
    expect(friendArtId('krab-tvrdak', 'egg')).toBe(ART.egg('krab-tvrdak'));
    expect(friendArtId('krab-tvrdak', 'baby')).toBe(ART.friend('krab-tvrdak', 'baby'));
    expect(friendArtId('krab-tvrdak', 'grown')).toBe(ART.friend('krab-tvrdak', 'grown'));
    expect(friendArtId('krab-tvrdak', 'crowned')).toBe(ART.friend('krab-tvrdak', 'grown'));
  });
});

describe('dressed friends', () => {
  const art = createArtLibrary(BASE, [KRAB]);

  it('puts cosmetics on the painting’s published anchors', () => {
    const shown = dressedFriend(art, {
      friend: 'krab-tvrdak',
      stage: 'baby',
      outfit: { head: 'namornicka-cepice', eyes: null, neck: 'pruhovana-sala' },
    });
    const worn = [...shown.querySelectorAll<HTMLElement>('.ps-art__worn')];
    expect(worn.map((holder) => holder.dataset['anchor'])).toEqual(['neck', 'head']);
    const head = worn.find((holder) => holder.dataset['anchor'] === 'head')!;
    expect(head.style.left).toBe('40%');
    expect(head.style.top).toBe('10%');
    expect(head.style.transform).toBe('translate(-50%, -50%) rotate(-10deg)');
    expect(head.querySelector('[data-art-id]')?.getAttribute('data-art-id')).toBe(
      ART.cosmetic('namornicka-cepice'),
    );
  });

  it('crowns a crowned friend with the shell crown on its head', () => {
    const shown = dressedFriend(art, { friend: 'krab-tvrdak', stage: 'crowned' });
    expect(shown.querySelector('.ps-crown')).not.toBeNull();
    expect(shown.dataset['artId']).toBe(ART.friend('krab-tvrdak', 'grown'));
  });

  it('dresses no egg, and uses default anchors on a placeholder', () => {
    const egg = dressedFriend(art, {
      friend: 'krab-tvrdak',
      stage: 'egg',
      outfit: { head: 'namornicka-cepice' },
    });
    expect(egg.querySelector('.ps-art__worn')).toBeNull();
    expect(anchorOf(art, ART.friend('zelva-obojka', 'baby'), 'eyes')).toEqual(DEFAULT_ANCHORS.eyes);
    expect(anchorOf(art, KRAB.id, 'eyes')).toEqual(KRAB.anchors!.eyes);
  });
});

describe('the art catalog', () => {
  const fetcher =
    (body: string, status = 200) =>
    async (url: string) => {
      expect(url).toBe(new URL(ART_CATALOG_PATH, BASE).href);
      return new Response(body, { status });
    };

  it('loads S5’s entries by ID', async () => {
    const catalog = { format: ART_CATALOG_FORMAT, entries: [KRAB] };
    const art = await loadArtLibrary(BASE, fetcher(JSON.stringify(catalog)));
    expect(art.size).toBe(1);
    expect(art.entry(KRAB.id)?.file).toBe(KRAB.file);
    expect(art.entry(ART.egg('krab-tvrdak'))).toBeUndefined();
  });

  it('is empty when the catalog is missing, broken or of another format', async () => {
    for (const load of [
      fetcher('', 404),
      fetcher('{not json'),
      fetcher(JSON.stringify({ format: 'something-else/1', entries: [KRAB] })),
    ]) {
      expect((await loadArtLibrary(BASE, load)).size).toBe(0);
    }
  });

  it('never reaches outside the art directory', () => {
    const art = createArtLibrary(BASE, [
      { ...KRAB, id: 'friend/a/baby', file: '../secret.webp' },
      { ...KRAB, id: 'friend/b/baby', file: 'friends//b.webp' },
      { ...KRAB, id: 'friend/c/baby', file: 'friends/./c.webp' },
      KRAB,
    ]);
    expect(art.size).toBe(1);
    expect(art.entry('friend/a/baby')).toBeUndefined();
  });
});
