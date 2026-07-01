"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { 
  ArrowLeft, 
  Sparkles, 
  Calendar as CalendarIcon, 
  Activity, 
  Droplet, 
  Moon, 
  Heart,
  ChevronLeft,
  ChevronRight,
  BookOpen
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

export default function DashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [dailyLogs, setDailyLogs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Calendar Navigation States
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Spoonacular Recipe states for current phase
  const [recipes, setRecipes] = useState<any[]>([]);
  const [recipePhase, setRecipePhase] = useState("");
  const [recipeExplanation, setRecipeExplanation] = useState("");
  const [recipesLoading, setRecipesLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        await loadUserData(currentUser);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadUserData = async (currentUser: User) => {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const profile = snap.data();
        setUserProfile(profile);
        
        // Carregar logs diários do utilizador
        const logsRef = collection(db, "daily_logs");
        const q = query(logsRef, where("userId", "==", currentUser.uid));
        const logsSnap = await getDocs(q);
        
        const logsMap: Record<string, any> = {};
        logsSnap.forEach((doc) => {
          const data = doc.data();
          if (data.date) {
            logsMap[data.date] = data;
          }
        });
        setDailyLogs(logsMap);

        // Carregar receitas baseadas na fase metabólica atual
        await fetchRecipes(currentUser);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipes = async (currentUser: User) => {
    setRecipesLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/nutrition/recommendations", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRecipes(data.recommendations);
          setRecipePhase(data.phase);
          setRecipeExplanation(data.explanation);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar receitas do ciclo:", error);
    } finally {
      setRecipesLoading(false);
    }
  };

  // Helper para obter a fase de um determinado dia do calendário
  const getPhaseForDate = (dateStr: string): { name: string; color: string; label: string } => {
    if (!userProfile || !userProfile.lastPeriodDate) {
      return { name: "follicular", color: "bg-olive-50 hover:bg-olive-100/50", label: "Fase Folicular" };
    }

    const lastPeriod = new Date(userProfile.lastPeriodDate);
    const targetDate = new Date(dateStr);
    
    // Diferença em dias
    const diffTime = targetDate.getTime() - lastPeriod.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { name: "unknown", color: "bg-white border border-sand-200/50", label: "Histórico" };
    }

    const cycleLength = userProfile.cycleLength || 28;
    const periodLength = userProfile.periodLength || 5;
    const currentCycleDay = (diffDays % cycleLength) + 1;

    if (currentCycleDay <= periodLength) {
      return { name: "menstrual", color: "bg-quartz-100 text-quartz-700 font-bold border border-quartz-200", label: "Menstruação" };
    } else if (currentCycleDay <= Math.floor(cycleLength / 2) - 2) {
      return { name: "follicular", color: "bg-olive-100 text-olive-700 font-bold border border-olive-200", label: "Fase Folicular" };
    } else if (currentCycleDay <= Math.floor(cycleLength / 2) + 1) {
      return { name: "ovulatory", color: "bg-sand-200 text-sand-800 font-bold border border-sand-300", label: "Ovulação" };
    } else {
      return { name: "luteal", color: "bg-lavender-100 text-lavender-700 font-bold border border-lavender-200", label: "Fase Lútea" };
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  // Renderizador do Calendário Mensal
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);

    const days = [];
    
    // Preencher espaços vazios do início do mês
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="p-4" />);
    }

    // Preencher dias reais
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const logExist = dailyLogs[dateStr];
      const phaseInfo = getPhaseForDate(dateStr);

      days.push(
        <Link
          href={`/daily-tracker?date=${dateStr}`}
          key={`day-${day}`}
          className={`p-3.5 rounded-2xl flex flex-col justify-between items-center min-h-[75px] transition-all duration-300 relative group cursor-pointer ${phaseInfo.color}`}
        >
          <span className="text-xs font-semibold">{day}</span>
          
          {/* Indicadores de Sintomas e Água logados */}
          {logExist && (
            <div className="flex gap-1 mt-1.5">
              {logExist.flow && logExist.flow !== "none" && (
                <div className="w-1.5 h-1.5 rounded-full bg-quartz-500" title="Fluxo menstrual" />
              )}
              {logExist.waterIntakeMl > 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="Água registada" />
              )}
              {logExist.symptoms && logExist.symptoms.length > 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-sand-500" title="Sintomas" />
              )}
            </div>
          )}
        </Link>
      );
    }

    return days;
  };

  const changeMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between relative overflow-hidden text-spa-dark pb-10">
      
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-quartz-100/40 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-olive-100/35 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="px-6 lg:px-20 py-6 flex items-center justify-between border-b border-sand-100/40 bg-white/30 backdrop-blur-md sticky top-0 z-50">
        <Link href="/profile" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">Meu Perfil</span>
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSelector />
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-6 py-12 space-y-10">
        
        {/* Banner de Boas Vindas */}
        <div className="text-left">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-spa-light block mb-2">Painel de Acompanhamento</span>
          <h1 className="font-serif text-4xl font-light text-spa-dark leading-tight">
            Olá, <span className="italic text-quartz-400 font-normal">{userProfile?.displayName || "Membro"}</span>
          </h1>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Coluna do Calendário */}
          <div className="lg:col-span-8 bg-white/60 backdrop-blur-md border border-sand-200/40 rounded-[2.5rem] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-sand-100/40 pb-4">
              <h3 className="font-serif text-2xl font-light flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-quartz-400" />
                Ciclo Menstrual
              </h3>
              <div className="flex items-center gap-3">
                <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-sand-100 rounded-full cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold uppercase tracking-widest text-spa-medium">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-sand-100 rounded-full cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Dias da Semana */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold uppercase tracking-widest text-spa-light">
              <div>Dom</div>
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
            </div>

            {/* Grelha de Dias */}
            <div className="grid grid-cols-7 gap-2">
              {renderCalendar()}
            </div>

            {/* Legenda das Fases */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-sand-100/40 pt-4 text-[10px] uppercase font-semibold tracking-wider text-spa-light">
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-lg bg-quartz-100 border border-quartz-200 block" /> Menstruação</div>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-lg bg-olive-100 border border-olive-200 block" /> Fase Folicular</div>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-lg bg-sand-200 border border-sand-300 block" /> Ovulação</div>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-lg bg-lavender-100 border border-lavender-200 block" /> Fase Lútea</div>
            </div>
          </div>

          {/* Coluna Direita: Insights Nutricionais */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Card de Atalho de Registo Rápido */}
            <Link
              href="/daily-tracker"
              className="block bg-spa-dark hover:bg-quartz-400 text-white rounded-[2rem] p-6 shadow-md transition-all duration-500 text-left group"
            >
              <h3 className="font-serif text-xl italic mb-2">Como se sente hoje?</h3>
              <p className="text-xs text-sand-50/80 font-light leading-relaxed mb-4">
                Registe o seu fluxo, ingestão de água, humor e qualidade de sono de hoje num clique.
              </p>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sand-100 group-hover:translate-x-1.5 transition-transform">
                Registar Agora <ChevronRight className="w-4 h-4" />
              </div>
            </Link>

            {/* Nutrição Sincronizada com o Ciclo */}
            <div className="bg-white/60 backdrop-blur-md border border-sand-200/40 rounded-[2rem] p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-sand-100/40">
                <Sparkles className="w-5 h-5 text-quartz-400" />
                <h3 className="font-serif text-xl font-medium">Nutrição & Ciclo</h3>
              </div>

              {recipesLoading ? (
                <div className="py-8 text-center text-xs text-spa-light">
                  <span className="w-5 h-5 rounded-full border-2 border-quartz-400 border-t-transparent animate-spin inline-block mr-2" />
                  Carregando receitas recomendadas...
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest bg-quartz-100 text-quartz-600 px-2.5 py-1 rounded-full border border-quartz-200">
                      {recipePhase === "menstrual" ? "Fase Menstrual" :
                       recipePhase === "follicular" ? "Fase Folicular" :
                       recipePhase === "ovulatory" ? "Fase Ovulatória" : "Fase Lútea"}
                    </span>
                    <p className="text-xs text-spa-light font-light leading-relaxed pt-1">
                      {recipeExplanation}
                    </p>
                  </div>

                  {recipes.length > 0 ? (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1">Receitas Recomendadas</h4>
                      {recipes.map((r: any) => (
                        <a
                          key={r.id}
                          href={r.spoonacularSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2 hover:bg-sand-50/50 rounded-xl transition-all border border-transparent hover:border-sand-200/50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.image} alt={r.title} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-spa-dark truncate">{r.title}</p>
                            <p className="text-[10px] text-spa-light font-light">Pronto em {r.readyInMinutes}m</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-spa-light font-light italic">Sem receitas disponíveis para esta fase.</p>
                  )}
                </>
              )}
            </div>

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[10px] text-spa-light tracking-wide border-t border-sand-100/30">
        <p className="font-light">Nefertiti Sanctuary &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
