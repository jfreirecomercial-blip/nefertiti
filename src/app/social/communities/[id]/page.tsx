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
  addDoc,
  doc,
  getDoc,
  updateDoc,
  increment,
  setDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import {
  ArrowLeft,
  Plus,
  Users,
  X,
  Shield,
  Sparkles,
  Clock,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Send,
  Heart,
  SmilePlus,
  User as UserIcon,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  creatorId: string;
  creatorName: string;
  moderators: string[];
  memberCount: number;
  imageUrl?: string;
  createdAt: Date;
}

interface CommunityTopic {
  id: string;
  title: string;
  creatorId: string;
  creatorName: string;
  creatorPhoto?: string;
  isAnonymous: boolean;
  createdAt: Date;
  lastActiveAt: Date;
  postCount: number;
}

interface TopicPost {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  isAnonymous: boolean;
  createdAt: Date;
  reactions: {
    love: string[];
    hug: string[];
    sad: string[];
    laugh: string[];
  };
}

// ─── Reaction config ─────────────────────────────────────────────────────────

const REACTIONS = [
  { key: "love",  emoji: "❤️", label: "Amor" },
  { key: "hug",   emoji: "🤗", label: "Abraço" },
  { key: "sad",   emoji: "😢", label: "Tristeza" },
  { key: "laugh", emoji: "😂", label: "Risada" },
] as const;

