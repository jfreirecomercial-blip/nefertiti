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

    let explanation = "";
    switch (phase) {
      case "menstrual":
        explanation = "Fase Menstrual: Foco na reposição de ferro e minerais perdidos. Alimentos reconfortantes e fáceis de digerir são ideais.";
        break;
      case "follicular":
        explanation = "Fase Folicular: Aumento de energia e estrogênio. Alimentos frescos, ricos em fibras e proteínas magras para apoiar o metabolismo.";
        break;
      case "ovulatory":
        explanation = "Fase Ovulatória: Pico de energia e estrogênio. Alimentos leves, anti-inflamatórios e ricos em antioxidantes para apoiar a liberação do óvulo.";
        break;
      case "luteal":
        explanation = "Fase Lútea: Progesterona em alta, queda de energia. Alimentos ricos em magnésio e complexo B para reduzir cólicas e controlar os desejos de açúcar.";
        break;
    }

    let recommendations = [];

    if (!apiKey) {
      // Fornecer receitas de fallback ricas se a API Spoonacular não estiver configurada
      const fallbackRecipes: Record<string, Array<any>> = {
        menstrual: [
          {
            id: 101,
            title: "Sopa Nutritiva de Lentilhas e Espinafres",
            image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 25,
            servings: 3,
            summary: "Uma sopa reconfortante e rica em ferro, excelente para repor os minerais perdidos durante o fluxo menstrual.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/lentil-soup",
            ingredients: ["Lentilhas secas", "Espinafres frescos", "Cenouras", "Cebola e Alho", "Azeite"],
            nutrients: { calories: 280, iron: 6.5, fiber: 8, magnesium: 70 }
          },
          {
            id: 102,
            title: "Salada Quente de Quinoa com Vegetais Escuros",
            image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 20,
            servings: 2,
            summary: "Quinoa cozida combinada com brócolos e couve kale salteados, fornecendo magnésio e ferro de absorção fácil.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/quinoa-salad",
            ingredients: ["Quinoa", "Couve Kale", "Brócolos", "Sementes de abóbora", "Limão"],
            nutrients: { calories: 320, iron: 4.2, fiber: 6, magnesium: 95 }
          }
        ],
        follicular: [
          {
            id: 201,
            title: "Bowl de Frango Grelhado com Abacate e Brócolos",
            image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 20,
            servings: 1,
            summary: "Uma refeição leve e rica em fibras, ideal para apoiar a eliminação natural do estrogénio nesta fase do ciclo.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/chicken-salad",
            ingredients: ["Peito de frango", "Abacate", "Brócolos cozidos a vapor", "Arroz integral", "Sementes de sésamo"],
            nutrients: { calories: 450, iron: 2.8, fiber: 7.5, magnesium: 65 }
          },
          {
            id: 202,
            title: "Salmão Assado com Salada de Lentilhas Frescas",
            image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 30,
            servings: 2,
            summary: "Salmão selvagem rico em ómega-3 acompanhado por lentilhas temperadas com vinagrete leve de ervas.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/salmon",
            ingredients: ["Filete de salmão", "Lentilhas cozidas", "Tomate cereja", "Pepino", "Coentros e Limão"],
            nutrients: { calories: 380, iron: 3.5, fiber: 5, magnesium: 55 }
          }
        ],
        ovulatory: [
          {
            id: 301,
            title: "Smoothie Bowl Antioxidante de Chia e Frutos Vermelhos",
            image: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 10,
            servings: 1,
            summary: "Um smoothie refrescante e energético, rico em antioxidantes e gorduras saudáveis que promovem a ovulação saudável.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/smoothie-bowl",
            ingredients: ["Framboesas e Mirtilos", "Sementes de Chia", "Bebida de amêndoa", "Banana congelada", "Granola caseira"],
            nutrients: { calories: 290, iron: 1.8, fiber: 9, magnesium: 45 }
          },
          {
            id: 302,
            title: "Salada de Quinoa Colorida com Amêndoas e Rúcula",
            image: "https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 15,
            servings: 2,
            summary: "Uma salada fresca e anti-inflamatória, cheia de cores, crocante pelas amêndoas laminadas e rica em vitamina E.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/salad",
            ingredients: ["Quinoa", "Rúcula selvagem", "Pimento amarelo", "Amêndoas laminadas", "Molho de azeite e gengibre"],
            nutrients: { calories: 310, iron: 2.5, fiber: 5.5, magnesium: 80 }
          }
        ],
        luteal: [
          {
            id: 401,
            title: "Batata Doce Recheada com Peru Moído e Ervas",
            image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 35,
            servings: 2,
            summary: "Batata doce assada recheada com carne magra de peru e temperos naturais. Ajuda a manter a saciedade e reduz desejos por açúcar.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/sweet-potato",
            ingredients: ["Batata doce média", "Peru moído", "Cebola", "Espinhas", "Pimentão doce"],
            nutrients: { calories: 410, iron: 3.1, fiber: 6, magnesium: 75 }
          },
          {
            id: 402,
            title: "Mousse Fit de Cacau com Abacate e Banana",
            image: "https://images.unsplash.com/photo-1541795795328-f073b763494e?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 10,
            servings: 2,
            summary: "Uma sobremesa saudável rica em magnésio e potássio que atua ativamente no alívio das cólicas menstruais e flutuações de humor.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/chocolate-mousse",
            ingredients: ["Abacate maduro", "Cacau puro em pó", "Banana madura", "Mel ou xarope de ácer", "Essência de baunilha"],
            nutrients: { calories: 220, iron: 1.5, fiber: 5.8, magnesium: 68 }
          }
        ]
      };

      recommendations = fallbackRecipes[phase] || fallbackRecipes.follicular;
    } else {
      let queryFoods = "";
      let minIron = 0;
      let minFiber = 0;
      let minMagnesium = 0;

      switch (phase) {
        case "menstrual":
          queryFoods = "spinach,kale,lentil,beef,soup";
          minIron = 4;
          break;
        case "follicular":
          queryFoods = "avocado,broccoli,chicken,salmon,salad";
          minFiber = 4;
          break;
        case "ovulatory":
          queryFoods = "quinoa,berry,almonds,chia,vegetables";
          break;
        case "luteal":
          queryFoods = "banana,dark chocolate,turkey,sweet potato";
          minMagnesium = 50;
          break;
      }

      // 5. Chamar a API da Spoonacular
      const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
      url.searchParams.append("apiKey", apiKey);
      url.searchParams.append("number", "3");
      url.searchParams.append("addRecipeInformation", "true");
      url.searchParams.append("addRecipeNutrition", "true");
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
      recommendations = (spoonData.results || []).map((recipe: any) => ({
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
    }

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
