
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Frame, Asset, StorySettings, ActorDossier, Sketch } from '../types';
import { fileToBase64, fetchCorsImage, dataUrlToFile } from '../utils/fileUtils';

export type StoryGenerationUpdate = 
  | { type: 'progress'; message: string; index?: number }
  | { type: 'frame'; index: number; frame: Omit<Frame, 'file'> };

// Centralized error handler to provide user-friendly messages
function handleApiError(error: unknown) {
    if (error instanceof Error) {
        // Check for specific quota-related error messages
        if (error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes("429")) {
            throw new Error(
                "Квота API исчерпана. Пожалуйста, проверьте ваш тарифный план или выберите другой ключ в меню пользователя (иконка в правом верхнем углу)."
            );
        }
        // Check for API not enabled or model not found
        if (error.message.includes("404") || error.message.includes("NOT_FOUND")) {
             throw new Error(
                "Ошибка 404: Модель не найдена или API выключен. Пожалуйста, зайдите в Google Cloud Console, найдите 'Generative Language API' и нажмите 'Enable'."
            );
        }
    }
    // Re-throw the original or a generic error if it's not a known type
    throw error;
}

async function urlOrFileToBase64(frame: Frame | Omit<Asset, 'file'> | Omit<Frame, 'file'> | Asset | Omit<Asset, 'id'> | { imageUrl: string } | Sketch): Promise<{ mimeType: string; data: string }> {
    let base64Data: string;
    let mimeType: string;

    // Handle simple object wrapper used in dossiers or sketches
    if ('imageUrl' in frame && !('imageUrls' in frame) && !('file' in frame)) {
         const imgUrl = (frame as {imageUrl: string}).imageUrl;
         if (imgUrl.startsWith('data:')) {
            const parts = imgUrl.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            base64Data = parts[1];
            return { mimeType, data: base64Data };
         } else {
            const blob = await fetchCorsImage(imgUrl);
            const reader = new FileReader();
            base64Data = await new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            mimeType = blob.type;
             return { mimeType, data: base64Data.split(',')[1] };
         }
    }

    const imageUrl = 'imageUrls' in frame 
        ? (frame as Frame).imageUrls[(frame as Frame).activeVersionIndex] 
        : (frame as { imageUrl: string }).imageUrl;

    if (!imageUrl) {
        throw new Error("Image URL is missing");
    }

    if ('file' in frame && frame.file) {
        base64Data = await fileToBase64(frame.file);
        mimeType = frame.file.type;
    } else if (imageUrl.startsWith('data:')) {
        const parts = imageUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        base64Data = parts[1];
        return { mimeType, data: base64Data };
    }
    else {
        const blob = await fetchCorsImage(imageUrl);
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
    try {
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

        const promptText = `Проанализируй эту последовательность изображений для раскадровки видео. Пойми общий сюжет, развитие персонажей и визуальный стиль. Для каждого изображения сгенерируй краткий, описательный промт для модели генерации видео. Промт должен быть прямой инструкцией, сфокусированной на действии, движении камеры и настроении.

Сложность промта должна соответствовать длительности кадра. Вот длительности для каждого кадра по порядку: ${frames.map(f => `${f.duration.toFixed(2)}s`).join(', ')}.

Верни ТОЛЬКО валидный JSON-массив строк, где каждая строка — это промт для соответствующего изображения в предоставленном порядке. Все промты должны быть на русском языке. Не включай никакой другой текст, объяснения или markdown-разметку.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
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
        
        const text = response.text?.trim() || "[]";
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
    } catch (error) {
        handleApiError(error);
        return [];
    }
}

export async function generateSinglePrompt(frameToUpdate: Frame, allFrames: Frame[]): Promise<string> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const { mimeType, data } = await urlOrFileToBase64(frameToUpdate);
        const imagePart = { inlineData: { mimeType, data } };

        const currentIndex = allFrames.findIndex(f => f.id === frameToUpdate.id);
        const prevFrame = currentIndex > 0 ? allFrames[currentIndex - 1] : null;
        const nextFrame = currentIndex < allFrames.length - 1 ? allFrames[currentIndex + 1] : null;

        let contextPrompt = `Ты генерируешь видео-промт для одного кадра в большой раскадровке.
        Длительность текущего кадра: ${frameToUpdate.duration.toFixed(2)} секунд.
        Промт должен соответствовать этой длительности.`;

        if (prevFrame?.prompt) {
            contextPrompt += `\nПромт предыдущего кадра был: "${prevFrame.prompt}"`;
        }
        if (nextFrame?.prompt) {
            contextPrompt += `\nПромт следующего кадра: "${nextFrame.prompt}"`;
        }

        contextPrompt += `\n\nОсновываясь на этом контексте, опиши предоставленное изображение для промта генерации видео. Сфокусируйся на действии, движении камеры и настроении, чтобы обеспечить плавный переход между кадрами. Выведи только сам текст промта на русском языке, без каких-либо дополнительных комментариев.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: contextPrompt }, imagePart] },
        });

        return response.text || "";
    } catch (error) {
        handleApiError(error);
        return "";
    }
}

