
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Frame } from '../types';
import { fileToBase64 } from '../utils/fileUtils';

async function urlOrFileToBase64(frame: Frame): Promise<{ mimeType: string; data: string }> {
    let base64Data: string;
    let mimeType: string;

    if (frame.file) {
        base64Data = await fileToBase64(frame.file);
        mimeType = frame.file.type;
    } else if (frame.imageUrl.startsWith('data:')) {
        const parts = frame.imageUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        base64Data = parts[1];
        return { mimeType, data: base64Data };
    }
    else {
        const response = await fetch(frame.imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        base64Data = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        mimeType = blob.type;
    }

    return { mimeType, data: base64Data.split(',')[1] };
}


export async function analyzeStory(frames: Frame[]): Promise<string[]> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const imageParts = await Promise.all(
        frames.map(async (frame) => {
            const { mimeType, data } = await urlOrFileToBase64(frame);
            return {
                inlineData: {
                    mimeType,
                    data,
                },
            };
        })
    );

    const promptText = `Analyze this sequence of storyboard images for a video. Understand the overall plot, character progression, and visual style. For each image, generate a concise, descriptive prompt for a video generation model. The prompt must be a direct instruction, focusing on action, camera movement, and mood.

The complexity of the prompt should match the frame's duration. Here are the durations for each frame in order: ${frames.map(f => `${f.duration.toFixed(2)}s`).join(', ')}.

Return ONLY a valid JSON array of strings, with each string being the prompt for the corresponding image in the order provided. Do not include any other text, explanation, or markdown formatting.`;


    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: {
            parts: [
                { text: promptText },
                ...imageParts,
            ]
        },
        config: {
             responseMimeType: "application/json",
             responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING,
                }
             }
        }
    });
    
    const text = response.text.trim();
    try {
        const prompts = JSON.parse(text);
        if (Array.isArray(prompts) && prompts.every(p => typeof p === 'string')) {
            return prompts;
        }
        throw new Error("AI response is not a valid JSON array of strings.");
    } catch (e) {
        console.error("Failed to parse AI response:", text);
        throw new Error("Could not parse the response from the AI. Please try again.");
    }
}

export async function generateSinglePrompt(frameToUpdate: Frame, allFrames: Frame[]): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const { mimeType, data } = await urlOrFileToBase64(frameToUpdate);
    const imagePart = { inlineData: { mimeType, data } };

    const currentIndex = allFrames.findIndex(f => f.id === frameToUpdate.id);
    const prevFrame = currentIndex > 0 ? allFrames[currentIndex - 1] : null;
    const nextFrame = currentIndex < allFrames.length - 1 ? allFrames[currentIndex + 1] : null;

    let contextPrompt = `You are generating a video prompt for a single frame within a larger storyboard.
    Duration of current frame: ${frameToUpdate.duration.toFixed(2)} seconds.
    The prompt should be appropriate for this duration.`;

    if (prevFrame?.prompt) {
        contextPrompt += `\nThe previous frame's prompt was: "${prevFrame.prompt}"`;
    }
    if (nextFrame?.prompt) {
        contextPrompt += `\nThe next frame's prompt is: "${nextFrame.prompt}"`;
    }

    contextPrompt += `\n\nBased on this context, describe the provided image for a video generation prompt. Focus on action, camera movement, and mood to ensure a smooth transition between frames. Output only the prompt text itself, with no additional commentary.`;


    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: contextPrompt }, imagePart] },
    });

    return response.text;
}


export async function generateVideoFromFrame(frame: Frame, setLoadingMessage: (msg: string) => void): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API key is not available. Please select one.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    setLoadingMessage("Подготовка к генерации видео...");
    const { mimeType, data } = await urlOrFileToBase64(frame);

    setLoadingMessage("Запуск генерации видео... (Это может занять несколько минут)");
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: frame.prompt,
      image: {
        imageBytes: data,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    setLoadingMessage("Видео генерируется, ожидание...");
    let pollCount = 0;
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      pollCount++;
      setLoadingMessage(`Проверка статуса... (Попытка ${pollCount})`);
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    setLoadingMessage("Видео готово! Загрузка...");
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation completed, but no download link was found.");
    }

    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!videoResponse.ok) {
        throw new Error("Failed to download the generated video.");
    }

    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);
}

