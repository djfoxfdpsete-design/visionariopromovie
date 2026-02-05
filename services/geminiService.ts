
import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

export class GeminiService {
  private static async getAI() {
    return new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  }

  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  static async generateVideo(
    imageFile: File,
    aspectRatio: AspectRatio = '16:9',
    onStatusUpdate?: (status: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const ai = await this.getAI();
    const base64Data = await this.fileToBase64(imageFile);

    if (signal?.aborted) throw new Error("ABORTED");

    onStatusUpdate?.("Iniciando geração de vídeo...");

    const apiAspectRatio = aspectRatio === '4:3' ? '16:9' : aspectRatio;

    try {
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'Professional cinematic conversion of this photo into an 8-second realistic 720p movie scene with high-fidelity camera motion and lighting.',
        image: {
          imageBytes: base64Data,
          mimeType: imageFile.type,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: apiAspectRatio as '16:9' | '9:16'
        }
      });

      onStatusUpdate?.("Renderizando frames...");

      while (!operation.done) {
        if (signal?.aborted) throw new Error("ABORTED");
        await new Promise(resolve => setTimeout(resolve, 8000));

        operation = await ai.operations.getVideosOperation({ operation: operation });

        // Verifica se houve erro interno na operação da IA
        const responseData = operation.response as any;
        if (responseData?.error) {
          throw new Error(`Erro da IA: ${responseData.error.message}`);
        }
      }

      const videos = operation.response?.generatedVideos;
      if (!videos || videos.length === 0) {
        throw new Error("A IA concluiu a tarefa mas não retornou nenhum vídeo. Tente novamente.");
      }

      const downloadLink = videos[0]?.video?.uri;
      if (!downloadLink) {
        throw new Error("Link de download não encontrado no resultado final.");
      }

      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`, { signal });
      if (!response.ok) throw new Error("Falha ao baixar o arquivo de vídeo do servidor.");

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'ABORTED') {
        throw new Error("ABORTED");
      }
      if (error.message?.includes("Requested entity was not found")) {
        throw new Error("REAUTH_NEEDED");
      }
      throw error;
    }
  }
}
