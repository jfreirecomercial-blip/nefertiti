"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  setDoc,
  updateDoc
} from "firebase/firestore";
import { 
  ArrowLeft, 
  Star, 
  User as UserIcon, 
  DollarSign, 
  Calendar, 
  ShieldCheck, 
  CheckCircle,
  MessageSquare,
  Sparkles,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";

export default function ProfessionalProfileDetailPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [professional, setProfessional] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Verification for review
  const [hasCompletedAppointment, setHasCompletedAppointment] = useState(false);
  const [checkingAppointment, setCheckingAppointment] = useState(false);
  const [userAlreadyReviewed, setUserAlreadyReviewed] = useState(false);
  
  // Write Review Form
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [error, setError] = useState("");

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
    if (id) {
      fetchProfessionalData();
    }
  }, [id]);

  useEffect(() => {
    if (currentUser && id) {
      checkAppointmentAndReviews();
    }
  }, [currentUser, id]);

  const fetchProfessionalData = async () => {
    setLoading(true);
    try {
      // 1. Obter perfil da profissional
      const docSnap = await getDoc(doc(db, "professionals", id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.approvalStatus === "approved") {
          setProfessional(data);
        } else {
          setProfessional(null); // Bloqueado se não aprovado
        }
      } else {
        setProfessional(null);
      }

      // 2. Obter avaliações
      const reviewsQ = query(
        collection(db, "reviews"), 
        where("professionalId", "==", id)
      );
      const reviewsSnap = await getDocs(reviewsQ);
      const reviewsList = reviewsSnap.docs.map(doc => doc.data());
      setReviews(reviewsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    } catch (err) {
      console.error("Erro ao carregar perfil e avaliações:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkAppointmentAndReviews = async () => {
    if (!currentUser || !id) return;
    setCheckingAppointment(true);
    try {
      // 1. Verificar se a usuária já escreveu uma avaliação para esta profissional
      const reviewsQ = query(
        collection(db, "reviews"),
        where("professionalId", "==", id),
        where("authorId", "==", currentUser.uid)
      );
      const reviewSnap = await getDocs(reviewsQ);
      if (!reviewSnap.empty) {
        setUserAlreadyReviewed(true);
      }

      // 2. Verificar se a usuária tem uma consulta concluída com ela
      const appQ = query(
        collection(db, "appointments"),
        where("userId", "==", currentUser.uid),
        where("professionalId", "==", id),
        where("status", "==", "completed")
      );
      const appSnap = await getDocs(appQ);
      if (!appSnap.empty) {
        setHasCompletedAppointment(true);
      }
    } catch (err) {
      console.error("Erro ao validar permissões de avaliação:", err);
    } finally {
      setCheckingAppointment(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !id || !hasCompletedAppointment || userAlreadyReviewed) return;

    setSubmittingReview(true);
    setError("");

    try {
      // Obter o Token JWT do Firebase Auth da usuária logada (SEC-05)
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          professionalId: id,
          rating: Number(rating),
          comment: comment.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Falha na resposta do servidor.");
      }

      const resData = await res.json();
      const newReview = resData.review;
      const averageRating = resData.averageRating;
      const totalReviews = resData.totalReviews;

      // Atualizar estado
      setReviews([newReview, ...reviews]);
      setProfessional((prev: any) => prev ? { ...prev, averageRating, totalReviews } : null);
      setUserAlreadyReviewed(true);
      setReviewSuccess(true);
      setComment("");
    } catch (err: any) {
      console.error("Erro ao registrar avaliação:", err);
      setError("Não foi possível enviar a avaliação: " + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-quartz-400 animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Carregando santuário...</p>
        </div>
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="min-h-screen bg-ivory bg-grain flex flex-col justify-between items-center p-6 text-center">
        <div className="my-auto max-w-md bg-white border border-sand-200 rounded-[2.5rem] p-8 sm:p-10 shadow-md">
          <AlertCircle className="w-12 h-12 text-quartz-400 mx-auto mb-6" />
          <h2 className="font-serif text-3xl font-light text-spa-dark mb-4">Perfil não Encontrado</h2>
          <p className="text-xs text-spa-light font-light leading-relaxed mb-8">
            O perfil profissional procurado não existe ou ainda não foi aprovado pelo conselho administrativo de moderação.
          </p>
          <Link href="/profile" className="inline-block py-3 px-8 bg-spa-dark text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-quartz-400 transition-colors">
            Voltar ao Painel
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
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-quartz-100/30 rounded-full blur-[90px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] bg-olive-100/30 rounded-full blur-[110px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="px-6 lg:px-20 py-5 flex items-center justify-between border-b border-sand-100 bg-white/30 backdrop-blur-md sticky top-0 z-50">
        <Link href="/profile" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.15em]">Voltar</span>
        </Link>
        <span className="font-serif text-xl font-light tracking-[0.1em] text-spa-dark hidden sm:inline-block">Nefertiti Health</span>
        <LanguageSelector />
      </header>

      {/* Main Grid */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-6 py-12 z-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Coluna Esquerda: Cartão da Profissional */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-sand-200/50 rounded-[2.5rem] p-6 text-center shadow-sm relative overflow-hidden">
            
            <div className="absolute top-0 right-0 bg-quartz-100 text-quartz-600 p-2.5 rounded-bl-[1.5rem] flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-quartz-400 text-quartz-400" />
              <span className="text-[10px] font-bold tracking-wider">{professional.averageRating || "N/A"}</span>
            </div>

            <div className="w-24 h-24 rounded-full bg-sand-100 border-2 border-quartz-200/40 overflow-hidden mx-auto mb-4 flex items-center justify-center">
              {professional.photoURL ? (
                <img src={professional.photoURL} alt={professional.displayName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-8 h-8 text-spa-light" />
              )}
            </div>

            <h2 className="font-serif text-2xl font-light text-spa-dark mb-1">{professional.displayName}</h2>
            <p className="text-[10px] uppercase font-bold tracking-widest text-quartz-500 mb-4">
              {specialtyLabels[professional.specialty] || professional.specialty}
            </p>
            <div className="w-8 h-[1px] bg-sand-200 mx-auto mb-4" />

            <p className="text-[11px] text-spa-light font-light leading-relaxed mb-6">
              Reg. Conselho: <span className="font-medium text-spa-dark">{professional.licenseNumber}</span>
            </p>

            <div className="bg-sand-50/50 p-4 rounded-2xl border border-sand-100/50 flex items-center justify-center gap-2">
              <DollarSign className="w-4 h-4 text-spa-light" />
              <span className="text-xs text-spa-dark font-medium">
                {professional.priceRange || "Valores sob consulta"}
              </span>
            </div>

            <button 
              onClick={() => alert("Consulta agendada - Fluxo em desenvolvimento")}
              className="w-full mt-6 py-4 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.15em] hover:shadow-lg transition-all"
            >
              Agendar Teleconsulta
            </button>
          </div>

          <div className="bg-white/70 backdrop-blur-md border border-sand-200/50 rounded-[2rem] p-5 flex gap-3 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-olive-500 flex-shrink-0" />
            <p className="text-[10px] text-spa-medium font-light leading-relaxed">
              Esta especialista passou por um rígido processo de credenciamento e verificação de diploma clínico de mulher para mulher.
            </p>
          </div>
        </div>

        {/* Coluna Direita: Bio, Avaliações e Formulário */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Apresentação / Bio */}
          <div className="bg-white/80 backdrop-blur-md border border-sand-200/50 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="font-serif text-xl font-light text-spa-dark mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-quartz-400" />
              Sobre a Especialista
            </h3>
            <p className="text-xs sm:text-sm text-spa-medium font-light leading-relaxed whitespace-pre-wrap">
              {professional.bio}
            </p>
          </div>

          {/* Seção de Avaliações */}
          <div className="bg-white/80 backdrop-blur-md border border-sand-200/50 rounded-[2.5rem] p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-sand-100 pb-4">
              <h3 className="font-serif text-xl font-light text-spa-dark flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-quartz-400" />
                Avaliações e Depoimentos
              </h3>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-spa-dark">{professional.totalReviews} depoimentos</span>
              </div>
            </div>

            {/* Listagem de Reviews */}
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <p className="text-xs text-spa-light font-light italic py-4">
                  Ainda não há avaliações de pacientes registradas para esta profissional.
                </p>
              ) : (
                reviews.map((rev) => (
                  <div key={rev.id} className="p-4 bg-sand-50/50 rounded-2xl border border-sand-100/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-sand-200 flex items-center justify-center text-[10px] font-bold text-spa-dark">
                          {rev.authorName.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-spa-dark">{rev.authorName}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`w-3 h-3 ${star <= rev.rating ? "fill-quartz-400 text-quartz-400" : "text-sand-200"}`} 
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-spa-medium font-light leading-relaxed">
                      {rev.comment}
                    </p>
                    <span className="block text-[9px] text-spa-light text-right">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Formulário de Envio de Avaliação */}
            {currentUser && (
              <div className="pt-6 border-t border-sand-100">
                {checkingAppointment ? (
                  <div className="flex items-center gap-2 text-xs text-spa-light">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verificando elegibilidade para avaliação...</span>
                  </div>
                ) : hasCompletedAppointment ? (
                  userAlreadyReviewed ? (
                    <div className="p-4 bg-olive-50/40 border border-olive-100 rounded-2xl text-xs text-olive-800 font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-olive-500" />
                      <span>Você já enviou o seu depoimento para esta especialista. Obrigada por sua participação!</span>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitReview} className="space-y-4 bg-sand-50/20 p-5 rounded-[2rem] border border-sand-200/50">
                      <h4 className="font-serif text-sm text-spa-dark">Deixar meu depoimento de consulta</h4>
                      
                      {error && (
                        <div className="p-3 bg-quartz-50 border border-quartz-200/50 text-[11px] text-quartz-700 font-medium rounded-xl">
                          {error}
                        </div>
                      )}

                      {reviewSuccess && (
                        <div className="p-3 bg-olive-50 border border-olive-200/40 text-[11px] text-olive-800 font-medium rounded-xl">
                          Sua avaliação foi publicada!
                        </div>
                      )}

                      {/* Seleção de Estrelas */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-spa-light">Sua nota:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRating(star)}
                              className="focus:outline-none p-1"
                            >
                              <Star className={`w-5 h-5 transition-colors ${star <= rating ? "fill-quartz-400 text-quartz-400" : "text-sand-200 hover:text-quartz-200"}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Texto do Comentário */}
                      <textarea
                        required
                        maxLength={250}
                        rows={3}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Compartilhe como foi a sua experiência com a especialista..."
                        className="w-full p-3.5 bg-white border border-sand-200 focus:border-quartz-300 rounded-2xl text-xs text-spa-dark font-light leading-relaxed outline-none resize-none"
                      />

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={submittingReview}
                          className="py-3 px-6 bg-spa-dark text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-quartz-400 transition-all cursor-pointer"
                        >
                          {submittingReview ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Publicar Avaliação"
                          )}
                        </button>
                      </div>
                    </form>
                  )
                ) : (
                  <div className="p-4 bg-sand-50 rounded-2xl border border-sand-100/50 flex items-start gap-2.5">
                    <AlertCircle className="w-4.5 h-4.5 text-spa-light flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-spa-light font-light leading-relaxed">
                      Avaliações neste santuário são permitidas apenas para pacientes com consultas devidamente concluídas e registradas com esta profissional no prontuário.
                    </p>
                  </div>
                )}
              </div>
            )}
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
