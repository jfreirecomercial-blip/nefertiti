"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User, updateProfile, deleteUser } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  writeBatch
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  User as UserIcon, 
  Calendar, 
  ShieldAlert, 
  Download, 
  Trash2, 
  LogOut, 
  Upload, 
  FileText, 
  Activity, 
  Check, 
  Sparkles,
  RefreshCw,
  Share2,
  FileSpreadsheet,
  HelpCircle,
  Award,
  ArrowRight,
  Heart
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { compressImage } from "@/lib/image-compression";

export default function ProfilePage() {
  const { t } = useLanguage();
  const router = useRouter();
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form profile states
  const [displayName, setDisplayName] = useState("");
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [lastPeriodDate, setLastPeriodDate] = useState("");
  const [contraceptiveEnabled, setContraceptiveEnabled] = useState(false);
  const [contraceptiveType, setContraceptiveType] = useState("none");
  const [contraceptiveBrand, setContraceptiveBrand] = useState("");
  const [contraceptiveTime, setContraceptiveTime] = useState("08:00");
  const [contraceptiveReminder, setContraceptiveReminder] = useState(false);

  // Photo state
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoURL, setPhotoURL] = useState("");

  // Import states
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [importedLogs, setImportedLogs] = useState<any[]>([]);
  const [importType, setImportType] = useState<"none" | "ai" | "csv">("none");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState("");

  // Recomendações nutricionais (Spoonacular)
  const [recipes, setRecipes] = useState<any[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState("");
  const [recipePhase, setRecipePhase] = useState("");
  const [recipeExplanation, setRecipeExplanation] = useState("");

  const fetchNutritionRecommendations = async (currentUser: User) => {
    setRecipesLoading(true);
    setRecipesError("");
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/nutrition/recommendations", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Erro ao carregar recomendações");
      }
      const data = await res.json();
      if (data.success) {
        setRecipes(data.recommendations);
        setRecipePhase(data.phase);
        setRecipeExplanation(data.explanation);
      } else {
        throw new Error(data.error || "Erro desconhecido");
      }
    } catch (err: any) {
      console.error(err);
      setRecipesError(err.message || "Não foi possível carregar as sugestões nutricionais.");
    } finally {
      setRecipesLoading(false);
    }
  };

  // Check Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        setPhotoURL(currentUser.photoURL || "");
        
        // Carregar dados adicionais do Firestore
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const snap = await getDoc(docRef);
          let profileData = null;
          
          if (snap.exists()) {
            profileData = snap.data();
            if (profileData.role === "partner") {
              router.push("/dashboard/partner");
              return;
            }
          }

          if (profileData) {
            setUserProfile(profileData);
            setDisplayName(profileData.displayName || currentUser.displayName || "");
            setCycleLength(profileData.cycleLength || 28);
            setPeriodLength(profileData.periodLength || 5);
            setLastPeriodDate(profileData.lastPeriodDate || "");
            if (profileData.contraceptive) {
              setContraceptiveEnabled(profileData.contraceptive.enabled || false);
              setContraceptiveType(profileData.contraceptive.type || "none");
              setContraceptiveBrand(profileData.contraceptive.brandName || "");
              setContraceptiveTime(profileData.contraceptive.time || "08:00");
              setContraceptiveReminder(profileData.contraceptive.reminderEnabled || false);
            }
          } else {
            // Documento ainda não criado no firestore, criar provisório
            const fallback = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || "Membro Nefertiti",
              cycleLength: 28,
              periodLength: 5,
              lastPeriodDate: new Date().toISOString().split("T")[0],
              contraceptive: { enabled: false, type: "none", reminderEnabled: false }
            };
            await setDoc(docRef, fallback);
            setUserProfile(fallback);
            setDisplayName(fallback.displayName);
            setLastPeriodDate(fallback.lastPeriodDate);
          }
          // Buscar recomendações de nutrição baseadas no ciclo do usuário
          fetchNutritionRecommendations(currentUser);
        } catch (error) {
          console.error("Erro ao carregar perfil:", error);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Upload/Compression photo handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setPhotoLoading(true);
    setImportStatus("");

    try {
      // Regra de compactação antes do upload: comprimir para JPEG < 250KB
      const compressedFile = await compressImage(file, {
        maxDimension: 1200,
        initialQuality: 0.75,
        maxSizeBytes: 250 * 1024
      });

      console.log(`Foto compactada: de ${(file.size / 1024 / 1024).toFixed(2)}MB para ${(compressedFile.size / 1024).toFixed(2)}KB`);

      const photoRef = ref(storage, `users/${user.uid}/profile.jpg`);
      await uploadBytes(photoRef, compressedFile);
      const downloadURL = await getDownloadURL(photoRef);

      // Atualizar no Auth
      await updateProfile(user, { photoURL: downloadURL });
      
      // Atualizar no Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { photoURL: downloadURL, updatedAt: new Date().toISOString() });
      
      setPhotoURL(downloadURL);
      setImportStatus(t("profile.photoSuccess") || "Foto de perfil atualizada com sucesso!");
    } catch (err: any) {
      console.error(err);
      setImportStatus("Erro ao enviar foto: " + err.message);
    } finally {
      setPhotoLoading(false);
    }
  };

  // Save profile settings
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const userRef = doc(db, "users", user.uid);
      const updatedData = {
        displayName,
        cycleLength: Number(cycleLength),
        periodLength: Number(periodLength),
        lastPeriodDate,
        contraceptive: {
          enabled: contraceptiveEnabled,
          type: contraceptiveType,
          brandName: contraceptiveBrand,
          time: contraceptiveTime,
          reminderEnabled: contraceptiveReminder
        },
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updatedData);
      await updateProfile(user, { displayName });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Erro ao salvar perfil:", err);
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // GDPR Portability: Download my data
  const handleDownloadData = async () => {
    if (!user) return;

    try {
      setImportStatus(t("profile.exporting") || "Coletando seus dados de saúde...");
      
      // Obter dados do perfil
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const profile = userSnap.exists() ? userSnap.data() : {};

      // Obter logs diários
      const logsRef = collection(db, "daily_logs");
      const q = query(logsRef, where("userId", "==", user.uid));
      const querySnap = await getDocs(q);
      const logs = querySnap.docs.map(doc => doc.data());

      // Montar objeto de portabilidade
      const exportObject = {
        nefertiti_version: "1.0",
        exportedAt: new Date().toISOString(),
        profile: {
          uid: user.uid,
          email: user.email,
          displayName: profile.displayName,
          age: profile.age,
          cycleLength: profile.cycleLength,
          periodLength: profile.periodLength,
          lastPeriodDate: profile.lastPeriodDate,
          contraceptive: profile.contraceptive
        },
        history: logs
      };

      const jsonStr = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `nefertiti-dados-saude-${user.uid}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setImportStatus(t("profile.exportSuccess") || "Dados exportados com sucesso!");
    } catch (err: any) {
      console.error("Erro ao exportar dados:", err);
      setImportStatus("Erro ao exportar: " + err.message);
    }
  };

  // GDPR Right to be Forgotten: Delete Account
  const handleDeleteAccount = async () => {
    if (!user) return;

    const confirmDelete = window.confirm(
      t("profile.deleteConfirm") || "ATENÇÃO: Isso excluirá permanentemente sua conta e TODOS os seus dados de saúde de forma irreversível. Deseja prosseguir?"
    );

    if (!confirmDelete) return;

    try {
      setSaving(true);
      setImportStatus(t("profile.deleting") || "Excluindo todos os registros de saúde...");

      // 1. Excluir Logs Diários
      const logsRef = collection(db, "daily_logs");
      const q = query(logsRef, where("userId", "==", user.uid));
      const querySnap = await getDocs(q);
      
      const batch = writeBatch(db);
      querySnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // 2. Excluir Perfil no Firestore
      await deleteDoc(doc(db, "users", user.uid));

      // 3. Excluir conta de Autenticação
      await deleteUser(user);

      router.push("/");
    } catch (err: any) {
      console.error("Erro ao deletar conta:", err);
      alert(t("profile.deleteError") || "Para excluir sua conta, você precisa ter feito login recentemente. Por favor, saia e entre novamente antes de tentar de novo.");
    } finally {
      setSaving(false);
    }
  };

  // AI Screenshot OCR Upload
  const handleAiOcr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotFile || !user) return;

    setAiLoading(true);
    setImportStatus("");
    setImportedLogs([]);

    try {
      // Converter para Base64
      const reader = new FileReader();
      reader.readAsDataURL(screenshotFile);
      
      reader.onload = async () => {
        const base64Img = reader.result as string;
        
        try {
          const res = await fetch("/api/import/screenshot", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ image: base64Img })
          });

          if (!res.ok) throw new Error("Falha na chamada da rota de IA.");
          
          const result = await res.json();
          if (result.success && result.data) {
            setImportedLogs(result.data);
            setImportStatus(`IA encontrou ${result.data.length} registros com sucesso! Revise-os abaixo.`);
          } else {
            throw new Error(result.error || "Formato de imagem inválido.");
          }
        } catch (innerErr: any) {
          console.error(innerErr);
          setImportStatus("Erro ao ler imagem com IA: " + innerErr.message);
        } finally {
          setAiLoading(false);
        }
      };
    } catch (err: any) {
      console.error(err);
      setImportStatus("Erro ao carregar arquivo.");
      setAiLoading(false);
    }
  };

  // CSV file Import
  const handleCsvImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setAiLoading(true);
    setImportStatus("");
    setImportedLogs([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n");
        const logs = [];

        // Ignorar cabeçalho e parsear linhas
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const cols = line.split(",");
          if (cols.length < 2) continue;
          
          const date = cols[0]?.trim(); // YYYY-MM-DD
          const flow = (cols[1]?.trim() || "none") as "none" | "light" | "medium" | "heavy";
          const symptomsStr = cols[2]?.trim() || "";
          const symptoms = symptomsStr ? symptomsStr.split(";").map(s => s.trim()).filter(Boolean) : [];
          const water = parseInt(cols[3]?.trim() || "0") || 0;
          const notes = cols[4]?.replace(/^["']|["']$/g, "").trim() || "";

          if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            logs.push({
              date,
              flow,
              symptoms,
              waterIntakeMl: water,
              notes: notes || "Importado via CSV"
            });
          }
        }

        if (logs.length > 0) {
          setImportedLogs(logs);
          setImportStatus(`CSV carregado com ${logs.length} registros! Confirme a importação abaixo.`);
        } else {
          setImportStatus("Nenhum registro válido encontrado. Verifique o cabeçalho (data,fluxo,sintomas,agua,notas).");
        }
      } catch (err: any) {
        setImportStatus("Erro no parsing do CSV: " + err.message);
      } finally {
        setAiLoading(false);
      }
    };
    reader.readAsText(csvFile);
  };

  // Batch Save Imported Logs to Firestore
  const handleConfirmImport = async () => {
    if (!user || importedLogs.length === 0) return;

    setSaving(true);
    setImportStatus("Salvando registros no Firestore...");

    try {
      const batch = writeBatch(db);

      importedLogs.forEach((log) => {
        const logId = `${user.uid}_${log.date}`;
        const docRef = doc(db, "daily_logs", logId);
        
        batch.set(docRef, {
          id: logId,
          userId: user.uid,
          date: log.date,
          waterIntakeMl: log.waterIntakeMl || 0,
          waterTargetMl: 2500,
          symptoms: log.symptoms || [],
          mood: log.mood || "calm",
          flow: log.flow || "none",
          nutrition: { notes: "Importado via sistema" },
          notes: log.notes || "Dados importados",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      await batch.commit();
      setImportStatus("Importação concluída com sucesso!");
      setImportedLogs([]);
      setImportType("none");
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setCsvFile(null);
    } catch (err: any) {
      console.error(err);
      setImportStatus("Erro ao salvar registros: " + err.message);
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Carregando seu santuário...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory bg-grain text-spa-dark pb-20">
      
      {/* Dynamic Blobs */}
      <div className="absolute top-20 right-[-10%] w-[500px] h-[500px] bg-quartz-100/30 rounded-full blur-[110px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-[-15%] w-[450px] h-[450px] bg-olive-100/30 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-ivory/85 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-serif text-2xl font-light tracking-[0.1em] text-spa-dark">
            nefertiti
          </span>
          <span className="text-[10px] text-spa-light uppercase font-semibold tracking-[0.2em] border-l border-sand-200 pl-3">
            Santuário
          </span>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xs font-bold uppercase tracking-[0.15em] text-quartz-500 hover:text-quartz-600 transition-colors">
            Calendário
          </Link>
          <Link href="/social" className="text-xs font-bold uppercase tracking-[0.15em] text-spa-medium hover:text-quartz-500 transition-colors">
            {t("nav.social") || "Social"}
          </Link>
          <LanguageSelector />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-quartz-500 hover:text-quartz-600 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t("profile.logout") || "Sair"}</span>
          </button>
        </div>
      </header>

      {/* Main Panel grid */}
      <main className="max-w-6xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Card: Quick profile and privacy rights */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Avatar and name Card */}
          <div className="bg-white/70 border border-sand-200/50 rounded-[2rem] p-6 text-center relative overflow-hidden shadow-sm">
            <div className="absolute top-2 right-2">
              <span className="text-[8px] bg-olive-50 text-olive-600 font-semibold px-2 py-0.5 rounded border border-olive-200 uppercase tracking-widest">Ativo</span>
            </div>
            
            <div className="relative w-24 h-24 mx-auto mb-4 group">
              {photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={photoURL} 
                  alt="Perfil" 
                  className="w-24 h-24 rounded-full object-cover border-2 border-quartz-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400">
                  <UserIcon className="w-10 h-10" />
                </div>
              )}

              {photoLoading && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                </div>
              )}

              <label className="absolute bottom-0 right-0 p-1.5 bg-white border border-sand-200 rounded-full hover:bg-quartz-50 cursor-pointer shadow-sm">
                <Upload className="w-3.5 h-3.5 text-spa-medium" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handlePhotoUpload}
                  disabled={photoLoading}
                />
              </label>
            </div>

            <h3 className="font-serif text-xl text-spa-dark font-light">{displayName || "Membro Nefertiti"}</h3>
            <p className="text-[10px] text-spa-light tracking-wider font-semibold uppercase mt-1">{user?.email}</p>
          </div>

          {/* Menu de Recursos Boutique */}
          <div className="bg-white/70 border border-sand-200/50 rounded-[2rem] p-6 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-quartz-400" />
              <h4 className="font-serif text-base italic text-spa-dark">Método e Consultas</h4>
            </div>

            <Link
              href="/dashboard"
              className="w-full flex items-center justify-between p-3.5 bg-quartz-50/40 hover:bg-quartz-100/50 border border-quartz-200/60 hover:border-quartz-300 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-quartz-600 transition-all group"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-quartz-400" />
                <span>Dashboard do Ciclo</span>
              </div>
              <ArrowRight className="w-3 h-3 text-quartz-500 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/daily-tracker"
              className="w-full flex items-center justify-between p-3.5 bg-quartz-50/40 hover:bg-quartz-100/50 border border-quartz-200/60 hover:border-quartz-300 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-quartz-600 transition-all group"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-quartz-400" />
                <span>Registo de Sintomas Diário</span>
              </div>
              <ArrowRight className="w-3 h-3 text-quartz-500 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/profile/partner"
              className="w-full flex items-center justify-between p-3.5 bg-quartz-50/40 hover:bg-quartz-100/50 border border-quartz-200/60 hover:border-quartz-300 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-quartz-600 transition-all group"
            >
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-quartz-400 fill-quartz-200/40" />
                <span>Cúmplices (Parceiro)</span>
              </div>
              <ArrowRight className="w-3 h-3 text-quartz-500 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/professionals"
              className="w-full flex items-center justify-between p-3.5 bg-ivory hover:bg-sand-50 border border-sand-200/80 hover:border-quartz-300 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-spa-medium transition-all group"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-quartz-400" />
                <span>Consultar Especialistas</span>
              </div>
              <ArrowRight className="w-3 h-3 text-spa-light group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/register-professional"
              className="w-full flex items-center justify-between p-3.5 bg-ivory hover:bg-sand-50 border border-sand-200/80 hover:border-quartz-300 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-spa-medium transition-all group"
            >
              <div className="flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-quartz-400" />
                <span>
                  {userProfile?.role?.startsWith("professional")
                    ? "Área Profissional"
                    : "Credenciamento Especialista"}
                </span>
              </div>
              <ArrowRight className="w-3 h-3 text-spa-light group-hover:translate-x-1 transition-transform" />
            </Link>

            {userProfile?.role === "admin" && (
              <Link
                href="/admin"
                className="w-full flex items-center justify-between p-3.5 bg-quartz-50 hover:bg-quartz-100/40 border border-quartz-200 hover:border-quartz-300 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-quartz-600 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-quartz-500" />
                  <span>Painel do Administrador</span>
                </div>
                <ArrowRight className="w-3 h-3 text-quartz-500 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </div>

          {/* Privacy and GDPR Rights Card */}
          <div className="bg-white/70 border border-sand-200/50 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-quartz-400" />
              <h4 className="font-serif text-base italic text-spa-dark">Seus Direitos de Privacidade</h4>
            </div>
            <p className="text-[11px] text-spa-light font-light leading-relaxed mb-6">
              Em total conformidade com as diretivas europeias (GDPR) e brasileiras (LGPD), você possui controle absoluto e soberano sobre os seus dados de saúde menstrual e pessoal.
            </p>

            <div className="space-y-3.5">
              {/* GDPR Portability: JSON download */}
              <button
                onClick={handleDownloadData}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 border border-sand-200 hover:border-quartz-200 bg-white/60 hover:bg-quartz-50/20 text-spa-medium hover:text-quartz-500 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {t("profile.downloadData") || "Baixar Meus Dados (JSON)"}
              </button>

              {/* GDPR Forgetfulness: Delete Account */}
              <button
                onClick={handleDeleteAccount}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 border border-quartz-100 hover:bg-quartz-100/30 text-quartz-500 hover:text-quartz-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("profile.deleteAccount") || "Excluir Minha Conta"}
              </button>
            </div>
          </div>

        </div>

        {/* Right Content: Settings and Imports */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Main Status alerts */}
          {importStatus && (
            <div className="p-4 rounded-2xl bg-quartz-50 border border-quartz-200/50 text-xs font-semibold text-spa-dark flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-quartz-400 mt-1.5 flex-shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}

          {/* Profile settings Form */}
          <div className="bg-white/70 border border-sand-200/50 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-serif text-2xl text-spa-dark font-light tracking-wide">
                Configurações do Ciclo
              </h3>
              <span className="text-[9px] uppercase tracking-widest text-spa-light font-bold">Nefertiti Profile</span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5">
                    Nome de Exibição
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4.5 py-3 bg-ivory/50 border border-sand-200 hover:border-sand-300 focus:border-quartz-300 focus:bg-white rounded-xl text-xs text-spa-dark font-medium transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5">
                    Data da Última Menstruação
                  </label>
                  <input
                    type="date"
                    required
                    value={lastPeriodDate}
                    onChange={(e) => setLastPeriodDate(e.target.value)}
                    className="w-full px-4.5 py-3 bg-ivory/50 border border-sand-200 hover:border-sand-300 focus:border-quartz-300 focus:bg-white rounded-xl text-xs text-spa-dark font-medium transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5">
                    Duração Média do Ciclo (dias)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="45"
                    required
                    value={cycleLength}
                    onChange={(e) => setCycleLength(Number(e.target.value))}
                    className="w-full px-4.5 py-3 bg-ivory/50 border border-sand-200 hover:border-sand-300 focus:border-quartz-300 focus:bg-white rounded-xl text-xs text-spa-dark font-medium transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5">
                    Duração Média da Menstruação (dias)
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="14"
                    required
                    value={periodLength}
                    onChange={(e) => setPeriodLength(Number(e.target.value))}
                    className="w-full px-4.5 py-3 bg-ivory/50 border border-sand-200 hover:border-sand-300 focus:border-quartz-300 focus:bg-white rounded-xl text-xs text-spa-dark font-medium transition-all outline-none"
                  />
                </div>
              </div>

              {/* Contraceptive Settings */}
              <div className="border-t border-sand-100/60 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs uppercase tracking-widest text-spa-medium font-bold">Uso de Contraceptivo</h4>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={contraceptiveEnabled}
                      onChange={(e) => setContraceptiveEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-sand-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-quartz-400"></div>
                  </label>
                </div>

                {contraceptiveEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 p-4 bg-ivory/30 border border-sand-200/50 rounded-2xl animate-fade-in">
                    <div>
                      <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light mb-1">
                        Tipo de Contraceptivo
                      </label>
                      <select
                        value={contraceptiveType}
                        onChange={(e) => setContraceptiveType(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-sand-200 focus:border-quartz-300 rounded-xl text-xs text-spa-dark outline-none"
                      >
                        <option value="pill">Pílula</option>
                        <option value="iud">Diu</option>
                        <option value="injection">Injeção</option>
                        <option value="implonon">Implante (Implonon)</option>
                        <option value="none">Nenhum</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light mb-1">
                        Nome do Medicamento/Marca
                      </label>
                      <input
                        type="text"
                        value={contraceptiveBrand}
                        onChange={(e) => setContraceptiveBrand(e.target.value)}
                        placeholder="Ex: Yasmin"
                        className="w-full px-3 py-2.5 bg-white border border-sand-200 focus:border-quartz-300 rounded-xl text-xs text-spa-dark outline-none"
                      />
                    </div>

                    <div className="md:col-span-2 border-t border-sand-100/40 pt-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light mb-1">
                            Hora do Lembrete
                          </label>
                          <input
                            type="time"
                            value={contraceptiveTime}
                            onChange={(e) => setContraceptiveTime(e.target.value)}
                            className="px-2 py-1.5 border border-sand-200 focus:border-quartz-300 rounded-lg text-xs outline-none"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-spa-medium mt-4 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={contraceptiveReminder}
                            onChange={(e) => setContraceptiveReminder(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-4 h-4 rounded border border-sand-300 bg-white flex items-center justify-center peer-checked:bg-quartz-400 peer-checked:border-quartz-400 transition-all">
                            <Check className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" />
                          </div>
                          <span>Habilitar Lembrete Diário</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-sand-100/60 pt-6">
                {saveSuccess && (
                  <span className="text-xs text-olive-600 font-semibold flex items-center gap-1.5 animate-pulse">
                    <Check className="w-4 h-4" /> Configurações salvas!
                  </span>
                )}
                <div className="ml-auto">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 py-3 px-8 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md transition-all cursor-pointer"
                  >
                    {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : "Salvar Configurações"}
                  </button>
                </div>
              </div>

            </form>
          </div>

          {/* Card de Recomendações Nutricionais (Spoonacular) */}
          <div className="bg-white/70 border border-sand-200/50 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[9px] bg-olive-50 text-olive-600 font-bold px-2.5 py-1 rounded-md border border-olive-100 uppercase tracking-widest inline-block mb-2">
                  Spoonacular API
                </span>
                <h3 className="font-serif text-2xl text-spa-dark font-light tracking-wide">
                  Nutrição Sincronizada com o Ciclo
                </h3>
              </div>
              <button
                onClick={() => user && fetchNutritionRecommendations(user)}
                className="p-2 rounded-full border border-sand-200 hover:border-quartz-200 hover:bg-white/50 text-spa-medium transition-all cursor-pointer"
                title="Recarregar receitas"
              >
                <RefreshCw className={`w-4 h-4 ${recipesLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {recipesLoading ? (
              <div className="text-center py-10">
                <span className="w-6 h-6 rounded-full border-3 border-quartz-400 border-t-transparent animate-spin inline-block mb-3" />
                <p className="text-xs text-spa-light italic font-light font-sans">Calculando fase e buscando receitas...</p>
              </div>
            ) : recipesError ? (
              <div className="p-4 bg-quartz-50 border border-quartz-200/40 rounded-2xl text-xs text-spa-medium font-medium leading-relaxed">
                {recipesError.includes("Spoonacular") ? (
                  <p>A API Spoonacular está ativa, mas ocorreu um problema ao se conectar. Verifique se a sua chave de API está correta no ficheiro `.env.local`.</p>
                ) : (
                  <p>{recipesError}</p>
                )}
              </div>
            ) : recipes.length === 0 ? (
              <div className="p-6 bg-ivory/30 border border-sand-200/50 rounded-2xl text-center">
                <p className="text-xs text-spa-light italic font-light font-sans">Nenhuma receita sugerida no momento. Tente recarregar ou verifique as configurações da última menstruação.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Cabeçalho da Fase e Explicação Metabólica */}
                <div className="p-4.5 bg-olive-50/20 border border-olive-100/30 rounded-2xl space-y-2">
                  <h4 className="text-xs uppercase font-bold tracking-widest text-olive-600 flex items-center gap-1.5 font-sans">
                    <Activity className="w-3.5 h-3.5" />
                    Fase Hormonal Ativa: <span className="font-serif italic font-light text-spa-dark capitalize">{recipePhase}</span>
                  </h4>
                  <p className="text-xs text-spa-medium leading-relaxed font-light font-sans">
                    {recipeExplanation}
                  </p>
                </div>

                {/* Grid de Receitas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {recipes.map((recipe) => (
                    <div key={recipe.id} className="border border-sand-200/60 bg-white/40 rounded-2xl overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group">
                      <div>
                        {recipe.image && (
                          <div className="relative h-32 w-full overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={recipe.image} 
                              alt={recipe.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                            />
                          </div>
                        )}
                        <div className="p-4 space-y-2">
                          <h5 className="font-serif text-sm font-light text-spa-dark line-clamp-2 min-h-[2.5rem]">
                            {recipe.title}
                          </h5>
                          <div className="flex gap-2 text-[9px] text-spa-light font-bold uppercase font-sans">
                            <span>⏱️ {recipe.readyInMinutes} min</span>
                            <span>🍽️ {recipe.servings} porções</span>
                          </div>
                          
                          {/* Nutrientes Específicos da Fase */}
                          <div className="bg-white/80 border border-sand-100 p-2 rounded-xl text-[9px] font-medium space-y-1 text-spa-medium font-sans">
                            <div className="flex justify-between">
                              <span>Calorias:</span>
                              <span className="font-semibold text-spa-dark">{Math.round(recipe.nutrients.calories)} kcal</span>
                            </div>
                            {recipePhase === "menstrual" && (
                              <div className="flex justify-between text-quartz-600 font-bold">
                                <span>Ferro (Reposição):</span>
                                <span>{recipe.nutrients.iron.toFixed(1)} mg</span>
                              </div>
                            )}
                            {recipePhase === "follicular" && (
                              <div className="flex justify-between text-olive-600 font-bold">
                                <span>Fibras (Eliminação):</span>
                                <span>{recipe.nutrients.fiber.toFixed(1)} g</span>
                              </div>
                            )}
                            {recipePhase === "luteal" && (
                              <div className="flex justify-between text-quartz-600 font-bold">
                                <span>Magnésio (Cólicas):</span>
                                <span>{recipe.nutrients.magnesium.toFixed(1)} mg</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border-t border-sand-100/40">
                        <a
                          href={recipe.spoonacularSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center py-2 bg-sand-50 hover:bg-quartz-50 border border-sand-200 hover:border-quartz-200 rounded-xl text-[10px] font-bold uppercase tracking-wider text-spa-medium transition-all font-sans"
                        >
                          Ver Preparo Completo
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Import Health History Card */}
          <div className="bg-white/70 border border-sand-200/50 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-2xl text-spa-dark font-light tracking-wide">
                Importar Histórico de Ciclos
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setImportType("ai")}
                  className={`text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${importType === "ai" ? "bg-quartz-400 border-quartz-400 text-white" : "border-sand-200 hover:border-quartz-200 text-spa-medium"}`}
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1" /> IA Screenshot
                </button>
                <button
                  onClick={() => setImportType("csv")}
                  className={`text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${importType === "csv" ? "bg-quartz-400 border-quartz-400 text-white" : "border-sand-200 hover:border-quartz-200 text-spa-medium"}`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" /> Arquivo CSV
                </button>
              </div>
            </div>

            {/* AI Screenshot Interface */}
            {importType === "ai" && (
              <form onSubmit={handleAiOcr} className="space-y-6 animate-fade-in">
                <p className="text-xs text-spa-medium leading-relaxed font-light">
                  <strong>Importação por IA:</strong> Carregue um print/screenshot de outro aplicativo menstrual (como Clue ou Flo). Nossa Inteligência Artificial (Google Gemini) analisará a imagem, detectará os registros de ciclos, fluxo e sintomas e os transcreverá automaticamente.
                </p>

                <div className="border-2 border-dashed border-sand-200/80 rounded-2xl p-6 text-center hover:bg-ivory/20 transition-all relative">
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setScreenshotFile(file);
                        const previewURL = URL.createObjectURL(file);
                        setScreenshotPreview(previewURL);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2.5">
                    <Upload className="w-8 h-8 text-quartz-300 mx-auto" />
                    <p className="text-xs text-spa-medium font-semibold">
                      {screenshotFile ? screenshotFile.name : "Clique para selecionar ou arraste o print do aplicativo"}
                    </p>
                    <p className="text-[10px] text-spa-light uppercase font-bold tracking-wider">Suporta JPG, PNG até 10MB</p>
                  </div>
                </div>

                {screenshotPreview && (
                  <div className="max-w-xs mx-auto border border-sand-200 rounded-xl p-2 bg-white flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={screenshotPreview} alt="Preview Screenshot" className="max-h-60 rounded object-contain" />
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={aiLoading || !screenshotFile}
                    className="flex items-center gap-2.5 py-3.5 px-8 bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md hover:bg-quartz-500 transition-all cursor-pointer disabled:bg-sand-200"
                  >
                    {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Analisar com IA
                  </button>
                </div>
              </form>
            )}

            {/* CSV Import Interface */}
            {importType === "csv" && (
              <form onSubmit={handleCsvImport} className="space-y-6 animate-fade-in">
                <div className="text-xs text-spa-medium leading-relaxed font-light space-y-2">
                  <p>
                    <strong>Importação por CSV:</strong> Selecione um arquivo CSV de seu computador contendo seu histórico.
                  </p>
                  <p className="bg-ivory/50 border border-sand-200 p-3 rounded-xl font-mono text-[10px]">
                    Cabeçalho do CSV: <br />
                    <code className="text-quartz-600">data,fluxo,sintomas,agua,notas</code> <br />
                    Exemplo de linha: <br />
                    <code>2026-06-15,heavy,cramps;bloating,2000,Dores no abdômen</code>
                  </p>
                </div>

                <div className="border-2 border-dashed border-sand-200/80 rounded-2xl p-6 text-center hover:bg-ivory/20 transition-all relative">
                  <input
                    type="file"
                    accept=".csv"
                    required
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCsvFile(file);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2.5">
                    <FileText className="w-8 h-8 text-quartz-300 mx-auto" />
                    <p className="text-xs text-spa-medium font-semibold">
                      {csvFile ? csvFile.name : "Clique para selecionar o arquivo .csv"}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={aiLoading || !csvFile}
                    className="flex items-center gap-2.5 py-3.5 px-8 bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md hover:bg-quartz-500 transition-all cursor-pointer disabled:bg-sand-200"
                  >
                    {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Processar Arquivo
                  </button>
                </div>
              </form>
            )}

            {/* Imported logs list preview & confirmation */}
            {importedLogs.length > 0 && (
              <div className="mt-8 border-t border-sand-100 pt-6 animate-fade-in">
                <h4 className="font-serif text-lg italic text-spa-dark mb-4">Registros Identificados</h4>
                
                <div className="overflow-x-auto border border-sand-200/60 rounded-2xl bg-white/40">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-sand-50/60 text-spa-light uppercase font-bold tracking-wider border-b border-sand-200/40">
                        <th className="p-3">Data</th>
                        <th className="p-3">Fluxo</th>
                        <th className="p-3">Sintomas</th>
                        <th className="p-3">Água</th>
                        <th className="p-3">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-100/40 text-spa-medium font-light">
                      {importedLogs.map((log, index) => (
                        <tr key={index}>
                          <td className="p-3 font-semibold">{log.date}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.flow === "heavy" ? "bg-quartz-50 text-quartz-700" : log.flow === "medium" ? "bg-sand-100 text-spa-dark" : "bg-ivory text-spa-light"}`}>
                              {log.flow}
                            </span>
                          </td>
                          <td className="p-3">
                            {log.symptoms && log.symptoms.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {log.symptoms.map((s: string, sIdx: number) => (
                                  <span key={sIdx} className="bg-white border border-sand-200 px-1.5 py-0.5 rounded text-[9px]">{s}</span>
                                ))}
                              </div>
                            ) : "-"}
                          </td>
                          <td className="p-3">{log.waterIntakeMl || 0}ml</td>
                          <td className="p-3 max-w-xs truncate" title={log.notes}>{log.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setImportedLogs([]);
                      setScreenshotFile(null);
                      setScreenshotPreview(null);
                      setCsvFile(null);
                      setImportStatus("");
                    }}
                    className="py-3 px-6 border border-sand-200 hover:border-quartz-200 text-spa-medium hover:text-quartz-500 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={saving}
                    className="flex items-center gap-2 py-3 px-8 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md transition-all cursor-pointer"
                  >
                    {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : "Confirmar e Gravar"}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </main>
      
    </div>
  );
}
