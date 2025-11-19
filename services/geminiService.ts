
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Frame, Asset, StorySettings } from '../types';
import { fileToBase64, fetchCorsImage, createImageOnCanvas } from '../utils/fileUtils';

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


// FIX: Widened the type to accept asset-like objects without an 'id', which are used in integration features.
async function urlOrFileToBase64(frame: Frame | Omit<Asset, 'file'> | Omit<Frame, 'file'> | Asset | Omit<Asset, 'id'> | { imageUrl: string }): Promise<{ mimeType: string; data: string }> {
    let base64Data: string;
    let mimeType: string;

    // Handle simple object wrapper used in dossiers
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
            model: 'gemini-3-pro-preview', // Using Pro model for better analysis
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
    } catch (error) {
        handleApiError(error);
        return []; // Should not be reached due to throw
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

        return response.text;
    } catch (error) {
        handleApiError(error);
        return ""; // Should not be reached
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
        return ""; // Should not be reached
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
        return ""; // Should not be reached
    }
}

export async function editImage(
    originalFrame: Omit<Frame, 'file'>,
    editInstruction: string
): Promise<{ imageUrl: string, prompt: string }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // Step 1: Generate a new image by editing the original one.
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

        // Step 2: Generate a new, accurate prompt for the newly created image.
        const newImagePartForPromptGen = { inlineData: { mimeType: newImageMimeType, data: newImageBase64 } };
        const promptGenText = `Проанализируй это изображение, которое является результатом редактирования. Оригинальный промт был: "${originalFrame.prompt}". Инструкция по редактированию была: "${editInstruction}". Создай новый, краткий и точный промт на русском языке, который описывает финальное изображение. Выведи только сам текст промта.`;
        
        const promptGenResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: promptGenText }, newImagePartForPromptGen] },
        });

        const newPrompt = promptGenResponse.text.trim();

        if (!newPrompt) {
            const fallbackPrompt = `${originalFrame.prompt}, ${editInstruction}`;
            console.warn("AI failed to generate a new prompt. Using a fallback.");
            return { imageUrl: newImageUrl, prompt: fallbackPrompt };
        }

        return { imageUrl: newImageUrl, prompt: newPrompt };
    } catch (error) {
        handleApiError(error);
        throw error; // Re-throw to be caught by the UI component
    }
}

