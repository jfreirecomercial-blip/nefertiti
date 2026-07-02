"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User, updateProfile } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Upload, 
  ShieldCheck, 
  AlertCircle, 
  User as UserIcon, 
  Award, 
  FileText, 
  DollarSign,
  Heart,
  Loader2
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { compressImage } from "@/lib/image-compression";

export default function RegisterProfessionalPage() {
  const { t } = useLanguage();
  const router = useRouter();
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Registration state
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  
  // Form Stepper
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form fields
  const [displayName, setDisplayName] = useState("");
  const [specialty, setSpecialty] = useState("ginecologista");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [bio, setBio] = useState("");
  const [priceRange, setPriceRange] = useState(""); // Opcional
  
  // Uploads
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  
  // Declaration Checkboxes
  const [femaleDeclaration, setFemaleDeclaration] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Specialties list
  const specialties = [
    { value: "ginecologista", label: "Ginecologia Integrativa" },
    { value: "nutricionista", label: "Nutrição Funcional Feminina" },
    { value: "psicologa", label: "Psicologia da Mulher" },
    { value: "endocrinologista", label: "Endocrinologia Feminina" },
    { value: "obstetra", label: "Obstetrícia" },
    { value: "doula", label: "Doula e Cuidado Perinatal" }
  ];

  // Auth checking
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login?redirect=/register-professional");
      } else {
        setCurrentUser(user);
        setDisplayName(user.displayName || "");
        setPhotoPreview(user.photoURL || "");
        
        // Verificar se já existe um cadastro de profissional
        try {
          const docRef = doc(db, "professionals", user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            setExistingProfile(data);
            // Preencher campos com dados salvos se estiver pendente/rejeitado para edição
            setDisplayName(data.displayName || user.displayName || "");
            setSpecialty(data.specialty || "ginecologista");
            setLicenseNumber(data.licenseNumber || "");
            setBio(data.bio || "");
            setPriceRange(data.priceRange || "");
          }
        } catch (err) {
          console.error("Erro ao buscar perfil de profissional existente:", err);
        } finally {
          setProfileLoading(false);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("A foto de perfil selecionada excede o limite máximo de 10MB.");
      return;
    }

    try {
      // Comprimir foto de perfil
      const compressed = await compressImage(file, {
        maxDimension: 1000,
        initialQuality: 0.75,
        maxSizeBytes: 200 * 1024
      });
      setPhotoFile(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
      setError("");
    } catch (err) {
      console.error("Erro ao otimizar foto:", err);
      setError("Erro ao otimizar imagem de perfil. Tente outro arquivo.");
    }
  };

  const validateStep = () => {
    setError("");
    if (step === 1) {
      if (!displayName.trim()) {
        setError("Por favor, preencha o seu nome completo profissional.");
        return false;
      }
      if (!licenseNumber.trim()) {
        setError("O número do registro profissional (ex: CRM, CRP, CRN) é obrigatório.");
        return false;
      }
    } else if (step === 2) {
      if (!bio.trim() || bio.length < 50) {
        setError("Sua biografia profissional precisa ter pelo menos 50 caracteres para informar as usuárias.");
        return false;
      }
    } else if (step === 3) {
      // Se já possui cadastro e arquivos enviados, não obriga o re-upload caso não altere
      if (!existingProfile) {
        if (!identityFile) {
          setError("O upload do documento de identidade é obrigatório para validação.");
          return false;
        }
        if (!certificateFile) {
          setError("O upload do certificado profissional é obrigatório.");
          return false;
        }
      }
    } else if (step === 4) {
      if (!femaleDeclaration) {
        setError("É obrigatório confirmar que se identifica como mulher para fazer parte deste santuário.");
        return false;
      }
      if (!acceptedTerms) {
        setError("Você precisa aceitar os termos de compromisso e responsabilidade técnica.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setError("");
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !validateStep()) return;

    setLoading(true);
    setError("");

    try {
      let finalPhotoUrl = photoPreview;
      let finalIdentityUrl = existingProfile?.identityUrl || "";
      let finalCertificateUrl = existingProfile?.certificateUrl || "";

      // 1. Upload da Foto de Perfil Pública se selecionada
      if (photoFile) {
        const photoRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
        await uploadBytes(photoRef, photoFile);
        finalPhotoUrl = await getDownloadURL(photoRef);
        // Atualizar auth da usuária
        await updateProfile(currentUser, { photoURL: finalPhotoUrl });
      }

      // 2. Upload de Documentos Privados de Identidade se selecionado
      if (identityFile) {
        const fileExt = identityFile.name.split(".").pop();
        const identityRef = ref(storage, `identity/${currentUser.uid}/doc_identidade.${fileExt}`);
        await uploadBytes(identityRef, identityFile);
        finalIdentityUrl = await getDownloadURL(identityRef);
      }

      // 3. Upload de Documento do Certificado / Registro se selecionado
      if (certificateFile) {
        const fileExt = certificateFile.name.split(".").pop();
        const certRef = ref(storage, `certificates/${currentUser.uid}/registro_profissional.${fileExt}`);
        await uploadBytes(certRef, certificateFile);
        finalCertificateUrl = await getDownloadURL(certRef);
      }

      // 4. Salvar ou atualizar os dados de Perfil Profissional
      const professionalData = {
        uid: currentUser.uid,
        displayName,
        email: currentUser.email,
        photoURL: finalPhotoUrl,
        specialty,
        licenseNumber,
        bio,
        priceRange: priceRange.trim() ? priceRange.trim() : null, // Opcional
        approvalStatus: "pending" as const, // Sempre resubmete para aprovação
        identityUrl: finalIdentityUrl,
        certificateUrl: finalCertificateUrl,
        averageRating: existingProfile?.averageRating || 0,
        totalReviews: existingProfile?.totalReviews || 0,
        createdAt: existingProfile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "professionals", currentUser.uid), professionalData);
      
      // Atualizar perfil da usuária geral para adicionar papel de profissional se pendente
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        role: "professional", // Define que agora o cadastro é de profissional
        updatedAt: new Date().toISOString()
      });

      setSuccess(true);
      setExistingProfile(professionalData);
      setTimeout(() => {
        router.push("/profile");
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setError("Houve um erro ao processar o seu cadastro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-quartz-400 animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Carregando formulário seguro...</p>
        </div>
      </div>
    );
  }

  // Se já possui cadastro aprovado
  if (existingProfile && existingProfile.approvalStatus === "approved") {
    return (
      <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between relative">
        <header className="px-6 lg:px-20 py-5 flex items-center justify-between border-b border-sand-100 bg-white/30 backdrop-blur-md sticky top-0 z-50">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-2xl font-light tracking-[0.1em] text-spa-dark">nefertiti</span>
            <div className="w-1.5 h-1.5 bg-quartz-300 rounded-full" />
          </Link>
          <Link href="/profile" className="text-xs font-bold uppercase tracking-widest text-spa-dark hover:text-quartz-500 transition-colors">
            Voltar ao Perfil
          </Link>
        </header>

        <main className="flex-grow flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white border border-sand-200/50 rounded-[2.5rem] p-8 sm:p-10 text-center shadow-lg">
            <div className="w-16 h-16 bg-olive-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-8 h-8 text-olive-500" />
            </div>
            <h2 className="font-serif text-3xl font-light text-spa-dark mb-4">Cadastro Aprovado!</h2>
            <p className="text-xs text-spa-light font-light leading-relaxed mb-6">
              Seu perfil de profissional foi devidamente verificado pelo administrador. Você já faz parte do ecossistema ativo de saúde Nefertiti de mulher para mulher.
            </p>
            <Link href={`/professionals/${currentUser?.uid}`} className="inline-block py-4 px-8 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-widest transition-all">
              Visualizar meu Perfil Público
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Se já possui cadastro em análise
  if (existingProfile && existingProfile.approvalStatus === "pending" && !success) {
    return (
      <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between relative">
        <header className="px-6 lg:px-20 py-5 flex items-center justify-between border-b border-sand-100 bg-white/30 backdrop-blur-md sticky top-0 z-50">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-2xl font-light tracking-[0.1em] text-spa-dark">nefertiti</span>
            <div className="w-1.5 h-1.5 bg-quartz-300 rounded-full" />
          </Link>
          <Link href="/profile" className="text-xs font-bold uppercase tracking-widest text-spa-dark hover:text-quartz-500 transition-colors">
            Voltar ao Perfil
          </Link>
        </header>

        <main className="flex-grow flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white border border-sand-200/50 rounded-[2.5rem] p-8 sm:p-10 text-center shadow-lg">
            <div className="w-16 h-16 bg-quartz-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Loader2 className="w-8 h-8 text-quartz-400 animate-spin" />
            </div>
            <h2 className="font-serif text-2xl font-light text-spa-dark mb-4">Cadastro em Análise</h2>
            <p className="text-xs text-spa-light font-light leading-relaxed mb-6">
              Obrigada por se cadastrar como profissional no Nefertiti. <br/>
              Nossos administradores estão verificando seus documentos de identidade e o seu diploma/registro de conselho. Você receberá uma notificação assim que seu perfil for aprovado para listagem de atendimento.
            </p>
            <div className="py-3 px-6 bg-sand-50 rounded-2xl border border-sand-100 inline-block text-[11px] text-spa-medium font-medium">
              Status Atual: <span className="text-quartz-500 uppercase tracking-wider font-bold">Em Revisão</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between relative overflow-hidden">
      {/* Blobs decorativos */}
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-quartz-100/40 rounded-full blur-[80px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-olive-100/35 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="px-6 lg:px-20 py-5 flex items-center justify-between border-b border-sand-100 bg-white/30 backdrop-blur-md sticky top-0 z-50">
        <Link href="/profile" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.15em]">Voltar ao Painel</span>
        </Link>
        <span className="font-serif text-xl font-light tracking-[0.1em] text-spa-dark hidden sm:inline-block">Santuário Profissional</span>
        <LanguageSelector />
      </header>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center px-4 py-12 z-10">
        <div className="w-full max-w-2xl bg-white/70 backdrop-blur-xl border border-sand-200/50 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_15px_40px_rgba(238,222,185,0.15)]">
          
          {/* Header do Formulário */}
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl font-light text-spa-dark mb-2">Credenciamento de Especialista</h2>
            <p className="text-xs text-spa-light font-light max-w-md mx-auto">
              {existingProfile?.approvalStatus === "rejected" 
                ? "Seu cadastro foi revisado e precisa de correções. Atualize os dados abaixo."
                : "Junte-se à nossa equipe boutique de saúde integrativa de mulher para mulher."}
            </p>
            {existingProfile?.approvalStatus === "rejected" && (
              <div className="mt-4 p-3 bg-quartz-50 border border-quartz-200/50 text-[11px] text-quartz-700 font-medium rounded-xl flex items-center gap-2 justify-center">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Cadastro recusado anteriormente. Por favor, reenvie documentos e informações válidas.</span>
              </div>
            )}
          </div>

          {/* Stepper Progress Bar */}
          <div className="mb-10 flex items-center justify-between px-2 sm:px-10">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center flex-grow last:flex-grow-0">
                <div className={`w-7 h-7 sm:w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                  step === num 
                    ? "bg-quartz-400 text-white shadow-md ring-4 ring-quartz-100" 
                    : step > num 
                      ? "bg-spa-dark text-white" 
                      : "bg-sand-100 text-spa-light"
                }`}>
                  {step > num ? <Check className="w-4 h-4" /> : num}
                </div>
                {num < 4 && (
                  <div className={`h-[2px] flex-grow mx-1 sm:mx-2 transition-colors duration-500 ${
                    step > num ? "bg-spa-dark" : "bg-sand-100"
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Mensagens de erro e sucesso */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-quartz-50 border border-quartz-200/50 text-xs text-quartz-700 font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-quartz-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-6 rounded-2xl bg-olive-50 border border-olive-200/40 text-center">
              <Check className="w-8 h-8 text-olive-500 mx-auto mb-2 animate-bounce" />
              <h4 className="font-serif text-lg font-light text-olive-900 mb-1">Cadastro Enviado com Sucesso!</h4>
              <p className="text-xs text-olive-700 font-light">
                O perfil foi enviado para análise. Redirecionando para a área logada...
              </p>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Passo 1: Informações Gerais */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-sand-100">
                    <UserIcon className="w-4 h-4 text-quartz-400" />
                    <h3 className="font-serif text-lg text-spa-dark font-light">Especialidade e Registro</h3>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5 ml-1">
                      Nome Profissional Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex: Dra. Marina Silva"
                      className="w-full px-4 py-3.5 bg-ivory/50 border border-sand-200 focus:border-quartz-300 focus:bg-white rounded-2xl text-xs text-spa-dark font-medium transition-all duration-300 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5 ml-1">
                        Área de Especialidade
                      </label>
                      <select
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full px-4 py-3.5 bg-ivory/50 border border-sand-200 focus:border-quartz-300 focus:bg-white rounded-2xl text-xs text-spa-dark font-medium transition-all duration-300 outline-none"
                      >
                        {specialties.map((spec) => (
                          <option key={spec.value} value={spec.value}>
                            {spec.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5 ml-1">
                        Registro Profissional (CRM/CRP/CRN)
                      </label>
                      <input
                        type="text"
                        required
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="Ex: CRM-SP 123456"
                        className="w-full px-4 py-3.5 bg-ivory/50 border border-sand-200 focus:border-quartz-300 focus:bg-white rounded-2xl text-xs text-spa-dark font-medium transition-all duration-300 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Passo 2: Perfil Público */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-sand-100">
                    <Award className="w-4 h-4 text-quartz-400" />
                    <h3 className="font-serif text-lg text-spa-dark font-light">Apresentação e Consultas</h3>
                  </div>

                  {/* Foto de Perfil Profissional */}
                  <div className="flex flex-col sm:flex-row items-center gap-5 bg-sand-50/50 p-4 rounded-2xl border border-sand-100">
                    <div className="relative w-16 h-16 rounded-full bg-sand-100 border border-sand-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Foto de perfil" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-6 h-6 text-spa-light" />
                      )}
                    </div>
                    <div className="flex-grow text-center sm:text-left">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1">
                        Foto de Perfil Profissional
                      </p>
                      <p className="text-[10px] text-spa-medium font-light mb-2">
                        Formatos JPEG/PNG. Será comprimida automaticamente.
                      </p>
                      <label className="inline-flex items-center gap-2 py-2 px-4 bg-white border border-sand-200 rounded-xl text-[10px] font-bold uppercase tracking-wider text-spa-dark hover:bg-ivory cursor-pointer transition-all">
                        <Upload className="w-3.5 h-3.5" />
                        Escolher Foto
                        <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light ml-1">
                        Biografia Profissional (Mini-currículo)
                      </label>
                      <span className="text-[10px] text-spa-light">{bio.length}/500</span>
                    </div>
                    <textarea
                      required
                      maxLength={500}
                      rows={5}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Fale um pouco sobre a sua abordagem clínica integrativa, especializações e filosofia de atendimento feminino..."
                      className="w-full px-4 py-3.5 bg-ivory/50 border border-sand-200 focus:border-quartz-300 focus:bg-white rounded-2xl text-xs text-spa-dark font-light leading-relaxed transition-all duration-300 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-widest text-spa-light mb-1.5 ml-1">
                      Valores de Atendimento <span className="text-[10px] text-spa-light font-normal lowercase italic">(opcional)</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-spa-light" />
                      <input
                        type="text"
                        value={priceRange}
                        onChange={(e) => setPriceRange(e.target.value)}
                        placeholder="Ex: R$ 250 - R$ 400 por consulta (ou deixe em branco)"
                        className="w-full pl-12 pr-5 py-3.5 bg-ivory/50 border border-sand-200 focus:border-quartz-300 focus:bg-white rounded-2xl text-xs text-spa-dark font-medium transition-all duration-300 outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-spa-light font-light mt-1.5 ml-1">
                      Se deixado em branco, seu perfil exibirá "Valores sob consulta".
                    </p>
                  </div>
                </div>
              )}

              {/* Passo 3: Upload de Documentos */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-sand-100">
                    <FileText className="w-4 h-4 text-quartz-400" />
                    <h3 className="font-serif text-lg text-spa-dark font-light">Documentos para Verificação</h3>
                  </div>
                  
                  <div className="p-4 bg-sand-50 rounded-2xl border border-sand-100/50 flex gap-3">
                    <ShieldCheck className="w-5 h-5 text-quartz-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-spa-medium font-light leading-relaxed">
                      Seus documentos de identificação civil e registro profissional são estritamente confidenciais. Eles serão salvos em um local seguro de acesso administrativo para atestar sua identidade e autoridade técnica.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Documento de Identidade */}
                    <div className="border border-sand-200/80 rounded-2xl p-4 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-spa-dark uppercase tracking-wider">Documento de Identidade</h4>
                        <p className="text-[10px] text-spa-light font-light mt-0.5">RG, CNH ou Passaporte com foto e nome legíveis.</p>
                      </div>
                      <label className="flex items-center gap-2 py-2.5 px-4 bg-ivory hover:bg-sand-50 border border-sand-200 rounded-xl text-[10px] font-bold uppercase tracking-wider text-spa-dark cursor-pointer transition-all">
                        <Upload className="w-3.5 h-3.5" />
                        {identityFile ? "Alterar Arquivo" : "Enviar Documento"}
                        <input
                          type="file"
                          required={!existingProfile}
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && file.size > 5 * 1024 * 1024) {
                              setError("O documento de identidade excede o limite máximo de 5MB.");
                              e.target.value = "";
                              setIdentityFile(null);
                            } else {
                              setIdentityFile(file || null);
                              setError("");
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {identityFile && (
                      <div className="text-[10px] text-olive-600 font-semibold px-4 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Selecionado: {identityFile.name}
                      </div>
                    )}

                    {/* Certificado Profissional */}
                    <div className="border border-sand-200/80 rounded-2xl p-4 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-spa-dark uppercase tracking-wider">Certificado / Diploma de Formação</h4>
                        <p className="text-[10px] text-spa-light font-light mt-0.5">Diploma de formação ou carteira de conselho profissional ativo.</p>
                      </div>
                      <label className="flex items-center gap-2 py-2.5 px-4 bg-ivory hover:bg-sand-50 border border-sand-200 rounded-xl text-[10px] font-bold uppercase tracking-wider text-spa-dark cursor-pointer transition-all">
                        <Upload className="w-3.5 h-3.5" />
                        {certificateFile ? "Alterar Arquivo" : "Enviar Diploma"}
                        <input
                          type="file"
                          required={!existingProfile}
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && file.size > 5 * 1024 * 1024) {
                              setError("O certificado/diploma excede o limite máximo de 5MB.");
                              e.target.value = "";
                              setCertificateFile(null);
                            } else {
                              setCertificateFile(file || null);
                              setError("");
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {certificateFile && (
                      <div className="text-[10px] text-olive-600 font-semibold px-4 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Selecionado: {certificateFile.name}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Passo 4: Autodeclaração e Envio */}
              {step === 4 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-sand-100">
                    <Heart className="w-4 h-4 text-quartz-400" />
                    <h3 className="font-serif text-lg text-spa-dark font-light">Declaração de Compromisso</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Exclusividade Feminina */}
                    <label className="flex items-start gap-3 p-4 bg-quartz-50/30 border border-quartz-100 rounded-2xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={femaleDeclaration}
                        onChange={(e) => setFemaleDeclaration(e.target.checked)}
                        className="mt-0.5 accent-quartz-400"
                      />
                      <div className="-mt-0.5">
                        <h4 className="text-xs font-bold text-spa-dark uppercase tracking-wider">Identidade de Gênero Feminina</h4>
                        <p className="text-[11px] text-spa-medium font-light leading-relaxed mt-1">
                          Declaro e atesto que me identifico como mulher. Entendo que o Nefertiti é um ambiente e santuário digital exclusivo de atendimento médico e terapêutico <strong>de mulher para mulher</strong>.
                        </p>
                      </div>
                    </label>

                    {/* Aceite dos Termos Gerais */}
                    <label className="flex items-start gap-3 p-4 bg-sand-50/30 border border-sand-100 rounded-2xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 accent-spa-dark"
                      />
                      <div className="-mt-0.5">
                        <h4 className="text-xs font-bold text-spa-dark uppercase tracking-wider">Responsabilidade Técnica</h4>
                        <p className="text-[11px] text-spa-medium font-light leading-relaxed mt-1">
                          Assumo integral responsabilidade pela autenticidade dos documentos enviados e pela conduta ética e técnica no atendimento das pacientes, respeitando a legislação profissional correspondente.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex justify-between pt-6 border-t border-sand-100 mt-8">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={loading}
                    className="flex items-center gap-2 py-3 px-6 border border-sand-200 rounded-full text-xs font-bold uppercase tracking-widest text-spa-dark hover:bg-sand-50 transition-all disabled:opacity-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar
                  </button>
                ) : (
                  <div />
                )}

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-2 py-3 px-8 bg-spa-dark text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-quartz-400 transition-all cursor-pointer"
                  >
                    Avançar
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2.5 py-4 px-10 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md hover:shadow-lg disabled:bg-sand-300 disabled:shadow-none transition-all duration-300 cursor-pointer"
                  >
                    {loading ? (
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      "Concluir Credenciamento"
                    )}
                  </button>
                )}
              </div>

            </form>
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
