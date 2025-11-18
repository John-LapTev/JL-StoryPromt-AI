
import React, { useState, useEffect } from 'react';
import type { StorySettings } from '../types';

interface StorySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: StorySettings;
    onSave: (settings: Omit<StorySettings, 'frameCount'>) => void;
}

const genres = ["Научная фантастика", "Драма", "Комедия", "Триллер", "Фэнтези", "Хоррор"];
const endings = ["Счастливая", "Трагическая", "Открытый финал"];

export const StorySettingsModal: React.FC<StorySettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    const handleSave = () => {
        onSave(localSettings);
    };

    const handleModeChange = (mode: 'auto' | 'manual') => {
        setLocalSettings(prev => ({ ...prev, mode }));
    };

    const handleFieldChange = (field: keyof Omit<StorySettings, 'frameCount'>, value: any) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };
    
    const StyledSelect: React.FC<{id: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, children: React.ReactNode}> = ({ id, value, onChange, children }) => (
        <div className="relative">
            <select
                id={id}
                value={value}
                onChange={onChange}
                className="w-full appearance-none bg-white/5 p-2 rounded-lg text-sm text-white/90 focus:ring-2 focus:ring-primary border-none pr-8"
            >
                {children}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/50">
                expand_more
            </span>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-2xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold">Настройки создания сюжета</h3>
                
                <div className="flex w-full p-1 bg-black/20 rounded-lg">
                     <button
                        onClick={() => handleModeChange('auto')}
                        className={`w-1/2 p-2 rounded-md text-sm font-bold transition-colors ${localSettings.mode === 'auto' ? 'bg-primary text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}
                    >
                        Автоматический
                    </button>
                    <button
                        onClick={() => handleModeChange('manual')}
                        className={`w-1/2 p-2 rounded-md text-sm font-bold transition-colors ${localSettings.mode === 'manual' ? 'bg-primary text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}
                    >
                        Ручной
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4 py-2">
                    <fieldset disabled={localSettings.mode === 'auto'} className="space-y-4 disabled:opacity-50 transition-opacity">
                        <div>
                            <label htmlFor="story-prompt" className="text-sm font-bold text-white/70 mb-1 block">
                                Основная идея сюжета <span className="font-normal text-white/50">(необязательно)</span>
                            </label>
                            <textarea
                                id="story-prompt"
                                value={localSettings.prompt}
                                onChange={(e) => handleFieldChange('prompt', e.target.value)}
                                placeholder="Например: История о роботе, который нашел потерявшегося котенка в киберпанк-городе..."
                                className="w-full h-28 bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-y"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="story-genre" className="text-sm font-bold text-white/70 mb-1 block">Жанр / Тональность</label>
                                 <StyledSelect
                                    id="story-genre"
                                    value={localSettings.genre}
                                    onChange={(e) => handleFieldChange('genre', e.target.value)}
                                >
                                    <option value="">Не выбрано</option>
                                    {genres.map(g => <option key={g} value={g}>{g}</option>)}
                                </StyledSelect>
                            </div>
                            <div>
                                <label htmlFor="story-ending" className="text-sm font-bold text-white/70 mb-1 block">Тип концовки</label>
                                <StyledSelect
                                    id="story-ending"
                                    value={localSettings.ending}
                                    onChange={(e) => handleFieldChange('ending', e.target.value)}
                                >
                                    <option value="">Не выбрано</option>
                                    {endings.map(e => <option key={e} value={e}>{e}</option>)}
                                </StyledSelect>
                            </div>
                        </div>
                    </fieldset>
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
                    <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">
                        Отмена
                    </button>
                    <button onClick={handleSave} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90">
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
};