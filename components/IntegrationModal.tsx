
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { IntegrationConfig } from '../types';
import { generateIntegrationSuggestions } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';

interface IntegrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: IntegrationConfig;
    onIntegrateAction: (instruction: string, mode: string) => void; // Renamed to avoid confusion, now acts as action trigger
    onZoomImage: (imageUrl: string, title: string) => void;
    // Removed unused props like onIntegrate (old style)
}

type SourceAsset = IntegrationConfig['sourceAsset'];
type IntegrationMode = 'object' | 'style' | 'background';

const ImagePanel: React.FC<{ imageUrl: string | null, label: string, onZoom: (imageUrl: string, title: string) => void }> = ({ imageUrl, label, onZoom }) => (
    <div className="flex flex-col gap-2 text-center h-full bg-white/5 p-2 rounded-xl border border-white/5">
        <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider shrink-0">{label}</h4>
        <div className="relative w-full flex-1 rounded-lg bg-black/40 flex items-center justify-center border border-white/10 overflow-hidden min-h-0 group/panel">
            {imageUrl ? (
                <>
                    <img src={imageUrl} alt={label} className="absolute inset-0 w-full h-full object-contain p-1" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/panel:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => onZoom(imageUrl, label)} className="p-2 bg-white/10 rounded-full hover:bg-primary hover:text-white text-white/80 transition-colors" aria-label={`Увеличить ${label}`}>
                            <span className="material-symbols-outlined text-2xl">zoom_in</span>
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center text-white/50 p-4 gap-3">
                     <span className="material-symbols-outlined text-4xl opacity-50">image</span>
                </div>
            )}
        </div>
    </div>
);


