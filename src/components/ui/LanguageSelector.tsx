"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLanguage, Language } from "@/context/LanguageContext";
import { Globe, ChevronDown } from "lucide-react";

interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: "pt", label: "Português (BR)", flag: "BR" },
  { code: "pt-PT", label: "Português (PT)", flag: "PT" },
  { code: "en", label: "English", flag: "US" },
  { code: "es", label: "Español", flag: "ES" },
  { code: "fr", label: "Français", flag: "FR" },
];

export default function LanguageSelector() {
  const { language, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-sand-200/60 bg-white/40 hover:bg-white/80 hover:border-quartz-300 transition-all duration-300 text-xs font-semibold uppercase tracking-[0.15em] text-spa-dark shadow-sm active:scale-95 cursor-pointer"
      >
        <Globe className="w-3.5 h-3.5 text-spa-light" />
        <span>{currentLang.flag}</span>
        <ChevronDown
          className={`w-3 h-3 text-spa-light transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Options */}
      {isOpen && (
        <ul
          role="listbox"
          aria-label="Selecione o idioma"
          className="absolute right-0 mt-2 w-44 rounded-2xl border border-sand-100 bg-ivory/95 backdrop-blur-md p-2 shadow-[0_10px_35px_rgba(42,36,33,0.08)] z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {languages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <li key={lang.code} role="option" aria-selected={isSelected}>
                <button
                  onClick={() => {
                    changeLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs tracking-wider transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-quartz-100/60 text-quartz-600 font-bold"
                      : "text-spa-medium hover:bg-sand-50/50 hover:text-spa-dark"
                  }`}
                >
                  <span className="font-sans font-medium">{lang.label}</span>
                  <span className="text-[10px] text-spa-light font-bold bg-sand-100/50 px-1.5 py-0.5 rounded">
                    {lang.flag}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
