/**
 * Things that fly across the screen (a shrimp to a sea friend, a bubble from Bublinka onto a
 * monster): an arc on the effects layer, transform and opacity only, skipped with reduced
 * motion. Also maps a point of an SVG drawing's view box to the page, for anchors on art.
 */
import { animate, EASE_OUT, finished, prefersReducedMotion } from './motion';

export interface PagePoint {
  readonly x: number;
  readonly y: number;
}

export function centerOf(element: Element): PagePoint {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Where a view-box point of an `<svg>` lands on the page, for the default `xMidYMid meet`
 * scaling. Undefined when the drawing has no size or no view box yet.
 */
export function svgPointToPage(svg: SVGSVGElement, x: number, y: number): PagePoint | undefined {
  const box = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  if (!box || box.width <= 0 || box.height <= 0 || rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }
  const scale = Math.min(rect.width / box.width, rect.height / box.height);
  const left = rect.left + (rect.width - box.width * scale) / 2;
  const top = rect.top + (rect.height - box.height * scale) / 2;
  return { x: left + (x - box.x) * scale, y: top + (y - box.y) * scale };
}

/** Fly `node` (sized `size` px) from one page point to another along an arc, then remove it. */
export async function flyAlongArc(
  layer: HTMLElement,
  node: Element,
  from: PagePoint,
  to: PagePoint,
  options: { size?: number; duration?: number; lift?: number } = {},
): Promise<void> {
  if (prefersReducedMotion()) return;
  const size = options.size ?? 48;
  const half = size / 2;
  const lift = options.lift ?? Math.min(180, Math.abs(to.y - from.y) / 2 + 80);
  const holder = document.createElement('span');
  holder.className = 'ps-flyer';
  holder.style.setProperty('--size', `${size}px`);
  holder.append(node);
  layer.append(holder);
  const peakX = (from.x + to.x) / 2;
  const peakY = Math.min(from.y, to.y) - lift;
  await finished(
    animate(
      holder,
      [
        { transform: `translate(${from.x - half}px, ${from.y - half}px) scale(0.7) rotate(0deg)` },
        {
          transform: `translate(${peakX - half}px, ${peakY - half}px) scale(1.15) rotate(160deg)`,
          offset: 0.5,
        },
        { transform: `translate(${to.x - half}px, ${to.y - half}px) scale(0.55) rotate(320deg)` },
      ],
      { duration: options.duration ?? 650, easing: EASE_OUT, fill: 'both' },
    ),
  );
  holder.remove();
}
