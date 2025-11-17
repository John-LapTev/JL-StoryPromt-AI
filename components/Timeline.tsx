import React, { useRef, useState, useEffect } from 'react';
import type { Frame } from '../types';
import { FrameCard } from './FrameCard';
import { AddFrameButton } from './AddFrameButton';
import { GeneratingVideoState } from '../App';

interface Transform {
    scale: number;
    x: number;
    y: number;
}
interface TimelineProps {
    frames: Frame[];
    totalDuration: number;
    transform: Transform;
    setTransform: React.Dispatch<React.SetStateAction<Transform>>;
    generatingStory: boolean;
    generatingPromptFrameId: string | null;
    generatingVideoState: GeneratingVideoState;
    onDurationChange: (id: string, newDuration: number) => void;
    onPromptChange: (id: string, newPrompt: string) => void;
    onAddFrame: (index: number, type: 'upload' | 'generate') => void;
    onAddFramesFromAssets: (assetIds: string[], index: number) => void;
    onDeleteFrame: (id: string) => void;
    onReorderFrame: (dragIndex: number, dropIndex: number) => void;
    onAnalyzeStory: () => void;
    onGenerateSinglePrompt: (id: string) => void;
    onGenerateTransition: (index: number) => void;
    onGenerateVideo: (frame: Frame) => void;
    onEditPrompt: (frame: Frame) => void;
    onViewImage: (index: number) => void;
    onOpenDetailView: (frame: Frame) => void;
    onOpenAssetLibrary: () => void;
    onContextMenu: (e: React.MouseEvent, frame: Frame) => void;
    onVersionChange: (frameId: string, direction: 'next' | 'prev') => void;
}


