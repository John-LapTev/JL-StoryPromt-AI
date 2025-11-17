import React from 'react';
import type { Frame } from '../types';
import { GeneratingVideoState } from '../App';

interface FrameCardProps {
    frame: Frame;
    index: number;
    isGeneratingPrompt: boolean;
    generatingVideoState: GeneratingVideoState;
    isDragging: boolean;
    onDurationChange: (id: string, newDuration: number) => void;
    onPromptChange: (id: string, newPrompt: string) => void;
    onDeleteFrame: (id: string) => void;
    onGenerateSinglePrompt: (id: string) => void;
    onEditPrompt: (frame: Frame) => void;
    onViewImage: (index: number) => void;
    onGenerateVideo: (frame: Frame) => void;
    onOpenDetailView: (frame: Frame) => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onContextMenu: (e: React.MouseEvent, frame: Frame) => void;
    onVersionChange: (frameId: string, direction: 'next' | 'prev') => void;
}

export const FrameCard: React.FC<FrameCardProps> = ({ 
    frame, 
    index, 
    isGeneratingPrompt, 
    generatingVideoState,
    isDragging,
    onDurationChange, 
    onPromptChange, 
    onDeleteFrame, 
    onGenerateSinglePrompt, 
    onEditPrompt, 
    onViewImage, 
    onGenerateVideo, 
    onOpenDetailView,
    onDragStart,
    onDragEnd,
    onContextMenu,
    onVersionChange,
}) => {
    const DURATION_STEP = 0.25;

    const activeImageUrl = frame.imageUrls[frame.activeVersionIndex];
    const hasVersions = frame.imageUrls.length > 1;

    if (frame.isGenerating) {
        return (
            <div className="flex flex-col gap-2 shrink-0">
                <div className="relative group">
                    <div className="w-48 h-28 rounded-lg bg-primary/10 border-2 border-dashed border-primary/50 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-2 w-48 h-[76px] bg-white/5 p-2 rounded-lg text-xs text-center text-white/60 overflow-hidden">
                    <p className="leading-snug">{frame.prompt}</p>
                </div>
            </div>
        );
    }

    const handleDecrease = () => {
        onDurationChange(frame.id, frame.duration - DURATION_STEP);
    };

    const handleIncrease = () => {
        onDurationChange(frame.id, frame.duration + DURATION_STEP);
    };

    const PromptSection: React.FC = () => {
        if (isGeneratingPrompt) {
            return (
                 <div className="flex items-center justify-center gap-2 w-48 h-[76px] bg-white/5 p-2 rounded-lg">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            );
        }

        if (frame.prompt) {
             const promptBgClass = frame.isTransition
                ? 'bg-gradient-to-r from-primary/20 to-white/5'
                : 'bg-white/5';
                
            return (
                <div className={`flex items-start gap-2 w-48 h-[76px] p-2 rounded-lg relative group/prompt ${promptBgClass}`}>
                    <span 
                        className="material-symbols-outlined text-base text-primary pt-0.5"
                        title={frame.isTransition ? "Промт для перехода" : "Промт для анимации"}
                    >
                        {frame.isTransition ? 'sync_alt' : 'auto_awesome'}
                    </span>
                     <p className="text-xs text-white/80 leading-snug w-full h-full overflow-hidden flex-1">
                        {frame.prompt}
                    </p>
                    <div className="flex flex-col gap-1 pl-1 opacity-0 group-hover/prompt:opacity-100 focus-within:opacity-100">
                        <button 
                            onClick={() => onGenerateSinglePrompt(frame.id)}
                            className="p-0.5 bg-white/10 rounded-sm text-white hover:bg-white/20"
                            title="Перегенерировать промт"
                        >
                            <span className="material-symbols-outlined text-sm">autorenew</span>
                        </button>
                        <button 
                            onClick={() => onEditPrompt(frame)} 
                            className="p-0.5 bg-white/10 rounded-sm text-white hover:bg-white/20"
                            title="Редактировать промт"
                        >
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <button onClick={() => onGenerateSinglePrompt(frame.id)} className="flex min-w-[84px] w-48 max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 hover:bg-white/20">
                <span className="material-symbols-outlined">auto_awesome</span>
                <span className="truncate">Сгенерировать промт</span>
            </button>
        );
    };


    return (
        <div 
            className={`flex flex-col gap-2 shrink-0 transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onContextMenu={(e) => onContextMenu(e, frame)}
        >
            <div 
                className="relative group"
                onDoubleClick={() => onOpenDetailView(frame)}
            >
                <div 
                    className="w-48 h-28 rounded-lg bg-black/20 border-2 border-primary cursor-zoom-in overflow-hidden" 
                    onClick={() => onViewImage(index)}
                >
                     <img src={activeImageUrl} alt={`Frame ${index + 1}`} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDeleteFrame(frame.id); }}
                    className="absolute top-1.5 right-1.5 z-10 size-6 rounded-full bg-red-600/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 backdrop-blur-sm transition-opacity"
                    aria-label="Delete frame"
                >
                    <span className="material-symbols-outlined text-base">delete</span>
                </button>
                {generatingVideoState && (
                     <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center text-white rounded-lg p-2 gap-2 text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs font-medium">{generatingVideoState.message}</p>
                    </div>
                )}
                <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{index + 1}</div>
                
                 {hasVersions && (
                    <div className="absolute inset-0 flex items-center justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onVersionChange(frame.id, 'prev'); }}
                            disabled={frame.activeVersionIndex === 0}
                            className="size-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed pointer-events-auto"
                            aria-label="Previous version"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onVersionChange(frame.id, 'next'); }}
                            disabled={frame.activeVersionIndex === frame.imageUrls.length - 1}
                            className="size-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed pointer-events-auto"
                             aria-label="Next version"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                )}
                 {hasVersions && (
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded-full opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                        {frame.activeVersionIndex + 1} / {frame.imageUrls.length}
                    </div>
                )}
            </div>
             <div className="flex items-center justify-center">
                <div className="flex h-6 items-center rounded-full bg-white/5 px-0.5">
                    <button onClick={handleDecrease} className="flex size-5 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"><span className="material-symbols-outlined text-base font-bold">remove</span></button>
                    <div className="flex items-baseline whitespace-nowrap px-1.5 text-xs font-medium text-white">
                        <span>({frame.duration.toFixed(2)})</span><span className="text-[0.625rem] ml-0.5">s</span>
                    </div>
                    <button onClick={handleIncrease} className="flex size-5 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"><span className="material-symbols-outlined text-base font-bold">add</span></button>
                </div>
            </div>
            <PromptSection />
        </div>
    );
};