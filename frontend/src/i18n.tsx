import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { resources, type TranslationTree } from "./i18n-resources";
import type { LanguageCode } from "./types";

const LANGUAGE_STORAGE_KEY = "kube-graph-language";

export type TranslationValues = Record<string, string | number | boolean | null | undefined>;
export type TranslateFn = (key: string, values?: TranslationValues) => string;

type I18nContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  toggleLanguage: () => void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return "en";
  }

  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (savedLanguage === "en" || savedLanguage === "zh-CN") {
    return savedLanguage;
  }

  const browserLanguages = [window.navigator.language, ...(window.navigator.languages ?? [])].filter(Boolean);
  return browserLanguages.some((language) => language.toLowerCase().startsWith("zh")) ? "zh-CN" : "en";
}

function resolveTranslation(tree: TranslationTree, key: string): string | undefined {
  const resolved = key.split(".").reduce<string | TranslationTree | undefined>((current, segment) => {
    if (!current || typeof current === "string") {
      return current;
    }

    return current[segment];
  }, tree);

  return typeof resolved === "string" ? resolved : undefined;
}

function interpolate(template: string, values?: TranslationValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<LanguageCode>(() => getInitialLanguage());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => (current === "zh-CN" ? "en" : "zh-CN"));
  }, []);

  const t = useCallback<TranslateFn>(
    (key, values) => {
      const translated = resolveTranslation(resources[language], key) ?? resolveTranslation(resources.en, key) ?? key;
      return interpolate(translated, values);
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, t, toggleLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }

  return context;
}
