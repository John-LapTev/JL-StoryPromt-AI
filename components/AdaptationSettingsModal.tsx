import React, { useState, useEffect, useCallback } from 'react';
import type { Frame } from '../types';
import { generateAdaptationSuggestions } from '../services/geminiService';

interface AdaptationSettingsModalProps {
    frame: Frame | null;
    allFrames: Frame[];
    onClose: () => void;
    onAdapt: (frameId: string, instruction?: string) => void;
}

const ContextFrame: React.FC<{ frame: Frame | null, label: string }> = ({ frame, label }) => (
    <div className="flex flex-col gap-2 text-center">
        <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">{label}</h4>
        <div className="aspect-video w-full rounded-lg bg-black/30 flex items-center justify-center border border-white/10">
            {frame ? (
                <img src={frame.imageUrls[frame.activeVersionIndex]} alt={label} className="max-h-full max-w-full object-contain rounded-md" />
            ) : (
                <span className="material-symbols-outlined text-4xl text-white/20">image</span>
            )}
        </div>
    </div>
);


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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold shrink-0">Настройки адаптации кадра</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                    {/* Left Column - Visual Context */}
                    <div className="flex flex-col gap-4">
                        <ContextFrame frame={leftFrame} label="Кадр до" />
                        <div className="flex flex-col gap-2 text-center">
                            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Ваш кадр для адаптации</h4>
                            <div className="aspect-video w-full rounded-lg bg-black/30 flex items-center justify-center border-2 border-primary">
                                <img src={activeImageUrl} alt="Адаптируемый кадр" className="max-h-full max-w-full object-contain rounded-md" />
                            </div>
                        </div>
                        <ContextFrame frame={rightFrame} label="Кадр после" />
                    </div>

                    {/* Right Column - Controls */}
                    <div className="flex flex-col gap-4">
                         <div className="flex w-full p-1 bg-black/20 rounded-lg">
                            <button
                                onClick={() => setMode('auto')}
                                className={`w-1/2 p-2 rounded-md text-sm font-bold transition-colors ${mode === 'auto' ? 'bg-primary text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}
                            >
                                Автоматическая
                            </button>
                            <button
                                onClick={() => setMode('manual')}
                                className={`w-1/2 p-2 rounded-md text-sm font-bold transition-colors ${mode === 'manual' ? 'bg-primary text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}
                            >
                                Ручная
                            </button>
                        </div>
                        
                        <div className={`transition-opacity duration-300 ${mode === 'auto' ? 'opacity-50' : 'opacity-100'}`}>
                             <fieldset disabled={mode === 'auto'} className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-white/80" htmlFor="manual-prompt-textarea">Ваша инструкция:</label>
                                    <textarea
                                        id="manual-prompt-textarea"
                                        value={manualPrompt}
                                        onChange={(e) => setManualPrompt(e.target.value)}
                                        placeholder="Например: Сделать этого персонажа в стиле аниме 80-х..."
                                        className="w-full h-24 bg-white/5 p-3 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-none"
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
                                        <div className="grid grid-cols-2 gap-3">
                                            {suggestions.slice(0, 4).map((s, i) => (
                                                <button key={i} onClick={() => setManualPrompt(s)} className="p-3 min-h-[80px] bg-white/5 rounded-lg text-xs text-left text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center text-center">
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
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10 shrink-0">
                    <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">Отмена</button>
                    <button 
                        onClick={handleAdaptClick}
                        disabled={mode === 'manual' && !manualPrompt.trim()}
                        className="flex min-w-[180px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed"
                    >
                        {mode === 'auto' ? 'Адаптировать автоматически' : 'Адаптировать вручную'}
                    </button>
                </div>
            </div>
        </div>
    );
};