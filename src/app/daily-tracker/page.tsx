"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { 
  ArrowLeft, 
  Check, 
  Droplet, 
  Moon, 
  Smile, 
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Calendar as CalendarIcon 
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

const SYMPTOMS_LIST = [
  { id: "cramps", label: "Cólicas" },
  { id: "bloating", label: "Inchaço" },
  { id: "headache", label: "Dor de Cabeça" },
  { id: "tender-breasts", label: "Sensibilidade nos Seios" },
  { id: "fatigue", label: "Fadiga" },
  { id: "acne", label: "Acne" },
  { id: "insomnia", label: "Insónia" },
  { id: "backache", label: "Dor Lombar" }
];

const MOODS_LIST = [
  { id: "happy", label: "Feliz", color: "bg-quartz-100 text-quartz-700" },
  { id: "calm", label: "Calma", color: "bg-olive-100 text-olive-700" },
  { id: "anxious", label: "Ansiosa", color: "bg-lavender-100 text-lavender-700" },
  { id: "tired", label: "Cansada", color: "bg-spa-medium/10 text-spa-dark" },
  { id: "sensitive", label: "Sensível", color: "bg-quartz-100/70 text-quartz-600" },
  { id: "energetic", label: "Enérgica", color: "bg-sand-200 text-sand-800" },
  { id: "focused", label: "Focada", color: "bg-olive-200 text-olive-800" }
];

const FLOWS_LIST = [
  { id: "none", label: "Nenhum" },
  { id: "light", label: "Leve" },
  { id: "medium", label: "Médio" },
  { id: "heavy", label: "Forte" }
];

