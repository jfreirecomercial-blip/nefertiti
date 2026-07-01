"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { ShieldCheck, ChevronDown, ChevronUp, Settings } from "lucide-react";

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

export default function CookieConsent() {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem("nefertiti-cookie-consent");
    if (!consent) {
      // Pequeno atraso para dar uma sensação natural de entrada
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const allPrefs = { necessary: true, analytics: true, marketing: true };
    savePreferences(allPrefs);
  };

  const handleRejectAll = () => {
    const essentialOnly = { necessary: true, analytics: false, marketing: false };
    savePreferences(essentialOnly);
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
  };

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem("nefertiti-cookie-consent", JSON.stringify(prefs));
    // Dispara evento personalizado para outros scripts saberem que os cookies foram definidos
    window.dispatchEvent(new CustomEvent("nefertiti-cookie-preferences-updated", { detail: prefs }));
    setIsVisible(false);
  };

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === "necessary") return; // Sempre ativo
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:max-w-md w-auto z-100 animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
      <div className="bg-ivory/95 backdrop-blur-md border border-sand-200/70 rounded-[2rem] p-6 lg:p-7 shadow-[0_15px_50px_rgba(42,36,33,0.12)] text-spa-dark font-sans flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-quartz-100/60 rounded-full text-quartz-500 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif text-lg font-light tracking-wide text-spa-dark italic">
              {t("cookies.title") || "Sua Privacidade no Santuário"}
            </h4>
            <p className="text-xs text-spa-light font-light leading-relaxed mt-1">
              {t("cookies.description") || "Utilizamos cookies para refinar sua experiência."} Ao continuar, você aceita nossa <strong>Política de Privacidade</strong> em conformidade com a <strong>LGPD (Brasil)</strong>, <strong>GDPR (Europa)</strong> e diretivas internacionais de proteção a dados de saúde.
            </p>
          </div>
        </div>

        {/* Customization Details (Accordion style) */}
        {isCustomizing && (
          <div className="border-t border-sand-100/60 pt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            
            {/* Necessary (Read-only active) */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-spa-medium">
                  {t("cookies.necessaryTitle")}
                </span>
                <span className="text-[11px] text-spa-light font-light leading-snug">
                  {t("cookies.necessaryDesc")}
                </span>
              </div>
              <div className="relative inline-flex items-center cursor-not-allowed">
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-sand-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-quartz-300"></div>
              </div>
            </div>

            {/* Analytics */}
            <div className="flex items-start justify-between gap-4 border-t border-sand-50/50 pt-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-spa-medium">
                  {t("cookies.analyticsTitle")}
                </span>
                <span className="text-[11px] text-spa-light font-light leading-snug">
                  {t("cookies.analyticsDesc")}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={() => togglePreference("analytics")}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-sand-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-quartz-400"></div>
              </label>
            </div>

            {/* Marketing */}
            <div className="flex items-start justify-between gap-4 border-t border-sand-50/50 pt-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-spa-medium">
                  {t("cookies.marketingTitle")}
                </span>
                <span className="text-[11px] text-spa-light font-light leading-snug">
                  {t("cookies.marketingDesc")}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={() => togglePreference("marketing")}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-sand-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-quartz-400"></div>
              </label>
            </div>
            
          </div>
        )}

        {/* Actions Button Bar */}
        <div className="flex flex-col gap-2 border-t border-sand-100/60 pt-4">
          <div className="flex gap-3">
            <button
              onClick={handleRejectAll}
              className="flex-1 px-4 py-2.5 rounded-full border border-sand-200 hover:border-quartz-300 text-[10px] font-bold uppercase tracking-[0.15em] text-spa-medium hover:text-spa-dark bg-white/40 hover:bg-white transition-all duration-300 active:scale-95 cursor-pointer text-center"
            >
              {t("cookies.btnRejectAll")}
            </button>
            <button
              onClick={handleAcceptAll}
              className="flex-1 px-4 py-2.5 rounded-full bg-spa-dark hover:bg-quartz-400 text-white text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-300 active:scale-95 cursor-pointer text-center"
            >
              {t("cookies.btnAcceptAll")}
            </button>
          </div>

          <div className="flex justify-between items-center mt-1">
            <button
              onClick={() => setIsCustomizing(!isCustomizing)}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-spa-light hover:text-quartz-400 transition-colors duration-200 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t("cookies.btnCustomize")}</span>
              {isCustomizing ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {isCustomizing && (
              <button
                onClick={handleSavePreferences}
                className="px-5 py-2 rounded-full border border-quartz-300 text-quartz-500 hover:bg-quartz-50 text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-200 cursor-pointer"
              >
                {t("cookies.btnSave")}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
