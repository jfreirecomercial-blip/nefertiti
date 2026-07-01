"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, ChevronDown, Globe, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface ComplianceRegion {
  id: string;
  name: string;
  law: string;
  description: string;
  rights: string[];
}

export default function Footer() {
  const { t } = useLanguage();
  const [selectedRegion, setSelectedRegion] = useState<string>("pt"); // default 'pt' for LGPD or 'eu' for GDPR
  const [isOpen, setIsOpen] = useState(false);

  const regions: ComplianceRegion[] = [
    {
      id: "br",
      name: "Brasil",
      law: "LGPD (Lei Geral de Proteção de Dados)",
      description: "Garante controle total sobre dados sensíveis de saúde. O tratamento é fundamentado no consentimento expresso e na tutela da saúde.",
      rights: [
        "Confirmação e Acesso aos dados de ciclo",
        "Correção de dados incompletos ou inexatos",
        "Eliminação definitiva dos dados pessoais (Esquecimento)",
        "Portabilidade dos dados de saúde para outra plataforma"
      ]
    },
    {
      id: "eu",
      name: "União Europeia",
      law: "GDPR (General Data Protection Regulation)",
      description: "Regulamento rigoroso que trata dados de saúde menstrual como categoria especial (Art. 9º). Exige consentimento explícito e segurança ativa.",
      rights: [
        "Right to be Forgotten (Excluir conta permanentemente)",
        "Data Portability (Exportação completa em formato JSON)",
        "Right to Access and Rectify (Visualizar e corrigir registros)",
        "Restrict Processing (Desativar telemetria ou compartilhamento)"
      ]
    },
    {
      id: "us",
      name: "Estados Unidos",
      law: "CCPA / HIPAA Compliance Standard",
      description: "Em conformidade com os princípios da HIPAA e CCPA para proteção de registros médicos eletrônicos e não mercantilização de dados de consumo.",
      rights: [
        "Right to Know & Access (Saber quais dados são coletados)",
        "Right to Delete (Exclusão sob demanda dos dados)",
        "Strict Non-Sale (Garantia de não comercialização dos registros)",
        "Protected Health Information (PHI) encryption standards"
      ]
    },
    {
      id: "ca",
      name: "Canadá",
      law: "PIPEDA (Personal Info Protection Act)",
      description: "Foco na limitação da coleta, consentimento significativo e salvaguardas tecnológicas avançadas para dados de saúde digital.",
      rights: [
        "Limiting Collection (Apenas dados necessários para predição)",
        "Individual Access (Acesso completo e imediato aos relatórios)",
        "Challenging Compliance (Canais diretos de suporte legal)",
        "Advanced Safeguards (Criptografia AES-256 em repouso)"
      ]
    },
    {
      id: "jp",
      name: "Japão",
      law: "APPI (Act on the Protection of Personal Information)",
      description: "Regras específicas para Informações que Requerem Consideração Especial (dados médicos). Exige aprovação clara para compartilhamento com parceiros.",
      rights: [
        "Restriction of Third-Party Provision (Proibição de envio a terceiros)",
        "Suspension of Use (Pausa temporária de processamento)",
        "Disclosure and Correction (Acesso simplificado e retificação)",
        "Anonymized Information handling rules for algorithms"
      ]
    },
    {
      id: "global",
      name: "Internacional / Global",
      law: "Standard Privacy & Cybersecurity Framework",
      description: "Aplicável a todas as usuárias em regiões sem legislação local específica. Combina as melhores práticas do GDPR e da privacidade desde a concepção.",
      rights: [
        "Soberania Absoluta sobre dados biológicos",
        "Segurança criptográfica de nível bancário",
        "Exportação livre e portabilidade simplificada",
        "Exclusão instantânea de conta sem burocracia"
      ]
    }
  ];

  const currentCompliance = regions.find((r) => r.id === selectedRegion) || regions[0];

  return (
    <footer className="bg-white border-t border-sand-100/50 px-6 lg:px-20 py-12 text-spa-light font-sans mt-auto">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Top Info & Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-b border-sand-100/50 pb-10">
          
          {/* Logo & Slogan */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-serif text-2xl font-light tracking-widest text-spa-dark">nefertiti</span>
              <div className="w-1.5 h-1.5 bg-quartz-300 rounded-full" />
            </div>
            <p className="text-xs text-spa-medium font-light leading-relaxed max-w-sm">
              Santuário digital de medicina feminina de precisão. Privacidade absoluta e soberania biológica garantidas por criptografia de ponta a ponta.
            </p>
            <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-spa-medium pt-2">
              <Link href="/faq" className="hover:text-spa-dark transition-colors">{t("footer.support") || "FAQ & Suporte"}</Link>
              <span className="text-sand-200">•</span>
              <Link href="#faq" className="hover:text-spa-dark transition-colors">{t("faq.title") || "Perguntas Frequentes"}</Link>
            </div>
          </div>

          {/* Compliance Country Selector */}
          <div className="lg:col-span-7 bg-ivory/40 border border-sand-200/50 rounded-3xl p-6 space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-quartz-100/10 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-quartz-400" />
                <h4 className="font-serif text-sm font-light text-spa-dark italic">Conformidade e Regras por País</h4>
              </div>
              
              {/* Select dropdown styled beautifully */}
              <div className="relative">
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="appearance-none bg-white border border-sand-200 rounded-full pl-4 pr-10 py-1.5 text-xs text-spa-dark font-semibold tracking-wide cursor-pointer focus:outline-none hover:border-quartz-300 transition-all outline-none"
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-spa-light pointer-events-none" />
              </div>
            </div>

            <div className="border-t border-sand-100/50 pt-4 space-y-3.5">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest bg-quartz-50 text-quartz-500 px-2 py-0.5 rounded border border-quartz-100">
                  {currentCompliance.law}
                </span>
                <p className="text-xs text-spa-medium font-light leading-relaxed mt-2">
                  {currentCompliance.description}
                </p>
              </div>

              {/* List of rights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {currentCompliance.rights.map((right, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[10px] text-spa-light font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-olive-500 mt-0.5 flex-shrink-0" />
                    <span>{right}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Bottom copyright */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-medium tracking-wide">
          <p className="font-light">
            nefertiti | &copy; {new Date().getFullYear()} Nefertiti Sanctuary. Todos os direitos reservados.
          </p>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-wider">
            <Link href="/faq" className="hover:text-spa-dark transition-colors">{t("footer.terms") || "Termos"}</Link>
            <Link href="/faq" className="hover:text-spa-dark transition-colors">{t("footer.privacy") || "Privacidade"}</Link>
            <Link href="/faq" className="hover:text-spa-dark transition-colors">Segurança HIPAA/LGPD</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