export async function generateImageInContext(
    userPrompt: string,
    leftFrame: Frame | null,
    rightFrame: Frame | null,
    currentFrame: Frame | null = null
): Promise<{ imageUrl: string; prompt: string }>{
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // --- STEP 1: Generate the image ---
        const imageGenParts: any[] = [];
        
        let instructionText = `You are a storyboard artist. Create a new image based on the prompt and context.`;

        // Add Current Frame (IDENTITY REFERENCE for regeneration)
        if (currentFrame) {
             try {
                const { mimeType, data } = await urlOrFileToBase64(currentFrame);
                imageGenParts.push({ inlineData: { mimeType, data } });
                instructionText += `\n\n[IDENTITY REFERENCE]
                This is the SUBJECT of the scene.
                Use the recognizable features (face, clothes, shape) from this image.
                Do NOT just interpolate between neighbors. Refine THIS subject based on the prompt: "${userPrompt}".`;
            } catch (e) {
                 console.warn("Current frame image missing, generating from scratch.");
            }
        }
        
        instructionText += `\n\n[STYLE REFERENCE]
        The new image must match the visual style (lighting, rendering technique) of the neighboring frames below (if provided).`;

        if (leftFrame) {
            try {
                const { mimeType, data } = await urlOrFileToBase64(leftFrame);
                imageGenParts.push({ inlineData: { mimeType, data } });
                instructionText += `\n[CONTEXT LEFT]: Previous frame (Style Ref).`;
            } catch (e) {}
        }
        if (rightFrame) {
            try {
                const { mimeType, data } = await urlOrFileToBase64(rightFrame);
                imageGenParts.push({ inlineData: { mimeType, data } });
                instructionText += `\n[CONTEXT RIGHT]: Next frame (Style Ref).`;
            } catch (e) {}
        }
        
        instructionText += `\n\n[TASK]: Generate a high-quality storyboard frame for prompt: "${userPrompt}".`;

        const imageGenResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: instructionText }, ...imageGenParts] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        let newImageUrl: string | null = null;
        let newImagePartForPromptGen: any = null;

        if (imageGenResponse.candidates && imageGenResponse.candidates.length > 0 && imageGenResponse.candidates[0].content && imageGenResponse.candidates[0].content.parts) {
            for (const part of imageGenResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                    newImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    newImagePartForPromptGen = { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } };
                    break;
                }
            }
        }

        if (!newImageUrl || !newImagePartForPromptGen) {
            throw new Error("AI failed to generate an image with context.");
        }

        // --- STEP 2: Generate a prompt for the new image ---
        let promptGenText = `Ты — профессиональный художник-раскадровщик. Проанализируй это изображение, созданное по запросу: "${userPrompt}".
        Создай краткий, но описательный промт для нового изображения на русском языке для генерации видео. Сфокусируйся на действии, движении камеры и настроении. Выведи только текст промта.`;
        
        const promptGenResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: promptGenText }, newImagePartForPromptGen] },
        });

        const newPrompt = promptGenResponse.text.trim();
        
        if (!newPrompt) {
            return { imageUrl: newImageUrl, prompt: userPrompt };
        }

        return { imageUrl: newImageUrl, prompt: newPrompt };
    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function regenerateFrameImage(frame: Frame, allFrames: Frame[]): Promise<{ imageUrl: string; prompt: string }> {
    try {
        // Reuse existing logic but pass 'frame' as currentFrame/IdentityReference
        const currentIndex = allFrames.findIndex(f => f.id === frame.id);
        const leftFrame = currentIndex > 0 ? allFrames[currentIndex - 1] : null;
        const rightFrame = currentIndex < allFrames.length - 1 ? allFrames[currentIndex + 1] : null;

        return await generateImageInContext(frame.prompt, leftFrame, rightFrame, frame);
    } catch (error) {
        handleApiError(error);
        throw error;
    }
}


export type StoryGenerationUpdate =
    | { type: 'plan', message: string }
    | { type: 'progress', message: string, index: number }
    | { type: 'frame', frame: Omit<Frame, 'file'>, index: number }
    | { type: 'complete', message: string };

