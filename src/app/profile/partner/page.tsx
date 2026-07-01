"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { 
  Heart, 
  ArrowLeft, 
  Copy, 
  Check, 
  ShieldAlert, 
  RefreshCw, 
  UserMinus, 
  Sparkles,
  Share2
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

export default function PartnerManagementPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Subscrição em tempo real para o documento do usuário
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);

        const docRef = doc(db, "users", currentUser.uid);
        const unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          }
          setLoading(false);
        }, (error) => {
          console.error("Erro ao escutar dados do usuário:", error);
          setLoading(false);
        });

        return () => unsubscribeDoc();
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  const generateInviteCode = async () => {
    if (!user) return;
    setGenerating(true);
    setStatusMessage("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/partner/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: "generate" })
      });

      if (!res.ok) {
        throw new Error(t("login.errorGeneric") || "Falha ao gerar código.");
      }

      const data = await res.json();
      if (data.success) {
        setStatusMessage(t("cumplices.codeValid") + " " + data.code);
      }
    } catch (error: any) {
      setStatusMessage(error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!user) return;
    const confirmRevoke = window.confirm(
      t("cumplices.revoking") || "Tem certeza de que deseja desconectar seu parceiro? Ele perderá todo o acesso fisiológico ao seu ciclo imediatamente."
    );

    if (!confirmRevoke) return;

    setRevoking(true);
    setStatusMessage("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/partner/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: "revoke" })
      });

      if (!res.ok) {
        throw new Error(t("cumplices.invalidCode") || "Falha ao revogar.");
      }

      const data = await res.json();
      if (data.success) {
        setStatusMessage(t("cumplices.revokeSuccess") || "Parceiro desconectado.");
      }
    } catch (error: any) {
      setStatusMessage(error.message);
    } finally {
      setRevoking(false);
    }
  };

  const copyToClipboard = () => {
    if (!profile?.partnerCode) return;
    navigator.clipboard.writeText(profile.partnerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Carregando conexões...</p>
        </div>
      </div>
    );
  }

  const isConnected = !!profile?.partnerId;

  return (
    <div className="min-h-screen bg-ivory bg-grain text-spa-dark pb-20">
      
      {/* Decorative Blobs */}
      <div className="absolute top-20 right-[-10%] w-[500px] h-[500px] bg-quartz-100/30 rounded-full blur-[110px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-[-15%] w-[450px] h-[450px] bg-olive-100/30 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-ivory/85 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="flex items-center gap-2 group">
            <ArrowLeft className="w-4 h-4 text-spa-medium group-hover:text-quartz-500 transition-colors" />
            <span className="font-serif text-2xl font-light tracking-[0.1em] text-spa-dark">
              nefertiti
            </span>
          </Link>
          <span className="text-[10px] text-spa-light uppercase font-semibold tracking-[0.2em] border-l border-sand-200 pl-3">
            Cúmplices
          </span>
        </div>
        <LanguageSelector />
      </header>

      <main className="max-w-xl mx-auto px-6 mt-16">
        
        {/* Title */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-quartz-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-quartz-100">
            <Heart className="w-6 h-6 text-quartz-400 fill-quartz-200" />
          </div>
          <h1 className="font-serif text-3xl font-light text-spa-dark mb-2">
            {t("cumplices.title") || "Cúmplices"}
          </h1>
          <p className="text-xs text-spa-medium font-light max-w-sm mx-auto leading-relaxed">
            {t("cumplices.subtitle") || "Compartilhe seu ciclo com quem caminha ao seu lado para construir empatia e cumplicidade."}
          </p>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-quartz-50 border border-quartz-200/50 text-xs text-center font-semibold text-spa-dark">
            {statusMessage}
          </div>
        )}

        {/* Main Content card */}
        <div className="bg-white/70 border border-sand-200/50 rounded-[2.5rem] p-8 shadow-sm">
          
          {isConnected ? (
            // ESTADO CONECTADO
            <div className="space-y-6 text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-olive-50 text-olive-600 rounded-full border border-olive-200 mb-2">
                <Check className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-serif text-xl font-light text-spa-dark">
                {t("cumplices.partnerConnected") || "Seu parceiro está conectado!"}
              </h3>
              <p className="text-xs text-spa-light font-light leading-relaxed max-w-xs mx-auto">
                Ele agora pode acompanhar a fase atual do seu ciclo e receber dicas de apoio diárias. Suas anotações, diário íntimo e rede social permanecem 100% invisíveis para ele.
              </p>

              <div className="border-t border-sand-100/60 pt-6">
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-quartz-500 hover:text-quartz-700 bg-quartz-50 hover:bg-quartz-100/60 px-6 py-3.5 rounded-full border border-quartz-200/60 transition-all cursor-pointer"
                >
                  <UserMinus className="w-4 h-4" />
                  {revoking ? (t("cumplices.revoking") || "Desconectando...") : (t("cumplices.revokeBtn") || "Desconectar Parceiro")}
                </button>
              </div>
            </div>
          ) : (
            // ESTADO DISPONÍVEL PARA PAREAMENTO
            <div className="space-y-6">
              
              <div className="flex items-start gap-3 bg-ivory/50 border border-sand-200 p-4 rounded-2xl">
                <ShieldAlert className="w-5 h-5 text-quartz-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-spa-medium font-light leading-relaxed">
                  {t("cumplices.explain") || "Ao conectar, seu parceiro terá um painel exclusivo focado apenas na sua fisiologia e fases do ciclo. Ele não terá nenhum acesso à sua área social, posts, comentários ou anotações confidenciais."}
                </p>
              </div>

              {profile?.partnerCode ? (
                // CÓDIGO ATIVO GERADO
                <div className="space-y-4 text-center border-t border-sand-100/60 pt-6 animate-fade-in">
                  <span className="text-[10px] text-spa-light uppercase font-bold tracking-widest block">
                    {t("cumplices.codeValid") || "Código de pareamento ativo (expira em 24h):"}
                  </span>
                  
                  <div className="flex items-center justify-center gap-3">
                    <div className="bg-ivory border border-sand-200 font-mono text-2xl tracking-[0.25em] pl-3 py-3 rounded-2xl min-w-[150px] shadow-inner text-spa-dark font-semibold">
                      {profile.partnerCode}
                    </div>
                    <button
                      onClick={copyToClipboard}
                      className="p-3 bg-white border border-sand-200 rounded-xl hover:bg-quartz-50 text-spa-medium hover:text-quartz-500 transition-all cursor-pointer"
                      title="Copiar código"
                    >
                      {copied ? <Check className="w-5 h-5 text-olive-600" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-spa-light font-light">
                    Peça para seu parceiro fazer login na plataforma pelo link de pareamento e inserir este código.
                  </p>

                  <div className="pt-2">
                    <button
                      onClick={generateInviteCode}
                      disabled={generating}
                      className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-spa-light hover:text-spa-medium transition-all"
                    >
                      <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                      Gerar Novo Código
                    </button>
                  </div>
                </div>
              ) : (
                // BOTÃO PARA INICIAR PAREAMENTO
                <div className="text-center pt-4">
                  <button
                    onClick={generateInviteCode}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-spa-dark text-white hover:bg-quartz-400 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    {generating ? "Gerando Código..." : (t("cumplices.inviteBtn") || "Conectar Parceiro")}
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

      </main>

    </div>
  );
}
