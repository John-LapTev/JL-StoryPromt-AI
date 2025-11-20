
import React, { useState, useEffect } from 'react';
import type { Asset, StorySettings } from '../types';
import { generateStoryIdeasFromAssets } from '../services/geminiService';

interface StorySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: StorySettings;
    onSave: (settings: StorySettings) => void;
    assets: Asset[];
    frameCount: number;
    onFrameCountChange: (count: number) => void;
}

type StoryIdea = {
    title: string;
    synopsis: string;
};

const genres = ["Научная фантастика", "Драма", "Комедия", "Триллер", "Фэнтези", "Хоррор"];
const endings = ["Счастливая", "Трагическая", "Открытый финал"];

export const StorySettingsModal: React.FC<StorySettingsModalProps> = ({ 
    isOpen, onClose, settings, onSave, assets, frameCount, onFrameCountChange,
}) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [storyIdeas, setStoryIdeas] = useState<StoryIdea[]>([]);
    const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
        setStoryIdeas([]);
    }, [settings, isOpen]);

    const handleSave = () => { onSave(localSettings); };
    const handleModeChange = (mode: 'auto' | 'manual') => { setLocalSettings(prev => ({ ...prev, mode })); };
    const handleFieldChange = (field: keyof StorySettings, value: any) => { setLocalSettings(prev => ({ ...prev, [field]: value })); };

    const handleGenerateIdeas = async () => {
        if (assets.length === 0) {
            alert("Пожалуйста, добавьте ассеты в библиотеку, чтобы сгенерировать идеи.");
            return;
        }
        setIsLoadingIdeas(true);
        setStoryIdeas([]);
        try {
            const ideas = await generateStoryIdeasFromAssets(assets, localSettings);
            setStoryIdeas(ideas);
        } catch (error) {
            console.error("Failed to generate story ideas:", error);
            alert(`Не удалось сгенерировать идеи: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsLoadingIdeas(false);
        }
    };
    
    const StyledSelect: React.FC<{id: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, children: React.ReactNode}> = ({ id, value, onChange, children }) => (
        <div className="relative group">
            <select
                id={id}
                value={value}
                onChange={onChange}
                className="w-full appearance-none glass-input text-white/90 text-sm rounded-lg px-4 py-3 pr-10"
            >
                {children}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50 group-hover:text-white/80 transition-colors">
                expand_more
            </span>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col max-w-2xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex flex-col gap-6 flex-1 min-h-0">
                     <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
                        <h3 className="text-xl font-bold font-display text-white tracking-wide">Настройки сюжета</h3>
                        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                
                    <div className="flex w-full p-1 bg-black/20 rounded-xl border border-white/5 shrink-0">
                         <button onClick={() => handleModeChange('auto')} className={`w-1/2 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${localSettings.mode === 'auto' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>Автоматический</button>
                        <button onClick={() => handleModeChange('manual')} className={`w-1/2 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${localSettings.mode === 'manual' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>Ручной</button>
                    </div>
                
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-6">
                        <fieldset disabled={localSettings.mode === 'auto'} className="space-y-5 disabled:opacity-50 transition-opacity">
                            <div className="space-y-2">
                                <label htmlFor="story-prompt" className="text-xs font-bold text-white/60 uppercase tracking-wider">
                                    Идея сюжета <span className="font-normal text-white/30 ml-1 normal-case">(необязательно)</span>
                                </label>
                                <textarea
                                    id="story-prompt"
                                    value={localSettings.prompt}
                                    onChange={(e) => handleFieldChange('prompt', e.target.value)}
                                    placeholder="Опишите идею, например: История о роботе, который нашел котенка..."
                                    className="w-full h-32 glass-input rounded-lg p-4 text-sm placeholder:text-white/30 resize-y"
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                 <div className="space-y-2">
                                    <label htmlFor="story-genre" className="text-xs font-bold text-white/60 uppercase tracking-wider">Жанр</label>
                                     <StyledSelect id="story-genre" value={localSettings.genre} onChange={(e) => handleFieldChange('genre', e.target.value)}>
                                        <option value="" className="bg-surface text-white/50">Не выбрано</option>
                                        {genres.map(g => <option key={g} value={g} className="bg-surface text-white">{g}</option>)}
                                    </StyledSelect>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="story-ending" className="text-xs font-bold text-white/60 uppercase tracking-wider">Концовка</label>
                                    <StyledSelect id="story-ending" value={localSettings.ending} onChange={(e) => handleFieldChange('ending', e.target.value)}>
                                        <option value="" className="bg-surface text-white/50">Не выбрано</option>
                                        {endings.map(e => <option key={e} value={e} className="bg-surface text-white">{e}</option>)}
                                    </StyledSelect>
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-5 space-y-4">
                                 <button onClick={handleGenerateIdeas} disabled={isLoadingIdeas} className="w-full glass-button flex items-center justify-center gap-2 py-3 rounded-xl text-indigo-200 text-sm font-bold hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-wait">
                                    {isLoadingIdeas ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <span className="material-symbols-outlined text-lg">lightbulb</span>}
                                    <span>{isLoadingIdeas ? 'Генерация...' : 'Предложить идеи (AI)'}</span>
                                </button>

                                 {isLoadingIdeas ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse"></div>)}
                                    </div>
                                ) : storyIdeas.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                                        {storyIdeas.map((idea, i) => (
                                            <button key={i} onClick={() => handleFieldChange('prompt', idea.synopsis)} className="glass-button p-3 rounded-xl text-left group">
                                                <p className="font-bold text-xs text-primary group-hover:text-primary-light mb-1">{idea.title}</p>
                                                <p className="text-xs text-white/70 line-clamp-3">{idea.synopsis}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </fieldset>
                        
                         <div className="pt-5 border-t border-white/10">
                             <label htmlFor="frame-count-modal" className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 block">Количество кадров</label>
                             <input
                                type="number"
                                id="frame-count-modal"
                                value={frameCount}
                                onChange={(e) => onFrameCountChange(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2)))}
                                min="2"
                                max="20"
                                className="w-full glass-input rounded-lg p-3 text-sm font-bold"
                             />
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 p-4 rounded-b-2xl flex justify-end gap-3 border-t border-white/10 shrink-0 backdrop-blur-md">
                    <button onClick={onClose} className="glass-button px-5 py-2.5 rounded-lg text-sm font-medium text-white/70">Отмена</button>
                    <button onClick={handleSave} className="glass-button-primary px-6 py-2.5 rounded-lg text-white text-sm font-bold">Сохранить</button>
                </div>
            </div>
        </div>
    );
};