// ─── Category colors (mirrored from listing page) ────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Saúde":            { bg: "bg-olive-50",    text: "text-olive-700",    border: "border-olive-200" },
  "Bem-estar":        { bg: "bg-lavender-50",  text: "text-lavender-700", border: "border-lavender-200" },
  "Maternidade":      { bg: "bg-quartz-50",    text: "text-quartz-600",   border: "border-quartz-200" },
  "Relacionamentos":  { bg: "bg-sand-50",      text: "text-sand-600",     border: "border-sand-200" },
  "Carreira":         { bg: "bg-quartz-50",    text: "text-quartz-600",   border: "border-quartz-200" },
  "Espiritualidade":  { bg: "bg-lavender-50",  text: "text-lavender-700", border: "border-lavender-200" },
  "Humor":            { bg: "bg-olive-50",     text: "text-olive-700",    border: "border-olive-200" },
  "Outro":            { bg: "bg-sand-50",      text: "text-sand-500",     border: "border-sand-200" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const { t } = useLanguage();
  const router = useRouter();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Community data
  const [community, setCommunity] = useState<Community | null>(null);
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // Expanded topic states
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [topicPosts, setTopicPosts] = useState<Record<string, TopicPost[]>>({});
  const [postsLoading, setPostsLoading] = useState<string | null>(null);

  // Reply form
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyAnonymous, setReplyAnonymous] = useState<Record<string, boolean>>({});
  const [replying, setReplying] = useState<string | null>(null);

  // Create topic modal
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicAnonymous, setTopicAnonymous] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);

  // Feedback
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ── Load community & topics ────────────────────────────────────────────────

  const loadCommunity = useCallback(async () => {
    try {
      const commDocRef = doc(db, "communities", id);
      const commSnap = await getDoc(commDocRef);
      if (!commSnap.exists()) {
        setErrorMessage("Comunidade não encontrada.");
        return;
      }
      const data = commSnap.data();
      setCommunity({
        id: commSnap.id,
        name: data.name || "",
        description: data.description || "",
        category: data.category || "Outro",
        creatorId: data.creatorId || "",
        creatorName: data.creatorName || "",
        moderators: data.moderators || [],
        memberCount: data.memberCount || 0,
        imageUrl: data.imageUrl,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      });
    } catch (err: unknown) {
      console.error("Erro ao carregar comunidade:", err);
      setErrorMessage("Erro ao carregar comunidade.");
    }
  }, [id]);

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      const topicsRef = collection(db, "communities", id, "topics");
      const q = query(topicsRef, orderBy("lastActiveAt", "desc"));
      const snapshot = await getDocs(q);

      const loaded: CommunityTopic[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          title: data.title || "",
          creatorId: data.creatorId || "",
          creatorName: data.creatorName || "",
          creatorPhoto: data.creatorPhoto,
          isAnonymous: data.isAnonymous || false,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          lastActiveAt: data.lastActiveAt?.toDate ? data.lastActiveAt.toDate() : new Date(),
          postCount: data.postCount || 0,
        });
      });
      setTopics(loaded);
    } catch (err: unknown) {
      console.error("Erro ao carregar tópicos:", err);
      setErrorMessage("Erro ao carregar tópicos do fórum.");
    } finally {
      setTopicsLoading(false);
    }
  }, [id]);

  // ── Auth guard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.role === "partner") {
              router.push("/dashboard/partner");
              return;
            }
          }
        } catch (err) {
          console.error("Erro ao carregar dados do usuário:", err);
        }
        await loadCommunity();
        await loadTopics();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, loadCommunity, loadTopics]);

  // ── Load posts for a topic (accordion expand) ──────────────────────────────

  const loadPostsForTopic = async (topicId: string) => {
    setPostsLoading(topicId);
    try {
      const postsRef = collection(db, "communities", id, "topics", topicId, "posts");
      const q = query(postsRef, orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);

      const loaded: TopicPost[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          content: data.content || "",
          authorId: data.authorId || "",
          authorName: data.authorName || "Membro",
          authorPhoto: data.authorPhoto,
          isAnonymous: data.isAnonymous || false,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          reactions: {
            love: data.reactions?.love || [],
            hug: data.reactions?.hug || [],
            sad: data.reactions?.sad || [],
            laugh: data.reactions?.laugh || [],
          },
        });
      });
      setTopicPosts((prev) => ({ ...prev, [topicId]: loaded }));
    } catch (err: unknown) {
      console.error("Erro ao carregar posts:", err);
    } finally {
      setPostsLoading(null);
    }
  };

  const handleToggleTopic = async (topicId: string) => {
    if (expandedTopicId === topicId) {
      // Collapse
      setExpandedTopicId(null);
    } else {
      // Expand and load posts
      setExpandedTopicId(topicId);
      if (!topicPosts[topicId]) {
        await loadPostsForTopic(topicId);
      }
    }
  };

  // ── Create topic ──────────────────────────────────────────────────────────

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !topicTitle.trim()) return;

    setCreatingTopic(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const topicsRef = collection(db, "communities", id, "topics");
      await addDoc(topicsRef, {
        title: topicTitle.trim(),
        creatorId: user.uid,
        creatorName: user.displayName || "Membro Nefertiti",
        creatorPhoto: user.photoURL || null,
        isAnonymous: topicAnonymous,
        postCount: 0,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      });

      setTopicTitle("");
      setTopicAnonymous(false);
      setShowTopicModal(false);
      setSuccessMessage("Tópico criado com sucesso!");

      await loadTopics();
    } catch (err: unknown) {
      console.error("Erro ao criar tópico:", err);
      setErrorMessage("Erro ao criar tópico: " + (err as Error).message);
    } finally {
      setCreatingTopic(false);
    }
  };

  // ── Reply to topic ─────────────────────────────────────────────────────────

  const handleReply = async (topicId: string, topicIsAnonymous: boolean) => {
    const content = replyContent[topicId]?.trim();
    if (!user || !content) return;

    setReplying(topicId);
    setErrorMessage("");

    try {
      // 1. Add post to subcollection
      const postsRef = collection(db, "communities", id, "topics", topicId, "posts");
      // If the topic is anonymous, the reply inherits the anonymous setting;
      // otherwise user can choose per-reply anonymity
      const isAnon = topicIsAnonymous || (replyAnonymous[topicId] ?? false);

      const newPostDoc = await addDoc(postsRef, {
        content,
        authorId: user.uid,
        authorName: user.displayName || "Membro Nefertiti",
        authorPhoto: user.photoURL || null,
        isAnonymous: isAnon,
        createdAt: new Date(),
        reactions: { love: [], hug: [], sad: [], laugh: [] },
      });

      // 2. Increment postCount and update lastActiveAt on the topic
      const topicDocRef = doc(db, "communities", id, "topics", topicId);
      await updateDoc(topicDocRef, {
        postCount: increment(1),
        lastActiveAt: new Date(),
      });

      // 3. Update local state
      const newPost: TopicPost = {
        id: newPostDoc.id,
        content,
        authorId: user.uid,
        authorName: user.displayName || "Membro Nefertiti",
        authorPhoto: user.photoURL || undefined,
        isAnonymous: isAnon,
        createdAt: new Date(),
        reactions: { love: [], hug: [], sad: [], laugh: [] },
      };
      setTopicPosts((prev) => ({
        ...prev,
        [topicId]: [...(prev[topicId] || []), newPost],
      }));
      setTopics((prev) =>
        prev.map((t) =>
          t.id === topicId
            ? { ...t, postCount: t.postCount + 1, lastActiveAt: new Date() }
            : t
        )
      );

      // Clear reply input
      setReplyContent((prev) => ({ ...prev, [topicId]: "" }));
      setReplyAnonymous((prev) => ({ ...prev, [topicId]: false }));
    } catch (err: unknown) {
      console.error("Erro ao responder:", err);
      setErrorMessage("Erro ao enviar resposta: " + (err as Error).message);
    } finally {
      setReplying(null);
    }
  };

  // ── Toggle reaction ────────────────────────────────────────────────────────

  const handleReaction = async (
    topicId: string,
    postId: string,
    reactionKey: string
  ) => {
    if (!user) return;

    const postDocRef = doc(
      db,
      "communities",
      id,
      "topics",
      topicId,
      "posts",
      postId
    );

    // Find current post
    const currentPosts = topicPosts[topicId] || [];
    const post = currentPosts.find((p) => p.id === postId);
    if (!post) return;

    const reactionArray =
      post.reactions[reactionKey as keyof typeof post.reactions] || [];
    const alreadyReacted = reactionArray.includes(user.uid);

    try {
      // Toggle: if already reacted, remove; else add
      await updateDoc(postDocRef, {
        [`reactions.${reactionKey}`]: alreadyReacted
          ? arrayRemove(user.uid)
          : arrayUnion(user.uid),
      });

      // Update local state
      setTopicPosts((prev) => {
        const updated = (prev[topicId] || []).map((p) => {
          if (p.id !== postId) return p;
          const updatedReactions = { ...p.reactions };
          const arr = [
            ...(updatedReactions[reactionKey as keyof typeof updatedReactions] || []),
          ];
          if (alreadyReacted) {
            const idx = arr.indexOf(user.uid);
            if (idx > -1) arr.splice(idx, 1);
          } else {
            arr.push(user.uid);
          }
          (updatedReactions as Record<string, string[]>)[reactionKey] = arr;
          return { ...p, reactions: updatedReactions };
        });
        return { ...prev, [topicId]: updated };
      });
    } catch (err: unknown) {
      console.error("Erro ao reagir:", err);
    }
  };

  // ── Helper: format relative date ──────────────────────────────────────────

  function formatRelative(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 30) return `${diffD}d`;
    return date.toLocaleDateString("pt-BR");
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">
            Carregando comunidade...
          </p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-serif text-lg text-spa-dark">Comunidade não encontrada</p>
          <Link
            href="/social/communities"
            className="text-xs text-quartz-500 hover:text-quartz-600 underline"
          >
            Voltar às comunidades
          </Link>
        </div>
      </div>
    );
  }

  const catColors = CATEGORY_COLORS[community.category] || CATEGORY_COLORS["Outro"];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-ivory bg-grain text-spa-dark pb-20">

      {/* Background Blobs */}
      <div className="absolute top-0 left-[-10%] w-[500px] h-[500px] bg-quartz-100/20 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute bottom-0 right-[-10%] w-[450px] h-[450px] bg-olive-100/25 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-ivory/85 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <Link
          href="/social/communities"
          className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">
            Comunidades
          </span>
        </Link>
        <button
          onClick={() => setShowTopicModal(true)}
          className="flex items-center gap-1.5 py-2.5 px-5 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-[0.15em] shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Criar Tópico</span>
          <span className="sm:hidden">Tópico</span>
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-12 space-y-8">

        {/* ── Community header card ─────────────────────────────────────────── */}
        <div className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`text-[9px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest ${catColors.bg} ${catColors.text} ${catColors.border}`}
            >
              {community.category}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-spa-medium font-semibold">
              <Users className="w-3.5 h-3.5" />
              <span>
                {community.memberCount}{" "}
                {community.memberCount === 1 ? "membro" : "membros"}
              </span>
            </div>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-light text-spa-dark tracking-wide">
            {community.name}
          </h2>
          {community.description && (
            <p className="text-xs text-spa-light font-light leading-relaxed max-w-lg">
              {community.description}
            </p>
          )}
        </div>

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
        {errorMessage && (
          <div className="p-4 bg-quartz-50 border border-quartz-200/50 rounded-2xl text-xs text-spa-dark">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-4 bg-olive-50 border border-olive-200/30 rounded-2xl text-xs text-olive-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-olive-500 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* ── Topics section heading ──────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-spa-dark font-light tracking-wide">
            Tópicos do Fórum
          </h3>
          <span className="text-[10px] text-spa-light font-medium">
            {topics.length} {topics.length === 1 ? "tópico" : "tópicos"}
          </span>
        </div>

        {/* ── Topics list ─────────────────────────────────────────────────── */}
        {topicsLoading ? (
          <div className="text-center py-10">
            <span className="w-6 h-6 rounded-full border-3 border-quartz-400 border-t-transparent animate-spin inline-block" />
          </div>
        ) : topics.length === 0 ? (
          <div className="bg-white/50 border border-sand-200/50 rounded-3xl p-10 text-center">
            <MessageCircle className="w-10 h-10 text-sand-300 mx-auto mb-4" />
            <p className="font-serif italic text-spa-medium">
              Nenhum tópico criado ainda. Comece uma conversa!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {topics.map((topic) => {
              const isExpanded = expandedTopicId === topic.id;
              const posts = topicPosts[topic.id] || [];
              const isLoadingPosts = postsLoading === topic.id;

              return (
                <div
                  key={topic.id}
                  className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] shadow-sm overflow-hidden transition-all duration-300"
                >
                  {/* ── Topic header (clickable) ───────────────────────────── */}
                  <button
                    onClick={() => handleToggleTopic(topic.id)}
                    className="w-full text-left p-6 flex items-start gap-4 cursor-pointer hover:bg-sand-50/30 transition-colors"
                  >
                    <div className="flex-grow min-w-0">
                      <h4 className="font-serif text-base text-spa-dark font-light tracking-wide mb-2">
                        {topic.title}
                      </h4>
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Author */}
                        <div className="flex items-center gap-1.5">
                          {topic.isAnonymous ? (
                            <>
                              <Shield className="w-3 h-3 text-lavender-500" />
                              <span className="text-[10px] text-lavender-600 font-medium">
                                Anônima
                              </span>
                            </>
                          ) : (
                            <>
                              {topic.creatorPhoto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={topic.creatorPhoto}
                                  alt={topic.creatorName}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                              ) : (
                                <UserIcon className="w-3 h-3 text-spa-light" />
                              )}
                              <span className="text-[10px] text-spa-medium font-medium">
                                {topic.creatorName}
                              </span>
                            </>
                          )}
                        </div>

                        <span className="text-sand-300">·</span>

                        {/* Post count */}
                        <div className="flex items-center gap-1 text-[10px] text-spa-light">
                          <MessageCircle className="w-3 h-3" />
                          <span>{topic.postCount}</span>
                        </div>

                        <span className="text-sand-300">·</span>

                        {/* Last activity */}
                        <div className="flex items-center gap-1 text-[10px] text-spa-light">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelative(topic.lastActiveAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expand/collapse chevron */}
                    <div className="shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-spa-light" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-spa-light" />
                      )}
                    </div>
                  </button>

                  {/* ── Expanded: posts + reply ────────────────────────────── */}
                  {isExpanded && (
                    <div className="border-t border-sand-100/40">
                      {/* Anonymous banner if topic is anonymous */}
                      {topic.isAnonymous && (
                        <div className="mx-6 mt-4 p-3 bg-lavender-50/60 border border-lavender-200/40 rounded-xl flex items-center gap-2">
                          <Shield className="w-4 h-4 text-lavender-500 shrink-0" />
                          <p className="text-[10px] text-lavender-700 font-light leading-relaxed">
                            Este tópico é anônimo. Todas as respostas serão publicadas sem identificação.
                          </p>
                        </div>
                      )}

                      {/* Posts list */}
                      {isLoadingPosts ? (
                        <div className="text-center py-6">
                          <span className="w-5 h-5 rounded-full border-2 border-quartz-400 border-t-transparent animate-spin inline-block" />
                        </div>
                      ) : posts.length === 0 ? (
                        <div className="px-6 py-6 text-center">
                          <p className="text-[11px] text-spa-light font-light italic">
                            Nenhuma resposta ainda. Seja a primeira a responder!
                          </p>
                        </div>
                      ) : (
                        <div className="px-6 py-4 space-y-4">
                          {posts.map((post) => (
                            <div
                              key={post.id}
                              className="bg-ivory/50 border border-sand-100/50 rounded-2xl p-4 space-y-3"
                            >
                              {/* Post header */}
                              <div className="flex items-center gap-2.5">
                                {post.isAnonymous ? (
                                  <div className="w-7 h-7 rounded-full bg-lavender-100 flex items-center justify-center">
                                    <Shield className="w-3.5 h-3.5 text-lavender-500" />
                                  </div>
                                ) : post.authorPhoto ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={post.authorPhoto}
                                    alt={post.authorName}
                                    className="w-7 h-7 rounded-full object-cover border border-sand-200"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400">
                                    <UserIcon className="w-3.5 h-3.5" />
                                  </div>
                                )}
                                <div>
                                  <span className="text-[11px] font-semibold text-spa-dark">
                                    {post.isAnonymous ? "Anônima" : post.authorName}
                                  </span>
                                  <span className="text-[9px] text-spa-light ml-2">
                                    {formatRelative(post.createdAt)}
                                  </span>
                                </div>
                              </div>

                              {/* Post content */}
                              <p className="text-xs text-spa-medium font-light leading-relaxed whitespace-pre-wrap">
                                {post.content}
                              </p>

                              {/* Reactions */}
                              <div className="flex items-center gap-2 flex-wrap pt-1">
                                {REACTIONS.map((r) => {
                                  const arr =
                                    post.reactions[
                                      r.key as keyof typeof post.reactions
                                    ] || [];
                                  const isActive =
                                    user ? arr.includes(user.uid) : false;
                                  const count = arr.length;

                                  return (
                                    <button
                                      key={r.key}
                                      onClick={() =>
                                        handleReaction(topic.id, post.id, r.key)
                                      }
                                      className={`flex items-center gap-1 py-1 px-2.5 rounded-full text-[10px] font-medium transition-all cursor-pointer border ${
                                        isActive
                                          ? "bg-quartz-50 border-quartz-200 text-quartz-600"
                                          : "bg-white/60 border-sand-200/50 text-spa-light hover:bg-sand-50 hover:border-sand-200"
                                      }`}
                                      title={r.label}
                                    >
                                      <span>{r.emoji}</span>
                                      {count > 0 && <span>{count}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply form */}
                      <div className="px-6 pb-6 pt-2">
                        <div className="bg-white/60 border border-sand-200/50 rounded-2xl p-4 space-y-3">
                          <textarea
                            value={replyContent[topic.id] || ""}
                            onChange={(e) =>
                              setReplyContent((prev) => ({
                                ...prev,
                                [topic.id]: e.target.value,
                              }))
                            }
                            placeholder="Escreva sua resposta..."
                            rows={2}
                            className="w-full bg-transparent border-0 resize-none text-xs text-spa-dark placeholder-spa-light outline-none font-medium focus:ring-0"
                          />
                          <div className="flex items-center justify-between">
                            {/* Anonymous toggle (only if topic isn't globally anon) */}
                            {!topic.isAnonymous && (
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={replyAnonymous[topic.id] || false}
                                  onChange={(e) =>
                                    setReplyAnonymous((prev) => ({
                                      ...prev,
                                      [topic.id]: e.target.checked,
                                    }))
                                  }
                                  className="sr-only peer"
                                />
                                <div className="w-8 h-4.5 bg-sand-200 peer-checked:bg-lavender-400 rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3.5 after:h-3.5 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-3.5" />
                                <Shield className="w-3 h-3 text-lavender-500" />
                                <span className="text-[10px] text-spa-light font-medium">
                                  Anônima
                                </span>
                              </label>
                            )}
                            {topic.isAnonymous && (
                              <div className="flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-lavender-500" />
                                <span className="text-[10px] text-lavender-600 font-medium">
                                  Resposta anônima
                                </span>
                              </div>
                            )}

                            <button
                              onClick={() =>
                                handleReply(topic.id, topic.isAnonymous)
                              }
                              disabled={
                                replying === topic.id ||
                                !(replyContent[topic.id]?.trim())
                              }
                              className="flex items-center gap-1.5 py-2 px-5 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-[0.15em] shadow-md transition-all cursor-pointer disabled:bg-sand-200"
                            >
                              {replying === topic.id ? (
                                <span className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
                              ) : (
                                <>
                                  <Send className="w-3 h-3" />
                                  <span>Responder</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Create Topic Modal ────────────────────────────────────────────── */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-sand-200 rounded-[2.5rem] p-6 max-w-md w-full shadow-xl space-y-5 animate-scaleUp">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="font-serif text-lg text-spa-dark font-light flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-quartz-400" />
                Criar Tópico
              </h3>
              <button
                onClick={() => setShowTopicModal(false)}
                className="p-1 rounded-full text-spa-light hover:bg-sand-50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                  Título do tópico
                </label>
                <input
                  type="text"
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="Ex: Alguém mais sente isso no ciclo?"
                  required
                  maxLength={120}
                  className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
                />
              </div>

              {/* Anonymous toggle */}
              <div className="p-4 bg-lavender-50/40 border border-lavender-200/30 rounded-xl space-y-3">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-lavender-500" />
                    <div>
                      <span className="text-xs text-spa-dark font-semibold block">
                        Tópico anônimo
                      </span>
                      <span className="text-[10px] text-spa-light font-light leading-relaxed block mt-0.5">
                        Sua identidade e de quem responder ficará oculta. Ideal para temas sensíveis.
                      </span>
                    </div>
                  </div>
                  <div className="relative shrink-0 ml-3">
                    <input
                      type="checkbox"
                      checked={topicAnonymous}
                      onChange={(e) => setTopicAnonymous(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-sand-200 peer-checked:bg-lavender-400 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4.5 after:h-4.5 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4.5 after:shadow-sm" />
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end border-t border-sand-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="py-2.5 px-5 border border-sand-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-spa-medium hover:bg-sand-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingTopic || !topicTitle.trim()}
                  className="flex items-center gap-1.5 py-2.5 px-6 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:bg-sand-200"
                >
                  {creatingTopic ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Criar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
