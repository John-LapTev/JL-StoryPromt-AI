
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Frame, Asset, StorySettings, ActorDossier, Sketch, DirectorAnalysisResult, ModelSettings } from '../types';
import { fileToBase64, fetchCorsImage, dataUrlToFile } from '../utils/fileUtils';

export type StoryGenerationUpdate = 
  | { type: 'progress'; message: string; index?: number }
  | { type: 'frame'; index: number; frame: Omit<Frame, 'file'> };

// Default settings if not initialized
let currentModelSettings: ModelSettings = {
    analysisModel: 'gemini-3-pro-preview',
    generationModel: 'imagen-4.0-generate-001',
    editingModel: 'gemini-2.5-flash-image',
};

export const updateGeminiModelSettings = (settings: ModelSettings) => {
    currentModelSettings = settings;
};

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

async function urlOrFileToBase64(frame: Frame | Omit<Asset, 'file'> | Omit<Frame, 'file'> | Asset | Omit<Asset, 'id'> | { imageUrl: string } | Sketch | { imageUrl: string }): Promise<{ mimeType: string; data: string }> {
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

// --- STAGE 1: DIRECTOR (Analysis) ---
async function runDirectorAnalysis(
    targetFrame: Frame | Sketch,
    styleFrames: Frame[],
    instruction: string,
    knownDossier?: ActorDossier | null
): Promise<DirectorAnalysisResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Use the configured analysis model
    const model = currentModelSettings.analysisModel;

    const inputs: any[] = [];
    
    // 1. Target Image (Subject)
    try {
        const { mimeType, data } = await urlOrFileToBase64(targetFrame);
        inputs.push({ inlineData: { mimeType, data } });
        inputs.push({ text: "[TARGET IMAGE / SUBJECT] - Это изображение для адаптации (главный герой/объект)." });
    } catch(e) { console.error("Error loading target", e); }

    // 2. Context Frames (Style Reference)
    // Use provided styleFrames (Neighbors)
    if (styleFrames.length > 0) {
        for (let i = 0; i < styleFrames.length; i++) {
            try {
                const { mimeType, data } = await urlOrFileToBase64(styleFrames[i]);
                inputs.push({ inlineData: { mimeType, data } });
                inputs.push({ text: `[CONTEXT FRAME / STYLE REF ${i+1}] - Соседний кадр истории.` });
            } catch (e) {}
        }
    } else {
        inputs.push({ text: "[NO CONTEXT] - Это первый кадр истории." });
    }

    const systemPrompt = `
    РОЛЬ: Ты — РЕЖИССЁР. Твоя задача — проанализировать визуальный материал и спланировать бесшовную интеграцию нового кадра в историю.

    АЛГОРИТМ ДЕЙСТВИЙ:

    1. АНАЛИЗ МИРА ИСТОРИИ (по контекстным кадрам)
       - Определи визуальный стиль (2D/3D, мультфильм, реализм, техника).
       - Определи законы мира (кто живет, физика, анатомия).

    2. КЛАССИФИКАЦИЯ СУБЪЕКТА (по целевому изображению)
       - Тип: [character | object | location]
       - Ключевые черты (лицо, одежда, цвета, форма).
       - Метка роли (2-3 слова).
       ${knownDossier ? `ВНИМАНИЕ: Этот субъект уже известен как "${knownDossier.roleLabel}". Используй это знание.` : ''}

    3. ОНТОЛОГИЧЕСКАЯ ТРАНСФОРМАЦИЯ
       - ЕСЛИ законы мира отличаются от субъекта -> Опиши как трансформировать вид (человек -> животное, фото -> рисунок).
       - СОХРАНИТЬ: Цветовую гамму, узнаваемые детали, характер.

    4. КОНТЕКСТУАЛЬНАЯ ЛОГИКА
       - Определи позицию вставки. Что было ДО? (см. Context Frames)
       - Если субъект не может быть здесь физически, придумай кинематографический прием (параллельный монтаж, воспоминание, реакция).
       
    5. ПОСТРОЕНИЕ ДЕЙСТВИЯ
       - Придумай логичное действие, связывающее кадры.
       - Создай композицию.

    6. VISUAL ANCHORS
       ${knownDossier ? `Visual Anchor найден: Персонаж/Объект идентифицирован.` : 'Проверь, нужен ли визуальный якорь.'}

    7. ГЕНЕРАЦИЯ ПРОМТОВ (ФИНАЛ)
       Создай ДВА разных промта:
       - "visualDescription" (Для генератора картинок Imagen): Техническое описание визуального стиля, освещения, текстур. Пиши на АНГЛИЙСКОМ для лучшего качества генерации.
       - "videoPrompt" (Для генератора видео Veo): Описание ДЕЙСТВИЯ и ДВИЖЕНИЯ КАМЕРЫ. Игнорируй "8k", "best quality". Фокус на том, что происходит в кадре. СТРОГО НА РУССКОМ ЯЗЫКЕ.

    ВЫВОД: Верни JSON строго следующей структуры.
    ВАЖНО: 
    - Все текстовые поля (roleLabel, subjectIdentity, transformation, narrativePosition, sceneAction, videoPrompt) ДОЛЖНЫ БЫТЬ НА РУССКОМ ЯЗЫКЕ.
    - Только "visualDescription" должен быть на АНГЛИЙСКОМ ЯЗЫКЕ.
    `;

    const response = await ai.models.generateContent({
        model: model,
        contents: {
            parts: [
                { text: systemPrompt },
                ...inputs,
                { text: `Дополнительная инструкция от пользователя: "${instruction}"` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    storyStyle: { type: Type.STRING, description: "Описание визуального стиля всей истории на РУССКОМ." },
                    worldRules: { type: Type.STRING, description: "Онтологические законы мира (кто населяет, как выглядят) на РУССКОМ." },
                    subjectType: { type: Type.STRING, enum: ["character", "object", "location"] },
                    roleLabel: { type: Type.STRING, description: "Краткая метка субъекта (2-3 слова) на РУССКОМ." },
                    subjectIdentity: { type: Type.STRING, description: "Узнаваемые черты: лицо/форма, цвета, одежда/детали на РУССКОМ." },
                    transformation: { type: Type.STRING, description: "Как субъект должен трансформироваться под мир на РУССКОМ." },
                    narrativePosition: { type: Type.STRING, description: "Что происходит в истории в точке вставки на РУССКОМ." },
                    sceneAction: { type: Type.STRING, description: "Конкретное действие для нового кадра на РУССКОМ." },
                    visualAnchorIndex: { type: Type.NUMBER, nullable: true },
                    visualDescription: { type: Type.STRING, description: "Technical visual description for the ARTIST (Imagen) to generate the image. MUST BE IN ENGLISH." },
                    videoPrompt: { type: Type.STRING, description: "Описание движения камеры и действия сцены для генерации видео (Veo). СТРОГО НА РУССКОМ ЯЗЫКЕ. Не используй технические термины стиля (8k, cinematic), описывай только действие." }
                },
                required: ["storyStyle", "subjectType", "roleLabel", "subjectIdentity", "transformation", "visualDescription", "videoPrompt"]
            }
        }
    });

    return JSON.parse(response.text || "{}") as DirectorAnalysisResult;
}