export const Timeline: React.FC<TimelineProps> = ({
    frames,
    totalDuration,
    transform,
    setTransform,
    generatingStory,
    generatingPromptFrameId,
    generatingVideoState,
    onDurationChange,
    onPromptChange,
    onAddFrame,
    onAddFramesFromAssets,
    onDeleteFrame,
    onReorderFrame,
    onAnalyzeStory,
    onGenerateSinglePrompt,
    onGenerateTransition,
    onGenerateVideo,
    onEditPrompt,
    onViewImage,
    onOpenDetailView,
    onOpenAssetLibrary,
    onContextMenu,
    onVersionChange,
}) => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const isPanning = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const [isSpaceDown, setIsSpaceDown] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

     // Keyboard listener for Spacebar to enable global panning mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault(); // Prevent page scroll
                setIsSpaceDown(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpaceDown(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Effect for all mouse interactions (panning, zooming)
    useEffect(() => {
        const timelineEl = timelineRef.current;
        if (!timelineEl) return;

        const handleMouseDown = (e: MouseEvent) => {
            if (!timelineEl.contains(e.target as Node)) return;

            const isMiddleClick = e.button === 1;
            const isSpaceAndLeftClick = isSpaceDown && e.button === 0;
            const isBackgroundLeftClick = !(e.target as HTMLElement).closest('.frame-card-interactive') && e.button === 0 && !isSpaceAndLeftClick;

            if (isMiddleClick || isSpaceAndLeftClick) {
                e.preventDefault();
                e.stopPropagation();
                isPanning.current = true;
                startPos.current = { x: e.clientX, y: e.clientY };
                document.body.style.cursor = 'grabbing';
            } else if (isBackgroundLeftClick) {
                e.preventDefault();
                isPanning.current = true;
                startPos.current = { x: e.clientX, y: e.clientY };
                document.body.style.cursor = 'grabbing';
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isPanning.current) return;
            e.preventDefault();
            const dx = e.clientX - startPos.current.x;
            const dy = e.clientY - startPos.current.y;
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            startPos.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            if (isPanning.current) {
                isPanning.current = false;
                document.body.style.cursor = 'default';
            }
        };
        
        const handleWheel = (e: WheelEvent) => {
            if (!timelineEl.contains(e.target as Node)) return;
            e.preventDefault();
            
            const scaleFactor = 1.1;
            const newScale = e.deltaY < 0 
                ? Math.min(8, transform.scale * scaleFactor)
                : Math.max(0.2, transform.scale / scaleFactor);

            if (Math.abs(newScale - transform.scale) < 0.001) return;
            
            const rect = timelineEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
            const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
            
            setTransform({ scale: newScale, x: newX, y: newY });
        };
        
        // Use capture phase for mousedown to intercept clicks on interactive elements
        window.addEventListener('mousedown', handleMouseDown, true);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        timelineEl.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            window.removeEventListener('mousedown', handleMouseDown, true);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            timelineEl.removeEventListener('wheel', handleWheel);
            document.body.style.cursor = 'default';
        };
    }, [isSpaceDown, transform.scale, transform.x, transform.y, setTransform]);

    // Effect to manage cursor style based on spacebar state
    useEffect(() => {
        const timelineEl = timelineRef.current;
        if (timelineEl && !isPanning.current) {
             timelineEl.style.cursor = isSpaceDown ? 'grab' : 'grab';
        }
    }, [isSpaceDown]);

    const handleResetView = () => {
        setTransform({ scale: 1, x: 0, y: 0 });
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Hiding the default drag preview
        // e.dataTransfer.setDragImage(new Image(), 0, 0); 
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDropTargetIndex(null);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        
        // If dragging assets, highlight the drop target
        if (e.dataTransfer.types.includes('application/json;type=asset-ids')) {
            e.dataTransfer.dropEffect = 'copy';
            setDropTargetIndex(index);
            return;
        }
        
        // If reordering frames
        if (draggedIndex !== null) {
            e.dataTransfer.dropEffect = 'move';
            if (index !== draggedIndex && index !== (draggedIndex ?? -1) + 1) {
                 setDropTargetIndex(index);
            } else {
                 setDropTargetIndex(null);
            }
        }
    };

    const handleDragLeave = () => {
        setDropTargetIndex(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const assetIdsJson = e.dataTransfer.getData('application/json;type=asset-ids');
    
        if (assetIdsJson && dropTargetIndex !== null) {
            try {
                const assetIds = JSON.parse(assetIdsJson);
                if (Array.isArray(assetIds) && assetIds.length > 0) {
                    onAddFramesFromAssets(assetIds, dropTargetIndex);
                }
            } catch (err) {
                console.error("Failed to parse dropped asset data", err);
            }
        } else if (draggedIndex !== null && dropTargetIndex !== null) {
            onReorderFrame(draggedIndex, dropTargetIndex);
        }
    
        setDraggedIndex(null);
        setDropTargetIndex(null);
    };


    return (
        <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Timeline</h3>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        <span className="material-symbols-outlined text-sm">timer</span>
                        <span>{totalDuration.toFixed(2)} s</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button onClick={onOpenAssetLibrary} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold leading-normal tracking-[-0.015em] gap-2 hover:bg-white/20">
                        <span className="material-symbols-outlined text-base">photo_library</span>
                        <span className="truncate">Библиотека</span>
                    </button>
                     <button onClick={handleResetView} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold leading-normal tracking-[-0.015em] gap-2 hover:bg-white/20">
                        <span className="material-symbols-outlined text-base">settings_backup_restore</span>
                        <span className="truncate">Сбросить вид</span>
                    </button>
                    <button onClick={onAnalyzeStory} disabled={generatingStory} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed">
                        {generatingStory ? (
                             <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                             <span className="material-symbols-outlined text-base">auto_awesome</span>
                        )}
                        <span className="truncate">{generatingStory ? 'Анализ...' : 'Анализировать сюжет и создать промты'}</span>
                    </button>
                </div>
            </div>
            <div 
                ref={timelineRef}
                className="flex-1 rounded-lg p-4 overflow-hidden grid-bg-metallic border border-white/20 min-h-[220px] relative"
                style={{ cursor: 'grab' }}
            >
                <div
                     style={{
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        transformOrigin: 'top left',
                        width: 'max-content'
                     }}
                >
                    <div className="flex items-start gap-4 h-full p-4">
                        <div className="frame-card-interactive">
                             <AddFrameButton 
                                index={0} 
                                onAddFrame={onAddFrame} 
                                onDragOver={(e) => handleDragOver(e, 0)}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                isDropTarget={dropTargetIndex === 0}
                            />
                        </div>
                        {frames.map((frame, index) => (
                            <React.Fragment key={frame.id}>
                                <div className="frame-card-interactive">
                                    <FrameCard
                                        frame={frame}
                                        index={index}
                                        isGeneratingPrompt={generatingPromptFrameId === frame.id}
                                        generatingVideoState={generatingVideoState?.frameId === frame.id ? generatingVideoState : null}
                                        isDragging={draggedIndex === index}
                                        onDurationChange={onDurationChange}
                                        onPromptChange={onPromptChange}
                                        onDeleteFrame={onDeleteFrame}
                                        onGenerateSinglePrompt={onGenerateSinglePrompt}
                                        onEditPrompt={onEditPrompt}
                                        onViewImage={onViewImage}
                                        onGenerateVideo={onGenerateVideo}
                                        onOpenDetailView={onOpenDetailView}
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnd={handleDragEnd}
                                        onContextMenu={onContextMenu}
                                        onVersionChange={onVersionChange}
                                    />
                                </div>
                                <div className="frame-card-interactive">
                                    <AddFrameButton
                                        index={index + 1}
                                        onAddFrame={onAddFrame}
                                        onGenerateTransition={onGenerateTransition}
                                        showTransitionOption={index < frames.length -1}
                                        onDragOver={(e) => handleDragOver(e, index + 1)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        isDropTarget={dropTargetIndex === index + 1}
                                    />
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};