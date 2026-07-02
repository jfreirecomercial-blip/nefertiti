import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    // 1. Validar autenticação (Token JWT Firebase Auth)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Autenticação requerida. Token não fornecido." },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (authError: any) {
      console.error("Erro na validação do token Firebase Admin:", authError);
      return NextResponse.json(
        { error: "Token de autenticação inválido ou expirado." },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const userName = decodedToken.name || "Membro Nefertiti";

    // 2. Validar corpo da requisição
    const body = await request.json();
    const { professionalId, rating, comment } = body;

    if (!professionalId || typeof professionalId !== "string") {
      return NextResponse.json(
        { error: "O parâmetro 'professionalId' é obrigatório." },
        { status: 400 }
      );
    }

    const ratingVal = Number(rating);
    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      return NextResponse.json(
        { error: "A nota de avaliação (rating) deve ser um número entre 1 e 5." },
        { status: 400 }
      );
    }

    // 3. Verificar se a profissional existe
    const profRef = adminDb.collection("professionals").doc(professionalId);
    const profSnap = await profRef.get();

    if (!profSnap.exists) {
      return NextResponse.json(
        { error: "Profissional não encontrada." },
        { status: 404 }
      );
    }

    // Evitar que a própria profissional avalie a si mesma
    if (professionalId === userId) {
      return NextResponse.json(
        { error: "Você não pode enviar uma avaliação para si mesma." },
        { status: 400 }
      );
    }

    // 4. Salvar avaliação no Firestore
    const newReview = {
      professionalId,
      authorId: userId,
      authorName: userName,
      rating: ratingVal,
      comment: (comment || "").trim(),
      createdAt: new Date().toISOString()
    };

    const reviewRef = await adminDb.collection("reviews").add(newReview);

    // 5. Recalcular e atualizar a reputação da profissional com segurança (SEC-05)
    const reviewsSnapshot = await adminDb
      .collection("reviews")
      .where("professionalId", "==", professionalId)
      .get();

    const totalReviews = reviewsSnapshot.size;
    let sum = 0;
    reviewsSnapshot.forEach((doc) => {
      sum += Number(doc.data().rating) || 0;
    });
    
    const averageRating = totalReviews > 0 ? Number((sum / totalReviews).toFixed(1)) : 0;

    await profRef.update({
      averageRating,
      totalReviews,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      reviewId: reviewRef.id,
      review: {
        id: reviewRef.id,
        ...newReview
      },
      averageRating,
      totalReviews
    });

  } catch (error: any) {
    console.error("Erro geral na API de reviews:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor: " + error.message },
      { status: 500 }
    );
  }
}
