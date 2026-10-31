/**
 * Motion policy for scripted animation. CSS animations follow the same policy in base.css.
 *
 * Decorative motion stops when the child's "less motion" setting is on (data-reduced-motion on
 * <html>, applied from preferences) or the system asks for reduced motion. Only transform and
 * opacity are animated, so motion never reflows the page.
 */
export function prefersReducedMotion(root: HTMLElement = document.documentElement): boolean {
  if (root.dataset['reducedMotion'] === 'true') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Web Animations, or nothing when motion is reduced or unsupported. */
export function animate(
  element: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | null {
  if (prefersReducedMotion() || typeof element.animate !== 'function') return null;
  return element.animate(keyframes, options);
}

/**
 * Resolve when an animation ends or is cancelled; immediately when there is none. It also
 * resolves shortly after the animation should have ended, because a browser may hold back
 * animations of a page in the background, and the game must never wait on decoration.
 */
export function finished(animation: Animation | null): Promise<void> {
  if (!animation) return Promise.resolve();
  const timing = animation.effect?.getComputedTiming();
  const end = typeof timing?.endTime === 'number' ? timing.endTime : 0;
  return Promise.race([
    animation.finished.then(
      () => undefined,
      () => undefined,
    ),
    wait(end + 250),
  ]);
}

export function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Exponential ease-out (expo): fast start, long gentle settle. */
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
