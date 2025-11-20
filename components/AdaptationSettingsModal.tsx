
import React, { useState, useEffect, useCallback } from 'react';
import type { Frame } from '../types';
import { generateAdaptationSuggestions } from '../services/geminiService';

interface AdaptationSettingsModalProps {
    frame: Frame | null;
    allFrames: Frame[];
    onClose: () => void;
    onAdapt: (frameId: string, instruction?: string) => void;
}

export const AdaptationSettingsModal: React.FC<AdaptationSettingsModalProps> = ({ frame, allFrames, onClose, onAdapt }) => {
    const [mode, setMode] = useState<'auto' | 'manual'>('auto');
    const [manualPrompt, setManualPrompt] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    
    const frameIndex = frame ? allFrames.findIndex(f => f.id === frame.id) : -1;
    const leftFrame = frameIndex > 0 ? allFrames[frameIndex - 1] : null;
    const rightFrame = frameIndex < allFrames.length - 1 ? allFrames[frameIndex + 1] : null;

    const fetchSuggestions = useCallback(async () => {
        if (!frame) return;
        setIsLoadingSuggestions(true);
        setSuggestions([]);
        try {
            const newSuggestions = await generateAdaptationSuggestions(frame, leftFrame, rightFrame);
            setSuggestions(newSuggestions);
        } catch (error) {
            console.error("Failed to get adaptation suggestions:", error);
        } finally {
            setIsLoadingSuggestions(false);
        }
    }, [frame, leftFrame, rightFrame]);

    useEffect(() => {
        if (frame) {
            fetchSuggestions();
        }
    }, [frame, fetchSuggestions]);
    
    if (!frame) return null;

    const handleAdaptClick = () => {
        if (mode === 'auto') {
            onAdapt(frame.id);
        } else if (mode === 'manual' && manualPrompt.trim()) {
            onAdapt(frame.id, manualPrompt);
        }
    };
    
    const activeImageUrl = frame.imageUrls[frame.activeVersionIndex];
    
    const CompactFrame: React.FC<{ frame: Frame | null, label: string, className?: string, isMain?: boolean }> = ({ frame, label, className, isMain = false }) => (
        <div className={`flex flex-col gap-2 text-center ${className}`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${isMain ? 'text-cyan-400' : 'text-white/60'}`}>{label}</h4>
            <div className={`w-full aspect-video rounded-lg bg-black/30 flex items-center justify-center border ${isMain ? 'border-2 border-primary' : 'border-white/10'}`}>
                {frame ? (
                    <img src={frame.imageUrls[frame.activeVersionIndex]} alt={label} className="max-h-full max-w-full object-contain rounded-md" />
                ) : (
                    <span className="material-symbols-outlined text-4xl text-white/20">image</span>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                 <div className="p-6 border-b border-white/10 shrink-0 bg-white/5 rounded-t-2xl backdrop-blur-md">
                    <h3 className="text-xl font-bold text-white">Настройки адаптации кадра</h3>
                </div>
                
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-2 -mr-2 space-y-4 p-6">
                     <div className="flex w-full max-w-sm mx-auto p-1 bg-black/20 rounded-lg shrink-0 border border-white/5">
                        <button onClick={() => setMode('auto')} className={`w-1/2 p-2 rounded-md text-sm font-bold transition-colors ${mode === 'auto' ? 'bg-primary text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}>Автоматическая</button>
                        <button onClick={() => setMode('manual')} className={`w-1/2 p-2 rounded-md text-sm font-bold transition-colors ${mode === 'manual' ? 'bg-primary text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}>Ручная</button>
                    </div>

                    <div className="flex justify-center items-center gap-4 py-4 shrink-0">
                        <CompactFrame frame={leftFrame} label="Кадр до" className="w-48" />
                        <span className="material-symbols-outlined text-4xl text-white/30">arrow_forward</span>
                        <CompactFrame frame={frame} label="Ваш кадр" className="w-64" isMain={true} />
                        <span className="material-symbols-outlined text-4xl text-white/30">arrow_forward</span>
                        <CompactFrame frame={rightFrame} label="Кадр после" className="w-48" />
                    </div>

                    <fieldset disabled={mode === 'auto'} className={`space-y-4 transition-opacity duration-300 ${mode === 'auto' ? 'opacity-50' : 'opacity-100'}`}>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-white/80" htmlFor="manual-prompt-textarea">Ваша инструкция:</label>
                            <textarea
                                id="manual-prompt-textarea"
                                value={manualPrompt}
                                onChange={(e) => setManualPrompt(e.target.value)}
                                placeholder="Например: Сделать этого персонажа в стиле аниме 80-х..."
                                className="w-full h-24 glass-input p-3 rounded-lg text-sm placeholder:text-white/40 resize-none"
                                aria-label="Manual adaptation instruction"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-white/80">Идеи от AI</h4>
                                <button onClick={fetchSuggestions} disabled={isLoadingSuggestions} className="text-white/60 hover:text-white disabled:text-white/30 disabled:cursor-wait p-1 rounded-full" title="Сгенерировать новые идеи">
                                    <span className={`material-symbols-outlined text-lg ${isLoadingSuggestions ? 'animate-spin' : ''}`}>refresh</span>
                                </button>
                            </div>
                            {isLoadingSuggestions ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse"></div>)}
                                </div>
                            ) : suggestions.length > 0 ? (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    {suggestions.slice(0, 4).map((s, i) => (
                                        <button key={i} onClick={() => setManualPrompt(s)} className="glass-button p-3 min-h-[80px] rounded-lg text-xs text-left text-white/80 flex items-center justify-center text-center">
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-white/50 text-center py-4 bg-white/5 rounded-lg">Не удалось сгенерировать идеи.</div>
                            )}
                        </div>
                    </fieldset>
                </div>

                <div className="flex justify-end gap-3 mt-auto p-4 border-t border-white/10 shrink-0 bg-white/5 rounded-b-2xl backdrop-blur-md">
                    <button onClick={onClose} className="glass-button px-5 py-2.5 rounded-lg text-sm font-medium text-white/70">Отмена</button>
                    <button 
                        onClick={handleAdaptClick}
                        disabled={mode === 'manual' && !manualPrompt.trim()}
                        className="glass-button-primary px-6 py-2.5 rounded-lg text-white text-sm font-bold flex min-w-[180px] items-center justify-center"
                    >
                        {mode === 'auto' ? 'Адаптировать автоматически' : 'Адаптировать вручную'}
                    </button>
                </div>
            </div>
        </div>
    );
};
