"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  query,
  where
} from "firebase/firestore";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Loader2, 
  FileText, 
  Check, 
  X, 
  Eye, 
  User as UserIcon, 
  ExternalLink,
  Lock,
  Search,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

export default function AdminPage() {
  const { t } = useLanguage();
  const router = useRouter();

  // States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [pendingProfessionals, setPendingProfessionals] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // UID of the professional being actioned
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  // Modal / Selected Professional for Review
  const [selectedProfessional, setSelectedProfessional] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Specialties map for friendly display
  const specialtyLabels: { [key: string]: string } = {
    ginecologista: "Ginecologia Integrativa",
    nutricionista: "Nutrição Funcional Feminina",
    psicologa: "Psicologia da Mulher",
    endocrinologista: "Endocrinologia Feminina",
    obstetra: "Obstetrícia",
    doula: "Doula e Cuidado Perinatal"
  };

  // Check auth and role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login?redirect=/admin");
      } else {
        setCurrentUser(user);
        
        // Verificar role 'admin'
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists() && userSnap.data().role === "admin") {
            setIsAdmin(true);
            fetchPendingProfessionals();
          } else {
            setIsAdmin(false);
          }
        } catch (err) {
          console.error("Erro ao verificar nível de acesso do admin:", err);
          setError("Erro de permissão no banco de dados.");
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchPendingProfessionals = async () => {
    setLoadingList(true);
    setError("");
    try {
      const q = query(
        collection(db, "professionals"), 
        where("approvalStatus", "==", "pending")
      );
      const querySnap = await getDocs(q);
      const list = querySnap.docs.map((doc) => doc.data());
      setPendingProfessionals(list);
    } catch (err: any) {
      console.error("Erro ao buscar profissionais pendentes:", err);
      setError("Erro ao carregar lista de profissionais pendentes: " + err.message);
    } finally {
      setLoadingList(false);
    }
  };

  const handleApprove = async (uid: string) => {
    setActionLoading(uid);
    setError("");
    setInfoMessage("");
    try {
      // 1. Atualizar o status do perfil profissional
      const profRef = doc(db, "professionals", uid);
      await updateDoc(profRef, {
        approvalStatus: "approved",
        updatedAt: new Date().toISOString()
      });

      // 2. Atualizar a role e permissões do usuário
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        role: "professional_approved",
        updatedAt: new Date().toISOString()
      });

      setInfoMessage("Profissional aprovada com sucesso! O perfil agora está visível.");
      setSelectedProfessional(null);
      // Recarregar lista
      fetchPendingProfessionals();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao aprovar profissional: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (uid: string) => {
    if (!rejectionReason.trim()) {
      setError("Por favor, preencha o motivo da rejeição para que a candidata possa corrigir.");
      return;
    }

    setActionLoading(uid);
    setError("");
    setInfoMessage("");
    try {
      // 1. Atualizar o status do perfil profissional
      const profRef = doc(db, "professionals", uid);
      await updateDoc(profRef, {
        approvalStatus: "rejected",
        rejectionReason: rejectionReason.trim(),
        updatedAt: new Date().toISOString()
      });

      // 2. Atualizar a role para professional (rebaixando de approved)
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        role: "professional", // Mantém como profissional básico para poder editar e re-enviar
        updatedAt: new Date().toISOString()
      });

      setInfoMessage("Cadastro rejeitado. A profissional foi notificada dos ajustes pendentes.");
      setSelectedProfessional(null);
      setShowRejectForm(false);
      setRejectionReason("");
      // Recarregar lista
      fetchPendingProfessionals();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao rejeitar cadastro: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-quartz-400 animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Autenticando sessão administrativa...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between items-center p-6 text-center">
        <div className="my-auto max-w-md bg-white border border-sand-200 rounded-[2.5rem] p-8 sm:p-10 shadow-md">
          <Lock className="w-12 h-12 text-quartz-400 mx-auto mb-6" />
          <h2 className="font-serif text-3xl font-light text-spa-dark mb-4">Acesso Restrito</h2>
          <p className="text-xs text-spa-light font-light leading-relaxed mb-8">
            Você não possui credenciais administrativas para gerenciar o Nefertiti Sanctuary. Entre em contato com a equipe de tecnologia técnica se achar que isso é um engano.
          </p>
          <Link href="/profile" className="inline-block py-3 px-8 bg-spa-dark text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-quartz-400 transition-colors">
            Ir para a Área do Usuário
          </Link>
        </div>
        <footer className="text-[10px] text-spa-light">
          Nefertiti Sanctuary &copy; {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between relative overflow-hidden">
      {/* Blobs decorativos */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] bg-quartz-100/30 rounded-full blur-[90px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-olive-100/30 rounded-full blur-[110px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="px-6 lg:px-20 py-5 flex items-center justify-between border-b border-sand-100 bg-white/30 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <span className="font-serif text-2xl font-light tracking-[0.1em] text-spa-dark">nefertiti</span>
          <span className="text-[9px] uppercase font-bold tracking-widest bg-quartz-100 text-quartz-600 px-2 py-0.5 rounded-md">Admin</span>
        </Link>
        
        <div className="flex items-center gap-6">
          <LanguageSelector />
          <Link href="/profile" className="text-xs font-bold uppercase tracking-widest text-spa-dark hover:text-quartz-500 transition-colors">
            Meu Perfil
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-12 z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Painel Esquerdo: Lista de Candidatas */}
        <div className="lg:col-span-7 bg-white/80 backdrop-blur-md border border-sand-200/50 rounded-[2.5rem] p-6 sm:p-8 shadow-sm flex flex-col min-h-[500px]">
          
          <div className="flex items-center justify-between border-b border-sand-100 pb-5 mb-6">
            <div>
              <h2 className="font-serif text-2xl font-light text-spa-dark">Candidatas Profissionais</h2>
              <p className="text-[10px] text-spa-light font-light uppercase tracking-wider mt-1">
                Aprovação Manual - Sistema de Mulher para Mulher
              </p>
            </div>
            <span className="text-[11px] font-bold bg-quartz-100 text-quartz-600 px-3.5 py-1.5 rounded-full">
              {pendingProfessionals.length} pendentes
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-quartz-50 border border-quartz-200/50 text-xs text-quartz-700 font-medium flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-quartz-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-olive-50 border border-olive-200/40 text-xs text-olive-800 font-medium flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 text-olive-500 flex-shrink-0" />
              <span>{infoMessage}</span>
            </div>
          )}

          {loadingList ? (
            <div className="my-auto flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-quartz-400 animate-spin mb-3" />
              <p className="text-xs text-spa-light font-light">Carregando profissionais pendentes...</p>
            </div>
          ) : pendingProfessionals.length === 0 ? (
            <div className="my-auto text-center py-12">
              <ShieldCheck className="w-12 h-12 text-olive-300 mx-auto mb-4" />
              <h3 className="font-serif text-lg font-light text-spa-dark">Tudo sob controle</h3>
              <p className="text-xs text-spa-light font-light mt-1">
                Nenhum cadastro de profissional pendente de verificação no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
              {pendingProfessionals.map((prof) => (
                <div 
                  key={prof.uid} 
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                    selectedProfessional?.uid === prof.uid 
                      ? "border-quartz-300 bg-quartz-50/20" 
                      : "border-sand-200/80 bg-white hover:border-sand-300"
                  }`}
                  onClick={() => {
                    setSelectedProfessional(prof);
                    setShowRejectForm(false);
                    setRejectionReason("");
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-sand-100 border border-sand-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {prof.photoURL ? (
                        <img src={prof.photoURL} alt={prof.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-spa-light" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-spa-dark">{prof.displayName}</h4>
                      <p className="text-[10px] text-quartz-500 font-semibold mt-0.5">
                        {specialtyLabels[prof.specialty] || prof.specialty}
                      </p>
                      <p className="text-[9px] text-spa-light font-light mt-0.5">Reg: {prof.licenseNumber}</p>
                    </div>
                  </div>
                  <button className="p-2 border border-sand-200 hover:border-quartz-300 rounded-xl bg-ivory text-spa-dark hover:text-quartz-500 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Painel Direito: Detalhes e Documentos da Profissional Selecionada */}
        <div className="lg:col-span-5 bg-white/80 backdrop-blur-md border border-sand-200/50 rounded-[2.5rem] p-6 sm:p-8 shadow-sm flex flex-col justify-between min-h-[500px]">
          {selectedProfessional ? (
            <div className="space-y-6 flex flex-col justify-between h-full">
              
              {/* Informações da Candidata */}
              <div className="space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-sand-100">
                  <div className="w-16 h-16 rounded-full bg-sand-100 border border-sand-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {selectedProfessional.photoURL ? (
                      <img src={selectedProfessional.photoURL} alt={selectedProfessional.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-spa-light" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-light text-spa-dark leading-tight">{selectedProfessional.displayName}</h3>
                    <p className="text-xs text-quartz-500 font-semibold mt-0.5">
                      {specialtyLabels[selectedProfessional.specialty] || selectedProfessional.specialty}
                    </p>
                    <p className="text-[10px] text-spa-light font-light mt-0.5">{selectedProfessional.email}</p>
                  </div>
                </div>

                {/* Bio e Valores */}
                <div className="space-y-3">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-spa-light block mb-1">Biografia</span>
                    <p className="text-xs text-spa-medium font-light leading-relaxed bg-sand-50/50 p-3.5 rounded-2xl border border-sand-100/50 max-h-[120px] overflow-y-auto">
                      {selectedProfessional.bio}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest text-spa-light block mb-1">Registro Conselho</span>
                      <span className="text-xs text-spa-dark font-medium">{selectedProfessional.licenseNumber}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest text-spa-light block mb-1">Valores Estimados</span>
                      <span className="text-xs text-spa-dark font-medium">
                        {selectedProfessional.priceRange || "Valores sob consulta"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Links dos Documentos Privados */}
                <div className="space-y-3 pt-3 border-t border-sand-100">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-spa-light block">
                    Documentos Confidenciais
                  </span>

                  <div className="grid grid-cols-1 gap-2">
                    {/* Botão para Identidade */}
                    <a
                      href={selectedProfessional.identityUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 bg-ivory hover:bg-sand-50 border border-sand-200/80 hover:border-quartz-300 rounded-2xl text-xs text-spa-dark font-medium transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-quartz-400" />
                        <span>Documento de Identidade Civil</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-spa-light group-hover:text-quartz-500 transition-colors" />
                    </a>

                    {/* Botão para Certificado */}
                    <a
                      href={selectedProfessional.certificateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 bg-ivory hover:bg-sand-50 border border-sand-200/80 hover:border-quartz-300 rounded-2xl text-xs text-spa-dark font-medium transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-quartz-400" />
                        <span>Diploma / Credencial do Conselho</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-spa-light group-hover:text-quartz-500 transition-colors" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Ações Administrativas */}
              <div className="pt-6 border-t border-sand-100 space-y-4">
                {!showRejectForm ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowRejectForm(true)}
                      disabled={actionLoading !== null}
                      className="flex-grow flex items-center justify-center gap-2 py-3.5 border border-quartz-200 rounded-full text-xs font-bold uppercase tracking-widest text-quartz-600 hover:bg-quartz-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Rejeitar
                    </button>
                    <button
                      onClick={() => handleApprove(selectedProfessional.uid)}
                      disabled={actionLoading !== null}
                      className="flex-grow flex items-center justify-center gap-2 py-3.5 bg-spa-dark text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-quartz-400 transition-all cursor-pointer"
                    >
                      {actionLoading === selectedProfessional.uid ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Aprovar
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 bg-quartz-50/40 p-4 rounded-2xl border border-quartz-100">
                    <label className="block text-[9px] uppercase font-bold tracking-widest text-quartz-700 mb-1">
                      Motivo da Recusa (explicativo para a candidata)
                    </label>
                    <textarea
                      required
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Ex: O documento de identidade está ilegível ou o certificado enviado não pertence à especialidade declarada."
                      rows={3}
                      className="w-full p-3 bg-white border border-sand-200 focus:border-quartz-300 rounded-xl text-xs text-spa-dark font-light leading-relaxed outline-none resize-none"
                    />
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectionReason("");
                        }}
                        className="py-2 px-4 border border-sand-200 rounded-xl text-[10px] font-bold uppercase tracking-wider text-spa-dark hover:bg-white transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleReject(selectedProfessional.uid)}
                        disabled={actionLoading !== null}
                        className="py-2 px-5 bg-quartz-400 hover:bg-quartz-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        {actionLoading === selectedProfessional.uid ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Confirmar Recusa"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="my-auto text-center py-12 flex flex-col items-center justify-center">
              <UserIcon className="w-10 h-10 text-sand-200 mb-3" />
              <p className="text-xs text-spa-light font-light max-w-[200px]">
                Selecione uma candidata da lista ao lado para verificar seus detalhes e documentos.
              </p>
            </div>
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
