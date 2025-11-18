import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import type { Frame, Project, Asset, StorySettings, IntegrationConfig, Sketch, Note, Position } from './types';
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
import { IntegrationModal } from './components/IntegrationModal';
import { generateImageFromPrompt, adaptImageToStory, adaptImageAspectRatio } from './services/geminiService';
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
    
    let file: File;
    try {
        if (activeImageUrl.startsWith('data:')) {
            file = dataUrlToFile(activeImageUrl, `story-frame-${frameData.id}.png`);
        } else {
            const blob = await fetchCorsImage(activeImageUrl);
            file = new File([blob], `story-frame-${frameData.id}.png`, { type: blob.type });
        }
    } catch (e) {
        console.error(`Could not create file for frame image ${frameData.id}:`, e);
        // Create an empty placeholder file on failure
        file = new File([], `failed-frame-${frameData.id}.txt`, {type: 'text/plain'});
    }

    return { ...frameWithVersions, file };
};


const hydrateSketch = async (sketchData: Omit<Sketch, 'file'>): Promise<Sketch> => {
    const { imageUrl } = sketchData;
    let file: File;
    try {
        if (imageUrl.startsWith('data:')) {
            file = dataUrlToFile(imageUrl, `sketch-${sketchData.id}.png`);
        } else {
            const blob = await fetchCorsImage(imageUrl);
            file = new File([blob], `sketch-${sketchData.id}.png`, { type: blob.type });
        }
    } catch (e) {
        console.error(`Could not create file for sketch image ${sketchData.id}:`, e);
        file = new File([], `failed-sketch-${sketchData.id}.txt`, {type: 'text/plain'});
    }
    return { ...sketchData, file };
};


const initialStorySettings: StorySettings = {
    mode: 'auto',
    prompt: '',
    genre: '',
    ending: '',
};

type DraggingSketchInfo = {
    id: string;
    offset: { x: number; y: number }; // Offset of cursor within the sketch in viewport pixels
} | null;


