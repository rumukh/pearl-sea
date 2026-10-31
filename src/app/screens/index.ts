/**
 * The screens the shell can show, bound to the app. The game screens (profiles, the grotto, the
 * sea map, rounds, battles, collections) join them with the domain contract.
 */
import type { App, Screens } from '../shell/app';
import { grownUpsScreen } from './grownups';
import { printScreen } from './print';
import { errorScreen, recoveryScreen } from './recovery';
import { titleScreen } from './title';

export function createScreens(app: App): Screens {
  return {
    title: () => titleScreen(app),
    grownUps: (tab, diverId) => grownUpsScreen(app, tab, diverId),
    print: (request) => printScreen(app, request),
    recovery: (problem) => recoveryScreen(app, problem),
    error: (error) => errorScreen(app, error),
  };
}
