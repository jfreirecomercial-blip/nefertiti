"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  Edit3,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Settings,
  Sparkles,
  Trash2,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { compressImage } from "@/lib/image-compression";

/* ═══════════════════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════ */

interface ProfileData {
  displayName: string;
  photoURL: string;
  email: string;
  role: string;
  createdAt?: unknown;
}

interface SocialProfile {
  bio: string;
  whatsappNumber: string;
  allowScraps: boolean;
  allowDirectChat: boolean;
  interests: string[];
  createdAt?: unknown;
}

interface Friendship {
  id: string;
  users: string[];
  status: "pending" | "accepted" | "declined";
  senderId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface UserPhoto {
  id: string;
  userId: string;
  imageUrl: string;
  caption: string;
  createdAt: Date;
  likes: string[];
  reactions: { love: number; wow: number; cool: number };
}

interface PhotoComment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: Date;
}

interface Scrap {
  id: string;
  recipientId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: Date;
}

interface CommunityData {
  id: string;
  name: string;
  category: string;
  memberCount: number;
  description?: string;
  imageUrl?: string;
}

type TabKey = "fotos" | "recados" | "comunidades";

/* ═══════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function SocialProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = React.use(params);
  const { t } = useLanguage();
  const router = useRouter();

  // ─── Auth ───
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ─── Profile Data ───
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ─── Friendship ───
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [friendshipLoading, setFriendshipLoading] = useState(false);
  const [friendshipAction, setFriendshipAction] = useState(false);

  // ─── Tabs ───
  const [activeTab, setActiveTab] = useState<TabKey>("fotos");

  // ─── Photos ───
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<UserPhoto | null>(null);
  const [photoComments, setPhotoComments] = useState<PhotoComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newPhotoCaption, setNewPhotoCaption] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ─── Scraps ───
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [scrapsLoading, setScrapsLoading] = useState(false);
  const [newScrapContent, setNewScrapContent] = useState("");
  const [scrapSubmitting, setScrapSubmitting] = useState(false);

  // ─── Communities ───
  const [communities, setCommunities] = useState<CommunityData[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);

  // ─── Edit Profile ───
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editCountry, setEditCountry] = useState("Brasil");
  const [editShareArrival, setEditShareArrival] = useState(true);
  const [editBio, setEditBio] = useState("");
  const [editInterests, setEditInterests] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editAllowScraps, setEditAllowScraps] = useState(true);
  const [editAllowDirectChat, setEditAllowDirectChat] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  // ─── Feedback ───
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isOwnProfile = currentUser?.uid === userId;

  /* ─── Helpers ─── */
  const clearMessages = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 5000);
  };

  const formatDate = (date: Date | string | { toDate?: () => Date } | null | undefined): string => {
    if (!date) return "";
    let d: Date;
    if (date instanceof Date) {
      d = date;
    } else if (date && typeof date === "object" && "toDate" in date && typeof date.toDate === "function") {
      d = date.toDate();
    } else {
      d = new Date(date as string);
    }
    return d.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  /* ═══════════════════════════════════════════════════════
     AUTH CHECK
     ═══════════════════════════════════════════════════════ */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
      } else {
        setCurrentUser(firebaseUser);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  /* ═══════════════════════════════════════════════════════
     LOAD PROFILE + SOCIAL PROFILE + FRIENDSHIP
     ═══════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!currentUser || authLoading) return;

    async function loadProfileData() {
      setProfileLoading(true);
      try {
        // 1. Social profile (contém dados públicos como nome, foto, localização)
        const socialSnap = await getDoc(doc(db, "social_profiles", userId));
        if (socialSnap.exists()) {
          const socialData = socialSnap.data();
          setSocialProfile(socialData as SocialProfile);
          setProfile({
            displayName: socialData.displayName || "Membro Nefertiti",
            photoURL: socialData.photoURL || "",
            email: isOwnProfile ? currentUser?.email || "" : "",
            role: "member",
            city: socialData.city || "",
            state: socialData.state || "",
            country: socialData.country || "",
            shareArrival: socialData.shareArrival !== false
          } as any);
        } else if (isOwnProfile) {
          // Fallback caso próprio perfil ainda não tenha social_profile
          const userSnap = await getDoc(doc(db, "users", userId));
          if (userSnap.exists()) {
            setProfile(userSnap.data() as any);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      } finally {
        setProfileLoading(false);
      }
    }

    async function loadFriendship() {
      if (isOwnProfile) return;
      setFriendshipLoading(true);
      try {
        const friendshipsRef = collection(db, "friendships");
        const q = query(
          friendshipsRef,
          where("users", "array-contains", currentUser!.uid)
        );
        const snap = await getDocs(q);
        let found: Friendship | null = null;
        snap.forEach((d) => {
          const data = d.data();
          if (data.users?.includes(userId)) {
            found = { id: d.id, ...data } as Friendship;
          }
        });
        setFriendship(found);
      } catch (err) {
        console.error("Erro ao carregar amizade:", err);
      } finally {
        setFriendshipLoading(false);
      }
    }

    loadProfileData();
    loadFriendship();
  }, [currentUser, authLoading, userId, isOwnProfile]);

  /* ═══════════════════════════════════════════════════════
     LOAD TAB DATA
     ═══════════════════════════════════════════════════════ */
  const loadPhotos = useCallback(async () => {
    setPhotosLoading(true);
    try {
      const photosRef = collection(db, "user_photos");
      const q = query(
        photosRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(30)
      );
      const snap = await getDocs(q);
      const loaded: UserPhoto[] = [];
      snap.forEach((d) => {
        const data = d.data();
        loaded.push({
          id: d.id,
          userId: data.userId,
          imageUrl: data.imageUrl || "",
          caption: data.caption || "",
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          likes: data.likes || [],
          reactions: data.reactions || { love: 0, wow: 0, cool: 0 },
        });
      });
      setPhotos(loaded);
    } catch (err) {
      console.error("Erro ao carregar fotos:", err);
    } finally {
      setPhotosLoading(false);
    }
  }, [userId]);

  const loadScraps = useCallback(async () => {
    setScrapsLoading(true);
    try {
      const scrapsRef = collection(db, "scraps");
      const q = query(
        scrapsRef,
        where("recipientId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      const loaded: Scrap[] = [];
      snap.forEach((d) => {
        const data = d.data();
        loaded.push({
          id: d.id,
          recipientId: data.recipientId,
          authorId: data.authorId,
          authorName: data.authorName || "Membro",
          authorPhoto: data.authorPhoto || "",
          content: data.content || "",
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        });
      });
      setScraps(loaded);
    } catch (err) {
      console.error("Erro ao carregar recados:", err);
    } finally {
      setScrapsLoading(false);
    }
  }, [userId]);

  const loadCommunities = useCallback(async () => {
    setCommunitiesLoading(true);
    try {
      const communitiesRef = collection(db, "communities");
      const q = query(communitiesRef, limit(50));
      const snap = await getDocs(q);

      const memberChecks = snap.docs.map(async (communityDoc) => {
        try {
          const memberSnap = await getDoc(
            doc(db, "communities", communityDoc.id, "members", userId)
          );
          if (memberSnap.exists()) {
            const data = communityDoc.data();
            return {
              id: communityDoc.id,
              name: data.name || "Comunidade",
              category: data.category || "",
              memberCount: data.memberCount || 0,
              description: data.description || "",
              imageUrl: data.imageUrl || "",
            } as CommunityData;
          }
        } catch {
          // Member doc doesn't exist — not a member
        }
        return null;
      });

      const results = await Promise.all(memberChecks);
      setCommunities(results.filter(Boolean) as CommunityData[]);
    } catch (err) {
      console.error("Erro ao carregar comunidades:", err);
    } finally {
      setCommunitiesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!currentUser || authLoading || profileLoading) return;
    const timer = setTimeout(() => {
      if (activeTab === "fotos") loadPhotos();
      else if (activeTab === "recados") loadScraps();
      else if (activeTab === "comunidades") loadCommunities();
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab, currentUser, authLoading, profileLoading, loadPhotos, loadScraps, loadCommunities]);

  /* ═══════════════════════════════════════════════════════
     FRIENDSHIP ACTIONS
     ═══════════════════════════════════════════════════════ */
  const handleAddFriend = async () => {
    if (!currentUser || isOwnProfile) return;
    setFriendshipAction(true);
    clearMessages();
    try {
      const docRef = await addDoc(collection(db, "friendships"), {
        users: [currentUser.uid, userId],
        status: "pending",
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setFriendship({
        id: docRef.id,
        users: [currentUser.uid, userId],
        status: "pending",
        senderId: currentUser.uid,
      });
      showSuccess("Solicitação de amizade enviada!");
    } catch (err) {
      console.error("Erro ao adicionar amiga:", err);
      showError("Erro ao enviar solicitação.");
    } finally {
      setFriendshipAction(false);
    }
  };

  const handleAcceptFriendship = async () => {
    if (!friendship) return;
    setFriendshipAction(true);
    clearMessages();
    try {
      await updateDoc(doc(db, "friendships", friendship.id), {
        status: "accepted",
        updatedAt: serverTimestamp(),
      });
      setFriendship({ ...friendship, status: "accepted" });
      showSuccess("Amizade aceita! 🎉");
    } catch (err) {
      console.error("Erro ao aceitar amizade:", err);
      showError("Erro ao aceitar amizade.");
    } finally {
      setFriendshipAction(false);
    }
  };

  const handleDeclineFriendship = async () => {
    if (!friendship) return;
    setFriendshipAction(true);
    clearMessages();
    try {
      await updateDoc(doc(db, "friendships", friendship.id), {
        status: "declined",
        updatedAt: serverTimestamp(),
      });
      setFriendship({ ...friendship, status: "declined" });
    } catch (err) {
      console.error("Erro ao recusar amizade:", err);
      showError("Erro ao recusar amizade.");
    } finally {
      setFriendshipAction(false);
    }
  };

  /* ═══════════════════════════════════════════════════════
     PHOTO UPLOAD
     ═══════════════════════════════════════════════════════ */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 10 * 1024 * 1024) {
      showError("A foto selecionada excede o limite máximo de 10MB.");
      return;
    }

    setUploadingPhoto(true);
    clearMessages();
    try {
      const compressed = await compressImage(file, {
        maxDimension: 1200,
        initialQuality: 0.75,
        maxSizeBytes: 250 * 1024,
      });

      // Salvar a foto no Firebase Storage em vez de usar base64 no Firestore
      const photoId = `${Date.now()}`;
      const photoRef = ref(storage, `users/${currentUser.uid}/gallery/${photoId}.jpg`);
      await uploadBytes(photoRef, compressed);
      const downloadURL = await getDownloadURL(photoRef);

      await addDoc(collection(db, "user_photos"), {
        userId: currentUser.uid,
        imageUrl: downloadURL,
        caption: newPhotoCaption.trim(),
        createdAt: serverTimestamp(),
        likes: [],
        reactions: { love: 0, wow: 0, cool: 0 },
      });

      setNewPhotoCaption("");
      setShowUploadForm(false);
      showSuccess("Foto publicada com sucesso!");
      loadPhotos();
    } catch (err) {
      console.error("Erro ao publicar foto:", err);
      showError("Erro ao publicar foto.");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  /* ═══════════════════════════════════════════════════════
     PHOTO MODAL — LIKES, REACTIONS, COMMENTS
     ═══════════════════════════════════════════════════════ */
  const openPhotoModal = async (photo: UserPhoto) => {
    setSelectedPhoto(photo);
    setNewComment("");
    setCommentsLoading(true);
    try {
      const commentsRef = collection(db, "user_photos", photo.id, "comments");
      const q = query(commentsRef, orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);
      const loaded: PhotoComment[] = [];
      snap.forEach((d) => {
        const data = d.data();
        loaded.push({
          id: d.id,
          authorId: data.authorId,
          authorName: data.authorName || "Membro",
          authorPhoto: data.authorPhoto || "",
          content: data.content || "",
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        });
      });
      setPhotoComments(loaded);
    } catch (err) {
      console.error("Erro ao carregar comentários:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleToggleLike = async (photo: UserPhoto) => {
    if (!currentUser) return;
    const isLiked = photo.likes.includes(currentUser.uid);
    try {
      await updateDoc(doc(db, "user_photos", photo.id), {
        likes: isLiked
          ? arrayRemove(currentUser.uid)
          : arrayUnion(currentUser.uid),
      });

      const updatedLikes = isLiked
        ? photo.likes.filter((id) => id !== currentUser.uid)
        : [...photo.likes, currentUser.uid];

      // Update in photos list
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, likes: updatedLikes } : p))
      );
      // Update in modal
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto({ ...photo, likes: updatedLikes });
      }
    } catch (err) {
      console.error("Erro ao curtir foto:", err);
    }
  };

  const handleReaction = async (photo: UserPhoto, type: "love" | "wow" | "cool") => {
    if (!currentUser) return;
    try {
      const newReactions = { ...photo.reactions, [type]: (photo.reactions[type] || 0) + 1 };
      await updateDoc(doc(db, "user_photos", photo.id), {
        reactions: newReactions,
      });
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, reactions: newReactions } : p
        )
      );
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto({ ...photo, reactions: newReactions });
      }
    } catch (err) {
      console.error("Erro ao reagir:", err);
    }
  };

  const handleAddComment = async () => {
    if (!currentUser || !selectedPhoto || !newComment.trim()) return;
    setCommentSubmitting(true);
    try {
      const commentData = {
        authorId: currentUser.uid,
        authorName: currentUser.displayName || "Membro Nefertiti",
        authorPhoto: currentUser.photoURL || "",
        content: newComment.trim(),
        createdAt: serverTimestamp(),
      };
      const commentRef = await addDoc(
        collection(db, "user_photos", selectedPhoto.id, "comments"),
        commentData
      );
      setPhotoComments((prev) => [
        {
          id: commentRef.id,
          ...commentData,
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setNewComment("");
    } catch (err) {
      console.error("Erro ao adicionar comentário:", err);
      showError("Erro ao enviar comentário.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  /* ═══════════════════════════════════════════════════════
     SCRAPS
     ═══════════════════════════════════════════════════════ */
  const handlePostScrap = async () => {
    if (!currentUser || !newScrapContent.trim()) return;
    setScrapSubmitting(true);
    clearMessages();
    try {
      const scrapData = {
        recipientId: userId,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || "Membro Nefertiti",
        authorPhoto: currentUser.photoURL || "",
        content: newScrapContent.trim(),
        createdAt: serverTimestamp(),
      };
      const scrapRef = await addDoc(collection(db, "scraps"), scrapData);
      setScraps((prev) => [
        {
          id: scrapRef.id,
          ...scrapData,
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setNewScrapContent("");
      showSuccess("Recado enviado!");
    } catch (err) {
      console.error("Erro ao enviar recado:", err);
      showError("Erro ao enviar recado.");
    } finally {
      setScrapSubmitting(false);
    }
  };

  const handleDeleteScrap = async (scrapId: string) => {
    if (!confirm("Tem certeza de que deseja excluir este recado?")) return;
    try {
      await deleteDoc(doc(db, "scraps", scrapId));
      setScraps((prev) => prev.filter((s) => s.id !== scrapId));
      showSuccess("Recado excluído.");
    } catch (err) {
      console.error("Erro ao excluir recado:", err);
      showError("Erro ao excluir recado.");
    }
  };

  /* ═══════════════════════════════════════════════════════
     EDIT SOCIAL PROFILE
     ═══════════════════════════════════════════════════════ */
  const openEditModal = () => {
    setEditDisplayName(profile?.displayName || "");
    setEditCity((profile as any)?.city || "");
    setEditState((profile as any)?.state || "");
    setEditCountry((profile as any)?.country || "Brasil");
    setEditShareArrival((profile as any)?.shareArrival !== false);
    setEditBio(socialProfile?.bio || "");
    setEditInterests(socialProfile?.interests?.join(", ") || "");
    setEditWhatsapp(socialProfile?.whatsappNumber || "");
    setEditAllowScraps(socialProfile?.allowScraps ?? true);
    setEditAllowDirectChat(socialProfile?.allowDirectChat ?? true);
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setEditSaving(true);
    clearMessages();

    // Validação de Nome de Exibição
    const trimmedName = editDisplayName.trim();
    if (trimmedName.length < 3) {
      showError("O nome de exibição deve ter no mínimo 3 caracteres.");
      setEditSaving(false);
      return;
    }
    const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
    if (!nameRegex.test(trimmedName)) {
      showError("O nome de exibição deve conter apenas letras e espaços.");
      setEditSaving(false);
      return;
    }
    // Capitalizar primeira letra de cada palavra
    const formattedName = trimmedName
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    try {
      const interestsArr = editInterests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const socialProfileData = {
        userId: currentUser.uid,
        displayName: formattedName,
        displayNameLowercase: formattedName.toLowerCase(),
        displayNameWords: formattedName.toLowerCase().split(/\s+/).filter(Boolean),
        city: editCity.trim(),
        state: editState.trim().toUpperCase(),
        country: editCountry.trim(),
        shareArrival: editShareArrival,
        bio: editBio.trim(),
        interests: interestsArr,
        whatsappNumber: editWhatsapp.trim(),
        allowScraps: editAllowScraps,
        allowDirectChat: editAllowDirectChat,
        createdAt: socialProfile?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 1. Atualizar no social_profiles
      await setDoc(doc(db, "social_profiles", currentUser.uid), socialProfileData, {
        merge: true,
      });

      // 2. Atualizar no users
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: formattedName,
        city: editCity.trim(),
        state: editState.trim().toUpperCase(),
        country: editCountry.trim(),
        shareArrival: editShareArrival,
        updatedAt: new Date().toISOString(),
      });

      setSocialProfile(socialProfileData as any);
      setProfile((prev: any) => ({
        ...prev,
        displayName: formattedName,
        city: editCity.trim(),
        state: editState.trim().toUpperCase(),
        country: editCountry.trim(),
        shareArrival: editShareArrival
      }));

      setShowEditModal(false);
      showSuccess("Perfil social atualizado!");
    } catch (err) {
      console.error("Erro ao salvar perfil social:", err);
      showError("Erro ao salvar perfil.");
    } finally {
      setEditSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════════
     DERIVED STATE
     ═══════════════════════════════════════════════════════ */
  const isFriend =
    friendship?.status === "accepted";
  const isPendingSender =
    friendship?.status === "pending" && friendship.senderId === currentUser?.uid;
  const isPendingReceiver =
    friendship?.status === "pending" && friendship.senderId !== currentUser?.uid;

  /* ═══════════════════════════════════════════════════════
     LOADING / AUTH GUARD
     ═══════════════════════════════════════════════════════ */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">
            Carregando…
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-ivory bg-grain text-spa-dark pb-24">
      {/* ── Background Blobs ── */}
      <div className="absolute top-0 left-[-10%] w-[500px] h-[500px] bg-quartz-100/20 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute bottom-0 right-[-10%] w-[450px] h-[450px] bg-olive-100/25 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute top-[40%] right-[-5%] w-[350px] h-[350px] bg-lavender-100/15 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-ivory/85 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <Link
          href="/social"
          className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">
            Social
          </span>
        </Link>
        {isOwnProfile && (
          <button
            onClick={openEditModal}
            className="flex items-center gap-2 py-2 px-4 border border-sand-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider text-spa-medium hover:bg-sand-50 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            Editar Perfil
          </button>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-10 space-y-8">
        {/* ── Notifications ── */}
        {successMessage && (
          <div className="p-4 bg-olive-50 border border-olive-200/30 rounded-2xl text-xs text-olive-800 flex items-center gap-2 animate-[fadeIn_0.3s_ease]">
            <Sparkles className="w-4 h-4 text-olive-500 shrink-0" />
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-4 bg-quartz-50 border border-quartz-200/50 rounded-2xl text-xs text-spa-dark animate-[fadeIn_0.3s_ease]">
            {errorMessage}
          </div>
        )}

        {/* ═══════════════════════════════════════════════
           PROFILE HEADER CARD
           ═══════════════════════════════════════════════ */}
        {profileLoading ? (
          <div className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-10 shadow-sm flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-quartz-400" />
          </div>
        ) : (
          <div className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar */}
              <div className="relative shrink-0">
                {profile?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName || "Avatar"}
                    className="w-24 h-24 rounded-full object-cover border-2 border-sand-200/60 shadow-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-quartz-50 border-2 border-sand-200/60 flex items-center justify-center">
                    <UserIcon className="w-10 h-10 text-quartz-300" />
                  </div>
                )}
                {isFriend && (
                  <div className="absolute -bottom-1 -right-1 bg-olive-400 text-white rounded-full p-1 border-2 border-white shadow-sm">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-grow text-center sm:text-left space-y-3">
                <div>
                  <h1 className="font-serif text-2xl text-spa-dark tracking-wide">
                    {profile?.displayName || "Membro Nefertiti"}
                  </h1>
                  {profile && ((profile as any).city || (profile as any).state || (profile as any).country) && (
                    <p className="text-[10px] text-spa-light uppercase font-semibold tracking-wider mt-1.5 flex items-center justify-center sm:justify-start gap-1">
                      <span>{(profile as any).city}</span>
                      {(profile as any).city && (profile as any).state && <span>, </span>}
                      <span>{(profile as any).state}</span>
                      {((profile as any).city || (profile as any).state) && (profile as any).country && <span className="mx-1">•</span>}
                      <span>{(profile as any).country}</span>
                    </p>
                  )}
                  {socialProfile?.bio && (
                    <p className="text-xs text-spa-medium font-light leading-relaxed mt-2 max-w-md">
                      {socialProfile.bio}
                    </p>
                  )}
                </div>

                {/* Interests */}
                {socialProfile && socialProfile.interests && socialProfile.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                    {socialProfile.interests.map((interest, i) => (
                      <span
                        key={i}
                        className="text-[9px] bg-lavender-50 text-lavender-500 font-bold px-3 py-1 rounded-full border border-lavender-200 uppercase tracking-widest"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}

                {/* Member since */}
                {!!profile?.createdAt && (
                  <p className="text-[10px] text-spa-light font-medium">
                    Membro desde {formatDate(profile.createdAt)}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start pt-1">
                  {/* Friendship button */}
                  {!isOwnProfile && (
                    <>
                      {friendshipLoading ? (
                        <span className="py-2.5 px-6 bg-sand-100 rounded-full text-xs font-bold text-spa-light">
                          <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                        </span>
                      ) : friendship?.status === "accepted" ? (
                        <span className="inline-flex items-center gap-1.5 py-2.5 px-6 bg-olive-50 text-olive-600 rounded-full text-xs font-bold border border-olive-200">
                          <Check className="w-3.5 h-3.5" />
                          Amigas ✓
                        </span>
                      ) : isPendingSender ? (
                        <span className="py-2.5 px-6 bg-sand-50 text-spa-light rounded-full text-xs font-bold border border-sand-200 cursor-default">
                          Solicitação Enviada
                        </span>
                      ) : isPendingReceiver ? (
                        <div className="flex gap-2">
                          <button
                            onClick={handleAcceptFriendship}
                            disabled={friendshipAction}
                            className="py-2.5 px-5 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.15em] shadow-md transition-all cursor-pointer disabled:opacity-50"
                          >
                            {friendshipAction ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              "Aceitar Amizade"
                            )}
                          </button>
                          <button
                            onClick={handleDeclineFriendship}
                            disabled={friendshipAction}
                            className="py-2.5 px-5 border border-sand-200 text-spa-medium rounded-full text-xs font-bold uppercase tracking-[0.15em] hover:bg-sand-50 transition-all cursor-pointer disabled:opacity-50"
                          >
                            Recusar
                          </button>
                        </div>
                      ) : friendship?.status === "declined" ? (
                        <span className="py-2.5 px-6 bg-sand-50 text-spa-light rounded-full text-xs font-bold border border-sand-200 cursor-default">
                          Solicitação Recusada
                        </span>
                      ) : (
                        <button
                          onClick={handleAddFriend}
                          disabled={friendshipAction}
                          className="py-2.5 px-6 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                          {friendshipAction ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              Adicionar Amiga
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}

                  {/* WhatsApp button */}
                  {!isOwnProfile &&
                    socialProfile?.whatsappNumber &&
                    socialProfile.whatsappNumber.trim() !== "" && (
                      <a
                        href={`https://wa.me/${socialProfile.whatsappNumber.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 py-2.5 px-5 bg-[#25D366] hover:bg-[#1EBE5A] text-white rounded-full text-xs font-bold uppercase tracking-[0.15em] shadow-md transition-all"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
           TAB NAVIGATION
           ═══════════════════════════════════════════════ */}
        <div className="flex justify-center">
          <div className="flex gap-1 bg-sand-50/80 p-1 rounded-full border border-sand-200/50 w-fit">
            {(
              [
                { key: "fotos", label: "Fotos", icon: ImageIcon },
                { key: "recados", label: "Mural de Recados", icon: MessageCircle },
                { key: "comunidades", label: "Comunidades", icon: Users },
              ] as { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-white text-spa-dark shadow-sm font-bold"
                    : "text-spa-medium hover:text-spa-dark"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">
                  {tab.key === "fotos"
                    ? "Fotos"
                    : tab.key === "recados"
                    ? "Recados"
                    : "Grupos"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
           FOTOS TAB
           ═══════════════════════════════════════════════ */}
        {activeTab === "fotos" && (
          <section className="space-y-6">
            {/* Upload Form (own profile) */}
            {isOwnProfile && (
              <div className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-5 shadow-sm">
                {showUploadForm ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-sm text-spa-dark">
                        Nova Foto
                      </h3>
                      <button
                        onClick={() => setShowUploadForm(false)}
                        className="p-1 rounded-full text-spa-light hover:bg-sand-50 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newPhotoCaption}
                      onChange={(e) => setNewPhotoCaption(e.target.value)}
                      placeholder="Legenda da foto (opcional)…"
                      className="w-full p-3 bg-ivory/50 border border-sand-200 rounded-xl text-xs text-spa-dark placeholder-spa-light outline-none font-medium focus:ring-1 focus:ring-quartz-300"
                    />
                    <label className="flex items-center justify-center gap-2 py-3 px-6 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md transition-all cursor-pointer w-full">
                      {uploadingPhoto ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          Escolher Foto
                        </>
                      )}
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowUploadForm(true)}
                    className="flex items-center gap-2 text-xs text-spa-medium hover:text-quartz-500 transition-colors font-semibold cursor-pointer w-full justify-center py-1"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Foto
                  </button>
                )}
              </div>
            )}

            {/* Photo Grid */}
            {photosLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-quartz-400" />
              </div>
            ) : photos.length === 0 ? (
              <div className="bg-white/50 border border-sand-200/50 rounded-3xl p-10 text-center">
                <ImageIcon className="w-8 h-8 text-sand-300 mx-auto mb-3" />
                <p className="font-serif italic text-spa-medium text-sm">
                  Nenhuma foto publicada ainda.
                </p>
                {isOwnProfile && (
                  <p className="text-[10px] text-spa-light mt-1">
                    Compartilhe momentos do seu bem-estar ✨
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => openPhotoModal(photo)}
                    className="group relative aspect-square rounded-2xl overflow-hidden border border-sand-200/50 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-quartz-300"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || "Foto"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="flex items-center gap-1 text-white text-[10px] font-bold">
                        <Heart className="w-3 h-3 fill-white/80" />
                        {photo.likes.length}
                      </span>
                      <div className="flex gap-1.5 text-[10px]">
                        {photo.reactions.love > 0 && (
                          <span className="text-white/90">❤️ {photo.reactions.love}</span>
                        )}
                        {photo.reactions.wow > 0 && (
                          <span className="text-white/90">🤩 {photo.reactions.wow}</span>
                        )}
                        {photo.reactions.cool > 0 && (
                          <span className="text-white/90">😎 {photo.reactions.cool}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════
           MURAL DE RECADOS (SCRAPS) TAB
           ═══════════════════════════════════════════════ */}
        {activeTab === "recados" && (
          <section className="space-y-6">
            {socialProfile?.allowScraps === false ? (
              <div className="bg-white/50 border border-sand-200/50 rounded-3xl p-10 text-center">
                <MessageCircle className="w-8 h-8 text-sand-300 mx-auto mb-3" />
                <p className="font-serif italic text-spa-medium text-sm">
                  Este membro não ativou o mural de recados.
                </p>
              </div>
            ) : (
              <>
                {/* Write scrap (only for friends or own profile) */}
                {(isFriend || isOwnProfile) && !isOwnProfile && (
                  <div className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-5 shadow-sm space-y-3">
                    <h3 className="font-serif text-sm text-spa-dark">
                      Deixar um Recado
                    </h3>
                    <textarea
                      value={newScrapContent}
                      onChange={(e) => setNewScrapContent(e.target.value)}
                      placeholder="Escreva um recado carinhoso…"
                      rows={3}
                      className="w-full p-3 bg-ivory/50 border border-sand-200 rounded-xl text-xs text-spa-dark placeholder-spa-light outline-none font-medium focus:ring-1 focus:ring-quartz-300 resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handlePostScrap}
                        disabled={scrapSubmitting || !newScrapContent.trim()}
                        className="flex items-center gap-2 py-2.5 px-6 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md transition-all cursor-pointer disabled:bg-sand-200"
                      >
                        {scrapSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            Enviar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Scraps list */}
                {scrapsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-quartz-400" />
                  </div>
                ) : scraps.length === 0 ? (
                  <div className="bg-white/50 border border-sand-200/50 rounded-3xl p-10 text-center">
                    <MessageCircle className="w-8 h-8 text-sand-300 mx-auto mb-3" />
                    <p className="font-serif italic text-spa-medium text-sm">
                      Nenhum recado no mural ainda.
                    </p>
                    {isFriend && (
                      <p className="text-[10px] text-spa-light mt-1">
                        Seja a primeira a deixar um recado! 💌
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scraps.map((scrap) => (
                      <div
                        key={scrap.id}
                        className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-5 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          {/* Author avatar */}
                          <Link
                            href={`/social/profile/${scrap.authorId}`}
                            className="shrink-0"
                          >
                            {scrap.authorPhoto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={scrap.authorPhoto}
                                alt={scrap.authorName}
                                className="w-9 h-9 rounded-full object-cover border border-sand-200"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400 border border-sand-200">
                                <UserIcon className="w-4.5 h-4.5" />
                              </div>
                            )}
                          </Link>

                          {/* Content */}
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <Link
                                href={`/social/profile/${scrap.authorId}`}
                                className="text-xs font-semibold text-spa-dark hover:text-quartz-500 transition-colors"
                              >
                                {scrap.authorName}
                              </Link>
                              <span className="text-[9px] text-spa-light font-medium shrink-0">
                                {formatDate(scrap.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-spa-medium font-light leading-relaxed mt-1.5 whitespace-pre-wrap">
                              {scrap.content}
                            </p>
                          </div>

                          {/* Delete (only profile owner) */}
                          {isOwnProfile && (
                            <button
                              onClick={() => handleDeleteScrap(scrap.id)}
                              className="p-1.5 rounded-full text-spa-light hover:text-red-500 hover:bg-red-50/50 transition-all cursor-pointer shrink-0"
                              title="Excluir recado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════
           COMUNIDADES TAB
           ═══════════════════════════════════════════════ */}
        {activeTab === "comunidades" && (
          <section className="space-y-4">
            {communitiesLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-quartz-400" />
              </div>
            ) : communities.length === 0 ? (
              <div className="bg-white/50 border border-sand-200/50 rounded-3xl p-10 text-center">
                <Users className="w-8 h-8 text-sand-300 mx-auto mb-3" />
                <p className="font-serif italic text-spa-medium text-sm">
                  {isOwnProfile
                    ? "Você ainda não participa de nenhuma comunidade."
                    : "Este membro não participa de nenhuma comunidade visível."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {communities.map((community) => (
                  <Link
                    key={community.id}
                    href={`/social/communities/${community.id}`}
                    className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-5 shadow-sm hover:shadow-md transition-all group block"
                  >
                    <div className="flex items-center gap-4">
                      {/* Community icon */}
                      <div className="w-12 h-12 rounded-2xl bg-lavender-50 border border-lavender-200/50 flex items-center justify-center shrink-0 group-hover:bg-lavender-100 transition-colors">
                        {community.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={community.imageUrl}
                            alt={community.name}
                            className="w-full h-full rounded-2xl object-cover"
                          />
                        ) : (
                          <Users className="w-5 h-5 text-lavender-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-grow min-w-0">
                        <h4 className="text-xs font-semibold text-spa-dark group-hover:text-quartz-500 transition-colors truncate">
                          {community.name}
                        </h4>
                        {community.category && (
                          <span className="text-[9px] bg-quartz-50 text-quartz-600 font-bold px-2 py-0.5 rounded-full border border-quartz-200 uppercase tracking-widest inline-block mt-1">
                            {community.category}
                          </span>
                        )}
                        <p className="text-[10px] text-spa-light font-medium mt-1">
                          {community.memberCount}{" "}
                          {community.memberCount === 1 ? "membro" : "membros"}
                        </p>
                      </div>

                      <ExternalLink className="w-4 h-4 text-sand-300 group-hover:text-quartz-400 transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════
         PHOTO DETAIL MODAL
         ═══════════════════════════════════════════════════ */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-sand-200 rounded-[2.5rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-[scaleUp_0.25s_ease]">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-sand-100/60 px-6 py-4 rounded-t-[2.5rem] flex items-center justify-between">
              <h3 className="font-serif text-base text-spa-dark font-light">
                Foto
              </h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 rounded-full text-spa-light hover:bg-sand-50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image */}
            <div className="px-6 pt-4">
              <div className="rounded-2xl overflow-hidden border border-sand-200/50 bg-sand-50/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPhoto.imageUrl}
                  alt={selectedPhoto.caption || "Foto"}
                  className="w-full max-h-[50vh] object-contain bg-sand-50"
                />
              </div>
            </div>

            {/* Caption */}
            {selectedPhoto.caption && (
              <div className="px-6 pt-3">
                <p className="text-xs text-spa-medium font-light leading-relaxed">
                  {selectedPhoto.caption}
                </p>
              </div>
            )}

            {/* Like & Reactions Bar */}
            <div className="px-6 pt-4 flex items-center gap-4 flex-wrap">
              {/* Like button */}
              <button
                onClick={() => handleToggleLike(selectedPhoto)}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  currentUser && selectedPhoto.likes.includes(currentUser.uid)
                    ? "text-quartz-500"
                    : "text-spa-medium hover:text-quartz-500"
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${
                    currentUser && selectedPhoto.likes.includes(currentUser.uid)
                      ? "fill-quartz-400"
                      : ""
                  }`}
                />
                {selectedPhoto.likes.length}
              </button>

              <div className="h-4 w-px bg-sand-200" />

              {/* Reaction buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReaction(selectedPhoto, "love")}
                  className="flex items-center gap-1 text-xs text-spa-medium hover:text-quartz-500 transition-colors cursor-pointer px-2 py-1 rounded-full hover:bg-quartz-50"
                >
                  ❤️{" "}
                  <span className="text-[10px] font-semibold">
                    {selectedPhoto.reactions.love || 0}
                  </span>
                </button>
                <button
                  onClick={() => handleReaction(selectedPhoto, "wow")}
                  className="flex items-center gap-1 text-xs text-spa-medium hover:text-quartz-500 transition-colors cursor-pointer px-2 py-1 rounded-full hover:bg-quartz-50"
                >
                  🤩{" "}
                  <span className="text-[10px] font-semibold">
                    {selectedPhoto.reactions.wow || 0}
                  </span>
                </button>
                <button
                  onClick={() => handleReaction(selectedPhoto, "cool")}
                  className="flex items-center gap-1 text-xs text-spa-medium hover:text-quartz-500 transition-colors cursor-pointer px-2 py-1 rounded-full hover:bg-quartz-50"
                >
                  😎{" "}
                  <span className="text-[10px] font-semibold">
                    {selectedPhoto.reactions.cool || 0}
                  </span>
                </button>
              </div>
            </div>

            {/* Comments Section */}
            <div className="px-6 pt-5 pb-6 space-y-4">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-spa-light">
                Comentários
              </h4>

              {/* Comment Input */}
              <div className="flex items-start gap-3">
                {currentUser?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.photoURL}
                    alt="Você"
                    className="w-8 h-8 rounded-full object-cover border border-sand-200 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400 shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-grow flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    placeholder="Escreva um comentário…"
                    className="flex-grow p-2.5 bg-ivory/60 border border-sand-200 rounded-xl text-xs text-spa-dark placeholder-spa-light outline-none font-medium focus:ring-1 focus:ring-quartz-300"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={commentSubmitting || !newComment.trim()}
                    className="p-2.5 bg-spa-dark hover:bg-quartz-400 text-white rounded-xl transition-all cursor-pointer disabled:bg-sand-200 shrink-0"
                  >
                    {commentSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Comments List */}
              {commentsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-quartz-400" />
                </div>
              ) : photoComments.length === 0 ? (
                <p className="text-[10px] text-spa-light text-center py-4 font-medium italic">
                  Nenhum comentário ainda. Seja a primeira! 💬
                </p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {photoComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="flex items-start gap-2.5 bg-sand-50/50 rounded-2xl p-3 border border-sand-100/40"
                    >
                      <Link
                        href={`/social/profile/${comment.authorId}`}
                        className="shrink-0"
                      >
                        {comment.authorPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={comment.authorPhoto}
                            alt={comment.authorName}
                            className="w-7 h-7 rounded-full object-cover border border-sand-200"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400">
                            <UserIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </Link>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/social/profile/${comment.authorId}`}
                            className="text-[10px] font-semibold text-spa-dark hover:text-quartz-500 transition-colors"
                          >
                            {comment.authorName}
                          </Link>
                          <span className="text-[8px] text-spa-light font-medium">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-[10px] text-spa-medium font-light leading-relaxed mt-0.5">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
         EDIT PROFILE MODAL
         ═══════════════════════════════════════════════════ */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-sand-200 rounded-[2.5rem] p-6 max-w-md w-full shadow-xl space-y-5 animate-[scaleUp_0.25s_ease] max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="font-serif text-lg text-spa-dark font-light flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-quartz-400" />
                Editar Perfil Social
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full text-spa-light hover:bg-sand-50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                Nome de Exibição
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Seu nome no Círculo"
                className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
              />
            </div>

            {/* Localização Fields */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                  Cidade
                </label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="Cidade"
                  className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                  Estado
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={editState}
                  onChange={(e) => setEditState(e.target.value.toUpperCase())}
                  placeholder="UF"
                  className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                  País
                </label>
                <input
                  type="text"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                  placeholder="País"
                  className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
                />
              </div>
            </div>

            {/* Toggle — Share Arrival */}
            <div className="flex items-center justify-between py-2 border-b border-sand-100 pb-2">
              <div>
                <p className="text-xs font-semibold text-spa-dark">
                  Divulgar Chegada
                </p>
                <p className="text-[10px] text-spa-light font-light">
                  Aparecer no painel de novas membras
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditShareArrival(!editShareArrival)}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  editShareArrival ? "bg-olive-400" : "bg-sand-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    editShareArrival ? "left-[calc(100%-1.375rem)]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                Bio
              </label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Conte um pouco sobre você…"
                rows={3}
                className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-light leading-relaxed resize-none focus:ring-1 focus:ring-quartz-300"
              />
            </div>

            {/* Interests */}
            <div className="space-y-2">
              <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                Interesses (separados por vírgula)
              </label>
              <input
                type="text"
                value={editInterests}
                onChange={(e) => setEditInterests(e.target.value)}
                placeholder="yoga, meditação, saúde feminina, ciclos…"
                className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
              />
              {editInterests && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {editInterests
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((tag, i) => (
                      <span
                        key={i}
                        className="text-[8px] bg-lavender-50 text-lavender-500 font-bold px-2 py-0.5 rounded-full border border-lavender-200 uppercase tracking-widest"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                WhatsApp (com código do país)
              </label>
              <input
                type="text"
                value={editWhatsapp}
                onChange={(e) => setEditWhatsapp(e.target.value)}
                placeholder="5511999999999"
                className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
              />
            </div>

            {/* Toggle — Allow Scraps */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-semibold text-spa-dark">
                  Mural de Recados
                </p>
                <p className="text-[10px] text-spa-light font-light">
                  Permitir que amigas deixem recados
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditAllowScraps(!editAllowScraps)}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  editAllowScraps ? "bg-olive-400" : "bg-sand-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    editAllowScraps ? "left-[calc(100%-1.375rem)]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Toggle — Allow Direct Chat */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-semibold text-spa-dark">
                  Chat Direto
                </p>
                <p className="text-[10px] text-spa-light font-light">
                  Permitir mensagens diretas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditAllowDirectChat(!editAllowDirectChat)}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  editAllowDirectChat ? "bg-olive-400" : "bg-sand-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    editAllowDirectChat
                      ? "left-[calc(100%-1.375rem)]"
                      : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end border-t border-sand-100 pt-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="py-2.5 px-5 border border-sand-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-spa-medium hover:bg-sand-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={editSaving}
                className="py-2.5 px-6 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors disabled:bg-sand-200 flex items-center gap-1.5 cursor-pointer"
              >
                {editSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Salvar
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
