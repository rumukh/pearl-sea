/** Shared type aliases for rule modules. */
import type { DeepReadonly, RuntimeRead, TransitionContext } from '@aegis/runtime';
import type { ContentData, ProfileState } from './contract';

/** A staged transition: mutate `ctx.state`, emit events, draw from named streams. */
export type Ctx = TransitionContext<ProfileState, ContentData>;
/** Read-only content data. */
export type Data = DeepReadonly<ContentData>;
/** Read-only state, as seen by `resolve`, `view` and `validate`. */
export type ReadState = DeepReadonly<ProfileState>;
/** A read context. */
export type Read = RuntimeRead<ProfileState, ContentData>;
/** Every skill's item universe (`skillItemIndex`), by skill ID. */
export type Index = ReadonlyMap<string, readonly string[]>;
