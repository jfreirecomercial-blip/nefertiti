"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  limit,
  orderBy,
} from "firebase/firestore";
import {
  ArrowLeft,
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Users,
  Heart,
  Loader2,
  User as UserIcon,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
interface Friendship {
  id: string;
  users: string[];
  status: "pending" | "accepted" | "declined";
  senderId: string;
  createdAt: unknown;
  updatedAt?: unknown;
}

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  email?: string;
  role?: string;
}

interface UserSearchResult extends UserProfile {
  city?: string;
  state?: string;
  country?: string;
  mutualCount?: number;
  mutualFriendNames?: string[];
}

/* ─────────────────────────────────────────────
   Friends Page
   ───────────────────────────────────────────── */
export default function FriendsPage() {
  const { t } = useLanguage();
  const router = useRouter();

  // ── Auth state ──
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Search state ──
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<{city: string, state: string, country: string} | null>(null);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  // ── Pending requests state ──
  const [pendingRequests, setPendingRequests] = useState<
    (Friendship & { senderProfile: UserProfile })[]
  >([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  // ── My friends state ──
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // ── Existing friendship IDs (to hide from search results) ──
  const [existingRelationUserIds, setExistingRelationUserIds] = useState<Set<string>>(new Set());

  // ── Notifications ──
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Auth guard ──
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        // Redirect partners
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
          console.error("Erro ao verificar role:", err);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);



  /* ───────────────────────────
     Data loaders
     ─────────────────────────── */

  /** Load incoming pending friend requests (where current user is the RECEIVER). */
  const loadPendingRequests = useCallback(async () => {
    if (!user) return;
    setLoadingPending(true);
    try {
      const friendshipsRef = collection(db, "friendships");
      const q = query(
        friendshipsRef,
        where("users", "array-contains", user.uid),
        where("status", "==", "pending")
      );
      const snap = await getDocs(q);

      const incoming: (Friendship & { senderProfile: UserProfile })[] = [];
      const relationIds = new Set<string>();

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Omit<Friendship, "id">;
        const friendship: Friendship = { id: docSnap.id, ...data };

        // Track all related user IDs for filtering search results
        friendship.users.forEach((uid) => {
          if (uid !== user.uid) relationIds.add(uid);
        });

        // Only show requests where WE are the receiver (not the sender)
        if (data.senderId === user.uid) continue;

        // Fetch sender profile
        const senderId = data.users.find((uid) => uid !== user.uid) || "";
        try {
          const senderDoc = await getDoc(doc(db, "social_profiles", senderId));
          const senderData = senderDoc.exists() ? senderDoc.data() : {};
          incoming.push({
            ...friendship,
            senderProfile: {
              uid: senderId,
              displayName: senderData.displayName || "Membro",
              photoURL: senderData.photoURL,
              email: senderData.email,
            },
          });
        } catch {
          incoming.push({
            ...friendship,
            senderProfile: {
              uid: senderId,
              displayName: "Membro",
            },
          });
        }
      }

      setPendingRequests(incoming);
      setExistingRelationUserIds((prev) => new Set([...prev, ...relationIds]));
    } catch (err) {
      console.error("Erro ao carregar pedidos pendentes:", err);
    } finally {
      setLoadingPending(false);
    }
  }, [user]);

  /** Load accepted friends. */
  const loadFriends = useCallback(async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      const friendshipsRef = collection(db, "friendships");
      const q = query(
        friendshipsRef,
        where("users", "array-contains", user.uid),
        where("status", "==", "accepted")
      );
      const snap = await getDocs(q);

      const loadedFriends: UserProfile[] = [];
      const relationIds = new Set<string>();

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const friendId = (data.users as string[]).find((uid) => uid !== user.uid) || "";
        relationIds.add(friendId);

        try {
          const friendDoc = await getDoc(doc(db, "social_profiles", friendId));
          const friendData = friendDoc.exists() ? friendDoc.data() : {};
          loadedFriends.push({
            uid: friendId,
            displayName: friendData.displayName || "Membro",
            photoURL: friendData.photoURL,
            email: friendData.email,
          });
        } catch {
          loadedFriends.push({ uid: friendId, displayName: "Membro" });
        }
      }

      setFriends(loadedFriends);
      setExistingRelationUserIds((prev) => new Set([...prev, ...relationIds]));
    } catch (err) {
      console.error("Erro ao carregar amigas:", err);
    } finally {
      setLoadingFriends(false);
    }
  }, [user]);

  // ── Load pending requests & friends once auth resolves ──
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        loadPendingRequests();
        loadFriends();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, loadPendingRequests, loadFriends]);

  // Load current user location
  useEffect(() => {
    if (!user) return;
    const fetchLocation = async () => {
      try {
        const snap = await getDoc(doc(db, "social_profiles", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setCurrentUserLocation({
            city: d.city || "",
            state: d.state || "",
            country: d.country || "Brasil"
          });
        }
      } catch (err) {
        console.error("Erro ao carregar localização do usuário atual:", err);
      }
    };
    fetchLocation();
  }, [user]);

  /** Helper to calculate proximity score */
  const getProximityScore = (target: any, current: any) => {
    if (!target || !current) return 0;
    let score = 0;
    if (
      target.city && current.city && target.city.toLowerCase() === current.city.toLowerCase() &&
      target.state && current.state && target.state.toLowerCase() === current.state.toLowerCase()
    ) {
      score += 3;
    }
    if (target.state && current.state && target.state.toLowerCase() === current.state.toLowerCase()) {
      score += 2;
    }
    if (target.country && current.country && target.country.toLowerCase() === current.country.toLowerCase()) {
      score += 1;
    }
    return score;
  };

  /* ───────────────────────────
     Search users by name prefix
     ─────────────────────────── */
  useEffect(() => {
    if (!user) return;

    if (!searchTerm.trim()) {
      const timer = setTimeout(() => {
        setSearchResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }

    const debounce = setTimeout(async () => {
      setSearching(true);
      try {
        const term = searchTerm.trim().toLowerCase();
        const termWords = term.split(/\s+/).filter(Boolean);
        const firstWord = termWords[0] || "";

        const socialProfilesRef = collection(db, "social_profiles");
        // Query by first word to get candidate matches
        const q = query(
          socialProfilesRef,
          where("displayNameWords", "array-contains", firstWord),
          limit(50)
        );
        const snap = await getDocs(q);

        const results: UserSearchResult[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (docSnap.id === user.uid) return;
          if (existingRelationUserIds.has(docSnap.id)) return;

          // Locally filter for all subsequent search words
          const nameLower = (data.displayName || "").toLowerCase();
          const matchesAllWords = termWords.every(word => nameLower.includes(word));
          if (!matchesAllWords) return;

          results.push({
            uid: docSnap.id,
            displayName: data.displayName || "Membro",
            photoURL: data.photoURL || undefined,
            email: data.email || undefined,
            city: data.city || "",
            state: data.state || "",
            country: data.country || "",
          });
        });

        // Fetch mutual friends in parallel for search results
        const myFriendUids = new Set(friends.map(f => f.uid));
        const resultsWithMutual = await Promise.all(
          results.map(async (resUser) => {
            let mutualCount = 0;
            const mutualFriendNames: string[] = [];

            try {
              const qFriend = query(
                collection(db, "friendships"),
                where("users", "array-contains", resUser.uid),
                where("status", "==", "accepted")
              );
              const snapFriend = await getDocs(qFriend);
              snapFriend.forEach((d) => {
                const uids = d.data().users as string[];
                const otherUid = uids.find(id => id !== resUser.uid);
                if (otherUid && myFriendUids.has(otherUid)) {
                  mutualCount++;
                  const friendObj = friends.find(f => f.uid === otherUid);
                  if (friendObj) {
                    mutualFriendNames.push(friendObj.displayName);
                  }
                }
              });
            } catch (err) {
              console.error("Erro ao carregar amigas em comum para:", resUser.uid, err);
            }

            return {
              ...resUser,
              mutualCount,
              mutualFriendNames,
            };
          })
        );

        // Sort by: Exact Match -> Mutual Friends -> Proximity -> Alphabetical
        resultsWithMutual.sort((a, b) => {
          const aExact = a.displayName.toLowerCase() === term ? 1 : 0;
          const bExact = b.displayName.toLowerCase() === term ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;

          if ((a.mutualCount || 0) !== (b.mutualCount || 0)) {
            return (b.mutualCount || 0) - (a.mutualCount || 0);
          }

          const aProx = getProximityScore(a, currentUserLocation);
          const bProx = getProximityScore(b, currentUserLocation);
          if (aProx !== bProx) return bProx - aProx;

          return a.displayName.localeCompare(b.displayName);
        });

        setSearchResults(resultsWithMutual);
      } catch (err) {
        console.error("Erro na busca de usuários:", err);
      } finally {
        setSearching(false);
      }
    }, 400); // debounce 400ms

    return () => clearTimeout(debounce);
  }, [searchTerm, user, existingRelationUserIds, friends, currentUserLocation]);

  /* ───────────────────────────
     Actions
     ─────────────────────────── */

  /** Send a friend request. */
  const handleSendRequest = async (targetUser: UserProfile) => {
    if (!user) return;
    setSendingRequest(targetUser.uid);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await addDoc(collection(db, "friendships"), {
        users: [user.uid, targetUser.uid],
        status: "pending",
        senderId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSuccessMsg(`Pedido enviado para ${targetUser.displayName}!`);
      // Add to existing relation set so they disappear from search
      setExistingRelationUserIds((prev) => new Set([...prev, targetUser.uid]));
      setSearchResults((prev) => prev.filter((u) => u.uid !== targetUser.uid));
    } catch (err) {
      console.error("Erro ao enviar pedido:", err);
      setErrorMsg("Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setSendingRequest(null);
    }
  };

  /** Accept a friend request. */
  const handleAcceptRequest = async (friendshipId: string) => {
    setProcessingRequest(friendshipId);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await updateDoc(doc(db, "friendships", friendshipId), {
        status: "accepted",
        updatedAt: new Date().toISOString(),
      });
      setSuccessMsg("Amizade aceita! 🎉");
      // Refresh both lists
      await Promise.all([loadPendingRequests(), loadFriends()]);
    } catch (err) {
      console.error("Erro ao aceitar pedido:", err);
      setErrorMsg("Erro ao aceitar o pedido.");
    } finally {
      setProcessingRequest(null);
    }
  };

  /** Decline a friend request. */
  const handleDeclineRequest = async (friendshipId: string) => {
    setProcessingRequest(friendshipId);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await updateDoc(doc(db, "friendships", friendshipId), {
        status: "declined",
        updatedAt: new Date().toISOString(),
      });
      setSuccessMsg("Pedido recusado.");
      await loadPendingRequests();
    } catch (err) {
      console.error("Erro ao recusar pedido:", err);
      setErrorMsg("Erro ao recusar o pedido.");
    } finally {
      setProcessingRequest(null);
    }
  };

  /* ───────────────────────────
     Render helpers
     ─────────────────────────── */

  /** Shared avatar component */
  const Avatar = ({
    src,
    name,
    size = "w-10 h-10",
  }: {
    src?: string;
    name: string;
    size?: string;
  }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${size} rounded-full object-cover border border-sand-200`}
      />
    ) : (
      <div
        className={`${size} rounded-full bg-quartz-100 flex items-center justify-center text-quartz-400 border border-sand-200`}
      >
        <UserIcon className="w-1/2 h-1/2" />
      </div>
    );

  /* ───────────────────────────
     Loading screen
     ─────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 rounded-full border-4 border-quartz-400 border-t-transparent animate-spin inline-block mb-4" />
          <p className="font-serif italic text-spa-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  /* ───────────────────────────
     Main render
     ─────────────────────────── */
  return (
    <div className="min-h-screen bg-ivory bg-grain text-spa-dark pb-20">
      {/* Background Blobs */}
      <div className="absolute top-0 left-[-10%] w-[500px] h-[500px] bg-quartz-100/20 rounded-full blur-[120px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute bottom-0 right-[-10%] w-[450px] h-[450px] bg-olive-100/25 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-ivory/85 backdrop-blur-md border-b border-sand-100/60 px-6 lg:px-20 py-5 flex items-center justify-between">
        <Link
          href="/social"
          className="flex items-center gap-2 text-spa-dark hover:text-quartz-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">Círculo</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-spa-light font-medium">
            <Users className="w-3.5 h-3.5" />
            <span>{friends.length} amigas</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-12 space-y-8">
        {/* Page Heading */}
        <div className="text-center">
          <span className="text-[9px] bg-lavender-50 text-lavender-600 font-bold px-3 py-1 rounded-full border border-lavender-200 uppercase tracking-widest inline-block mb-3">
            Rede de Amizade
          </span>
          <h2 className="font-serif text-3xl font-light text-spa-dark tracking-wide">
            Minhas Amigas
          </h2>
          <p className="text-xs text-spa-light font-light max-w-md mx-auto mt-2 leading-relaxed">
            Encontre membros, envie pedidos de amizade e gerencie suas conexões no círculo.
          </p>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-4 bg-quartz-50 border border-quartz-200/50 rounded-2xl text-xs text-spa-dark">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-olive-50 border border-olive-200/30 rounded-2xl text-xs text-olive-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-olive-500 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* ═══════════════════════════════════════
           SECTION 1 — Search Users
           ═══════════════════════════════════════ */}
        <section className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-lavender-50 flex items-center justify-center border border-lavender-100">
              <Search className="w-3.5 h-3.5 text-lavender-500" />
            </div>
            <h3 className="font-serif text-lg text-spa-dark font-light">
              Buscar Membros
            </h3>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-spa-light pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome para buscar..."
              className="w-full pl-11 pr-4 py-3.5 bg-ivory/60 border border-sand-200/60 rounded-full text-xs text-spa-dark placeholder-spa-light outline-none focus:ring-2 focus:ring-lavender-200/60 focus:border-lavender-300 transition-all font-medium"
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-lavender-400 animate-spin" />
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2.5">
              {searchResults.map((result) => (
                <div
                  key={result.uid}
                  className="flex items-center justify-between gap-3 p-3.5 bg-ivory/40 border border-sand-100/50 rounded-2xl hover:bg-sand-50/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Link href={`/social/profile/${result.uid}`} className="shrink-0">
                      <Avatar src={result.photoURL} name={result.displayName} size="w-9 h-9" />
                    </Link>
                    <div className="min-w-0">
                      <Link 
                        href={`/social/profile/${result.uid}`} 
                        className="text-xs font-semibold text-spa-dark truncate hover:text-quartz-500 transition-colors block"
                      >
                        {result.displayName}
                      </Link>
                      
                      {/* Localização */}
                      {(result.city || result.state) ? (
                        <p className="text-[9px] text-spa-light font-medium truncate mt-0.5">
                          {result.city}{result.city && result.state && ", "}{result.state}
                        </p>
                      ) : (
                        result.country && (
                          <p className="text-[9px] text-spa-light font-medium truncate mt-0.5">
                            {result.country}
                          </p>
                        )
                      )}

                      {/* Amigas em comum */}
                      {result.mutualCount !== undefined && result.mutualCount > 0 && (
                        <p className="text-[9px] text-lavender-600 font-semibold mt-1">
                          {result.mutualCount} {result.mutualCount === 1 ? "amiga" : "amigas"} em comum
                          {result.mutualFriendNames && result.mutualFriendNames.length > 0 && (
                            <span className="text-[8px] text-spa-light font-light ml-1 font-sans">
                              ({result.mutualFriendNames.slice(0, 3).join(", ")}
                              {result.mutualFriendNames.length > 3 && "..."})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendRequest(result)}
                    disabled={sendingRequest === result.uid}
                    className="flex items-center gap-1.5 py-2 px-4 bg-spa-dark hover:bg-quartz-400 text-white rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:bg-sand-200 shrink-0"
                  >
                    {sendingRequest === result.uid ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" />
                        <span>Adicionar</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* No results feedback */}
          {searchTerm.trim() && !searching && searchResults.length === 0 && (
            <p className="text-center text-[11px] text-spa-light py-4 font-light italic">
              Nenhum membro encontrado com esse nome.
            </p>
          )}
        </section>

        {/* ═══════════════════════════════════════
           SECTION 2 — Pending Requests
           ═══════════════════════════════════════ */}
        <section className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-quartz-50 flex items-center justify-center border border-quartz-100">
                <Heart className="w-3.5 h-3.5 text-quartz-400" />
              </div>
              <h3 className="font-serif text-lg text-spa-dark font-light">
                Pedidos Pendentes
              </h3>
            </div>
            {pendingRequests.length > 0 && (
              <span className="text-[10px] bg-quartz-50 text-quartz-500 font-bold px-2.5 py-1 rounded-full border border-quartz-100">
                {pendingRequests.length}
              </span>
            )}
          </div>

          {loadingPending ? (
            <div className="text-center py-6">
              <Loader2 className="w-5 h-5 text-quartz-400 animate-spin mx-auto" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <p className="text-center text-[11px] text-spa-light py-6 font-light italic">
              Nenhum pedido pendente no momento.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 p-4 bg-ivory/40 border border-sand-100/50 rounded-2xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={req.senderProfile.photoURL}
                      name={req.senderProfile.displayName}
                      size="w-10 h-10"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-spa-dark truncate">
                        {req.senderProfile.displayName}
                      </p>
                      <p className="text-[10px] text-spa-light font-medium mt-0.5">
                        Quer ser sua amiga
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAcceptRequest(req.id)}
                      disabled={processingRequest === req.id}
                      className="flex items-center gap-1 py-2 px-3.5 bg-olive-100 hover:bg-olive-200 text-olive-800 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 border border-olive-200/50"
                    >
                      {processingRequest === req.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3" />
                          <span>Aceitar</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(req.id)}
                      disabled={processingRequest === req.id}
                      className="flex items-center gap-1 py-2 px-3.5 border border-sand-200 hover:bg-sand-50 text-spa-medium rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 bg-white"
                    >
                      <UserX className="w-3 h-3" />
                      <span>Recusar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════
           SECTION 3 — My Friends
           ═══════════════════════════════════════ */}
        <section className="bg-white/70 border border-sand-200/50 rounded-[2.2rem] p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-olive-50 flex items-center justify-center border border-olive-100">
                <Users className="w-3.5 h-3.5 text-olive-500" />
              </div>
              <h3 className="font-serif text-lg text-spa-dark font-light">
                Minhas Amigas
              </h3>
            </div>
            {friends.length > 0 && (
              <span className="text-[10px] bg-olive-50 text-olive-600 font-bold px-2.5 py-1 rounded-full border border-olive-100">
                {friends.length}
              </span>
            )}
          </div>

          {loadingFriends ? (
            <div className="text-center py-8">
              <Loader2 className="w-5 h-5 text-olive-400 animate-spin mx-auto" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-14 h-14 rounded-full bg-sand-50 flex items-center justify-center mx-auto border border-sand-100">
                <Users className="w-6 h-6 text-sand-300" />
              </div>
              <p className="text-xs text-spa-light font-light italic max-w-xs mx-auto leading-relaxed">
                Você ainda não tem amigas. Use a busca acima para encontrar membros!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {friends.map((friend) => (
                <Link
                  key={friend.uid}
                  href={`/social/profile/${friend.uid}`}
                  className="flex items-center gap-3.5 p-4 bg-ivory/40 border border-sand-100/50 rounded-2xl hover:bg-sand-50/40 hover:border-olive-100/50 transition-all group"
                >
                  <Avatar
                    src={friend.photoURL}
                    name={friend.displayName}
                    size="w-12 h-12"
                  />
                  <div className="flex-grow min-w-0">
                    <p className="text-xs font-semibold text-spa-dark truncate group-hover:text-quartz-500 transition-colors">
                      {friend.displayName}
                    </p>
                    <p className="text-[10px] text-spa-light font-medium mt-0.5 flex items-center gap-1">
                      <span>Ver perfil</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