export async function generateVideoFromFrame(frame: Frame, setLoadingMessage: (msg: string) => void): Promise<string> {
    try {
        if (!process.env.API_KEY) {
            throw new Error("API-ключ не найден. Пожалуйста, выберите ключ в меню пользователя.");
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
            const errorBody = await videoResponse.text();
            console.error("Failed to download video:", errorBody);
            throw new Error(`Не удалось загрузить сгенерированное видео. Статус: ${videoResponse.status}`);
        }

        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);
    } catch (error) {
        handleApiError(error);
        return "";
    }
}

export async function generateImageFromPrompt(prompt: string, aspectRatio: string = '16:9'): Promise<string> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: aspectRatio,
            },
        });

        const base64ImageBytes: string | undefined = response.generatedImages[0]?.image.imageBytes;

        if (base64ImageBytes) {
            return `data:image/png;base64,${base64ImageBytes}`;
        }

        throw new Error("No image was generated by the model.");
    } catch (error) {
        handleApiError(error);
        return "";
    }
}

export async function editImage(
    originalFrame: Omit<Frame, 'file'>,
    editInstruction: string
): Promise<{ imageUrl: string, prompt: string }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const { mimeType, data } = await urlOrFileToBase64(originalFrame);
        const imagePart = { inlineData: { mimeType, data } };
        
        const editResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: editInstruction }, imagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        let newImageUrl: string | null = null;
        let newImageMimeType: string = 'image/png';
        let newImageBase64: string = '';

        if (editResponse.candidates && editResponse.candidates.length > 0 && editResponse.candidates[0].content && editResponse.candidates[0].content.parts) {
            for (const part of editResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                    newImageMimeType = part.inlineData.mimeType;
                    newImageBase64 = part.inlineData.data;
                    newImageUrl = `data:${newImageMimeType};base64,${newImageBase64}`;
                    break;
                }
            }
        }

        if (!newImageUrl) {
            throw new Error("AI failed to generate an edited image.");
        }

        // Generate new prompt
        const newImagePartForPromptGen = { inlineData: { mimeType: newImageMimeType, data: newImageBase64 } };
        const promptGenText = `Проанализируй это изображение. Оригинальный промт: "${originalFrame.prompt}". Редактирование: "${editInstruction}". Создай новый краткий промт на русском.`;
        
        const promptGenResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: promptGenText }, newImagePartForPromptGen] },
        });

        const newPrompt = promptGenResponse.text?.trim() || `${originalFrame.prompt}, ${editInstruction}`;

        return { imageUrl: newImageUrl, prompt: newPrompt };
    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function generateImageInContext(
    userPrompt: string,
    leftFrame: Frame | null,
    rightFrame: Frame | null,
    currentFrame: Frame | null = null
): Promise<{ imageUrl: string; prompt: string }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const imageGenParts: any[] = [];
        
        let instructionText = `You are a storyboard artist. Create a new image based on the prompt and context. User Prompt: "${userPrompt}".`;

        if (currentFrame) {
             try {
                const { mimeType, data } = await urlOrFileToBase64(currentFrame);
                imageGenParts.push({ inlineData: { mimeType, data } });
                instructionText += `\n\n[IDENTITY REFERENCE] This image is the reference for the subject/composition. Refine it based on the prompt.`;
            } catch (e) {}
        }
        
        instructionText += `\n\n[STYLE REFERENCE] Match the visual style of these context frames:`;

        if (leftFrame) {
            try {
                const { mimeType, data } = await urlOrFileToBase64(leftFrame);
                imageGenParts.push({ inlineData: { mimeType, data } });
                instructionText += `\n[CONTEXT LEFT] Previous frame.`;
            } catch (e) {}
        }
        if (rightFrame) {
            try {
                const { mimeType, data } = await urlOrFileToBase64(rightFrame);
                imageGenParts.push({ inlineData: { mimeType, data } });
                instructionText += `\n[CONTEXT RIGHT] Next frame.`;
            } catch (e) {}
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: instructionText },
                    ...imageGenParts
                ]
            },
            config: { responseModalities: [Modality.IMAGE] }
        });

        let newImageUrl = '';
        let newImageMimeType = 'image/png';
        let newImageBase64 = '';

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    newImageMimeType = part.inlineData.mimeType;
                    newImageBase64 = part.inlineData.data;
                    newImageUrl = `data:${newImageMimeType};base64,${newImageBase64}`;
                    break;
                }
            }
        }

        if (!newImageUrl) throw new Error("Failed to generate image.");

        // Generate Prompt for the new image
        const promptGenText = `Describe this image for a video generation prompt. Russian language.`;
        const promptResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { 
                parts: [
                    { text: promptGenText }, 
                    { inlineData: { mimeType: newImageMimeType, data: newImageBase64 } }
                ] 
            }
        });

        return { imageUrl: newImageUrl, prompt: promptResponse.text?.trim() || userPrompt };

    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function regenerateFrameImage(frame: Frame, allFrames: Frame[]): Promise<{ imageUrl: string; prompt: string }> {
    const index = allFrames.findIndex(f => f.id === frame.id);
    const left = index > 0 ? allFrames[index - 1] : null;
    const right = index < allFrames.length - 1 ? allFrames[index + 1] : null;
    return generateImageInContext(frame.prompt, left, right, frame);
}

