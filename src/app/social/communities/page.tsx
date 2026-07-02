"use client";

import React, { useState, useEffect } from "react";
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
} from "firebase/firestore";
import {
  ArrowLeft,
  Plus,
  Search,
  Users,
  X,
  Shield,
  Sparkles,
  Clock,
  CheckCircle2,
  MessageCircle,
  ChevronRight,
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

interface CommunityMember {
  userId: string;
  userName: string;
  userPhoto?: string;
  joinedAt: Date;
  role: "member" | "moderator" | "owner";
}

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  "Saúde",
  "Bem-estar",
  "Maternidade",
  "Relacionamentos",
  "Carreira",
  "Espiritualidade",
  "Humor",
  "Outro",
] as const;

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

export default function CommunitiesPage() {
  const { t } = useLanguage();
  const router = useRouter();

  // Auth & profile
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [communities, setCommunities] = useState<Community[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [feedLoading, setFeedLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<string>(CATEGORIES[0]);
  const [creating, setCreating] = useState(false);

  // Joining state (track which community is being joined)
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Feedback
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
        await loadCommunities(currentUser.uid);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Auto-open modal if ?create=true is in URL query parameters
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "true") {
        setShowCreateModal(true);
      }
    }
  }, []);

  // ── Load communities ───────────────────────────────────────────────────────

  async function loadCommunities(uid: string) {
    setFeedLoading(true);
    setErrorMessage("");
    try {
      const commRef = collection(db, "communities");
      const q = query(commRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const loaded: Community[] = [];
      const joined = new Set<string>();

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
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

        // Check membership
        try {
          const memberRef = doc(db, "communities", docSnap.id, "members", uid);
          const memberSnap = await getDoc(memberRef);
          if (memberSnap.exists()) {
            joined.add(docSnap.id);
          }
        } catch {
          // silently skip — user not a member
        }
      }

      setCommunities(loaded);
      setJoinedIds(joined);
    } catch (err: unknown) {
      console.error("Erro ao carregar comunidades:", err);
      setErrorMessage("Não foi possível carregar as comunidades. Tente novamente.");
    } finally {
      setFeedLoading(false);
    }
  }

  // ── Create community ──────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;

    setCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // 1. Create community document
      const commRef = collection(db, "communities");
      const newDoc = await addDoc(commRef, {
        name: newName.trim(),
        description: newDescription.trim(),
        category: newCategory,
        creatorId: user.uid,
        creatorName: user.displayName || "Membro Nefertiti",
        moderators: [user.uid],
        memberCount: 1,
        createdAt: new Date(),
      });

      // 2. Add creator as first member (owner)
      const memberRef = doc(db, "communities", newDoc.id, "members", user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        userName: user.displayName || "Membro Nefertiti",
        userPhoto: user.photoURL || null,
        joinedAt: new Date(),
        role: "owner",
      } as CommunityMember);

      // Reset form & close modal
      setNewName("");
      setNewDescription("");
      setNewCategory(CATEGORIES[0]);
      setShowCreateModal(false);
      setSuccessMessage("Comunidade criada com sucesso!");

      // Reload
      await loadCommunities(user.uid);
    } catch (err: unknown) {
      console.error("Erro ao criar comunidade:", err);
      setErrorMessage("Erro ao criar comunidade: " + (err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // ── Join community ─────────────────────────────────────────────────────────

  const handleJoin = async (communityId: string) => {
    if (!user) return;
    setJoiningId(communityId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Add member document (use uid as doc id for easy lookup)
      const memberRef = doc(db, "communities", communityId, "members", user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        userName: user.displayName || "Membro Nefertiti",
        userPhoto: user.photoURL || null,
        joinedAt: new Date(),
        role: "member",
      } as CommunityMember);

      // Increment memberCount on community
      const commDocRef = doc(db, "communities", communityId);
      await updateDoc(commDocRef, {
        memberCount: increment(1),
      });

      // Update local state
      setJoinedIds((prev) => new Set(prev).add(communityId));
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === communityId ? { ...c, memberCount: c.memberCount + 1 } : c
        )
      );
      setSuccessMessage("Você entrou na comunidade!");
    } catch (err: unknown) {
      console.error("Erro ao entrar na comunidade:", err);
      setErrorMessage("Erro ao participar: " + (err as Error).message);
    } finally {
      setJoiningId(null);
    }
  };

  // ── Filtered communities ──────────────────────────────────────────────────

  const filtered = communities.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Carregando comunidades...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-ivory bg-grain text-spa-dark pb-20">

      {/* Background Blobs */}
      <div className="absolute top-0 left-[-10%] w-[500px] h-[500px] bg-quartz-100/20 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute bottom-0 right-[-10%] w-[450px] h-[450px] bg-olive-100/25 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-ivory/85 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <Link href="/social" className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">Social</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 py-2.5 px-5 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-[0.15em] shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Criar Comunidade</span>
            <span className="sm:hidden">Criar</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-12 space-y-8">

        {/* ── Heading ──────────────────────────────────────────────────────── */}
        <div className="text-center">
          <span className="text-[9px] bg-quartz-50 text-quartz-600 font-bold px-3 py-1 rounded-full border border-quartz-200 uppercase tracking-widest inline-block mb-3">
            Comunidades
          </span>
          <h2 className="font-serif text-3xl font-light text-spa-dark tracking-wide">
            Nossas Comunidades
          </h2>
          <p className="text-xs text-spa-light font-light max-w-md mx-auto mt-2 leading-relaxed">
            Encontre grupos de mulheres com interesses em comum. Participe de conversas, compartilhe experiências e fortaleça vínculos.
          </p>
        </div>

        {/* ── Feedback messages ────────────────────────────────────────────── */}
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

        {/* ── Search bar ──────────────────────────────────────────────────── */}
        <div className="bg-white/70 border border-sand-200/50 rounded-full px-5 py-3 flex items-center gap-3 shadow-sm">
          <Search className="w-4 h-4 text-spa-light shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar comunidades..."
            className="w-full bg-transparent border-0 text-xs text-spa-dark placeholder-spa-light outline-none font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 rounded-full hover:bg-sand-50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-spa-light" />
            </button>
          )}
        </div>

        {/* ── Communities grid ─────────────────────────────────────────────── */}
        {feedLoading ? (
          <div className="text-center py-10">
            <span className="w-6 h-6 rounded-full border-3 border-quartz-400 border-t-transparent animate-spin inline-block" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/50 border border-sand-200/50 rounded-3xl p-10 text-center">
            <Users className="w-10 h-10 text-sand-300 mx-auto mb-4" />
            <p className="font-serif italic text-spa-medium">
              {searchQuery
                ? "Nenhuma comunidade encontrada com esse nome."
                : "Nenhuma comunidade criada ainda. Seja a primeira!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((community) => {
              const colors = CATEGORY_COLORS[community.category] || CATEGORY_COLORS["Outro"];
              const isMember = joinedIds.has(community.id);
              const isJoining = joiningId === community.id;

              return (
                <div
                  key={community.id}
                  className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col"
                >
                  {/* Category badge + arrow */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[9px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {community.category}
                    </span>
                    <Link
                      href={`/social/communities/${community.id}`}
                      className="p-1.5 rounded-full text-spa-light hover:text-quartz-500 hover:bg-quartz-50/50 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Name & description (clickable to detail) */}
                  <Link
                    href={`/social/communities/${community.id}`}
                    className="block flex-grow"
                  >
                    <h3 className="font-serif text-lg text-spa-dark font-light tracking-wide mb-1.5 group-hover:text-quartz-500 transition-colors">
                      {community.name}
                    </h3>
                    <p className="text-[11px] text-spa-light font-light leading-relaxed line-clamp-2">
                      {community.description || "Sem descrição."}
                    </p>
                  </Link>

                  {/* Footer: member count + action button */}
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-sand-100/40">
                    <div className="flex items-center gap-1.5 text-[10px] text-spa-medium font-semibold">
                      <Users className="w-3.5 h-3.5" />
                      <span>{community.memberCount} {community.memberCount === 1 ? "membro" : "membros"}</span>
                    </div>

                    {isMember ? (
                      <span className="flex items-center gap-1.5 py-2 px-4 bg-olive-50 text-olive-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-olive-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Membro ✓
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleJoin(community.id);
                        }}
                        disabled={isJoining}
                        className="flex items-center gap-1.5 py-2.5 px-5 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-[0.15em] shadow-md transition-all cursor-pointer disabled:bg-sand-200"
                      >
                        {isJoining ? (
                          <span className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
                        ) : (
                          <>
                            <Users className="w-3.5 h-3.5" />
                            <span>Participar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Create Community Modal ────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-sand-200 rounded-[2.5rem] p-6 max-w-md w-full shadow-xl space-y-5 animate-scaleUp">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="font-serif text-lg text-spa-dark font-light flex items-center gap-2">
                <Plus className="w-4 h-4 text-quartz-400" />
                Criar Comunidade
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full text-spa-light hover:bg-sand-50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                  Nome da comunidade
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Mães de Primeira Viagem"
                  required
                  maxLength={80}
                  className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                  Descrição
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Descreva o propósito da comunidade..."
                  rows={3}
                  maxLength={300}
                  className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-light leading-relaxed resize-none focus:ring-1 focus:ring-quartz-300"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-spa-light">
                  Categoria
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-3 bg-ivory border border-sand-200 rounded-xl text-xs text-spa-dark outline-none font-medium focus:ring-1 focus:ring-quartz-300"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end border-t border-sand-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2.5 px-5 border border-sand-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-spa-medium hover:bg-sand-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="flex items-center gap-1.5 py-2.5 px-6 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:bg-sand-200"
                >
                  {creating ? (
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
