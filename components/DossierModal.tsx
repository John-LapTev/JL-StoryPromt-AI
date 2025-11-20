import React from 'react';
import type { ActorDossier, Frame } from '../types';

interface DossierModalProps {
    dossier: ActorDossier;
    relatedFrames: Frame[];
    allFrames: Frame[];
    onClose: () => void;
    onJumpToFrame: (index: number) => void;
}

export const DossierModal: React.FC<DossierModalProps> = ({ dossier, relatedFrames, allFrames, onClose, onJumpToFrame }) => {
    
    const getBadgeIcon = (type?: string) => {
        switch(type) { case 'object': return 'deployed_code'; case 'location': return 'landscape'; case 'character': default: return 'face'; }
    };

    const icon = getBadgeIcon(dossier.type);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col max-w-6xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 shrink-0 bg-white/5 rounded-t-2xl flex items-center justify-between backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center shadow-neon">
                            <span className="material-symbols-outlined text-2xl text-primary-light">{icon}</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold font-display text-white tracking-wide">{dossier.roleLabel || 'Без названия'}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-white/60 uppercase tracking-wider border border-white/5">
                                    {dossier.type || 'UNDEFINED'}
                                </span>
                                <span className="text-[10px] text-white/40 font-mono">HASH: {dossier.sourceHash.substring(0, 8)}...</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="flex flex-col md:flex-row gap-8">
                        
                        {/* Left Column: Reference Image */}
                        <div className="w-full md:w-1/3 shrink-0 flex flex-col gap-3">
                            <div className="text-xs font-bold text-white/50 uppercase tracking-wider">Референс</div>
                            <div className="w-full aspect-square rounded-xl overflow-hidden border-2 border-white/10 bg-black/30 shadow-lg relative group">
                                <img 
                                    src={dossier.referenceImageUrl} 
                                    alt="Reference" 
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60"></div>
                                <div className="absolute bottom-3 left-3 right-3">
                                    <p className="text-[10px] text-white/60 font-mono">ORIGINAL SOURCE</p>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Description & Stats */}
                        <div className="flex-1 flex flex-col gap-6">
                            <div>
                                <div className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Досье / Описание</div>
                                <div className="bg-white/5 p-5 rounded-xl border border-white/5 text-sm text-white/80 leading-relaxed font-medium shadow-inner">
                                    {dossier.characterDescription}
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Статистика появлений</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col">
                                        <span className="text-2xl font-bold text-white">{relatedFrames.length}</span>
                                        <span className="text-[10px] text-white/40 uppercase">Кадров с участием</span>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col">
                                        <span className="text-2xl font-bold text-primary">
                                            {relatedFrames.reduce((acc, f) => acc + f.duration, 0).toFixed(1)}s
                                        </span>
                                        <span className="text-[10px] text-white/40 uppercase">Экранное время</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Related Frames Strip */}
                    <div className="mt-8 pt-6 border-t border-white/10">
                        <div className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">movie_filter</span>
                            Сцены с участием объекта
                        </div>
                        <div className="flex gap-3 overflow-x-auto p-4 -mx-4 custom-scrollbar">
                            {relatedFrames.length > 0 ? relatedFrames.map((frame, idx) => {
                                const globalIndex = allFrames.findIndex(f => f.id === frame.id) + 1;
                                return (
                                    <button 
                                        key={frame.id}
                                        onClick={() => onJumpToFrame(idx)}
                                        className="relative shrink-0 w-32 aspect-video rounded-lg border border-white/10 hover:border-primary hover:scale-105 transition-all duration-200 group shadow-md hover:shadow-neon"
                                    >
                                        <div className="w-full h-full rounded-lg overflow-hidden">
                                             <img 
                                                src={frame.imageUrls[frame.activeVersionIndex]} 
                                                alt={`Scene ${idx}`} 
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors rounded-lg pointer-events-none"></div>
                                        <div className="absolute top-1 left-1 text-[9px] font-bold bg-black/60 px-1.5 py-0.5 rounded text-white border border-white/10 shadow-sm">
                                            #{globalIndex}
                                        </div>
                                        <div className="absolute bottom-1 right-1 text-[9px] font-bold bg-black/60 px-1 rounded text-white border border-white/10">
                                            {frame.duration}s
                                        </div>
                                    </button>
                                );
                            }) : (
                                <div className="text-white/30 text-sm italic">Нет связанных кадров (кроме источника)</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};