// --- Sketch Card Component ---
const SketchCard: React.FC<{
    sketch: Sketch;
    isDragging: boolean;
    onContextMenu: (e: React.MouseEvent, sketch: Sketch) => void;
    onDragStart: (e: React.DragEvent, sketch: Sketch) => void;
    onDragEnd: (e: React.DragEvent) => void;
}> = ({ sketch, isDragging, onContextMenu, onDragStart, onDragEnd }) => (
    <div
        className={`absolute group bg-white p-2 pb-6 rounded-sm shadow-lg transition-transform hover:scale-105 hover:z-20 cursor-grab ${isDragging ? 'opacity-40' : ''}`}
        style={{
            left: sketch.position.x,
            top: sketch.position.y,
            width: sketch.size.width,
            height: sketch.size.height,
        }}
        onContextMenu={(e) => onContextMenu(e, sketch)}
        draggable
        onDragStart={(e) => onDragStart(e, sketch)}
        onDragEnd={onDragEnd}
    >
        <div className="w-full h-full bg-black">
             {sketch.imageUrl ? (
                <img src={sketch.imageUrl} alt={sketch.prompt} className="w-full h-full object-contain pointer-events-none" onDragStart={(e) => e.preventDefault()} />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white/50 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
        </div>
        <p className="absolute bottom-1 left-2 right-2 text-center text-xs text-black truncate">{sketch.prompt}</p>
    </div>
);


// --- Add Frame Menu Component ---
interface AddFrameMenuAction {
    label: string;
    icon: string;
    onClick: () => void;
}
interface AddFrameMenuProps {
    targetRect: DOMRect;
    actions: AddFrameMenuAction[];
    onClose: () => void;
}
const AddFrameMenu: React.FC<AddFrameMenuProps> = ({ targetRect, actions, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: targetRect.left, y: targetRect.bottom + 8 });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [onClose]);

    useLayoutEffect(() => {
        if (menuRef.current) {
            const menuRect = menuRef.current.getBoundingClientRect();
            let newX = targetRect.left + (targetRect.width / 2) - (menuRect.width / 2);
            let newY = targetRect.bottom + 8;
            
            if (newX < 8) newX = 8;
            if (newX + menuRect.width > window.innerWidth) newX = window.innerWidth - menuRect.width - 8;
            if (newY + menuRect.height > window.innerHeight) newY = targetRect.top - menuRect.height - 8;

            setPosition({ x: newX, y: newY });
        }
    }, [targetRect]);

    return (
        <div ref={menuRef} style={{ top: position.y, left: position.x }} className="absolute z-[60] w-max">
            <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-[#191C2D] p-1 shadow-lg animate-fade-in">
                {actions.map((action, index) => (
                    <button key={index} onClick={action.onClick} className="flex min-w-[160px] cursor-pointer items-center justify-start overflow-hidden rounded-md h-8 px-2.5 bg-white/10 text-white text-xs font-bold leading-normal tracking-[0.015em] hover:bg-white/20 w-full gap-2 text-left">
                        <span className="material-symbols-outlined text-base w-5 text-center">{action.icon}</span>
                        <span>{action.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};


export default function App() {
    // Project State
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [localFrames, setLocalFrames] = useState<Frame[]>([]);
    const [localAssets, setLocalAssets] = useState<Asset[]>([]);
    const [localSketches, setLocalSketches] = useState<Sketch[]>([]);
    const [localNotes, setLocalNotes] = useState<Note[]>([]);

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
        mode: 'generate' | 'edit' | 'generate-sketch';
        frameToEdit?: Frame;
        insertIndex?: number;
        position?: Position;
    }>({ mode: 'generate' });
    const [adaptingFrame, setAdaptingFrame] = useState<Frame | null>(null);
    const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
    const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig | null>(null);


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
    const [boardContextMenu, setBoardContextMenu] = useState<{ x: number, y: number, boardPosition: Position } | null>(null);
    const [sketchContextMenu, setSketchContextMenu] = useState<{ x: number, y: number, sketch: Sketch } | null>(null);
    const [addFrameMenu, setAddFrameMenu] = useState<{ index: number; rect: DOMRect } | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [draggingSketchInfo, setDraggingSketchInfo] = useState<DraggingSketchInfo>(null);
    
    // Non-blocking loading states
    const [generatingStory, setGeneratingStory] = useState(false);
    const [generatingPromptFrameId, setGeneratingPromptFrameId] = useState<string | null>(null);
    const [generatingVideoState, setGeneratingVideoState] = useState<GeneratingVideoState>(null);

    // Refs
    const boardRef = useRef<HTMLDivElement>(null);

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
                sketches: [],
                notes: [],
                lastModified: 0 // Set a very old timestamp so it doesn't appear as the most recent by default.
            };
            allProjects.unshift(demoProject);
        }
        
        let lastId = projectService.getLastProjectId();
        let projectToLoad = allProjects.find(p => p.id === lastId);

        if (!projectToLoad && allProjects.length > 0) {
            projectToLoad = [...allProjects].sort((a,b) => b.lastModified - a.lastModified)[0];
            lastId = projectToLoad.id;
        }

        if (projectToLoad) {
            setProjects(allProjects);
            setCurrentProjectId(projectToLoad.id);
            projectService.setLastProjectId(projectToLoad.id);
            projectService.saveProjects(allProjects);
        } else {
            console.error("Could not determine a project to load.");
        }
    }, []);

    // Sync and hydrate local state from the current project
    useEffect(() => {
        if (currentProject) {
            const hydrateAllData = async () => {
                const hydratedFrames: Frame[] = await Promise.all((currentProject.frames || []).map(hydrateFrame));
                setLocalFrames(hydratedFrames);
                
                const hydratedSketches: Sketch[] = await Promise.all((currentProject.sketches || []).map(hydrateSketch));
                setLocalSketches(hydratedSketches);

                setLocalNotes(currentProject.notes || []);

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
            setLocalSketches([]);
            setLocalNotes([]);
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

    const updateSketches = useCallback((updater: React.SetStateAction<Sketch[]>) => {
        setLocalSketches(updater);
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
            sketches: [],
            notes: [],
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
        setSelectedAssetIds(new Set());
    
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
        const sketchesToSave = localSketches.map(({ file, ...rest }) => rest);
        const updatedProject = { ...currentProject, frames: framesToSave, assets: assetsToSave, sketches: sketchesToSave, notes: localNotes, lastModified: Date.now() };
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
            sketches: localSketches.map(({ file, ...rest}) => rest),
            notes: localNotes,
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
        setSelectedAssetIds(new Set());
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
            // This service function is not implemented in this step, but the call remains.
            // const videoUrl = await generateVideoFromFrame(frame, updateMessage); 
            // setGeneratedVideoUrl(videoUrl);
            alert("Video generation service call is placeholder.");
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

    // --- Timeline Handlers ---
    const handleDurationChange = useCallback((id: string, newDuration: number) => { updateFrames(prev => prev.map(f => f.id === id ? { ...f, duration: Math.max(0.25, newDuration) } : f)); }, [updateFrames]);
    const handlePromptChange = useCallback((id: string, newPrompt: string) => { updateFrames(prev => prev.map(f => f.id === id ? { ...f, prompt: newPrompt, isTransition: false } : f)); if (editingFrame?.id === id) { setEditingFrame(prev => prev ? { ...prev, prompt: newPrompt } : null); } }, [editingFrame, updateFrames]);
    const handleSavePrompt = (id: string, newPrompt: string) => { handlePromptChange(id, newPrompt); setEditingFrame(null); }
    const handleSaveFrameDetails = useCallback((id: string, newPrompt: string, newDuration: number) => { updateFrames(prev => prev.map(f => f.id === id ? { ...f, prompt: newPrompt, duration: Math.max(0.25, newDuration), isTransition: false } : f)); if (detailedFrame?.id === id) { setDetailedFrame(prev => prev ? { ...prev, prompt: newPrompt, duration: newDuration } : null); } }, [detailedFrame, updateFrames]);
    const handleDeleteFrame = useCallback((id: string) => { updateFrames(prev => prev.filter(f => f.id !== id)); }, [updateFrames]);
    const handleReorderFrame = useCallback((dragIndex: number, dropIndex: number) => { updateFrames(prev => { const c = [...prev]; const [d] = c.splice(dragIndex, 1); const e = dragIndex < dropIndex ? dropIndex - 1 : dropIndex; c.splice(e, 0, d); return c; }); }, [updateFrames]);
    const handleAddFrame = useCallback(async (index: number, type: 'upload' | 'generate') => { if (type === 'upload') { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { try { const b = await fileToBase64(f); const n: Frame = { id: crypto.randomUUID(), imageUrls: [b], activeVersionIndex: 0, prompt: '', duration: 3.0, file: f, aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9' }; updateFrames(p => { const nc = [...p]; nc.splice(index, 0, n); return nc; }); setTimeout(() => { setLocalFrames(c => { const ni = c.findIndex(fr => fr.id === n.id); if (ni > -1 && (ni > 0 || ni < c.length - 1)) { setAdaptingFrame(c[ni]); } return c; }); }, 0); } catch (err) { console.error("Error reading file:", err); alert("Could not load image file."); } } }; i.click(); } else if (type === 'generate') { setAdvancedGenerateModalConfig({ mode: 'generate', insertIndex: index }); setIsAdvancedGenerateModalOpen(true); } }, [updateFrames, isAspectRatioLocked, globalAspectRatio]);
    const handleAddFramesFromAssets = useCallback((assetIds: string[], index: number) => { const a = localAssets.filter(as => assetIds.includes(as.id)); if (a.length === 0) return; const o = assetIds.map(id => a.find(as => as.id === id)).filter((as): as is Asset => !!as); const n: Frame[] = o.map(as => ({ id: crypto.randomUUID(), imageUrls: [as.imageUrl], activeVersionIndex: 0, prompt: '', duration: 3.0, file: as.file, aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9' })); updateFrames(p => { const c = [...p]; c.splice(index, 0, ...n); return c; }); const f = n[0]; if (f) { setTimeout(() => { setLocalFrames(c => { const ni = c.findIndex(fr => fr.id === f.id); if (ni > -1 && (ni > 0 || ni < c.length - n.length)) { setAdaptingFrame(c[ni]); } return c; }); }, 0); } }, [localAssets, updateFrames, isAspectRatioLocked, globalAspectRatio]);
    const handleAddFramesFromFiles = useCallback(async (files: File[], index: number) => { const n = await Promise.all(files.map(async f => ({ id: crypto.randomUUID(), imageUrls: [await fileToBase64(f)], activeVersionIndex: 0, prompt: '', duration: 3.0, file: f, aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9' }))); updateFrames(p => { const c = [...p]; c.splice(index, 0, ...n); return c; }); const fi = n[0]; if (fi) { setTimeout(() => { setLocalFrames(c => { const ni = c.findIndex(fr => fr.id === fi.id); if (ni > -1 && (ni > 0 || ni < c.length - n.length)) { setAdaptingFrame(c[ni]); } return c; }); }, 0); } }, [updateFrames, isAspectRatioLocked, globalAspectRatio]);
    const handleGenerateFrame = async (prompt: string, insertIndex: number) => { alert("Not implemented yet for timeline."); /* Placeholder for timeline-specific generation */ };
    const handleGenerateTransition = useCallback((index: number) => { alert('Generate Transition not implemented in this view.'); }, []);
    
    // --- Asset Library Handlers ---
    const handleAddAssets = useCallback(async (files: File[]) => { const n: Asset[] = await Promise.all(files.map(async f => ({ id: crypto.randomUUID(), imageUrl: await fileToBase64(f), file: f, name: f.name }))); updateAssets(p => [...p, ...n]); }, [updateAssets]);
    const handleDeleteAsset = useCallback((id: string) => { updateAssets(p => p.filter(a => a.id !== id)); setSelectedAssetIds(p => { const n = new Set(p); n.delete(id); return n; }); }, [updateAssets]);
    const handleSelectAllAssets = useCallback(() => { setSelectedAssetIds(new Set(localAssets.map(a => a.id))); }, [localAssets]);
    const handleDeselectAllAssets = useCallback(() => { setSelectedAssetIds(new Set()); }, []);
    const handleCreateStoryFromAssets = async () => { /* Placeholder logic */ alert("Story generation from assets not fully implemented in this step."); };
    const handleSaveStorySettings = (newSettings: StorySettings) => { setStorySettings(newSettings); setIsStorySettingsModalOpen(false); };
    
    // --- Adaptation & Aspect Ratio Handlers ---
    const handleAdaptFrameToStory = useCallback(async (frameId: string, instruction?: string) => { /* Placeholder */ }, [localFrames, updateFrames]);
    const handleGlobalAspectRatioChange = (newRatio: string) => { setGlobalAspectRatio(newRatio); if (isAspectRatioLocked) { updateFrames(prev => prev.map(f => ({ ...f, aspectRatio: newRatio }))); } };
    const handleToggleAspectRatioLock = () => { const n = !isAspectRatioLocked; setIsAspectRatioLocked(n); if (n) { updateFrames(prev => prev.map(f => ({...f, aspectRatio: globalAspectRatio }))); } };
    const handleFrameAspectRatioChange = useCallback((frameId: string, newRatio: string) => { if (!isAspectRatioLocked) { updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, aspectRatio: newRatio } : f)); } }, [isAspectRatioLocked, updateFrames]);
    const handleAdaptFrameAspectRatio = useCallback(async (frameId: string, targetRatio?: string) => { /* Placeholder */ }, [localFrames, updateFrames]);
    const handleAdaptAllFramesAspectRatio = async () => { /* Placeholder */ };

    // --- Context Menu Handlers ---
    const handleContextMenu = (e: React.MouseEvent, frame: Frame) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, frame }); };
    const handleCloseContextMenu = () => setContextMenu(null);
    const handleOpenAddFrameMenu = useCallback((index: number, rect: DOMRect) => { setAddFrameMenu({ index, rect }); }, []);
    const handleCloseAddFrameMenu = useCallback(() => { setAddFrameMenu(null); }, []);
    const handleDuplicateFrame = async (frameId: string) => { const i = localFrames.findIndex(f => f.id === frameId); if (i === -1) return; const d = localFrames[i]; const n: Frame = { ...d, id: crypto.randomUUID() }; updateFrames(p => { const nc = [...p]; nc.splice(i + 1, 0, n); return nc; }); };
    const handleReplaceFrame = (frameId: string) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { try { const b = await fileToBase64(f); updateFrames(p => p.map(fr => { if (fr.id === frameId) { const niu = [b]; return { ...fr, imageUrls: niu, activeVersionIndex: 0, file: f }; } return fr; })); } catch (err) { console.error("Error replacing file:", err); alert("Could not load image file for replacement."); } } }; i.click(); };
    const handleVersionChange = useCallback(async (frameId: string, direction: 'next' | 'prev') => { /* Placeholder */ }, [localFrames, updateFrames]);
    
    // --- Integration Handlers ---
    const handleStartIntegration = useCallback(async (source: File | string, targetFrameId: string) => { const t = localFrames.find(f => f.id === targetFrameId); if (!t) return; let s: Asset | { imageUrl: string; file: File; name: string; }; if (typeof source === 'string') { const a = localAssets.find(as => as.id === source); if (!a) return; s = a; } else { const i = await fileToBase64(source); s = { id: crypto.randomUUID(), imageUrl: i, file: source, name: source.name }; } setIntegrationConfig({ sourceAsset: s, targetFrame: t }); setIsIntegrationModalOpen(true); }, [localFrames, localAssets]);
    const handleStartIntegrationWithEmptySource = (targetFrame: Frame) => { setIntegrationConfig({ targetFrame }); setIsIntegrationModalOpen(true); };
    const handleApplyIntegration = useCallback(async (result: { imageUrl: string, prompt: string }) => { if (!integrationConfig) return; const t = integrationConfig.targetFrame.id; try { const f = dataUrlToFile(result.imageUrl, `integrated-${t}-${Date.now()}.png`); updateFrames(p => p.map(fr => { if (fr.id === t) { const niu = [...fr.imageUrls, result.imageUrl]; return { ...fr, imageUrls: niu, activeVersionIndex: niu.length - 1, file: f, prompt: result.prompt, isTransition: false, isGenerating: false }; } return fr; })); setIsIntegrationModalOpen(false); setIntegrationConfig(null); } catch (err) { console.error("Error applying integration:", err); alert(`Не удалось применить интеграцию: ${err instanceof Error ? err.message : String(err)}`); } }, [integrationConfig, updateFrames]);

    // --- Director's Board Handlers ---
    const handleBoardDoubleClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.board-interactive-item')) return;
        const board = boardRef.current;
        if (!board) return;
        
        const rect = board.getBoundingClientRect();
        const x = (e.clientX - rect.left - transform.x) / transform.scale;
        const y = (e.clientY - rect.top - transform.y) / transform.scale;
        
        setAdvancedGenerateModalConfig({ mode: 'generate-sketch', position: { x, y } });
        setIsAdvancedGenerateModalOpen(true);
    };

    const handleBoardContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setSketchContextMenu(null); // Close sketch menu if open
        if ((e.target as HTMLElement).closest('.board-interactive-item')) return;
        const board = boardRef.current;
        if (!board) return;
        
        const rect = board.getBoundingClientRect();
        const boardX = (e.clientX - rect.left - transform.x) / transform.scale;
        const boardY = (e.clientY - rect.top - transform.y) / transform.scale;
        
        setBoardContextMenu({
            x: e.clientX,
            y: e.clientY,
            boardPosition: { x: boardX, y: boardY }
        });
    };

    const handleGenerateSketch = async (data: { prompt: string, position?: Position, aspectRatio?: string }) => {
        setIsAdvancedGenerateModalOpen(false);
        if (!data.prompt || !data.position || !data.aspectRatio) return;
    
        const placeholderId = crypto.randomUUID();
        const aspectRatio = data.aspectRatio;
        const [w, h] = aspectRatio.split(':').map(Number);
        const placeholderSize = { width: 320, height: (320 * h) / w };
        
        const placeholderSketch: Sketch = {
            id: placeholderId,
            imageUrl: '',
            prompt: 'Генерация наброска...',
            position: data.position,
            size: placeholderSize,
            aspectRatio,
        };
        updateSketches(prev => [...prev, placeholderSketch]);
    
        try {
            const imageUrl = await generateImageFromPrompt(data.prompt, aspectRatio);
            const file = dataUrlToFile(imageUrl, `sketch-${Date.now()}.png`);
    
            const finalSketch: Sketch = {
                id: crypto.randomUUID(),
                imageUrl,
                prompt: data.prompt,
                file,
                position: data.position,
                size: placeholderSize,
                aspectRatio,
            };
    
            updateSketches(prev => prev.map(s => s.id === placeholderId ? finalSketch : s));
        } catch (error) {
            console.error("Error generating sketch:", error);
            alert(`Не удалось создать набросок: ${error instanceof Error ? error.message : String(error)}`);
            updateSketches(prev => prev.filter(s => s.id !== placeholderId));
        }
    };
    
    // --- Pan and Zoom Handlers ---
    const panState = useRef({ isPanning: false, startX: 0, startY: 0, lastX: 0, lastY: 0 });
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.board-interactive-item')) return;
        
        setContextMenu(null);
        setBoardContextMenu(null);
        setSketchContextMenu(null);

        panState.current = { isPanning: true, startX: e.clientX, startY: e.clientY, lastX: transform.x, lastY: transform.y };
        e.currentTarget.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!panState.current.isPanning) return;
        e.preventDefault();
        
        const dx = e.clientX - panState.current.startX;
        const dy = e.clientY - panState.current.startY;
        setTransform(prev => ({ ...prev, x: panState.current.lastX + dx, y: panState.current.lastY + dy }));
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (panState.current.isPanning) {
            panState.current.isPanning = false;
            e.currentTarget.style.cursor = 'grab';
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!boardRef.current) return;
        e.preventDefault();
        
        const scaleFactor = 1.1;
        const newScale = e.deltaY < 0 ? Math.min(8, transform.scale * scaleFactor) : Math.max(0.1, transform.scale / scaleFactor);

        if (Math.abs(newScale - transform.scale) < 0.001) return;
        
        const rect = boardRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
        const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
        
        setTransform({ scale: newScale, x: newX, y: newY });
    };

    const handleResetView = () => {
        setTransform({ scale: 1, x: 0, y: 0 });
    };

    // --- Sketch Drag & Drop (Unified) ---
    const handleSketchDragStart = (e: React.DragEvent, sketch: Sketch) => {
        e.stopPropagation(); // Prevents board panning
        
        const elRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const offsetX = e.clientX - elRect.left;
        const offsetY = e.clientY - elRect.top;
        
        setDraggingSketchInfo({ id: sketch.id, offset: { x: offsetX, y: offsetY } });
        
        e.dataTransfer.setData('application/json;type=sketch-id', sketch.id);
        e.dataTransfer.effectAllowed = 'copyMove';
    
        // --- Create a custom, reasonably-sized drag preview ---
        const preview = document.createElement('img');
        preview.src = sketch.imageUrl;
        // Base the preview size on the sketch size, but cap it.
        const previewWidth = Math.min(sketch.size.width, 160);
        const aspectRatio = sketch.size.width / sketch.size.height;
        const previewHeight = previewWidth / aspectRatio;
        
        preview.style.width = `${previewWidth}px`;
        preview.style.height = `${previewHeight}px`;
        preview.style.position = 'absolute';
        preview.style.top = '-10000px';
        preview.style.left = '-10000px';
        preview.style.objectFit = 'contain';
        preview.style.borderRadius = '4px';
        preview.style.opacity = '0.8';
        preview.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        preview.style.pointerEvents = 'none';
        document.body.appendChild(preview);
        
        // Use this off-screen element as the drag image, centered on the cursor
        e.dataTransfer.setDragImage(preview, previewWidth / 2, previewHeight / 2);
    
        // Clean up the element after the drag operation has started
        setTimeout(() => {
            document.body.removeChild(preview);
        }, 0);
    };

    const handleBoardDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop for both sketches and frames
        
        const isFrame = e.dataTransfer.types.includes('application/json;type=frame-id');

        if (draggingSketchInfo) {
            const boardRect = boardRef.current!.getBoundingClientRect();
            
            // Calculate new top-left of sketch in viewport coordinates
            const newViewportX = e.clientX - draggingSketchInfo.offset.x;
            const newViewportY = e.clientY - draggingSketchInfo.offset.y;

            // Convert viewport coordinates to board coordinates
            const newBoardX = (newViewportX - boardRect.left - transform.x) / transform.scale;
            const newBoardY = (newViewportY - boardRect.top - transform.y) / transform.scale;
            
            // Update sketch position without causing a full re-render on every pixel move (throttling can be added if needed)
            updateSketches(prev => 
                prev.map(s => 
                    s.id === draggingSketchInfo.id 
                    ? { ...s, position: { x: newBoardX, y: newBoardY } } 
                    : s
                )
            );
        } else if (isFrame) {
            e.dataTransfer.dropEffect = 'move';
        }
    };
    
    const handleBoardDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const frameId = e.dataTransfer.getData('application/json;type=frame-id');

        if (frameId) {
            const frame = localFrames.find(f => f.id === frameId);
            if (!frame || !boardRef.current) return;
    
            const boardRect = boardRef.current.getBoundingClientRect();
            const x = (e.clientX - boardRect.left - transform.x) / transform.scale;
            const y = (e.clientY - boardRect.top - transform.y) / transform.scale;

            const aspectRatio = frame.aspectRatio || '16:9';
            const [w, h] = aspectRatio.split(':').map(Number);
            const size = { width: 320, height: (320 * h) / w };
            
            const newSketch: Sketch = {
                id: crypto.randomUUID(),
                imageUrl: frame.imageUrls[frame.activeVersionIndex],
                prompt: frame.prompt,
                file: frame.file,
                position: { x, y },
                size: size,
                aspectRatio: aspectRatio,
            };
            
            updateSketches(prev => [...prev, newSketch]);
            updateFrames(prev => prev.filter(f => f.id !== frameId));
        }
    };

    const handleSketchDragEnd = (e: React.DragEvent) => {
        setDraggingSketchInfo(null);
    };

    const handleSketchContextMenu = (e: React.MouseEvent, sketch: Sketch) => {
        e.preventDefault();
        e.stopPropagation();
        setBoardContextMenu(null);
        setSketchContextMenu({ x: e.clientX, y: e.clientY, sketch });
    };

    const handleDuplicateSketch = (sketchId: string) => {
        const sketch = localSketches.find(s => s.id === sketchId);
        if (!sketch) return;
        const newSketch: Sketch = {
            ...sketch,
            id: crypto.randomUUID(),
            position: { x: sketch.position.x + 20, y: sketch.position.y + 20 },
        };
        updateSketches(prev => [...prev, newSketch]);
    };

    const handleDeleteSketch = (sketchId: string) => {
        updateSketches(prev => prev.filter(s => s.id !== sketchId));
    };

    const handleAddFrameFromSketch = useCallback((sketchId: string, index: number) => {
        const sketch = localSketches.find(s => s.id === sketchId);
        if (!sketch || !sketch.file) return;

        const newFrame: Frame = {
            id: crypto.randomUUID(),
            imageUrls: [sketch.imageUrl],
            activeVersionIndex: 0,
            prompt: sketch.prompt,
            duration: 3.0,
            file: sketch.file,
            aspectRatio: sketch.aspectRatio,
        };
        
        updateFrames(prev => {
            const framesCopy = [...prev];
            framesCopy.splice(index, 0, newFrame);
            return framesCopy;
        });
        updateSketches(prev => prev.filter(s => s.id !== sketchId));

    }, [localSketches, updateFrames, updateSketches]);


    // Construct actions for AddFrameMenu
    const addFrameMenuActions: AddFrameMenuAction[] = [];
    if (addFrameMenu) {
        const closeAndRun = (fn: () => void) => () => {
            fn();
            handleCloseAddFrameMenu();
        };

        addFrameMenuActions.push({ label: 'Загрузить кадр', icon: 'upload', onClick: closeAndRun(() => handleAddFrame(addFrameMenu.index, 'upload')) });
        addFrameMenuActions.push({ label: 'Сгенерировать', icon: 'layers', onClick: closeAndRun(() => handleAddFrame(addFrameMenu.index, 'generate')) });
        
        if (addFrameMenu.index > 0 && addFrameMenu.index < localFrames.length) {
            addFrameMenuActions.push({ label: 'Промт для перехода', icon: 'sync_alt', onClick: closeAndRun(() => handleGenerateTransition(addFrameMenu.index - 1)) });
        }
    }


    return (
        <div className="relative flex h-screen w-full flex-col group/design-root overflow-hidden">
            <Header 
                projectName={currentProject?.name || 'Загрузка...'}
                hasUnsavedChanges={hasUnsavedChanges}
                onNewProject={handleNewProject}
                onSaveProject={handleSaveProject}
                onSaveAsProject={() => setIsSaveModalOpen(true)}
                onLoadProject={() => setIsLoadModalOpen(true)}
                onManageApiKey={handleManageApiKey}
            />
            <main 
                ref={boardRef}
                className="flex-1 flex-col overflow-hidden relative grid-bg-metallic"
                style={{ cursor: panState.current.isPanning ? 'grabbing' : 'grab' }}
                onDoubleClick={handleBoardDoubleClick}
                onContextMenu={handleBoardContextMenu}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp} // End panning if mouse leaves the area
                onWheel={handleWheel}
                onDragOver={handleBoardDragOver}
                onDrop={handleBoardDrop}
            >
                <div 
                    className="absolute top-0 left-0"
                    style={{
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        transformOrigin: '0 0',
                    }}
                >
                     <div className="p-6 board-interactive-item">
                        <Timeline
                            frames={localFrames}
                            totalDuration={totalDuration}
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
                            onAddFramesFromAssets={handleAddFramesFromAssets}
                            onAddFramesFromFiles={handleAddFramesFromFiles}
                            onAddFrameFromSketch={handleAddFrameFromSketch}
                            onDeleteFrame={handleDeleteFrame}
                            onReorderFrame={handleReorderFrame}
                            onAnalyzeStory={() => alert('Analyze Story not implemented in this view.')}
                            onGenerateSinglePrompt={(id) => alert('Generate Prompt not implemented in this view.')}
                            onGenerateVideo={handleGenerateVideo}
                            onEditPrompt={setEditingFrame}
                            onViewImage={setViewingFrameIndex}
                            onOpenDetailView={setDetailedFrame}
                            onContextMenu={handleContextMenu}
                            onVersionChange={handleVersionChange}
                            onStartIntegration={handleStartIntegration}
                            onOpenAddFrameMenu={handleOpenAddFrameMenu}
                        />
                    </div>

                    {localSketches.map(sketch => (
                         <div key={sketch.id} className="board-interactive-item">
                            <SketchCard 
                                sketch={sketch} 
                                isDragging={draggingSketchInfo?.id === sketch.id}
                                onContextMenu={handleSketchContextMenu}
                                onDragStart={(e) => handleSketchDragStart(e, sketch)}
                                onDragEnd={handleSketchDragEnd}
                            />
                         </div>
                    ))}
                </div>
                
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
                        setSelectedAssetIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
                    }}
                    onSelectAllAssets={handleSelectAllAssets}
                    onDeselectAllAssets={handleDeselectAllAssets}
                    onGenerateStory={handleCreateStoryFromAssets}
                    onOpenStorySettings={() => setIsStorySettingsModalOpen(true)}
                    onFrameCountChange={setFrameCount}
                />
            </main>

            <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2">
                <button
                    onClick={handleResetView}
                    className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-[#191C2D]/80 backdrop-blur-md border border-white/10 text-white text-sm font-bold leading-normal tracking-[-0.015em] hover:bg-[#191C2D] transition-colors"
                    aria-label="Сбросить вид"
                    title="Сбросить вид"
                >
                    <span className="material-symbols-outlined text-xl">settings_backup_restore</span>
                </button>
                <button
                    onClick={() => setIsAssetLibraryOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-[#191C2D]/80 backdrop-blur-md border border-white/10 text-white text-sm font-bold leading-normal tracking-[-0.015em] hover:bg-[#191C2D] transition-colors"
                    aria-label="Открыть библиотеку"
                    title="Открыть библиотеку"
                >
                    <span className="material-symbols-outlined text-xl">photo_library</span>
                </button>
            </div>

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
                    onGenerate={advancedGenerateModalConfig.mode === 'generate-sketch' ? handleGenerateSketch : (data) => handleGenerateFrame(data.prompt, advancedGenerateModalConfig.insertIndex ?? localFrames.length)}
                    onApplyEdit={(id, url, p) => { /* Placeholder */ }}
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
            {integrationConfig && (
                <IntegrationModal
                    isOpen={isIntegrationModalOpen}
                    onClose={() => { setIsIntegrationModalOpen(false); setIntegrationConfig(null); }}
                    config={integrationConfig}
                    onIntegrate={handleApplyIntegration}
                />
            )}
            {editingFrame && ( <EditPromptModal frame={editingFrame} onClose={() => setEditingFrame(null)} onSave={handleSavePrompt} /> )}
            {viewingFrameIndex !== null && ( <ImageViewerModal frames={localFrames} startIndex={viewingFrameIndex} onClose={() => setViewingFrameIndex(null)} /> )}
            {detailedFrame && ( <FrameDetailModal frame={detailedFrame} onClose={() => setDetailedFrame(null)} onSave={handleSaveFrameDetails} /> )}
            {isSaveModalOpen && ( <ProjectSaveModal onClose={() => setIsSaveModalOpen(false)} onSave={handleSaveAs} initialName={currentProject?.name} title={currentProject?.id === DEMO_PROJECT_ID ? "Сохранить демо как новый проект" : "Сохранить проект как"} /> )}
            {isLoadModalOpen && ( <ProjectLoadModal projects={projects} currentProjectId={currentProjectId} onClose={() => setIsLoadModalOpen(false)} onLoad={handleLoadProject} onDelete={handleDeleteProject} onNew={handleNewProject} /> )}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={handleCloseContextMenu}
                    actions={[
                        { label: 'Создать видео', icon: 'movie', onClick: () => handleGenerateVideo(contextMenu.frame) },
                        { label: 'Адаптировать к сюжету', icon: 'auto_fix', onClick: () => setAdaptingFrame(contextMenu.frame) },
                        { label: 'Интегрировать ассет', icon: 'add_photo_alternate', onClick: () => handleStartIntegrationWithEmptySource(contextMenu.frame) },
                        { label: 'Редактировать кадр', icon: 'tune', onClick: () => { setAdvancedGenerateModalConfig({ mode: 'edit', frameToEdit: contextMenu.frame }); setIsAdvancedGenerateModalOpen(true); }},
                        { label: 'Дублировать', icon: 'content_copy', onClick: () => handleDuplicateFrame(contextMenu.frame.id) },
                        { label: 'Заменить кадр', icon: 'swap_horiz', onClick: () => handleReplaceFrame(contextMenu.frame.id) },
                    ]}
                />
            )}
             {boardContextMenu && (
                <ContextMenu
                    x={boardContextMenu.x}
                    y={boardContextMenu.y}
                    onClose={() => setBoardContextMenu(null)}
                    actions={[
                        { 
                            label: 'Создать набросок здесь', 
                            icon: 'add_photo_alternate', 
                            onClick: () => {
                                setAdvancedGenerateModalConfig({ 
                                    mode: 'generate-sketch', 
                                    position: boardContextMenu.boardPosition 
                                });
                                setIsAdvancedGenerateModalOpen(true);
                            } 
                        },
                    ]}
                />
            )}
             {sketchContextMenu && (
                <ContextMenu
                    x={sketchContextMenu.x}
                    y={sketchContextMenu.y}
                    onClose={() => setSketchContextMenu(null)}
                    actions={[
                        { label: 'Дублировать', icon: 'content_copy', onClick: () => handleDuplicateSketch(sketchContextMenu.sketch.id) },
                        { label: 'Удалить', icon: 'delete', isDestructive: true, onClick: () => handleDeleteSketch(sketchContextMenu.sketch.id) },
                    ]}
                />
            )}
            {addFrameMenu && (
                <AddFrameMenu
                    targetRect={addFrameMenu.rect}
                    actions={addFrameMenuActions}
                    onClose={handleCloseAddFrameMenu}
                />
            )}
        </div>
    );
}