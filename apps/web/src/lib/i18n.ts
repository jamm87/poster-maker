import es from "../../messages/es.json";
import en from "../../messages/en.json";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export type Messages = typeof es;
const dictionaries: Record<Locale, Messages> = { es, en };

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: string): Messages {
  return dictionaries[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;

/** t("cart.title", { n: 2 }) con interpolación {n}. */
export function translator(messages: Messages) {
  return (key: MessageKey, vars?: Record<string, string | number>): string => {
    let value: unknown = messages;
    for (const part of key.split(".")) value = (value as Record<string, unknown>)?.[part];
    let out = typeof value === "string" ? value : key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
}

export function getT(locale: string) {
  return translator(getMessages(locale));
}