export async function* createStoryFromAssets(
    assets: Asset[],
    settings: StorySettings,
    frameCount: number,
): AsyncGenerator<StoryGenerationUpdate, Omit<Frame, 'file'>[], void> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const { mode, prompt, genre, ending } = settings;
        
        yield { type: 'plan', message: "Анализ ассетов и создание плана сюжета..." };

        const assetImageParts = await Promise.all(
            assets.map(async (asset) => {
                const { mimeType, data } = await urlOrFileToBase64(asset);
                return { inlineData: { mimeType, data } };
            })
        );
        
        const assetNames = assets.map(a => a.name).join(', ');
        let storyPlanPrompt = `Ты — AI-сценарист и режиссер-постановщик раскадровки. Основываясь на предоставленных изображениях-ассетах (представляющих ключевых персонажей, предметы или локации с именами: ${assetNames}), создай захватывающую короткую историю.

    Твоя задача — разбить эту историю ровно на ${frameCount} отдельных сцен или кадров.`;
        
        if (mode === 'manual') {
            storyPlanPrompt += "\n\nСледуй этим указаниям от пользователя:";
            if (prompt) {
                storyPlanPrompt += `\n- Основная идея сюжета: "${prompt}"`;
            }
            if (genre) {
                storyPlanPrompt += `\n- Жанр или тональность истории: "${genre}"`;
            }
            if (ending) {
                storyPlanPrompt += `\n- Тип концовки: "${ending}"`;
            }
        }

        storyPlanPrompt += `

        Для каждого кадра ты должен предоставить:
        1.  'description': Краткое описание действия и композиции сцены в одном предложении, на русском языке.
        2.  'prompt': Краткий, мощный промт на русском языке для AI-генератора изображений, чтобы создать визуал для этой сцены. Этот промт должен фокусироваться на визуальных деталях, ракурсах камеры и настроении, и ОБЯЗАТЕЛЬНО должен быть стилистически совместим с предоставленными ассетами.

        Верни свой ответ ТОЛЬКО в виде валидного JSON-массива объектов, где каждый объект имеет ключи 'description' и 'prompt'. Не включай никакой другой текст, объяснения или markdown-разметку. Массив должен содержать ровно ${frameCount} элементов.
        `;

        const planResponse = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [{ text: storyPlanPrompt }, ...assetImageParts] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            prompt: { type: Type.STRING },
                        },
                        required: ["description", "prompt"],
                    },
                },
            },
        });

        const storyPlan: { description: string, prompt: string }[] = JSON.parse(planResponse.text.trim());

        if (!storyPlan || storyPlan.length === 0) {
            throw new Error("AI failed to generate a story plan.");
        }

        const newFrames: Omit<Frame, 'file'>[] = [];
        for (let i = 0; i < storyPlan.length; i++) {
            const plan = storyPlan[i];
            yield { type: 'progress', message: `Генерация кадра ${i + 1} из ${storyPlan.length}: ${plan.description}`, index: i };

            const imageGenPrompt = `Сгенерируй изображение для раскадровки.
            Описание сцены: "${plan.description}".
            Финальный видео-промт будет: "${plan.prompt}".

            Крайне важно, чтобы ты СОХРАНИЛ(А) художественный стиль, цветовую палитру и дизайн персонажей/объектов, установленные в предоставленных референсных изображениях-ассетах. Новое изображение должно ощущаться так, будто оно принадлежит той же вселенной, что и ассеты.
            `;

            let imageGenResponse = null;
            const maxRetries = 2; // Original attempt + 1 retry
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        contents: { parts: [{ text: imageGenPrompt }, ...assetImageParts] },
                        config: {
                            responseModalities: [Modality.IMAGE],
                        },
                    });
                    
                    const hasImageData = response.candidates?.[0]?.content?.parts?.some(p => p.inlineData?.data);
                    if (hasImageData) {
                        imageGenResponse = response;
                        break; 
                    }
                    
                    if (attempt === maxRetries) {
                        console.warn(`Generation succeeded but returned no image data after ${maxRetries} attempts for frame ${i + 1}.`);
                    }

                } catch (error) {
                    console.warn(`Image generation attempt ${attempt} for frame ${i + 1} failed:`, error);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retrying
                    }
                }
            }
            
            let imageUrls: string[] = [];
            if (imageGenResponse?.candidates?.[0]?.content?.parts) {
                for (const part of imageGenResponse.candidates[0].content.parts) {
                    if (part.inlineData) {
                        imageUrls.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                        break;
                    }
                }
            }
            
            const newFrameData: Omit<Frame, 'file'> = {
                id: crypto.randomUUID(),
                imageUrls,
                activeVersionIndex: 0,
                prompt: plan.prompt,
                duration: 3.0,
                hasError: imageUrls.length === 0 // Mark as error if no image was generated
            };
            newFrames.push(newFrameData);
            yield { type: 'frame', frame: newFrameData, index: i };
        }
        
        yield { type: 'complete', message: "Генерация сюжета завершена!" };
        return newFrames;
    } catch (error) {
        handleApiError(error);
        return []; // Should not be reached
    }
}