export default function DailyTrackerPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Data Selector
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // States do Formulário
  const [flow, setFlow] = useState<"none" | "light" | "medium" | "heavy">("none");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<"happy" | "calm" | "anxious" | "tired" | "sensitive" | "energetic" | "focused">("calm");
  const [waterIntake, setWaterIntake] = useState<number>(0);
  const [sleepHours, setSleepHours] = useState<number>(8);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        await loadDailyLog(currentUser.uid, selectedDate);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, selectedDate]);

  const loadDailyLog = async (userId: string, date: string) => {
    try {
      const logId = `${userId}_${date}`;
      const logRef = doc(db, "daily_logs", logId);
      const snap = await getDoc(logRef);

      if (snap.exists()) {
        const data = snap.data();
        setFlow(data.flow || "none");
        setSelectedSymptoms(data.symptoms || []);
        setMood(data.mood || "calm");
        setWaterIntake(data.waterIntakeMl || 0);
        setSleepHours(data.sleepHours || 8);
        setNotes(data.notes || "");
      } else {
        // Reset para valores padrão se não existir registo
        setFlow("none");
        setSelectedSymptoms([]);
        setMood("calm");
        setWaterIntake(0);
        setSleepHours(8);
        setNotes("");
      }
    } catch (err) {
      console.error("Erro ao carregar log diário:", err);
    }
  };

  const handleSymptomToggle = (id: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const logId = `${user.uid}_${selectedDate}`;
      const logRef = doc(db, "daily_logs", logId);

      await setDoc(logRef, {
        id: logId,
        userId: user.uid,
        date: selectedDate,
        flow,
        symptoms: selectedSymptoms,
        mood,
        waterIntakeMl: waterIntake,
        waterTargetMl: 2500,
        sleepHours,
        notes,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString() // Simplificado (merge resolve no Firestore se formos rígidos)
      }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar log diário:", err);
      alert("Erro ao salvar dados.");
    } finally {
      setSaving(false);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between relative overflow-hidden text-spa-dark pb-10">
      
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-quartz-100/40 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-olive-100/35 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="px-6 lg:px-20 py-6 flex items-center justify-between border-b border-sand-100/40 bg-white/30 backdrop-blur-md sticky top-0 z-50">
        <Link href="/profile" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">Painel Principal</span>
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSelector />
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto w-full px-6 py-12">
        
        {/* Date Selector Banner */}
        <div className="flex items-center justify-between bg-white/70 backdrop-blur-xl border border-sand-200/50 rounded-3xl p-5 shadow-sm mb-10">
          <button 
            onClick={() => shiftDate(-1)} 
            className="p-2 hover:bg-sand-100/50 rounded-full transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-spa-light" />
          </button>
          
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-quartz-400" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="font-serif text-lg bg-transparent border-none focus:outline-none text-spa-dark font-medium cursor-pointer"
            />
          </div>

          <button 
            onClick={() => shiftDate(1)} 
            className="p-2 hover:bg-sand-100/50 rounded-full transition-colors cursor-pointer"
            disabled={selectedDate === new Date().toISOString().split("T")[0]}
          >
            <ChevronRight className={`w-5 h-5 text-spa-light ${selectedDate === new Date().toISOString().split("T")[0] ? 'opacity-30' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Coluna Esquerda: Fluxo e Sintomas */}
          <div className="space-y-8">
            
            {/* Card Fluxo Menstrual */}
            <div className="bg-white/60 backdrop-blur-md border border-sand-200/40 rounded-[2rem] p-6 shadow-sm">
              <h3 className="font-serif text-xl font-medium mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-quartz-400" />
                Fluxo Menstrual
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {FLOWS_LIST.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFlow(f.id as any)}
                    className={`py-3.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                      flow === f.id 
                        ? "bg-spa-dark text-white shadow-md" 
                        : "bg-ivory border border-sand-200/60 hover:bg-sand-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Card Sintomas */}
            <div className="bg-white/60 backdrop-blur-md border border-sand-200/40 rounded-[2rem] p-6 shadow-sm">
              <h3 className="font-serif text-xl font-medium mb-4">Sintomas Logados</h3>
              <div className="grid grid-cols-2 gap-2">
                {SYMPTOMS_LIST.map((s) => {
                  const active = selectedSymptoms.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSymptomToggle(s.id)}
                      className={`p-3 rounded-2xl text-xs font-medium text-left transition-all duration-300 cursor-pointer border ${
                        active 
                          ? "bg-quartz-100 text-quartz-700 border-quartz-300" 
                          : "bg-ivory border-sand-200/60 hover:bg-sand-50"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Coluna Direita: Humor, Água, Sono */}
          <div className="space-y-8">
            
            {/* Humor */}
            <div className="bg-white/60 backdrop-blur-md border border-sand-200/40 rounded-[2rem] p-6 shadow-sm">
              <h3 className="font-serif text-xl font-medium mb-4 flex items-center gap-2">
                <Smile className="w-5 h-5 text-olive-400" />
                Humor Dominante
              </h3>
              <div className="flex flex-wrap gap-2">
                {MOODS_LIST.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id as any)}
                    className={`px-4 py-2.5 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer border ${
                      mood === m.id 
                        ? `${m.color} border-transparent scale-105 shadow-sm` 
                        : "bg-ivory border-sand-200/60 hover:bg-sand-50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ingestão de Água Interativo */}
            <div className="bg-white/60 backdrop-blur-md border border-sand-200/40 rounded-[2rem] p-6 shadow-sm text-center relative overflow-hidden">
              <h3 className="font-serif text-xl font-medium mb-2 flex items-center justify-center gap-2">
                <Droplet className="w-5 h-5 text-indigo-400" />
                Hidratação Diária
              </h3>
              <p className="text-2xl font-bold text-spa-dark mb-4">
                {waterIntake} <span className="text-xs text-spa-light">/ 2500 ml</span>
              </p>

              {/* Visual Cup Effect */}
              <div className="w-24 h-32 border-4 border-sand-200 rounded-b-3xl mx-auto relative overflow-hidden mb-6 flex items-end">
                <div 
                  className="bg-indigo-200/70 w-full transition-all duration-500 ease-out"
                  style={{ height: `${Math.min((waterIntake / 2500) * 100, 100)}%` }}
                />
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setWaterIntake(prev => Math.max(prev - 250, 0))}
                  className="px-4 py-2 bg-white hover:bg-sand-50 border border-sand-200 text-xs rounded-xl cursor-pointer"
                >
                  - 250ml
                </button>
                <button
                  onClick={() => setWaterIntake(prev => prev + 250)}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  + 250ml
                </button>
              </div>
            </div>

            {/* Sono */}
            <div className="bg-white/60 backdrop-blur-md border border-sand-200/40 rounded-[2rem] p-6 shadow-sm">
              <h3 className="font-serif text-xl font-medium mb-2 flex items-center gap-2">
                <Moon className="w-5 h-5 text-lavender-400" />
                Duração do Sono
              </h3>
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-spa-dark">{sleepHours}h</span>
                <span className="text-xs text-spa-light">Ideal: 7-9 horas</span>
              </div>
              <input
                type="range"
                min="3"
                max="15"
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(Number(e.target.value))}
                className="w-full accent-spa-dark cursor-pointer"
              />
            </div>

          </div>

        </div>

        {/* Campo Notas Finais */}
        <div className="mt-8 bg-white/60 backdrop-blur-md border border-sand-200/40 rounded-[2rem] p-6 shadow-sm">
          <h3 className="font-serif text-xl font-medium mb-3">Notas Pessoais</h3>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Como se sente hoje? Registos adicionais..."
            className="w-full p-4 bg-ivory/50 border border-sand-200 rounded-2xl text-xs outline-none focus:border-quartz-300 focus:bg-white transition-all resize-none"
          />
        </div>

        {/* Botão de Salvar Flutuante/Fixo */}
        <div className="mt-8 flex justify-end items-center gap-4">
          {saveSuccess && (
            <span className="text-xs text-olive-600 font-bold flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Registo salvo com sucesso!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2.5 px-8 py-4 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
          >
            {saving ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Registo
              </>
            )}
          </button>
        </div>

      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[10px] text-spa-light tracking-wide border-t border-sand-100/30">
        <p className="font-light">Nefertiti Sanctuary &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
