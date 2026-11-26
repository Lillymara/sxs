// A translate function for helpers outside React, with English as the default so tests and
// callers that don't care about language keep working.
import { en, type MessageKey } from "./en";

export type Tr = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const english: Tr = (key, vars) => (en[key] as string).replace(/\{(\w+)\}/g, (m, k: string) => (vars && k in vars ? String(vars[k]) : m));
