import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    // 1. Verificação de Segurança Rigorosa (Token JWT Firebase Auth)
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

    // 2. Buscar informações do ciclo do usuário no Firestore
    const userRef = adminDb.collection("users").doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Perfil de utilizadora não encontrado." },
        { status: 404 }
      );
    }

    const userData = userDoc.data() || {};
    const cycleLength = userData.cycleLength || 28;
    const periodLength = userData.periodLength || 5;
    const lastPeriodDateStr = userData.lastPeriodDate;

    // 3. Determinar a fase do ciclo da utilizadora
    // Se for enviado na query param "phase", podemos forçar a fase para testes
    const { searchParams } = new URL(request.url);
    let phase = searchParams.get("phase") as "menstrual" | "follicular" | "ovulatory" | "luteal" | null;

    if (!phase && lastPeriodDateStr) {
      const lastPeriod = new Date(lastPeriodDateStr);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - lastPeriod.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const currentCycleDay = (diffDays % cycleLength) + 1;

      // Classificação médica aproximada das fases hormonais
      if (currentCycleDay <= periodLength) {
        phase = "menstrual";
      } else if (currentCycleDay <= Math.floor(cycleLength / 2) - 2) {
        phase = "follicular";
      } else if (currentCycleDay <= Math.floor(cycleLength / 2) + 1) {
        phase = "ovulatory";
      } else {
        phase = "luteal";
      }
    }

    // Fase fallback caso falte a data da última menstruação
    if (!phase) {
      phase = "follicular";
    }

    // 4. Configurar filtros nutricionais com base na fase metabólica
    const apiKey = process.env.SPOONACULAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave da API Spoonacular não configurada no servidor (.env.local)." },
        { status: 500 }
      );
    }

    let queryFoods = "";
    let minIron = 0;
    let minFiber = 0;
    let minMagnesium = 0;
    let explanation = "";

    switch (phase) {
      case "menstrual":
        queryFoods = "spinach,kale,lentil,beef,soup";
        minIron = 4; // Foco em repor ferro
        explanation = "Fase Menstrual: Foco na reposição de ferro e minerais perdidos. Alimentos reconfortantes e fáceis de digerir são ideais.";
        break;
      case "follicular":
        queryFoods = "avocado,broccoli,chicken,salmon,salad";
        minFiber = 4; // Foco em fibras para eliminação de estrogênio
        explanation = "Fase Folicular: Aumento de energia e estrogênio. Alimentos frescos, ricos em fibras e proteínas magras para apoiar o metabolismo.";
        break;
      case "ovulatory":
        queryFoods = "quinoa,berry,almonds,chia,vegetables";
        explanation = "Fase Ovulatória: Pico de energia e estrogênio. Alimentos leves, anti-inflamatórios e ricos em antioxidantes para apoiar a liberação do óvulo.";
        break;
      case "luteal":
        queryFoods = "banana,dark chocolate,turkey,sweet potato";
        minMagnesium = 50; // Foco em magnésio para TPM/cólica
        explanation = "Fase Lútea: Progesterona em alta, queda de energia. Alimentos ricos em magnésio e complexo B para reduzir cólicas e controlar os desejos de açúcar.";
        break;
    }

    // 5. Chamar a API da Spoonacular
    const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
    url.searchParams.append("apiKey", apiKey);
    url.searchParams.append("number", "3");
    url.searchParams.append("addRecipeInformation", "true");
    url.searchParams.append("fillIngredients", "true");
    if (queryFoods) url.searchParams.append("query", queryFoods);
    if (minIron > 0) url.searchParams.append("minIron", String(minIron));
    if (minFiber > 0) url.searchParams.append("minFiber", String(minFiber));
    if (minMagnesium > 0) url.searchParams.append("minMagnesium", String(minMagnesium));

    const spoonRes = await fetch(url.toString());
    
    if (!spoonRes.ok) {
      const spoonErrorText = await spoonRes.text();
      console.error("Erro na chamada Spoonacular:", spoonErrorText);
      return NextResponse.json(
        { error: "Falha ao obter sugestões alimentares da Spoonacular." },
        { status: 502 }
      );
    }

    const spoonData = await spoonRes.json();

    // Mapear os resultados para um formato limpo e premium
    const recommendations = (spoonData.results || []).map((recipe: any) => ({
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      readyInMinutes: recipe.readyInMinutes,
      servings: recipe.servings,
      summary: recipe.summary ? recipe.summary.replace(/<[^>]*>/g, "").slice(0, 150) + "..." : "",
      spoonacularSourceUrl: recipe.spoonacularSourceUrl,
      ingredients: (recipe.extendedIngredients || []).map((ing: any) => ing.original),
      nutrients: {
        calories: recipe.nutrition?.nutrients?.find((n: any) => n.name === "Calories")?.amount || 0,
        iron: recipe.nutrition?.nutrients?.find((n: any) => n.name === "Iron")?.amount || 0,
        fiber: recipe.nutrition?.nutrients?.find((n: any) => n.name === "Fiber")?.amount || 0,
        magnesium: recipe.nutrition?.nutrients?.find((n: any) => n.name === "Magnesium")?.amount || 0,
      }
    }));

    return NextResponse.json({
      success: true,
      phase,
      explanation,
      recommendations,
    });

  } catch (error: any) {
    console.error("Erro na rota de recomendações nutricionais:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor: " + error.message },
      { status: 500 }
    );
  }
}
