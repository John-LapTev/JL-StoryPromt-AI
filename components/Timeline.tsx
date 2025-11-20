import React, { useState } from 'react';
import type { Frame, ActorDossier } from '../types';
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
    sketchDropTargetIndex: number | null;
    isAnalyzingStory: boolean;
    dossiers?: ActorDossier[];
    viewMode: 'compact' | 'expanded';
    onViewModeChange: (mode: 'compact' | 'expanded') => void;
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
    onOpenDossier: (dossier: ActorDossier) => void;
    onContextMenu: (e: React.MouseEvent, frame: Frame) => void;
    onVersionChange: (frameId: string, direction: 'next' | 'prev') => void;
    onStartIntegration: (source: File | string, targetFrameId: string) => void;
    onStartIntegrationFromSketch: (sourceSketchId: string, targetFrameId: string) => void;
    onStartIntegrationFromFrame: (sourceFrameId: string, targetFrameId: string) => void;
    onOpenAddFrameMenu: (index: number, rect: DOMRect) => void;
    onRegisterDropZone: (index: number, element: HTMLElement | null) => void;
    onRegenerateFrame: (frameId: string) => void;
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
    sketchDropTargetIndex,
    isAnalyzingStory,
    dossiers,
    viewMode,
    onViewModeChange,
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
    onOpenDossier,
    onContextMenu,
    onVersionChange,
    onStartIntegration,
    onStartIntegrationFromSketch,
    onStartIntegrationFromFrame,
    onOpenAddFrameMenu,
    onRegisterDropZone,
    onRegenerateFrame
}) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
    
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
        e.stopPropagation();
    
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
        <div className="relative group/select">
            <select
                id={id}
                value={value}
                onChange={onChange}
                className="w-full appearance-none bg-black/30 hover:bg-black/50 transition-colors px-3 py-1.5 rounded-md text-xs font-bold text-white/90 focus:ring-1 focus:ring-primary border border-white/5 pr-8 h-8 cursor-pointer"
            >
                {children}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/50 text-sm group-hover/select:text-white/80">
                expand_more
            </span>
        </div>
    );

    return (
        <div className="glass-panel rounded-2xl p-4 pointer-events-auto w-fit min-w-[320px] mt-20">
            <div className="flex items-center justify-between px-1 pb-4 border-b border-white/5 mb-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-white text-lg font-bold tracking-wide font-display">Раскадровка</h3>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-dark text-xs font-mono font-semibold shadow-neon-sm">
                        <span className="material-symbols-outlined text-sm filled">timer</span>
                        <span>{totalDuration.toFixed(2)}s</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-black/30 rounded-lg border border-white/5 p-1">
                        <button 
                            onClick={() => onViewModeChange('compact')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'compact' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                            title="Компактный вид"
                        >
                            <span className="material-symbols-outlined text-[18px]">view_comfy</span>
                        </button>
                        <button 
                            onClick={() => onViewModeChange('expanded')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'expanded' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                            title="Расширенный вид"
                        >
                            <span className="material-symbols-outlined text-[18px]">view_agenda</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 p-1 bg-black/30 rounded-lg border border-white/5">
                        <StyledSelect id="global-ar" value={globalAspectRatio} onChange={e => onGlobalAspectRatioChange(e.target.value)}>
                             {aspectRatios.map(r => <option key={r} value={r} className="bg-surface text-white">{r}</option>)}
                        </StyledSelect>
                        <div className="w-px h-4 bg-white/10 mx-1"></div>
                        <button 
                            onClick={onToggleAspectRatioLock} 
                            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${isAspectRatioLocked ? 'text-primary bg-primary/10' : 'text-white/50 hover:text-white'}`} 
                            title={isAspectRatioLocked ? 'Разблокировать соотношение сторон' : 'Заблокировать для всех кадров'}
                        >
                            <span className="material-symbols-outlined text-sm">{isAspectRatioLocked ? 'lock' : 'lock_open'}</span>
                        </button>
                        <button 
                            onClick={onAdaptAllFramesAspectRatio} 
                            className="flex h-7 items-center justify-center rounded-md px-2 gap-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors" 
                            title="Адаптировать все кадры"
                        >
                            <span className="material-symbols-outlined text-sm">auto_fix</span>
                            <span>Адаптировать</span>
                        </button>
                    </div>
                    <button 
                        onClick={onAnalyzeStory} 
                        disabled={isAnalyzingStory} 
                        className="glass-button-primary h-9 px-4 rounded-lg text-xs font-bold text-white flex items-center gap-2"
                    >
                        {isAnalyzingStory ? (
                             <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                             <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                        )}
                        <span>Анализ сюжета</span>
                    </button>
                </div>
            </div>
            
            <div className="overflow-x-auto pb-2 custom-scrollbar" onDragLeave={handleTimelineContainerDragLeave}>
                <div 
                    className="flex items-start gap-0 h-full w-max pt-2"
                    onDragOver={(e) => e.preventDefault()}
                >
                    <AddFrameButton 
                        index={0} 
                        onOpenMenu={onOpenAddFrameMenu}
                        onDragOver={(e) => handleDragOver(e, 0)}
                        onDrop={handleDrop}
                        isDropTarget={dropTargetIndex === 0 || sketchDropTargetIndex === 0}
                        onRegisterDropZone={onRegisterDropZone}
                    />
                    {frames.map((frame, index) => (
                        <React.Fragment key={frame.id}>
                            <div className="px-0">
                                <FrameCard
                                    frame={frame}
                                    index={index}
                                    viewMode={viewMode}
                                    isGeneratingPrompt={generatingPromptFrameId === frame.id}
                                    generatingVideoState={generatingVideoState?.frameId === frame.id ? generatingVideoState : null}
                                    isDragging={draggedIndex === index}
                                    isAspectRatioLocked={isAspectRatioLocked}
                                    dossiers={dossiers}
                                    onDurationChange={onDurationChange}
                                    onPromptChange={onPromptChange}
                                    onDeleteFrame={onDeleteFrame}
                                    onGenerateSinglePrompt={onGenerateSinglePrompt}
                                    onEditPrompt={onEditPrompt}
                                    onViewImage={onViewImage}
                                    onGenerateVideo={onGenerateVideo}
                                    onOpenDetailView={onOpenDetailView}
                                    onOpenDossier={onOpenDossier}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onContextMenu={onContextMenu}
                                    onVersionChange={onVersionChange}
                                    onAspectRatioChange={onFrameAspectRatioChange}
                                    onAdaptAspectRatio={onAdaptFrameAspectRatio}
                                    onStartIntegration={onStartIntegration}
                                    onStartIntegrationFromSketch={onStartIntegrationFromSketch}
                                    onStartIntegrationFromFrame={onStartIntegrationFromFrame}
                                    onRegenerate={onRegenerateFrame}
                                />
                            </div>
                            <AddFrameButton
                                index={index + 1}
                                onOpenMenu={onOpenAddFrameMenu}
                                onDragOver={(e) => handleDragOver(e, index + 1)}
                                onDrop={handleDrop}
                                isDropTarget={dropTargetIndex === index + 1 || sketchDropTargetIndex === index + 1}
                                onRegisterDropZone={onRegisterDropZone}
                            />
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};