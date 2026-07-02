"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  where,
  increment,
  setDoc,
  onSnapshot
} from "firebase/firestore";
import { 
  Heart, 
  MessageSquare, 
  Image as ImageIcon, 
  X, 
  Send, 
  User as UserIcon, 
  Sparkles, 
  Clock, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Flag,
  Users,
  Compass,
  UserPlus,
  Loader2,
  ExternalLink,
  Plus,
  Globe,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { compressImage } from "@/lib/image-compression";

interface Post {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  content: string;
  photos: string[];
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  translations?: Record<string, string>;
  detectedLanguage?: string;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: Date;
}

interface CommunityItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  memberCount: number;
}

interface FriendProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
}

export default function SocialPage() {
  const { t } = useLanguage();
  const router = useRouter();

  // Auth & Profile
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Post states
  const [content, setContent] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  
  // Feed states
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'feed' | 'communities' | 'friends'>('feed');

  // Communities tab state
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);

  // Friends tab state
  const [friendsSummary, setFriendsSummary] = useState<FriendProfile[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [friendsTabLoading, setFriendsTabLoading] = useState(false);

  // New members state (Método B)
  const [newMembers, setNewMembers] = useState<any[]>([]);
  const [newMembersLoading, setNewMembersLoading] = useState(false);
  const [addingFriendUid, setAddingFriendUid] = useState<string | null>(null);

  // Check auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        // Buscar se o usuário é administrador ou parceiro
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.role === "partner") {
              router.push("/dashboard/partner");
              return;
            }
            setIsAdmin(userData.role === "admin");
          }
        } catch (err) {
          console.error("Erro ao carregar dados do usuário:", err);
        }
        loadFeed();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Report states
  const [reportingPost, setReportingPost] = useState<Post | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("inappropriate");
  const [reportDetails, setReportDetails] = useState("");
  const [reportingSubmitting, setReportingSubmitting] = useState(false);

  // Load posts
  async function loadFeed() {
    setFeedLoading(true);
    setErrorMessage("");
    try {
      const postsRef = collection(db, "social_posts");
      const q = query(postsRef, orderBy("createdAt", "desc"), limit(20));
      const querySnapshot = await getDocs(q);
      
      const loadedPosts: Post[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filtrar posts suspensos no lado do cliente para evitar necessidade de índices compostos complexos no Firebase
        if (data.status === "suspended") return;
        
        loadedPosts.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName || "Membro Nefertiti",
          userPhoto: data.userPhoto,
          content: data.content || "",
          photos: data.photos || [],
          likesCount: data.likesCount || 0,
          commentsCount: data.commentsCount || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          translations: data.translations || {},
          detectedLanguage: data.detectedLanguage || "",
        });
      });
      
      setPosts(loadedPosts);
    } catch (err: unknown) {
      console.error("Erro ao carregar feed:", err);
      setErrorMessage("Não foi possível carregar as publicações. Certifique-se de que a coleção exista.");
    } finally {
      setFeedLoading(false);
    }
  }

  // Handle post report action
  const handleReportPost = async () => {
    if (!reportingPost || !user) return;
    setReportingSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      // 1. Criar denúncia na coleção 'reports'
      const reportsRef = collection(db, "reports");
      await addDoc(reportsRef, {
        postId: reportingPost.id,
        postContent: reportingPost.content || "",
        postAuthorId: reportingPost.userId,
        postAuthorName: reportingPost.userName,
        reporterId: user.uid,
        reporterName: user.displayName || "Membro",
        reason: reportReason,
        details: reportDetails.trim(),
        status: "pending",
        createdAt: new Date().toISOString()
      });

      // 2. Definir status do post como suspenso
      const postRef = doc(db, "social_posts", reportingPost.id);
      await updateDoc(postRef, {
        status: "suspended",
        updatedAt: new Date().toISOString()
      });

      // 3. Criar notificação para a autora do post em 'notifications'
      const notificationsRef = collection(db, "notifications");
      await addDoc(notificationsRef, {
        userId: reportingPost.userId,
        type: "post_suspended",
        title: "Relato em Avaliação",
        message: "Um de seus relatos foi suspenso temporariamente após denúncias e está sob análise da nossa equipe de moderação.",
        postId: reportingPost.id,
        read: false,
        createdAt: new Date().toISOString()
      });

      setSuccessMessage("O relato foi denunciado e suspenso temporariamente para análise.");
      setShowReportModal(false);
      setReportingPost(null);
      setReportReason("inappropriate");
      setReportDetails("");
      loadFeed();
    } catch (err: unknown) {
      console.error("Erro ao denunciar postagem:", err);
      setErrorMessage("Erro ao enviar denúncia: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setReportingSubmitting(false);
    }
  };

  // Handle image selections (up to 10 photos)
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const filesArray = Array.from(files);
    
    // Verificar se alguma foto excede o limite de 10MB
    const hasLargeFile = filesArray.some(file => file.size > 10 * 1024 * 1024);
    if (hasLargeFile) {
      alert(t("social.photoSizeLimitError") || "Uma ou mais fotos selecionadas excedem o limite máximo de 10MB.");
      return;
    }

    // Verificar limite máximo de 10 fotos no total
    if (selectedPhotos.length + filesArray.length > 10) {
      alert(t("social.limitExceeded") || "Limite máximo de 10 fotos atingido por relato.");
      return;
    }

    const newPhotos = [...selectedPhotos, ...filesArray];
    setSelectedPhotos(newPhotos);

    // Gerar previews locais
    const newPreviews = filesArray.map(file => URL.createObjectURL(file));
    setPhotoPreviews([...photoPreviews, ...newPreviews]);
  };

  // Remove selected photo
  const removeSelectedPhoto = (index: number) => {
    const newPhotos = [...selectedPhotos];
    newPhotos.splice(index, 1);
    setSelectedPhotos(newPhotos);

    const newPreviews = [...photoPreviews];
    // Limpar o objeto URL para economizar memória
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPhotoPreviews(newPreviews);
  };

  // Submit Post
  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!content.trim() && selectedPhotos.length === 0)) return;

    setPublishing(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const base64Photos: string[] = [];

      // 1. Comprimir e converter fotos para base64
      if (selectedPhotos.length > 0) {
        const compressionPromises = selectedPhotos.map(async (file) => {
          const compressedFile = await compressImage(file, {
            maxDimension: 1200,
            initialQuality: 0.75,
            maxSizeBytes: 250 * 1024
          });

          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(compressedFile);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
          });
        });

        const base64Results = await Promise.all(compressionPromises);
        base64Photos.push(...base64Results);
      }

      // 2. Enviar para API de moderação e criação de posts
      const idToken = await user.getIdToken();
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          content: content,
          photos: base64Photos,
          userName: user.displayName || "Membro Nefertiti",
          userPhoto: user.photoURL || null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao publicar relato.");
      }

      // Limpar formulário
      setContent("");
      setSelectedPhotos([]);
      photoPreviews.forEach(url => URL.revokeObjectURL(url));
      setPhotoPreviews([]);

      setSuccessMessage(t("social.postSuccess") || "Relato publicado no santuário com sucesso!");
      loadFeed(); // Atualizar Feed
    } catch (err: unknown) {
      console.error("Erro ao publicar post:", err);
      setErrorMessage((err as Error).message || "Erro ao publicar.");
    } finally {
      setPublishing(false);
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!confirm("Tem certeza de que deseja excluir este relato?")) return;
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await deleteDoc(doc(db, "social_posts", postId));
      setPosts(prev => prev.filter(p => p.id !== postId));
      setSuccessMessage("Relato excluído com sucesso.");
    } catch (err: unknown) {
      console.error("Erro ao excluir relato:", err);
      setErrorMessage("Erro ao excluir: " + (err as Error).message);
    }
  };

  // Edit Post
  const handleEditPost = async (postId: string, newContent: string) => {
    if (!user) return false;
    setErrorMessage("");
    setSuccessMessage("");
    try {
      // 1. Chamar API de moderação de texto
      const idToken = await user.getIdToken();
      const res = await fetch("/api/social/posts/moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ content: newContent })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Conteúdo impróprio detectado.");
      }

      // 2. Atualizar no Firestore
      await updateDoc(doc(db, "social_posts", postId), {
        content: newContent
      });

      setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: newContent } : p));
      setSuccessMessage("Relato editado com sucesso.");
      return true;
    } catch (err: unknown) {
      console.error("Erro ao editar relato:", err);
      setErrorMessage("Erro ao editar: " + (err as Error).message);
      return false;
    }
  };

  /* ═══════════════════════════════════════════════
     Tab data loaders
     ═══════════════════════════════════════════════ */

  /** Load communities for the "Comunidades" tab. */
  const loadCommunities = useCallback(async () => {
    setCommunitiesLoading(true);
    try {
      const commRef = collection(db, "communities");
      const q = query(commRef, orderBy("createdAt", "desc"), limit(6));
      const snap = await getDocs(q);
      const items: CommunityItem[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.name || "Comunidade",
          description: data.description,
          category: data.category,
          memberCount: data.memberCount || 0,
        });
      });
      setCommunities(items);
    } catch (err) {
      console.error("Erro ao carregar comunidades:", err);
    } finally {
      setCommunitiesLoading(false);
    }
  }, []);

  /** Load friends summary for the "Amigas" tab. */
  const loadFriendsSummary = useCallback(async () => {
    if (!user) return;
    setFriendsTabLoading(true);
    try {
      const friendshipsRef = collection(db, "friendships");

      // Count accepted friends
      const acceptedQ = query(
        friendshipsRef,
        where("users", "array-contains", user.uid),
        where("status", "==", "accepted")
      );
      const acceptedSnap = await getDocs(acceptedQ);
      setFriendsCount(acceptedSnap.size);

      // Load first 6 friend profiles
      const friendProfiles: FriendProfile[] = [];
      const docsToLoad = acceptedSnap.docs.slice(0, 6);
      for (const docSnap of docsToLoad) {
        const data = docSnap.data();
        const friendId = (data.users as string[]).find((uid) => uid !== user.uid) || "";
        try {
          const friendDoc = await getDoc(doc(db, "users", friendId));
          const friendData = friendDoc.exists() ? friendDoc.data() : {};
          friendProfiles.push({
            uid: friendId,
            displayName: friendData.displayName || "Membro",
            photoURL: friendData.photoURL,
          });
        } catch {
          friendProfiles.push({ uid: friendId, displayName: "Membro" });
        }
      }
      setFriendsSummary(friendProfiles);

      // Count pending requests (where user is receiver)
      const pendingQ = query(
        friendshipsRef,
        where("users", "array-contains", user.uid),
        where("status", "==", "pending")
      );
      const pendingSnap = await getDocs(pendingQ);
      let pendingIncoming = 0;
      pendingSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.senderId !== user.uid) pendingIncoming++;
      });
      setPendingCount(pendingIncoming);
    } catch (err) {
      console.error("Erro ao carregar resumo de amigas:", err);
    } finally {
      setFriendsTabLoading(false);
    }
  }, [user]);

  /** Load recently registered users who opted in to share arrival. */
  const loadNewMembers = useCallback(async () => {
    if (!user) return;
    setNewMembersLoading(true);
    try {
      const socialRef = collection(db, "social_profiles");
      const q = query(socialRef, orderBy("createdAt", "desc"), limit(20));
      const snap = await getDocs(q);
      
      const loaded: any[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (docSnap.id === user.uid) return; // ignore self
        if (data.shareArrival === false) return; // ignore opted-out

        loaded.push({
          uid: docSnap.id,
          displayName: data.displayName || "Membro",
          photoURL: data.photoURL || "",
          city: data.city || "",
          state: data.state || "",
        });
      });
      setNewMembers(loaded.slice(0, 5));
    } catch (err) {
      console.error("Erro ao carregar novas membras:", err);
    } finally {
      setNewMembersLoading(false);
    }
  }, [user]);

  /** Quick add friend from new members banner */
  const handleAddFriendFromBanner = async (targetUid: string, targetName: string) => {
    if (!user) return;
    setAddingFriendUid(targetUid);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      // Check if relationship already exists
      const friendshipsRef = collection(db, "friendships");
      const q = query(friendshipsRef, where("users", "array-contains", user.uid));
      const snap = await getDocs(q);
      let alreadyExists = false;
      snap.forEach((d) => {
        if (d.data().users.includes(targetUid)) {
          alreadyExists = true;
        }
      });

      if (alreadyExists) {
        setErrorMessage("Já existe uma solicitação ou amizade com esta usuária.");
        setTimeout(() => setErrorMessage(""), 4000);
        return;
      }

      await addDoc(collection(db, "friendships"), {
        users: [user.uid, targetUid],
        status: "pending",
        senderId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSuccessMessage(`Pedido de amizade enviado para ${targetName}!`);
      setTimeout(() => setSuccessMessage(""), 4000);
      
      // Remove from newMembers list locally
      setNewMembers((prev) => prev.filter((m) => m.uid !== targetUid));
    } catch (err) {
      console.error("Erro ao adicionar amiga:", err);
      setErrorMessage("Erro ao enviar pedido de amizade.");
      setTimeout(() => setErrorMessage(""), 4000);
    } finally {
      setAddingFriendUid(null);
    }
  };

  // Load tab data when switching tabs
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "feed" && user) {
        loadNewMembers();
      }
      if (activeTab === "communities" && communities.length === 0) {
        loadCommunities();
      }
      if (activeTab === "friends" && friendsSummary.length === 0 && friendsCount === 0) {
        loadFriendsSummary();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab, communities.length, friendsSummary.length, friendsCount, loadCommunities, loadFriendsSummary, loadNewMembers, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Carregando painel social...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory bg-grain text-spa-dark pb-20">
      
      {/* Background Blobs */}
      <div className="absolute top-0 left-[-10%] w-[500px] h-[500px] bg-quartz-100/20 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute bottom-0 right-[-10%] w-[450px] h-[450px] bg-olive-100/25 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-ivory/85 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <Link href="/profile" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">{t("nav.dashboard") || "Painel"}</span>
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSelector />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-12 space-y-8">
        
        {/* Social Heading */}
        <div className="text-center">
          <span className="text-[9px] bg-quartz-50 text-quartz-600 font-bold px-3 py-1 rounded-full border border-quartz-200 uppercase tracking-widest inline-block mb-3">
            Espaço de Relatos
          </span>
          <h2 className="font-serif text-3xl font-light text-spa-dark tracking-wide">
            Círculo de Partilha
          </h2>
          <p className="text-xs text-spa-light font-light max-w-md mx-auto mt-2 leading-relaxed">
            Compartilhe relatos de autocuidado, ciclos, flutuações hormonais ou bem-estar com outros membros de forma segura e acolhedora.
          </p>
        </div>

        {/* ═══════════════════════════════════════
           Tab Navigation
           ═══════════════════════════════════════ */}
        <div className="flex justify-center">
          <div className="flex gap-0.5 sm:gap-1 bg-sand-50/80 p-1 rounded-full border border-sand-200/50 w-fit">
            {([
              { key: 'feed' as const, label: 'Círculo', icon: Heart },
              { key: 'communities' as const, label: 'Comunidades', icon: Compass },
              { key: 'friends' as const, label: 'Amigas', icon: Users },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3 py-2 sm:px-5 sm:py-2.5 text-[11px] sm:text-xs font-medium transition-all cursor-pointer ${
                  activeTab === key
                    ? 'bg-white text-spa-dark shadow-sm font-bold'
                    : 'text-spa-medium hover:text-spa-dark'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                {key === 'friends' && pendingCount > 0 && (
                  <span className="w-4 h-4 flex items-center justify-center bg-quartz-400 text-white text-[8px] font-bold rounded-full leading-none">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════
           TAB: Feed (Círculo) — existing functionality
           ═══════════════════════════════════════ */}
        {activeTab === 'feed' && (
          <>
            {/* Notifications */}
            {errorMessage && (
              <div className="p-4 bg-quartz-50 border border-quartz-200/50 rounded-2xl text-xs text-spa-dark">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-olive-50 border border-olive-200/30 rounded-2xl text-xs text-olive-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-olive-500" />
                {successMessage}
              </div>
            )}

            {/* Painel de Boas-vindas a Novas Membras (Método B) */}
            {newMembers.length > 0 && !newMembersLoading && (
              <div className="bg-gradient-to-r from-lavender-50/50 to-quartz-50/30 border border-lavender-200/60 rounded-[2.2rem] p-6 shadow-sm space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lavender-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-lavender-500"></span>
                    </span>
                    <h3 className="font-serif text-sm text-spa-dark font-semibold">
                      Novas Membras no Santuário
                    </h3>
                  </div>
                  <span className="text-[9px] uppercase tracking-widest text-lavender-600 font-bold bg-lavender-100/50 px-2 py-0.5 rounded-full border border-lavender-200">
                    Boas-vindas
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {newMembers.map((member) => (
                    <div 
                      key={member.uid}
                      className="flex items-center justify-between gap-3 p-3 bg-white/80 border border-sand-100 rounded-2xl shadow-sm hover:border-lavender-200 transition-all group animate-[fadeIn_0.3s_ease]"
                    >
                      <Link 
                        href={`/social/profile/${member.uid}`}
                        className="flex items-center gap-2 min-w-0"
                      >
                        {member.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={member.photoURL} 
                            alt={member.displayName}
                            className="w-8 h-8 rounded-full object-cover border border-sand-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400">
                            <UserIcon className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-spa-dark truncate group-hover:text-lavender-600 transition-colors">
                            {member.displayName.split(" ")[0]}
                          </p>
                          {(member.city || member.state) && (
                            <p className="text-[8px] text-spa-light font-medium truncate">
                              {member.city}{member.city && member.state && ", "}{member.state}
                            </p>
                          )}
                        </div>
                      </Link>
                      
                      <button
                        onClick={() => handleAddFriendFromBanner(member.uid, member.displayName)}
                        disabled={addingFriendUid === member.uid}
                        className="p-1.5 bg-lavender-50 hover:bg-lavender-100 border border-lavender-200/50 text-lavender-600 rounded-full transition-all shrink-0 cursor-pointer disabled:opacity-50"
                        title="Enviar Pedido de Amizade"
                      >
                        {addingFriendUid === member.uid ? (
                          <Loader2 className="w-3 h-3 animate-spin text-lavender-500" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Post Form */}
            <div className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 shadow-sm">
              <form onSubmit={handlePublishPost} className="space-y-4">
                
                <div className="flex items-start gap-4">
                  {user?.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={user.photoURL} 
                      alt="Avatar" 
                      className="w-10 h-10 rounded-full object-cover border border-sand-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400">
                      <UserIcon className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex-grow">
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="O que você está pensando?"
                      rows={3}
                      className="w-full bg-transparent border-0 resize-none text-xs text-spa-dark placeholder-spa-light outline-none font-medium focus:ring-0 pt-2"
                    />
                  </div>
                </div>

                {/* Photo Previews */}
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-5 gap-1 sm:gap-2 border-t border-sand-100/40 pt-4">
                    {photoPreviews.map((url, idx) => (
                      <div key={idx} className="relative aspect-square border border-sand-200 rounded-xl overflow-hidden group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeSelectedPhoto(idx)}
                          className="absolute top-1 right-1 p-1 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex items-center justify-between border-t border-sand-100/40 pt-4">
                  <label className="flex items-center gap-2 text-xs text-spa-medium hover:text-quartz-500 cursor-pointer transition-colors">
                    <ImageIcon className="w-4 h-4" />
                    <span className="font-semibold">Fotos</span>
                    <span className="text-[10px] text-spa-light">({photoPreviews.length}/10)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={photoPreviews.length >= 10 || publishing}
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={publishing || (!content.trim() && selectedPhotos.length === 0)}
                    className="flex items-center gap-2 py-2.5 px-6 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md transition-all cursor-pointer disabled:bg-sand-200"
                  >
                    {publishing ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Publicar</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>

            {/* Posts Feed */}
            <div className="space-y-6">
              {feedLoading ? (
                <div className="text-center py-10">
                  <span className="w-6 h-6 rounded-full border-3 border-quartz-400 border-t-transparent animate-spin inline-block" />
                </div>
              ) : posts.length === 0 ? (
                <div className="bg-white/50 border border-sand-200/50 rounded-3xl p-10 text-center">
                  <p className="font-serif italic text-spa-medium">Nenhum relato no círculo ainda. Seja o primeiro a compartilhar!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    currentUser={user}
                    isAdmin={isAdmin}
                    onDelete={handleDeletePost}
                    onEdit={handleEditPost}
                    onReport={(p) => {
                      setReportingPost(p);
                      setShowReportModal(true);
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════
           TAB: Comunidades
           ═══════════════════════════════════════ */}
        {activeTab === 'communities' && (
          <div className="space-y-6">
            <div className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-olive-50 flex items-center justify-center border border-olive-100">
                  <Compass className="w-3.5 h-3.5 text-olive-500" />
                </div>
                <h3 className="font-serif text-lg text-spa-dark font-light">
                  Comunidades
                </h3>
              </div>

              {communitiesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 text-olive-400 animate-spin mx-auto" />
                </div>
              ) : communities.length === 0 ? (
                <div className="text-center py-10 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-olive-50 flex items-center justify-center mx-auto border border-olive-100">
                    <Compass className="w-6 h-6 text-olive-300" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-spa-medium font-medium">Nenhuma comunidade encontrada</p>
                    <p className="text-[11px] text-spa-light font-light max-w-xs mx-auto leading-relaxed">
                      Você ainda não participa de nenhuma comunidade. Explore os grupos de interesse ou crie uma comunidade agora mesmo!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {communities.map((community) => (
                    <Link
                      key={community.id}
                      href={`/social/communities/${community.id}`}
                      className="p-4 bg-ivory/40 border border-sand-100/50 rounded-2xl hover:bg-olive-50/30 hover:border-olive-100/50 transition-all group space-y-2"
                    >
                      {community.category && (
                        <span className="text-[8px] bg-olive-50 text-olive-600 font-bold px-2 py-0.5 rounded-full border border-olive-100 uppercase tracking-widest">
                          {community.category}
                        </span>
                      )}
                      <p className="text-xs font-semibold text-spa-dark group-hover:text-olive-700 transition-colors">
                        {community.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-spa-light font-medium">
                        <Users className="w-3 h-3" />
                        <span>{community.memberCount} membros</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href="/social/communities"
                  className="flex items-center gap-2 py-2.5 px-6 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-md transition-all"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Explorar Comunidades</span>
                </Link>
                <Link
                  href="/social/communities?create=true"
                  className="flex items-center gap-2 py-2.5 px-6 bg-quartz-400 hover:bg-quartz-500 text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-md transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Criar Comunidade</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
           TAB: Amigas
           ═══════════════════════════════════════ */}
        {activeTab === 'friends' && (
          <div className="space-y-6">
            <div className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-lavender-50 flex items-center justify-center border border-lavender-100">
                  <Users className="w-3.5 h-3.5 text-lavender-500" />
                </div>
                <h3 className="font-serif text-lg text-spa-dark font-light">
                  Suas Amigas
                </h3>
              </div>

              {friendsTabLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 text-lavender-400 animate-spin mx-auto" />
                </div>
              ) : (
                <>
                  {/* Stats Row */}
                  <div className="flex items-center gap-4 justify-center">
                    <div className="text-center px-5 py-3 bg-ivory/50 rounded-2xl border border-sand-100/50">
                      <p className="text-xl font-serif font-light text-spa-dark">{friendsCount}</p>
                      <p className="text-[10px] text-spa-light font-medium uppercase tracking-wider mt-0.5">Amigas</p>
                    </div>
                    {pendingCount > 0 && (
                      <div className="text-center px-5 py-3 bg-quartz-50/50 rounded-2xl border border-quartz-100/50">
                        <p className="text-xl font-serif font-light text-quartz-500">{pendingCount}</p>
                        <p className="text-[10px] text-quartz-400 font-medium uppercase tracking-wider mt-0.5">Pendentes</p>
                      </div>
                    )}
                  </div>

                  {/* Friend Avatars */}
                  {friendsSummary.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {friendsSummary.map((friend) => (
                        <Link
                          key={friend.uid}
                          href={`/social/profile/${friend.uid}`}
                          className="flex flex-col items-center gap-1.5 group"
                          title={friend.displayName}
                        >
                          {friend.photoURL ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={friend.photoURL}
                              alt={friend.displayName}
                              className="w-14 h-14 rounded-full object-cover border-2 border-sand-200 group-hover:border-lavender-300 transition-colors shadow-sm"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400 border-2 border-sand-200 group-hover:border-lavender-300 transition-colors shadow-sm">
                              <UserIcon className="w-6 h-6" />
                            </div>
                          )}
                          <span className="text-[10px] text-spa-medium font-medium truncate max-w-[70px] group-hover:text-lavender-600 transition-colors">
                            {friend.displayName.split(" ")[0]}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-sand-50 flex items-center justify-center mx-auto border border-sand-100">
                        <UserPlus className="w-5 h-5 text-sand-300" />
                      </div>
                      <p className="text-[11px] text-spa-light font-light italic">
                        Você ainda não tem amigas no círculo.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center pt-2">
                    <Link
                      href="/social/friends"
                      className="flex items-center gap-2 py-2.5 px-6 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-md transition-all"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Gerenciar Amigas</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Modal de Denúncia */}
      {showReportModal && reportingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-sand-200 rounded-[2.5rem] p-6 max-w-md w-full shadow-xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="font-serif text-lg text-spa-dark font-light flex items-center gap-2">
                <Flag className="w-4 h-4 text-quartz-400" />
                Denunciar Publicação
              </h3>
              <button 
                onClick={() => { setShowReportModal(false); setReportingPost(null); }}
                className="p-1 rounded-full text-spa-light hover:bg-sand-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-spa-medium font-light leading-relaxed">
                Ajude-nos a manter o círculo seguro. Por que você está denunciando o relato de <strong className="font-bold">{reportingPost.userName}</strong>?
              </p>

              <div className="space-y-2">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">Motivo principal</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
                >
                  <option value="inappropriate">Conteúdo Inadequado / Ofensivo</option>
                  <option value="harassment">Assédio / Bullying</option>
                  <option value="spam">Spam / Propaganda não autorizada</option>
                  <option value="misinformation">Desinformação sobre saúde</option>
                  <option value="other">Outro motivo</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">Detalhes adicionais (opcional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Forneça mais contexto para ajudar os administradores a avaliar..."
                  rows={3}
                  className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-light leading-relaxed resize-none focus:ring-1 focus:ring-quartz-300"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-sand-100 pt-4">
              <button
                onClick={() => { setShowReportModal(false); setReportingPost(null); }}
                className="py-2.5 px-5 border border-sand-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-spa-medium hover:bg-sand-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReportPost}
                disabled={reportingSubmitting}
                className="py-2.5 px-6 bg-quartz-400 hover:bg-quartz-500 text-white rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors disabled:bg-sand-200 flex items-center gap-1.5 cursor-pointer"
              >
                {reportingSubmitting ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
                ) : (
                  <>
                    <Flag className="w-3 h-3 fill-white/10" />
                    Enviar Denúncia
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PostCard — Subcomponent with comments & persistent likes
   ═══════════════════════════════════════════════════════════ */
function PostCard({ 
  post, 
  currentUser, 
  isAdmin, 
  onDelete, 
  onEdit,
  onReport
}: { 
  post: Post; 
  currentUser: User | null; 
  isAdmin: boolean; 
  onDelete: (id: string) => void; 
  onEdit: (id: string, text: string) => Promise<boolean>;
  onReport: (post: Post) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likesCount);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSaving, setIsSaving] = useState(false);

  // Translation states
  const { language } = useLanguage();
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState(post.translations?.[language] || "");
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");

  // Sync translations when language changes
  useEffect(() => {
    setTranslatedText(post.translations?.[language] || "");
    setIsTranslated(false);
    setTranslationError("");
  }, [language, post.translations]);

  // Handle post translation request
  const handleTranslate = async () => {
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }

    if (translatedText) {
      setIsTranslated(true);
      return;
    }

    if (!currentUser) return;
    setTranslating(true);
    setTranslationError("");

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/social/posts/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          postId: post.id,
          targetLanguage: language
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao solicitar tradução.");
      }

      const data = await res.json();
      setTranslatedText(data.translation);
      setIsTranslated(true);
    } catch (err: unknown) {
      console.error("Erro na tradução do post:", err);
      setTranslationError("Erro ao traduzir relato.");
    } finally {
      setTranslating(false);
    }
  };

  // Comment states
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [localCommentsCount, setLocalCommentsCount] = useState(post.commentsCount);

  // Like persistence state
  const [likeChecked, setLikeChecked] = useState(false);

  // Check if user already liked this post on mount
  useEffect(() => {
    if (!currentUser || likeChecked) return;
    const checkLike = async () => {
      try {
        const likeDocRef = doc(db, "social_posts", post.id, "likes", currentUser.uid);
        const likeSnap = await getDoc(likeDocRef);
        if (likeSnap.exists()) {
          setLiked(true);
        }
      } catch (err) {
        // Silently fail — not critical
        console.error("Erro ao verificar like:", err);
      } finally {
        setLikeChecked(true);
      }
    };
    checkLike();
  }, [currentUser, post.id, likeChecked]);

  /** Toggle like with Firestore persistence. */
  const handleLike = async () => {
    if (!currentUser) return;

    // Optimistic UI update
    const newLiked = !liked;
    setLiked(newLiked);
    setLikes((prev) => (newLiked ? prev + 1 : prev - 1));

    try {
      const postRef = doc(db, "social_posts", post.id);
      const likeDocRef = doc(db, "social_posts", post.id, "likes", currentUser.uid);

      if (newLiked) {
        // Add like
        await setDoc(likeDocRef, {
          userId: currentUser.uid,
          userName: currentUser.displayName || "Membro",
          createdAt: new Date().toISOString(),
        });
        await updateDoc(postRef, { likesCount: increment(1) });
      } else {
        // Remove like
        await deleteDoc(likeDocRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      }
    } catch (err) {
      // Revert on failure
      console.error("Erro ao persistir like:", err);
      setLiked(!newLiked);
      setLikes((prev) => (newLiked ? prev - 1 : prev + 1));
    }
  };

  /** Load comments from subcollection. */
  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const commentsRef = collection(db, "social_posts", post.id, "comments");
      const q = query(commentsRef, orderBy("createdAt", "asc"));
      const snap = await getDocs(q);

      const loaded: Comment[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          userId: data.userId,
          userName: data.userName || "Membro",
          userPhoto: data.userPhoto,
          text: data.text || "",
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        });
      });
      setComments(loaded);
    } catch (err) {
      console.error("Erro ao carregar comentários:", err);
    } finally {
      setLoadingComments(false);
    }
  }, [post.id]);

  // Load comments when expanding the section
  useEffect(() => {
    if (showComments && comments.length === 0) {
      const timer = setTimeout(() => {
        loadComments();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showComments, comments.length, loadComments]);

  /** Submit a new comment. */
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const commentsRef = collection(db, "social_posts", post.id, "comments");
      const newComment = {
        userId: currentUser.uid,
        userName: currentUser.displayName || "Membro",
        userPhoto: currentUser.photoURL || null,
        text: commentText.trim(),
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(commentsRef, newComment);

      // Update comments count on the post document
      await updateDoc(doc(db, "social_posts", post.id), {
        commentsCount: increment(1),
      });

      // Optimistic local update
      setComments((prev) => [
        ...prev,
        {
          id: docRef.id,
          userId: currentUser.uid,
          userName: currentUser.displayName || "Membro",
          userPhoto: currentUser.photoURL || undefined,
          text: commentText.trim(),
          createdAt: new Date(),
        },
      ]);
      setLocalCommentsCount((prev) => prev + 1);
      setCommentText("");
    } catch (err) {
      console.error("Erro ao publicar comentário:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onEdit(post.id, editContent);
    setIsSaving(false);
    if (success) {
      setIsEditing(false);
    }
  };

  const canManage = currentUser && (post.userId === currentUser.uid || isAdmin);

  return (
    <div className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {post.userPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={post.userPhoto} 
              alt={post.userName} 
              className="w-9 h-9 rounded-full object-cover border border-sand-200"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400 border border-sand-200">
              <UserIcon className="w-4.5 h-4.5" />
            </div>
          )}
          <div>
            <h4 className="text-xs text-spa-dark font-semibold leading-none">{post.userName}</h4>
            <div className="flex items-center gap-1 text-[9px] text-spa-light font-medium mt-1">
              <Clock className="w-2.5 h-2.5" />
              <span>{post.createdAt.toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {canManage && !isEditing ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-full text-spa-medium hover:text-quartz-500 hover:bg-quartz-50/50 transition-all cursor-pointer border-0 bg-transparent"
              title="Editar relato"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => onDelete(post.id)}
              className="p-1.5 rounded-full text-spa-medium hover:text-red-500 hover:bg-red-50/50 transition-all cursor-pointer border-0 bg-transparent"
              title="Excluir relato"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          currentUser && post.userId !== currentUser.uid && !isEditing && (
            <button 
              onClick={() => onReport(post)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-quartz-100 text-[10px] font-bold text-quartz-600 hover:bg-quartz-50 hover:text-quartz-500 transition-all cursor-pointer bg-white"
              title="Denunciar publicação"
            >
              <Flag className="w-3 h-3 text-quartz-400" />
              <span>Denunciar</span>
            </button>
          )
        )}
      </div>

      {/* Content or Edit Field */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full p-3 bg-ivory/50 border border-sand-200 rounded-xl text-xs text-spa-dark focus:outline-none focus:ring-1 focus:ring-quartz-300 font-medium resize-none"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditContent(post.content);
              }}
              disabled={isSaving}
              className="px-4 py-1.5 border border-sand-200 hover:bg-sand-50 rounded-full text-[10px] uppercase font-bold tracking-wider text-spa-medium transition-all cursor-pointer bg-white"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !editContent.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer disabled:bg-sand-200"
            >
              {isSaving ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
              ) : (
                "Salvar"
              )}
            </button>
          </div>
        </div>
      ) : (
        post.content && (
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-spa-medium font-light leading-relaxed whitespace-pre-wrap">
              {isTranslated ? translatedText : post.content}
            </p>
            {currentUser && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTranslate}
                  disabled={translating}
                  className="flex items-center gap-1.5 text-[10px] text-olive-600 hover:text-olive-700 font-semibold cursor-pointer border-0 bg-transparent p-0 disabled:opacity-50 transition-all"
                >
                  {translating ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Traduzindo...</span>
                    </>
                  ) : isTranslated ? (
                    <span>Ver original</span>
                  ) : (
                    <>
                      <Globe className="w-2.5 h-2.5" />
                      <span>Traduzir publicação</span>
                    </>
                  )}
                </button>
                {translationError && (
                  <span className="text-[9px] text-red-500 font-light">{translationError}</span>
                )}
              </div>
            )}
          </div>
        )
      )}

      {/* Multiple Photos Gallery (Carousel style if > 1 photo) */}
      {post.photos && post.photos.length > 0 && (
        <div className="relative border border-sand-200/50 rounded-2xl overflow-hidden bg-sand-50/20 aspect-video flex items-center justify-center group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={post.photos[activePhotoIdx]} 
            alt={`Foto ${activePhotoIdx + 1}`} 
            className="w-full h-full object-cover"
          />

          {post.photos.length > 1 && (
            <>
              <button 
                onClick={() => setActivePhotoIdx(prev => (prev === 0 ? post.photos.length - 1 : prev - 1))}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/70 hover:bg-white text-spa-dark shadow opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActivePhotoIdx(prev => (prev === post.photos.length - 1 ? 0 : prev + 1))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/70 hover:bg-white text-spa-dark shadow opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/40 px-2 py-0.5 rounded-full text-[9px] text-white">
                {activePhotoIdx + 1} / {post.photos.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 border-t border-sand-100/40 pt-4 text-xs text-spa-medium font-semibold">
        <button 
          onClick={handleLike}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer border-0 bg-transparent ${liked ? "text-quartz-500" : "text-spa-medium hover:text-quartz-500"}`}
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-quartz-400" : ""}`} />
          <span>{likes}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer border-0 bg-transparent ${showComments ? "text-quartz-500" : "text-spa-medium hover:text-quartz-500"}`}
        >
          <MessageSquare className={`w-4 h-4 ${showComments ? "fill-quartz-100" : ""}`} />
          <span>{localCommentsCount}</span>
        </button>
      </div>

      {/* ── Comments Section ── */}
      {showComments && (
        <div className="border-t border-sand-100/40 pt-4 space-y-3">
          {/* Loading state */}
          {loadingComments ? (
            <div className="text-center py-4">
              <Loader2 className="w-4 h-4 text-quartz-400 animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* Comment list */}
              {comments.length === 0 ? (
                <p className="text-center text-[10px] text-spa-light py-3 font-light italic">
                  Nenhum comentário ainda. Seja a primeira!
                </p>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-2.5 p-2.5 bg-ivory/40 rounded-xl">
                      {comment.userPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={comment.userPhoto}
                          alt={comment.userName}
                          className="w-7 h-7 rounded-full object-cover border border-sand-200 shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400 border border-sand-200 shrink-0 mt-0.5">
                          <UserIcon className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-spa-dark">{comment.userName}</span>
                          <span className="text-[9px] text-spa-light font-medium">
                            {comment.createdAt instanceof Date
                              ? comment.createdAt.toLocaleDateString()
                              : new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-spa-medium font-light leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment Input Form */}
              {currentUser && (
                <form onSubmit={handleSubmitComment} className="flex items-center gap-2 pt-1">
                  {currentUser.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentUser.photoURL}
                      alt="Você"
                      className="w-7 h-7 rounded-full object-cover border border-sand-200 shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400 border border-sand-200 shrink-0">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Escreva um comentário..."
                    className="flex-grow py-2 px-3.5 bg-ivory/60 border border-sand-200/60 rounded-full text-[11px] text-spa-dark placeholder-spa-light outline-none focus:ring-1 focus:ring-quartz-200/60 focus:border-quartz-200 transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !commentText.trim()}
                    className="p-2 bg-spa-dark hover:bg-quartz-400 text-white rounded-full transition-all cursor-pointer disabled:bg-sand-200 shrink-0"
                  >
                    {submittingComment ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
