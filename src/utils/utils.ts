import isEqual from "lodash/isEqual";
import once from "lodash/once";
import without from "lodash/without";
import type { Either } from "purify-ts/Either";
import { EitherAsync } from "purify-ts/EitherAsync";
import { Just, type Maybe, Nothing } from "purify-ts/Maybe";
import type { Promisable } from "type-fest";
import type { ILayerConfig } from "types";
import type { ZodSafeParseResult, z } from "zod";
import { zTileJSON } from "@/lib/mapbox-layers/validations";

export function formatTitle(title: string): string {
  return title;
}

export function lerp(v0: number, v1: number, t: number): number {
  return v0 * (1 - t) + v1 * t;
}

const RECEIVERS = new Set(["INPUT", "TEXTAREA"]);

export function shallowArrayEqual<T>(a: T[] | undefined, b: T[] | undefined) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function allowNativeCopy(e: Pick<ClipboardEvent, "target">) {
  const target = e.target;
  const tagName = target instanceof HTMLElement ? target?.tagName || "" : "";
  if (RECEIVERS.has(tagName)) return true;
  if (window.getSelection()?.toString()) return true;
  return false;
}

export function allowNativePaste(e: Pick<ClipboardEvent, "target">) {
  const target = e.target;
  const tagName = target instanceof HTMLElement ? target?.tagName || "" : "";
  if (RECEIVERS.has(tagName)) return true;
  return false;
}

export const getIsMac = once((): boolean => {
  try {
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
  } catch (_e) {
    return false;
  }
});

export const MAC_CMD_SYMBOL = "⌘";

export function localizeKeybinding(keys: string, isMac: boolean): string {
  return keys
    .replace("Command", isMac ? MAC_CMD_SYMBOL : "Ctrl")
    .replace("Option", isMac ? "Option" : "Alt");
}

type ClipboardInput = Promisable<string>;

async function writeToClipboardItem(input: ClipboardInput) {
  return navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": Promise.resolve(input).then((text) => {
        return new Blob([text], { type: "text/plain" });
      }),
    }),
  ]);
}

async function writeToClipboardFallback(input: ClipboardInput) {
  return navigator.clipboard.writeText(await input);
}

export async function writeToClipboard(input: ClipboardInput) {
  if (typeof ClipboardItem === "undefined") {
    return await writeToClipboardFallback(input);
  } else {
    return await writeToClipboardItem(input);
  }
}

export function eitherToAsync<L, R>(either: Either<L, R>): EitherAsync<L, R> {
  return EitherAsync<L, R>(({ liftEither }) => {
    return liftEither(either);
  });
}

export function truncate(str: string, len = 48): string {
  if (str.length < len) return str;
  return `${str.substring(0, len)}…`;
}

export function toggle<T>(list: readonly T[], item: T) {
  return list.includes(item) ? without(list, item) : list.concat(item);
}

export function toggleByValue<T>(list: readonly T[], item: T) {
  let removed = false;
  list = list.filter((it) => {
    if (isEqual(it, item)) {
      removed = true;
      return false;
    } else {
      return true;
    }
  });
  return removed ? list : list.concat(item);
}

const IRREGS: { [key: string]: string } = {
  geometry: "geometries",
} as const;

export function pluralize(
  word: string,
  count: number,
  inclusive = true,
  irregular: string | undefined = undefined,
) {
  if (!irregular && word in IRREGS) irregular = IRREGS[word];
  const pluralized = count === 1 ? word : irregular ? irregular : `${word}s`;
  return (inclusive ? `${count.toLocaleString()} ` : "") + pluralized;
}

export const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);

const millisecond = 1;
const second = millisecond * 1000;
const minute = second * 60;
const hour = minute * 60;
const day = hour * 24;
const week = day * 7;
const month = day * 30;
const year = day * 365;

const Duration = {
  year: year,
  month: month,
  week: week,
  day: day,
  hour: hour,
  minute: minute,
  second: second,
  millisecond: millisecond,
};

function lookup(from: Date, to: Date): [number, Intl.RelativeTimeFormatUnit] {
  const delta = Math.abs(+to - +from);
  const sign = Math.sign(+to - +from);

  const years = Math.round(delta / Duration.year);
  if (years > 1) return [sign * years, "year"];

  const year = Math.abs(to.getFullYear() - from.getFullYear());
  const months = Math.round(delta / Duration.month);
  if (months > 4) return [sign * year, "year"];
  if (months > 1) return [sign * months, "month"];

  const month = Math.abs(to.getMonth() - from.getMonth());
  const weeks = Math.round(delta / Duration.week);
  if (weeks > 3) return [sign * month, "month"];
  if (weeks > 1) return [sign * weeks, "week"];

  const weekDist = (to.getDay() || 7) - (from.getDay() || 7);
  const week = Math.abs(weekDist) > 4 ? 0 : 1;
  const days = Math.round(delta / Duration.day);
  if (days > 4) return [sign * week, "week"];
  if (days > 1) return [sign * days, "day"];

  const day = Math.abs(to.getDate() - from.getDate());
  const hours = Math.round(delta / Duration.hour);
  if (hours > 12) return [sign * day, "day"];
  if (hours > 1) return [sign * hours, "hour"];

  const hour = Math.abs(to.getHours() - from.getHours());
  const minutes = Math.round(delta / Duration.minute);
  if (minutes > 40) return [sign * hour, "hour"];

  const minute = Math.abs(to.getMinutes() - from.getMinutes());
  const seconds = Math.round(delta / Duration.second);
  if (minutes > 1) return [sign * minutes, "minute"];
  if (seconds > 20) return [sign * minute, "minute"];

  return [0, "second"];
}

export function formatDateAgo(from: Date, to: Date) {
  const rtf = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
    localeMatcher: "best fit",
    style: "long",
  });

  const [val, unit] = lookup(from, to);
  return rtf.format(val, unit);
}

export const formatCount = (n: number) =>
  new Intl.NumberFormat("en-US", {}).format(n);

export const formatCapitalize = (str: string) =>
  str.replace(/^\w/, (c) => c.toUpperCase());

export function safeParseMaybe<T>(parsed: ZodSafeParseResult<T>): Maybe<T> {
  if (parsed.success) {
    return Just(parsed.data);
  }
  return Nothing;
}

const TILEJSON_CACHE = new Map<string, z.infer<typeof zTileJSON>>();

export async function getTileJSON(url: string) {
  const cached = TILEJSON_CACHE.get(url);
  if (cached) return cached;

  const resp = await get(url, zTileJSON);

  TILEJSON_CACHE.set(url, resp);

  return resp;
}

export async function get<T extends z.ZodType<unknown>>(
  url: string,
  type: T,
): Promise<z.infer<T>> {
  const resp = await fetch(url);
  const json = await resp.json();
  const parsed = type.parse(json);
  return parsed;
}

export function getMapboxLayerURL(layer: ILayerConfig) {
  if (layer.url.startsWith("mapbox://styles/")) {
    return `${layer.url.replace(
      "mapbox://styles/",
      "https://api.mapbox.com/styles/v1/",
    )}?optimize=true&access_token=${layer.token}`;
  }
  return layer.url;
}
