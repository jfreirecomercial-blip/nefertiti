"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, HelpCircle, ChevronDown, Check, Shield } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

export default function FaqPage() {
  const { t } = useLanguage();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Carregar as perguntas do FAQ do arquivo de tradução ativo
  let faqQuestions = [];
  try {
    faqQuestions = JSON.parse(t("faq.questions"));
  } catch (e) {
    // Fallback estático caso ocorra algum erro no parser do JSON
    faqQuestions = [
      {
        question: "Como o Nefertiti protege meus dados de saúde?",
        answer: "Seus dados de ciclo, temperatura e sintomas são criptografados em repouso com AES-256 e em trânsito com TLS. As regras de segurança do banco de dados (Firestore Security Rules) garantem que apenas você tenha acesso de leitura e escrita aos seus dados usando tokens de autenticação criptografados pelo Firebase Auth."
      },
      {
        question: "O Nefertiti está em conformidade com o GDPR europeu e a LGPD brasileira?",
        answer: "Sim, estamos 100% em conformidade. Oferecemos controle granular de cookies, consentimento explícito para tratamento de dados sensíveis de saúde no cadastro (Artigo 9º do GDPR) e opções simples no painel de perfil para exportar seus dados (Portabilidade) ou deletar sua conta permanentemente (Direito ao Esquecimento)."
      },
      {
        question: "Como funciona a importação de dados por IA via Screenshot?",
        answer: "Basta tirar um print de tela do seu histórico de ciclo em outro aplicativo (como Clue ou Flo) e fazer o upload na sua página de perfil. Nossa inteligência artificial processará a imagem, extrairá com precisão as datas, intensidade de fluxo e sintomas, exibirá uma prévia para sua revisão e permitirá salvar tudo com um clique."
      },
      {
        question: "Posso utilizar meus dados em aplicativos móveis no futuro?",
        answer: "Sim. A arquitetura de banco de dados do Nefertiti foi projetada de forma unificada utilizando o Firebase. Isso significa que, quando lançarmos os aplicativos móveis nativos para Android e iOS, seu login e todo o seu histórico de dados estarão sincronizados automaticamente em tempo real."
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
    <div className="min-h-screen bg-ivory bg-grain text-spa-dark pb-20 relative overflow-hidden flex flex-col justify-between">
      
      {/* Script de SEO JSON-LD para motores de busca e IAs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] bg-quartz-100/30 rounded-full blur-[110px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[450px] h-[450px] bg-olive-100/30 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-ivory/80 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">{t("login.backHome") || "Início"}</span>
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSelector />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-3xl mx-auto px-6 py-16 w-full space-y-12">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <span className="text-[9px] bg-olive-50 text-olive-600 font-bold px-3 py-1 rounded-full border border-olive-200 uppercase tracking-widest inline-block">
            Central de Dúvidas
          </span>
          <h1 className="font-serif text-4xl font-light text-spa-dark tracking-wide leading-tight">
            Perguntas Frequentes & Privacidade
          </h1>
          <p className="text-xs text-spa-light font-light max-w-md mx-auto leading-relaxed">
            Respostas detalhadas sobre segurança biológica, importações por Inteligência Artificial e a aplicação das leis de privacidade.
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-4">
          {faqQuestions.map((item: any, idx: number) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div 
                key={idx} 
                className="bg-white/60 backdrop-blur-md border border-sand-200/50 rounded-3xl overflow-hidden transition-all duration-500"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-6 text-left cursor-pointer transition-colors"
                >
                  <span className="font-serif text-base font-light text-spa-dark pr-4">
                    {item.question}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-spa-light transition-transform duration-500 flex-shrink-0 ${isOpen ? "rotate-180 text-quartz-400" : ""}`} />
                </button>
                
                <div 
                  className={`transition-all duration-500 overflow-hidden ${isOpen ? "max-h-[300px] border-t border-sand-100/50" : "max-h-0"}`}
                >
                  <p className="p-6 text-xs sm:text-sm text-spa-medium font-light leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Security badge at bottom */}
        <div className="p-6 bg-spa-dark text-white rounded-[2rem] flex flex-col sm:flex-row items-center gap-6 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-quartz-500/10 rounded-full blur-xl pointer-events-none" />
          <Shield className="w-10 h-10 text-quartz-300 flex-shrink-0" />
          <div className="space-y-1.5 text-center sm:text-left">
            <h4 className="font-serif text-base italic">Dados médicos são sigilosos</h4>
            <p className="text-[11px] text-sand-100/80 font-light leading-relaxed">
              O Nefertiti não comercializa nem compartilha históricos de ciclos ou sintomas com seguradoras, redes de anúncios ou terceiros. Seus registros pertencem estritamente a você.
            </p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-[10px] text-spa-light tracking-wide border-t border-sand-100/30">
        <p className="font-light">Nefertiti Sanctuary &copy; {new Date().getFullYear()}</p>
      </footer>

    </div>
  );
}
