/**
 * The screens the shell can show, bound to the app: the title and the children's profiles, the
 * child's game (story, the first egg, the grotto, rounds, boards, results), the places of the
 * sea, goodbye, and the grown-ups' area.
 */
import type { App, Screens } from '../shell/app';
import { albumScreen, friendsScreen, galleryScreen, shellScreen, shopScreen } from './collections';
import { diversScreen } from './divers';
import { editorScreen } from './editor';
import { goodbyeScreen } from './goodbye';
import { grownUpsScreen } from './grownups';
import { levelScreen } from './level';
import { mapScreen } from './map';
import { playScreen } from './play';
import { printScreen } from './print';
import { errorScreen, recoveryScreen } from './recovery';
import { regionScreen } from './region';
import { titleScreen } from './title';

export function createScreens(app: App): Screens {
  return {
    title: () => titleScreen(app),
    divers: () => diversScreen(app),
    editor: (diverId) => editorScreen(app, diverId),
    play: (diverId) => playScreen(app, diverId),
    map: (diverId) => mapScreen(app, diverId),
    region: (diverId, regionId) => regionScreen(app, diverId, regionId),
    level: (diverId, levelId) => levelScreen(app, diverId, levelId),
    shop: (diverId) => shopScreen(app, diverId),
    friends: (diverId) => friendsScreen(app, diverId),
    gallery: (diverId) => galleryScreen(app, diverId),
    album: (diverId) => albumScreen(app, diverId),
    shell: (diverId) => shellScreen(app, diverId),
    goodbye: (diverId) => goodbyeScreen(app, diverId),
    grownUps: (tab, diverId) => grownUpsScreen(app, tab, diverId),
    print: (request) => printScreen(app, request),
    recovery: (problem) => recoveryScreen(app, problem),
    error: (error) => errorScreen(app, error),
  };
}
