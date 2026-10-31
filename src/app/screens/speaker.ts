/**
 * The read-aloud button: shown only when the child has read-aloud on and the device has a local
 * Czech voice (the grown-ups' area explains when it has none). It reads whatever the screen
 * shows at the moment it is pressed, and leaves keyboard focus where it was.
 */
import type { ChildPreferences } from '../persistence/preferences';
import { candyButton } from '../ui/button';
import type { App } from '../shell/app';

export function speakerButton(
  app: App,
  preferences: ChildPreferences,
  text: () => string,
  testId = 'read-aloud',
): HTMLButtonElement[] {
  if (!preferences.readAloud || !app.speech.available()) return [];
  return [
    candyButton({
      label: app.kit.t('speech.read'),
      icon: 'speaker',
      iconOnly: true,
      variant: 'paper',
      keepsFocus: true,
      testId,
      onPress: () => {
        app.speak(text(), preferences);
      },
      onError: app.kit.onError,
    }),
  ];
}