// --- STAGE 2: ARTIST (Generation) ---
async function runArtistGeneration(
    directorBrief: DirectorAnalysisResult,
    targetFrame: Frame | Sketch,
    styleFrames: Frame[],
    visualAnchorDossier?: ActorDossier | null
): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Use the configured editing model (Artist role typically involves adapting images)
    const model = currentModelSettings.editingModel;

    const parts: any[] = [];
    
    let artistPrompt = `
    ТЫ — ХУДОЖНИК. Твоя задача — создать изображение, строго следуя инструкциям Режиссёра и референсам.

    --- ИНСТРУКЦИИ РЕЖИССЁРА ---
    СТИЛЬ ИСТОРИИ: ${directorBrief.storyStyle}
    ТРАНСФОРМАЦИЯ СУБЪЕКТА: ${directorBrief.transformation}
    СЦЕНАРИЙ КАДРА: ${directorBrief.visualDescription}
    
    --- КАТЕГОРИИ РЕФЕРЕНСОВ ---
    `;

    // 1. STYLE REFERENCE (Neighbors)
    artistPrompt += `\n1. STYLE REFERENCE (Стиль отрисовки):
    Используй следующие изображения ТОЛЬКО для копирования стиля (штрих, цвета, рендеринг). ИГНОРИРУЙ их содержание.`;
    
    for (const frame of styleFrames) {
        try {
            const { mimeType, data } = await urlOrFileToBase64(frame);
            parts.push({ inlineData: { mimeType, data } });
        } catch(e) {}
    }

    // 2. IDENTITY REFERENCE (Original Upload)
    artistPrompt += `\n\n2. IDENTITY REFERENCE (Идентичность субъекта):
    Используй следующее изображение ТОЛЬКО для лица и ключевых черт субъекта (${directorBrief.subjectIdentity}). 
    ВАЖНО: 
    - Лицо и ключевые черты персонажа ДОЛЖНЫ ОСТАТЬСЯ УЗНАВАЕМЫМИ. 
    - Трансформируй стиль согласно Стилю Истории.
    - НЕ копируй позу, используй позу из Сценария Кадра.`;
    
    try {
        const { mimeType, data } = await urlOrFileToBase64(targetFrame);
        parts.push({ inlineData: { mimeType, data } });
    } catch(e) {}

    // 3. VISUAL ANCHOR (Consistency)
    if (visualAnchorDossier) {
        artistPrompt += `\n\n3. VISUAL ANCHOR (Якорь консистентности):
        КРИТИЧНО: Субъект должен выглядеть ИДЕНТИЧНО этому референсу (одежда, лицо, детали), но в новой позе.`;
        try {
            const blob = await fetchCorsImage(visualAnchorDossier.referenceImageUrl);
            const base64 = await fileToBase64(new File([blob], "anchor.png"));
            const data = base64.split(',')[1];
            parts.push({ inlineData: { mimeType: blob.type, data } });
        } catch(e) { console.warn("Failed to load visual anchor image"); }
    }

    artistPrompt += `\n\nГЕНЕРАЦИЯ: Создай финальное изображение высокого качества.`;

    // Combine prompt text and images
    const contents = {
        parts: [
            { text: artistPrompt },
            ...parts
        ]
    };

    const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: { responseModalities: [Modality.IMAGE] }
    });

    if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const p = response.candidates[0].content.parts[0].inlineData;
        return `data:${p.mimeType};base64,${p.data}`;
    }

    throw new Error("Artist failed to generate image.");
}

