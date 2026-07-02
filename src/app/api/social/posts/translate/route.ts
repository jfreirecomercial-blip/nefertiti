import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    // 1. Validar autenticação (Token Firebase Admin)
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

    // 2. Extrair e validar parâmetros
    const body = await request.json();
    const { postId, targetLanguage } = body;

    if (!postId || typeof postId !== "string") {
      return NextResponse.json(
        { error: "O parâmetro 'postId' é obrigatório e deve ser uma string." },
        { status: 400 }
      );
    }

    const allowedLanguages = ["pt", "pt-PT", "en", "es", "fr"];
    if (!targetLanguage || !allowedLanguages.includes(targetLanguage)) {
      return NextResponse.json(
        { error: `O idioma de destino '${targetLanguage}' não é suportado.` },
        { status: 400 }
      );
    }

    // 3. Buscar informações do usuário e do post no Firestore para validação de acesso (SEC-04)
    const userRef = adminDb.collection("users").doc(decodedToken.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : null;

    if (userData?.role === "partner") {
      return NextResponse.json(
        { error: "Acesso negado. Parceiros não têm permissão para acessar dados do feed social." },
        { status: 403 }
      );
    }

    const postRef = adminDb.collection("social_posts").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      return NextResponse.json(
        { error: "A publicação especificada não foi encontrada." },
        { status: 404 }
      );
    }

    const postData = postDoc.data() || {};

    // Se o post estiver suspenso, apenas o dono ou admins podem acessá-lo/traduzi-lo
    const isOwner = postData.userId === decodedToken.uid;
    const isAdmin = userData?.role === "admin";
    if (postData.status === "suspended" && !isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Esta publicação foi suspensa por moderação e não está disponível." },
        { status: 403 }
      );
    }
    const content = postData.content || "";

    if (!content.trim()) {
      return NextResponse.json(
        { translation: "", cached: true }
      );
    }

    // 4. Verificar se a tradução já está em cache no Firestore
    if (postData.translations && postData.translations[targetLanguage]) {
      console.log(`[Translation Cache] Hit para o post ${postId} em ${targetLanguage}`);
      return NextResponse.json({
        translation: postData.translations[targetLanguage],
        cached: true
      });
    }

    console.log(`[Translation Cache] Miss para o post ${postId} em ${targetLanguage}. Traduzindo...`);

    // 5. Obter chave de API e traduzir com o Gemini
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    let translatedText = "";

    if (!apiKey || apiKey === "AIzaSyFakeKeyForBuildTimePrerendering") {
      console.warn("[Nefertiti AI] GEMINI_API_KEY não configurada. Executando tradução mockada local.");
      
      // Fallback simples local para testes de desenvolvimento sem API key
      const translationsMock: Record<string, string> = {
        en: "[Translated to English] " + content,
        es: "[Traducido al Español] " + content,
        fr: "[Traduit en Français] " + content,
        pt: "[Traduzido para Português BR] " + content,
        "pt-PT": "[Traduzido para Português PT] " + content,
      };
      translatedText = translationsMock[targetLanguage] || content;
    } else {
      // Usar a API do Gemini 1.5/2.5 Flash
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const promptText = `Você é um tradutor profissional da rede social Nefertiti. 
Sua tarefa é traduzir o texto a seguir para o idioma "${targetLanguage}".
Siga estas regras rigorosamente:
1. Retorne APENAS o texto traduzido. Não adicione notas, introduções, aspas extras ou explicações.
2. Preserve gírias de saúde feminina de forma natural, emojis, quebras de linha e o tom acolhedor e íntimo do post original.
3. Se o texto original já estiver no idioma desejado, retorne-o exatamente como está.

Texto original a ser traduzido:
"${content}"`;

      try {
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: promptText }]
            }]
          })
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          console.error("Erro na chamada da API do Gemini:", errText);
          throw new Error("Falha ao comunicar com o serviço de tradução por IA.");
        }

        const result = await geminiRes.json();
        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // Limpar possíveis blocos de aspas retornados pelo modelo
        translatedText = rawText.trim();
        if (translatedText.startsWith('"') && translatedText.endsWith('"')) {
          translatedText = translatedText.slice(1, -1);
        }
      } catch (err: unknown) {
        console.error("Erro no processamento da tradução por IA:", err);
        return NextResponse.json(
          { error: "Erro ao processar tradução por IA: " + (err as Error).message },
          { status: 500 }
        );
      }
    }

    // 6. Atualizar o Firestore para salvar a tradução em cache
    try {
      await postRef.update({
        [`translations.${targetLanguage}`]: translatedText
      });
      console.log(`[Translation Cache] Salvo no banco para post ${postId} em ${targetLanguage}`);
    } catch (dbError) {
      console.error("Erro ao salvar tradução no Firestore cache:", dbError);
    }

    return NextResponse.json({
      translation: translatedText,
      cached: false
    });
  } catch (error: unknown) {
    console.error("Erro geral na rota de tradução:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor: " + (error as Error).message },
      { status: 500 }
    );
  }
}
