/**
 * Layout checks for large text and small screens (WCAG 1.4.4 Resize Text, 1.4.10 Reflow,
 * 2.5.5 Target Size; the game's own bar is the SDK's 48 px CHILD_SAFE_PRESET target,
 * docs/app.md §7):
 *
 * - the page never scrolls sideways, and no region scrolls sideways inside it;
 * - every visible control lies inside the viewport, is not cut off by a clipping parent, does
 *   not clip its own label, and is at least 48 × 48 CSS px (a radio or switch is measured by
 *   the label that carries it);
 * - no word is broken in the middle across two lines.
 *
 * Dragon Valley's checks (its test/e2e/support/layout.ts), with this game's hidden-text class.
 */
import type { Page } from '@playwright/test';

export interface LayoutOptions {
  readonly minTarget?: number;
}

export async function layoutProblems(page: Page, options: LayoutOptions = {}): Promise<string[]> {
  const minTarget = options.minTarget ?? 48;
  return page.evaluate((min) => {
    const problems: string[] = [];
    const root = document.documentElement;
    const width = root.clientWidth;
    const round = (value: number): number => Math.round(value * 10) / 10;
    if (root.scrollWidth > width + 1) {
      // Name the outermost elements that reach past the right edge (their parents do not).
      const offenders: string[] = [];
      for (const element of document.querySelectorAll('body *')) {
        const right = element.getBoundingClientRect().right;
        const parentRight = element.parentElement?.getBoundingClientRect().right ?? 0;
        if (right > width + 1 && parentRight <= width + 1 && offenders.length < 3) {
          const id = element.closest('[data-testid]')?.getAttribute('data-testid');
          offenders.push(
            `<${element.localName}${element.className && typeof element.className === 'string' ? ` .${element.className.split(' ')[0]}` : ''}${id ? ` in ${id}` : ''}> to ${Math.round(right)}px`,
          );
        }
      }
      problems.push(
        `the page scrolls sideways: ${root.scrollWidth}px of content in ${width}px (${offenders.join(', ') || 'no single element'})`,
      );
    }
    const describe = (element: Element): string => {
      const id =
        element.getAttribute('data-testid') ??
        element.closest('[data-testid]')?.getAttribute('data-testid');
      const text = (element.getAttribute('aria-label') ?? element.textContent ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      return `<${element.localName}${id ? ` ${id}` : ''}> "${text}"`;
    };
    const hidden = (element: Element): boolean =>
      element.getClientRects().length === 0 ||
      getComputedStyle(element).visibility === 'hidden' ||
      element.closest('.ps-visually-hidden, [hidden], [aria-hidden="true"]') !== null;
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element);
      if (
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        element.scrollWidth > element.clientWidth + 1 &&
        !hidden(element)
      ) {
        problems.push(
          `${describe(element)} scrolls sideways (${element.scrollWidth}px in ${element.clientWidth}px)`,
        );
      }
    }
    const controls = document.querySelectorAll(
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [tabindex="0"]',
    );
    for (const control of controls) {
      const toggle = control.matches('input[type="radio"], input[type="checkbox"]');
      const label = toggle ? control.closest('label') : null;
      const target = label ?? control;
      if (hidden(target) || (control.matches('input[type="file"]') && hidden(control))) continue;
      const box = target.getBoundingClientRect();
      const name = describe(control);
      if (box.width < min - 0.5 || box.height < min - 0.5) {
        problems.push(`${name} is ${round(box.width)}×${round(box.height)}px, under ${min}px`);
      }
      if (box.left < -0.5 || box.right > width + 0.5) {
        problems.push(
          `${name} sticks out of the ${width}px viewport (${round(box.left)}..${round(box.right)})`,
        );
      }
      if (
        !label &&
        control.scrollWidth > control.clientWidth + 1 &&
        getComputedStyle(control).overflowX !== 'visible'
      ) {
        problems.push(
          `${name} cuts off its own label (${control.scrollWidth}px in ${control.clientWidth}px)`,
        );
      }
      for (
        let parent = target.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        const clip = getComputedStyle(parent);
        const clipsX = clip.overflowX === 'hidden' || clip.overflowX === 'clip';
        const clipsY = clip.overflowY === 'hidden' || clip.overflowY === 'clip';
        if (!clipsX && !clipsY) continue;
        const frame = parent.getBoundingClientRect();
        if (
          (clipsX && (box.left < frame.left - 0.5 || box.right > frame.right + 0.5)) ||
          (clipsY && (box.top < frame.top - 0.5 || box.bottom > frame.bottom + 0.5))
        ) {
          problems.push(`${name} is cut off by ${describe(parent)}`);
          break;
        }
      }
    }
    // Words must not break in the middle ("Perlo-vé"): children read whole words. A break
    // right after a hyphen or a slash is fine.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || hidden(parent) || parent.closest('svg, script, style')) continue;
      const text = node.textContent ?? '';
      for (const match of text.matchAll(/\S+/g)) {
        const word = match[0];
        const start = match.index ?? 0;
        range.setStart(node, start);
        range.setEnd(node, start + word.length);
        const lines = new Set(
          [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)),
        );
        if (lines.size < 2) continue;
        let previous: number | null = null;
        let shown = '';
        let broken = false;
        for (let index = 0; index < word.length; index++) {
          range.setStart(node, start + index);
          range.setEnd(node, start + index + 1);
          const box = range.getClientRects()[0];
          if (!box) continue;
          const top = Math.round(box.top);
          if (previous !== null && Math.abs(top - previous) > 2) {
            shown += ' / ';
            if (!/[-‐–—/]/.test(word[index - 1] ?? '')) broken = true;
          }
          shown += word[index];
          previous = top;
        }
        if (broken) problems.push(`the word "${word}" breaks as "${shown}" in ${describe(parent)}`);
      }
    }
    return problems;
  }, minTarget);
}
