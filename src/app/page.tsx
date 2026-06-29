"use client";

import React, { useState } from "react";
import Link from "next/link";
import CardFase from "@/components/ui/CardFase";
import { ArrowRight, Star, ShieldAlert, ChevronDown, HelpCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

export default function LandingPage() {
  const { t } = useLanguage();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Carregar e analisar as perguntas do FAQ do arquivo de tradução ativo
  let faqQuestions = [];
  try {
    faqQuestions = JSON.parse(t("faq.questions"));
  } catch (e) {
    // Fallback estático caso ocorra algum erro no parser
    faqQuestions = [
      {
        question: "O que torna o Nefertiti diferente de outros trackers de ciclo?",
        answer: "O Nefertiti não é apenas um calendário. É uma plataforma integrada de medicina funcional feminina que conecta seus dados biológicos a sugestões dietéticas baseadas no metabolismo e a uma equipe de saúde boutique, tudo sob uma interface serena e sem anúncios."
      }
    ];
  }

  // Estrutura de dados JSON-LD para SEO de FAQ
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqQuestions.map((item: any) => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="bg-ivory text-spa-dark selection:bg-quartz-200 selection:text-quartz-600 flex flex-col justify-between min-h-screen bg-grain overflow-hidden">
      
      {/* Script de SEO JSON-LD para o FAQ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Decorative Floating Organic Blobs (Slow, drifting movements representing biological cycles) */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-quartz-100/40 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute top-[40%] left-[-20%] w-[500px] h-[500px] bg-olive-100/40 rounded-full blur-[100px] pointer-events-none -z-10 animate-float" style={{ animationDuration: "12s" }} />
      <div className="absolute bottom-[10%] right-[-15%] w-[550px] h-[550px] bg-lavender-100/35 rounded-full blur-[110px] pointer-events-none -z-10 animate-float-slow" style={{ animationDuration: "16s" }} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-ivory/70 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="font-serif text-2xl font-light tracking-[0.1em] text-spa-dark group-hover:text-quartz-500 transition-colors duration-500">
            nefertiti
          </span>
          <div className="w-1.5 h-1.5 bg-quartz-300 rounded-full group-hover:bg-quartz-500 transition-colors duration-500" />
        </Link>

        <nav className="hidden md:flex items-center gap-10 text-xs font-semibold uppercase tracking-[0.2em] text-spa-light">
          <Link href="#proposta" className="hover:text-spa-dark transition-colors duration-300 relative py-1 group/link">
            {t("nav.proposta")}
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-quartz-300 group-hover/link:w-full transition-all duration-300" />
          </Link>
          <Link href="#ritmo" className="hover:text-spa-dark transition-colors duration-300 relative py-1 group/link">
            {t("nav.ritmo")}
          </Link>
          <Link href="#manifesto" className="hover:text-spa-dark transition-colors duration-300 relative py-1 group/link">
            {t("nav.manifesto")}
          </Link>
        </nav>

        <div className="flex items-center gap-6">
          {/* Seletor de Idiomas Boutique */}
          <LanguageSelector />

          <Link
            id="btn-login-nav"
            href="/login"
            className="text-xs font-bold uppercase tracking-[0.15em] text-spa-dark hover:text-quartz-500 transition-colors duration-300"
          >
            {t("nav.entrar")}
          </Link>
          <Link
            id="btn-signup-nav"
            href="/login?signup=true"
            className="text-xs font-bold uppercase tracking-[0.25em] bg-spa-dark text-white hover:bg-quartz-400 hover:text-white px-6 py-3 rounded-full hover:shadow-lg transition-all duration-500 cursor-pointer"
          >
            {t("nav.fazerParte")}
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        
        {/* Editorial Hero Section */}
        <section id="proposta" className="relative px-6 lg:px-20 pt-16 pb-24 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8 items-center">
          
          {/* Left Column (Typography Art) */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-[1px] w-8 bg-sand-300" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-spa-light">
                {t("hero.badge")}
              </span>
            </div>

            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-extralight leading-[1.1] text-spa-dark mb-8">
              {t("hero.title1")} <br />
              <span className="italic text-quartz-400 font-normal">{t("hero.title2")}</span>
              {t("hero.title3")}
            </h1>

            <p className="text-sm sm:text-base text-spa-medium font-light leading-relaxed max-w-lg mb-12">
              {t("hero.description")}
            </p>

            <div className="flex flex-col sm:flex-row gap-5 items-stretch sm:items-center">
              <Link
                id="btn-hero-start"
                href="/login?signup=true"
                className="group flex items-center justify-center gap-3 text-xs font-bold tracking-[0.25em] uppercase bg-quartz-400 text-white px-8 py-4.5 rounded-full hover:bg-quartz-500 hover:shadow-[0_10px_25px_rgba(234,147,155,0.4)] transition-all duration-500 cursor-pointer"
              >
                {t("hero.btnBoutique")}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
              </Link>
              <Link
                id="btn-hero-learn"
                href="#ritmo"
                className="flex items-center justify-center text-xs font-bold tracking-[0.25em] uppercase border border-sand-200 hover:border-quartz-300 text-spa-dark px-8 py-4.5 rounded-full hover:bg-white transition-all duration-500"
              >
                {t("hero.btnExplore")}
              </Link>
            </div>

            {/* Premium details block */}
            <div className="flex items-center gap-8 mt-20 border-t border-sand-100/60 pt-8 max-w-sm">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full border border-ivory bg-quartz-200 flex items-center justify-center text-[10px] font-bold text-quartz-600">N</div>
                <div className="w-8 h-8 rounded-full border border-ivory bg-olive-200 flex items-center justify-center text-[10px] font-bold text-olive-600">F</div>
                <div className="w-8 h-8 rounded-full border border-ivory bg-lavender-200 flex items-center justify-center text-[10px] font-bold text-lavender-600">L</div>
              </div>
              <p className="text-[11px] text-spa-light font-light leading-snug">
                {t("hero.badgeText")}
              </p>
            </div>
          </div>

          {/* Right Column (The interactive mock showcase) */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              {/* Floating micro-indicator */}
              <div className="absolute -top-8 -left-4 bg-white/90 backdrop-blur-md border border-sand-200/50 rounded-2xl px-5 py-3.5 shadow-[0_10px_30px_rgba(42,36,33,0.05)] flex items-center gap-3 z-10 animate-float" style={{ animationDuration: "5s" }}>
                <Star className="w-4 h-4 text-quartz-400 fill-quartz-200" />
                <div>
                  <p className="text-[9px] uppercase font-bold tracking-widest text-spa-light">{t("hero.floatingBadge")}</p>
                  <p className="text-xs font-serif italic text-spa-dark">{t("hero.floatingValue")}</p>
                </div>
              </div>

              {/* Redesigned Premium CardFase */}
              <CardFase />
            </div>
          </div>
        </section>

        {/* Asymmetrical Editorial Columns Section (Replaces the classic AI features grid) */}
        <section id="ritmo" className="py-28 px-6 lg:px-20 border-y border-sand-100/50 bg-sand-50/20 relative">
          <div className="max-w-6xl mx-auto">
            
            {/* Minimalist Section Title */}
            <div className="mb-24 text-left">
              <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-spa-light block mb-4">
                {t("ritmo.badge")}
              </span>
              <h2 className="font-serif text-4xl sm:text-5xl font-light text-spa-dark max-w-2xl leading-tight">
                {t("ritmo.title")}
              </h2>
            </div>

            {/* Asymmetrical Layout (Diagonal Scrolling Flow) */}
            <div className="space-y-32">
              
              {/* Column 1: Left Aligned */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-5 text-left">
                  <span className="font-serif text-5xl font-extralight text-quartz-300 block mb-6 italic">{t("ritmo.item1.num")}</span>
                  <h3 className="font-serif text-2xl font-light text-spa-dark mb-4">
                    {t("ritmo.item1.title")}
                  </h3>
                  <p className="text-xs sm:text-sm text-spa-light leading-relaxed font-light">
                    {t("ritmo.item1.desc")}
                  </p>
                </div>
                <div className="md:col-span-7 flex justify-center md:justify-end">
                  <div className="h-[250px] w-full max-w-md bg-gradient-to-r from-quartz-100/60 to-lavender-100/40 rounded-[2rem] border border-sand-200/50 p-6 flex flex-col justify-center gap-4 relative overflow-hidden group">
                    <div className="absolute top-2 right-2 text-[80px] font-serif font-extralight opacity-10 text-quartz-400 select-none">ritmo</div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-quartz-400 font-serif font-bold text-sm shadow-sm">01</div>
                    <h4 className="font-serif text-lg italic text-spa-dark">{t("ritmo.item1.visualTitle")}</h4>
                    <p className="text-xs text-spa-light font-light leading-relaxed">{t("ritmo.item1.visualDesc")}</p>
                  </div>
                </div>
              </div>

              {/* Column 2: Right Aligned (Asymmetrical layout shifting) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center md:flex-row-reverse">
                <div className="md:col-span-7 flex justify-center md:justify-start order-2 md:order-1">
                  <div className="h-[250px] w-full max-w-md bg-gradient-to-r from-olive-100/50 to-sand-100/40 rounded-[2rem] border border-sand-200/50 p-6 flex flex-col justify-center gap-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2 text-[80px] font-serif font-extralight opacity-10 text-olive-400 select-none">energia</div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-olive-400 font-serif font-bold text-sm shadow-sm">02</div>
                    <h4 className="font-serif text-lg italic text-spa-dark">{t("ritmo.item2.visualTitle")}</h4>
                    <p className="text-xs text-spa-light font-light leading-relaxed">{t("ritmo.item2.visualDesc")}</p>
                  </div>
                </div>
                <div className="md:col-span-5 text-left order-1 md:order-2">
                  <span className="font-serif text-5xl font-extralight text-olive-300 block mb-6 italic">{t("ritmo.item2.num")}</span>
                  <h3 className="font-serif text-2xl font-light text-spa-dark mb-4">
                    {t("ritmo.item2.title")}
                  </h3>
                  <p className="text-xs sm:text-sm text-spa-light leading-relaxed font-light">
                    {t("ritmo.item2.desc")}
                  </p>
                </div>
              </div>

              {/* Column 3: Center Focused */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-5 text-left">
                  <span className="font-serif text-5xl font-extralight text-lavender-300 block mb-6 italic">{t("ritmo.item3.num")}</span>
                  <h3 className="font-serif text-2xl font-light text-spa-dark mb-4">
                    {t("ritmo.item3.title")}
                  </h3>
                  <p className="text-xs sm:text-sm text-spa-light leading-relaxed font-light">
                    {t("ritmo.item3.desc")}
                  </p>
                </div>
                <div className="md:col-span-7 flex justify-center md:justify-end">
                  <div className="h-[250px] w-full max-w-md bg-gradient-to-r from-lavender-100/50 to-quartz-100/30 rounded-[2rem] border border-sand-200/50 p-6 flex flex-col justify-center gap-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2 text-[80px] font-serif font-extralight opacity-10 text-lavender-400 select-none">cuidado</div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lavender-400 font-serif font-bold text-sm shadow-sm">03</div>
                    <h4 className="font-serif text-lg italic text-spa-dark">{t("ritmo.item3.visualTitle")}</h4>
                    <p className="text-xs text-spa-light font-light leading-relaxed">{t("ritmo.item3.visualDesc")}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Brand Manifesto Section */}
        <section id="manifesto" className="px-6 lg:px-20 py-24 max-w-5xl mx-auto text-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-sand-100/30 rounded-full blur-[80px] pointer-events-none -z-10" />
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-spa-light block mb-6">
            {t("manifesto.badge")}
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-extralight text-spa-dark leading-snug italic max-w-4xl mx-auto">
            &ldquo;{t("manifesto.quote")}&rdquo;
          </h2>
          <div className="w-12 h-[1px] bg-sand-300 mx-auto mt-10" />
        </section>

        {/* Security & Clean architecture block */}
        <section className="bg-spa-dark text-ivory px-6 lg:px-20 py-24 rounded-t-[3rem] relative overflow-hidden">
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-quartz-500/10 rounded-full blur-[90px]" />
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-quartz-300 block mb-3">
                {t("seguranca.badge")}
              </span>
              <h2 className="font-serif text-4xl sm:text-5xl font-light leading-tight mb-8">
                {t("seguranca.title")}
              </h2>
              <p className="text-sm text-sand-100/75 leading-relaxed font-light mb-8">
                {t("seguranca.description")}
              </p>
              
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 max-w-md">
                <ShieldAlert className="w-5 h-5 text-quartz-300 flex-shrink-0" />
                <p className="text-xs text-sand-50/80 font-light">
                  {t("seguranca.warning")}
                </p>
              </div>
            </div>

            <div className="lg:col-span-6 flex justify-center lg:justify-end">
              <div className="relative border border-white/15 rounded-[2rem] p-8 max-w-sm w-full bg-white/[0.02] backdrop-blur-md">
                <h4 className="font-serif text-xl italic text-white mb-6">{t("seguranca.archTitle")}</h4>
                <ul className="space-y-5 text-xs text-sand-100/80 font-light">
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-quartz-300" />
                    {t("seguranca.item1")}
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-quartz-300" />
                    {t("seguranca.item2")}
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-quartz-300" />
                    {t("seguranca.item3")}
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </section>

        {/* FAQ Section (With Rich Text & JSON-LD integration) */}
        <section id="faq" className="py-28 px-6 lg:px-20 bg-ivory relative border-b border-sand-100/40">
          <div className="max-w-4xl mx-auto">
            
            <div className="text-center mb-20">
              <div className="flex items-center justify-center gap-2 mb-4">
                <HelpCircle className="w-4 h-4 text-quartz-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-spa-light">
                  {t("faq.title")}
                </span>
              </div>
              <h2 className="font-serif text-4xl sm:text-5xl font-light text-spa-dark">
                {t("faq.subtitle")}
              </h2>
            </div>

            <div className="space-y-4">
              {faqQuestions.map((item: any, index: number) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className="border border-sand-200/50 bg-white/40 hover:bg-white/90 rounded-[1.8rem] transition-all duration-300 overflow-hidden shadow-sm"
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full px-6 py-5.5 flex items-center justify-between text-left cursor-pointer focus:outline-none"
                    >
                      <span className="text-sm sm:text-base font-semibold text-spa-dark tracking-wide">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-spa-light transition-transform duration-300 flex-shrink-0 ml-4 ${
                          isOpen ? "rotate-180 text-quartz-400" : ""
                        }`}
                      />
                    </button>
                    
                    <div
                      className={`transition-all duration-300 ease-in-out ${
                        isOpen ? "max-h-[300px] border-t border-sand-100/50" : "max-h-0"
                      } overflow-hidden`}
                    >
                      <div className="px-6 py-5 text-xs sm:text-sm text-spa-light leading-relaxed font-light">
                        {item.answer}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* Clean minimal Invitation CTA */}
        <section className="bg-sand-50/50 py-24 px-6 text-center relative">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-serif text-4xl font-extralight text-spa-dark mb-6">
              {t("cta.title1")} <br />
              <span className="italic text-quartz-400 font-normal">{t("cta.title2")}</span>
            </h2>
            <p className="text-xs sm:text-sm text-spa-light font-light mb-10 max-w-md mx-auto leading-relaxed">
              {t("cta.description")}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-sm mx-auto">
              <Link
                id="btn-cta-signup"
                href="/login?signup=true"
                className="text-xs font-bold uppercase tracking-[0.25em] bg-spa-dark hover:bg-quartz-400 text-white hover:text-white px-8 py-4.5 rounded-full hover:shadow-lg transition-all duration-500 text-center"
              >
                {t("cta.btnSignup")}
              </Link>
              <Link
                id="btn-cta-login"
                href="/login"
                className="text-xs font-bold uppercase tracking-[0.25em] border border-sand-200 hover:border-quartz-300 bg-white/50 text-spa-dark px-8 py-4.5 rounded-full transition-all duration-500 text-center"
              >
                {t("cta.btnLogin")}
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-sand-100/50 px-6 lg:px-20 py-10 text-center text-xs text-spa-light">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl font-light tracking-widest text-spa-dark">nefertiti</span>
            <span className="text-[10px] text-spa-light font-light">
              | {t("footer.copyright", { year: new Date().getFullYear() })}
            </span>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-wider">
            <Link href="#" className="hover:text-spa-dark transition-colors">{t("footer.terms")}</Link>
            <Link href="#" className="hover:text-spa-dark transition-colors">{t("footer.privacy")}</Link>
            <Link href="#" className="hover:text-spa-dark transition-colors">{t("footer.support")}</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
