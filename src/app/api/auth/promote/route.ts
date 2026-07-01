import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ADMIN_EMAIL_HASH, ADMIN_NAME } from "@/lib/admin-hash";
import { createHash } from "crypto";

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
    } catch (authError) {
      console.error("Erro na validação do token:", authError);
      return NextResponse.json(
        { error: "Token de autenticação inválido ou expirado." },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;
    const email = decodedToken.email;

    if (!email) {
      return NextResponse.json(
        { success: true, message: "Login verificado, mas nenhum e-mail associado." },
        { status: 200 }
      );
    }

    // 2. Verificar hash do email
    const emailHash = createHash("sha256")
      .update(email.toLowerCase().trim())
      .digest("hex");

    if (emailHash === ADMIN_EMAIL_HASH) {
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await userRef.get();

      const updateData: Record<string, any> = {
        role: "admin",
        updatedAt: new Date().toISOString(),
      };

      // Se o usuário não tiver displayName ou se ele estiver com o padrão de membro, atualizar para o nome ocultado
      if (!userSnap.exists || !userSnap.data()?.displayName || userSnap.data()?.displayName === "Membro Nefertiti") {
        updateData.displayName = ADMIN_NAME;
      }

      await userRef.set(updateData, { merge: true });

      // Atualizar também no Firebase Auth se necessário
      try {
        const authUser = await adminAuth.getUser(uid);
        if (!authUser.displayName) {
          await adminAuth.updateUser(uid, {
            displayName: ADMIN_NAME,
          });
        }
      } catch (authUpdateError) {
        console.error("Erro ao atualizar displayName no Auth:", authUpdateError);
      }

      return NextResponse.json({
        success: true,
        role: "admin",
        message: "Nível administrativo configurado com sucesso.",
      });
    }

    return NextResponse.json({
      success: true,
      role: "member",
      message: "Verificação concluída.",
    });

  } catch (error: any) {
    console.error("Erro na rota de promoção de admin:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
