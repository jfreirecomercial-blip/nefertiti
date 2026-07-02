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
    const phaseInput = searchParams.get("phase") as "menstrual" | "follicular" | "ovulatory" | "luteal" | null;
    let phase: "menstrual" | "follicular" | "ovulatory" | "luteal" = "follicular";

    if (phaseInput) {
      phase = phaseInput;
    } else if (lastPeriodDateStr) {
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

    // 4. Mapeamento de receitas típicas e filtros por país
    const country = userData.country || "Brasil";

    // Helper para mapear país para filtros da Spoonacular
    const getCuisineAndQueryForCountry = (countryStr: string) => {
      const norm = countryStr.trim().toLowerCase();
      if (norm.startsWith("bras") || norm.startsWith("braz")) {
        return { cuisine: "Latin American", queryText: "Brazilian" };
      }
      if (norm.startsWith("port")) {
        return { cuisine: "Mediterranean", queryText: "Portuguese" };
      }
      if (norm.startsWith("esp") || norm.startsWith("spa")) {
        return { cuisine: "Spanish", queryText: "" };
      }
      return { cuisine: "", queryText: "" };
    };

    // Coleções de receitas de fallback típicas por país e fase
    const countryFallbacks: Record<string, Record<string, Array<any>>> = {
      brasil: {
        menstrual: [
          {
            id: "br_menstrual_1",
            title: "Sopa Nutritiva de Lentilha e Espinafre",
            image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 25,
            servings: 3,
            summary: "Uma sopa reconfortante e rica em ferro, excelente para repor os minerais perdidos durante o fluxo menstrual.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/lentil-soup",
            ingredients: ["Lentilha", "Espinafre fresco", "Cenoura", "Cebola e Alho", "Azeite"],
            nutrients: { calories: 280, iron: 6.5, fiber: 8, magnesium: 70 }
          },
          {
            id: "br_menstrual_2",
            title: "Açaí na Tigela com Banana e Sementes de Girassol",
            image: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 10,
            servings: 1,
            summary: "Fonte rica de antioxidantes e gorduras saudáveis, ideal para combater a inflamação menstrual.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/acai-bowl",
            ingredients: ["Polpa de açaí pura", "Banana", "Sementes de girassol", "Granola sem açúcar"],
            nutrients: { calories: 310, iron: 1.8, fiber: 5, magnesium: 55 }
          }
        ],
        follicular: [
          {
            id: "br_follicular_1",
            title: "Salada de Grão-de-Bico com Atum e Ovo",
            image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 20,
            servings: 2,
            summary: "Uma refeição leve, rica em proteínas e fibras que apoia a eliminação natural do estrogênio.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/chickpea-salad",
            ingredients: ["Grão-de-bico", "Atum em água", "Ovo cozido", "Tomate e Pepino", "Azeite e Limão"],
            nutrients: { calories: 340, iron: 3.2, fiber: 7, magnesium: 65 }
          },
          {
            id: "br_follicular_2",
            title: "Filé de Peixe Grelhado com Purê de Mandioquinha",
            image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 30,
            servings: 2,
            summary: "Peixe leve de fácil digestão, rico em ômega-3, combinado com carboidratos saudáveis e brócolis.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/grilled-fish",
            ingredients: ["Filé de tilápia ou pescada", "Mandioquinha", "Azeite", "Brócolis cozido"],
            nutrients: { calories: 380, iron: 1.5, fiber: 4.5, magnesium: 50 }
          }
        ],
        ovulatory: [
          {
            id: "br_ovulatory_1",
            title: "Tapioca de Frango Desfiado com Rúcula",
            image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 15,
            servings: 1,
            summary: "Refeição leve e prática, ideal para o pico de energia da ovulação sem sobrecarregar o sistema digestivo.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/tapioca",
            ingredients: ["Goma de tapioca", "Peito de frango desfiado", "Rúcula selvagem", "Azeite e Oregãos"],
            nutrients: { calories: 290, iron: 2.1, fiber: 3, magnesium: 35 }
          },
          {
            id: "br_ovulatory_2",
            title: "Suco Verde com Sementes de Chia e Maçã",
            image: "https://images.unsplash.com/photo-1610970881699-44a55b4cfd87?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 10,
            servings: 1,
            summary: "Suco altamente desintoxicante e hidratante, rico em clorofila e fibras para apoiar o fígado na ovulação.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/green-juice",
            ingredients: ["Folhas de couve", "Maçã verde", "Gengibre", "Limão", "Sementes de chia"],
            nutrients: { calories: 150, iron: 1.5, fiber: 6, magnesium: 40 }
          }
        ],
        luteal: [
          {
            id: "br_luteal_1",
            title: "Escondidinho de Abóbora com Carne de Sol",
            image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 35,
            servings: 2,
            summary: "A abóbora cabotiá é rica em potássio e fibras, reduzindo a retenção de líquidos e o inchaço comuns nesta fase.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/pumpkin",
            ingredients: ["Abóbora cabotiá cozida e amassada", "Carne de sol desfiada e dessalgada", "Cebola picada", "Azeite"],
            nutrients: { calories: 390, iron: 3.8, fiber: 5.5, magnesium: 78 }
          },
          {
            id: "br_luteal_2",
            title: "Creme Fit de Cacau com Abacate e Banana",
            image: "https://images.unsplash.com/photo-1541795795328-f073b763494e?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 10,
            servings: 2,
            summary: "Sobremesa cremosa rica em magnésio e potássio que atua ativamente no alívio de cólicas e desejos de doce.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/chocolate-mousse",
            ingredients: ["Abacate maduro", "Banana madura", "Cacau puro em pó 100%", "Mel ou melado"],
            nutrients: { calories: 230, iron: 1.6, fiber: 6, magnesium: 72 }
          }
        ]
      },
      portugal: {
        menstrual: [
          {
            id: "pt_menstrual_1",
            title: "Caldo Verde Tradicional com Couve Galega",
            image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 30,
            servings: 4,
            summary: "Uma sopa tradicional rica em ferro e minerais, ideal para aquecer e acalmar o corpo durante a menstruação.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/cabbage-soup",
            ingredients: ["Batatas", "Couve-galega cortada em caldo verde", "Cebola e alho", "Azeite extra virgem", "Rodelas de chouriço"],
            nutrients: { calories: 240, iron: 4.8, fiber: 5.5, magnesium: 65 }
          },
          {
            id: "pt_menstrual_2",
            title: "Estufado de Lentilhas e Espinafres com Cenoura",
            image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 25,
            servings: 3,
            summary: "Cozido reconfortante de lentilhas rico em ferro vegetal e magnésio, potenciado pela vitamina C dos legumes.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/lentil-soup",
            ingredients: ["Lentilhas castanhas secas", "Espinafres frescos", "Cenouras em cubos", "Tomate pelado", "Cebola e alho", "Louro"],
            nutrients: { calories: 290, iron: 6.2, fiber: 7.8, magnesium: 75 }
          }
        ],
        follicular: [
          {
            id: "pt_follicular_1",
            title: "Salada de Grão-de-Bico com Bacalhau Desfiado",
            image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 20,
            servings: 2,
            summary: "Refeição tradicional portuguesa rica em proteínas magras e fibras solúveis que ajudam na eliminação do estrogénio.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/codfish",
            ingredients: ["Grão-de-bico cozido", "Bacalhau desfiado demolhado", "Ovo cozido", "Cebola picada", "Salsa picada", "Azeite e vinagre"],
            nutrients: { calories: 380, iron: 3.5, fiber: 8, magnesium: 70 }
          },
          {
            id: "pt_follicular_2",
            title: "Papas de Aveia Cremosas com Framboesas e Sementes de Abóbora",
            image: "https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 10,
            servings: 1,
            summary: "As fibras solúveis ajudam a manter a digestão ativa e estabilizar o açúcar no sangue na subida do estrogénio.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/oatmeal",
            ingredients: ["Flocos de aveia finos", "Bebida vegetal ou leite", "Framboesas frescas", "Sementes de abóbora", "Canela"],
            nutrients: { calories: 330, iron: 3.8, fiber: 7.2, magnesium: 92 }
          }
        ],
        ovulatory: [
          {
            id: "pt_ovulatory_1",
            title: "Sardinhas Assadas com Salada de Pimentos Grelhados",
            image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 30,
            servings: 2,
            summary: "As sardinhas são excelentes fontes de ómega-3 e vitamina D, essenciais para a qualidade do óvulo e fertilidade.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/sardines",
            ingredients: ["Sardinhas frescas", "Pimento vermelho", "Pimento verde", "Cebola às rodelas", "Azeite extra virgem", "Vinagre de vinho"],
            nutrients: { calories: 360, iron: 2.9, fiber: 3.5, magnesium: 55 }
          },
          {
            id: "pt_ovulatory_2",
            title: "Bacalhau à Brás Saudável com Alho-Francês",
            image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 20,
            servings: 2,
            summary: "Uma versão leve que substitui a batata frita por alho-francês e curgete ralada para manter a refeição nutritiva e anti-inflamatória.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/cod-stir-fry",
            ingredients: ["Bacalhau desfiado demolhado", "Alho-francês cortado às rodelas", "Curgete ralada", "Ovos batidos", "Azeite", "Azeitonas pretas"],
            nutrients: { calories: 290, iron: 2.2, fiber: 3, magnesium: 45 }
          }
        ],
        luteal: [
          {
            id: "pt_luteal_1",
            title: "Dourada Grelhada com Batata-Doce e Brócolos",
            image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 35,
            servings: 2,
            summary: "A batata-doce fornece hidratos de carbono complexos para ajudar na produção de serotonina e acalmar os desejos por doces.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/baked-fish",
            ingredients: ["Filetes de dourada fresca", "Batata-doce média cozida ou assada", "Brócolos ao vapor", "Alho e Azeite"],
            nutrients: { calories: 410, iron: 2.4, fiber: 5.8, magnesium: 70 }
          },
          {
            id: "pt_luteal_2",
            title: "Mousse Saudável de Chocolate Negro com Abacate",
            image: "https://images.unsplash.com/photo-1541795795328-f073b763494e?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 10,
            servings: 2,
            summary: "Combinação rica em gorduras saudáveis e magnésio para aliviar a tensão uterina, reduzir as cólicas e equilibrar o humor.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/chocolate-mousse",
            ingredients: ["Abacate maduro", "Cacau puro em pó", "Mel ou xarope de ácer", "Bebida de amêndoa", "Hortelã"],
            nutrients: { calories: 220, iron: 1.5, fiber: 5.8, magnesium: 68 }
          }
        ]
      },
      espanha: {
        menstrual: [
          {
            id: "es_menstrual_1",
            title: "Lentejas Estofadas tradicionales con Espinacas",
            image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 35,
            servings: 4,
            summary: "Un plato de cuchara caliente, nutritivo y rico en hierro para restablecer los niveles de energía y sangre.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/lentejas",
            ingredients: ["Lentejas secas", "Hojas de espinaca fresca", "Zanahoria", "Pimiento rojo y cebolla", "Diente de ajo", "Laurel y pimentón"],
            nutrients: { calories: 310, iron: 6.8, fiber: 8.2, magnesium: 75 }
          },
          {
            id: "es_menstrual_2",
            title: "Crema Caliente de Acelgas con Semillas de Girasol",
            image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 20,
            servings: 2,
            summary: "Crema de hoja verde altamente digestiva y rica en minerales indispensables para calmar el dolor menstrual.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/crema-acelgas",
            ingredients: ["Hojas de acelga limpia", "Patata pequeña", "Puerro", "Semillas de girasol tostadas", "Aceite de oliva virgen extra"],
            nutrients: { calories: 210, iron: 3.5, fiber: 4.8, magnesium: 55 }
          }
        ],
        follicular: [
          {
            id: "es_follicular_1",
            title: "Ensalada Templada de Garbanzos con Atún y Huevo Duro",
            image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 15,
            servings: 2,
            summary: "Excelente combinación de proteína limpia y fibra que asiste al hígado a limpiar el exceso de estrógenos de forma natural.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/ensalada-garbanzos",
            ingredients: ["Garbanzos cocidos y escurridos", "Atún en conserva al natural", "Huevo cocido", "Tomates cherry", "Aceitunas negras", "Vinagre y Aceite"],
            nutrients: { calories: 360, iron: 3.4, fiber: 7.5, magnesium: 68 }
          },
          {
            id: "es_follicular_2",
            title: "Pechuga de Pollo a la Plancha con Aguacate y Pimientos Asados",
            image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 20,
            servings: 2,
            summary: "Plato rico en proteínas magras y grasas saludables ideales para potenciar el aumento energético y estrogénico.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/pollo-plancha",
            ingredients: ["Pechuga de pollo", "Aguacate maduro fileteado", "Pimientos rojos asados en tiras", "Aceite de oliva"],
            nutrients: { calories: 390, iron: 1.8, fiber: 5.5, magnesium: 52 }
          }
        ],
        ovulatory: [
          {
            id: "es_ovulatory_1",
            title: "Gazpacho Andaluz Tradicional con Semillas de Chía",
            image: "https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 10,
            servings: 4,
            summary: "Sopa fría, refrescante y rica en antioxidantes como el licopeno, potenciada con chía para fibra y ácidos grasos.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/gazpacho",
            ingredients: ["Tomates maduros de pera", "Pepino pelado", "Pimiento verde", "Diente de ajo pequeño", "Aceite de oliva virgen extra", "Vinagre de jerez", "Semillas de chía"],
            nutrients: { calories: 180, iron: 1.4, fiber: 4.5, magnesium: 32 }
          },
          {
            id: "es_ovulatory_2",
            title: "Merluza al Horno con Quinoa y Verduras Salteadas",
            image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 25,
            servings: 2,
            summary: "Pescado blanco al horno sobre un lecho de quinoa y calabacín, que provee zinc y antioxidantes que facilitan la ovulación.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/merluza-horno",
            ingredients: ["Lomos de merluza fresca", "Quinoa cocida", "Calabacín en rodajas", "Pimiento amarillo", "Aceite de oliva", "Romero fresco"],
            nutrients: { calories: 320, iron: 2.6, fiber: 5, magnesium: 75 }
          }
        ],
        luteal: [
          {
            id: "es_luteal_1",
            title: "Crema de Calabaza con Semillas y Huevo Poché",
            image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 30,
            servings: 2,
            summary: "La calabaza aporta potasio y betacarotenos contra la retención de agua, y el huevo aporta grasas que estabilizan la progesterona.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/crema-calabaza",
            ingredients: ["Calabaza pelada en trozos", "Puerro", "Semillas de calabaza crudas", "Huevos frescos", "Aceite de oliva"],
            nutrients: { calories: 340, iron: 3.1, fiber: 5, magnesium: 74 }
          },
          {
            id: "es_luteal_2",
            title: "Mousse Cremoso de Aguacate, Plátano y Cacao Puro",
            image: "https://images.unsplash.com/photo-1541795795328-f073b763494e?auto=format&fit=crop&w=400&q=80",
            readyInMinutes: 10,
            servings: 2,
            summary: "Postre cremoso alto en magnesio y potasio idóneo para combatir el síndrome premenstrual (SPM) y los antojos de azúcar.",
            spoonacularSourceUrl: "https://unsplash.com/s/photos/mousse-chocolate",
            ingredients: ["Aguacate maduro", "Plátano maduro", "Cacau puro en polvo sin azúcar", "Miel o sirope de ágave"],
            nutrients: { calories: 240, iron: 1.5, fiber: 6, magnesium: 70 }
          }
        ]
      }
    };

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

    let recommendations: Array<any> = [];
    const apiKey = process.env.SPOONACULAR_API_KEY;

    if (apiKey) {
      try {
        const { cuisine, queryText } = getCuisineAndQueryForCountry(country);
        
        let phaseQuery = "";
        let includeIngredients = "";
        let minIron = 0;
        let minFiber = 0;
        let minMagnesium = 0;

        switch (phase) {
          case "menstrual":
            phaseQuery = "soup";
            includeIngredients = "spinach,kale,lentil,beef";
            minIron = 2;
            break;
          case "follicular":
            phaseQuery = "salad";
            includeIngredients = "avocado,broccoli,chicken,salmon";
            minFiber = 2;
            break;
          case "ovulatory":
            phaseQuery = "smoothie";
            includeIngredients = "quinoa,berry,almonds,chia";
            break;
          case "luteal":
            phaseQuery = "sweet potato";
            includeIngredients = "banana,chocolate,turkey,cocoa";
            minMagnesium = 30;
            break;
        }

        // Helper para chamar Spoonacular
        const fetchSpoon = async (c: string, q: string) => {
          const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
          url.searchParams.append("apiKey", apiKey);
          url.searchParams.append("number", "3");
          url.searchParams.append("addRecipeInformation", "true");
          url.searchParams.append("addRecipeNutrition", "true");
          url.searchParams.append("fillIngredients", "true");
          if (q) url.searchParams.append("query", q);
          if (c) url.searchParams.append("cuisine", c);
          if (includeIngredients) url.searchParams.append("includeIngredients", includeIngredients);
          if (minIron > 0) url.searchParams.append("minIron", String(minIron));
          if (minFiber > 0) url.searchParams.append("minFiber", String(minFiber));
          if (minMagnesium > 0) url.searchParams.append("minMagnesium", String(minMagnesium));

          const spoonRes = await fetch(url.toString());
          if (!spoonRes.ok) {
            throw new Error(`Spoonacular HTTP ${spoonRes.status}`);
          }
          return spoonRes.json();
        };

        // 1. Tentar busca direcionada com filtro de culinária e país
        const targetQuery = queryText ? `${queryText} ${phaseQuery}` : phaseQuery;
        let spoonData = await fetchSpoon(cuisine, targetQuery);

        // 2. Tentar busca geral se a busca por país não retornar resultados
        if (!spoonData || !spoonData.results || spoonData.results.length === 0) {
          spoonData = await fetchSpoon("", phaseQuery);
        }

        if (spoonData && spoonData.results && spoonData.results.length > 0) {
          recommendations = spoonData.results.map((recipe: any) => ({
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
      } catch (spoonError: any) {
        console.warn("Erro ao contactar a API Spoonacular. Ativando fallback local:", spoonError.message || spoonError);
      }
    }

    // 5. Ativar Fallback Local Típico caso as receitas estejam vazias (sem chave, erro de API ou zero resultados)
    if (recommendations.length === 0) {
      const normCountry = country.trim().toLowerCase();
      let countryKey = "brasil";
      
      if (normCountry.startsWith("bras") || normCountry.startsWith("braz")) {
        countryKey = "brasil";
      } else if (normCountry.startsWith("port")) {
        countryKey = "portugal";
      } else if (normCountry.startsWith("esp") || normCountry.startsWith("spa")) {
        countryKey = "espanha";
      } else {
        countryKey = "brasil"; // Fallback padrão
      }
      
      recommendations = countryFallbacks[countryKey]?.[phase] || countryFallbacks.brasil[phase];
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
