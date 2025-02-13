/** temporal (tc39) convenience functions */

import { Temporal } from "@js-temporal/polyfill";

export const future = (duration: Temporal.DurationLike): Temporal.Instant => Temporal.Now.zonedDateTimeISO('UTC').add(duration).toInstant();

export const now = (): number => Temporal.Now.zonedDateTimeISO('UTC').epochMilliseconds;

export const seconds = (duration: Temporal.DurationLike): number => Temporal.Duration.from(duration).total({ unit: 'seconds' });

export const futureDate = (duration: Temporal.DurationLike): Date => new Date(future(duration).epochMilliseconds);
