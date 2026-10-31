/**
 * The grown-ups' gate as a dialog, in the language of the grown-ups' area: hold the lock for two
 * seconds (pointer, touch, or holding Space/Enter), then answer a two-digit multiplication on
 * the number pad. Resolves true only after a correct answer; Escape or "Zpátky do hry" resolves
 * false.
 */
import type { GrownUpTranslate } from '../i18n/messages';
import { candyButton } from '../ui/button';
import { openModal } from '../ui/dialog';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { createKeypad } from '../ui/keypad';
import type { UiKit } from '../ui/kit';
import { createGateQuestion, createHoldTracker, HOLD_MS } from './gate';

let serial = 0;

export function openGrownUpsGate(
  kit: UiKit,
  g: GrownUpTranslate,
  options: { random?: () => number; now?: () => number } = {},
): Promise<boolean> {
  const random = options.random ?? Math.random;
  const now = options.now ?? (() => performance.now());
  const hintId = `ps-gate-hint-${++serial}`;
  const cleanups: (() => void)[] = [];
  let holdButton: HTMLElement | undefined;
  const handle = openModal<boolean>(kit, {
    label: g('grownups.gate.heading'),
    testId: 'grownups-gate',
    lang: g.language,
    dismissValue: false,
    build(body, close) {
      const stage = h('div', { className: 'ps-stack ps-gate' });
      const back = candyButton({
        label: g('grownups.gate.cancel'),
        variant: 'paper',
        onPress: () => close(false),
        onError: kit.onError,
        testId: 'gate-cancel',
      });
      body.append(stage, h('div', { className: 'ps-dialog__actions' }, back));

      const askQuestion = (): void => {
        let question = createGateQuestion(random);
        const prompt = h('p', { className: 'ps-gate__question', testId: 'gate-question' });
        const note = h('p', {
          className: 'ps-error-text',
          testId: 'gate-note',
          attributes: { 'aria-live': 'polite' },
        });
        const show = (): void => {
          prompt.textContent = g('grownups.gate.question', { a: question.a, b: question.b });
          prompt.dataset['a'] = String(question.a);
          prompt.dataset['b'] = String(question.b);
        };
        const keypad = createKeypad(kit, {
          maxDigits: 4,
          testIdPrefix: 'gate-keypad',
          labels: {
            pad: g('grownups.keypad.label'),
            backspace: g('grownups.keypad.backspace'),
            ok: g('grownups.keypad.ok'),
            spoken: (value) => g('grownups.keypad.spoken', { value }),
          },
          onSubmit(answer) {
            if (answer === question.answer) {
              close(true);
              return;
            }
            question = createGateQuestion(random, question);
            keypad.reset();
            note.replaceChildren(icon('question'), h('span', { text: g('grownups.gate.wrong') }));
            show();
          },
        });
        cleanups.push(() => keypad.dispose());
        show();
        stage.replaceChildren(prompt, keypad.element, note);
        prompt.tabIndex = -1;
        prompt.focus();
      };

      const tracker = createHoldTracker(HOLD_MS);
      const hold = h(
        'button',
        {
          className: 'ps-hold',
          testId: 'gate-hold',
          dataset: { state: 'idle' },
          attributes: { type: 'button', 'aria-describedby': hintId },
        },
        icon('lock'),
        h('span', { text: g('grownups.gate.hold') }),
      );
      let frame = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let done = false;
      const paint = (): void => {
        const progress = tracker.progress(now());
        hold.style.setProperty('--progress', String(progress));
        if (progress >= 1) finish();
        else if (tracker.holding()) frame = requestAnimationFrame(paint);
      };
      const begin = (): void => {
        if (done || tracker.holding()) return;
        tracker.start(now());
        hold.dataset['state'] = 'holding';
        kit.cue('ui.tap');
        frame = requestAnimationFrame(paint);
        timer = setTimeout(paint, HOLD_MS + 30);
      };
      const end = (): void => {
        if (done) return;
        tracker.cancel();
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        hold.dataset['state'] = 'idle';
        hold.style.setProperty('--progress', '0');
      };
      const finish = (): void => {
        if (done) return;
        done = true;
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        kit.cue('ui.navigate');
        askQuestion();
      };
      hold.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        hold.setPointerCapture?.(event.pointerId);
        begin();
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
        hold.addEventListener(type, end);
      }
      hold.addEventListener('keydown', (event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) begin();
      });
      hold.addEventListener('keyup', (event) => {
        if (event.key === ' ' || event.key === 'Enter') end();
      });
      hold.addEventListener('blur', end);
      hold.addEventListener('contextmenu', (event) => event.preventDefault());
      cleanups.push(() => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      });

      stage.append(h('p', { text: g('grownups.gate.holdHint'), attributes: { id: hintId } }), hold);
      holdButton = hold;
    },
    initialFocus: () => holdButton ?? null,
  });
  return handle.result.finally(() => {
    for (const cleanup of cleanups) cleanup();
  });
}
