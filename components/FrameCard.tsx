
import React, { useState } from 'react';
import type { Frame, ActorDossier } from '../types';
import { GeneratingVideoState } from '../App';

interface FrameCardProps {
    frame: Frame;
    index: number;
    isGeneratingPrompt: boolean;
    generatingVideoState: GeneratingVideoState;
    isDragging: boolean;
    isAspectRatioLocked: boolean;
    dossiers?: ActorDossier[];
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
    onAspectRatioChange: (frameId: string, newRatio: string) => void;
    onAdaptAspectRatio: (frameId: string) => void;
    onStartIntegration: (source: File | string, targetFrameId: string) => void;
    onStartIntegrationFromSketch: (sourceSketchId: string, targetFrameId: string) => void;
    onStartIntegrationFromFrame: (sourceFrameId: string, targetFrameId: string) => void;
    onRegenerate?: (frameId: string) => void;
}

const aspectRatios = ['16:9', '4:3', '1:1', '9:16'];

const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        'bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-purple-500', 
        'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    return colors[Math.abs(hash) % colors.length];
};

export const FrameCard: React.FC<FrameCardProps> = ({ 
    frame, 
    index, 
    isGeneratingPrompt, 
    generatingVideoState,
    isDragging,
    isAspectRatioLocked,
    dossiers,
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
    onAspectRatioChange,
    onAdaptAspectRatio,
    onStartIntegration,
    onStartIntegrationFromSketch,
    onStartIntegrationFromFrame,
    onRegenerate
}) => {
    const DURATION_STEP = 0.25;
    const [isDragOver, setIsDragOver] = useState(false);

    const activeImageUrl = frame.imageUrls[frame.activeVersionIndex];
    const hasVersions = frame.imageUrls.length > 1;

    const knownActor = dossiers?.find(d => d.sourceHash === frame.sourceHash);
    const isKnownActor = !!knownActor;
    
    // Badge logic
    const getBadgeIcon = (type?: string) => {
        switch(type) {
            case 'object': return 'category';
            case 'location': return 'landscape';
            case 'character': default: return 'face';
        }
    };
    const badgeColor = isKnownActor ? stringToColor(knownActor.roleLabel || knownActor.characterDescription) : 'bg-gray-500';
    const badgeLabel = isKnownActor ? (knownActor.roleLabel || knownActor.characterDescription) : '';
    const badgeIcon = isKnownActor ? getBadgeIcon(knownActor.type) : 'face';

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const isAsset = e.dataTransfer.types.includes('application/json;type=asset-ids');
        const isFile = e.dataTransfer.types.includes('Files');
        const isSketch = e.dataTransfer.types.includes('application/json;type=sketch-id');
        const isFrame = e.dataTransfer.types.includes('application/json;type=frame-id');

        if (isAsset || isFile || isSketch || isFrame) {
            if (isFrame && e.dataTransfer.getData('application/json;type=frame-id') === frame.id) {
                e.dataTransfer.dropEffect = 'none';
                setIsDragOver(false);
                return;
            }
            e.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const sketchId = e.dataTransfer.getData('application/json;type=sketch-id');
        if (sketchId) {
            onStartIntegrationFromSketch(sketchId, frame.id);
            return;
        }

        const sourceFrameId = e.dataTransfer.getData('application/json;type=frame-id');
        if (sourceFrameId && sourceFrameId !== frame.id) {
            onStartIntegrationFromFrame(sourceFrameId, frame.id);
            return;
        }

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const imageFile = Array.from(files).find((file: File) => file.type.startsWith('image/'));
            if (imageFile) {
                onStartIntegration(imageFile, frame.id);
                return;
            }
        }

        const assetIdsJson = e.dataTransfer.getData('application/json;type=asset-ids');
        if (assetIdsJson) {
            try {
                const assetIds = JSON.parse(assetIdsJson);
                if (Array.isArray(assetIds) && assetIds.length > 0) {
                    onStartIntegration(assetIds[0], frame.id);
                    return;
                }
            } catch (err) {
                console.error("Failed to parse dropped asset data for integration", err);
            }
        }
    };

    if (frame.isGenerating) {
        return (
            <div className="flex flex-col gap-2 shrink-0 w-48">
                <div className="relative group">
                    <div className="w-full h-28 rounded-lg bg-primary/10 border-2 border-dashed border-primary/50 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-2 w-full h-[76px] bg-black/20 p-2 rounded-lg text-xs text-center text-white/60 overflow-hidden">
                    <p className="leading-snug">{frame.generatingMessage || frame.prompt}</p>
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
    
     const StyledSelect: React.FC<{id: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, children: React.ReactNode, className?: string}> = ({ id, value, onChange, children, className }) => (
        <div className={`relative ${className}`}>
            <select
                id={id}
                value={value}
                onChange={onChange}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full appearance-none bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-white/90 focus:ring-2 focus:ring-primary border-none pr-6 h-7"
            >
                {children}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-white/50 text-base">
                expand_more
            </span>
        </div>
    );

    const PromptSection: React.FC = () => {
        if (isGeneratingPrompt) {
            return (
                 <div className="flex items-center justify-center gap-2 w-full h-[76px] bg-black/20 p-2 rounded-lg">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            );
        }

        if (frame.prompt) {
             const promptBgClass = frame.isTransition
                ? 'bg-gradient-to-r from-primary/20 to-black/30'
                : 'bg-black/30';
                
            return (
                <div 
                    onMouseDown={(e) => { if (e.button === 0) e.stopPropagation(); }}
                    onWheel={(e) => e.stopPropagation()}
                    className={`relative group/prompt w-full flex flex-col min-h-[76px] max-h-32 p-2.5 rounded-lg transition-all hover:bg-black/40 ${promptBgClass}`}
                >
                    <div className="flex items-start gap-2 flex-1 min-h-0 overflow-y-auto pr-1">
                        <span 
                            className="material-symbols-outlined text-base text-primary pt-0.5"
                            title={frame.isTransition ? "Промт для перехода" : "Промт для анимации"}
                        >
                            {frame.isTransition ? 'sync_alt' : 'auto_awesome'}
                        </span>
                        <p className="text-xs text-white/80 leading-snug w-full break-words">
                            {frame.prompt}
                        </p>
                    </div>
                    <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover/prompt:opacity-100 transition-opacity duration-200">
                        <button 
                            onClick={() => onGenerateSinglePrompt(frame.id)}
                            className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-primary hover:scale-110"
                            title="Перегенерировать промт"
                        >
                            <span className="material-symbols-outlined text-sm">autorenew</span>
                        </button>
                        <button 
                            onClick={() => onEditPrompt(frame)} 
                            className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-primary hover:scale-110"
                            title="Редактировать промт"
                        >
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <button onMouseDown={(e) => { if (e.button === 0) e.stopPropagation(); }} onClick={() => onGenerateSinglePrompt(frame.id)} className="flex min-w-[84px] w-full max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 hover:bg-white/20">
                <span className="material-symbols-outlined">auto_awesome</span>
                <span className="truncate">Сгенерировать промт</span>
            </button>
        );
    };


    return (
        <div 
            className="flex flex-col gap-2 shrink-0 w-48 relative"
            data-frame-id={frame.id}
            onContextMenu={(e) => onContextMenu(e, frame)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
             {!isAspectRatioLocked && (
                <div className="flex items-center gap-1.5 h-7" onMouseDown={e => e.stopPropagation()}>
                    <StyledSelect 
                        id={`ar-select-${frame.id}`} 
                        value={frame.aspectRatio || '16:9'} 
                        onChange={e => onAspectRatioChange(frame.id, e.target.value)}
                        className="flex-1"
                    >
                        {aspectRatios.map(r => <option key={r} value={r} className="bg-[#191C2D] text-white">{r}</option>)}
                    </StyledSelect>
                    <button onClick={() => onAdaptAspectRatio(frame.id)} className="flex h-7 w-7 items-center justify-center rounded-md bg-black/50 text-white hover:bg-primary" title="Адаптировать кадр к выбранному соотношению сторон">
                        <span className="material-symbols-outlined text-base">auto_fix</span>
                    </button>
                </div>
            )}
            <div 
                className={`relative group transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
                onDoubleClick={() => !frame.hasError && onOpenDetailView(frame)}
                draggable
                onMouseDown={(e) => { if (e.button === 0) e.stopPropagation(); }}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                style={{ cursor: 'grab' }}
            >
                <div 
                    className={`w-full h-28 rounded-lg bg-black/20 border-2 ${frame.hasError ? 'border-red-500 bg-red-500/10' : 'border-primary'} cursor-zoom-in overflow-hidden flex items-center justify-center relative`} 
                    onClick={() => !frame.hasError && onViewImage(index)}
                >
                     {frame.hasError ? (
                        <div className="flex flex-col items-center gap-2">
                             <span className="material-symbols-outlined text-3xl text-red-400">broken_image</span>
                             <button 
                                onClick={(e) => { e.stopPropagation(); onRegenerate && onRegenerate(frame.id); }}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/20 text-red-200 hover:bg-red-500/40 text-xs font-bold transition-colors"
                             >
                                <span className="material-symbols-outlined text-sm">refresh</span>
                                Повторить
                             </button>
                        </div>
                     ) : (
                        <img src={activeImageUrl} alt={`Frame ${index + 1}`} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
                     )}
                </div>
                {isDragOver && !frame.hasError && (
                    <div className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-primary/30 ring-2 ring-primary ring-offset-2 ring-offset-background-dark flex flex-col items-center justify-center text-white">
                        <span className="material-symbols-outlined text-4xl">add_photo_alternate</span>
                        <p className="text-xs font-bold">Интегрировать</p>
                    </div>
                )}
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
                
                 {hasVersions && !frame.hasError && (
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
                 {hasVersions && !frame.hasError && (
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded-full opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                        {frame.activeVersionIndex + 1} / {frame.imageUrls.length}
                    </div>
                )}
            </div>

            {/* Badge moved outside image container for better stacking context and visibility */}
            {isKnownActor && !frame.hasError && (
                <div 
                    className={`absolute top-[88px] -right-1 ${badgeColor} text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-30 ring-2 ring-background-dark`} 
                    title={`Опознан как: ${badgeLabel}`}
                >
                    <span className="material-symbols-outlined text-xs">{badgeIcon}</span>
                    <span className="max-w-[70px] truncate">{badgeLabel}</span>
                </div>
            )}

             <div className="flex items-center justify-center mt-auto">
                <div className="flex h-6 items-center rounded-full bg-white/5 px-0.5">
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={handleDecrease} className="flex size-5 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"><span className="material-symbols-outlined text-base font-bold">remove</span></button>
                    <div className="flex items-baseline whitespace-nowrap px-1.5 text-xs font-medium text-white">
                        <span>({frame.duration.toFixed(2)})</span><span className="text-[0.625rem] ml-0.5">s</span>
                    </div>
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={handleIncrease} className="flex size-5 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"><span className="material-symbols-outlined text-base font-bold">add</span></button>
                </div>
            </div>
            <PromptSection />
        </div>
    );
};
