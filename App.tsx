import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Frame } from './types';
import { initialFrames } from './constants';
import { Header } from './components/Header';
import { Timeline } from './components/Timeline';
import { VideoModal } from './components/VideoModal';
import { AdvancedGenerateModal } from './components/AdvancedGenerateModal';
import { Chatbot } from './components/Chatbot';
import { EditPromptModal } from './components/EditPromptModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { FrameDetailModal } from './components/FrameDetailModal';
import { analyzeStory, generateSinglePrompt, generateIntermediateFrame, generateTransitionPrompt, generateImageFromPrompt, editImage, generateVideoFromFrame, generateImageInContext } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';

// Fix: Corrected the type definition for `window.aistudio` to use a named interface `AIStudio`.
// This resolves a TypeScript error where subsequent property declarations had conflicting types.
// By augmenting the global `AIStudio` interface, this change ensures type consistency across the application.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        aistudio?: AIStudio;
    }
}

export type GeneratingVideoState = { frameId: string; message: string } | null;

export default function App() {
    const [frames, setFrames] = useState<Frame[]>(initialFrames);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [isVeoKeySelected, setIsVeoKeySelected] = useState(false);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [generateFrameIndex, setGenerateFrameIndex] = useState(0);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [editingFrame, setEditingFrame] = useState<Frame | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [detailedFrame, setDetailedFrame] = useState<Frame | null>(null);
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    
    // Non-blocking loading states
    const [generatingIntermediateIndex, setGeneratingIntermediateIndex] = useState<number | null>(null);
    const [generatingStory, setGeneratingStory] = useState(false);
    const [generatingPromptFrameId, setGeneratingPromptFrameId] = useState<string | null>(null);
    const [generatingVideoState, setGeneratingVideoState] = useState<GeneratingVideoState>(null);
    const [generatingNewFrameIndex, setGeneratingNewFrameIndex] = useState<number | null>(null);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setIsVeoKeySelected(true);
            }
        };
        checkKey();
    }, []);

    const totalDuration = useMemo(() => {
        return frames.reduce((acc, frame) => acc + frame.duration, 0);
    }, [frames]);

    const handleDurationChange = useCallback((id: string, newDuration: number) => {
        setFrames(prevFrames =>
            prevFrames.map(frame =>
                frame.id === id ? { ...frame, duration: Math.max(0.25, newDuration) } : frame
            )
        );
    }, []);

    const handlePromptChange = useCallback((id: string, newPrompt: string) => {
        setFrames(prevFrames =>
            prevFrames.map(frame =>
                frame.id === id ? { ...frame, prompt: newPrompt, isTransition: false } : frame
            )
        );
        if (editingFrame?.id === id) {
            setEditingFrame(prev => prev ? { ...prev, prompt: newPrompt } : null);
        }
    }, [editingFrame]);
    
    const handleSavePrompt = (id: string, newPrompt: string) => {
        handlePromptChange(id, newPrompt);
        setEditingFrame(null);
    }

    const handleSaveFrameDetails = useCallback((id: string, newPrompt: string, newDuration: number) => {
        setFrames(prevFrames =>
            prevFrames.map(frame =>
                frame.id === id ? { ...frame, prompt: newPrompt, duration: Math.max(0.25, newDuration), isTransition: false } : frame
            )
        );
        if (detailedFrame?.id === id) {
            setDetailedFrame(prev => prev ? { ...prev, prompt: newPrompt, duration: newDuration } : null);
        }
    }, [detailedFrame]);

    const handleDeleteFrame = useCallback((id: string) => {
        setFrames(prevFrames => prevFrames.filter(frame => frame.id !== id));
    }, []);

    const handleAddFrame = useCallback(async (index: number, type: 'upload' | 'generate' | 'intermediate') => {
        if (type === 'upload') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                    try {
                        const base64 = await fileToBase64(file);
                        const newFrame: Frame = {
                            id: crypto.randomUUID(),
                            imageUrl: base64,
                            prompt: '',
                            duration: 3.0,
                            file: file,
                        };
                        setFrames(prev => {
                            const newFrames = [...prev];
                            newFrames.splice(index, 0, newFrame);
                            return newFrames;
                        });
                    } catch (error) {
                        console.error("Error reading file:", error);
                        alert("Could not load image file.");
                    }
                }
            };
            input.click();
        } else if (type === 'generate') {
            setGenerateFrameIndex(index);
            setIsGenerateModalOpen(true);
        } else if (type === 'intermediate') {
            const leftFrame = frames[index - 1];
            const rightFrame = frames[index];
            if (!leftFrame || !rightFrame) {
                alert("Не удалось найти соседние кадры для создания промежуточного.");
                return;
            }
            setGeneratingIntermediateIndex(index);
            try {
                const { imageUrl, prompt } = await generateIntermediateFrame(leftFrame, rightFrame);
                const newFrame: Frame = {
                    id: crypto.randomUUID(),
                    imageUrl,
                    prompt,
                    duration: Number(((leftFrame.duration + rightFrame.duration) / 2).toFixed(2)),
                };
                setFrames(prev => {
                    const newFrames = [...prev];
                    newFrames.splice(index, 0, newFrame);
                    return newFrames;
                });
            } catch (error) {
                console.error("Error generating intermediate frame:", error);
                alert(`Не удалось сгенерировать промежуточный кадр: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setGeneratingIntermediateIndex(null);
            }
        }
    }, [frames]);
    
    const handleStartFrameGeneration = async (data: { mode: 'generate' | 'edit', prompt: string, maintainContext?: boolean, file?: File, preview?: string }) => {
        setIsGenerateModalOpen(false);
        setGeneratingNewFrameIndex(generateFrameIndex);
        
        try {
            let imageUrl: string;
            if (data.mode === 'generate') {
                if (data.maintainContext) {
                    const leftFrame = frames[generateFrameIndex - 1] || null;
                    const rightFrame = frames[generateFrameIndex] || null;
                    imageUrl = await generateImageInContext(data.prompt, leftFrame, rightFrame);
                } else {
                    imageUrl = await generateImageFromPrompt(data.prompt);
                }
            } else if (data.mode === 'edit' && data.file && data.preview) {
                imageUrl = await editImage(data.preview, data.file.type, data.prompt);
            } else {
                 throw new Error("Invalid state for generation.");
            }

            const newFrame: Frame = {
                id: crypto.randomUUID(),
                imageUrl: imageUrl,
                prompt: data.prompt,
                duration: 3.0,
            };

            setFrames(prev => {
                const newFrames = [...prev];
                newFrames.splice(generateFrameIndex, 0, newFrame);
                return newFrames;
            });

        } catch (error) {
            console.error("Error during generation:", error);
            alert(`Не удалось выполнить операцию: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setGeneratingNewFrameIndex(null);
        }
    };

    const handleAnalyzeStory = async () => {
        if (frames.length === 0) {
            alert("Please add at least one frame to analyze.");
            return;
        }
        setGeneratingStory(true);
        try {
            const prompts = await analyzeStory(frames);
            if (prompts.length === frames.length) {
                setFrames(prevFrames =>
                    prevFrames.map((frame, index) => ({
                        ...frame,
                        prompt: prompts[index],
                        isTransition: false,
                    }))
                );
            } else {
                throw new Error("Received an incorrect number of prompts from the AI.");
            }
        } catch (error) {
            console.error("Error analyzing story:", error);
            alert(`Failed to analyze story: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setGeneratingStory(false);
        }
    };
    
    const handleGenerateSinglePrompt = async (frameId: string) => {
        const frameToUpdate = frames.find(f => f.id === frameId);
        if (!frameToUpdate) return;

        setGeneratingPromptFrameId(frameId);
        try {
            const newPrompt = await generateSinglePrompt(frameToUpdate, frames);
            handlePromptChange(frameId, newPrompt);
        } catch (error) {
             console.error("Error generating single prompt:", error);
            alert(`Failed to generate prompt: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setGeneratingPromptFrameId(null);
        }
    };

    const handleGenerateTransition = useCallback(async (index: number) => {
        const leftFrame = frames[index - 1];
        const rightFrame = frames[index];

        if (!leftFrame || !rightFrame) {
            alert("Не удалось найти соседние кадры для создания перехода.");
            return;
        }

        setGeneratingPromptFrameId(leftFrame.id);
        try {
            const transitionPrompt = await generateTransitionPrompt(leftFrame, rightFrame);
            setFrames(prevFrames =>
                prevFrames.map(frame =>
                    frame.id === leftFrame.id
                        ? { ...frame, prompt: transitionPrompt, isTransition: true }
                        : frame
                )
            );

        } catch (error) {
            console.error("Error generating transition prompt:", error);
            alert(`Не удалось сгенерировать промт для перехода: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setGeneratingPromptFrameId(null);
        }
    }, [frames]);

    const handleGenerateVideo = async (frame: Frame) => {
        let retriesLeft = 1;
        let keyIsValid = isVeoKeySelected;

        while (true) {
            if (!keyIsValid) {
                if (window.aistudio) {
                    try {
                        await window.aistudio.openSelectKey();
                        keyIsValid = true;
                        setIsVeoKeySelected(true);
                    } catch (e) {
                        console.error("API Key selection failed or was cancelled.", e);
                        alert("You must select an API key to generate a video.");
                        return;
                    }
                } else {
                    alert("AI Studio environment not found.");
                    return;
                }
            }

            try {
                const updateMessage = (message: string) => setGeneratingVideoState({ frameId: frame.id, message });
                const videoUrl = await generateVideoFromFrame(frame, updateMessage);
                setGeneratedVideoUrl(videoUrl);
                setGeneratingVideoState(null);
                break;
            } catch (error) {
                console.error("Video generation failed:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);

                setGeneratingVideoState(null);

                if (errorMessage.includes("Requested entity was not found.")) {
                    keyIsValid = false;
                    setIsVeoKeySelected(false);

                    if (retriesLeft > 0) {
                        retriesLeft--;
                        alert("Your API key is invalid or not found. Please select a valid key to retry.");
                    } else {
                        alert("The API key is still invalid after retry. Please check your key and try again later.");
                        break;
                    }
                } else {
                    alert(`An error occurred during video generation: ${errorMessage}`);
                    break;
                }
            }
        }
    };


    return (
        <div className="relative flex h-screen w-full flex-col group/design-root overflow-hidden">
            <Header />
            <main className="flex flex-1 flex-col overflow-auto p-6">
                <Timeline
                    frames={frames}
                    totalDuration={totalDuration}
                    transform={transform}
                    setTransform={setTransform}
                    generatingIntermediateIndex={generatingIntermediateIndex}
                    generatingNewFrameIndex={generatingNewFrameIndex}
                    generatingStory={generatingStory}
                    generatingPromptFrameId={generatingPromptFrameId}
                    generatingVideoState={generatingVideoState}
                    onDurationChange={handleDurationChange}
                    onPromptChange={handlePromptChange}
                    onAddFrame={handleAddFrame}
                    onDeleteFrame={handleDeleteFrame}
                    onAnalyzeStory={handleAnalyzeStory}
                    onGenerateSinglePrompt={handleGenerateSinglePrompt}
                    onGenerateTransition={handleGenerateTransition}
                    onGenerateVideo={handleGenerateVideo}
                    onEditPrompt={setEditingFrame}
                    onViewImage={setViewingImage}
                    onOpenDetailView={setDetailedFrame}
                />
            </main>

            <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            
            <button
                onClick={() => setIsChatOpen(true)}
                className="absolute bottom-6 right-6 z-20 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110"
                aria-label="Open AI Assistant"
            >
                <span className="material-symbols-outlined text-3xl">smart_toy</span>
            </button>
            
            {generatedVideoUrl && <VideoModal videoUrl={generatedVideoUrl} onClose={() => setGeneratedVideoUrl(null)} />}
            {isGenerateModalOpen && (
                <AdvancedGenerateModal
                    frames={frames}
                    onClose={() => setIsGenerateModalOpen(false)}
                    onGenerate={handleStartFrameGeneration}
                />
            )}
            {editingFrame && (
                <EditPromptModal 
                    frame={editingFrame}
                    onClose={() => setEditingFrame(null)}
                    onSave={handleSavePrompt}
                />
            )}
            {viewingImage && (
                <ImageViewerModal imageUrl={viewingImage} onClose={() => setViewingImage(null)} />
            )}
            {detailedFrame && (
                <FrameDetailModal 
                    frame={detailedFrame}
                    onClose={() => setDetailedFrame(null)}
                    onSave={handleSaveFrameDetails}
                />
            )}
        </div>
    );
}