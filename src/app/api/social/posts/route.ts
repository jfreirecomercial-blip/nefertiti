import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    // 1. Validar autenticação
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
    } catch (authError: unknown) {
      console.error("Erro na validação do token Firebase Admin:", authError);
      return NextResponse.json(
        { error: "Token de autenticação inválido ou expirado." },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const body = await request.json();
    const { content, photos, userName, userPhoto } = body;

    // Validar corpo mínimo
    if (!content?.trim() && (!photos || photos.length === 0)) {
      return NextResponse.json(
        { error: "O post deve conter texto ou pelo menos uma imagem." },
        { status: 400 }
      );
    }

    // 2. Chamar a moderação por IA do Gemini (Temporariamente desabilitada por solicitação do usuário)
    let moderationResult = { approved: true, reason: "", category: "none" };

    // Se o post foi reprovado pela moderação
    if (!moderationResult.approved) {
      return NextResponse.json(
        { 
          error: moderationResult.reason || "Post bloqueado por violação das regras da comunidade.",
          category: moderationResult.category
        },
        { status: 400 }
      );
    }

    // 3. Moderação aprovada: Salvar imagens no Firebase Storage e criar post no Firestore
    const uploadedUrls: string[] = [];
    if (photos && photos.length > 0) {
      const bucket = adminStorage.bucket();
      
      for (let i = 0; i < photos.length; i++) {
        const photoBase64 = photos[i];
        const match = photoBase64.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
        if (!match) continue;
        
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, "base64");
        
        const fileId = `${Date.now()}_${i}`;
        const file = bucket.file(`users/${userId}/posts/${fileId}.jpg`);
        
        await file.save(buffer, {
          metadata: { contentType: mimeType }
        });

        // Obter URL pública assinada com longa expiração para visualização segura
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: "01-01-2099"
        });
        
        uploadedUrls.push(signedUrl);
      }
    }

    // Buscar informações reais da usuária no Firestore para evitar personificação (SEC-02)
    const userRef = adminDb.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const realDisplayName = userData?.displayName || "Membro Nefertiti";
    const realPhotoURL = userData?.photoURL || null;

    // Gravar post no Firestore usando o Admin SDK
    const postData = {
      userId: userId,
      userName: realDisplayName,
      userPhoto: realPhotoURL,
      content: content || "",
      photos: uploadedUrls,
      isPublic: true,
      shared: true,
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date(),
    };

    const docRef = await adminDb.collection("social_posts").add(postData);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      post: {
        id: docRef.id,
        ...postData,
        createdAt: postData.createdAt.toISOString()
      }
    });

  } catch (error: unknown) {
    console.error("Erro na rota de publicação de posts:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor: " + (error as Error).message },
      { status: 500 }
    );
  }
}