export async function generateImageFromPrompt(prompt: string): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '16:9',
        },
    });

    const base64ImageBytes: string | undefined = response.generatedImages[0]?.image.imageBytes;

    if (base64ImageBytes) {
        return `data:image/png;base64,${base64ImageBytes}`;
    }

    throw new Error("No image was generated by the model.");
}

export async function editImage(base64ImageData: string, mimeType: string, prompt: string): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: base64ImageData.split(',')[1],
                        mimeType: mimeType,
                    },
                },
                {
                    text: prompt,
                },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }

    throw new Error("No edited image was generated by the model.");
}

export async function generateIntermediateFrame(leftFrame: Frame, rightFrame: Frame): Promise<{ imageUrl: string; prompt: string }> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Part 1: Generate a new image that stylistically fits between the two frames
    const { mimeType: leftMime, data: leftData } = await urlOrFileToBase64(leftFrame);
    const { mimeType: rightMime, data: rightData } = await urlOrFileToBase64(rightFrame);

    const leftImagePart = { inlineData: { mimeType: leftMime, data: leftData } };
    const rightImagePart = { inlineData: { mimeType: rightMime, data: rightData } };

    const imageGenPrompt = `Create an image that serves as a smooth visual and narrative transition between the following two images. It is crucial to perfectly match the artistic style, color palette, and character design of the provided frames.`;

    const imageGenResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: imageGenPrompt }, leftImagePart, rightImagePart] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    
    let newImageUrl: string | null = null;
    let newImageMimeType: string = 'image/png';
    for (const part of imageGenResponse.candidates[0].content.parts) {
        if (part.inlineData) {
            newImageMimeType = part.inlineData.mimeType;
            newImageUrl = `data:${newImageMimeType};base64,${part.inlineData.data}`;
            break;
        }
    }

    if (!newImageUrl) {
        throw new Error("AI failed to generate a visual for the intermediate frame.");
    }

    // Part 2: Generate a descriptive prompt for the newly created image
    const newImageFrame: Frame = { id: 'temp', imageUrl: newImageUrl, duration: 0, prompt: '' };
    const { mimeType: newMime, data: newData } = await urlOrFileToBase64(newImageFrame);
    const newImagePart = { inlineData: { mimeType: newMime, data: newData } };
    
    const promptGenText = `You are a professional storyboard artist creating a prompt for a video generation model. Analyze the provided image, which is a transition between two other frames.
    
    Previous frame's prompt: "${leftFrame.prompt}"
    Next frame's prompt: "${rightFrame.prompt}"

    Based on this context, create a concise but descriptive prompt for the provided image. Focus on action, camera movement, and mood to ensure a smooth narrative flow. Output only the prompt text itself.`;

    const promptGenResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: promptGenText }, newImagePart] },
    });

    const newPrompt = promptGenResponse.text;
    
    if (!newPrompt) {
        throw new Error("AI failed to generate a prompt for the intermediate frame.");
    }

    return { imageUrl: newImageUrl, prompt: newPrompt };
}

export async function generateTransitionPrompt(leftFrame: Frame, rightFrame: Frame): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const { mimeType: leftMime, data: leftData } = await urlOrFileToBase64(leftFrame);
    const leftImagePart = { inlineData: { mimeType: leftMime, data: leftData } };

    const { mimeType: rightMime, data: rightData } = await urlOrFileToBase64(rightFrame);
    const rightImagePart = { inlineData: { mimeType: rightMime, data: rightData } };

    const promptText = `You are an expert video editor. You are given two frames: the end of a previous scene, and the beginning of the next scene. Your task is to generate a concise, creative prompt describing a video transition from the first frame to the second.

    Context:
    - Previous scene's prompt: "${leftFrame.prompt || 'No prompt provided.'}"
    - Next scene's prompt: "${rightFrame.prompt || 'No prompt provided.'}"

    Instructions:
    1. Analyze both images and their prompts.
    2. Invent a visually interesting transition (e.g., "The camera flies through the car's exhaust pipe, which morphs into...", "A quick blur transition focuses on the scientist's worried eyes...", "The screen glitches and pixelates, reforming into the next scene...").
    3. The generated text should describe ONLY the transition itself.
    4. The output must be a single, short phrase or sentence. Do not add any extra text, explanations, or labels.

    Example output: "A fast whip pan to the right blurs the scene, resolving on..."`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: {
            parts: [
                { text: promptText },
                leftImagePart,
                rightImagePart,
            ]
        },
    });

    return response.text.trim();
}