export async function adaptImageToStory(
    frameOrSketch: Frame | Sketch,
    contextFrames: Frame[],
    instruction: string,
    knownCharacterRef?: { originalUrl: string, adaptedUrl: string, characterDescription: string }
): Promise<{ imageUrl: string; prompt: string; analysis?: any }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const inputParts: any[] = [];
        const { mimeType, data } = await urlOrFileToBase64(frameOrSketch);
        inputParts.push({ inlineData: { mimeType, data } });

        let promptText = `Modify this image. Instruction: "${instruction}".`;

        if (knownCharacterRef) {
            // If we have a known character reference, pass it to the model
            try {
                const refBlob = await fetchCorsImage(knownCharacterRef.adaptedUrl);
                const refBase64 = await fileToBase64(new File([refBlob], "ref.png"));
                const refData = refBase64.split(',')[1];
                const refMime = refBlob.type;
                inputParts.push({ inlineData: { mimeType: refMime, data: refData } });
                promptText += `\n\nReference Character (Use this look): ${knownCharacterRef.characterDescription}`;
            } catch (e) {
                console.warn("Failed to load character reference image", e);
            }
        }

        // Add context for style if available
        if (contextFrames.length > 0) {
            promptText += `\n\nMatch the style of the provided context images.`;
            // Pick up to 2 neighbors
            for (const ctxFrame of contextFrames.slice(0, 2)) {
                 try {
                    const { mimeType: m, data: d } = await urlOrFileToBase64(ctxFrame);
                    inputParts.push({ inlineData: { mimeType: m, data: d } });
                } catch (e) {}
            }
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: promptText },
                    ...inputParts
                ]
            },
            config: { responseModalities: [Modality.IMAGE] }
        });

        let newImageUrl = '';
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    newImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
        }

        if (!newImageUrl) throw new Error("Failed to adapt image.");

        // Analysis / Prompt generation
        const descPrompt = `Describe this image in Russian. Also provide a JSON object with keys: subjectIdentity (string), roleLabel (short string), subjectType (character/object/location). Format: TEXT_DESCRIPTION | JSON_STRING`;
        const descResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { 
                parts: [
                    { text: descPrompt }, 
                    { inlineData: { mimeType: response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'image/png', data: response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '' } }
                ] 
            }
        });

        const textOutput = descResponse.text?.trim() || "";
        const parts = textOutput.split('|');
        const finalPrompt = parts[0].trim();
        let analysis = {};
        try {
            if (parts[1]) analysis = JSON.parse(parts[1].trim());
        } catch (e) {}

        return { imageUrl: newImageUrl, prompt: finalPrompt, analysis };

    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function adaptImageAspectRatio(frame: Frame, targetAspectRatio: string): Promise<{ imageUrl: string; prompt: string }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const { mimeType, data } = await urlOrFileToBase64(frame);
        
        const promptText = `Regenerate this image with aspect ratio ${targetAspectRatio}. Keep the main subject and composition but extend or crop to fit. Prompt: ${frame.prompt}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: promptText },
                    { inlineData: { mimeType, data } }
                ]
            },
            config: { responseModalities: [Modality.IMAGE] }
        });

        let newImageUrl = '';
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    newImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
        }

        if (!newImageUrl) throw new Error("Failed to resize image.");
        return { imageUrl: newImageUrl, prompt: frame.prompt };
    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function* createStoryFromAssets(assets: Asset[], settings: StorySettings, frameCount: number): AsyncGenerator<StoryGenerationUpdate, void, unknown> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 1. Analyze Assets
    yield { type: 'progress', message: 'Анализ ассетов...' };
    const assetParts = await Promise.all(assets.map(async a => {
        const { mimeType, data } = await urlOrFileToBase64(a);
        return { inlineData: { mimeType, data } };
    }));

    const analysisPrompt = `Analyze these images. Identify characters, locations, and objects. Create a story outline based on genre: "${settings.genre || 'General'}", ending: "${settings.ending || 'Happy'}", and user idea: "${settings.prompt || ''}".`;
    
    await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: analysisPrompt }, ...assetParts] }
    });

    // 2. Script Generation
    yield { type: 'progress', message: 'Создание сценария...' };
    const scriptPrompt = `Create a storyboard script with exactly ${frameCount} frames. For each frame, provide a visual description prompt (Russian). Return JSON array of strings.`;
    
    const scriptResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ text: scriptPrompt }, ...assetParts] },
        config: { 
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    });

    let prompts: string[] = [];
    try {
        prompts = JSON.parse(scriptResponse.text || "[]");
    } catch (e) {
        throw new Error("Failed to parse script.");
    }

    // 3. Generation
    let prevFrame: Omit<Frame, 'file'> | null = null;
    for (let i = 0; i < Math.min(prompts.length, frameCount); i++) {
        yield { type: 'progress', message: `Генерация кадра ${i+1}/${frameCount}...`, index: i };
        
        try {
            // Generate image using imagen (or gemini image with reference)
            // We use gemini-image-flash here to maintain consistency if we pass context, but calling generateImageInContext is easier
            const { imageUrl, prompt } = await generateImageInContext(prompts[i], prevFrame as Frame, null, null); // Cast prevFrame to Frame, it's close enough for this context
            
            const newFrame: Omit<Frame, 'file'> = {
                id: crypto.randomUUID(),
                imageUrls: [imageUrl],
                activeVersionIndex: 0,
                prompt: prompt,
                duration: 3.0,
                aspectRatio: '16:9'
            };
            
            prevFrame = newFrame;
            yield { type: 'frame', index: i, frame: newFrame };
        } catch (e) {
            console.error(`Frame ${i} generation failed`, e);
        }
    }
}

export async function generateStoryIdeasFromAssets(assets: Asset[], settings: StorySettings): Promise<{title: string, synopsis: string}[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const assetParts = await Promise.all(assets.slice(0, 5).map(async a => {
            const { mimeType, data } = await urlOrFileToBase64(a);
            return { inlineData: { mimeType, data } };
        }));

        const prompt = `Generate 3 story ideas based on these images. Genre: ${settings.genre}. User idea: ${settings.prompt}. Return JSON array of objects with 'title' and 'synopsis' (Russian).`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, ...assetParts] },
            config: { 
                responseMimeType: "application/json",
                responseSchema: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: { title: { type: Type.STRING }, synopsis: { type: Type.STRING } } 
                    } 
                } 
            }
        });

        return JSON.parse(response.text || "[]");
    } catch (error) {
        handleApiError(error);
        return [];
    }
}

export async function generatePromptSuggestions(leftFrame: Frame | null, rightFrame: Frame | null): Promise<string[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let prompt = "Generate 4 distinct prompt ideas for a storyboard frame (Russian). Return JSON array of strings.";
        const parts: any[] = [{ text: prompt }];
        
        if (leftFrame) {
            const { mimeType, data } = await urlOrFileToBase64(leftFrame);
            parts.push({ inlineData: { mimeType, data } });
            prompt += " It should follow this previous frame.";
        }
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) { return []; }
}

export async function generateEditSuggestions(frame: Frame, left: Frame | null, right: Frame | null): Promise<string[]> {
    // Similar logic
    return generatePromptSuggestions(frame, null); // Simplified reuse
}

export async function generateAdaptationSuggestions(frame: Frame, left: Frame | null, right: Frame | null): Promise<string[]> {
     // Similar logic
     return generatePromptSuggestions(frame, null); // Simplified reuse
}

export async function integrateAssetIntoFrame(source: Asset | {imageUrl: string, name: string, file: File}, target: Frame, instruction: string, mode: string): Promise<{ imageUrl: string; prompt: string }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const { mimeType: sMime, data: sData } = await urlOrFileToBase64(source);
        const { mimeType: tMime, data: tData } = await urlOrFileToBase64(target);
        
        const prompt = `Integrate the first image (Source: ${source.name}) into the second image (Target). Instruction: ${instruction}. Mode: ${mode}.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: sMime, data: sData } },
                    { inlineData: { mimeType: tMime, data: tData } }
                ]
            },
            config: { responseModalities: [Modality.IMAGE] }
        });

         let newImageUrl = '';
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    newImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
        }
        if (!newImageUrl) throw new Error("Integration failed");
        
        return { imageUrl: newImageUrl, prompt: target.prompt + " (Integrated)" };

    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function generateIntegrationSuggestions(source: Asset | {imageUrl: string, name: string, file: File}, target: Frame, mode: string): Promise<string[]> {
    // Simple text gen
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Suggest 4 ways to integrate the source object into the target scene (Russian). Mode: ${mode}. Return JSON array of strings.`;
        const { mimeType: sMime, data: sData } = await urlOrFileToBase64(source);
        const { mimeType: tMime, data: tData } = await urlOrFileToBase64(target);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: sMime, data: sData } },
                    { inlineData: { mimeType: tMime, data: tData } }
                ]
            },
            config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) { return []; }
}
