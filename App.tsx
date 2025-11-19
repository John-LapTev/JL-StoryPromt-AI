
import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import type { Frame, Project, Asset, StorySettings, IntegrationConfig, Sketch, Note, Position, Size, AppSettings, ActorDossier } from './types';
import { initialFrames, initialAssets } from './constants';
import { projectService } from './services/projectService';
import { settingsService } from './services/settingsService';
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
import { LoadingModal } from './components/LoadingModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { SettingsModal } from './components/SettingsModal';
import { SimpleImageViewerModal } from './components/SimpleImageViewerModal';
import { generateImageFromPrompt, adaptImageToStory, adaptImageAspectRatio, createStoryFromAssets, analyzeStory, generateSinglePrompt, generateImageInContext, editImage } from './services/geminiService';
import { fileToBase64, dataUrlToFile, fetchCorsImage, getImageDimensions, calculateFileHash } from './utils/fileUtils';
import { StoryGenerationUpdate } from './services/geminiService';

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
    let sourceHash = frameData.sourceHash;

    try {
        if (activeImageUrl.startsWith('data:')) {
            file = dataUrlToFile(activeImageUrl, `story-frame-${frameData.id}.png`);
        } else {
            const blob = await fetchCorsImage(activeImageUrl);
            file = new File([blob], `story-frame-${frameData.id}.png`, { type: blob.type });
        }
        // Calculate hash if missing (e.g. loaded from old project or hydration needs refresh)
        if (!sourceHash) {
            sourceHash = await calculateFileHash(file);
        }
    } catch (e) {
        console.error(`Could not create file for frame image ${frameData.id}:`, e);
        // Create an empty placeholder file on failure
        file = new File([], `failed-frame-${frameData.id}.txt`, {type: 'text/plain'});
    }

    return { ...frameWithVersions, file, sourceHash };
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

type DraggingInfo = {
    type: 'note-move' | 'note-resize';
    id: string;
    initialMousePos: { x: number; y: number };
    initialPosition: Position;
    initialSize?: Size;
} | null;


