import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

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
    try {
      await adminAuth.verifyIdToken(token);
    } catch (authError: unknown) {
      console.error("Erro na validação do token Firebase Admin:", authError);
      return NextResponse.json(
        { error: "Token de autenticação inválido ou expirado." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "O conteúdo do post não pode ser vazio." },
        { status: 400 }
      );
    }

    // 2. Moderação do texto por IA do Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    let moderationResult = { approved: true, reason: "", category: "none" };

    if (!apiKey || apiKey === "AIzaSyFakeKeyForBuildTimePrerendering") {
      console.warn("[Nefertiti AI] GEMINI_API_KEY não configurada. Executando moderação de texto mockada local.");
      
      const textLower = content.toLowerCase();
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
          reason: `O texto editado contém termos inadequados ou ofensivos relacionados a '${foundWord}'.`,
          category: foundWord === "racista" || foundWord === "odio" || foundWord === "ódio" ? "hate_speech" : "sexual_content"
        };
      }
    } else {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const promptText = `Você é um moderador de conteúdo de inteligência artificial altamente rigoroso para a rede social Nefertiti (um espaço seguro para mulheres compartilharem relatos de saúde, bem-estar, ciclos e sexualidade).
Analise o texto editado do post abaixo.
Você deve bloquear o post (approved = false) se ele violar qualquer uma destas regras:
1. Ódio e Preconceito: Qualquer tipo de racismo, homofobia, xenofobia, intolerância religiosa ou discurso de ódio contra minorias.
2. Assédio e Ofensas: Ataques pessoais, bullying, linguagem extremamente ofensiva ou xingamentos.
3. Conteúdo Sexual Explícito e Inadequado:
   - PROIBIDO: Pornografia comercial, linguagem obscena de teor chulo/vulgar, convites para atos sexuais explícitos, apologia a abuso sexual, violência ou atividades ilegais.
   - PERMITIDO (Não Bloquear): Discussões saudáveis sobre saúde sexual, libido, experiências íntimas pessoais de autoconhecimento, dúvidas de anatomia íntima, bem como indicações de produtos de bem-estar sexual (como brinquedos sexuais, vibradores ou lubrificantes).

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem marcações markdown de bloco de código) com o seguinte formato:
{
  "approved": true | false,
  "reason": "Explicação curta em português do motivo da rejeição, ou vazio se aprovado",
  "category": "hate_speech" | "harassment" | "violence" | "sexual_content" | "none"
}`;

      try {
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  { text: `Texto a ser analisado: "${content}"` }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          console.error("Erro na API do Gemini para moderação de texto:", errText);
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

    if (!moderationResult.approved) {
      return NextResponse.json(
        { 
          error: moderationResult.reason || "Texto do post bloqueado por violação das regras da comunidade.",
          category: moderationResult.category
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      moderated: true
    });

  } catch (error: unknown) {
    console.error("Erro na rota de moderação de posts:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor: " + (error as Error).message },
      { status: 500 }
    );
  }
}
