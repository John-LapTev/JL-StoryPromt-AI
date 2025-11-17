import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Frame, Project } from './types';
import { initialFrames } from './constants';
import { projectService } from './services/projectService';
import { Header } from './components/Header';
import { Timeline } from './components/Timeline';
import { VideoModal } from './components/VideoModal';
import { AdvancedGenerateModal } from './components/AdvancedGenerateModal';
import { Chatbot } from './components/Chatbot';
import { EditPromptModal } from './components/EditPromptModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { FrameDetailModal } from './components/FrameDetailModal';
import { ProjectSaveModal } from './components/ProjectSaveModal';
import { ProjectLoadModal } from './components/ProjectLoadModal';
import { analyzeStory, generateSinglePrompt, generateIntermediateFrame, generateTransitionPrompt, generateImageFromPrompt, editImage, generateVideoFromFrame, generateImageInContext } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';

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

const DEMO_PROJECT_ID = 'demo-project';

export default function App() {
    // Project State
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [localFrames, setLocalFrames] = useState<Frame[]>([]);

    // Modal States
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);

    // UI States
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [isVeoKeySelected, setIsVeoKeySelected] = useState(false);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [generateFrameIndex, setGenerateFrameIndex] = useState(0);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [editingFrame, setEditingFrame] = useState<Frame | null>(null);
    const [viewingFrameIndex, setViewingFrameIndex] = useState<number | null>(null);
    const [detailedFrame, setDetailedFrame] = useState<Frame | null>(null);
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    
    // Non-blocking loading states
    const [generatingIntermediateIndex, setGeneratingIntermediateIndex] = useState<number | null>(null);
    const [generatingStory, setGeneratingStory] = useState(false);
    const [generatingPromptFrameId, setGeneratingPromptFrameId] = useState<string | null>(null);
    const [generatingVideoState, setGeneratingVideoState] = useState<GeneratingVideoState>(null);
    const [generatingNewFrameIndex, setGeneratingNewFrameIndex] = useState<number | null>(null);

    // Derived state
    const currentProject = useMemo(() => projects.find(p => p.id === currentProjectId), [projects, currentProjectId]);

    // Initial project loading
    useEffect(() => {
        const allProjects = projectService.getProjects();
        let lastId = projectService.getLastProjectId();
        let projectToLoad = allProjects.find(p => p.id === lastId);

        if (!projectToLoad && allProjects.length > 0) {
            projectToLoad = allProjects.sort((a,b) => b.lastModified - a.lastModified)[0];
            lastId = projectToLoad.id;
        }

        if (!projectToLoad) {
            const demoProject: Project = {
                id: DEMO_PROJECT_ID,
                name: 'Демо проект',
                frames: initialFrames,
                lastModified: Date.now()
            };
            allProjects.push(demoProject);
            projectService.saveProjects(allProjects);
            projectToLoad = demoProject;
            lastId = demoProject.id;
        }
        
        setProjects(allProjects);
        setCurrentProjectId(lastId);
        if (lastId) {
            projectService.setLastProjectId(lastId);
        }
    }, []);

    // Sync localFrames with currentProject frames
    useEffect(() => {
        if (currentProject) {
            setLocalFrames(currentProject.frames);
        }
    }, [currentProject]);

    const updateFrames = useCallback((newFrames: Frame[] | ((prev: Frame[]) => Frame[])) => {
        const framesToSet = typeof newFrames === 'function' ? newFrames(localFrames) : newFrames;
        setLocalFrames(framesToSet);
        setHasUnsavedChanges(true);
    }, [localFrames]);
    
    // VEO Key check
    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setIsVeoKeySelected(true);
            }
        };
        checkKey();
    }, []);

    const totalDuration = useMemo(() => {
        return localFrames.reduce((acc, frame) => acc + frame.duration, 0);
    }, [localFrames]);
    
    const handleConfirmUnsaved = () => {
        if (!hasUnsavedChanges) return true;
        return window.confirm("У вас есть несохраненные изменения. Вы уверены, что хотите продолжить без сохранения?");
    };

    const handleNewProject = () => {
        if (!handleConfirmUnsaved()) return;
        setIsLoadModalOpen(false);
        
        const newProject: Project = {
            id: crypto.randomUUID(),
            name: 'Новый проект',
            frames: [],
            lastModified: Date.now(),
        };

        const updatedProjects = [...projects, newProject];
        setProjects(updatedProjects);
        setCurrentProjectId(newProject.id);
        projectService.setLastProjectId(newProject.id);
        projectService.saveProjects(updatedProjects); 
        setHasUnsavedChanges(false);
    };

    const handleSaveProject = () => {
        if (!currentProject) return;
        if (currentProject.id === DEMO_PROJECT_ID || hasUnsavedChanges === false && projects.some(p => p.id === currentProject.id)) {
            // It's the demo project, force "Save As"
            setIsSaveModalOpen(true);
            return;
        }

        const framesToSave = localFrames.map(({ file, ...rest }) => rest);
        const updatedProject = { ...currentProject, frames: framesToSave, lastModified: Date.now() };
        const updatedProjects = projects.map(p => p.id === currentProject.id ? updatedProject : p);
        
        setProjects(updatedProjects);
        projectService.saveProjects(updatedProjects);
        setHasUnsavedChanges(false);
        alert(`Проект "${currentProject.name}" сохранен!`);
    };

    const handleSaveAs = (newName: string) => {
        if (!currentProject) return;
        
        const projectToSave: Project = {
            ...currentProject,
            id: currentProject.id === DEMO_PROJECT_ID ? crypto.randomUUID() : currentProject.id,
            name: newName,
            frames: localFrames.map(({ file, ...rest }) => rest),
            lastModified: Date.now(),
        };
        
        const updatedProjects = projects.some(p => p.id === projectToSave.id)
            ? projects.map(p => p.id === projectToSave.id ? projectToSave : p)
            : [...projects, projectToSave];
            
        setProjects(updatedProjects);
        setCurrentProjectId(projectToSave.id);
        projectService.setLastProjectId(projectToSave.id);
        projectService.saveProjects(updatedProjects);
        setHasUnsavedChanges(false);
        setIsSaveModalOpen(false);
    };

    const handleLoadProject = (id: string) => {
        if (!handleConfirmUnsaved()) return;
        setCurrentProjectId(id);
        projectService.setLastProjectId(id);
        setHasUnsavedChanges(false);
        setIsLoadModalOpen(false);
    };

    const handleDeleteProject = (id: string) => {
        const projectToDelete = projects.find(p => p.id === id);
        if (!projectToDelete || !window.confirm(`Вы уверены, что хотите удалить проект "${projectToDelete.name}"? Это действие нельзя отменить.`)) return;
        
        const updatedProjects = projects.filter(p => p.id !== id);
        setProjects(updatedProjects);
        projectService.saveProjects(updatedProjects);
        
        if (currentProjectId === id) {
            if (updatedProjects.length > 0) {
                const nextProject = updatedProjects.sort((a,b) => b.lastModified - a.lastModified)[0];
                setCurrentProjectId(nextProject.id);
                projectService.setLastProjectId(nextProject.id);
            } else {
                handleNewProject();
            }
        }
    };
    
    const handleDurationChange = useCallback((id: string, newDuration: number) => {
        updateFrames(prevFrames =>
            prevFrames.map(frame =>
                frame.id === id ? { ...frame, duration: Math.max(0.25, newDuration) } : frame
            )
        );
    }, [updateFrames]);

    const handlePromptChange = useCallback((id: string, newPrompt: string) => {
        updateFrames(prevFrames =>
            prevFrames.map(frame =>
                frame.id === id ? { ...frame, prompt: newPrompt, isTransition: false } : frame
            )
        );
        if (editingFrame?.id === id) {
            setEditingFrame(prev => prev ? { ...prev, prompt: newPrompt } : null);
        }
    }, [editingFrame, updateFrames]);
    
    const handleSavePrompt = (id: string, newPrompt: string) => {
        handlePromptChange(id, newPrompt);
        setEditingFrame(null);
    }

    const handleSaveFrameDetails = useCallback((id: string, newPrompt: string, newDuration: number) => {
        updateFrames(prevFrames =>
            prevFrames.map(frame =>
                frame.id === id ? { ...frame, prompt: newPrompt, duration: Math.max(0.25, newDuration), isTransition: false } : frame
            )
        );
        if (detailedFrame?.id === id) {
            setDetailedFrame(prev => prev ? { ...prev, prompt: newPrompt, duration: newDuration } : null);
        }
    }, [detailedFrame, updateFrames]);

    const handleDeleteFrame = useCallback((id: string) => {
        updateFrames(prevFrames => prevFrames.filter(frame => frame.id !== id));
    }, [updateFrames]);

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
                        updateFrames(prev => {
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
            const leftFrame = localFrames[index - 1];
            const rightFrame = localFrames[index];
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
                updateFrames(prev => {
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
    }, [localFrames, updateFrames]);
    
    const handleStartFrameGeneration = async (data: { mode: 'generate' | 'edit', prompt: string, maintainContext?: boolean, file?: File, preview?: string }) => {
        setIsGenerateModalOpen(false);
        setGeneratingNewFrameIndex(generateFrameIndex);
        
        try {
            let imageUrl: string;
            let finalPrompt = data.prompt;

            if (data.mode === 'generate') {
                if (data.maintainContext) {
                    const leftFrame = localFrames[generateFrameIndex - 1] || null;
                    const rightFrame = localFrames[generateFrameIndex] || null;
                    const result = await generateImageInContext(data.prompt, leftFrame, rightFrame);
                    imageUrl = result.imageUrl;
                    finalPrompt = result.prompt;
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
                prompt: finalPrompt,
                duration: 3.0,
            };

            updateFrames(prev => {
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
        if (localFrames.length === 0) {
            alert("Please add at least one frame to analyze.");
            return;
        }
        setGeneratingStory(true);
        try {
            const prompts = await analyzeStory(localFrames);
            if (prompts.length === localFrames.length) {
                updateFrames(prevFrames =>
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
        const frameToUpdate = localFrames.find(f => f.id === frameId);
        if (!frameToUpdate) return;

        setGeneratingPromptFrameId(frameId);
        try {
            const newPrompt = await generateSinglePrompt(frameToUpdate, localFrames);
            handlePromptChange(frameId, newPrompt);
        } catch (error) {
             console.error("Error generating single prompt:", error);
            alert(`Failed to generate prompt: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setGeneratingPromptFrameId(null);
        }
    };

    const handleGenerateTransition = useCallback(async (index: number) => {
        const leftFrame = localFrames[index - 1];
        const rightFrame = localFrames[index];

        if (!leftFrame || !rightFrame) {
            alert("Не удалось найти соседние кадры для создания перехода.");
            return;
        }

        setGeneratingPromptFrameId(leftFrame.id);
        try {
            const transitionPrompt = await generateTransitionPrompt(leftFrame, rightFrame);
            updateFrames(prevFrames =>
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
    }, [localFrames, updateFrames]);

    const handleGenerateVideo = async (frame: Frame) => {
        // This function remains largely the same, no project state changes needed here.
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
            <Header 
                projectName={currentProject?.name || 'Загрузка...'}
                hasUnsavedChanges={hasUnsavedChanges}
                onNewProject={handleNewProject}
                onSaveProject={handleSaveProject}
                onSaveAsProject={() => setIsSaveModalOpen(true)}
                onLoadProject={() => setIsLoadModalOpen(true)}
            />
            <main className="flex flex-1 flex-col overflow-auto p-6">
                <Timeline
                    frames={localFrames}
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
                    onViewImage={setViewingFrameIndex}
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
                    frames={localFrames}
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
            {viewingFrameIndex !== null && (
                <ImageViewerModal 
                    frames={localFrames}
                    startIndex={viewingFrameIndex}
                    onClose={() => setViewingFrameIndex(null)} 
                />
            )}
            {detailedFrame && (
                <FrameDetailModal 
                    frame={detailedFrame}
                    onClose={() => setDetailedFrame(null)}
                    onSave={handleSaveFrameDetails}
                />
            )}
            {isSaveModalOpen && (
                <ProjectSaveModal 
                    onClose={() => setIsSaveModalOpen(false)}
                    onSave={handleSaveAs}
                    initialName={currentProject?.name}
                    title={currentProject?.id === DEMO_PROJECT_ID ? "Сохранить демо как новый проект" : "Сохранить проект как"}
                />
            )}
            {isLoadModalOpen && (
                <ProjectLoadModal
                    projects={projects}
                    currentProjectId={currentProjectId}
                    onClose={() => setIsLoadModalOpen(false)}
                    onLoad={handleLoadProject}
                    onDelete={handleDeleteProject}
                    onNew={handleNewProject}
                />
            )}
        </div>
    );
}
