"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Sparkles, ArrowRight, ArrowLeft, Eye, EyeOff, Loader2, Heart, Check } from "lucide-react";
import { UserProfile } from "@/types/firestore";

type Mode = "login" | "signup";
type SignupStep = 1 | 2 | 3;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<SignupStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(28);
  const [cycleLength, setCycleLength] = useState<number>(28);
  const [periodLength, setPeriodLength] = useState<number>(5);
  const [lastPeriodDate, setLastPeriodDate] = useState("");
  const [contraceptiveType, setContraceptiveType] = useState<"none" | "pill" | "iud" | "injection" | "implonon">("none");
  const [contraceptiveBrand, setContraceptiveBrand] = useState("");
  const [contraceptiveTime, setContraceptiveTime] = useState("08:00");
  const [reminderEnabled, setReminderEnabled] = useState(true);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Credenciais inválidas. Verifique seu e-mail e senha.");
      } else {
        setError("Ocorreu um erro ao entrar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!name || !email || !password) {
        setError("Por favor, preencha todos os campos obrigatórios.");
        return;
      }
      if (password.length < 6) {
        setError("A senha deve conter no mínimo 6 caracteres.");
        return;
      }
    }
    if (step === 2) {
      if (!lastPeriodDate) {
        setError("Selecione a data da sua última menstruação.");
        return;
      }
    }
    setError(null);
    setStep((prev) => (prev + 1) as SignupStep);
  };

  const handlePrevStep = () => {
    setError(null);
    setStep((prev) => (prev - 1) as SignupStep);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Update display name in Auth
      await updateProfile(user, { displayName: name });

      // 3. Create UserProfile document for Firestore
      const userProfile: UserProfile = {
        uid: user.uid,
        email,
        displayName: name,
        age: Number(age),
        cycleLength: Number(cycleLength),
        periodLength: Number(periodLength),
        lastPeriodDate,
        contraceptive: {
          enabled: contraceptiveType !== "none",
          type: contraceptiveType,
          brandName: contraceptiveBrand || undefined,
          time: contraceptiveType === "pill" ? contraceptiveTime : undefined,
          reminderEnabled: contraceptiveType === "pill" ? reminderEnabled : false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 4. Save UserProfile to Firestore
      await setDoc(doc(db, "users", user.uid), userProfile);

      // 5. Redirect to landing page/dashboard
      router.push("/");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso por outra conta.");
      } else {
        setError("Erro ao criar conta. Verifique os dados e tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-ivory min-h-screen text-spa-dark bg-grain flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Decorative Blur Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-quartz-100/40 rounded-full blur-[100px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] bg-olive-100/30 rounded-full blur-[100px] pointer-events-none -z-10 animate-float" />

      {/* Header Logo */}
      <Link href="/" className="flex items-center gap-2 mb-10 group">
        <span className="font-serif text-3xl font-light tracking-[0.15em] text-spa-dark group-hover:text-quartz-500 transition-colors duration-500">
          nefertiti
        </span>
        <div className="w-1.5 h-1.5 bg-quartz-300 rounded-full group-hover:bg-quartz-500 transition-colors duration-500" />
      </Link>

      <div className="w-full max-w-lg bg-white/70 backdrop-blur-xl border border-sand-200/50 rounded-[2.5rem] p-8 lg:p-12 shadow-[0_20px_50px_rgba(238,222,185,0.2)] relative">
        
        {/* Toggle Mode Tabs */}
        <div className="flex border-b border-sand-100 pb-4 mb-8">
          <button
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 text-center py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 cursor-pointer ${
              mode === "login" ? "text-spa-dark border-b-2 border-quartz-400" : "text-spa-light hover:text-spa-dark"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode("signup"); setError(null); setStep(1); }}
            className={`flex-1 text-center py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 cursor-pointer ${
              mode === "signup" ? "text-spa-dark border-b-2 border-quartz-400" : "text-spa-light hover:text-spa-dark"
            }`}
          >
            Cadastrar
          </button>
        </div>

        {/* Global Error message */}
        {error && (
          <div className="mb-6 p-4 bg-quartz-50 border border-quartz-200 text-quartz-500 text-xs rounded-2xl flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-quartz-500 flex-shrink-0 animate-ping" />
            <p>{error}</p>
          </div>
        )}

        {/* --- LOGIN MODE --- */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@exemplo.com"
                className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm transition-all outline-none"
              />
            </div>

            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light">
                  Senha
                </label>
                <Link href="#" className="text-[10px] text-quartz-400 hover:text-quartz-600 transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha secreta"
                className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm transition-all outline-none pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 bottom-4 text-spa-light hover:text-spa-dark transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold tracking-[0.25em] uppercase bg-spa-dark hover:bg-quartz-400 text-white py-4.5 rounded-full hover:shadow-lg transition-all duration-500 disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Acessar Santuário"}
            </button>
          </form>
        )}

        {/* --- SIGNUP MODE --- */}
        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-6">
            
            {/* Step Progress indicators */}
            <div className="flex justify-between items-center mb-8">
              <span className="text-[10px] font-bold uppercase tracking-widest text-spa-light">
                Passo {step} de 3
              </span>
              <div className="flex gap-2">
                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${step >= 1 ? "bg-quartz-400" : "bg-sand-200"}`} />
                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${step >= 2 ? "bg-quartz-400" : "bg-sand-200"}`} />
                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${step >= 3 ? "bg-quartz-400" : "bg-sand-200"}`} />
              </div>
            </div>

            {/* Signup Step 1: Credentials */}
            {step === 1 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                    Nome Completo
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                    E-mail
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@santuario.com"
                    className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm outline-none transition-all"
                  />
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                    Crie uma Senha
                  </label>
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm outline-none pr-12 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 bottom-4 text-spa-light hover:text-spa-dark cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full flex items-center justify-center gap-2 text-xs font-bold tracking-[0.25em] uppercase bg-spa-dark hover:bg-quartz-400 text-white py-4.5 rounded-full hover:shadow-lg transition-all duration-500 cursor-pointer mt-4"
                >
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Signup Step 2: Biological & Cycle Data */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                      Idade
                    </label>
                    <input
                      id="signup-age"
                      type="number"
                      required
                      min="1"
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      placeholder="28"
                      className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                      Duração do Ciclo (dias)
                    </label>
                    <input
                      id="signup-cycle-length"
                      type="number"
                      required
                      min="15"
                      max="45"
                      value={cycleLength}
                      onChange={(e) => setCycleLength(Number(e.target.value))}
                      placeholder="28"
                      className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                      Duração da Menstruação (dias)
                    </label>
                    <input
                      id="signup-period-length"
                      type="number"
                      required
                      min="2"
                      max="15"
                      value={periodLength}
                      onChange={(e) => setPeriodLength(Number(e.target.value))}
                      placeholder="5"
                      className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                      Data da Última Menstruação (DUM)
                    </label>
                    <input
                      id="signup-last-period"
                      type="date"
                      required
                      value={lastPeriodDate}
                      onChange={(e) => setLastPeriodDate(e.target.value)}
                      className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm outline-none text-spa-medium"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-bold tracking-[0.15em] uppercase border border-sand-200 text-spa-dark py-4 rounded-full hover:bg-white transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-bold tracking-[0.15em] uppercase bg-spa-dark hover:bg-quartz-400 text-white py-4 rounded-full hover:shadow-lg transition-all cursor-pointer"
                  >
                    Avançar
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Signup Step 3: Contraceptives & Notifications */}
            {step === 3 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                    Método Anticoncepcional Utilizado
                  </label>
                  <select
                    id="signup-contraceptive-type"
                    value={contraceptiveType}
                    onChange={(e: any) => setContraceptiveType(e.target.value)}
                    className="w-full px-5 py-4 bg-white/40 border border-sand-200 focus:border-quartz-300 rounded-2xl text-sm outline-none text-spa-medium cursor-pointer"
                  >
                    <option value="none">Nenhum (Ciclo Hormonal Natural)</option>
                    <option value="pill">Pílula Anticoncepcional Oral</option>
                    <option value="iud">DIU (Cobre, Prata ou Hormonal)</option>
                    <option value="injection">Injeção Contraceptiva</option>
                    <option value="implonon">Implante Subdérmico (Implanon)</option>
                  </select>
                </div>

                {/* Conditional fields if Pill is selected */}
                {contraceptiveType === "pill" && (
                  <div className="p-5 bg-sand-50/50 border border-sand-200/50 rounded-2xl space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                        Nome da Marca da Pílula
                      </label>
                      <input
                        id="signup-contraceptive-brand"
                        type="text"
                        value={contraceptiveBrand}
                        onChange={(e) => setContraceptiveBrand(e.target.value)}
                        placeholder="Ex: Yasmin, Selene"
                        className="w-full px-4 py-3 bg-white border border-sand-200 focus:border-quartz-300 rounded-xl text-sm outline-none"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                          Horário do Lembrete
                        </label>
                        <input
                          id="signup-contraceptive-time"
                          type="time"
                          value={contraceptiveTime}
                          onChange={(e) => setContraceptiveTime(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-sand-200 focus:border-quartz-300 rounded-xl text-sm outline-none text-spa-medium"
                        />
                      </div>
                      <div className="flex flex-col justify-center">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-spa-light mb-2">
                          Ativar Lembretes
                        </label>
                        <button
                          type="button"
                          onClick={() => setReminderEnabled(!reminderEnabled)}
                          className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                            reminderEnabled ? "bg-quartz-400" : "bg-sand-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                              reminderEnabled ? "translate-x-6" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Biological Explanation note for premium feel */}
                <div className="bg-quartz-50/50 border border-quartz-100 rounded-2xl p-4 flex gap-3">
                  <Heart className="w-5 h-5 text-quartz-400 flex-shrink-0" />
                  <p className="text-[10px] text-spa-light leading-relaxed font-light">
                    * O Nefertiti analisa as variações metabólicas do estrogênio e da progesterona baseado nos dados informados. Se você usa contracepção hormonal, calculamos as fases do ciclo de sangramento artificial, oferecendo nutrição celular de suporte.
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-bold tracking-[0.15em] uppercase border border-sand-200 text-spa-dark py-4 rounded-full hover:bg-white transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                  </button>
                  <button
                    id="btn-submit-signup"
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-bold tracking-[0.15em] uppercase bg-spa-dark hover:bg-quartz-400 text-white py-4 rounded-full hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Acesso"}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
