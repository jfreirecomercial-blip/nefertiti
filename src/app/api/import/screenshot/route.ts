import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Nenhuma imagem fornecida" },
        { status: 400 }
      );
    }

    // Remover prefixo de DataURL se existir (ex: data:image/jpeg;base64,...)
    const base64Data = image.includes("base64,")
      ? image.split("base64,")[1]
      : image;

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // Se não houver chave de API configurada, fornecer dados mockados realistas para fins de demonstração/teste local
    if (!apiKey || apiKey === "AIzaSyFakeKeyForBuildTimePrerendering") {
      console.warn("[Nefertiti AI] GEMINI_API_KEY não configurada. Retornando dados simulados (mock).");
      
      const today = new Date();
      const logs = [];
      
      // Simular histórico de 5 dias de menstruação
      for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (10 + i)); // Cerca de 10 a 15 dias atrás
        const dateStr = date.toISOString().split("T")[0];
        
        logs.push({
          date: dateStr,
          flow: i === 0 || i === 4 ? "light" : i === 2 ? "heavy" : "medium",
          symptoms: i === 1 || i === 2 ? ["cramps", "bloating"] : i === 3 ? ["headache"] : [],
          mood: i === 2 ? "sensitive" : i === 4 ? "calm" : "tired",
          waterIntakeMl: 1500 + i * 250,
          notes: `Dados simulados importados via OCR Nefertiti (Dia ${i+1} do ciclo detectado no print).`,
        });
      }

      return NextResponse.json({
        success: true,
        source: "mock",
        data: logs,
      });
    }

    // Chamar a API do Gemini 1.5 Flash (ideal para velocidade e OCR de baixo custo)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Você é um assistente de OCR médico de alta precisão especializado em ler capturas de tela de aplicativos de saúde feminina e ciclo menstrual (como Clue, Flo, Calendário Menstrual). 
                Analise esta captura de tela e extraia o histórico menstrual e sintomas.
                Retorne estritamente um array JSON válido contendo objetos no seguinte formato:
                [
                  {
                    "date": "YYYY-MM-DD",
                    "flow": "none" | "light" | "medium" | "heavy",
                    "symptoms": ["cramps", "headache", "bloating", "tender-breasts", "fatigue", "acne", "insomnia"],
                    "mood": "happy" | "calm" | "anxious" | "tired" | "sensitive" | "energetic" | "focused",
                    "waterIntakeMl": número,
                    "notes": "texto resumindo os sintomas transcritos da imagem"
                  }
                ]
                Observações importantes:
                1. O array pode conter apenas um objeto (se o print mostrar apenas um dia) ou múltiplos objetos (se for um relatório semanal ou mensal).
                2. Tente traduzir os sintomas e humores da imagem para as chaves correspondentes padronizadas acima.
                3. Retorne APENAS o JSON puro. Não adicione marcações de código markdown (como \`\`\`json), nem explicações adicionais.`
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Erro na API do Gemini:", errText);
      return NextResponse.json(
        { error: "Falha na chamada à API de Inteligência Artificial" },
        { status: 500 }
      );
    }

    const result = await response.json();
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      return NextResponse.json(
        { error: "Não foi possível extrair dados da imagem" },
        { status: 422 }
      );
    }

    // Limpar qualquer caractere extra que possa quebrar o parse
    const cleanText = textResponse.trim();
    const parsedData = JSON.parse(cleanText);

    return NextResponse.json({
      success: true,
      source: "gemini-ocr",
      data: parsedData,
    });

  } catch (error: any) {
    console.error("Erro na rota de importação por IA:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor: " + error.message },
      { status: 500 }
    );
  }
}
