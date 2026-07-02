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

    // 2. Chamar a moderação por IA do Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    let moderationResult = { approved: true, reason: "", category: "none" };

    if (!apiKey || apiKey === "AIzaSyFakeKeyForBuildTimePrerendering") {
      console.warn("[Nefertiti AI] GEMINI_API_KEY não configurada. Executando moderação mockada local.");
      
      // Moderação mockada para testes locais
      const textLower = (content || "").toLowerCase();
      const forbiddenWords = ["racista", "odio", "ódio", "nazista", "porno", "pornô", "vaca", "puta"];
      
      let foundWord = "";
      for (const word of forbiddenWords) {
        if (textLower.includes(word)) {
          foundWord = word;
          break;
        }
      }

      if (foundWord) {
        moderationResult = {
          approved: false,
          reason: `O texto contém termos inadequados ou ofensivos relacionados a '${foundWord}'.`,
          category: foundWord === "racista" || foundWord === "odio" || foundWord === "ódio" ? "hate_speech" : "sexual_content"
        };
      }

      // Se houver fotos e o texto tiver menção a imagens sexuais, ou o nome das fotos simular nudez
      if (photos && photos.length > 0) {
        for (const photo of photos) {
          if (!photo.startsWith("data:") && (photo.includes("nude") || photo.includes("sex") || photo.includes("improprio") || photo.includes("impróprio"))) {
            moderationResult = {
              approved: false,
              reason: "Nudez ou conteúdo sexualmente explícito detectado na imagem.",
              category: "sexual_content"
            };
            break;
          }
        }
      }
    } else {
      // Moderação real usando a API do Gemini 1.5 Flash
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const promptText = `Você é um moderador de conteúdo de inteligência artificial altamente rigoroso para a rede social Nefertiti (um espaço seguro para mulheres compartilharem relatos de saúde, bem-estar, ciclos e sexualidade).
Analise o texto do post e as imagens anexadas abaixo.
Você deve bloquear o post (approved = false) se ele violar qualquer uma destas regras:
1. Ódio e Preconceito: Qualquer tipo de racismo, homofobia, xenofobia, intolerância religiosa ou discurso de ódio contra minorias.
2. Assédio e Ofensas: Ataques pessoais, bullying, linguagem extremamente ofensiva ou xingamentos.
3. Nudez e Conteúdo Sexual Explícito:
   - PROIBIDO: Exposição de órgãos genitais, poses sexuais explícitas, pornografia comercial ou imagens de nudez humana explícita.
   - PERMITIDO (Não Bloquear): Discussões saudáveis em formato de texto sobre saúde sexual, libido, experiências íntimas de autoconhecimento, dúvidas de anatomia íntima, bem como indicações/recomendações de produtos de bem-estar sexual (como brinquedos sexuais, vibradores ou lubrificantes). Fotos de produtos e embalagens de bem-estar são permitidas, desde que não exibam nudez ou genitália humana.
   - (Importante: Imagens de barrigas grávidas ou cicatrizes de cirurgia que não tenham apelo sexual são PERMITIDAS).
4. Violência: Ameaças de agressão, automutilação ou apologia a crimes.

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem marcações markdown de bloco de código) com o seguinte formato:
{
  "approved": true | false,
  "reason": "Explicação curta em português do motivo da rejeição, ou vazio se aprovado",
  "category": "hate_speech" | "harassment" | "violence" | "sexual_content" | "none"
}`;

      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: promptText }];
      
      if (content) {
        parts.push({ text: `Texto a ser analisado: "${content}"` });
      }

      if (photos && photos.length > 0) {
        photos.forEach((photoBase64: string) => {
          const match = photoBase64.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          }
        });
      }

      try {
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          console.error("Erro na API do Gemini para moderação:", errText);
          throw new Error("Falha na chamada ao serviço de moderação de IA.");
        }

        const result = await geminiRes.json();
        const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (textResponse) {
          moderationResult = JSON.parse(textResponse.trim());
        }
      } catch (err: unknown) {
        console.error("Erro no processamento da moderação por IA:", err);
        return NextResponse.json(
          { error: "Erro ao processar moderação por IA: " + (err as Error).message },
          { status: 500 }
        );
      }
    }

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
