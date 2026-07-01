"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit, onSnapshot } from "firebase/firestore";
import { 
  Heart, 
  ShieldAlert, 
  Calendar, 
  Smile, 
  Sparkles, 
  LogOut, 
  Lock,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Info
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

export default function PartnerDashboard() {
  const { t } = useLanguage();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // States do formulário de vinculação
  const [code, setCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Verificar autenticação e escutar dados de perfil em tempo real
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);

        const docRef = doc(db, "users", currentUser.uid);
        const unsubscribeDoc = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const uData = docSnap.data();
            setProfile(uData);

            if (uData.partnerId) {
              // Carregar perfil da parceira vinculada em tempo real
              const partnerRef = doc(db, "users", uData.partnerId);
              const partnerSnap = await getDoc(partnerRef);
              if (partnerSnap.exists()) {
                setPartnerProfile(partnerSnap.data());
              }
            } else {
              setPartnerProfile(null);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Erro ao carregar dados em tempo real:", error);
          setLoading(false);
        });

        return () => unsubscribeDoc();
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code || code.trim().length !== 6) return;

    setLinking(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/partner/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: "link", code: code.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro desconhecido ao tentar vincular.");
      }

      if (data.success) {
        setSuccessMsg(t("cumplices.successLink") || "Pareamento concluído com sucesso!");
        setTimeout(() => {
          setCode("");
          setErrorMsg("");
          setSuccessMsg("");
        }, 3000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro de conexão.");
    } finally {
      setLinking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push("/");
    } catch (error) {
      console.error(error);
    }
  };

  // Funções de Cálculo do Ciclo
  const getCycleStats = () => {
    if (!partnerProfile || !partnerProfile.lastPeriodDate) return null;

    const lastPeriod = new Date(partnerProfile.lastPeriodDate);
    const cycleLength = partnerProfile.cycleLength || 28;
    const periodLength = partnerProfile.periodLength || 5;

    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastPeriod.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Dia atual do ciclo (1-indexed)
    const currentDay = (diffDays % cycleLength) + 1;

    let phase: "menstruation" | "follicular" | "ovulation" | "luteal" = "follicular";
    let phaseName = "";
    let phaseDescription = "";
    let empathyTip = "";
    let daysToNext = 0;

    if (currentDay <= periodLength) {
      phase = "menstruation";
      phaseName = "Menstruação";
      phaseDescription = "Fase de desprendimento do endométrio. O nível de hormônios femininos (estrogênio e progesterona) está no nível mais baixo do mês.";
      empathyTip = "A energia dela pode estar reduzida. É um ótimo momento para preparar um chá morno, evitar atividades físicas exaustivas e focar em repouso e nutrição com alimentos ricos em ferro.";
      daysToNext = periodLength - currentDay + 1;
    } else if (currentDay <= cycleLength - 14 - 2) {
      phase = "follicular";
      phaseName = "Fase Folicular";
      phaseDescription = "O estrogênio está subindo, estimulando o crescimento folicular. A energia física e foco mental começam a ascender de maneira revigorada.";
      empathyTip = "A autoconfiança e a clareza mental dela estão no topo! Excelente momento para planejar saídas criativas, realizar atividades desafiadoras juntos e apoiar projetos novos.";
      daysToNext = (cycleLength - 14 - 2) - currentDay + 1;
    } else if (currentDay <= cycleLength - 14 + 2) {
      phase = "ovulation";
      phaseName = "Período Fértil (Ovulação)";
      phaseDescription = "Fase da liberação do óvulo. Altíssimos níveis de estrogênio e pico de LH. Fase de máxima fertilidade e magnetismo social.";
      empathyTip = "Ela está na fase mais sociável e comunicativa do mês. Dedique tempo de qualidade a dois, planeje jantares românticos e estimule conversas profundas.";
      daysToNext = (cycleLength - 14 + 2) - currentDay + 1;
    } else {
      phase = "luteal";
      phaseName = "Fase Lútea";
      phaseDescription = "Domínio da progesterona. O corpo se prepara para uma possível gravidez. Fase de introspecção profunda, vulnerabilidade e possível sensibilidade (TPM).";
      empathyTip = "Ela pode sentir oscilações de humor, cansaço ou retenção de líquidos. Tenha paciência ativa, apoie nas tarefas domésticas sem que ela precise pedir, e ofereça acolhimento emocional de forma gentil.";
      daysToNext = cycleLength - currentDay + 1;
    }

    return {
      currentDay,
      cycleLength,
      phase,
      phaseName,
      phaseDescription,
      empathyTip,
      daysToNext
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Sintonizando painel do cúmplice...</p>
        </div>
      </div>
    );
  }

  const cycleStats = getCycleStats();

  return (
    <div className="min-h-screen bg-ivory bg-grain text-spa-dark pb-20">
      
      {/* Decorative Blobs */}
      <div className="absolute top-20 right-[-10%] w-[500px] h-[500px] bg-quartz-100/30 rounded-full blur-[110px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute bottom-10 left-[-15%] w-[450px] h-[450px] bg-olive-100/30 rounded-full blur-[100px] pointer-events-none -z-10 animate-float" style={{ animationDuration: "10s" }} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-ivory/85 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-serif text-2xl font-light tracking-[0.1em] text-spa-dark">
            nefertiti
          </span>
          <span className="text-[10px] text-spa-light uppercase font-semibold tracking-[0.2em] border-l border-sand-200 pl-3">
            {t("cumplices.partnerHeader") || "Conexão Cúmplice"}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <LanguageSelector />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-quartz-500 hover:text-quartz-600 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t("profile.logout") || "Sair"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-12 space-y-8">
        
        {/* Warning Badge: Restrict to physical data */}
        <div className="p-4 bg-quartz-50 border border-quartz-200/50 rounded-2xl flex items-start gap-3">
          <Lock className="w-4 h-4 text-quartz-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] md:text-[11px] text-spa-medium font-medium tracking-wide">
            {t("cumplices.partnerWarning") || "Acesso Restrito: Suas permissões limitam-se ao acompanhamento fisiológico essencial para empatia de ciclo. A área social e diários pessoais permanecem privados."}
          </p>
        </div>

        {!partnerProfile ? (
          // ESTADO NÃO VINCULADO: EXIBIR CAMPO DE INSERÇÃO DE CÓDIGO
          <div className="max-w-md mx-auto bg-white/70 border border-sand-200/50 rounded-[2.5rem] p-8 shadow-sm text-center space-y-6">
            <div className="w-12 h-12 bg-quartz-50 rounded-full flex items-center justify-center mx-auto border border-quartz-100">
              <Calendar className="w-5 h-5 text-quartz-400" />
            </div>
            
            <div>
              <h2 className="font-serif text-2xl font-light text-spa-dark">
                {t("cumplices.enterCodeTitle") || "Vincular a uma Parceira"}
              </h2>
              <p className="text-xs text-spa-light font-light mt-1.5 leading-relaxed">
                {t("cumplices.enterCodeDesc") || "Insira o código de 6 dígitos gerado no aplicativo dela para sincronizar o calendário de ciclo."}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-quartz-50 text-quartz-700 text-xs font-semibold rounded-xl border border-quartz-100 animate-shake">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-olive-50 text-olive-700 text-xs font-semibold rounded-xl border border-olive-100">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleLink} className="space-y-4">
              <input
                type="text"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={t("cumplices.codePlaceholder") || "Código (ex: 123456)"}
                className="w-full px-4 py-3 bg-ivory/50 border border-sand-200 hover:border-sand-300 focus:border-quartz-300 focus:bg-white rounded-xl text-center text-sm font-mono tracking-[0.25em] text-spa-dark outline-none transition-all"
              />

              <button
                type="submit"
                disabled={linking || code.length !== 6}
                className="w-full py-4 bg-spa-dark text-white hover:bg-quartz-400 disabled:bg-sand-200 disabled:text-spa-light rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer"
              >
                {linking ? "Sincronizando..." : (t("cumplices.btnSubmitCode") || "Sincronizar Ciclos")}
              </button>
            </form>
          </div>
        ) : (
          // ESTADO VINCULADO: EXIBIR DASHBOARD BIOLÓGICO
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Ciclo Circular e Status Principal */}
            <div className="md:col-span-5 bg-white/70 border border-sand-200/50 rounded-[2.5rem] p-8 shadow-sm text-center flex flex-col items-center justify-center relative overflow-hidden min-h-[380px]">
              
              {/* Dynamic Phase Border representing cyclical flow */}
              <div className={`w-48 h-48 rounded-full border-4 flex flex-col items-center justify-center p-6 relative transition-all duration-500 ${
                cycleStats?.phase === "menstruation" ? "border-quartz-300 bg-quartz-50/10 shadow-[0_0_20px_rgba(234,147,155,0.15)]" :
                cycleStats?.phase === "follicular" ? "border-olive-300 bg-olive-50/10" :
                cycleStats?.phase === "ovulation" ? "border-pink-300 bg-pink-50/10" :
                "border-lavender-300 bg-lavender-50/10"
              }`}>
                <span className="text-[10px] text-spa-light uppercase font-bold tracking-widest mb-1">
                  Dia do Ciclo
                </span>
                <span className="font-serif text-5xl font-light text-spa-dark">
                  {cycleStats?.currentDay}
                </span>
                <span className="text-[10px] text-spa-light tracking-wide mt-1.5">
                  de {cycleStats?.cycleLength} dias
                </span>
              </div>

              <div className="mt-8">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-spa-light block mb-1">
                  {t("cumplices.cyclePhase") || "Fase Atual"}
                </span>
                <h3 className="font-serif text-2xl text-spa-dark font-light">
                  {cycleStats?.phaseName}
                </h3>
                <p className="text-[10px] bg-sand-50/60 border border-sand-100 px-3.5 py-1 rounded-full text-spa-medium font-semibold uppercase tracking-wider inline-block mt-3">
                  {cycleStats?.daysToNext} {t("cumplices.daysToNext") || "dias para próxima fase"}
                </p>
              </div>

            </div>

            {/* Informações de Apoio e Dicas Práticas */}
            <div className="md:col-span-7 space-y-6">
              
              {/* Nome da Parceira */}
              <div className="bg-white/70 border border-sand-200/50 rounded-[2rem] p-6 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-spa-light font-bold">Parceira Conectada</p>
                  <h4 className="font-serif text-xl font-light text-spa-dark mt-0.5">{partnerProfile.displayName || "Companheira Nefertiti"}</h4>
                </div>
                <div className="w-10 h-10 rounded-full bg-quartz-50 border border-quartz-100 flex items-center justify-center text-quartz-400">
                  <Smile className="w-5 h-5 fill-quartz-50" />
                </div>
              </div>

              {/* Explicação da Fase */}
              <div className="bg-white/70 border border-sand-200/50 rounded-[2.5rem] p-8 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-quartz-400" />
                  <h4 className="font-serif text-lg italic text-spa-dark">O que está acontecendo com o corpo dela?</h4>
                </div>
                <p className="text-xs text-spa-medium font-light leading-relaxed">
                  {cycleStats?.phaseDescription}
                </p>
              </div>

              {/* Dica de Cuidado Cúmplice (Empathy) */}
              <div className="bg-gradient-to-br from-quartz-50/50 to-lavender-50/30 border border-quartz-200/50 rounded-[2.5rem] p-8 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Heart className="w-4.5 h-4.5 text-quartz-400 fill-quartz-100" />
                  <h4 className="font-serif text-lg text-spa-dark font-light">
                    {t("cumplices.empathyTip") || "Dica de Cuidado Cúmplice"}
                  </h4>
                </div>
                <p className="text-xs text-spa-dark font-light leading-relaxed">
                  {cycleStats?.empathyTip}
                </p>
              </div>

            </div>

          </div>
        )}

      </main>

    </div>
  );
}