// Define interface for the Director's analysis return matching the user's schema
interface DirectorAnalysis {
    storyStyle: string;
    worldRules: string;
    subjectType: 'character' | 'object' | 'location';
    roleLabel: string; // Short label
    subjectIdentity: string;
    transformation: string;
    narrativePosition: string;
    sceneAction: string;
    visualAnchorIndex: number | null;
    visualDescription: string;
    videoPrompt: string;
}

export async function adaptImageToStory(
    frameToAdapt: Frame,
    allFrames: Frame[],
    manualInstruction?: string,
    knownCharacterReference?: { originalUrl: string, adaptedUrl: string, characterDescription: string }
): Promise<{ imageUrl: string; prompt: string; analysis: DirectorAnalysis }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // ---------------------------------------------------------------------------
        // PREPARE CONTEXT: GATHER ALL STORY FRAMES (STEP 1)
        // ---------------------------------------------------------------------------
        const targetIndex = allFrames.findIndex(f => f.id === frameToAdapt.id);
        
        const getFrameData = async (f: Frame | { imageUrl: string }) => {
            try {
                const { mimeType, data } = await urlOrFileToBase64(f);
                return { inlineData: { mimeType, data } };
            } catch (e) {
                return null;
            }
        };
        
        const directorContentParts: any[] = [];
        
        // 1. Add Story Context Frames (excluding the target one)
        for (let i = 0; i < allFrames.length; i++) {
            const frame = allFrames[i];
            if (frame.id === frameToAdapt.id) {
                directorContentParts.push({ text: `[FRAME ${i + 1} - TARGET INSERTION POINT]` });
            } else {
                directorContentParts.push({ text: `[FRAME ${i + 1}]` });
                const imageData = await getFrameData(frame);
                if (imageData) directorContentParts.push(imageData);
                if (frame.prompt) directorContentParts.push({ text: `Prompt: "${frame.prompt}"` });
            }
        }

        // 2. Add the Subject (The "Alien" Image)
        directorContentParts.push({ text: `[SUBJECT IMAGE TO ADAPT]` });
        const subjectImageData = await getFrameData(frameToAdapt);
        if (subjectImageData) {
            directorContentParts.push(subjectImageData);
        }

        // 3. Director System Instruction (Following User's Algorithm)
        const systemInstruction = `
        You are the DIRECTOR. Your goal is a seamless integration of the [SUBJECT IMAGE] into the story storyboard.

        EXECUTE THE FOLLOWING TASKS:

        TASK 1: WORLD ANALYSIS
        - Review ALL frames. Determine the visual style (2D/3D, cartoon/realism), ontology (who inhabits it?), and physical rules.

        TASK 2: SUBJECT CLASSIFICATION
        - Analyze the [SUBJECT IMAGE].
        - Type: 'character', 'object', or 'location'.
        - Extract 'subjectIdentity': Key recognizable features (face, colors, clothes, branding).
        - Generate 'roleLabel': Short 2-3 word tag (e.g., "Blue Chips", "Detective").

        TASK 3: ONTOLOGICAL TRANSFORMATION (CRITICAL)
        - Rule: IF world laws differ from subject, TRANSFORM the subject's form but KEEP features.
        - Example: Realistic Photo of Cat -> World of Geometric Shapes -> Geometric Cat.
        - Example: Cartoon Character -> Realistic World -> Realistic Human with cartoon's color palette.

        TASK 4: NARRATIVE POSITION
        - Analyze what happens BEFORE (Frames 1...N) and AFTER.
        - Rule: Do not regress narrative flow (e.g., don't go back to a left location without transition).

        TASK 5: SCENE ACTION
        - Invent a logical action for this new frame at [TARGET INSERTION POINT].
        - It MUST link the previous and next frames.
        - The subject must perform an action fitting the story, NOT copying the photo's pose.
        ${manualInstruction ? `- USER OVERRIDE: "${manualInstruction}"` : ''}

        TASK 6: VISUAL ANCHORS (CONSISTENCY CHECK)
        - Scan previous frames. Is this exact object/character already there?
        - IF YES: Return 'visualAnchorIndex' (0-based index).
        ${knownCharacterReference ? `- NOTE: System indicates this subject matches a Dossier. Treat this as a Visual Anchor match.` : ''}

        OUTPUT JSON:
        {
          "storyStyle": "Description of visual style",
          "worldRules": "Ontological laws",
          "subjectType": "character" | "object" | "location",
          "roleLabel": "Short tag (Russian)",
          "subjectIdentity": "Recognizable features to keep",
          "transformation": "How subject adapts to world",
          "narrativePosition": "Context of insertion",
          "sceneAction": "Invented action",
          "visualAnchorIndex": number | null,
          "visualDescription": "Technical prompt for the Artist (English)",
          "videoPrompt": "Video prompt for UI (Russian)"
        }
        `;

        directorContentParts.push({ text: systemInstruction });

        const directorResponse = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: { parts: directorContentParts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        storyStyle: { type: Type.STRING },
                        worldRules: { type: Type.STRING },
                        subjectType: { type: Type.STRING, enum: ["character", "object", "location"] },
                        roleLabel: { type: Type.STRING },
                        subjectIdentity: { type: Type.STRING },
                        transformation: { type: Type.STRING },
                        narrativePosition: { type: Type.STRING },
                        sceneAction: { type: Type.STRING },
                        visualAnchorIndex: { type: Type.INTEGER, nullable: true },
                        visualDescription: { type: Type.STRING },
                        videoPrompt: { type: Type.STRING },
                    },
                    required: ["storyStyle", "subjectType", "roleLabel", "sceneAction", "visualDescription", "videoPrompt"],
                },
            },
        });

        const directorOutput: DirectorAnalysis = JSON.parse(directorResponse.text.trim());
        const { visualDescription, videoPrompt, visualAnchorIndex } = directorOutput;

        // ---------------------------------------------------------------------------
        // STEP 2: THE ARTIST (GENERATION)
        // ---------------------------------------------------------------------------
        // Strictly separating inputs as per "Three Categories" rule.

        const artistContentParts: any[] = [];
        
        // 1. PROMPT (The generated visual description from Director)
        artistContentParts.push({ text: `[TASK] Generate this scene: ${visualDescription}` });

        // 2. STYLE REFERENCE (Neighboring frames)
        // Ignore content, copy rendering.
        const styleRefFrame = targetIndex > 0 ? allFrames[targetIndex - 1] : (allFrames.length > 1 ? allFrames[targetIndex + 1] : null);
        if (styleRefFrame && styleRefFrame.id !== frameToAdapt.id) {
            const styleData = await getFrameData(styleRefFrame);
            if (styleData) {
                 artistContentParts.push({ text: `[STYLE REFERENCE]\nCOPY: Rendering technique, hatching, lighting, color palette.\nIGNORE: The characters and objects in this image.`});
                 artistContentParts.push(styleData);
            }
        }

        // 3. IDENTITY REFERENCE (The Uploaded Photo)
        // Ignore style/pose, copy features.
        const subjectData = await getFrameData(frameToAdapt);
        if (subjectData) {
             artistContentParts.push({ text: `[IDENTITY REFERENCE]\nEXTRACT: Recognizable features, face/shape, clothes, colors, branding.\nIGNORE: Realism, photo style, lighting, original pose.`});
             artistContentParts.push(subjectData);
        }

        // 4. VISUAL ANCHOR (The Consistency Guarantee)
        // Copy 1:1
        let anchorData = null;
        if (knownCharacterReference) {
             // Priority 1: Dossier reference (Already adapted version)
             anchorData = await getFrameData({ imageUrl: knownCharacterReference.adaptedUrl });
        } else if (visualAnchorIndex !== null && visualAnchorIndex !== undefined && visualAnchorIndex >= 0 && visualAnchorIndex < allFrames.length) {
             // Priority 2: Found in timeline by Director
             const anchorFrame = allFrames[visualAnchorIndex];
             if (anchorFrame.id !== styleRefFrame?.id && anchorFrame.id !== frameToAdapt.id) {
                 anchorData = await getFrameData(anchorFrame);
             }
        }

        if (anchorData) {
            artistContentParts.push({ text: `[VISUAL ANCHOR]\nCRITICAL RULE: The subject MUST look EXACTLY like this image.\nCOPY: 1:1 features, colors, style details.` });
            artistContentParts.push(anchorData);
        }

        // Final System Instruction to Artist
        const artistInstruction = `
        You are the ARTIST.
        1. Take STYLE from [Style Reference].
        2. Take IDENTITY from [Identity Reference].
        3. IF [Visual Anchor] exists, copy subject appearance exactly from it.
        4. RENDER the scene described in the TASK using the new Action/Pose.
        5. DO NOT just filter the original photo. RE-DRAW it in the story's style.
        `;
        artistContentParts.push({ text: artistInstruction });

        const artistResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: artistContentParts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        let newImageUrl: string | null = null;
        if (artistResponse.candidates?.[0]?.content?.parts) {
            for (const part of artistResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                    newImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
        }

        if (!newImageUrl) {
            throw new Error("Artist AI failed to generate the adapted image.");
        }

        return { imageUrl: newImageUrl, prompt: videoPrompt, analysis: directorOutput };

    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function adaptImageAspectRatio(
    frame: Frame,
    targetRatio: string
): Promise<{ imageUrl: string; prompt: string }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const originalImageUrl = frame.imageUrls[frame.activeVersionIndex];

        // STEP 1: Create a new canvas with the original image centered and black bars.
        const compositeImageUrl = await createImageOnCanvas(originalImageUrl, targetRatio);
        
        // Convert the new composite image to the format needed for the API.
        const arr = compositeImageUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) {
          throw new Error("Invalid data URL format from canvas");
        }
        const mimeType = mimeMatch[1];
        const data = arr[1];
        const imagePart = { inlineData: { mimeType, data } };

        // --- STEP 2: Generate the new image by filling in the blank areas (outpainting) ---
        const imageGenInstruction = `Твоя задача — дорисовать (outpainting) это изображение. Заполни черные поля, творчески расширяя сцену. Новые области должны бесшовно продолжать оригинальное изображение, полностью совпадая по стилю, освещению и содержанию. Результат должен быть единым цельным изображением без черных полей.`;
        
        const imageGenResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, { text: imageGenInstruction }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        let newImageUrl: string | null = null;
        let newImagePartForPromptGen: any = null;
        if (imageGenResponse.candidates?.[0]?.content?.parts) {
            for (const part of imageGenResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                    newImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    newImagePartForPromptGen = { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } };
                    break;
                }
            }
        }
        if (!newImageUrl || !newImagePartForPromptGen) {
            throw new Error("AI failed to generate an outpainted image.");
        }
        
        // --- STEP 3: Generate a new prompt for the adapted image ---
        const promptGenInstruction = `Опиши это новое, расширенное изображение. Оригинальный промт был: "${frame.prompt}". Сцена была расширена до нового формата. Создай новый, точный промт на русском языке, который описывает всю сцену целиком. Выведи только сам текст промта.`;

        const promptGenResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: promptGenInstruction }, newImagePartForPromptGen] },
        });
        
        const newPrompt = promptGenResponse.text.trim();
        if (!newPrompt) {
            console.warn("AI failed to generate a new prompt. Using original.");
            return { imageUrl: newImageUrl, prompt: frame.prompt };
        }

        return { imageUrl: newImageUrl, prompt: newPrompt };
    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function generatePromptSuggestions(
    leftFrame: Frame | null,
    rightFrame: Frame | null
): Promise<string[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [];
        
        let promptText = `Предложи 4 варианта промта для генерации нового кадра.`;
        
        if (leftFrame) {
            try {
                const { mimeType, data } = await urlOrFileToBase64(leftFrame);
                parts.push({ inlineData: { mimeType, data } });
                promptText += `\nКонтекст СЛЕВА (предыдущий кадр): "${leftFrame.prompt}". Изображение предоставлено.`;
            } catch (e) {
                if (leftFrame.prompt) promptText += `\nКонтекст СЛЕВА: "${leftFrame.prompt}".`;
            }
        }
        if (rightFrame) {
            try {
                const { mimeType, data } = await urlOrFileToBase64(rightFrame);
                parts.push({ inlineData: { mimeType, data } });
                promptText += `\nКонтекст СПРАВА (следующий кадр): "${rightFrame.prompt}". Изображение предоставлено.`;
            } catch (e) {
                if (rightFrame.prompt) promptText += `\nКонтекст СПРАВА: "${rightFrame.prompt}".`;
            }
        }

        promptText += `\nВерни ответ как JSON-массив из 4 строк (вариантов промта на русском). Промты должны быть описательными и готовыми к использованию.`;

        parts.unshift({ text: promptText });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
             config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                 }
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("Suggestion generation failed", error);
        return [];
    }
}