export const IntegrationModal: React.FC<IntegrationModalProps> = ({ isOpen, onClose, config, onIntegrateAction, onZoomImage }) => {
    const [uiMode, setUiMode] = useState<'auto' | 'manual'>('auto');
    const [integrationMode, setIntegrationMode] = useState<IntegrationMode>('object');
    const [manualPrompt, setManualPrompt] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    const [sourceAsset, setSourceAsset] = useState<SourceAsset>(undefined);
    const [isSourceDragOver, setIsSourceDragOver] = useState(false);
    const sourceFileInputRef = useRef<HTMLInputElement>(null);
    

    const fetchSuggestions = useCallback(async () => {
        if (!config || !sourceAsset) return;
        setIsLoadingSuggestions(true);
        setSuggestions([]);
        try {
            const newSuggestions = await generateIntegrationSuggestions(sourceAsset, config.targetFrame, integrationMode);
            setSuggestions(newSuggestions);
        } catch (error) {
            console.error("Failed to get integration suggestions:", error);
        } finally {
            setIsLoadingSuggestions(false);
        }
    }, [config, sourceAsset, integrationMode]);

    useEffect(() => {
        if (isOpen) {
            setUiMode('auto');
            setIntegrationMode('object');
            setManualPrompt('');
            setSourceAsset(config.sourceAsset);
            setSuggestions([]); // Clear previous suggestions
        }
    }, [isOpen, config]);

    if (!isOpen || !config) return null;

    const handleSourceFileChange = async (file: File | null) => {
        if (!file) return;
        try {
            const imageUrl = await fileToBase64(file);
            setSourceAsset({ imageUrl, file, name: file.name });
        } catch (error) {
            console.error("Error reading file:", error);
            alert("Не удалось загрузить файл изображения.");
        }
    };

    const handleSourcePanelDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSourceDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleSourceFileChange(file);
        }
    };
    
    const handleIntegrateClick = () => {
        if (!sourceAsset) {
            alert("Пожалуйста, загрузите исходный ассет для интеграции.");
            return;
        }
        
        let instruction = '';
        if (uiMode === 'manual' && manualPrompt.trim()) {
            instruction = manualPrompt;
        } else if (uiMode === 'manual' && !manualPrompt.trim()) {
            alert("Пожалуйста, введите инструкцию для ручного режима.");
            return;
        } else {
                switch(integrationMode) {
                case 'object': instruction = `Бесшовно и логично интегрируй «${sourceAsset.name}» в эту сцену.`; break;
                case 'style': instruction = `Полностью перерисуй целевой кадр в художественном стиле ассета «${sourceAsset.name}», сохранив композицию и объекты целевого кадра.`; break;
                case 'background': instruction = `Используй ассет «${sourceAsset.name}» как новый фон для целевого кадра, аккуратно вырезав и переместив на него основной объект из целевого кадра.`; break;
            }
        }
        
        // Pass back to parent immediately
        onIntegrateAction(instruction, integrationMode);
    };
    
    const placeholders: Record<IntegrationMode, string> = {
        object: `Бесшовно и логично интегрируй «${sourceAsset?.name || 'ассет'}» в эту сцену.`,
        style: "Например: применить только цветовую палитру, но сохранить детализацию",
        background: "Например: поместить персонажа на передний план, добавить туман"
    };

    const mainButtonLabels: Record<IntegrationMode, string> = {
        object: 'Интегрировать объект',
        style: 'Применить стиль',
        background: 'Заменить фон'
    };
    
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col w-full max-w-6xl h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-white/10 shrink-0 bg-white/5 rounded-t-2xl">
                    <h3 className="text-xl font-bold font-display text-white tracking-wide">Интеграция ассета</h3>
                     <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-6 flex-1 min-h-0 p-6">
                    <div className="flex flex-col gap-2 text-center h-full bg-white/5 p-2 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                             <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider shrink-0">Исходный ассет</h4>
                             <p className="text-[10px] text-white/50 truncate max-w-[150px] font-mono">{sourceAsset?.name || ''}</p>
                        </div>
                        <div
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsSourceDragOver(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsSourceDragOver(false); }}
                            onDrop={handleSourcePanelDrop}
                            className={`relative w-full flex-1 rounded-lg bg-black/40 flex items-center justify-center border transition-all overflow-hidden min-h-0 group/source ${isSourceDragOver ? 'border-primary bg-primary/10' : 'border-white/10'}`}
                        >
                            {sourceAsset ? (
                                <>
                                    <img src={sourceAsset.imageUrl} alt="Source Asset" className="absolute inset-0 w-full h-full object-contain p-1" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/source:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button onClick={() => onZoomImage(sourceAsset.imageUrl, 'Исходный ассет')} className="p-2 bg-white/10 rounded-full hover:bg-primary hover:text-white text-white/80 transition-colors" aria-label="Увеличить">
                                            <span className="material-symbols-outlined text-2xl">zoom_in</span>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); sourceFileInputRef.current?.click(); }} className="p-2 bg-white/10 rounded-full hover:bg-white/30 text-white/80 transition-colors" title="Заменить">
                                            <span className="material-symbols-outlined text-2xl">swap_horiz</span>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-4 text-white/30 hover:text-primary/80 transition-colors cursor-pointer" onClick={() => sourceFileInputRef.current?.click()}>
                                    <span className="material-symbols-outlined text-5xl mb-2">upload_file</span>
                                    <p className="text-xs font-bold">Перетащите или кликните</p>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={sourceFileInputRef}
                            onChange={(e) => handleSourceFileChange(e.target.files?.[0] || null)}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>
                    <ImagePanel imageUrl={config.targetFrame.imageUrls[config.targetFrame.activeVersionIndex]} label="Целевой кадр" onZoom={onZoomImage} />
                </div>

                <div className="shrink-0 p-6 bg-white/5 rounded-b-2xl border-t border-white/10 backdrop-blur-md">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="flex flex-col gap-3">
                             <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">Режим интеграции</h4>
                             <div className="flex flex-col gap-2">
                                <button onClick={() => setIntegrationMode('object')} className={`glass-button flex items-center gap-3 w-full p-3 rounded-lg text-sm font-bold ${integrationMode === 'object' ? 'bg-primary/20 border-primary text-white' : 'text-white/60'}`}>
                                    <span className="material-symbols-outlined">place_item</span> Интеграция объекта
                                </button>
                                <button onClick={() => setIntegrationMode('style')} className={`glass-button flex items-center gap-3 w-full p-3 rounded-lg text-sm font-bold ${integrationMode === 'style' ? 'bg-primary/20 border-primary text-white' : 'text-white/60'}`}>
                                    <span className="material-symbols-outlined">palette</span> Стиль / Текстура
                                </button>
                                <button onClick={() => setIntegrationMode('background')} className={`glass-button flex items-center gap-3 w-full p-3 rounded-lg text-sm font-bold ${integrationMode === 'background' ? 'bg-primary/20 border-primary text-white' : 'text-white/60'}`}>
                                    <span className="material-symbols-outlined">wallpaper</span> Замена фона
                                </button>
                             </div>
                        </div>
                        
                        <div className="lg:col-span-2 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Промт / Инструкция</label>
                                <button onClick={() => { setManualPrompt(''); setUiMode('auto'); }} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wide">Авто-режим</button>
                            </div>
                             <div className="flex gap-4 h-full">
                                 <textarea
                                    id="manual-prompt-textarea"
                                    value={manualPrompt}
                                    onChange={(e) => { setManualPrompt(e.target.value); setUiMode('manual'); }}
                                    placeholder={placeholders[integrationMode]}
                                    className="flex-1 glass-input p-4 rounded-lg text-sm placeholder:text-white/20 resize-none"
                                />
                                <div className="w-1/3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[10px] font-bold text-white/40 uppercase">Идеи AI</span>
                                        <button onClick={fetchSuggestions} disabled={isLoadingSuggestions || !sourceAsset} className="text-white/50 hover:text-white transition-colors disabled:opacity-30" title="Сгенерировать идеи">
                                            <span className={`material-symbols-outlined text-sm ${isLoadingSuggestions ? 'animate-spin' : ''}`}>lightbulb</span>
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                                         {suggestions.length > 0 ? (
                                            suggestions.map((s, i) => (
                                                <button key={i} onClick={() => { setManualPrompt(s); setUiMode('manual'); }} className="glass-button p-2 rounded-lg text-xs text-left text-white/70">
                                                    {s}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-xs text-white/30 text-center p-2 border-2 border-dashed border-white/5 rounded-lg">
                                                {isLoadingSuggestions ? 'Генерация...' : (sourceAsset ? "Нажмите лампочку" : "Нужен ассет")}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={onClose} className="glass-button px-5 py-2.5 rounded-lg text-sm font-medium text-white/70">
                            Отмена
                        </button>
                        <button 
                            onClick={handleIntegrateClick}
                            disabled={!sourceAsset}
                            className="glass-button-primary px-8 py-2.5 rounded-lg text-white text-sm font-bold flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">auto_awesome</span>
                            <span>{mainButtonLabels[integrationMode]}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
