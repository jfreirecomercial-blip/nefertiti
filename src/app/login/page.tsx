"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ArrowLeft, Shield, Check, Mail, Lock, User as UserIcon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";
import Footer from "@/components/ui/Footer";

function LoginForm() {
  const { t } = useLanguage();
  const router = useRouter();
  
  // Auth Modes: "login" | "signup" | "reset"
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  
  // States
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const createInitialUserDoc = async (user: any, displayName: string) => {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: displayName || "Membro Nefertiti",
        photoURL: user.photoURL || null,
        cycleLength: 28,
        periodLength: 5,
        lastPeriodDate: new Date().toISOString().split("T")[0],
        contraceptive: {
          enabled: false,
          type: "none",
          reminderEnabled: false
        },
        consents: {
          healthData: true,
          termsAccepted: true,
          marketingConsent: true,
          timestamp: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };

  const syncUserRole = async (user: any) => {
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/auth/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }
      });
    } catch (err) {
      console.error("Erro ao sincronizar permissões:", err);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // Chama o popup imediatamente antes das atualizações de estado do React
      // Isso evita que navegadores (especialmente Safari/Mobile) bloqueiem o popup
      const result = await signInWithPopup(auth, provider);
      
      setLoading(true);
      setError("");
      setSuccess(false);

      await createInitialUserDoc(result.user, result.user.displayName || "");
      await syncUserRole(result.user);
      
      setSuccessMsg(t("login.successLogin") || "Login realizado com sucesso! Redirecionando...");
      setSuccess(true);
      setTimeout(() => {
        router.push("/profile");
      }, 1000);
    } catch (err: any) {
      console.error(err);
      // Evita mostrar erro se o usuário apenas fechou o popup
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setError(err.message || "Erro ao autenticar com o Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      if (mode === "login") {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await syncUserRole(userCredential.user);
        setSuccessMsg(t("login.successLogin") || "Login realizado com sucesso! Redirecionando...");
        setSuccess(true);
        setTimeout(() => {
          router.push("/profile");
        }, 1000);
      } else if (mode === "signup") {
        if (password !== confirmPassword) {
          throw new Error(t("login.errorPasswordsMismatch") || "As senhas não coincidem.");
        }
        if (password.length < 6) {
          throw new Error(t("login.errorWeakPassword") || "A senha deve ter pelo menos 6 caracteres.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await createInitialUserDoc(userCredential.user, name);
        await syncUserRole(userCredential.user);
        setSuccessMsg(t("login.successSignup") || "Conta criada com sucesso! Redirecionando...");
        setSuccess(true);
        setTimeout(() => {
          router.push("/profile");
        }, 1000);
      } else if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg(t("login.successReset") || "E-mail de recuperação enviado com sucesso!");
        setSuccess(true);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message;
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        errMsg = t("login.errorInvalidCredential") || "E-mail ou senha inválidos.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "Este endereço de e-mail já está em uso.";
      } else if (err.code === "auth/weak-password") {
        errMsg = t("login.errorWeakPassword") || "A senha deve conter no mínimo 6 caracteres.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = t("login.errorInvalidEmail") || "Insira um endereço de e-mail válido.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between relative overflow-hidden">
      
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-quartz-100/40 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-olive-100/35 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="px-6 lg:px-20 py-6 flex items-center justify-between border-b border-sand-100/40 bg-white/30 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">{t("login.backHome") || "Voltar ao Início"}</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <LanguageSelector />
        </div>
      </header>

      {/* Form Container */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-sand-200/50 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_15px_40px_rgba(238,222,185,0.2)]">
          
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl font-light text-spa-dark tracking-wide mb-2 animate-fade-in">
              {mode === "login" && (t("login.titleLogin") || "Entrar no Santuário")}
              {mode === "signup" && (t("login.titleSignup") || "Criar conta boutique")}
              {mode === "reset" && "Recuperar Acesso"}
            </h2>
            <p className="text-xs text-spa-light font-light tracking-wider">
              {mode === "login" && (t("login.subtitleLogin") || "Bem-vinda de volta ao seu espaço sagrado")}
              {mode === "signup" && (t("login.subtitleSignup") || "Faça parte do ecossistema de saúde integrada feminina.")}
              {mode === "reset" && "Insira seu e-mail para receber as instruções de recuperação."}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-quartz-50 border border-quartz-200/50 text-xs text-quartz-700 font-medium flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-quartz-500 mt-1.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-2xl bg-olive-50 border border-olive-200/40 text-xs text-olive-800 font-medium flex items-center gap-2.5">
              <Check className="w-4 h-4 text-olive-500 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {mode === "signup" && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5 ml-1">
                  {t("login.labelName") || "Nome Completo"}
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-spa-light" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full pl-12 pr-5 py-3.5 bg-ivory/50 border border-sand-200 hover:border-sand-300 focus:border-quartz-300 focus:bg-white rounded-2xl text-xs text-spa-dark font-medium transition-all duration-300 outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5 ml-1">
                {t("login.labelEmail")}
              </label>
              <div className="relative">
                <Mail className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-spa-light" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full pl-12 pr-5 py-3.5 bg-ivory/50 border border-sand-200 hover:border-sand-300 focus:border-quartz-300 focus:bg-white rounded-2xl text-xs text-spa-dark font-medium transition-all duration-300 outline-none"
                />
              </div>
            </div>

            {mode !== "reset" && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5 ml-1">
                  {t("login.labelPassword")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-spa-light" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-5 py-3.5 bg-ivory/50 border border-sand-200 hover:border-sand-300 focus:border-quartz-300 focus:bg-white rounded-2xl text-xs text-spa-dark font-medium transition-all duration-300 outline-none"
                  />
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5 ml-1">
                  {t("login.labelConfirmPassword") || "Confirmar Senha"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-spa-light" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-5 py-3.5 bg-ivory/50 border border-sand-200 hover:border-sand-300 focus:border-quartz-300 focus:bg-white rounded-2xl text-xs text-spa-dark font-medium transition-all duration-300 outline-none"
                  />
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setError(""); setSuccess(false); setMode("reset"); }}
                  className="text-[10px] font-bold uppercase tracking-widest text-quartz-400 hover:text-quartz-500 transition-colors cursor-pointer"
                >
                  {t("login.forgotPassword") || "Esqueceu sua senha?"}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md hover:shadow-lg hover:translate-y-[-1px] active:translate-y-[1px] disabled:bg-sand-300 disabled:translate-y-0 disabled:shadow-none transition-all duration-300 cursor-pointer mt-4"
            >
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                mode === "login" ? (t("login.btnSubmitLogin") || "Entrar") :
                mode === "signup" ? (t("login.btnSubmitSignup") || "Criar Acesso") : "Enviar E-mail"
              )}
            </button>
          </form>

          {/* Alternadores de modo */}
          <div className="mt-6 text-center space-y-2">
            {mode === "login" ? (
              <button
                type="button"
                onClick={() => { setError(""); setSuccess(false); setMode("signup"); }}
                className="text-[10px] font-bold uppercase tracking-widest text-spa-light hover:text-spa-dark transition-colors cursor-pointer"
              >
                {t("login.toggleToSignup") || "Não tem uma conta? Fazer parte"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setError(""); setSuccess(false); setMode("login"); }}
                className="text-[10px] font-bold uppercase tracking-widest text-spa-light hover:text-spa-dark transition-colors cursor-pointer"
              >
                {t("login.toggleToLogin") || "Já possui uma conta? Entrar"}
              </button>
            )}
          </div>

          {(mode === "login" || mode === "signup") && (
            <>
              {/* Divisor "ou" */}
              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-sand-200"></div>
                <span className="flex-shrink mx-4 text-[10px] uppercase font-bold tracking-widest text-spa-light">
                  {t("login.or") || "ou"}
                </span>
                <div className="flex-grow border-t border-sand-200"></div>
              </div>

              {/* Botão de Login com Google padronizado */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-4 bg-white hover:bg-ivory border border-sand-200/80 text-spa-dark rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-sm hover:shadow-md hover:translate-y-[-1px] active:translate-y-[1px] disabled:bg-sand-100 disabled:translate-y-0 disabled:shadow-none transition-all duration-300 cursor-pointer"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.67 0 3.2.58 4.38 1.69l3.27-3.27C17.67 1.48 15.01.8 12 .8 7.39.8 3.47 3.47 1.54 7.39l3.85 2.99C6.32 7.37 8.92 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.48c-.29 1.48-1.14 2.73-2.42 3.57v2.99h3.89c2.28-2.1 3.54-5.19 3.54-8.72z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.39 14.62c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V7.05H1.54C.56 9-.01 11.17-.01 13.5s.57 4.5 1.55 6.45l3.85-2.99z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.2c3.24 0 5.97-1.07 7.96-2.91l-3.89-2.99c-1.08.72-2.47 1.16-4.07 1.16-3.08 0-5.68-2.33-6.61-5.34l-3.85 2.99c1.93 3.92 5.85 6.59 10.46 6.59z"
                    />
                  </svg>
                  <span>{mode === "login" ? (t("login.btnGoogle") || "Entrar com o Google") : "Aderir com o Google"}</span>
                </button>
              </div>
            </>
          )}

        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Carregando...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