export async function generateEditSuggestions(
    frame: Frame,
    leftFrame: Frame | null,
    rightFrame: Frame | null
): Promise<string[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [];
        
        let promptText = `Предложи 4 варианта инструкции для редактирования этого кадра, чтобы улучшить его или лучше вписать в историю.`;

        const { mimeType, data } = await urlOrFileToBase64(frame);
        parts.push({ inlineData: { mimeType, data } });
        
        if (leftFrame) {
            try {
                const { mimeType: lMime, data: lData } = await urlOrFileToBase64(leftFrame);
                parts.push({ inlineData: { mimeType: lMime, data: lData } });
                promptText += `\nКонтекст СЛЕВА (предыдущий кадр): изображение предоставлено.`;
            } catch(e) {}
        }
        if (rightFrame) {
            try {
                const { mimeType: rMime, data: rData } = await urlOrFileToBase64(rightFrame);
                parts.push({ inlineData: { mimeType: rMime, data: rData } });
                promptText += `\nКонтекст СПРАВА (следующий кадр): изображение предоставлено.`;
            } catch(e) {}
        }

        promptText += `\nВерни ответ как JSON-массив из 4 строк (инструкции на русском).`;

        parts.unshift({ text: promptText });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
             config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                 }
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("Edit suggestion generation failed", error);
        return [];
    }
}

