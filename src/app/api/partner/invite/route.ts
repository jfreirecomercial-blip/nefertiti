import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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
      console.error("Erro na validação do token Firebase Admin:", authError);
      return NextResponse.json(
        { error: "Token de autenticação inválido ou expirado." },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const body = await request.json();
    const { action, code } = body;

    const userRef = adminDb.collection("users").doc(userId);

    // --- AÇÃO: GENERATE ---
    if (action === "generate") {
      // Gerar código aleatório de 6 dígitos
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24 horas

      await userRef.update({
        partnerCode: randomCode,
        partnerCodeExpires: expiresAt.toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        code: randomCode,
        expiresAt: expiresAt.toISOString(),
      });
    }

    // --- AÇÃO: LINK ---
    if (action === "link") {
      if (!code || typeof code !== "string" || code.trim().length !== 6) {
        return NextResponse.json(
          { error: "Código inválido. Deve possuir 6 dígitos." },
          { status: 400 }
        );
      }

      // Buscar a usuária dona do código
      const usersQuery = await adminDb
        .collection("users")
        .where("partnerCode", "==", code.trim())
        .limit(1)
        .get();

      if (usersQuery.empty) {
        return NextResponse.json(
          { error: "Código de pareamento inválido ou expirado." },
          { status: 400 }
        );
      }

      const ownerDoc = usersQuery.docs[0];
      const ownerData = ownerDoc.data();
      const ownerUid = ownerDoc.id;

      // Validar data de expiração
      const expiresAt = new Date(ownerData.partnerCodeExpires);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Código de pareamento expirado. Gere um novo código." },
          { status: 400 }
        );
      }

      // Evitar que a própria dona tente se vincular
      if (ownerUid === userId) {
        return NextResponse.json(
          { error: "Você não pode ser cúmplice de si mesma." },
          { status: 400 }
        );
      }

      const partnerRef = adminDb.collection("users").doc(userId);
      const batch = adminDb.batch();

      // Atualizar dona do ciclo
      batch.update(ownerDoc.ref, {
        partnerId: userId,
        partnerCode: FieldValue.delete(),
        partnerCodeExpires: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      });

      // Atualizar parceiro/marido
      batch.update(partnerRef, {
        role: "partner",
        partnerId: ownerUid,
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      return NextResponse.json({
        success: true,
        message: "Conexão Cúmplice estabelecida com sucesso!",
        partnerId: ownerUid,
      });
    }

    // --- AÇÃO: REVOKE ---
    if (action === "revoke") {
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return NextResponse.json(
          { error: "Usuário não encontrado." },
          { status: 404 }
        );
      }

      const userData = userSnap.data();
      const connectedPartnerId = userData?.partnerId;

      if (!connectedPartnerId) {
        return NextResponse.json(
          { error: "Nenhuma conexão ativa encontrada para este usuário." },
          { status: 400 }
        );
      }

      const partnerRef = adminDb.collection("users").doc(connectedPartnerId);
      const batch = adminDb.batch();

      // Limpar campos na conta atual
      batch.update(userRef, {
        partnerId: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      });

      // Limpar campos e restaurar papel de 'member' (caso seja parceiro) na conta vinculada
      const partnerSnap = await partnerRef.get();
      if (partnerSnap.exists) {
        const partnerData = partnerSnap.data();
        const updates: any = {
          partnerId: FieldValue.delete(),
          updatedAt: new Date().toISOString(),
        };
        // Se a outra conta era role "partner", volta para "member"
        if (partnerData?.role === "partner") {
          updates.role = "member";
        }
        batch.update(partnerRef, updates);
      }

      await batch.commit();

      return NextResponse.json({
        success: true,
        message: "Conexão Cúmplice revogada com sucesso.",
      });
    }

    return NextResponse.json(
      { error: "Ação desconhecida ou inválida." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Erro na API de cumplicidade/convite:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor: " + error.message },
      { status: 500 }
    );
  }
}
