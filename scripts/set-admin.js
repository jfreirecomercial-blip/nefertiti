const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("crypto");

// Configurações de hash correspondentes aos dados ocultados
const ADMIN_EMAIL_HASH = "122f4a3cc555004f5e52bbe3044f29be5721f146348edfd000396748f7324085";
const ADMIN_NAME = "Lecter";

// Carregar variáveis de ambiente básicas
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kupom-311fe";
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kupom-311fe.firebasestorage.app";

// Inicializar Firebase Admin
let app;
if (getApps().length === 0) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    app = initializeApp({
      credential: cert(JSON.parse(serviceAccountKey)),
      storageBucket,
    });
  } else {
    app = initializeApp({
      projectId,
      storageBucket,
    });
  }
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  console.log("Iniciando varredura para identificar e promover o administrador...");
  
  try {
    // 1. Obter todos os usuários da coleção 'users'
    const usersSnapshot = await db.collection("users").get();
    
    let adminDoc = null;
    let foundCount = 0;

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      if (data.email) {
        const emailHash = crypto
          .createHash("sha256")
          .update(data.email.toLowerCase().trim())
          .digest("hex");
          
        if (emailHash === ADMIN_EMAIL_HASH) {
          adminDoc = doc;
          foundCount++;
          break;
        }
      }
    }

    if (!adminDoc) {
      console.log("Nenhum usuário correspondente ao hash do administrador foi encontrado no Firestore.");
      console.log("Dica: Certifique-se de que o usuário já se cadastrou ou fez login pelo menos uma vez.");
      process.exit(1);
    }

    const uid = adminDoc.id;
    console.log(`Usuário encontrado com sucesso! UID: ${uid}`);

    // 2. Atualizar documento no Firestore para role: "admin"
    await db.collection("users").doc(uid).update({
      role: "admin",
      displayName: ADMIN_NAME,
      updatedAt: new Date().toISOString()
    });
    console.log("Documento do usuário no Firestore atualizado para role 'admin' e nome 'Lecter'.");

    // 3. Atualizar perfil do usuário no Firebase Auth
    try {
      await auth.updateUser(uid, {
        displayName: ADMIN_NAME
      });
      console.log("Perfil no Firebase Authentication atualizado com sucesso.");
    } catch (authError) {
      console.warn("Aviso: Não foi possível atualizar o displayName no Auth SDK (pode ser necessário configurar credenciais admin completas):", authError.message);
    }

    console.log("Processo de promoção concluído com sucesso!");
    process.exit(0);

  } catch (error) {
    console.error("Erro crítico durante a promoção:", error);
    process.exit(1);
  }
}

run();