export async function generateStoryIdeasFromAssets(
    assets: Asset[],
    settings: StorySettings
): Promise<{ title: string, synopsis: string }[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [];

        const assetImageParts = await Promise.all(
            assets.map(async (asset) => {
                const { mimeType, data } = await urlOrFileToBase64(asset);
                return { inlineData: { mimeType, data } };
            })
        );
        parts.push(...assetImageParts);

        let promptText = `Используя предоставленные изображения (ассеты), придумай 3 уникальные идеи для сюжета видео.`;
        if (settings.prompt) promptText += `\nДополнительные пожелания: ${settings.prompt}`;
        if (settings.genre) promptText += `\nЖанр: ${settings.genre}`;
        if (settings.ending) promptText += `\nКонцовка: ${settings.ending}`;

        promptText += `\nВерни ответ как JSON-массив объектов с полями 'title' и 'synopsis' (на русском).`;

        parts.unshift({ text: promptText });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
             config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            synopsis: { type: Type.STRING },
                        },
                        required: ['title', 'synopsis']
                    }
                 }
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("Story ideas generation failed", error);
        return [];
    }
}

export async function generateAdaptationSuggestions(
    frame: Frame,
    leftFrame: Frame | null,
    rightFrame: Frame | null
): Promise<string[]> {
    // Reuse generic suggestion logic essentially
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [];
        
        let promptText = `Предложи 4 варианта инструкции для адаптации этого кадра (стилизация, композиция), чтобы он идеально вписался между соседними кадрами.`;

        // Frame to adapt
        const { mimeType, data } = await urlOrFileToBase64(frame);
        parts.push({ inlineData: { mimeType, data } });
        
        if (leftFrame) {
            try {
                const { mimeType: lMime, data: lData } = await urlOrFileToBase64(leftFrame);
                parts.push({ inlineData: { mimeType: lMime, data: lData } });
                promptText += `\nКонтекст СЛЕВА (стиль/сюжет): изображение предоставлено.`;
            } catch(e) {}
        }
        if (rightFrame) {
            try {
                 const { mimeType: rMime, data: rData } = await urlOrFileToBase64(rightFrame);
                 parts.push({ inlineData: { mimeType: rMime, data: rData } });
                 promptText += `\nКонтекст СПРАВА (стиль/сюжет): изображение предоставлено.`;
            } catch(e) {}
        }

        promptText += `\nВерни ответ как JSON-массив из 4 строк (инструкции на русском).`;

        parts.unshift({ text: promptText });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
             config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                 }
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("Adaptation suggestion generation failed", error);
        return [];
    }
}


