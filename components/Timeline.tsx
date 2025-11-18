

import React, { useState } from 'react';
import type { Frame } from '../types';
import { FrameCard } from './FrameCard';
import { AddFrameButton } from './AddFrameButton';
import { GeneratingVideoState } from '../App';

interface TimelineProps {
    frames: Frame[];
    totalDuration: number;
    generatingStory: boolean;
    generatingPromptFrameId: string | null;
    generatingVideoState: GeneratingVideoState;
    globalAspectRatio: string;
    isAspectRatioLocked: boolean;
    isAnalyzingStory: boolean;
    onGlobalAspectRatioChange: (newRatio: string) => void;
    onToggleAspectRatioLock: () => void;
    onFrameAspectRatioChange: (frameId: string, newRatio: string) => void;
    onAdaptFrameAspectRatio: (frameId: string) => void;
    onAdaptAllFramesAspectRatio: () => void;
    onDurationChange: (id: string, newDuration: number) => void;
    onPromptChange: (id: string, newPrompt: string) => void;
    onAddFramesFromAssets: (assetIds: string[], index: number) => void;
    onAddFramesFromFiles: (files: File[], index: number) => void;
    onAddFrameFromSketch: (sketchId: string, index: number) => void;
    onDeleteFrame: (id: string) => void;
    onReorderFrame: (dragIndex: number, dropIndex: number) => void;
    onAnalyzeStory: () => void;
    onGenerateSinglePrompt: (id: string) => void;
    onGenerateVideo: (frame: Frame) => void;
    onEditPrompt: (frame: Frame) => void;
    onViewImage: (index: number) => void;
    onOpenDetailView: (frame: Frame) => void;
    onContextMenu: (e: React.MouseEvent, frame: Frame) => void;
    onVersionChange: (frameId: string, direction: 'next' | 'prev') => void;
    onStartIntegration: (source: File | string, targetFrameId: string) => void;
    onStartIntegrationFromSketch: (sourceSketchId: string, targetFrameId: string) => void;
    onStartIntegrationFromFrame: (sourceFrameId: string, targetFrameId: string) => void;
    onOpenAddFrameMenu: (index: number, rect: DOMRect) => void;
    onRegisterDropZone: (index: number, element: HTMLElement | null) => void;
}

const aspectRatios = ['16:9', '4:3', '1:1', '9:16'];