// --- MAIN ORCHESTRATOR ---
export async function adaptImageToStory(
    frameOrSketch: Frame | Sketch,
    allFrames: Frame[],
    instruction: string,
    knownCharacterRef?: { originalUrl: string, adaptedUrl: string, characterDescription: string } | null
): Promise<{ imageUrl: string; prompt: string; analysis?: DirectorAnalysisResult }> {
    try {
        // 0. Setup Context: Calculate Neighbors (Style Frames)
        const targetId = frameOrSketch.id;
        const index = allFrames.findIndex(f => f.id === targetId);
        
        const styleFrames: Frame[] = [];
        
        if (index > -1) {
             // Target is inside the list (e.g. inserted placeholder)
             // Get immediate neighbors (ignoring the target itself)
             if (index > 0) styleFrames.push(allFrames[index - 1]);
             if (index < allFrames.length - 1) styleFrames.push(allFrames[index + 1]);
             
             // If only one neighbor, maybe extend further?
             if (styleFrames.length < 2 && allFrames.length > 2) {
                 if (index > 1) styleFrames.unshift(allFrames[index - 2]);
                 else if (index < allFrames.length - 2) styleFrames.push(allFrames[index + 2]);
             }
        } else {
            // Target is new (e.g. Sketch not yet in list)
            // Assuming it might be added to the end if not specified, or we just take the last few frames
             if (allFrames.length > 0) styleFrames.push(allFrames[allFrames.length - 1]);
             if (allFrames.length > 1) styleFrames.unshift(allFrames[allFrames.length - 2]);
        }

        // Convert knownCharacterRef back to a dossier-like structure if passed from App.tsx
        let visualAnchorDossier: ActorDossier | null = null;
        if (knownCharacterRef) {
            visualAnchorDossier = {
                sourceHash: '', // Not needed for generation
                characterDescription: knownCharacterRef.characterDescription,
                roleLabel: 'Known Subject',
                referenceImageUrl: knownCharacterRef.adaptedUrl,
                lastUsed: Date.now()
            };
        }

        // 1. DIRECTOR PHASE
        const directorBrief = await runDirectorAnalysis(frameOrSketch, styleFrames, instruction, visualAnchorDossier);
        
        // 2. ARTIST PHASE
        const newImageUrl = await runArtistGeneration(directorBrief, frameOrSketch, styleFrames, visualAnchorDossier);

        // Ensure we fallback to visual description if videoPrompt is unexpectedly empty, but videoPrompt is preferred for UI
        const uiPrompt = directorBrief.videoPrompt || directorBrief.visualDescription;

        return {
            imageUrl: newImageUrl,
            prompt: uiPrompt,
            analysis: directorBrief
        };

    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function analyzeStory(frames: Frame[]): Promise<string[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = currentModelSettings.analysisModel;

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
            model: model,
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
        // Use analysis model for prompt generation logic or a fast text model
        // For prompt generation, 2.5-flash (which might be selected as analysisModel) is appropriate
        const model = currentModelSettings.analysisModel.includes('flash') ? currentModelSettings.analysisModel : 'gemini-2.5-flash'; 
        
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

        contextPrompt += `\n\nОсновываясь на этом контексте, опиши предоставленное изображение для промта генерации видео. Сфокусируйся на действии, движении камеры и настроении, чтобы обеспечить плавный переход между кадрами.`;

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: contextPrompt }, imagePart] },
            config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        prompt: { type: Type.STRING, description: "The generated video prompt in Russian." }
                    }
                 }
            }
        });

        const json = JSON.parse(response.text || "{}");
        return json.prompt || "";
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
        // Video generation model is specialized and usually fixed to Veo for now
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
        const model = currentModelSettings.generationModel;

        if (model.startsWith('imagen')) {
             // Use Imagen API
             const response = await ai.models.generateImages({
                model: model,
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
        } else {
             // Use Gemini 2.5 Flash Image (NanoBanana) via GenerateContent
             // Note: Aspect ratio control via prompt for Gemini models generally, 
             // or rely on post-processing/native capability if available. 
             // For 2.5 Flash Image, we pass prompt.
             const response = await ai.models.generateContent({
                 model: model,
                 contents: {
                     parts: [{ text: `Generate an image: ${prompt}. Aspect ratio: ${aspectRatio}` }]
                 },
                 config: {
                     responseModalities: [Modality.IMAGE]
                 }
             });
             
             if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
            }
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
        const model = currentModelSettings.editingModel;

        const { mimeType, data } = await urlOrFileToBase64(originalFrame);
        const imagePart = { inlineData: { mimeType, data } };
        
        const editResponse = await ai.models.generateContent({
            model: model,
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
             config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        prompt: { type: Type.STRING }
                    }
                 }
            }
        });

        const json = JSON.parse(promptGenResponse.text || "{}");
        const newPrompt = json.prompt || `${originalFrame.prompt}, ${editInstruction}`;

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
        // Contextual generation often benefits from the editing model (multimodal in/out)
        const model = currentModelSettings.editingModel;

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
            model: model,
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

        // Generate Prompt for the new image using JSON Schema to strictly avoid conversational output
        const promptGenText = `Describe this image for a video generation prompt. Russian language. Return JSON with a "prompt" field.`;
        const promptResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { 
                parts: [
                    { text: promptGenText }, 
                    { inlineData: { mimeType: newImageMimeType, data: newImageBase64 } }
                ] 
            },
            config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        prompt: { type: Type.STRING, description: "The generated video prompt in Russian." }
                    },
                    required: ["prompt"]
                 }
            }
        });

        const json = JSON.parse(promptResponse.text || "{}");
        return { imageUrl: newImageUrl, prompt: json.prompt || userPrompt };

    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function regenerateFrameImage(frame: Frame, allFrames: Frame[]): Promise<{ imageUrl: string; prompt: string }> {
    // Reuses generateImageInContext which uses configured editing/generation model
    const index = allFrames.findIndex(f => f.id === frame.id);
    const left = index > 0 ? allFrames[index - 1] : null;
    const right = index < allFrames.length - 1 ? allFrames[index - 1] : null;
    return generateImageInContext(frame.prompt, left, right, frame);
}

