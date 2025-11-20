
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
    viewMode: 'compact' | 'expanded';
    onDurationChange: (id: string, newDuration: number) => void;
    onPromptChange: (id: string, newPrompt: string) => void;
    onDeleteFrame: (id: string) => void;
    onGenerateSinglePrompt: (id: string) => void;
    onEditPrompt: (frame: Frame) => void;
    onViewImage: (index: number) => void;
    onGenerateVideo: (frame: Frame) => void;
    onOpenDetailView: (frame: Frame) => void;
    onOpenDossier: (dossier: ActorDossier) => void;
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

const getEntityStyle = (str: string) => {
    if (!str) return {
        borderColor: 'border-white/10',
        textColor: 'text-white/50',
        shadow: 'shadow-none',
        bg: 'bg-white/5',
        iconColor: 'text-white/50'
    };
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    
    const styles = [
        { borderColor: 'border-blue-400/30', textColor: 'text-blue-200', shadow: 'shadow-[0_0_15px_rgba(96,165,250,0.15)]', bg: 'bg-blue-500/20', iconColor: 'text-blue-400' },
        { borderColor: 'border-red-400/30', textColor: 'text-red-200', shadow: 'shadow-[0_0_15px_rgba(248,113,113,0.15)]', bg: 'bg-red-500/20', iconColor: 'text-red-400' },
        { borderColor: 'border-emerald-400/30', textColor: 'text-emerald-200', shadow: 'shadow-[0_0_15px_rgba(52,211,153,0.15)]', bg: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
        { borderColor: 'border-purple-400/30', textColor: 'text-purple-200', shadow: 'shadow-[0_0_15px_rgba(167,139,250,0.15)]', bg: 'bg-purple-500/20', iconColor: 'text-purple-400' },
        { borderColor: 'border-amber-400/30', textColor: 'text-amber-200', shadow: 'shadow-[0_0_15px_rgba(251,191,36,0.15)]', bg: 'bg-amber-500/20', iconColor: 'text-amber-400' },
        { borderColor: 'border-pink-400/30', textColor: 'text-pink-200', shadow: 'shadow-[0_0_15px_rgba(244,114,182,0.15)]', bg: 'bg-pink-500/20', iconColor: 'text-pink-400' },
        { borderColor: 'border-cyan-400/30', textColor: 'text-cyan-200', shadow: 'shadow-[0_0_15px_rgba(34,211,238,0.15)]', bg: 'bg-cyan-500/20', iconColor: 'text-cyan-400' },
    ];
    return styles[Math.abs(hash) % styles.length];
};

export const FrameCard: React.FC<FrameCardProps> = ({ 
    frame, index, isGeneratingPrompt, generatingVideoState, isDragging, isAspectRatioLocked, dossiers, viewMode,
    onDurationChange, onPromptChange, onDeleteFrame, onGenerateSinglePrompt, onEditPrompt, onViewImage, 
    onGenerateVideo, onOpenDetailView, onOpenDossier, onDragStart, onDragEnd, onContextMenu, onVersionChange, 
    onAspectRatioChange, onAdaptAspectRatio, onStartIntegration, onStartIntegrationFromSketch, 
    onStartIntegrationFromFrame, onRegenerate
}) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const activeImageUrl = frame.imageUrls[frame.activeVersionIndex];
    const hasVersions = frame.imageUrls.length > 1;
    const knownActor = dossiers?.find(d => d.sourceHash === frame.sourceHash);
    const isKnownActor = !!knownActor;
    
    const getBadgeIcon = (type?: string) => {
        switch(type) { case 'object': return 'deployed_code'; case 'location': return 'landscape'; case 'character': default: return 'face'; }
    };
    
    const badgeLabel = isKnownActor ? (knownActor.roleLabel || (knownActor.characterDescription ? 'Персонаж' : 'Объект')) : '';
    const badgeStyle = isKnownActor ? getEntityStyle(badgeLabel || knownActor.type || '') : getEntityStyle('');
    const badgeIcon = isKnownActor ? getBadgeIcon(knownActor.type) : 'face';

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
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
        e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
        const sketchId = e.dataTransfer.getData('application/json;type=sketch-id');
        if (sketchId) { onStartIntegrationFromSketch(sketchId, frame.id); return; }
        const sourceFrameId = e.dataTransfer.getData('application/json;type=frame-id');
        if (sourceFrameId && sourceFrameId !== frame.id) { onStartIntegrationFromFrame(sourceFrameId, frame.id); return; }
        const files = e.dataTransfer.files;
        if (files && files.length > 0) { const imageFile = Array.from(files).find((file: File) => file.type.startsWith('image/')); if (imageFile) { onStartIntegration(imageFile, frame.id); return; } }
        const assetIdsJson = e.dataTransfer.getData('application/json;type=asset-ids');
        if (assetIdsJson) { try { const assetIds = JSON.parse(assetIdsJson); if (Array.isArray(assetIds) && assetIds.length > 0) { onStartIntegration(assetIds[0], frame.id); return; } } catch (err) { } }
    };

    const handleDossierClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (knownActor) {
            onOpenDossier(knownActor);
        }
    };

    if (frame.isGenerating) {
        return (
            <div className="flex flex-col gap-3 shrink-0 w-[240px] h-[135px] p-2">
                <div className="glass-panel w-full h-full rounded-xl border border-primary/20 flex flex-col items-center justify-center gap-3 relative overflow-hidden shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse"></div>
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin z-10"></div>
                    <p className="text-[10px] font-medium text-primary-light/90 text-center px-4 z-10 uppercase tracking-wider animate-pulse">
                        {frame.generatingMessage || "Генерация..."}
                    </p>
                </div>
            </div>
        );
    }

    if (frame.hasError) {
        return (
             <div className="flex flex-col gap-3 shrink-0 w-[240px] h-[135px] p-2 group/error">
                <div className="glass-panel w-full h-full rounded-xl bg-red-900/10 border border-red-500/30 flex flex-col items-center justify-center gap-2 relative overflow-hidden hover:border-red-500/60 transition-colors">
                    <span className="material-symbols-outlined text-3xl text-red-500/80">broken_image</span>
                    <p className="text-[10px] text-red-400 font-medium">Ошибка генерации</p>
                    {onRegenerate && (
                        <button onClick={() => onRegenerate(frame.id)} className="mt-1 px-3 py-1 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-md text-[10px] text-red-200 flex items-center gap-1 transition-all">
                            <span className="material-symbols-outlined text-[12px]">refresh</span> Повторить
                        </button>
                    )}
                     <button onClick={() => onDeleteFrame(frame.id)} className="absolute top-2 right-2 text-red-500/50 hover:text-red-400">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            </div>
        );
    }

    const renderVersionArrows = () => {
        if (!hasVersions || viewMode !== 'expanded') return null;
        return (
            <>
                 <button 
                    onClick={(e) => { e.stopPropagation(); onVersionChange(frame.id, 'prev'); }} 
                    disabled={frame.activeVersionIndex === 0}
                    className="absolute top-0 bottom-0 left-0 w-8 flex items-center justify-center bg-gradient-to-r from-black/60 to-transparent opacity-0 group-hover/card:opacity-100 hover:bg-black/70 transition-all z-30 disabled:hidden cursor-pointer"
                    title="Предыдущая версия"
                >
                    <span className="material-symbols-outlined text-white drop-shadow-lg">chevron_left</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onVersionChange(frame.id, 'next'); }} 
                    disabled={frame.activeVersionIndex === frame.imageUrls.length - 1}
                    className="absolute top-0 bottom-0 right-0 w-8 flex items-center justify-center bg-gradient-to-l from-black/60 to-transparent opacity-0 group-hover/card:opacity-100 hover:bg-black/70 transition-all z-30 disabled:hidden cursor-pointer"
                    title="Следующая версия"
                >
                    <span className="material-symbols-outlined text-white drop-shadow-lg">chevron_right</span>
                </button>
            </>
        );
    }

    return (
        <div 
            className={`flex flex-col shrink-0 w-[240px] relative group/card ${isDragging ? 'scale-95 opacity-50 grayscale' : 'hover:z-10'}`}
            data-frame-id={frame.id}
            onContextMenu={(e) => onContextMenu(e, frame)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
             {/* Expanded Mode: Aspect Ratio Controls Above */}
             {viewMode === 'expanded' && !isAspectRatioLocked && (
                <div className="flex items-center justify-center mb-2">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-0.5 backdrop-blur-md shadow-sm">
                        <select value={frame.aspectRatio || '16:9'} onChange={e => onAspectRatioChange(frame.id, e.target.value)} onClick={e => e.stopPropagation()} className="bg-transparent text-white text-[10px] font-bold rounded px-2 h-5 outline-none cursor-pointer">
                            {aspectRatios.map(r => <option key={r} value={r} className="bg-surface">{r}</option>)}
                        </select>
                         <div className="w-px h-3 bg-white/10 mx-0.5"></div>
                        <button onClick={() => onAdaptAspectRatio(frame.id)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-primary hover:text-white text-white/70 transition-colors" title="Адаптировать"><span className="material-symbols-outlined text-[12px]">auto_fix</span></button>
                    </div>
                </div>
            )}

            {/* Main Image Container */}
            <div 
                className={`relative w-full h-[135px] glass-panel rounded-xl overflow-hidden shadow-lg border border-white/10 group-hover/card:border-primary/50 transition-colors p-0 bg-black/40`}
                draggable
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
            >
                <img 
                    src={activeImageUrl} 
                    alt={`Frame ${index + 1}`} 
                    className="w-full h-full object-contain transition-transform duration-500 group-hover/card:scale-105 cursor-zoom-in"
                    onClick={() => !frame.hasError && onViewImage(index)}
                    onDoubleClick={() => !frame.hasError && onOpenDetailView(frame)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20 pointer-events-none rounded-xl opacity-60 group-hover/card:opacity-40 transition-opacity"></div>
                
                 <div className="absolute top-2 left-2 z-20 flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[10px] font-bold text-white/90 shadow-sm pointer-events-auto cursor-default select-none">
                    <span className="text-primary mr-0.5">#</span>{index + 1}
                 </div>
                 
                 {viewMode === 'expanded' && renderVersionArrows()}

                {isKnownActor && !frame.hasError && (
                    // Compact: Top-9 | Expanded: Bottom-Left
                    <div className={`absolute z-40 flex flex-col items-start pointer-events-auto ${viewMode === 'expanded' ? 'bottom-2 left-2' : 'top-9 left-2'}`}>
                        <div 
                            onClick={handleDossierClick}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`flex items-center justify-center w-8 h-8 rounded-full backdrop-blur-md border ${badgeStyle.borderColor} ${badgeStyle.bg} ${badgeStyle.shadow} transition-all hover:scale-110 hover:brightness-110 cursor-pointer shadow-lg`}
                            title={`Опознано: ${badgeLabel}. Нажмите для открытия полного досье.`}
                        >
                            <span className={`material-symbols-outlined text-[18px] ${badgeStyle.iconColor}`}>{badgeIcon}</span>
                        </div>
                    </div>
                )}

                {/* Expanded: Version Counter at Bottom Center */}
                {viewMode === 'expanded' && hasVersions && (
                     <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-sm pointer-events-none">
                        <span className="text-[9px] font-bold text-white/90 tracking-widest">{frame.activeVersionIndex + 1} / {frame.imageUrls.length}</span>
                    </div>
                )}

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 z-20">
                     <button onClick={(e) => { e.stopPropagation(); onGenerateVideo(frame); }} className="size-7 rounded-full bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary hover:border-primary transition-colors pointer-events-auto" title="Создать видео">
                        <span className="material-symbols-outlined text-[16px]">movie</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteFrame(frame.id); }} className="size-7 rounded-full bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-500 hover:border-red-500 transition-colors pointer-events-auto" title="Удалить">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                     {/* Compact Mode: Aspect Ratio Controls inside */}
                     {viewMode === 'compact' && !isAspectRatioLocked && (
                         <div className="flex items-center ml-1 pointer-events-auto">
                            <select value={frame.aspectRatio || '16:9'} onChange={e => onAspectRatioChange(frame.id, e.target.value)} onClick={e => e.stopPropagation()} className="bg-black/80 text-white text-[10px] rounded px-1 h-7 border border-white/10 outline-none cursor-pointer">
                                {aspectRatios.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <button onClick={() => onAdaptAspectRatio(frame.id)} className="w-7 h-7 flex items-center justify-center bg-primary/20 border border-primary/50 rounded-r text-primary hover:bg-primary hover:text-white transition-colors ml-0.5"><span className="material-symbols-outlined text-[14px]">auto_fix</span></button>
                        </div>
                     )}
                </div>

                {/* Compact Mode: Bottom Controls Overlay */}
                {viewMode === 'compact' && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 z-20 pointer-events-none">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between pointer-events-auto">
                                 <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-md px-1.5 py-0.5 border border-white/10 group-hover/card:border-white/20 transition-colors">
                                    <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onDurationChange(frame.id, frame.duration - 0.25)} className="text-white/50 hover:text-white transition-colors"><span className="material-symbols-outlined text-[12px]">remove</span></button>
                                    <span className="text-[10px] font-mono font-bold text-white min-w-[24px] text-center">{frame.duration.toFixed(1)}s</span>
                                    <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onDurationChange(frame.id, frame.duration + 0.25)} className="text-white/50 hover:text-white transition-colors"><span className="material-symbols-outlined text-[12px]">add</span></button>
                                </div>
                                 {hasVersions && (
                                    <div className="flex items-center gap-1 bg-primary/10 backdrop-blur-md rounded-md px-1.5 py-0.5 border border-primary/30">
                                        <button onClick={(e) => { e.stopPropagation(); onVersionChange(frame.id, 'prev'); }} disabled={frame.activeVersionIndex === 0} className="text-white/70 hover:text-white disabled:opacity-30"><span className="material-symbols-outlined text-[12px]">chevron_left</span></button>
                                        <span className="text-[9px] font-bold text-white">{frame.activeVersionIndex + 1}/{frame.imageUrls.length}</span>
                                        <button onClick={(e) => { e.stopPropagation(); onVersionChange(frame.id, 'next'); }} disabled={frame.activeVersionIndex === frame.imageUrls.length - 1} className="text-white/70 hover:text-white disabled:opacity-30"><span className="material-symbols-outlined text-[12px]">chevron_right</span></button>
                                    </div>
                                )}
                            </div>
                             <div className="text-[10px] text-white/70 truncate cursor-pointer hover:text-primary transition-colors font-medium mt-1 pointer-events-auto" onClick={() => onEditPrompt(frame)} title={frame.prompt}>
                                {frame.prompt || <span className="italic text-white/30">Нет промта...</span>}
                            </div>
                        </div>
                    </div>
                )}

                {isDragOver && !frame.hasError && (
                    <div className="absolute inset-0 z-30 bg-primary/20 backdrop-blur-sm border-2 border-primary flex flex-col items-center justify-center text-white animate-pulse rounded-xl pointer-events-none">
                        <span className="material-symbols-outlined text-4xl drop-shadow-glow">add_photo_alternate</span>
                        <p className="text-xs font-bold mt-1 drop-shadow-md">Интеграция</p>
                    </div>
                )}
                 {generatingVideoState && (
                     <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center text-white rounded-lg p-2 gap-2 text-center z-30 pointer-events-none">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {/* Expanded Mode: Controls Below Image */}
            {viewMode === 'expanded' && (
                <div className="flex flex-col gap-2 mt-1 w-full animate-fade-in">
                    {/* Time Controls */}
                    <div className="flex items-center justify-center gap-3 p-1.5 bg-white/5 rounded-lg border border-white/5">
                         <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onDurationChange(frame.id, frame.duration - 0.25)} className="w-8 h-8 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors flex items-center justify-center">
                             <span className="material-symbols-outlined text-lg">remove</span>
                         </button>
                        <div className="flex flex-col items-center w-16">
                             <span className="text-sm font-mono font-bold text-white">{frame.duration.toFixed(1)}s</span>
                        </div>
                        <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onDurationChange(frame.id, frame.duration + 0.25)} className="w-8 h-8 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors flex items-center justify-center">
                             <span className="material-symbols-outlined text-lg">add</span>
                         </button>
                    </div>

                    {/* Prompt Box */}
                    <div className="bg-black/30 rounded-lg border border-white/5 flex flex-col group/prompt">
                        <div className="flex items-center justify-between p-1.5 border-b border-white/5 bg-white/5 rounded-t-lg">
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider px-1">Промт</span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => onGenerateSinglePrompt(frame.id)} 
                                    className={`p-1 rounded hover:bg-primary/20 hover:text-primary text-white/40 transition-colors ${isGeneratingPrompt ? 'animate-spin text-primary' : ''}`}
                                    title="Обновить промт (AI)"
                                >
                                    <span className="material-symbols-outlined text-[14px]">auto_fix</span>
                                </button>
                                <button 
                                    onClick={() => onEditPrompt(frame)} 
                                    className="p-1 rounded hover:bg-white/10 hover:text-white text-white/40 transition-colors"
                                    title="Редактировать промт"
                                >
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                            </div>
                        </div>
                        <div 
                            className="p-2 max-h-[80px] overflow-y-auto custom-scrollbar"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <p className="text-[11px] text-white/80 leading-relaxed whitespace-pre-wrap">
                                {frame.prompt || <span className="italic text-white/30">Нет промта...</span>}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