export const Timeline: React.FC<TimelineProps> = ({
    frames,
    totalDuration,
    generatingStory,
    generatingPromptFrameId,
    generatingVideoState,
    globalAspectRatio,
    isAspectRatioLocked,
    isAnalyzingStory,
    onGlobalAspectRatioChange,
    onToggleAspectRatioLock,
    onFrameAspectRatioChange,
    onAdaptFrameAspectRatio,
    onAdaptAllFramesAspectRatio,
    onDurationChange,
    onPromptChange,
    onAddFramesFromAssets,
    onAddFramesFromFiles,
    onAddFrameFromSketch,
    onDeleteFrame,
    onReorderFrame,
    onAnalyzeStory,
    onGenerateSinglePrompt,
    onGenerateVideo,
    onEditPrompt,
    onViewImage,
    onOpenDetailView,
    onContextMenu,
    onVersionChange,
    onStartIntegration,
    onStartIntegrationFromSketch,
    onStartIntegrationFromFrame,
    onOpenAddFrameMenu,
    onRegisterDropZone,
}) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
    

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, index: number) => {
        const frame = frames[index];
        if (!frame) return;
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'copyMove';
        e.dataTransfer.setData('application/json;type=frame-id', frame.id);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDropTargetIndex(null);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation(); // <-- IMPORTANT: Prevents board's onDragOver from firing.
    
        let newDropTargetIndex: number | null = null;
    
        const isFile = e.dataTransfer.types.includes('Files');
        const isAsset = e.dataTransfer.types.includes('application/json;type=asset-ids');
        const isSketch = e.dataTransfer.types.includes('application/json;type=sketch-id');

        if (isFile || isAsset || isSketch) {
            e.dataTransfer.dropEffect = 'copy';
            newDropTargetIndex = index;
        } else if (draggedIndex !== null) {
            e.dataTransfer.dropEffect = 'move';
            if (index !== draggedIndex && index !== (draggedIndex ?? -1) + 1) {
                newDropTargetIndex = index;
            }
        }
    
        if (dropTargetIndex !== newDropTargetIndex) {
            setDropTargetIndex(newDropTargetIndex);
        }
    };

    const handleTimelineContainerDragLeave = () => {
        setDropTargetIndex(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const assetIdsJson = e.dataTransfer.getData('application/json;type=asset-ids');
        const sketchId = e.dataTransfer.getData('application/json;type=sketch-id');
        const files = e.dataTransfer.files;
    
        if (files && files.length > 0 && dropTargetIndex !== null) {
            // FIX: Explicitly type the 'file' parameter in the filter to resolve 'unknown' type error.
            const imageFiles = Array.from(files).filter((file: File) => file.type.startsWith('image/'));
            if (imageFiles.length > 0) {
                onAddFramesFromFiles(imageFiles, dropTargetIndex);
            }
        } else if (assetIdsJson && dropTargetIndex !== null) {
            try {
                const assetIds = JSON.parse(assetIdsJson);
                if (Array.isArray(assetIds) && assetIds.length > 0) {
                    onAddFramesFromAssets(assetIds, dropTargetIndex);
                }
            } catch (err) {
                console.error("Failed to parse dropped asset data", err);
            }
        } else if (sketchId && dropTargetIndex !== null) {
            onAddFrameFromSketch(sketchId, dropTargetIndex);
        } else if (draggedIndex !== null && dropTargetIndex !== null) {
            onReorderFrame(draggedIndex, dropTargetIndex);
        }
    
        setDraggedIndex(null);
        setDropTargetIndex(null);
    };

    const StyledSelect: React.FC<{id: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, children: React.ReactNode}> = ({ id, value, onChange, children }) => (
        <div className="relative">
            <select
                id={id}
                value={value}
                onChange={onChange}
                className="w-full appearance-none bg-white/5 px-3 py-1.5 rounded-lg text-xs font-bold text-white/90 focus:ring-2 focus:ring-primary border-none pr-8 h-8"
            >
                {children}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/50">
                expand_more
            </span>
        </div>
    );

    return (
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-2 pointer-events-auto w-fit">
            <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Раскадровка</h3>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        <span className="material-symbols-outlined text-sm">timer</span>
                        <span>{totalDuration.toFixed(2)} s</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 p-1 bg-white/5 rounded-lg">
                        <StyledSelect id="global-ar" value={globalAspectRatio} onChange={e => onGlobalAspectRatioChange(e.target.value)}>
                             {aspectRatios.map(r => <option key={r} value={r} className="bg-[#191C2D] text-white">{r}</option>)}
                        </StyledSelect>
                        <button onClick={onToggleAspectRatioLock} className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20" title={isAspectRatioLocked ? 'Разблокировать соотношение сторон' : 'Заблокировать для всех кадров'}>
                            <span className="material-symbols-outlined text-base">{isAspectRatioLocked ? 'lock' : 'lock_open'}</span>
                        </button>
                        <button onClick={onAdaptAllFramesAspectRatio} className="flex h-8 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 px-2 gap-1 text-xs font-bold" title="Адаптировать все кадры к выбранному соотношению сторон">
                            <span className="material-symbols-outlined text-base">auto_fix</span>
                            <span>Адаптировать все</span>
                        </button>
                    </div>
                    <button onClick={onAnalyzeStory} disabled={isAnalyzingStory} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed">
                        {isAnalyzingStory ? (
                             <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                             <span className="material-symbols-outlined text-base">auto_awesome</span>
                        )}
                        <span className="truncate">{isAnalyzingStory ? 'Анализ...' : 'Анализировать сюжет и создать промты'}</span>
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto pb-2" onDragLeave={handleTimelineContainerDragLeave}>
                <div 
                    className="flex items-start gap-0 h-full p-2 w-max"
                    onDragOver={(e) => e.preventDefault()}
                >
                    <AddFrameButton 
                        index={0} 
                        onOpenMenu={onOpenAddFrameMenu}
                        onDragOver={(e) => handleDragOver(e, 0)}
                        onDrop={handleDrop}
                        isDropTarget={dropTargetIndex === 0}
                        onRegisterDropZone={onRegisterDropZone}
                    />
                    {frames.map((frame, index) => (
                        <React.Fragment key={frame.id}>
                            <div className="px-2">
                                <FrameCard
                                    frame={frame}
                                    index={index}
                                    isGeneratingPrompt={generatingPromptFrameId === frame.id}
                                    generatingVideoState={generatingVideoState?.frameId === frame.id ? generatingVideoState : null}
                                    isDragging={draggedIndex === index}
                                    isAspectRatioLocked={isAspectRatioLocked}
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
                                    onAspectRatioChange={onFrameAspectRatioChange}
                                    onAdaptAspectRatio={onAdaptFrameAspectRatio}
                                    onStartIntegration={onStartIntegration}
                                    onStartIntegrationFromSketch={onStartIntegrationFromSketch}
                                    onStartIntegrationFromFrame={onStartIntegrationFromFrame}
                                />
                            </div>
                            <AddFrameButton
                                index={index + 1}
                                onOpenMenu={onOpenAddFrameMenu}
                                onDragOver={(e) => handleDragOver(e, index + 1)}
                                onDrop={handleDrop}
                                isDropTarget={dropTargetIndex === index + 1}
                                onRegisterDropZone={onRegisterDropZone}
                            />
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};