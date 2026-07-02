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
  where,
  addDoc,
  deleteDoc
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
  HelpCircle,
  Flag,
  Users,
  BarChart3,
  Mail,
  UserCheck,
  ShieldAlert
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

  // Tab Navigation
  const [activeTab, setActiveTab] = useState<"pending_professionals" | "users" | "active_professionals" | "reports">("pending_professionals");
  
  // Tab 1: Pending Professionals
  const [pendingProfessionals, setPendingProfessionals] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // UID of the professional being actioned
  const [selectedProfessional, setSelectedProfessional] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Tab 2: Users Management
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [actioningUserId, setActioningUserId] = useState<string | null>(null);

  // Tab 3: Active Professionals & Stats
  const [activeProfessionals, setActiveProfessionals] = useState<any[]>([]);
  const [loadingActiveProfessionals, setLoadingActiveProfessionals] = useState(false);

  // Tab 4: Post Reports
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [actioningReportId, setActioningReportId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

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

  // Load data based on active tab
  useEffect(() => {
    if (!isAdmin) return;
    
    setError("");
    setInfoMessage("");
    if (activeTab === "pending_professionals") {
      fetchPendingProfessionals();
    } else if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "active_professionals") {
      fetchActiveProfessionals();
    } else if (activeTab === "reports") {
      fetchReports();
    }
  }, [activeTab, isAdmin]);

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

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setError("");
    try {
      const querySnap = await getDocs(collection(db, "users"));
      const list = querySnap.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data()
      }));
      setUsersList(list);
    } catch (err: any) {
      console.error("Erro ao buscar usuárias:", err);
      setError("Erro ao carregar lista de usuárias: " + err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleEmailVerified = async (uid: string, currentStatus: boolean) => {
    setActioningUserId(uid);
    setError("");
    setInfoMessage("");
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        emailVerified: !currentStatus,
        updatedAt: new Date().toISOString()
      });
      setInfoMessage("Status de confirmação de e-mail atualizado com sucesso!");
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao alterar e-mail verificado: " + err.message);
    } finally {
      setActioningUserId(null);
    }
  };

  const handleUpdateUserRole = async (uid: string, newRole: string) => {
    setActioningUserId(uid);
    setError("");
    setInfoMessage("");
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: new Date().toISOString()
      });
      setInfoMessage(`Nível da usuária atualizado para "${newRole}" com sucesso!`);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao atualizar nível: " + err.message);
    } finally {
      setActioningUserId(null);
    }
  };

  const fetchActiveProfessionals = async () => {
    setLoadingActiveProfessionals(true);
    setError("");
    try {
      const q = query(
        collection(db, "professionals"),
        where("approvalStatus", "==", "approved")
      );
      const querySnap = await getDocs(q);
      const list = querySnap.docs.map((doc) => doc.data());
      setActiveProfessionals(list);
    } catch (err: any) {
      console.error("Erro ao buscar profissionais ativas:", err);
      setError("Erro ao carregar profissionais aprovadas: " + err.message);
    } finally {
      setLoadingActiveProfessionals(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    setError("");
    try {
      const querySnap = await getDocs(collection(db, "reports"));
      const list = querySnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setReports(list);
    } catch (err: any) {
      console.error("Erro ao buscar denúncias:", err);
      setError("Erro ao carregar denúncias: " + err.message);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleApproveReport = async (report: any) => {
    setActioningReportId(report.id);
    setError("");
    setInfoMessage("");
    try {
      // 1. Remover post permanentemente do social_posts
      const postRef = doc(db, "social_posts", report.postId);
      await deleteDoc(postRef);

      // 2. Atualizar status do report para resolvido (removido)
      const reportRef = doc(db, "reports", report.id);
      await updateDoc(reportRef, {
        status: "resolved_removed",
        resolvedAt: new Date().toISOString()
      });

      // 3. Notificar a autora do post em 'notifications'
      const notificationsRef = collection(db, "notifications");
      await addDoc(notificationsRef, {
        userId: report.postAuthorId,
        type: "report_resolved_removed_author",
        title: "Publicação Removida Definitivamente",
        message: "Após análise das denúncias pela nossa equipe de moderação, concluímos que sua postagem violou as diretrizes da comunidade e ela foi removida definitivamente.",
        postId: report.postId,
        read: false,
        createdAt: new Date().toISOString()
      });

      // 4. Notificar a denunciante em 'notifications'
      await addDoc(notificationsRef, {
        userId: report.reporterId,
        type: "report_resolved_removed_reporter",
        title: "Denúncia Processada",
        message: "Obrigado por nos ajudar a proteger a comunidade. Avaliamos a publicação denunciada e ela foi removida permanentemente por violar nossas diretrizes.",
        postId: report.postId,
        read: false,
        createdAt: new Date().toISOString()
      });

      setInfoMessage("Denúncia aceita. O relato foi excluído permanentemente do Nefertiti e as usuárias foram notificadas.");
      fetchReports();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao processar denúncia: " + err.message);
    } finally {
      setActioningReportId(null);
    }
  };

  const handleRejectReport = async (report: any) => {
    setActioningReportId(report.id);
    setError("");
    setInfoMessage("");
    try {
      // 1. Mudar o status do post de volta para active
      const postRef = doc(db, "social_posts", report.postId);
      await updateDoc(postRef, {
        status: "active",
        updatedAt: new Date().toISOString()
      });

      // 2. Atualizar status do report para resolvido (mantido)
      const reportRef = doc(db, "reports", report.id);
      await updateDoc(reportRef, {
        status: "resolved_kept",
        resolvedAt: new Date().toISOString()
      });

      // 3. Notificar a autora do post que foi restaurado
      const notificationsRef = collection(db, "notifications");
      await addDoc(notificationsRef, {
        userId: report.postAuthorId,
        type: "report_resolved_kept_author",
        title: "Relato Restaurado",
        message: "Nossa moderação concluiu a análise do seu relato denunciado e determinou que ele cumpre as diretrizes da comunidade. Ele já está visível novamente.",
        postId: report.postId,
        read: false,
        createdAt: new Date().toISOString()
      });

      // 4. Notificar a denunciante que foi mantido
      await addDoc(notificationsRef, {
        userId: report.reporterId,
        type: "report_resolved_kept_reporter",
        title: "Denúncia Concluída",
        message: "Analisamos a sua denúncia. Após avaliação, determinamos que o relato não infringe nossas diretrizes de uso, por isso ele foi mantido e restaurado.",
        postId: report.postId,
        read: false,
        createdAt: new Date().toISOString()
      });

      setInfoMessage("Denúncia rejeitada. O relato foi restaurado ao feed geral e as usuárias foram notificadas.");
      fetchReports();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao rejeitar denúncia: " + err.message);
    } finally {
      setActioningReportId(null);
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

  // Filtrar usuários para a aba de gestão
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch = 
      (u.displayName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
      (u.email?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

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
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-12 z-10 flex flex-col gap-6">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-sand-200/60 pb-1">
          <button
            onClick={() => setActiveTab("pending_professionals")}
            className={`flex items-center gap-2 py-3.5 px-6 rounded-t-2xl text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === "pending_professionals"
                ? "border-quartz-500 text-quartz-600 bg-white/40 shadow-sm"
                : "border-transparent text-spa-light hover:text-spa-medium"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Candidatas ({pendingProfessionals.length})
          </button>
          
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 py-3.5 px-6 rounded-t-2xl text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === "users"
                ? "border-quartz-500 text-quartz-600 bg-white/40 shadow-sm"
                : "border-transparent text-spa-light hover:text-spa-medium"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Gestão de Usuárias
          </button>
          
          <button
            onClick={() => setActiveTab("active_professionals")}
            className={`flex items-center gap-2 py-3.5 px-6 rounded-t-2xl text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === "active_professionals"
                ? "border-quartz-500 text-quartz-600 bg-white/40 shadow-sm"
                : "border-transparent text-spa-light hover:text-spa-medium"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Profissionais & Estatísticas
          </button>
          
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 py-3.5 px-6 rounded-t-2xl text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === "reports"
                ? "border-quartz-500 text-quartz-600 bg-white/40 shadow-sm"
                : "border-transparent text-spa-light hover:text-spa-medium"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Denúncias de Posts ({reports.filter(r => r.status === "pending").length})
          </button>
        </div>

        {/* Global Notifications inside tab content */}
        {error && (
          <div className="p-4 rounded-2xl bg-quartz-50 border border-quartz-200/50 text-xs text-quartz-700 font-medium flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-quartz-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="p-4 rounded-2xl bg-olive-50 border border-olive-200/40 text-xs text-olive-800 font-medium flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-olive-500 flex-shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Tab contents */}

        {/* TAB 1: PENDING PROFESSIONALS */}
        {activeTab === "pending_professionals" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
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
                  onClick={async () => {
                    setSelectedProfessional(prof);
                    setShowRejectForm(false);
                    setRejectionReason("");
                    
                    // Carregar documentos confidenciais de professional_verifications (SEC-03)
                    try {
                      const verificationDocRef = doc(db, "professional_verifications", prof.uid);
                      const verificationSnap = await getDoc(verificationDocRef);
                      if (verificationSnap.exists()) {
                        const verifData = verificationSnap.data();
                        setSelectedProfessional((prev: any) => prev && prev.uid === prof.uid ? {
                          ...prev,
                          identityUrl: verifData.identityUrl,
                          certificateUrl: verifData.certificateUrl
                        } : prev);
                      }
                    } catch (err) {
                      console.error("Erro ao carregar documentos confidenciais:", err);
                    }
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
      </div>
    )}

        {/* TAB 2: USERS MANAGEMENT */}
        {activeTab === "users" && (
          <div className="bg-white/80 backdrop-blur-md border border-sand-200/50 rounded-[2.5rem] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center border-b border-sand-100 pb-5">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-spa-light absolute left-4.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por nome ou e-mail..."
                  className="w-full pl-11 pr-4 py-2.5 bg-ivory border border-sand-200 focus:border-quartz-300 rounded-full text-xs text-spa-dark font-light outline-none"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full sm:w-auto p-2.5 bg-ivory border border-sand-200 rounded-full text-xs text-spa-dark font-semibold outline-none focus:ring-1 focus:ring-quartz-300"
                >
                  <option value="all">Todos os Níveis de Acesso</option>
                  <option value="member">Membro / Usuária Comum</option>
                  <option value="professional">Profissional (Pendente/Básico)</option>
                  <option value="professional_approved">Profissional Aprovada</option>
                  <option value="partner">Cúmplice / Parceiro</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            {loadingUsers ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-quartz-400 animate-spin mb-3" />
                <p className="text-xs text-spa-light font-light">Carregando lista de usuárias...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-spa-light font-light text-xs">
                Nenhuma usuária cadastrada atende a estes critérios de filtro.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-sand-100 text-[9px] uppercase font-bold tracking-widest text-spa-light">
                      <th className="pb-3 font-bold">Usuária</th>
                      <th className="pb-3 font-bold">E-mail</th>
                      <th className="pb-3 font-bold">Nível / Role</th>
                      <th className="pb-3 font-bold">Confirmação E-mail</th>
                      <th className="pb-3 text-right font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-50">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-sand-50/20 transition-colors">
                        <td className="py-3.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sand-100 border border-sand-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-4 h-4 text-spa-light" />
                            )}
                          </div>
                          <span className="font-semibold text-spa-dark">{u.displayName || "Usuária sem nome"}</span>
                        </td>
                        <td className="py-3.5 text-spa-medium font-light">{u.email}</td>
                        <td className="py-3.5">
                          <select
                            value={u.role || "member"}
                            disabled={actioningUserId === u.uid}
                            onChange={(e) => handleUpdateUserRole(u.uid, e.target.value)}
                            className="p-1.5 bg-ivory border border-sand-200 rounded-xl text-[10px] text-spa-dark font-semibold outline-none focus:ring-1 focus:ring-quartz-300"
                          >
                            <option value="member">Membro (Comum)</option>
                            <option value="professional">Profissional Básica</option>
                            <option value="professional_approved">Profissional Aprovada</option>
                            <option value="partner">Parceiro (Cúmplice)</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </td>
                        <td className="py-3.5">
                          <button
                            disabled={actioningUserId === u.uid}
                            onClick={() => handleToggleEmailVerified(u.uid, !!u.emailVerified)}
                            className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                              u.emailVerified
                                ? "bg-olive-50 border-olive-200 text-olive-700 hover:bg-olive-100"
                                : "bg-quartz-50 border-quartz-200/80 text-quartz-600 hover:bg-quartz-100"
                            }`}
                          >
                            {u.emailVerified ? "Confirmado" : "Pendente"}
                          </button>
                        </td>
                        <td className="py-3.5 text-right font-medium text-spa-medium">
                          {actioningUserId === u.uid ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-quartz-400 inline-block" />
                          ) : (
                            <span className="text-[10px] text-olive-600 bg-olive-50 px-2 py-0.5 rounded-md">Ativo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ACTIVE PROFESSIONALS */}
        {activeTab === "active_professionals" && (
          <div className="space-y-8">
            
            {/* Totais Numéricos por Especialidade */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
              <div className="bg-white/80 border border-sand-200/50 rounded-3xl p-5 shadow-sm text-center">
                <span className="text-2xl font-serif text-quartz-500 font-light block">{activeProfessionals.length}</span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-spa-light mt-1 block">Total Geral</span>
              </div>
              
              {Object.keys(specialtyLabels).map((specKey) => (
                <div key={specKey} className="bg-white/80 border border-sand-200/50 rounded-3xl p-5 shadow-sm text-center">
                  <span className="text-2xl font-serif text-spa-dark font-light block">
                    {activeProfessionals.filter(p => p.specialty === specKey).length}
                  </span>
                  <span className="text-[9px] uppercase font-bold tracking-wider text-spa-light mt-1 block leading-tight">
                    {specialtyLabels[specKey].split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>

            {/* Listagem de Profissionais */}
            <div className="bg-white/80 backdrop-blur-md border border-sand-200/50 rounded-[2.5rem] p-6 sm:p-8 shadow-sm">
              <div className="border-b border-sand-100 pb-5 mb-6 flex justify-between items-center">
                <div>
                  <h3 className="font-serif text-xl font-light text-spa-dark">Profissionais Ativas</h3>
                  <p className="text-[10px] text-spa-light font-light uppercase tracking-wider mt-1">
                    Exibidas para consultas e agendamentos no aplicativo
                  </p>
                </div>
                <span className="text-[11px] font-bold bg-olive-50 text-olive-800 px-3.5 py-1.5 rounded-full">
                  {activeProfessionals.length} no catálogo
                </span>
              </div>

              {loadingActiveProfessionals ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-quartz-400 animate-spin mb-3" />
                  <p className="text-xs text-spa-light font-light">Carregando profissionais...</p>
                </div>
              ) : activeProfessionals.length === 0 ? (
                <div className="text-center py-12 text-spa-light font-light">
                  Nenhuma profissional aprovada ativa no momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeProfessionals.map((prof) => (
                    <div key={prof.uid} className="p-5 rounded-[2rem] border border-sand-200 bg-white shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 rounded-full bg-sand-100 border border-sand-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {prof.photoURL ? (
                          <img src={prof.photoURL} alt={prof.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-5 h-5 text-spa-light" />
                        )}
                      </div>
                      <div className="space-y-2 flex-grow">
                        <div>
                          <h4 className="text-xs font-bold text-spa-dark">{prof.displayName}</h4>
                          <p className="text-[10px] text-quartz-500 font-semibold mt-0.5">
                            {specialtyLabels[prof.specialty] || prof.specialty}
                          </p>
                          <p className="text-[9px] text-spa-light font-light mt-0.5">Licença: {prof.licenseNumber}</p>
                        </div>
                        <p className="text-[11px] text-spa-medium font-light leading-relaxed line-clamp-2">
                          {prof.bio}
                        </p>
                        <div className="flex items-center justify-between text-[9px] uppercase font-bold tracking-wider pt-2 border-t border-sand-100 text-spa-light">
                          <span className="text-olive-700 bg-olive-50 px-2 py-0.5 rounded">Visível</span>
                          <span>{prof.priceRange || "Preço sob consulta"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 4: REPORTS MODERATION */}
        {activeTab === "reports" && (
          <div className="bg-white/80 backdrop-blur-md border border-sand-200/50 rounded-[2.5rem] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-sand-100 pb-5">
              <h3 className="font-serif text-xl font-light text-spa-dark">Denúncias de Publicações</h3>
              <p className="text-[10px] text-spa-light font-light uppercase tracking-wider mt-1">
                Moderação Reativa (Notice and Take Down) - Controles da Comunidade
              </p>
            </div>

            {loadingReports ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-quartz-400 animate-spin mb-3" />
                <p className="text-xs text-spa-light font-light">Carregando denúncias...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <ShieldCheck className="w-12 h-12 text-olive-300 mx-auto mb-4" />
                <h3 className="font-serif text-lg font-light text-spa-dark">Ambiente Seguro</h3>
                <p className="text-xs text-spa-light font-light mt-1">
                  Nenhuma denúncia de conteúdo pendente de moderação no momento.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {reports.map((rep) => {
                  const friendlyReason: { [key: string]: string } = {
                    inappropriate: "Conteúdo Inadequado / Ofensivo",
                    harassment: "Assédio / Bullying",
                    spam: "Spam / Propaganda não autorizada",
                    misinformation: "Desinformação sobre saúde",
                    other: "Outro motivo"
                  };

                  return (
                    <div key={rep.id} className="p-5 rounded-[2rem] border border-sand-200 bg-white shadow-sm space-y-4">
                      
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                            rep.status === "pending"
                              ? "bg-quartz-50 border-quartz-200 text-quartz-700"
                              : rep.status === "resolved_removed"
                              ? "bg-red-50 border-red-200 text-red-700"
                              : "bg-olive-50 border-olive-200 text-olive-700"
                          }`}>
                            {rep.status === "pending" ? "Aguardando Avaliação" : rep.status === "resolved_removed" ? "Post Excluído" : "Mantido"}
                          </span>
                          <span className="text-[10px] text-spa-light">
                            Denunciado por <strong className="font-semibold text-spa-medium">{rep.reporterName}</strong>
                          </span>
                        </div>
                        <span className="text-[9px] text-spa-light font-light">{new Date(rep.createdAt).toLocaleString()}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Detalhes da Denúncia */}
                        <div className="space-y-3">
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-spa-light block">Motivo Reclamado</span>
                            <span className="text-xs font-bold text-spa-dark mt-0.5 block">{friendlyReason[rep.reason] || rep.reason}</span>
                          </div>

                          {rep.details && (
                            <div>
                              <span className="text-[9px] uppercase font-bold tracking-widest text-spa-light block mb-1">Notas da Denunciante</span>
                              <p className="text-xs text-spa-medium font-light bg-ivory p-3.5 rounded-2xl border border-sand-100/50 leading-relaxed">
                                {rep.details}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Detalhes da Publicação Original */}
                        <div className="space-y-3 border-t md:border-t-0 md:border-l border-sand-100 md:pl-6 pt-4 md:pt-0">
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-spa-light block">Autora do Relato</span>
                            <span className="text-xs font-bold text-spa-dark mt-0.5 block">{rep.postAuthorName}</span>
                          </div>

                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-spa-light block">Relato Denunciado</span>
                            <p className="text-xs text-spa-medium italic font-light bg-sand-50/50 p-3.5 rounded-2xl border border-sand-100/50 leading-relaxed mt-1">
                              {rep.postContent || "(Apenas Fotos ou sem texto)"}
                            </p>
                          </div>
                        </div>

                      </div>

                      {rep.status === "pending" && (
                        <div className="flex justify-end gap-3 pt-3 border-t border-sand-100">
                          <button
                            disabled={actioningReportId === rep.id}
                            onClick={() => handleRejectReport(rep)}
                            className="py-2 px-5 border border-sand-200 hover:bg-sand-50 text-spa-dark rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Rejeitar Denúncia (Manter Post)
                          </button>
                          
                          <button
                            disabled={actioningReportId === rep.id}
                            onClick={() => handleApproveReport(rep)}
                            className="py-2 px-5 bg-quartz-400 hover:bg-quartz-500 text-white rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            {actioningReportId === rep.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                Aprovar Denúncia (Excluir Post)
                              </>
                            )}
                          </button>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[10px] text-spa-light tracking-wide border-t border-sand-100/30">
        <p className="font-light">Nefertiti Sanctuary &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
