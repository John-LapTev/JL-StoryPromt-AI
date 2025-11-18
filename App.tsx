import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Frame, Project, Asset, StorySettings } from './types';
import { initialFrames, initialAssets } from './constants';
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
import { AssetLibraryPanel } from './components/AssetLibraryPanel';
import { ContextMenu } from './components/ContextMenu';
import { StorySettingsModal } from './components/StorySettingsModal';
import { AdaptationSettingsModal } from './components/AdaptationSettingsModal';
import { analyzeStory, generateSinglePrompt, generateIntermediateFrame, generateTransitionPrompt, generateImageFromPrompt, editImage, generateVideoFromFrame, generateImageInContext, createStoryFromAssets, adaptImageToStory, adaptImageAspectRatio } from './services/geminiService';
import { fileToBase64, dataUrlToFile, fetchCorsImage, getImageDimensions } from './utils/fileUtils';

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

const hydrateFrame = async (frameData: Omit<Frame, 'file'>): Promise<Frame> => {
    // Migration for old frame structure
    const frameWithVersions = {
      ...frameData,
      imageUrls: frameData.imageUrls || [(frameData as any).imageUrl],
      activeVersionIndex: frameData.activeVersionIndex || 0,
      aspectRatio: frameData.aspectRatio || '16:9',
    };
    const activeImageUrl = frameWithVersions.imageUrls[frameWithVersions.activeVersionIndex];
    const file = dataUrlToFile(activeImageUrl, `story-frame-${frameData.id}.png`);
    return { ...frameWithVersions, file };
};

const initialStorySettings: StorySettings = {
    mode: 'auto',
    prompt: '',
    genre: '',
    ending: '',
};

