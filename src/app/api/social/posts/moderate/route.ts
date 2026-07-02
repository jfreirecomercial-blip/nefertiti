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

    // 2. Moderação do texto por IA do Gemini (Temporariamente desabilitada por solicitação do usuário)
    let moderationResult = { approved: true, reason: "", category: "none" };

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