export async function adaptImageAspectRatio(frame: Frame, targetAspectRatio: string): Promise<{ imageUrl: string; prompt: string }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = currentModelSettings.editingModel;

        const { mimeType, data } = await urlOrFileToBase64(frame);
        
        const promptText = `Regenerate this image with aspect ratio ${targetAspectRatio}. Keep the main subject and composition but extend or crop to fit. Prompt: ${frame.prompt}`;
        
        const response = await ai.models.generateContent({
            model: model,
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
    const analysisModel = currentModelSettings.analysisModel;
    const scriptModel = currentModelSettings.analysisModel; // Use analysis model for script writing

    // 1. Analyze Assets
    yield { type: 'progress', message: 'Анализ ассетов...' };
    const assetParts = await Promise.all(assets.map(async a => {
        const { mimeType, data } = await urlOrFileToBase64(a);
        return { inlineData: { mimeType, data } };
    }));

    const analysisPrompt = `Analyze these images. Identify characters, locations, and objects. Create a story outline based on genre: "${settings.genre || 'General'}", ending: "${settings.ending || 'Happy'}", and user idea: "${settings.prompt || ''}".`;
    
    await ai.models.generateContent({
        model: analysisModel,
        contents: { parts: [{ text: analysisPrompt }, ...assetParts] }
    });

    // 2. Script Generation
    yield { type: 'progress', message: 'Создание сценария...' };
    const scriptPrompt = `Create a storyboard script with exactly ${frameCount} frames. For each frame, provide a visual description prompt (Russian). Return JSON array of strings.`;
    
    const scriptResponse = await ai.models.generateContent({
        model: scriptModel,
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
            // generateImageInContext uses configured models internally
            const { imageUrl, prompt } = await generateImageInContext(prompts[i], prevFrame as Frame, null, null);
            
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
        const model = currentModelSettings.analysisModel;
        
        const assetParts = await Promise.all(assets.slice(0, 5).map(async a => {
            const { mimeType, data } = await urlOrFileToBase64(a);
            return { inlineData: { mimeType, data } };
        }));

        const prompt = `Generate 3 story ideas based on these images. Genre: ${settings.genre}. User idea: ${settings.prompt}. Return JSON array of objects with 'title' and 'synopsis' (Russian).`;
        
        const response = await ai.models.generateContent({
            model: model,
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
        // Text task -> Analysis Model
        const model = currentModelSettings.analysisModel;
        
        let prompt = "Generate 4 distinct prompt ideas for a storyboard frame (Russian). Return JSON array of strings. ";
        const parts: any[] = [{ text: prompt }];
        
        if (leftFrame) {
            const { mimeType, data } = await urlOrFileToBase64(leftFrame);
            parts.push({ inlineData: { mimeType, data } });
            prompt += " It should follow this previous frame.";
        }
        
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) { return []; }
}

export async function generateEditSuggestions(frame: Frame, left: Frame | null, right: Frame | null): Promise<string[]> {
    return generatePromptSuggestions(frame, null); 
}

export async function generateAdaptationSuggestions(frame: Frame, left: Frame | null, right: Frame | null): Promise<string[]> {
     return generatePromptSuggestions(frame, null); 
}

export async function integrateAssetIntoFrame(
    source: Asset | {imageUrl: string, name: string, file: File}, 
    target: Frame, 
    instruction: string, 
    mode: string,
    existingDossier?: ActorDossier | null
): Promise<{ imageUrl: string; prompt: string; analysis?: { type: 'character'|'object'|'location', roleLabel: string, description: string } }> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const analysisModel = currentModelSettings.analysisModel;
        const editingModel = currentModelSettings.editingModel;
        
        const { mimeType: sMime, data: sData } = await urlOrFileToBase64(source);
        const { mimeType: tMime, data: tData } = await urlOrFileToBase64(target);
        
        // 1. ANALYSIS STEP 
        let subjectAnalysis: { type: 'character' | 'object' | 'location', roleLabel: string, description: string } = { type: 'object', roleLabel: source.name, description: source.name };
        
        if (!existingDossier) {
             const analysisPrompt = `Analyze this image (Source Asset). Identify if it is a character, object, or location. Give it a short label (2-3 words) and a visual description. Language: Russian.`;
             const analysisResponse = await ai.models.generateContent({
                 model: analysisModel,
                 contents: {
                     parts: [
                         { text: analysisPrompt },
                         { inlineData: { mimeType: sMime, data: sData } }
                     ]
                 },
                 config: {
                     responseMimeType: "application/json",
                     responseSchema: {
                         type: Type.OBJECT,
                         properties: {
                             type: { type: Type.STRING, enum: ['character', 'object', 'location'] },
                             roleLabel: { type: Type.STRING },
                             description: { type: Type.STRING }
                         }
                     }
                 }
             });
             const json = JSON.parse(analysisResponse.text || "{}");
             if (json.type) subjectAnalysis = json;
        } else {
            subjectAnalysis = {
                type: existingDossier.type || 'object',
                roleLabel: existingDossier.roleLabel || source.name,
                description: existingDossier.characterDescription || ''
            };
        }

        // 2. GENERATION STEP
        let prompt = `INTEGRATION TASK:
        Source: ${subjectAnalysis.roleLabel} (${subjectAnalysis.description}).
        Target: A storyboard frame.
        Instruction: ${instruction}.
        Mode: ${mode}.
        `;
        
        if (existingDossier) {
            prompt += `\nIMPORTANT CONSISTENCY: The source object MUST look exactly like the reference provided in the dossier.`;
        }

        const parts: any[] = [
            { text: prompt },
            { inlineData: { mimeType: tMime, data: tData } } // Target is the canvas
        ];

        parts.push({ inlineData: { mimeType: sMime, data: sData } }); 

        const response = await ai.models.generateContent({
            model: editingModel,
            contents: { parts },
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
        
        return { 
            imageUrl: newImageUrl, 
            prompt: target.prompt + ` (Integrated: ${subjectAnalysis.roleLabel})`,
            analysis: subjectAnalysis
        };

    } catch (error) {
        handleApiError(error);
        throw error;
    }
}

export async function generateIntegrationSuggestions(source: Asset | {imageUrl: string, name: string, file: File}, target: Frame, mode: string): Promise<string[]> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = currentModelSettings.analysisModel;
        
        const prompt = `Suggest 4 ways to integrate the source object into the target scene (Russian). Mode: ${mode}. Return JSON array of strings.`;
        const { mimeType: sMime, data: sData } = await urlOrFileToBase64(source);
        const { mimeType: tMime, data: tData } = await urlOrFileToBase64(target);

        const response = await ai.models.generateContent({
            model: model,
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