export default function App() {
    // Project State
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [localFrames, setLocalFrames] = useState<Frame[]>([]);
    const [localAssets, setLocalAssets] = useState<Asset[]>([]);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [storySettings, setStorySettings] = useState<StorySettings>(initialStorySettings);
    const [frameCount, setFrameCount] = useState(10);
    const [globalAspectRatio, setGlobalAspectRatio] = useState('16:9');
    const [isAspectRatioLocked, setIsAspectRatioLocked] = useState(true);


    // Modal States
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [isAdvancedGenerateModalOpen, setIsAdvancedGenerateModalOpen] = useState(false);
    const [isStorySettingsModalOpen, setIsStorySettingsModalOpen] = useState(false);
    const [advancedGenerateModalConfig, setAdvancedGenerateModalConfig] = useState<{
        mode: 'generate' | 'edit';
        frameToEdit?: Frame;
        insertIndex?: number;
    }>({ mode: 'generate' });
    const [adaptingFrame, setAdaptingFrame] = useState<Frame | null>(null);


    // UI States
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [isVeoKeySelected, setIsVeoKeySelected] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [editingFrame, setEditingFrame] = useState<Frame | null>(null);
    const [viewingFrameIndex, setViewingFrameIndex] = useState<number | null>(null);
    const [detailedFrame, setDetailedFrame] = useState<Frame | null>(null);
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, frame: Frame } | null>(null);
    
    // Non-blocking loading states
    const [generatingStory, setGeneratingStory] = useState(false);
    const [generatingPromptFrameId, setGeneratingPromptFrameId] = useState<string | null>(null);
    const [generatingVideoState, setGeneratingVideoState] = useState<GeneratingVideoState>(null);

    // Refs
    const appRef = useRef<HTMLDivElement>(null);

    // Derived state
    const currentProject = useMemo(() => projects.find(p => p.id === currentProjectId), [projects, currentProjectId]);

    // Initial project loading
    useEffect(() => {
        let allProjects = projectService.getProjects();
        const demoProjectExists = allProjects.some(p => p.id === DEMO_PROJECT_ID);

        // Ensure the demo project always exists.
        if (!demoProjectExists) {
            const demoProject: Project = {
                id: DEMO_PROJECT_ID,
                name: 'Демо проект',
                frames: initialFrames,
                assets: initialAssets,
                lastModified: 0 // Set a very old timestamp so it doesn't appear as the most recent by default.
            };
            allProjects.unshift(demoProject);
        }
        
        let lastId = projectService.getLastProjectId();
        let projectToLoad = allProjects.find(p => p.id === lastId);

        // If there's no valid last project ID (e.g., it was deleted), load the most recently modified one.
        if (!projectToLoad && allProjects.length > 0) {
            projectToLoad = [...allProjects].sort((a,b) => b.lastModified - a.lastModified)[0];
            lastId = projectToLoad.id;
        }

        if (projectToLoad) {
            setProjects(allProjects);
            setCurrentProjectId(projectToLoad.id);
            projectService.setLastProjectId(projectToLoad.id);
            projectService.saveProjects(allProjects); // Save back to LS in case demo project was added
        } else {
            // This is a safety net, should not be reached if the demo project logic is correct.
            console.error("Could not determine a project to load.");
        }
    }, []);

    // Sync and hydrate local state from the current project
    useEffect(() => {
        if (currentProject) {
            const hydrateAllData = async () => {
                // Hydrate frames by creating File objects
                const hydratedFrames: Frame[] = await Promise.all(
                    (currentProject.frames || []).map(async (frameData) => {
                        // Migration for old frame structure
                        const frameWithVersions = {
                            ...(frameData as any), // Cast to any to handle old structure with imageUrl
                            imageUrls: frameData.imageUrls || [(frameData as any).imageUrl],
                            activeVersionIndex: frameData.activeVersionIndex ?? 0,
                            aspectRatio: frameData.aspectRatio || '16:9',
                        };
                        const activeImageUrl = frameWithVersions.imageUrls[frameWithVersions.activeVersionIndex];

                        try {
                            const filename = `frame-${frameWithVersions.id}.${activeImageUrl.split('.').pop()?.split('?')[0] || 'png'}`;
                            let file: File;
                            if (activeImageUrl.startsWith('data:')) {
                                file = dataUrlToFile(activeImageUrl, filename);
                            } else {
                                const blob = await fetchCorsImage(activeImageUrl);
                                file = new File([blob], filename, { type: blob.type });
                            }
                            return { ...frameWithVersions, file };
                        } catch (e) {
                            console.error(`Could not create file for frame image ${frameWithVersions.id}:`, e);
                            const emptyFile = new File([], `failed-${frameWithVersions.id}.txt`, { type: 'text/plain' });
                            return { ...frameWithVersions, file: emptyFile };
                        }
                    })
                );
                setLocalFrames(hydratedFrames);

                // Hydrate assets by creating File objects
                const hydratedAssets: Asset[] = await Promise.all(
                    (currentProject.assets || []).map(async (asset) => {
                        try {
                            let file: File;
                            if (asset.imageUrl.startsWith('data:')) {
                                file = dataUrlToFile(asset.imageUrl, asset.name);
                            } else {
                                const blob = await fetchCorsImage(asset.imageUrl);
                                file = new File([blob], asset.name, { type: blob.type });
                            }
                            return { ...asset, file };
                        } catch (e) {
                             console.error(`Could not create file for asset image ${asset.name}:`, e);
                            const emptyFile = new File([], `failed-${asset.name}.txt`, {type: 'text/plain'});
                            return { ...asset, file: emptyFile };
                        }
                    })
                );
                 setLocalAssets(hydratedAssets);
            };

            hydrateAllData();
        } else {
            setLocalFrames([]);
            setLocalAssets([]);
        }
    }, [currentProject]);

    const updateFrames = useCallback((updater: React.SetStateAction<Frame[]>) => {
        setLocalFrames(updater);
        setHasUnsavedChanges(true);
    }, []);
    
    const updateAssets = useCallback((updater: React.SetStateAction<Asset[]>) => {
        setLocalAssets(updater);
        setHasUnsavedChanges(true);
    }, []);

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
        return localFrames.reduce((acc, frame) => acc + (frame.isGenerating ? 0 : frame.duration), 0);
    }, [localFrames]);
    
    const handleConfirmUnsaved = () => {
        if (!hasUnsavedChanges) return true;
        return window.confirm("У вас есть несохраненные изменения. Вы уверены, что хотите продолжить без сохранения?");
    };

    const handleNewProject = () => {
        if (!handleConfirmUnsaved()) return;
    
        const newProject: Project = {
            id: crypto.randomUUID(),
            name: 'Новый проект',
            frames: [],
            assets: [],
            lastModified: Date.now(),
        };
    
        setProjects(prevProjects => {
            const updatedProjects = [...prevProjects, newProject];
            projectService.saveProjects(updatedProjects);
            projectService.setLastProjectId(newProject.id);
            return updatedProjects;
        });
        
        setCurrentProjectId(newProject.id);
        setHasUnsavedChanges(false);
        setSelectedAssetIds(new Set()); // Clear selection
    
        setIsLoadModalOpen(false);
    };

    const handleSaveProject = () => {
        if (!currentProject) return;
        if (currentProject.id === DEMO_PROJECT_ID || hasUnsavedChanges === false && projects.some(p => p.id === currentProject.id)) {
            setIsSaveModalOpen(true);
            return;
        }

        const framesToSave = localFrames.map(({ file, ...rest }) => ({ ...rest, isGenerating: undefined, generatingMessage: undefined }));
        const assetsToSave = localAssets.map(({ file, ...rest }) => rest);
        const updatedProject = { ...currentProject, frames: framesToSave, assets: assetsToSave, lastModified: Date.now() };
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
            frames: localFrames.map(({ file, ...rest }) => ({...rest, isGenerating: undefined, generatingMessage: undefined })),
            assets: localAssets.map(({ file, ...rest }) => rest),
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
        setSelectedAssetIds(new Set()); // Clear selection
        setIsLoadModalOpen(false);
    };

    const handleDeleteProject = (id: string) => {
        if (id === DEMO_PROJECT_ID) {
            alert("Демонстрационный проект нельзя удалить.");
            return;
        }
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
    
    const handleReorderFrame = useCallback((dragIndex: number, dropIndex: number) => {
        updateFrames(prevFrames => {
            const framesCopy = [...prevFrames];
            const [draggedFrame] = framesCopy.splice(dragIndex, 1);
            // Adjust drop index if we are moving an item from before the drop point to after it
            const effectiveDropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
            framesCopy.splice(effectiveDropIndex, 0, draggedFrame);
            return framesCopy;
        });
    }, [updateFrames]);

    const handleAddFrame = useCallback(async (index: number, type: 'upload' | 'generate') => {
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
                            imageUrls: [base64],
                            activeVersionIndex: 0,
                            prompt: '',
                            duration: 3.0,
                            file: file,
                            aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9',
                        };
                        updateFrames(prev => {
                            const newFrames = [...prev];
                            newFrames.splice(index, 0, newFrame);
                            return newFrames;
                        });
                        // Check for adaptation context after state update
                        setTimeout(() => {
                           setLocalFrames(currentFrames => {
                                const newIndex = currentFrames.findIndex(f => f.id === newFrame.id);
                                if (newIndex > -1 && (newIndex > 0 || newIndex < currentFrames.length - 1)) {
                                    setAdaptingFrame(currentFrames[newIndex]);
                                }
                                return currentFrames;
                           });
                        }, 0);
                    } catch (error) {
                        console.error("Error reading file:", error);
                        alert("Could not load image file.");
                    }
                }
            };
            input.click();
        } else if (type === 'generate') {
            setAdvancedGenerateModalConfig({ mode: 'generate', insertIndex: index });
            setIsAdvancedGenerateModalOpen(true);
        }
    }, [updateFrames, isAspectRatioLocked, globalAspectRatio]);
    
    const handleAddFramesFromAssets = useCallback((assetIds: string[], index: number) => {
        const assetsToConvert = localAssets.filter(asset => assetIds.includes(asset.id));
        if (assetsToConvert.length === 0) return;
    
        // Preserve the order from the drag operation
        const orderedAssets = assetIds
            .map(id => assetsToConvert.find(a => a.id === id))
            .filter((a): a is Asset => !!a);
    
        const newFrames: Frame[] = orderedAssets.map(asset => ({
            id: crypto.randomUUID(),
            imageUrls: [asset.imageUrl],
            activeVersionIndex: 0,
            prompt: '',
            duration: 3.0,
            file: asset.file,
            aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9',
        }));
    
        updateFrames(prev => {
            const framesCopy = [...prev];
            framesCopy.splice(index, 0, ...newFrames);
            return framesCopy;
        });

        // Check context for the first new frame
        const firstNewFrame = newFrames[0];
        if (firstNewFrame) {
            setTimeout(() => {
                setLocalFrames(currentFrames => {
                    const newIndex = currentFrames.findIndex(f => f.id === firstNewFrame.id);
                    if (newIndex > -1 && (newIndex > 0 || newIndex < currentFrames.length - newFrames.length)) {
                        setAdaptingFrame(currentFrames[newIndex]);
                    }
                    return currentFrames;
                })
            }, 0);
        }
    }, [localAssets, updateFrames, isAspectRatioLocked, globalAspectRatio]);

    const handleAddFramesFromFiles = useCallback(async (files: File[], index: number) => {
        const newFramesPromises = files.map(async (file) => {
            const base64 = await fileToBase64(file);
            return {
                id: crypto.randomUUID(),
                imageUrls: [base64],
                activeVersionIndex: 0,
                prompt: '',
                duration: 3.0,
                file: file,
                aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9',
            };
        });
    
        const newFrames = await Promise.all(newFramesPromises);
    
        updateFrames(prev => {
            const framesCopy = [...prev];
            framesCopy.splice(index, 0, ...newFrames);
            return framesCopy;
        });

        const firstNewFrame = newFrames[0];
        if (firstNewFrame) {
             setTimeout(() => {
                setLocalFrames(currentFrames => {
                    const newIndex = currentFrames.findIndex(f => f.id === firstNewFrame.id);
                    if (newIndex > -1 && (newIndex > 0 || newIndex < currentFrames.length - newFrames.length)) {
                         setAdaptingFrame(currentFrames[newIndex]);
                    }
                    return currentFrames;
                })
            }, 0);
        }
    }, [updateFrames, isAspectRatioLocked, globalAspectRatio]);

    const handleGenerateFrame = async (prompt: string, insertIndex: number) => {
        const framesBeforePlaceholder = localFrames;
        const leftFrame = framesBeforePlaceholder[insertIndex - 1] || null;
        const rightFrame = framesBeforePlaceholder[insertIndex] || null;
    
        if (prompt === '__AUTO__' && (!leftFrame || !rightFrame)) {
            alert("Не удалось найти соседние кадры для автоматической генерации. Операция отменена.");
            return;
        }
    
        const placeholderId = crypto.randomUUID();
        const placeholderFrame: Frame = {
            id: placeholderId,
            imageUrls: [''],
            activeVersionIndex: 0,
            prompt: 'Генерация кадра...',
            duration: 3.0,
            isGenerating: true,
            generatingMessage: 'Генерация кадра...',
            aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9',
            file: new File([], 'placeholder.txt', { type: 'text/plain' })
        };
    
        updateFrames(prev => {
            const newFrames = [...prev];
            newFrames.splice(insertIndex, 0, placeholderFrame);
            return newFrames;
        });
    
        try {
            let result: { imageUrl: string, prompt: string };
    
            if (prompt === '__AUTO__') {
                if (!leftFrame || !rightFrame) throw new Error("Соседние кадры не найдены.");
                result = await generateIntermediateFrame(leftFrame, rightFrame);
            } else {
                result = await generateImageInContext(prompt, leftFrame, rightFrame);
            }
            
            const file = dataUrlToFile(result.imageUrl, `generated-${Date.now()}.png`);
            
            const finalFrame: Frame = {
                id: crypto.randomUUID(),
                imageUrls: [result.imageUrl],
                activeVersionIndex: 0,
                prompt: result.prompt,
                duration: leftFrame && rightFrame ? Number(((leftFrame.duration + rightFrame.duration) / 2).toFixed(2)) : 3.0,
                file,
                isGenerating: false,
                aspectRatio: placeholderFrame.aspectRatio,
            };
    
            updateFrames(prev => prev.map(frame => frame.id === placeholderId ? finalFrame : frame));
    
        } catch (error) {
            console.error("Error during generation:", error);
            alert(`Не удалось выполнить операцию: ${error instanceof Error ? error.message : String(error)}`);
            updateFrames(prev => prev.filter(f => f.id !== placeholderId));
        }
    };

    const handleStartFrameGeneration = async (data: { prompt: string }) => {
        setIsAdvancedGenerateModalOpen(false);
        const insertIndex = advancedGenerateModalConfig.insertIndex ?? localFrames.length;
        handleGenerateFrame(data.prompt, insertIndex);
    };

    const handleApplyEdit = useCallback(async (frameId: string, newImageUrl: string, newPrompt: string) => {
        try {
            const file = dataUrlToFile(newImageUrl, `edited-${frameId}-${Date.now()}.png`);
            updateFrames(prev => prev.map(f => {
                if (f.id === frameId) {
                    const newImageUrls = [...f.imageUrls, newImageUrl];
                    return {
                        ...f,
                        imageUrls: newImageUrls,
                        activeVersionIndex: newImageUrls.length - 1,
                        file,
                        prompt: newPrompt,
                        isTransition: false,
                        isGenerating: false,
                    };
                }
                return f;
            }));
            setIsAdvancedGenerateModalOpen(false);
        } catch (error) {
            console.error("Error applying edit:", error);
            alert(`Не удалось применить изменения: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [updateFrames]);


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
        if (!isVeoKeySelected && window.aistudio) {
            const confirmChange = window.confirm("Для генерации видео требуется API-ключ с доступом к Veo. Хотите выбрать ключ сейчас? Это можно также сделать в меню пользователя (иконка в правом верхнем углу).");
            if (confirmChange) {
                try {
                    await window.aistudio.openSelectKey();
                    setIsVeoKeySelected(true); // Assume success to allow immediate retry
                } catch (e) {
                    alert("Выбор ключа отменен. Генерация видео невозможна.");
                    return;
                }
            } else {
                return;
            }
        }

        try {
            const updateMessage = (message: string) => setGeneratingVideoState({ frameId: frame.id, message });
            const videoUrl = await generateVideoFromFrame(frame, updateMessage);
            setGeneratedVideoUrl(videoUrl);
        } catch (error) {
            console.error("Video generation failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("API key") || errorMessage.includes("квота")) {
                setIsVeoKeySelected(false);
            }
            alert(`Ошибка при генерации видео: ${errorMessage}`);
        } finally {
            setGeneratingVideoState(null);
        }
    };
    
    const handleManageApiKey = async () => {
        if (window.aistudio) {
            try {
                await window.aistudio.openSelectKey();
                // Re-check status after selection, or just assume it's okay.
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setIsVeoKeySelected(hasKey);
                alert(hasKey ? "API-ключ успешно выбран." : "Выбор ключа был отменен или не удался.");
            } catch (error) {
                console.error("Error opening API key selection:", error);
                alert("Не удалось открыть диалог выбора API-ключа.");
            }
        } else {
            alert("Функция управления ключами не доступна в этой среде.");
        }
    };

    const handleAddAssets = useCallback(async (files: File[]) => {
        const newAssets: Asset[] = await Promise.all(
            files.map(async (file) => {
                const imageUrl = await fileToBase64(file);
                return {
                    id: crypto.randomUUID(),
                    imageUrl,
                    file,
                    name: file.name,
                };
            })
        );
        updateAssets(prev => [...prev, ...newAssets]);
    }, [updateAssets]);

    const handleDeleteAsset = useCallback((id: string) => {
        updateAssets(prev => prev.filter(a => a.id !== id));
        setSelectedAssetIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    }, [updateAssets]);
    
    const handleSelectAllAssets = useCallback(() => {
        setSelectedAssetIds(new Set(localAssets.map(a => a.id)));
    }, [localAssets]);

    const handleDeselectAllAssets = useCallback(() => {
        setSelectedAssetIds(new Set());
    }, []);

    const handleCreateStoryFromAssets = async () => {
        const assetsToUse = selectedAssetIds.size > 0
            ? localAssets.filter(a => selectedAssetIds.has(a.id))
            : localAssets;

        if (assetsToUse.length === 0) {
            alert(localAssets.length === 0
                ? "Пожалуйста, загрузите хотя бы один ассет, чтобы создать сюжет."
                : "Не удалось найти выбранные ассеты. Пожалуйста, снимите и снова установите выбор и попробуйте еще раз."
            );
            return;
        }
        if (frameCount < 2 || frameCount > 20) {
            alert("Пожалуйста, укажите количество кадров от 2 до 20.");
            return;
        }

        try {
            setGeneratingStory(true);
            setIsAssetLibraryOpen(false);

            const placeholderFrames: Frame[] = Array.from({ length: frameCount }, (_, i) => ({
                id: `placeholder-${crypto.randomUUID()}`,
                imageUrls: [''],
                activeVersionIndex: 0,
                prompt: `Ожидание кадра ${i + 1}...`,
                duration: 3.0,
                isGenerating: true,
                aspectRatio: globalAspectRatio,
                file: new File([], 'placeholder.txt', { type: 'text/plain' })
            }));
            updateFrames(placeholderFrames);

            for await (const update of createStoryFromAssets(assetsToUse, storySettings, frameCount)) {
                if (update.type === 'progress' || update.type === 'plan' || update.type === 'complete') {
                    if (update.type === 'progress') {
                        updateFrames(prev => {
                            const newFrames = [...prev];
                            if (newFrames[update.index] && newFrames[update.index].isGenerating) {
                                newFrames[update.index] = { ...newFrames[update.index], prompt: update.message };
                            }
                            return newFrames;
                        });
                    }
                } else if (update.type === 'frame') {
                    const hydratedFrame = await hydrateFrame({ ...update.frame, aspectRatio: globalAspectRatio });
                    updateFrames(prev => {
                        const newFrames = [...prev];
                        if (newFrames[update.index] && newFrames[update.index].isGenerating) {
                            newFrames[update.index] = hydratedFrame;
                        }
                        return newFrames;
                    });
                }
            }
        } catch (error) {
            console.error("An unexpected error occurred in `handleCreateStoryFromAssets`:", error);
            alert(`Произошла непредвиденная ошибка при создании сюжета: ${error instanceof Error ? error.message : String(error)}`);
            updateFrames([]);
        } finally {
            setGeneratingStory(false);
            setSelectedAssetIds(new Set());
        }
    };
    
    const handleSaveStorySettings = (newSettings: StorySettings) => {
        setStorySettings(newSettings);
        setIsStorySettingsModalOpen(false);
    };

    const handleAdaptFrameToStory = useCallback(async (frameId: string, instruction?: string) => {
        const frameIndex = localFrames.findIndex(f => f.id === frameId);
        if (frameIndex === -1) return;

        const frameToAdapt = localFrames[frameIndex];
        const leftFrame = frameIndex > 0 ? localFrames[frameIndex - 1] : null;
        const rightFrame = frameIndex < localFrames.length - 1 ? localFrames[frameIndex + 1] : null;

        updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, isGenerating: true, generatingMessage: 'Адаптация стиля...' } : f));
        
        try {
            const { imageUrl, prompt } = await adaptImageToStory(frameToAdapt, leftFrame, rightFrame, instruction);
            const file = dataUrlToFile(imageUrl, `adapted-${frameId}.png`);

            updateFrames(prev => prev.map(f => {
                if (f.id === frameId) {
                    const newImageUrls = [...f.imageUrls, imageUrl];
                    return {
                        ...f,
                        imageUrls: newImageUrls,
                        activeVersionIndex: newImageUrls.length - 1,
                        file,
                        prompt,
                        isTransition: false,
                        isGenerating: false,
                        generatingMessage: undefined,
                    };
                }
                return f;
            }));
        } catch (error) {
            console.error("Error adapting frame to story:", error);
            alert(`Не удалось адаптировать кадр: ${error instanceof Error ? error.message : String(error)}`);
            updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, isGenerating: false, generatingMessage: undefined } : f));
        }

    }, [localFrames, updateFrames]);
    
    // --- Aspect Ratio Handlers ---
    const handleGlobalAspectRatioChange = (newRatio: string) => {
        setGlobalAspectRatio(newRatio);
        if (isAspectRatioLocked) {
            updateFrames(prev => prev.map(f => ({ ...f, aspectRatio: newRatio })));
        }
    };
    
    const handleToggleAspectRatioLock = () => {
        const newLockState = !isAspectRatioLocked;
        setIsAspectRatioLocked(newLockState);
        if (newLockState) {
            // When locking, sync all frames to the global aspect ratio
            updateFrames(prev => prev.map(f => ({...f, aspectRatio: globalAspectRatio })));
        }
    };

    const handleFrameAspectRatioChange = useCallback((frameId: string, newRatio: string) => {
        if (!isAspectRatioLocked) {
            updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, aspectRatio: newRatio } : f));
        }
    }, [isAspectRatioLocked, updateFrames]);

    const handleAdaptFrameAspectRatio = useCallback(async (frameId: string, targetRatio?: string) => {
        const frameToAdapt = localFrames.find(f => f.id === frameId);
        const finalTargetRatio = targetRatio || frameToAdapt?.aspectRatio;

        if (!frameToAdapt || !finalTargetRatio) {
            console.error("Кадр или целевое соотношение сторон не найдены для адаптации:", frameId);
            return;
        }

        updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, isGenerating: true, generatingMessage: `Адаптация к ${finalTargetRatio}...` } : f));

        try {
            const { imageUrl, prompt } = await adaptImageAspectRatio(frameToAdapt, finalTargetRatio);
            const file = dataUrlToFile(imageUrl, `adapted-ar-${frameId}.png`);

            updateFrames(prev => prev.map(f => {
                if (f.id === frameId) {
                    const newImageUrls = [...f.imageUrls, imageUrl];
                    return {
                        ...f,
                        imageUrls: newImageUrls,
                        activeVersionIndex: newImageUrls.length - 1,
                        file,
                        prompt,
                        isTransition: false,
                        isGenerating: false,
                        generatingMessage: undefined,
                        aspectRatio: finalTargetRatio,
                    };
                }
                return f;
            }));
        } catch (error) {
            console.error("Error adapting frame aspect ratio:", error);
            alert(`Не удалось адаптировать соотношение сторон: ${error instanceof Error ? error.message : String(error)}`);
            updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, isGenerating: false, generatingMessage: undefined } : f));
        }
    }, [localFrames, updateFrames]);

    const handleAdaptAllFramesAspectRatio = async () => {
        const [targetW, targetH] = globalAspectRatio.split(':').map(Number);
        if (isNaN(targetW) || isNaN(targetH) || targetH === 0) {
            alert("Неверный глобальный формат.");
            return;
        }
        const targetRatioValue = targetW / targetH;
        const tolerance = 0.01;
    
        let framesToAdaptIds: string[] = [];
    
        // Set initial loading state for all frames
        updateFrames(prev => prev.map(f => ({ ...f, isGenerating: true, generatingMessage: 'Проверка формата...' })));
    
        try {
            for (const frame of localFrames) {
                // FIX: Skip placeholder frames that are currently being generated.
                if (frame.isGenerating && frame.id.startsWith('placeholder-')) {
                    console.log(`Skipping check for placeholder frame ${frame.id}`);
                    updateFrames(prev => prev.map(f => f.id === frame.id ? { ...f, isGenerating: false, generatingMessage: undefined } : f));
                    continue; 
                }
                const activeImageUrl = frame.imageUrls[frame.activeVersionIndex];

                // FIX: Also skip frames with no valid image URL.
                if (!activeImageUrl) {
                    console.log(`Skipping check for frame ${frame.id} due to missing image URL`);
                    updateFrames(prev => prev.map(f => f.id === frame.id ? { ...f, isGenerating: false, generatingMessage: undefined, prompt: `${f.prompt || ''} (Ошибка: отсутствует изображение)` } : f));
                    continue;
                }
                
                try {
                    const { width, height } = await getImageDimensions(activeImageUrl);
                    const currentRatioValue = width / height;
    
                    if (Math.abs(currentRatioValue - targetRatioValue) > tolerance) {
                        framesToAdaptIds.push(frame.id);
                    } else {
                        // It's correct, remove loading state
                        updateFrames(prev => prev.map(f => f.id === frame.id ? { ...f, isGenerating: false, generatingMessage: undefined } : f));
                    }
                } catch (e) {
                    console.error(`Не удалось получить размеры для кадра ${frame.id}:`, e);
                    updateFrames(prev => prev.map(f => f.id === frame.id ? { ...f, isGenerating: false, generatingMessage: undefined, prompt: `${f.prompt || ''} (Ошибка: не удалось прочитать изображение)` } : f));
                }
            }
    
            if (framesToAdaptIds.length === 0) {
                alert("Все кадры уже имеют целевое соотношение сторон.");
                // Ensure loading state is cleared even if nothing is adapted
                updateFrames(prev => prev.map(f => f.isGenerating && f.generatingMessage === 'Проверка формата...' ? { ...f, isGenerating: false, generatingMessage: undefined } : f));
                return;
            }
    
            const adaptationPromises = framesToAdaptIds.map(id => 
                handleAdaptFrameAspectRatio(id, globalAspectRatio)
            );
    
            await Promise.all(adaptationPromises);
    
        } catch (error) {
            console.error("Произошла ошибка во время пакетной адаптации:", error);
            alert(`Произошла ошибка: ${error instanceof Error ? error.message : String(error)}`);
            updateFrames(prev => prev.map(f => ({ ...f, isGenerating: false, generatingMessage: undefined })));
        }
    };
    

    // --- Context Menu Handlers ---
    const handleContextMenu = (e: React.MouseEvent, frame: Frame) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, frame });
    };
    const handleCloseContextMenu = () => setContextMenu(null);

    const handleDuplicateFrame = async (frameId: string) => {
        const frameIndex = localFrames.findIndex(f => f.id === frameId);
        if (frameIndex === -1) return;
        const frameToDuplicate = localFrames[frameIndex];
        const newFrame: Frame = {
            ...frameToDuplicate,
            id: crypto.randomUUID(),
        };
        updateFrames(prev => {
            const newFrames = [...prev];
            newFrames.splice(frameIndex + 1, 0, newFrame);
            return newFrames;
        });
    };
    
    const handleReplaceFrame = (frameId: string) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    const base64 = await fileToBase64(file);
                    updateFrames(prev => prev.map(f => {
                        if (f.id === frameId) {
                            const newImageUrls = [base64];
                            return { ...f, imageUrls: newImageUrls, activeVersionIndex: 0, file };
                        }
                        return f;
                    }));
                } catch (error) {
                    console.error("Error replacing file:", error);
                    alert("Could not load image file for replacement.");
                }
            }
        };
        input.click();
    };
    
    const handleVersionChange = useCallback(async (frameId: string, direction: 'next' | 'prev') => {
        const framesWithNewVersions = await Promise.all(
            localFrames.map(async (frame) => {
                if (frame.id === frameId) {
                    let newIndex = frame.activeVersionIndex;
                    if (direction === 'next' && newIndex < frame.imageUrls.length - 1) {
                        newIndex++;
                    } else if (direction === 'prev' && newIndex > 0) {
                        newIndex--;
                    }
    
                    if (newIndex !== frame.activeVersionIndex) {
                        const activeImageUrl = frame.imageUrls[newIndex];
                        const filename = `frame-${frame.id}-v${newIndex}.${activeImageUrl.split('.').pop()?.split('?')[0] || 'png'}`;
                        let newFile: File;
                        try {
                            if (activeImageUrl.startsWith('data:')) {
                                newFile = dataUrlToFile(activeImageUrl, filename);
                            } else {
                                const blob = await fetchCorsImage(activeImageUrl);
                                newFile = new File([blob], filename, { type: blob.type });
                            }
                            return { ...frame, activeVersionIndex: newIndex, file: newFile };
                        } catch (e) {
                            console.error(`Could not create file for new version of frame ${frame.id}:`, e);
                            newFile = new File([], `failed-${frame.id}.txt`, { type: 'text/plain' });
                            return { ...frame, activeVersionIndex: newIndex, file: newFile };
                        }
                    }
                }
                return frame;
            })
        );
        updateFrames(framesWithNewVersions);
    }, [localFrames, updateFrames]);


    return (
        <div ref={appRef} className="relative flex h-screen w-full flex-col group/design-root overflow-hidden">
            <Header 
                projectName={currentProject?.name || 'Загрузка...'}
                hasUnsavedChanges={hasUnsavedChanges}
                onNewProject={handleNewProject}
                onSaveProject={handleSaveProject}
                onSaveAsProject={() => setIsSaveModalOpen(true)}
                onLoadProject={() => setIsLoadModalOpen(true)}
                onManageApiKey={handleManageApiKey}
            />
            <main className="flex flex-1 flex-col overflow-auto p-6 relative">
                 <AssetLibraryPanel 
                    isOpen={isAssetLibraryOpen}
                    onClose={() => setIsAssetLibraryOpen(false)}
                    assets={localAssets}
                    selectedAssetIds={selectedAssetIds}
                    storySettings={storySettings}
                    frameCount={frameCount}
                    onAddAssets={handleAddAssets}
                    onDeleteAsset={handleDeleteAsset}
                    onToggleSelectAsset={(id) => {
                        setSelectedAssetIds(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(id)) {
                                newSet.delete(id);
                            } else {
                                newSet.add(id);
                            }
                            return newSet;
                        });
                    }}
                    onSelectAllAssets={handleSelectAllAssets}
                    onDeselectAllAssets={handleDeselectAllAssets}
                    onGenerateStory={() => handleCreateStoryFromAssets()}
                    onOpenStorySettings={() => setIsStorySettingsModalOpen(true)}
                    onFrameCountChange={setFrameCount}
                />
                <Timeline
                    frames={localFrames}
                    totalDuration={totalDuration}
                    transform={transform}
                    setTransform={setTransform}
                    generatingStory={generatingStory}
                    generatingPromptFrameId={generatingPromptFrameId}
                    generatingVideoState={generatingVideoState}
                    globalAspectRatio={globalAspectRatio}
                    isAspectRatioLocked={isAspectRatioLocked}
                    onGlobalAspectRatioChange={handleGlobalAspectRatioChange}
                    onToggleAspectRatioLock={handleToggleAspectRatioLock}
                    onFrameAspectRatioChange={handleFrameAspectRatioChange}
                    onAdaptFrameAspectRatio={handleAdaptFrameAspectRatio}
                    onAdaptAllFramesAspectRatio={handleAdaptAllFramesAspectRatio}
                    onDurationChange={handleDurationChange}
                    onPromptChange={handlePromptChange}
                    onAddFrame={handleAddFrame}
                    onAddFramesFromAssets={handleAddFramesFromAssets}
                    onAddFramesFromFiles={handleAddFramesFromFiles}
                    onDeleteFrame={handleDeleteFrame}
                    onReorderFrame={handleReorderFrame}
                    onAnalyzeStory={handleAnalyzeStory}
                    onGenerateSinglePrompt={handleGenerateSinglePrompt}
                    onGenerateTransition={handleGenerateTransition}
                    onGenerateVideo={handleGenerateVideo}
                    onEditPrompt={setEditingFrame}
                    onViewImage={setViewingFrameIndex}
                    onOpenDetailView={setDetailedFrame}
                    onOpenAssetLibrary={() => setIsAssetLibraryOpen(true)}
                    onContextMenu={handleContextMenu}
                    onVersionChange={handleVersionChange}
                />
            </main>

            <Chatbot 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                frames={localFrames}
                onGenerateFrame={(prompt) => handleGenerateFrame(prompt, localFrames.length)}
            />
            
            <button
                onClick={() => setIsChatOpen(true)}
                className="absolute bottom-6 right-6 z-20 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110"
                aria-label="Open AI Assistant"
            >
                <span className="material-symbols-outlined text-3xl">smart_toy</span>
            </button>
            
            {generatedVideoUrl && <VideoModal videoUrl={generatedVideoUrl} onClose={() => setGeneratedVideoUrl(null)} />}
            {isAdvancedGenerateModalOpen && (
                <AdvancedGenerateModal
                    onClose={() => setIsAdvancedGenerateModalOpen(false)}
                    onGenerate={handleStartFrameGeneration}
                    onApplyEdit={handleApplyEdit}
                    config={advancedGenerateModalConfig}
                    frames={localFrames}
                />
            )}
             {isStorySettingsModalOpen && (
                <StorySettingsModal
                    isOpen={isStorySettingsModalOpen}
                    onClose={() => setIsStorySettingsModalOpen(false)}
                    settings={storySettings}
                    onSave={handleSaveStorySettings}
                    assets={localAssets}
                    frameCount={frameCount}
                    onFrameCountChange={setFrameCount}
                />
            )}
             {adaptingFrame && (
                <AdaptationSettingsModal
                    frame={adaptingFrame}
                    allFrames={localFrames}
                    onClose={() => setAdaptingFrame(null)}
                    onAdapt={(frameId, instruction) => {
                        handleAdaptFrameToStory(frameId, instruction);
                        setAdaptingFrame(null);
                    }}
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
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={handleCloseContextMenu}
                    actions={[
                        { label: 'Создать видео', icon: 'movie', onClick: () => handleGenerateVideo(contextMenu.frame) },
                        { label: 'Адаптировать к сюжету', icon: 'auto_fix', onClick: () => setAdaptingFrame(contextMenu.frame) },
                        { label: 'Редактировать кадр', icon: 'tune', onClick: () => {
                            setAdvancedGenerateModalConfig({ mode: 'edit', frameToEdit: contextMenu.frame });
                            setIsAdvancedGenerateModalOpen(true);
                        }},
                        { label: 'Дублировать', icon: 'content_copy', onClick: () => handleDuplicateFrame(contextMenu.frame.id) },
                        { label: 'Заменить кадр', icon: 'swap_horiz', onClick: () => handleReplaceFrame(contextMenu.frame.id) },
                    ]}
                />
            )}
        </div>
    );
}