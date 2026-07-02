"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import pt from "../locales/pt.json";
import ptPT from "../locales/pt-PT.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";

export type Language = "pt" | "pt-PT" | "en" | "es" | "fr";

const translations: Record<Language, any> = {
  pt,
  "pt-PT": ptPT,
  en,
  es,
  fr,
};

interface LanguageContextType {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "pt",
  changeLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("pt");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Verificar se existe escolha anterior no localStorage
    const storedLang = localStorage.getItem("nefertiti-lang") as Language | null;
    
    if (storedLang && ["pt", "pt-PT", "en", "es", "fr"].includes(storedLang)) {
      setLanguage(storedLang);
    } else {
      // 2. Detecção automática do navegador
      const browserLang = navigator.language || (navigator as any).userLanguage || "";
      const baseLang = browserLang.split("-")[0].toLowerCase();
      const fullLang = browserLang.toLowerCase();
      
      if (fullLang === "pt-pt" || browserLang === "pt-PT") {
        setLanguage("pt-PT");
        localStorage.setItem("nefertiti-lang", "pt-PT");
      } else if (baseLang === "pt") {
        setLanguage("pt");
        localStorage.setItem("nefertiti-lang", "pt");
      } else if (["en", "es", "fr"].includes(baseLang)) {
        setLanguage(baseLang as Language);
        localStorage.setItem("nefertiti-lang", baseLang);
      } else {
        // Fallback padrão se não for pt, pt-PT, en, es, fr
        setLanguage("en");
        localStorage.setItem("nefertiti-lang", "en");
      }
    }
    setMounted(true);
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("nefertiti-lang", lang);
    // Atualizar atributo lang do elemento html para acessibilidade (SEO/A11y)
    if (lang === "pt") {
      document.documentElement.lang = "pt-BR";
    } else if (lang === "pt-PT") {
      document.documentElement.lang = "pt-PT";
    } else {
      document.documentElement.lang = lang;
    }
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    const currentTranslations = translations[language] || translations["pt"];
    
    // Obter valor aninhado (ex: "hero.title1")
    const value = key.split(".").reduce((acc, part) => {
      return acc && acc[part] !== undefined ? acc[part] : null;
    }, currentTranslations);

    if (value === null || value === undefined) {
      // Fallback para português caso falte a tradução no idioma atual
      const fallbackValue = key.split(".").reduce((acc, part) => {
        return acc && acc[part] !== undefined ? acc[part] : null;
      }, translations["pt"]);
      
      if (fallbackValue === null || fallbackValue === undefined) {
        return ""; // Retorna string vazia para permitir fallbacks com || ou ?? no componente
      }
      return typeof fallbackValue === "string" ? replaceVariables(fallbackValue, variables) : JSON.stringify(fallbackValue);
    }

    if (typeof value === "string") {
      return replaceVariables(value, variables);
    }

    if (Array.isArray(value)) {
      // Para arrays (como no FAQ ou listas), retorna o JSON em string ou manipula no componente
      return JSON.stringify(value);
    }

    return key;
  };

  const replaceVariables = (str: string, variables?: Record<string, string | number>): string => {
    if (!variables) return str;
    let result = str;
    Object.entries(variables).forEach(([key, val]) => {
      result = result.replace(new RegExp(`{${key}}`, "g"), String(val));
    });
    return result;
  };

  // Se não estiver montado no cliente, renderiza com o estado padrão (evita erro de hidratação)
  // Mas para não quebrar o layout SSR, nós apenas renderizamos com o fallback inicial (pt)
  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
