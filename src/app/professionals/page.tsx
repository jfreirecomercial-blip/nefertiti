"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { 
  Search, 
  Star, 
  User as UserIcon, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Loader2, 
  Heart,
  Calendar
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

export default function ProfessionalsListingPage() {
  const { t } = useLanguage();
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Professionals list
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [filteredProfessionals, setFilteredProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecialty, setSelectedSpecialty] = useState("todos");

  const specialtyLabels: { [key: string]: string } = {
    ginecologista: "Ginecologia Integrativa",
    nutricionista: "Nutrição Funcional Feminina",
    psicologa: "Psicologia da Mulher",
    endocrinologista: "Endocrinologia Feminina",
    obstetra: "Obstetrícia",
    doula: "Doula e Cuidado Perinatal"
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchProfessionals();
  }, []);

  useEffect(() => {
    if (selectedSpecialty === "todos") {
      setFilteredProfessionals(professionals);
    } else {
      setFilteredProfessionals(
        professionals.filter((p) => p.specialty === selectedSpecialty)
      );
    }
  }, [selectedSpecialty, professionals]);

  const fetchProfessionals = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "professionals"), 
        where("approvalStatus", "==", "approved")
      );
      const querySnap = await getDocs(q);
      const list = querySnap.docs.map((doc) => doc.data());
      setProfessionals(list);
      setFilteredProfessionals(list);
    } catch (err) {
      console.error("Erro ao buscar profissionais aprovadas:", err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-quartz-400 animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Buscando especialistas credenciadas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between relative overflow-hidden">
      {/* Blobs decorativos */}
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-quartz-100/35 rounded-full blur-[90px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] bg-olive-100/30 rounded-full blur-[110px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="px-6 lg:px-20 py-5 flex items-center justify-between border-b border-sand-100 bg-white/30 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <span className="font-serif text-2xl font-light tracking-[0.1em] text-spa-dark">nefertiti</span>
          <div className="w-1.5 h-1.5 bg-quartz-300 rounded-full" />
        </Link>
        
        <div className="flex items-center gap-6">
          <LanguageSelector />
          <Link href="/profile" className="text-xs font-bold uppercase tracking-widest text-spa-dark hover:text-quartz-500 transition-colors">
            Voltar ao Painel
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-6 py-12 z-10 space-y-10">
        
        {/* Intro */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="h-[1px] w-6 bg-sand-300" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-quartz-400">
              Corpo Médico Boutique
            </span>
            <span className="h-[1px] w-6 bg-sand-300" />
          </div>
          <h1 className="font-serif text-4xl font-light text-spa-dark leading-tight">
            Nossas Especialistas Credenciadas
          </h1>
          <p className="text-xs sm:text-sm text-spa-light font-light leading-relaxed">
            Consulte ginecologistas, nutricionistas e psicólogas com foco em medicina funcional integrada feminina. Um ecossistema de acolhimento seguro de mulher para mulher.
          </p>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white/70 backdrop-blur-md border border-sand-200/50 rounded-[2rem] p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Search className="w-4 h-4 text-spa-light flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-spa-light">Especialidade:</span>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <button
              onClick={() => setSelectedSpecialty("todos")}
              className={`py-2 px-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                selectedSpecialty === "todos"
                  ? "bg-spa-dark text-white shadow-sm"
                  : "bg-ivory border border-sand-200 text-spa-dark hover:bg-sand-50"
              }`}
            >
              Todas
            </button>
            {Object.entries(specialtyLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSelectedSpecialty(value)}
                className={`py-2 px-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  selectedSpecialty === value
                    ? "bg-spa-dark text-white shadow-sm"
                    : "bg-ivory border border-sand-200 text-spa-dark hover:bg-sand-50"
                }`}
              >
                {label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Profissionais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProfessionals.length === 0 ? (
            <div className="col-span-full bg-white/70 border border-sand-200 rounded-[2.5rem] p-12 text-center max-w-md mx-auto">
              <UserIcon className="w-10 h-10 text-sand-300 mx-auto mb-4" />
              <h3 className="font-serif text-lg font-light text-spa-dark">Nenhuma especialista encontrada</h3>
              <p className="text-xs text-spa-light font-light mt-1.5">
                Não existem profissionais credenciadas cadastradas nesta especialidade no momento.
              </p>
            </div>
          ) : (
            filteredProfessionals.map((prof) => (
              <div 
                key={prof.uid}
                className="bg-white border border-sand-200/50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between hover:translate-y-[-2px]"
              >
                <div>
                  {/* Foto e Nota */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-16 h-16 rounded-full bg-sand-100 border border-sand-200 overflow-hidden flex items-center justify-center">
                      {prof.photoURL ? (
                        <img src={prof.photoURL} alt={prof.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-6 h-6 text-spa-light" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 bg-quartz-50/50 border border-quartz-100 text-quartz-600 py-1 px-2.5 rounded-full">
                      <Star className="w-3 h-3 fill-quartz-400 text-quartz-400" />
                      <span className="text-[10px] font-bold tracking-wider">{prof.averageRating || "N/A"}</span>
                      {prof.totalReviews > 0 && (
                        <span className="text-[8px] text-spa-light">({prof.totalReviews})</span>
                      )}
                    </div>
                  </div>

                  {/* Nome e Especialidade */}
                  <h3 className="font-serif text-lg text-spa-dark mb-1 font-light">{prof.displayName}</h3>
                  <p className="text-[9px] uppercase font-bold tracking-widest text-quartz-500 mb-3">
                    {specialtyLabels[prof.specialty] || prof.specialty}
                  </p>

                  <p className="text-xs text-spa-medium font-light leading-relaxed line-clamp-3 mb-4">
                    {prof.bio}
                  </p>
                </div>

                {/* Preço e Botão */}
                <div className="pt-4 border-t border-sand-100 flex items-center justify-between gap-2 mt-4">
                  <div className="text-left">
                    <span className="block text-[8px] uppercase tracking-wider text-spa-light font-bold">Consulta</span>
                    <span className="text-xs text-spa-dark font-medium">
                      {prof.priceRange || "Valores sob consulta"}
                    </span>
                  </div>

                  <Link
                    href={`/professionals/${prof.uid}`}
                    className="flex items-center gap-1 py-2 px-4 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all"
                  >
                    Ver Perfil
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

              </div>
            ))
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[10px] text-spa-light tracking-wide border-t border-sand-100/30">
        <p className="font-light">Nefertiti Sanctuary &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
