/**
 * Utilitário de compressão de imagens no lado do cliente usando HTML5 Canvas.
 * Projetado para o ecossistema premium Nefertiti para otimizar uploads
 * (ex: fotos de perfil, postagens sociais) garantindo imagens nítidas
 * porém leves (< 250KB), reduzindo o uso de banda e armazenamento do Firebase.
 */

interface CompressionOptions {
  maxDimension?: number;   // Largura ou altura máxima (default: 1200px)
  initialQuality?: number; // Qualidade inicial do JPEG (default: 0.75)
  maxSizeBytes?: number;   // Tamanho máximo desejado do arquivo final (default: 250KB)
}

/**
 * Comprime um arquivo de imagem recebido do input de arquivo usando HTML5 Canvas.
 * Caso o arquivo comprimido exceda o limite de tamanho (maxSizeBytes), a função
 * realiza compressões recursivas adicionais com qualidade e dimensões reduzidas
 * de forma adaptativa.
 * 
 * @param file O arquivo de imagem original (File)
 * @param options Configurações opcionais de compressão
 * @returns Uma Promise que resolve em um novo arquivo (File) JPEG comprimido
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxDimension = 1200,
    initialQuality = 0.75,
    maxSizeBytes = 250 * 1024, // 250 KB
  } = options;

  // Se o arquivo original já for menor que o limite desejado E já for um formato web otimizado (JPEG/PNG),
  // e o usuário não quiser forçar o redimensionamento de 1200px, poderíamos pular.
  // No entanto, para garantir que fotos imensas de celulares (geralmente com metadados EXIF pesados)
  // sejam padronizadas, sempre aplicamos o redimensionamento e compressão.
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = async () => {
        try {
          const compressedBlob = await compressWithCanvas(img, maxDimension, initialQuality, maxSizeBytes);
          
          // Criar um novo File a partir do Blob, preservando o nome original mas mudando a extensão se necessário
          const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
          const newFileName = `${originalNameWithoutExt}_optimized.jpg`;
          
          const compressedFile = new File([compressedBlob], newFileName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          
          resolve(compressedFile);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error("Falha ao carregar a imagem no elemento HTMLImage."));
      };
    };
    
    reader.onerror = () => {
      reject(new Error("Falha ao ler o arquivo original."));
    };
  });
}

/**
 * Função interna que executa o desenho no Canvas e avalia o tamanho do Blob resultante,
 * diminuindo recursivamente os parâmetros se exceder o limite de bytes desejado.
 */
async function compressWithCanvas(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
  maxBytes: number,
  attempt: number = 1
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // 1. Calcular novas dimensões mantendo a proporção
    let width = img.width;
    let height = img.height;
    
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    
    // 2. Criar e configurar o Canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Não foi possível obter o contexto 2D do Canvas."));
      return;
    }
    
    // 3. Pintar fundo branco (caso a imagem tenha transparência PNG, ela vira fundo branco no JPEG)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    
    // 4. Desenhar a imagem no Canvas com as novas dimensões
    ctx.drawImage(img, 0, 0, width, height);
    
    // 5. Converter para Blob JPEG
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Erro ao converter o Canvas em Blob."));
          return;
        }
        
        console.log(
          `Tentativa de compressão #${attempt} | Dimensões: ${width}x${height} | Qualidade: ${quality.toFixed(2)} | Tamanho resultante: ${(blob.size / 1024).toFixed(1)} KB`
        );
        
        // 6. Se o arquivo ainda for maior que o desejado (e não esgotamos as tentativas)
        // Reduzimos a qualidade e o tamanho progressivamente para caber nos 250KB
        if (blob.size > maxBytes && attempt < 4) {
          const nextQuality = Math.max(quality - 0.15, 0.45); // Qualidade mínima de 0.45 para não degradar muito
          const nextMaxDim = Math.round(maxDim * 0.85);       // Reduz a dimensão máxima em 15%
          
          resolve(
            await compressWithCanvas(img, nextMaxDim, nextQuality, maxBytes, attempt + 1)
          );
        } else {
          // Se coube ou atingimos o limite de tentativas (qualidade/dimensão mínima aceitável)
          resolve(blob);
        }
      },
      "image/jpeg",
      quality
    );
  });
}