// --- Sketch Card Component ---
const SketchCard: React.FC<{
    sketch: Sketch;
    isDragging: boolean;
    onContextMenu: (e: React.MouseEvent, sketch: Sketch) => void;
    onDragStart: (e: React.DragEvent, sketch: Sketch) => void;
    onDragEnd: () => void;
}> = ({ sketch, isDragging, onContextMenu, onDragStart, onDragEnd }) => (
    <div
        className={`absolute group bg-white p-2 pb-6 rounded-sm shadow-lg transition-all ${isDragging ? 'opacity-50 grayscale z-50' : 'hover:scale-[1.025] hover:z-20'} cursor-grab active:cursor-grabbing`}
        style={{
            left: sketch.position.x,
            top: sketch.position.y,
            width: sketch.size.width,
            height: sketch.size.height,
        }}
        draggable={true}
        onDragStart={(e) => onDragStart(e, sketch)}
        onDragEnd={onDragEnd}
        onContextMenu={(e) => onContextMenu(e, sketch)}
        onMouseDown={(e) => e.stopPropagation()} // Prevent board pan
    >
        <div className="w-full h-full bg-black pointer-events-none">
            {sketch.imageUrl ? (
                <div
                    className="w-full h-full bg-contain bg-no-repeat bg-center"
                    style={{ backgroundImage: `url(${sketch.imageUrl})` }}
                    role="img"
                    aria-label={sketch.prompt}
                ></div>
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white/50 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
        </div>
        <p className="absolute bottom-1 left-2 right-2 text-center text-xs text-black truncate pointer-events-none">{sketch.prompt}</p>
    </div>
);


// --- Note Card Component ---
const NoteCard: React.FC<{
    note: Note;
    onUpdateText: (id: string, newText: string) => void;
    onMouseDown: (e: React.MouseEvent, note: Note) => void;
    onResizeMouseDown: (e: React.MouseEvent, note: Note) => void;
    onContextMenu: (e: React.MouseEvent, note: Note) => void;
}> = ({ note, onUpdateText, onMouseDown, onResizeMouseDown, onContextMenu }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(note.text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    useEffect(() => {
        setText(note.text);
    }, [note.text]);

    const handleBlur = () => {
        setIsEditing(false);
        if (text.trim() !== note.text) {
            onUpdateText(note.id, text.trim());
        }
    };
    
    return (
        <div
            className="absolute group bg-yellow-900/30 border border-yellow-700/50 p-3 rounded-md shadow-lg flex flex-col cursor-grab board-interactive-item"
            style={{
                left: note.position.x,
                top: note.position.y,
                width: note.size.width,
                height: note.size.height,
            }}
            onMouseDown={(e) => onMouseDown(e, note)}
            onDoubleClick={() => setIsEditing(true)}
            onContextMenu={(e) => onContextMenu(e, note)}
        >
            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full h-full bg-transparent text-yellow-200/90 text-sm resize-none focus:outline-none"
                />
            ) : (
                <p className="w-full h-full text-yellow-200/90 text-sm whitespace-pre-wrap break-words overflow-hidden pointer-events-none">
                    {note.text}
                </p>
            )}
            <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group-hover:bg-yellow-500 rounded-br-md transition-colors"
                onMouseDown={(e) => onResizeMouseDown(e, note)}
            />
        </div>
    );
};


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

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

// Helper to convert Sketch to Frame for tools
const sketchToFrame = (sketch: Sketch): Frame => ({
    id: sketch.id,
    imageUrls: [sketch.imageUrl],
    activeVersionIndex: 0,
    prompt: sketch.prompt,
    duration: 3.0,
    file: sketch.file,
    aspectRatio: sketch.aspectRatio,
    isGenerating: false,
});

export default function App() {
    // Project State
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [localFrames, setLocalFrames] = useState<Frame[]>([]);
    const [localAssets, setLocalAssets] = useState<Asset[]>([]);
    const [localSketches, setLocalSketches] = useState<Sketch[]>([]);
    const [localNotes, setLocalNotes] = useState<Note[]>([]);
    const [localDossiers, setLocalDossiers] = useState<ActorDossier[]>([]);


    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [storySettings, setStorySettings] = useState<StorySettings>(initialStorySettings);
    const [frameCount, setFrameCount] = useState(10);
    const [globalAspectRatio, setGlobalAspectRatio] = useState('16:9');
    const [isAspectRatioLocked, setIsAspectRatioLocked] = useState(true);
    const [appSettings, setAppSettings] = useState<AppSettings>(settingsService.getSettings());


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
    const [confirmationState, setConfirmationState] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

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
    const [noteContextMenu, setNoteContextMenu] = useState<{ x: number, y: number, note: Note } | null>(null);
    const [addFrameMenu, setAddFrameMenu] = useState<{ index: number; rect: DOMRect } | null>(null);
    const [draggingInfo, setDraggingInfo] = useState<DraggingInfo>(null);
    const [sketchDropTargetIndex, setSketchDropTargetIndex] = useState<number | null>(null);
    const [isAssetLibraryDropTarget, setIsAssetLibraryDropTarget] = useState(false);
    const [draggingSketchId, setDraggingSketchId] = useState<string | null>(null);
    
    // Non-blocking loading states
    const [generatingStory, setGeneratingStory] = useState(false);
    const [generatingPromptFrameId, setGeneratingPromptFrameId] = useState<string | null>(null);
    const [generatingVideoState, setGeneratingVideoState] = useState<GeneratingVideoState>(null);
    const [isAnalyzingStory, setIsAnalyzingStory] = useState(false);

    // Refs
    const boardRef = useRef<HTMLDivElement>(null);
    const timelineDropZoneRefs = useRef(new Map<number, HTMLElement>());
    const assetLibraryRef = useRef<HTMLDivElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 }); // Stores offset relative to the sketch card (unscaled)

    // Derived state
    const currentProject = useMemo(() => projects.find(p => p.id === currentProjectId), [projects, currentProjectId]);

    // Initial project and settings loading
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
        
        setAppSettings(settingsService.getSettings());
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
                setLocalDossiers(currentProject.dossiers || []);

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
            setLocalDossiers([]);
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
    
    const updateNotes = useCallback((updater: React.SetStateAction<Note[]>) => {
        setLocalNotes(updater);
        setHasUnsavedChanges(true);
    }, []);

    const updateDossiers = useCallback((updater: React.SetStateAction<ActorDossier[]>) => {
        setLocalDossiers(updater);
        setHasUnsavedChanges(true);
    }, []);
    
    const handleSaveSettings = (newSettings: AppSettings) => {
        setAppSettings(newSettings);
        settingsService.saveSettings(newSettings);
    };

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
    
    const executeNewProject = useCallback(() => {
        const newProject: Project = {
            id: crypto.randomUUID(),
            name: 'Новый проект',
            frames: [],
            assets: [],
            sketches: [],
            notes: [],
            dossiers: [],
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
        setIsLoadModalOpen(false); // Close load modal if opened from there
        setConfirmationState(null); // Close confirmation modal
    }, []);

    const handleNewProject = useCallback(() => {
        if (hasUnsavedChanges) {
            setConfirmationState({
                title: 'Создать новый проект?',
                message: 'Ваш текущий проект имеет несохраненные изменения. Все изменения будут утеряны.',
                onConfirm: executeNewProject,
            });
        } else {
            executeNewProject();
        }
    }, [hasUnsavedChanges, executeNewProject]);

    const handleSaveProject = () => {
        if (!currentProject) return;
        if (currentProject.id === DEMO_PROJECT_ID || hasUnsavedChanges === false && projects.some(p => p.id === currentProject.id)) {
            setIsSaveModalOpen(true);
            return;
        }

        const framesToSave = localFrames.map(({ file, ...rest }) => ({ ...rest, isGenerating: undefined, generatingMessage: undefined }));
        const assetsToSave = localAssets.map(({ file, ...rest }) => rest);
        const sketchesToSave = localSketches.map(({ file, ...rest }) => rest);
        const updatedProject = { 
            ...currentProject, 
            frames: framesToSave, 
            assets: assetsToSave, 
            sketches: sketchesToSave, 
            notes: localNotes, 
            dossiers: localDossiers,
            lastModified: Date.now() 
        };
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
            dossiers: localDossiers,
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

    const executeLoadProject = useCallback((id: string) => {
        setCurrentProjectId(id);
        projectService.setLastProjectId(id);
        setHasUnsavedChanges(false);
        setSelectedAssetIds(new Set());
        setIsLoadModalOpen(false);
        setConfirmationState(null);
    }, []);

    const handleLoadProject = useCallback((id: string) => {
        if (hasUnsavedChanges) {
            setConfirmationState({
                title: 'Загрузить проект?',
                message: 'Ваш текущий проект имеет несохраненные изменения. Все изменения будут утеряны.',
                onConfirm: () => executeLoadProject(id),
            });
        } else {
            executeLoadProject(id);
        }
    }, [hasUnsavedChanges, executeLoadProject]);

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
    const handleAddFrame = useCallback(async (index: number, type: 'upload' | 'generate') => { if (type === 'upload') { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { try { const b = await fileToBase64(f); const hash = await calculateFileHash(f); const n: Frame = { id: crypto.randomUUID(), imageUrls: [b], activeVersionIndex: 0, prompt: '', duration: 3.0, file: f, aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9', sourceHash: hash }; updateFrames(p => { const nc = [...p]; nc.splice(index, 0, n); return nc; }); setTimeout(() => { setLocalFrames(c => { const ni = c.findIndex(fr => fr.id === n.id); if (ni > -1 && (ni > 0 || ni < c.length - 1)) { setAdaptingFrame(c[ni]); } return c; }); }, 0); } catch (err) { console.error("Error reading file:", err); alert("Could not load image file."); } } }; i.click(); } else if (type === 'generate') { setAdvancedGenerateModalConfig({ mode: 'generate', insertIndex: index }); setIsAdvancedGenerateModalOpen(true); } }, [updateFrames, isAspectRatioLocked, globalAspectRatio]);
    const handleAddFramesFromAssets = useCallback((assetIds: string[], index: number) => { const a = localAssets.filter(as => assetIds.includes(as.id)); if (a.length === 0) return; const o = assetIds.map(id => a.find(as => as.id === id)).filter((as): as is Asset => !!as); const nPromise = o.map(async as => { const hash = await calculateFileHash(as.file); return { id: crypto.randomUUID(), imageUrls: [as.imageUrl], activeVersionIndex: 0, prompt: '', duration: 3.0, file: as.file, aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9', sourceHash: hash }; }); Promise.all(nPromise).then(n => { updateFrames(p => { const c = [...p]; c.splice(index, 0, ...n); return c; }); const f = n[0]; if (f) { setTimeout(() => { setLocalFrames(c => { const ni = c.findIndex(fr => fr.id === f.id); if (ni > -1 && (ni > 0 || ni < c.length - n.length)) { setAdaptingFrame(c[ni]); } return c; }); }, 0); } }); }, [localAssets, updateFrames, isAspectRatioLocked, globalAspectRatio]);
    const handleAddFramesFromFiles = useCallback(async (files: File[], index: number) => { const n = await Promise.all(files.map(async f => { const hash = await calculateFileHash(f); return { id: crypto.randomUUID(), imageUrls: [await fileToBase64(f)], activeVersionIndex: 0, prompt: '', duration: 3.0, file: f, aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9', sourceHash: hash } })); updateFrames(p => { const c = [...p]; c.splice(index, 0, ...n); return c; }); const fi = n[0]; if (fi) { setTimeout(() => { setLocalFrames(c => { const ni = c.findIndex(fr => fr.id === fi.id); if (ni > -1 && (ni > 0 || ni < c.length - n.length)) { setAdaptingFrame(c[ni]); } return c; }); }, 0); } }, [updateFrames, isAspectRatioLocked, globalAspectRatio]);
    
    const handleGenerateFrame = async (prompt: string, insertIndex: number) => {
        setIsAdvancedGenerateModalOpen(false);
    
        const placeholderId = crypto.randomUUID();
        const placeholderFrame: Frame = {
            id: placeholderId,
            imageUrls: [],
            activeVersionIndex: 0,
            prompt: prompt,
            duration: 3.0,
            isGenerating: true,
            generatingMessage: 'Генерация кадра...',
            aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9',
        };
    
        updateFrames(prev => {
            const framesCopy = [...prev];
            framesCopy.splice(insertIndex, 0, placeholderFrame);
            return framesCopy;
        });
    
        try {
            const leftContextFrame = insertIndex > 0 ? localFrames[insertIndex - 1] : null;
            const rightContextFrame = localFrames[insertIndex] || null;
    
            const { imageUrl, prompt: newPrompt } = await generateImageInContext(
                prompt,
                leftContextFrame,
                rightContextFrame
            );
            
            const newFile = dataUrlToFile(imageUrl, `generated-frame-${Date.now()}.png`);
            const hash = await calculateFileHash(newFile);

            updateFrames(prev => prev.map(f => {
                if (f.id === placeholderId) {
                    return {
                        ...f,
                        imageUrls: [imageUrl],
                        activeVersionIndex: 0,
                        prompt: newPrompt,
                        file: newFile,
                        isGenerating: false,
                        generatingMessage: undefined,
                        sourceHash: hash
                    };
                }
                return f;
            }));
    
        } catch (error) {
            console.error("Error generating frame:", error);
            alert(`Не удалось создать кадр: ${error instanceof Error ? error.message : String(error)}`);
            updateFrames(prev => prev.map(f => {
                if (f.id === placeholderId) {
                    return { ...f, isGenerating: false, generatingMessage: 'Ошибка генерации' };
                }
                return f;
            }));
        }
    };

    const handleApplyEdit = useCallback(async (targetId: string, newImageUrl: string, newPrompt: string) => {
        const newFile = dataUrlToFile(newImageUrl, `edited-${targetId}-${Date.now()}.png`);
        const hash = await calculateFileHash(newFile);

        // Check if it's a sketch
        const sketchIndex = localSketches.findIndex(s => s.id === targetId);
        if (sketchIndex !== -1) {
            updateSketches(prev => prev.map(s => {
                if (s.id === targetId) {
                    return {
                        ...s,
                        imageUrl: newImageUrl,
                        file: newFile,
                        prompt: newPrompt,
                    };
                }
                return s;
            }));
            setIsAdvancedGenerateModalOpen(false);
            return;
        }

        // Check if it's a frame
        const frameIndex = localFrames.findIndex(f => f.id === targetId);
        if (frameIndex !== -1) {
             updateFrames(prev => prev.map(f => {
                if (f.id === targetId) {
                    const newImageUrls = [...f.imageUrls, newImageUrl];
                    return {
                        ...f,
                        imageUrls: newImageUrls,
                        activeVersionIndex: newImageUrls.length - 1,
                        file: newFile,
                        prompt: newPrompt,
                        isTransition: false,
                        sourceHash: hash
                    };
                }
                return f;
            }));
            setIsAdvancedGenerateModalOpen(false);
            return;
        }

        console.warn("Target ID not found in frames or sketches for edit apply.");
    }, [localSketches, localFrames, updateSketches, updateFrames]);
    
    const handleGenerateTransition = useCallback((index: number) => { alert('Generate Transition not implemented in this view.'); }, []);
    
    // --- AI-powered Prompt Generation ---
    const handleAnalyzeStory = useCallback(async () => {
        if (localFrames.length < 2) {
            alert("Нужно как минимум 2 кадра для анализа сюжета.");
            return;
        }
        setIsAnalyzingStory(true);
        try {
            const newPrompts = await analyzeStory(localFrames);
            if (newPrompts.length === localFrames.length) {
                updateFrames(prev => prev.map((frame, index) => ({
                    ...frame,
                    prompt: newPrompts[index],
                    isTransition: false,
                })));
            } else {
                throw new Error("Количество сгенерированных промтов не совпадает с количеством кадров.");
            }
        } catch (error) {
            console.error("Failed to analyze story:", error);
            alert(`Ошибка при анализе сюжета: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsAnalyzingStory(false);
        }
    }, [localFrames, updateFrames]);

    const handleGenerateSinglePrompt = useCallback(async (frameId: string) => {
        const frame = localFrames.find(f => f.id === frameId);
        if (!frame) return;

        setGeneratingPromptFrameId(frameId);
        try {
            const newPrompt = await generateSinglePrompt(frame, localFrames);
            updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, prompt: newPrompt, isTransition: false } : f));
        } catch (error) {
            console.error("Failed to generate single prompt:", error);
            alert(`Ошибка при генерации промта: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setGeneratingPromptFrameId(null);
        }
    }, [localFrames, updateFrames]);

    // --- Asset Library Handlers ---
    const handleAddAssets = useCallback(async (files: File[]) => { const n: Asset[] = await Promise.all(files.map(async f => ({ id: crypto.randomUUID(), imageUrl: await fileToBase64(f), file: f, name: f.name }))); updateAssets(p => [...p, ...n]); }, [updateAssets]);
    const handleDeleteAsset = useCallback((id: string) => { updateAssets(p => p.filter(a => a.id !== id)); setSelectedAssetIds(p => { const n = new Set(p); n.delete(id); return n; }); }, [updateAssets]);
    const handleSelectAllAssets = useCallback(() => { setSelectedAssetIds(new Set(localAssets.map(a => a.id))); }, [localAssets]);
    const handleDeselectAllAssets = useCallback(() => { setSelectedAssetIds(new Set()); }, []);
    const handleCreateStoryFromAssets = async () => {
        const assetsToUse = selectedAssetIds.size > 0
            ? localAssets.filter(asset => selectedAssetIds.has(asset.id))
            : localAssets;
    
        if (assetsToUse.length === 0) {
            alert("Пожалуйста, добавьте или выберите ассеты для создания сюжета.");
            return;
        }
    
        setGeneratingStory(true);
        setIsAssetLibraryOpen(false);
    
        // 1. Create and add placeholder frames instantly for non-blocking UX
        const placeholderFrames: Frame[] = Array.from({ length: frameCount }, (_, i) => ({
            id: crypto.randomUUID(),
            imageUrls: [],
            activeVersionIndex: 0,
            prompt: '',
            duration: 3.0,
            isGenerating: true,
            generatingMessage: `Ожидание генерации...`,
            aspectRatio: isAspectRatioLocked ? globalAspectRatio : '16:9',
        }));
    
        const placeholderIds = placeholderFrames.map(f => f.id);
        updateFrames(prev => [...prev, ...placeholderFrames]);
    
        try {
            // 2. Start the async generation process
            const storyGenerator = createStoryFromAssets(assetsToUse, storySettings, frameCount);
    
            for await (const update of storyGenerator) {
                // FIX: Check update type before accessing properties that are not on all union members.
                if (update.type === 'progress' || update.type === 'frame') {
                    const targetId = placeholderIds[update.index];
                    if (!targetId) continue;
    
                    if (update.type === 'progress') {
                        // Update the message on the specific placeholder
                        updateFrames(prev => prev.map(f => f.id === targetId ? { ...f, generatingMessage: update.message } : f));
                    } else if (update.type === 'frame') {
                        // When a frame is ready, replace the placeholder with the real data
                        const newFile = dataUrlToFile(update.frame.imageUrls[0], `story-frame-${update.frame.id}.png`);
                        const hash = await calculateFileHash(newFile);
                        const finalFrame: Frame = {
                            ...update.frame,
                            file: newFile,
                            isGenerating: false,
                            generatingMessage: undefined,
                            aspectRatio: isAspectRatioLocked ? globalAspectRatio : (update.frame.aspectRatio || '16:9'),
                            sourceHash: hash
                        };
                        updateFrames(prev => prev.map(f => f.id === targetId ? finalFrame : f));
                    }
                }
            }
    
            // Optional: Clean up any placeholders that didn't receive a frame
             updateFrames(prev => prev.map(f => {
                if (placeholderIds.includes(f.id) && f.isGenerating) {
                    return { ...f, isGenerating: false, generatingMessage: "Ошибка генерации" };
                }
                return f;
            }));
    
        } catch (error) {
            console.error("Story generation failed:", error);
            alert(`Ошибка при создании сюжета: ${error instanceof Error ? error.message : String(error)}`);
            // Mark all remaining placeholders as failed
            updateFrames(prev => prev.map(f => {
                if (placeholderIds.includes(f.id) && f.isGenerating) {
                    return { ...f, isGenerating: false, generatingMessage: "Ошибка" };
                }
                return f;
            }));
        } finally {
            setGeneratingStory(false);
        }
    };
    const handleSaveStorySettings = (newSettings: StorySettings) => { setStorySettings(newSettings); setIsStorySettingsModalOpen(false); };
    
    // --- Adaptation & Aspect Ratio Handlers ---
    const handleAdaptFrameToStory = useCallback(async (targetId: string, instruction?: string) => {
        // Check if it's a frame
        const frameToAdapt = localFrames.find(f => f.id === targetId);
        
        // Check if it's a sketch
        const sketchToAdapt = localSketches.find(s => s.id === targetId);

        if (!frameToAdapt && !sketchToAdapt) {
            alert("Не удалось найти объект для адаптации.");
            return;
        }

        if (frameToAdapt) {
             updateFrames(prev => prev.map(f => f.id === targetId ? { ...f, isGenerating: true, generatingMessage: 'Поиск в картотеке...' } : f));

            try {
                // --- IDENTITY CHECK LOGIC ---
                let knownCharacterRef: { originalUrl: string, adaptedUrl: string, characterDescription: string } | undefined = undefined;
                let fileHash = frameToAdapt.sourceHash || '';

                if (frameToAdapt.file && !fileHash) {
                     fileHash = await calculateFileHash(frameToAdapt.file);
                }
                
                if (fileHash) {
                     const dossier = localDossiers.find(d => d.sourceHash === fileHash);
                     if (dossier) {
                        console.log("Dossier found for this character!", dossier);
                        knownCharacterRef = {
                            originalUrl: '', // Not needed for strict ref, dossier hash is enough
                            adaptedUrl: dossier.referenceImageUrl,
                            characterDescription: dossier.characterDescription,
                        };
                        updateFrames(prev => prev.map(f => f.id === targetId ? { ...f, generatingMessage: `Персонаж опознан: ${dossier.characterDescription}. Адаптация...` } : f));
                     } else {
                        updateFrames(prev => prev.map(f => f.id === targetId ? { ...f, generatingMessage: 'Новый персонаж. Адаптация...' } : f));
                     }
                }

                // Pass ALL frames to the service to understand the full story context
                // Pass the dossier reference if found
                const { imageUrl: newImageUrl, prompt: newPrompt } = await adaptImageToStory(
                    frameToAdapt,
                    localFrames,
                    instruction,
                    knownCharacterRef
                );

                const newFile = dataUrlToFile(newImageUrl, `adapted-${targetId}-${Date.now()}.png`);
                const newHash = await calculateFileHash(newFile);

                updateFrames(prev => prev.map(f => {
                    if (f.id === targetId) {
                        const newImageUrls = [...f.imageUrls, newImageUrl];
                        return {
                            ...f,
                            imageUrls: newImageUrls,
                            activeVersionIndex: newImageUrls.length - 1,
                            prompt: newPrompt,
                            file: newFile,
                            isGenerating: false,
                            generatingMessage: undefined,
                            sourceHash: newHash
                        };
                    }
                    return f;
                }));

                // --- DOSSIER UPDATE ---
                if (fileHash) {
                    const newDescriptionMatch = newPrompt.match(/^(.*?)[.,]/); // Simple extraction or use full prompt
                    const newDescription = newDescriptionMatch ? newDescriptionMatch[0] : "Character";

                    const newDossier: ActorDossier = {
                        sourceHash: fileHash,
                        characterDescription: newDescription,
                        referenceImageUrl: newImageUrl,
                        lastUsed: Date.now(),
                    };
                    
                    // Update or Add Dossier
                    updateDossiers(prev => {
                        const existingIdx = prev.findIndex(d => d.sourceHash === fileHash);
                        if (existingIdx >= 0) {
                             // Optionally update description if it's better, or keep old one.
                             // For now, we keep the old reference to ensure stability, OR update if we want evolution.
                             // Let's update timestamp.
                             const updated = [...prev];
                             updated[existingIdx] = { ...updated[existingIdx], lastUsed: Date.now() };
                             return updated;
                        } else {
                            return [...prev, newDossier];
                        }
                    });
                }

            } catch (error) {
                console.error("Failed to adapt frame to story:", error);
                alert(`Ошибка при адаптации кадра: ${error instanceof Error ? error.message : String(error)}`);
                updateFrames(prev => prev.map(f => f.id === targetId ? { ...f, isGenerating: false, generatingMessage: undefined } : f));
            }
        } else if (sketchToAdapt) {
            // For sketch adaptation, we don't have linear context (neighbors).
            // We treat it as "style transfer" or just manual instruction application on the sketch itself.
             try {
                 // Temporarily convert sketch to frame-like object for the service
                 const tempFrame = sketchToFrame(sketchToAdapt);
                 
                 // For sketches, we pass an empty array as context since they are not on the timeline yet.
                 const { imageUrl: newImageUrl, prompt: newPrompt } = await adaptImageToStory(
                    tempFrame,
                    [], 
                    instruction || "Улучшить качество и стиль"
                );

                const newFile = dataUrlToFile(newImageUrl, `adapted-sketch-${targetId}-${Date.now()}.png`);
                
                updateSketches(prev => prev.map(s => {
                    if (s.id === targetId) {
                         return {
                            ...s,
                            imageUrl: newImageUrl,
                            file: newFile,
                            prompt: newPrompt,
                        };
                    }
                    return s;
                }));

            } catch (error) {
                console.error("Failed to adapt sketch:", error);
                 alert(`Ошибка при адаптации наброска: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }, [localFrames, localSketches, updateFrames, updateSketches, localDossiers, updateDossiers]);

    const handleGlobalAspectRatioChange = (newRatio: string) => { setGlobalAspectRatio(newRatio); if (isAspectRatioLocked) { updateFrames(prev => prev.map(f => ({ ...f, aspectRatio: newRatio }))); } };
    const handleToggleAspectRatioLock = () => { const n = !isAspectRatioLocked; setIsAspectRatioLocked(n); if (n) { updateFrames(prev => prev.map(f => ({...f, aspectRatio: globalAspectRatio }))); } };
    const handleFrameAspectRatioChange = useCallback((frameId: string, newRatio: string) => { if (!isAspectRatioLocked) { updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, aspectRatio: newRatio } : f)); } }, [isAspectRatioLocked, updateFrames]);
    
    const handleAdaptFrameAspectRatio = useCallback(async (frameId: string) => {
        const frameToAdapt = localFrames.find(f => f.id === frameId);
        if (!frameToAdapt || !frameToAdapt.aspectRatio) {
            alert("Не удалось найти кадр или для него не задано соотношение сторон.");
            return;
        }
    
        updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, isGenerating: true, generatingMessage: `Адаптация к ${frameToAdapt.aspectRatio}...` } : f));
    
        try {
            const { imageUrl: newImageUrl, prompt: newPrompt } = await adaptImageAspectRatio(
                frameToAdapt,
                frameToAdapt.aspectRatio
            );
    
            const newFile = dataUrlToFile(newImageUrl, `adapted-ar-${frameId}-${Date.now()}.png`);
            const hash = await calculateFileHash(newFile);
    
            updateFrames(prev => prev.map(f => {
                if (f.id === frameId) {
                    const newImageUrls = [...f.imageUrls, newImageUrl];
                    return {
                        ...f,
                        imageUrls: newImageUrls,
                        activeVersionIndex: newImageUrls.length - 1,
                        prompt: newPrompt,
                        file: newFile,
                        isGenerating: false,
                        generatingMessage: undefined,
                        sourceHash: hash
                    };
                }
                return f;
            }));
    
        } catch (error) {
            console.error("Failed to adapt frame aspect ratio:", error);
            alert(`Ошибка при адаптации соотношения сторон: ${error instanceof Error ? error.message : String(error)}`);
            updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, isGenerating: false, generatingMessage: undefined } : f));
        }
    }, [localFrames, updateFrames]);

    const handleAdaptAllFramesAspectRatio = async () => {
        if (!window.confirm(`Вы уверены, что хотите адаптировать все ${localFrames.length} кадров к соотношению сторон ${globalAspectRatio}? Это может занять некоторое время и использует ресурсы API.`)) {
            return;
        }
    
        // Set loading state for all frames
        updateFrames(prev => prev.map(f => ({
            ...f,
            isGenerating: true,
            generatingMessage: `Ожидание адаптации к ${globalAspectRatio}...`
        })));
    
        // Process frames sequentially to avoid overwhelming the API and to show progress
        for (let i = 0; i < localFrames.length; i++) {
            const frameId = localFrames[i].id;
            const frameToAdapt = localFrames.find(f => f.id === frameId); // Find the latest version
    
            if (!frameToAdapt) continue;
    
            updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, generatingMessage: `Адаптация к ${globalAspectRatio}...` } : f));
    
            try {
                const { imageUrl: newImageUrl, prompt: newPrompt } = await adaptImageAspectRatio(
                    frameToAdapt,
                    globalAspectRatio
                );
    
                const newFile = dataUrlToFile(newImageUrl, `adapted-ar-all-${frameId}-${Date.now()}.png`);
                const hash = await calculateFileHash(newFile);
    
                updateFrames(prev => prev.map(f => {
                    if (f.id === frameId) {
                        const newImageUrls = [...f.imageUrls, newImageUrl];
                        return {
                            ...f,
                            imageUrls: newImageUrls,
                            activeVersionIndex: newImageUrls.length - 1,
                            prompt: newPrompt,
                            file: newFile,
                            isGenerating: false,
                            generatingMessage: undefined,
                            aspectRatio: globalAspectRatio,
                            sourceHash: hash
                        };
                    }
                    return f;
                }));
            } catch (error) {
                console.error(`Failed to adapt frame ${frameId}:`, error);
                // Mark this specific frame as failed but continue with others
                updateFrames(prev => prev.map(f => f.id === frameId ? { ...f, isGenerating: false, generatingMessage: 'Ошибка адаптации' } : f));
            }
        }
    };

    // --- Context Menu Handlers ---
    const handleContextMenu = (e: React.MouseEvent, frame: Frame) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, frame }); };
    const handleCloseContextMenu = () => setContextMenu(null);
    const handleOpenAddFrameMenu = useCallback((index: number, rect: DOMRect) => { setAddFrameMenu({ index, rect }); }, []);
    const handleCloseAddFrameMenu = useCallback(() => { setAddFrameMenu(null); }, []);
    const handleDuplicateFrame = async (frameId: string) => { const i = localFrames.findIndex(f => f.id === frameId); if (i === -1) return; const d = localFrames[i]; const n: Frame = { ...d, id: crypto.randomUUID() }; updateFrames(p => { const nc = [...p]; nc.splice(i + 1, 0, n); return nc; }); };
    const handleReplaceFrame = (frameId: string) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { try { const b = await fileToBase64(f); const hash = await calculateFileHash(f); updateFrames(p => p.map(fr => { if (fr.id === frameId) { const niu = [b]; return { ...fr, imageUrls: niu, activeVersionIndex: 0, file: f, sourceHash: hash }; } return fr; })); } catch (err) { console.error("Error replacing file:", err); alert("Could not load image file for replacement."); } } }; i.click(); };
    const handleVersionChange = useCallback(async (frameId: string, direction: 'next' | 'prev') => {
        const frameIndex = localFrames.findIndex(f => f.id === frameId);
        if (frameIndex === -1) return;
    
        const frame = localFrames[frameIndex];
        const newVersionIndex = direction === 'next'
            ? Math.min(frame.activeVersionIndex + 1, frame.imageUrls.length - 1)
            : Math.max(frame.activeVersionIndex - 1, 0);
    
        if (newVersionIndex === frame.activeVersionIndex) return;
    
        const newImageUrl = frame.imageUrls[newVersionIndex];
        let newFile: File;
        let sourceHash = frame.sourceHash;
        try {
            if (newImageUrl.startsWith('data:')) {
                newFile = dataUrlToFile(newImageUrl, `frame-${frame.id}-v${newVersionIndex}.png`);
            } else {
                const blob = await fetchCorsImage(newImageUrl);
                newFile = new File([blob], `frame-${frame.id}-v${newVersionIndex}.png`, { type: blob.type });
            }
             sourceHash = await calculateFileHash(newFile);
        } catch (e) {
            console.error(`Could not create file for frame version ${frame.id}:`, e);
            newFile = new File([], `failed-frame-${frame.id}.txt`, { type: 'text/plain' });
        }
    
        updateFrames(prev => {
            const updatedFrames = [...prev];
            updatedFrames[frameIndex] = {
                ...frame,
                activeVersionIndex: newVersionIndex,
                file: newFile,
                sourceHash: sourceHash
            };
            return updatedFrames;
        });
    }, [localFrames, updateFrames]);
    
    // --- Integration Handlers ---
    const handleStartIntegration = useCallback(async (source: File | string, targetFrameId: string) => { 
        // Find target in Frames OR Sketches
        const frameTarget = localFrames.find(f => f.id === targetFrameId);
        const sketchTarget = localSketches.find(s => s.id === targetFrameId);
        const target = frameTarget || (sketchTarget ? sketchToFrame(sketchTarget) : null);

        if (!target) return; 
        
        let s: Asset | { imageUrl: string; file: File; name: string; }; 
        if (typeof source === 'string') { 
            const a = localAssets.find(as => as.id === source); 
            if (!a) return; 
            s = a; 
        } else { 
            const i = await fileToBase64(source); 
            s = { id: crypto.randomUUID(), imageUrl: i, file: source, name: source.name }; 
        } 
        setIntegrationConfig({ sourceAsset: s, targetFrame: target }); 
        setIsIntegrationModalOpen(true); 
    }, [localFrames, localSketches, localAssets]);

    const handleStartIntegrationWithEmptySource = (targetFrameOrSketch: Frame | Sketch) => { 
        const target = 'imageUrls' in targetFrameOrSketch ? targetFrameOrSketch : sketchToFrame(targetFrameOrSketch);
        setIntegrationConfig({ targetFrame: target }); 
        setIsIntegrationModalOpen(true); 
    };

    const handleApplyIntegration = useCallback(async (result: { imageUrl: string, prompt: string }) => { 
        if (!integrationConfig) return; 
        const t = integrationConfig.targetFrame.id; 
        
        try { 
            const f = dataUrlToFile(result.imageUrl, `integrated-${t}-${Date.now()}.png`); 
            const hash = await calculateFileHash(f);
            
            // Try update frame
            let updated = false;
            const frameIndex = localFrames.findIndex(fr => fr.id === t);
            if (frameIndex !== -1) {
                 updateFrames(p => p.map(fr => { if (fr.id === t) { const niu = [...fr.imageUrls, result.imageUrl]; return { ...fr, imageUrls: niu, activeVersionIndex: niu.length - 1, file: f, prompt: result.prompt, isTransition: false, isGenerating: false, sourceHash: hash }; } return fr; }));
                 updated = true;
            }

            // Try update sketch if not frame
            if (!updated) {
                updateSketches(prev => prev.map(s => {
                    if (s.id === t) {
                        return { ...s, imageUrl: result.imageUrl, file: f, prompt: result.prompt };
                    }
                    return s;
                }));
            }

            setIsIntegrationModalOpen(false); 
            setIntegrationConfig(null); 
        } catch (err) { 
            console.error("Error applying integration:", err); 
            alert(`Не удалось применить интеграцию: ${err instanceof Error ? err.message : String(err)}`); 
        } 
    }, [integrationConfig, updateFrames, updateSketches, localFrames]);

    const handleStartIntegrationFromSketch = useCallback((sourceSketchId: string, targetFrameId: string) => {
        const sourceSketch = localSketches.find(s => s.id === sourceSketchId);
        const targetFrame = localFrames.find(f => f.id === targetFrameId);
        if (!sourceSketch || !targetFrame || !sourceSketch.file) return;

        const sourceAsset = {
            id: sourceSketch.id,
            imageUrl: sourceSketch.imageUrl,
            file: sourceSketch.file,
            name: sourceSketch.prompt || 'Набросок',
        };

        setIntegrationConfig({ sourceAsset, targetFrame });
        setIsIntegrationModalOpen(true);
    }, [localSketches, localFrames]);

    const handleStartIntegrationFromFrame = useCallback((sourceFrameId: string, targetFrameId: string) => {
        const sourceFrame = localFrames.find(f => f.id === sourceFrameId);
        const targetFrame = localFrames.find(f => f.id === targetFrameId);
        if (!sourceFrame || !targetFrame || !sourceFrame.file) return;

        const sourceAsset = {
            id: sourceFrame.id,
            imageUrl: sourceFrame.imageUrls[sourceFrame.activeVersionIndex],
            file: sourceFrame.file,
            name: sourceFrame.prompt || `Кадр #${sourceFrame.id.substring(0,4)}`,
        };

        setIntegrationConfig({ sourceAsset, targetFrame });
        setIsIntegrationModalOpen(true);
    }, [localFrames]);

    // --- Director's Board Handlers ---
    const handleBoardDoubleClick = (e: React.MouseEvent) => {
        if (!appSettings.doubleClickToGenerate) return;

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
        setSketchContextMenu(null);
        setNoteContextMenu(null);
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
    const handleBoardMouseDown = (e: React.MouseEvent) => {
        // Allow middle mouse button (1) or left mouse button (0)
        if (e.button !== 0 && e.button !== 1) return;
    
        // For left mouse button, block panning if over an interactive item.
        // Middle mouse button should always be allowed to pan.
        if (e.button === 0 && (e.target as HTMLElement).closest('.board-interactive-item')) {
            return;
        }
        
        setContextMenu(null);
        setBoardContextMenu(null);
        setSketchContextMenu(null);
        setNoteContextMenu(null);
    
        panState.current = { isPanning: true, startX: e.clientX, startY: e.clientY, lastX: transform.x, lastY: transform.y };
        (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
    };

    const handleBoardMouseMove = (e: React.MouseEvent) => {
        if (panState.current.isPanning) {
            e.preventDefault();
            const dx = e.clientX - panState.current.startX;
            const dy = e.clientY - panState.current.startY;
            setTransform(prev => ({ ...prev, x: panState.current.lastX + dx, y: panState.current.lastY + dy }));
        }
        
        if (draggingInfo) {
            e.preventDefault();
            const dx = (e.clientX - draggingInfo.initialMousePos.x) / transform.scale;
            const dy = (e.clientY - draggingInfo.initialMousePos.y) / transform.scale;

            switch (draggingInfo.type) {
                case 'note-move': {
                    const newX = draggingInfo.initialPosition.x + dx;
                    const newY = draggingInfo.initialPosition.y + dy;
                    updateNotes(prev => prev.map(n => n.id === draggingInfo.id ? { ...n, position: { x: newX, y: newY } } : n));
                    break;
                }
                case 'note-resize': {
                    if (draggingInfo.initialSize) {
                        const newWidth = Math.max(120, draggingInfo.initialSize.width + dx);
                        const newHeight = Math.max(100, draggingInfo.initialSize.height + dy);
                        updateNotes(prev => prev.map(n => n.id === draggingInfo.id ? { ...n, size: { width: newWidth, height: newHeight } } : n));
                    }
                    break;
                }
            }
        }
    };

    const handleBoardMouseUp = (e: React.MouseEvent) => {
        if (panState.current.isPanning) {
            panState.current.isPanning = false;
            (e.currentTarget as HTMLElement).style.cursor = 'grab';
        }
        if (draggingInfo) {
            setDraggingInfo(null);
            setSketchDropTargetIndex(null);
            setIsAssetLibraryDropTarget(false);
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

    // --- Sketch Drag & Drop (Native HTML5) ---
    const handleSketchDragStart = (e: React.DragEvent, sketch: Sketch) => {
        e.stopPropagation(); 
        setDraggingSketchId(sketch.id);
        setIsAssetLibraryDropTarget(true);

        // Calculate offset in "board space" relative to current transform
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        
        // We calculate how far into the element we clicked, but scale it back to 1.0 coordinate space
        const clickOffsetX = (e.clientX - rect.left) / transform.scale;
        const clickOffsetY = (e.clientY - rect.top) / transform.scale;
        
        dragOffset.current = { x: clickOffsetX, y: clickOffsetY };

        e.dataTransfer.setData('application/json;type=sketch-id', sketch.id);
        e.dataTransfer.effectAllowed = 'copyMove';
        
        // Use default drag image behavior or a simple clone if needed.
        // The browser will handle the visual snapshot.
    };
    
    const handleSketchDragEnd = () => {
        setDraggingSketchId(null);
        setSketchDropTargetIndex(null);
        setIsAssetLibraryDropTarget(false);
    };


    // --- Note Drag & Drop (Manual Implementation) ---
    const handleNoteMouseDown = (e: React.MouseEvent, note: Note) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        setDraggingInfo({
            type: 'note-move',
            id: note.id,
            initialMousePos: { x: e.clientX, y: e.clientY },
            initialPosition: note.position,
        });
    };
    
    const handleNoteResizeMouseDown = (e: React.MouseEvent, note: Note) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        setDraggingInfo({
            type: 'note-resize',
            id: note.id,
            initialMousePos: { x: e.clientX, y: e.clientY },
            initialPosition: note.position,
            initialSize: note.size,
        });
    };

    const handleBoardDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        // Important: Stop propagation to prevent parent handlers (if any)
        e.stopPropagation(); 

        const isFrame = e.dataTransfer.types.includes('application/json;type=frame-id');
        const isAsset = e.dataTransfer.types.includes('application/json;type=asset-ids');
        const isSketch = e.dataTransfer.types.includes('application/json;type=sketch-id');
        const isFile = e.dataTransfer.types.includes('Files');
        
        if (isFrame || isSketch) {
            e.dataTransfer.dropEffect = 'move';
        } else if (isAsset || isFile) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };
    
    const handleBoardDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleBoardDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const frameId = e.dataTransfer.getData('application/json;type=frame-id');
        const sketchId = e.dataTransfer.getData('application/json;type=sketch-id');
        const assetIdsJson = e.dataTransfer.getData('application/json;type=asset-ids');

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
        } else if (sketchId) {
            // Moving a sketch on the board
            const sketch = localSketches.find(s => s.id === sketchId);
            if (sketch && boardRef.current) {
                 const boardRect = boardRef.current.getBoundingClientRect();
                 // Calculate new position relative to board top-left, taking scale and drag offset into account
                 const newX = (e.clientX - boardRect.left - transform.x) / transform.scale - dragOffset.current.x;
                 const newY = (e.clientY - boardRect.top - transform.y) / transform.scale - dragOffset.current.y;
                 
                 updateSketches(prev => prev.map(s => s.id === sketchId ? { ...s, position: { x: newX, y: newY } } : s));
            }
        } else if (assetIdsJson) {
            try {
                const assetIds = JSON.parse(assetIdsJson);
                if (!Array.isArray(assetIds) || !boardRef.current) return;

                const boardRect = boardRef.current.getBoundingClientRect();
                const startX = (e.clientX - boardRect.left - transform.x) / transform.scale;
                const startY = (e.clientY - boardRect.top - transform.y) / transform.scale;

                const newSketches: Sketch[] = [];
                assetIds.forEach((assetId, index) => {
                    const asset = localAssets.find(a => a.id === assetId);
                    if (!asset) return;
                    
                    const aspectRatio = '16:9'; 
                    const [w, h] = aspectRatio.split(':').map(Number);
                    const size = { width: 320, height: (320 * h) / w };

                    const newSketch: Sketch = {
                        id: crypto.randomUUID(),
                        imageUrl: asset.imageUrl,
                        prompt: asset.name,
                        file: asset.file,
                        position: { x: startX + index * 20, y: startY + index * 20 },
                        size: size,
                        aspectRatio: aspectRatio,
                    };
                    newSketches.push(newSketch);
                });
                
                updateSketches(prev => [...prev, ...newSketches]);
            } catch (err) {
                 console.error("Failed to parse dropped asset data on board", err);
            }
        } else if (e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files) as File[];
            const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
            if (imageFiles.length > 0 && boardRef.current) {
                const boardRect = boardRef.current.getBoundingClientRect();
                const startX = (e.clientX - boardRect.left - transform.x) / transform.scale;
                const startY = (e.clientY - boardRect.top - transform.y) / transform.scale;
    
                const newSketchesPromises = imageFiles.map(async (file, index) => {
                    const imageUrl = await fileToBase64(file);
                    const { width, height } = await getImageDimensions(file);
                    const commonDivisor = gcd(width, height);
                    const aspectRatio = `${width / commonDivisor}:${height / commonDivisor}`;
    
                    const sketchWidth = 320;
                    const sketchHeight = (sketchWidth * height) / width;
    
                    const newSketch: Sketch = {
                        id: crypto.randomUUID(),
                        imageUrl,
                        prompt: file.name.replace(/\.[^/.]+$/, ""),
                        file,
                        position: { x: startX + index * 20, y: startY + index * 20 },
                        size: { width: sketchWidth, height: sketchHeight },
                        aspectRatio: aspectRatio,
                    };
                    return newSketch;
                });
                
                const newSketches = await Promise.all(newSketchesPromises);
                updateSketches(prev => [...prev, ...newSketches]);
            }
        }
    };

    const handleSketchContextMenu = (e: React.MouseEvent, sketch: Sketch) => {
        e.preventDefault();
        e.stopPropagation();
        setBoardContextMenu(null);
        setNoteContextMenu(null);
        setSketchContextMenu({ x: e.clientX, y: e.clientY, sketch });
    };

    const handleNoteContextMenu = (e: React.MouseEvent, note: Note) => {
        e.preventDefault();
        e.stopPropagation();
        setBoardContextMenu(null);
        setSketchContextMenu(null);
        setNoteContextMenu({ x: e.clientX, y: e.clientY, note });
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
    
    const handleAddNote = (position: Position) => {
        const newNote: Note = {
            id: crypto.randomUUID(),
            text: 'Новая заметка...',
            position,
            size: { width: 220, height: 180 },
        };
        updateNotes(prev => [...prev, newNote]);
    };

    const handleDeleteNote = (noteId: string) => {
        updateNotes(prev => prev.filter(n => n.id !== noteId));
    };

    const handleAddFrameFromSketch = useCallback(async (sketchId: string, index: number) => {
        const sketch = localSketches.find(s => s.id === sketchId);
        if (!sketch || !sketch.file) return;

        const hash = await calculateFileHash(sketch.file);

        const newFrame: Frame = {
            id: crypto.randomUUID(),
            imageUrls: [sketch.imageUrl],
            activeVersionIndex: 0,
            prompt: sketch.prompt,
            duration: 3.0,
            file: sketch.file,
            aspectRatio: sketch.aspectRatio,
            sourceHash: hash
        };
        
        updateFrames(prev => {
            const framesCopy = [...prev];
            framesCopy.splice(index, 0, newFrame);
            return framesCopy;
        });
        updateSketches(prev => prev.filter(s => s.id !== sketchId));

    }, [localSketches, updateFrames, updateSketches]);
    
    const handleAddAssetFromSketch = useCallback((sketchId: string) => {
        const sketch = localSketches.find(s => s.id === sketchId);
        if (!sketch || !sketch.file) return;
        
        const newAsset: Asset = {
            id: crypto.randomUUID(),
            imageUrl: sketch.imageUrl,
            file: sketch.file,
            name: sketch.prompt || 'Набросок',
        };
        
        updateAssets(prev => [...prev, newAsset]);
        updateSketches(prev => prev.filter(s => s.id !== sketchId));
    }, [localSketches, updateAssets, updateSketches]);

    const registerTimelineDropZone = useCallback((index: number, element: HTMLElement | null) => {
        const map = timelineDropZoneRefs.current;
        if (element) {
            map.set(index, element);
        } else {
            map.delete(index);
        }
    }, []);


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
        <div className="relative flex h-screen w-full flex-col group/design-root overflow-hidden select-none">
            <Header 
                projectName={currentProject?.name || 'Загрузка...'}
                hasUnsavedChanges={hasUnsavedChanges}
                onNewProject={handleNewProject}
                onSaveProject={handleSaveProject}
                onSaveAsProject={() => setIsSaveModalOpen(true)}
                onLoadProject={() => setIsLoadModalOpen(true)}
                onManageApiKey={handleManageApiKey}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
            />
            <main 
                ref={boardRef}
                className="flex-1 flex-col overflow-hidden relative grid-bg-metallic"
                style={{ cursor: panState.current.isPanning || draggingInfo ? 'grabbing' : 'grab' }}
                onDoubleClick={handleBoardDoubleClick}
                onContextMenu={handleBoardContextMenu}
                onMouseDown={handleBoardMouseDown}
                onMouseMove={handleBoardMouseMove}
                onMouseUp={handleBoardMouseUp}
                onMouseLeave={handleBoardMouseUp}
                onWheel={handleWheel}
                onDragOver={handleBoardDragOver}
                onDragLeave={handleBoardDragLeave}
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
                            sketchDropTargetIndex={sketchDropTargetIndex}
                            isAnalyzingStory={isAnalyzingStory}
                            dossiers={localDossiers}
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
                            onAnalyzeStory={handleAnalyzeStory}
                            onGenerateSinglePrompt={handleGenerateSinglePrompt}
                            onGenerateVideo={handleGenerateVideo}
                            onEditPrompt={setEditingFrame}
                            onViewImage={setViewingFrameIndex}
                            onOpenDetailView={setDetailedFrame}
                            onContextMenu={handleContextMenu}
                            onVersionChange={handleVersionChange}
                            onStartIntegration={handleStartIntegration}
                            onStartIntegrationFromSketch={handleStartIntegrationFromSketch}
                            onStartIntegrationFromFrame={handleStartIntegrationFromFrame}
                            onOpenAddFrameMenu={handleOpenAddFrameMenu}
                            onRegisterDropZone={registerTimelineDropZone}
                        />
                    </div>

                    {localSketches.map(sketch => (
                         <div key={sketch.id} className="board-interactive-item">
                            <SketchCard 
                                sketch={sketch} 
                                isDragging={draggingSketchId === sketch.id}
                                onContextMenu={handleSketchContextMenu}
                                onDragStart={handleSketchDragStart}
                                onDragEnd={handleSketchDragEnd}
                            />
                         </div>
                    ))}
                    
                     {localNotes.map(note => (
                        <div key={note.id} className="board-interactive-item">
                            <NoteCard
                                note={note}
                                onUpdateText={(id, text) => updateNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n))}
                                onMouseDown={handleNoteMouseDown}
                                onResizeMouseDown={handleNoteResizeMouseDown}
                                onContextMenu={handleNoteContextMenu}
                            />
                        </div>
                    ))}
                </div>
                
                 <AssetLibraryPanel 
                    ref={assetLibraryRef}
                    isOpen={isAssetLibraryOpen}
                    onClose={() => setIsAssetLibraryOpen(false)}
                    assets={localAssets}
                    selectedAssetIds={selectedAssetIds}
                    storySettings={storySettings}
                    frameCount={frameCount}
                    isDropTarget={isAssetLibraryDropTarget}
                    onAddAssets={handleAddAssets}
                    onAddAssetFromSketch={handleAddAssetFromSketch}
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
            {integrationConfig && (
                <IntegrationModal
                    isOpen={isIntegrationModalOpen}
                    onClose={() => { setIsIntegrationModalOpen(false); setIntegrationConfig(null); }}
                    config={integrationConfig}
                    onIntegrate={handleApplyIntegration}
                    onZoomImage={(url, title) => setZoomedImage({ url, title })}
                />
            )}
            {editingFrame && ( <EditPromptModal frame={editingFrame} onClose={() => setEditingFrame(null)} onSave={handleSavePrompt} /> )}
            {viewingFrameIndex !== null && ( <ImageViewerModal frames={localFrames} startIndex={viewingFrameIndex} onClose={() => setViewingFrameIndex(null)} /> )}
            {detailedFrame && ( <FrameDetailModal frame={detailedFrame} onClose={() => setDetailedFrame(null)} onSave={handleSaveFrameDetails} /> )}
            {isSaveModalOpen && ( <ProjectSaveModal onClose={() => setIsSaveModalOpen(false)} onSave={handleSaveAs} initialName={currentProject?.name} title={currentProject?.id === DEMO_PROJECT_ID ? "Сохранить демо как новый проект" : "Сохранить проект как"} /> )}
            {isLoadModalOpen && ( <ProjectLoadModal projects={projects} currentProjectId={currentProjectId} onClose={() => setIsLoadModalOpen(false)} onLoad={handleLoadProject} onDelete={handleDeleteProject} onNew={handleNewProject} /> )}
            {confirmationState && (
                <ConfirmationModal
                    isOpen={!!confirmationState}
                    title={confirmationState.title}
                    message={confirmationState.message}
                    onConfirm={confirmationState.onConfirm}
                    onCancel={() => setConfirmationState(null)}
                />
            )}
            {isSettingsModalOpen && (
                <SettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    settings={appSettings}
                    onSave={handleSaveSettings}
                />
            )}
            {zoomedImage && (
                <SimpleImageViewerModal
                    imageUrl={zoomedImage.url}
                    title={zoomedImage.title}
                    onClose={() => setZoomedImage(null)}
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
                            label: 'Новый набросок', 
                            icon: 'add_photo_alternate', 
                            onClick: () => {
                                setAdvancedGenerateModalConfig({ 
                                    mode: 'generate-sketch', 
                                    position: boardContextMenu.boardPosition 
                                });
                                setIsAdvancedGenerateModalOpen(true);
                            } 
                        },
                        {
                            label: 'Новая заметка',
                            icon: 'note_add',
                            onClick: () => handleAddNote(boardContextMenu.boardPosition),
                        }
                    ]}
                />
            )}
             {sketchContextMenu && (
                <ContextMenu
                    x={sketchContextMenu.x}
                    y={sketchContextMenu.y}
                    onClose={() => setSketchContextMenu(null)}
                    actions={[
                        { 
                            label: 'Отправить на таймлайн', 
                            icon: 'view_timeline', 
                            onClick: () => handleAddFrameFromSketch(sketchContextMenu.sketch.id, localFrames.length) 
                        },
                         { 
                            label: 'Редактировать', 
                            icon: 'tune', 
                            onClick: () => { 
                                setAdvancedGenerateModalConfig({ 
                                    mode: 'edit', 
                                    frameToEdit: sketchToFrame(sketchContextMenu.sketch) 
                                }); 
                                setIsAdvancedGenerateModalOpen(true); 
                            }
                        },
                        { 
                            label: 'Адаптировать', 
                            icon: 'auto_fix', 
                            onClick: () => setAdaptingFrame(sketchToFrame(sketchContextMenu.sketch)) 
                        },
                         { 
                            label: 'Интегрировать ассет', 
                            icon: 'add_photo_alternate', 
                            onClick: () => handleStartIntegrationWithEmptySource(sketchContextMenu.sketch) 
                        },
                        { label: 'Дублировать', icon: 'content_copy', onClick: () => handleDuplicateSketch(sketchContextMenu.sketch.id) },
                        { label: 'Удалить', icon: 'delete', isDestructive: true, onClick: () => handleDeleteSketch(sketchContextMenu.sketch.id) },
                    ]}
                />
            )}
            {noteContextMenu && (
                <ContextMenu
                    x={noteContextMenu.x}
                    y={noteContextMenu.y}
                    onClose={() => setNoteContextMenu(null)}
                    actions={[
                        { label: 'Удалить', icon: 'delete', isDestructive: true, onClick: () => handleDeleteNote(noteContextMenu.note.id) },
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
