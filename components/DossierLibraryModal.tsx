
import React from 'react';
import type { ActorDossier, Frame } from '../types';

interface DossierLibraryModalProps {
    dossiers: ActorDossier[];
    frames: Frame[];
    onClose: () => void;
    onSelectDossier: (dossier: ActorDossier) => void;
}

export const DossierLibraryModal: React.FC<DossierLibraryModalProps> = ({ dossiers, frames, onClose, onSelectDossier }) => {
    
    const getBadgeIcon = (type?: string) => {
        switch(type) { case 'object': return 'deployed_code'; case 'location': return 'landscape'; case 'character': default: return 'face'; }
    };

    const getSceneCount = (sourceHash: string) => {
        return frames.filter(f => f.sourceHash === sourceHash).length;
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col w-full max-w-4xl h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-white/10 shrink-0 bg-white/5 rounded-t-2xl flex items-center justify-between backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-2xl text-primary-light">folder_shared</span>
                        <h3 className="text-xl font-bold font-display text-white tracking-wide">Картотека (Dossier)</h3>
                    </div>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {dossiers.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {dossiers.map((dossier, index) => {
                                const count = getSceneCount(dossier.sourceHash);
                                return (
                                    <button
                                        key={dossier.sourceHash + index}
                                        onClick={() => onSelectDossier(dossier)}
                                        className="group relative aspect-square rounded-xl bg-black/40 border border-white/10 hover:border-primary/50 transition-all overflow-hidden flex flex-col shadow-lg hover:shadow-neon"
                                    >
                                        <img 
                                            src={dossier.referenceImageUrl} 
                                            alt={dossier.roleLabel} 
                                            className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                                        
                                        <div className="absolute top-2 right-2 size-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center backdrop-blur-md">
                                            <span className="material-symbols-outlined text-base text-white/80">{getBadgeIcon(dossier.type)}</span>
                                        </div>
                                        
                                        {/* Scene Count Badge */}
                                        <div className="absolute top-2 left-2 bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md border border-white/10 flex items-center gap-1">
                                             <span className="material-symbols-outlined text-[10px]">movie</span>
                                             {count}
                                        </div>

                                        <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                                            <p className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-0.5">{dossier.type || 'Object'}</p>
                                            <p className="text-sm font-bold text-white truncate">{dossier.roleLabel || 'Unnamed'}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-white/30 gap-4">
                            <div className="size-20 rounded-full bg-white/5 flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl">folder_open</span>
                            </div>
                            <p className="text-lg">Картотека пуста</p>
                            <p className="text-sm max-w-xs text-center">Адаптируйте кадры или интегрируйте объекты, чтобы автоматически создать досье.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