export async function generateIntegrationSuggestions(
    sourceAsset: Asset | { imageUrl: string, file: File, name: string },
    targetFrame: Frame,
    mode: 'object' | 'style' | 'background'
): Promise<string[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [];

        // Source
        const { mimeType: sMime, data: sData } = await urlOrFileToBase64(sourceAsset);
        parts.push({ inlineData: { mimeType: sMime, data: sData } });
        
        // Target
        const { mimeType: tMime, data: tData } = await urlOrFileToBase64(targetFrame);
        parts.push({ inlineData: { mimeType: tMime, data: tData } });

        let promptText = `У меня есть исходный ассет (первое изображение) и целевой кадр (второе изображение).`;
        promptText += `\nРежим интеграции: ${mode}.`;
        promptText += `\nПредложи 4 варианта инструкции для AI, чтобы выполнить эту интеграцию качественно. Инструкции на русском.`;

        parts.unshift({ text: promptText });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
             config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                 }
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("Integration suggestion generation failed", error);
        return [];
    }
}

export async function integrateAssetIntoFrame(
    sourceAsset: Asset | { imageUrl: string, file: File, name: string },
    targetFrame: Frame,
    instruction: string,
    mode: 'object' | 'style' | 'background'
): Promise<{ imageUrl: string, prompt: string }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [];
        
        parts.push({ text: instruction });

        // Target is main
        const { mimeType: tMime, data: tData } = await urlOrFileToBase64(targetFrame);
        parts.push({ inlineData: { mimeType: tMime, data: tData } });

        // Source
        const { mimeType: sMime, data: sData } = await urlOrFileToBase64(sourceAsset);
        parts.push({ inlineData: { mimeType: sMime, data: sData } });

        // Using flash-image for editing/generation
        const imageGenResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        let newImageUrl: string | null = null;
        let newImagePartForPromptGen: any = null;

        if (imageGenResponse.candidates?.[0]?.content?.parts) {
            for (const part of imageGenResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                    newImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    newImagePartForPromptGen = { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } };
                    break;
                }
            }
        }

        if (!newImageUrl || !newImagePartForPromptGen) {
            throw new Error("AI failed to generate integrated image.");
        }

        // Generate Prompt
        const promptGenText = `Опиши это изображение (результат интеграции). Инструкция была: "${instruction}". Создай новый промт на русском.`;
        const promptGenResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: promptGenText }, newImagePartForPromptGen] },
        });

        const newPrompt = promptGenResponse.text.trim() || instruction;

        return { imageUrl: newImageUrl, prompt: newPrompt };

    } catch (error) {
        handleApiError(error);
        throw error;
    }
}
