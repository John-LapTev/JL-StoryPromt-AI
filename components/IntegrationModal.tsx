import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { IntegrationConfig } from '../types';
import { integrateAssetIntoFrame, generateIntegrationSuggestions } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';

interface IntegrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: IntegrationConfig;
    onIntegrate: (result: { imageUrl: string, prompt: string }) => void;
}

type SourceAsset = IntegrationConfig['sourceAsset'];
type IntegrationMode = 'object' | 'style' | 'background';

// A robust component for displaying images within a constrained, flexible container.
const ImagePanel: React.FC<{ imageUrl: string | null, label: string, isLoading?: boolean, isResult?: boolean }> = ({ imageUrl, label, isLoading = false, isResult = false }) => (
    <div className="flex flex-col gap-2 text-center h-full">
        <h4 className="text-sm font-bold text-white/60 shrink-0">{label}</h4>
        <div className="relative w-full flex-1 rounded-lg bg-black/30 flex items-center justify-center border border-white/10 overflow-hidden min-h-0">
            {imageUrl ? (
                <img src={imageUrl} alt={label} className="absolute inset-0 w-full h-full object-contain" />
            ) : (
                (isLoading || isResult) && (
                    <div className="flex flex-col items-center text-white/50 p-4">
                        <div className={`w-10 h-10 border-4 border-primary rounded-full ${isLoading ? 'border-t-transparent animate-spin' : ''}`}></div>
                        {isLoading && <p className="text-sm mt-2">Применяем магию...</p>}
                        {!isLoading && isResult && <span className="material-symbols-outlined text-5xl absolute">auto_fix</span>}
                    </div>
                )
            )}
        </div>
    </div>
);


export const IntegrationModal: React.FC<IntegrationModalProps> = ({ isOpen, onClose, config, onIntegrate }) => {
    const [uiMode, setUiMode] = useState<'auto' | 'manual'>('auto');
    const [integrationMode, setIntegrationMode] = useState<IntegrationMode>('object');
    const [manualPrompt, setManualPrompt] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [isIntegrating, setIsIntegrating] = useState(false);
    const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);

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
            // Reset state on open
            setUiMode('auto');
            setIntegrationMode('object');
            setManualPrompt('');
            setResultImageUrl(null);
            setIsIntegrating(false);
            setSourceAsset(config.sourceAsset);
        }
    }, [isOpen, config]);

    useEffect(() => {
        if (sourceAsset) {
            fetchSuggestions();
        } else {
            setSuggestions([]);
        }
    }, [sourceAsset, fetchSuggestions, integrationMode]);

    if (!isOpen || !config) return null;

    const handleSourceFileChange = async (file: File | null) => {
        if (!file) return;
        try {
            const imageUrl = await fileToBase64(file);
            setSourceAsset({
                imageUrl,
                file,
                name: file.name
            });
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
    
    const handleIntegrate = async () => {
        if (!sourceAsset) {
            alert("Пожалуйста, загрузите исходный ассет для интеграции.");
            return;
        }

        setIsIntegrating(true);
        setResultImageUrl(null);
        try {
            let instruction = '';
            if (uiMode === 'manual' && manualPrompt.trim()) {
                instruction = manualPrompt;
            } else if (uiMode === 'manual' && !manualPrompt.trim()) {
                alert("Пожалуйста, введите инструкцию для ручного режима.");
                setIsIntegrating(false);
                return;
            } else { // 'auto' mode
                 switch(integrationMode) {
                    case 'object':
                        instruction = `Бесшовно и логично интегрируй «${sourceAsset.name}» в эту сцену.`;
                        break;
                    case 'style':
                        instruction = `Полностью перерисуй целевой кадр в художественном стиле ассета «${sourceAsset.name}», сохранив композицию и объекты целевого кадра.`;
                        break;
                    case 'background':
                        instruction = `Используй ассет «${sourceAsset.name}» как новый фон для целевого кадра, аккуратно вырезав и переместив на него основной объект из целевого кадра.`;
                        break;
                }
            }
            
            const result = await integrateAssetIntoFrame(sourceAsset, config.targetFrame, instruction, integrationMode);
            setResultImageUrl(result.imageUrl);
            
            setTimeout(() => {
                onIntegrate(result);
            }, 1500);

        } catch (error) {
            console.error("Error during integration:", error);
            alert(`Не удалось выполнить интеграцию: ${error instanceof Error ? error.message : String(error)}`);
             setIsIntegrating(false);
        } 
    };
    
    const placeholders: Record<IntegrationMode, string> = {
        object: `Бесшовно и логично интегрируй «${sourceAsset?.name || 'ассет'}» в эту сцену.`,
        style: "Например: применить только цветовую палитру, но сохранить детализацию",
        background: "Например: поместить персонажа на передний план, добавить туман"
    };

    const mainButtonLabels: Record<IntegrationMode, string> = {
        object: 'Интегрировать и применить',
        style: 'Применить стиль',
        background: 'Заменить фон'
    };
    
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-6xl w-full h-[90vh]" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <h3 className="text-xl font-bold shrink-0">Интеграция ассета</h3>
                
                {/* Image Panels */}
                <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* Source Asset Panel */}
                    <div className="flex flex-col gap-2 text-center h-full">
                        <div className="flex items-center justify-between">
                             <h4 className="text-sm font-bold text-white/60 shrink-0">Исходный ассет</h4>
                             <p className="text-xs text-white/50 truncate max-w-[150px]">{sourceAsset?.name || ''}</p>
                        </div>
                        <div
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsSourceDragOver(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsSourceDragOver(false); }}
                            onDrop={handleSourcePanelDrop}
                            className={`relative w-full flex-1 rounded-lg bg-black/30 flex items-center justify-center border transition-colors overflow-hidden min-h-0 ${isSourceDragOver ? 'border-primary bg-primary/20' : 'border-white/10'}`}
                        >
                            {sourceAsset ? (
                                <>
                                    <img src={sourceAsset.imageUrl} alt="Source Asset" className="absolute inset-0 w-full h-full object-contain" />
                                    <div className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center group/replace">
                                        <button onClick={() => sourceFileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">
                                            <span className="material-symbols-outlined">swap_horiz</span>
                                            Заменить
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-4 text-white/50">
                                    <span className="material-symbols-outlined text-5xl">upload_file</span>
                                    <p className="mt-2 text-sm">Перетащите или</p>
                                    <button onClick={() => sourceFileInputRef.current?.click()} className="mt-1 text-primary font-bold hover:underline">
                                        загрузите ассет
                                    </button>
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
                    <ImagePanel imageUrl={config.targetFrame.imageUrls[config.targetFrame.activeVersionIndex]} label="Целевой кадр" />
                    <ImagePanel imageUrl={resultImageUrl} label="Результат" isLoading={isIntegrating} isResult />
                </div>

                {/* Controls Section */}
                <div className="shrink-0 pt-4 border-t border-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1: Mode Selection */}
                        <div className="flex flex-col gap-3">
                             <h4 className="text-sm font-bold text-white/80">Режим</h4>
                             <div className="flex flex-col gap-1 p-1 bg-black/20 rounded-lg">
                                <button onClick={() => setIntegrationMode('object')} className={`flex items-center gap-3 w-full p-2 rounded-md text-sm font-bold transition-colors text-left ${integrationMode === 'object' ? 'bg-primary text-white' : 'text-white/80 hover:bg-white/10'}`}>
                                    <span className="material-symbols-outlined">place_item</span> Интегрировать объект
                                </button>
                                <button onClick={() => setIntegrationMode('style')} className={`flex items-center gap-3 w-full p-2 rounded-md text-sm font-bold transition-colors text-left ${integrationMode === 'style' ? 'bg-primary text-white' : 'text-white/80 hover:bg-white/10'}`}>
                                    <span className="material-symbols-outlined">style</span> Применить стиль
                                </button>
                                <button onClick={() => setIntegrationMode('background')} className={`flex items-center gap-3 w-full p-2 rounded-md text-sm font-bold transition-colors text-left ${integrationMode === 'background' ? 'bg-primary text-white' : 'text-white/80 hover:bg-white/10'}`}>
                                    <span className="material-symbols-outlined">landscape</span> Заменить фон
                                </button>
                             </div>
                        </div>
                        
                        {/* Column 2 & 3: Manual Controls */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-white/80" htmlFor="manual-prompt-textarea">Ручная настройка</label>
                                <textarea
                                    id="manual-prompt-textarea"
                                    value={manualPrompt}
                                    onChange={(e) => {
                                        setManualPrompt(e.target.value)
                                        setUiMode('manual')
                                    }}
                                    placeholder={placeholders[integrationMode]}
                                    className="w-full flex-1 bg-white/5 p-3 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-none"
                                    aria-label="Manual integration instruction"
                                />
                                <button onClick={() => { setManualPrompt(''); setUiMode('auto'); }} className="text-xs text-cyan-400 hover:underline self-start">Сбросить и использовать авто-режим</button>
                            </div>
                            <fieldset disabled={!sourceAsset} className="flex flex-col gap-2 disabled:opacity-50 transition-opacity">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-white/80">Идеи от AI</h4>
                                    <button onClick={fetchSuggestions} disabled={isLoadingSuggestions || !sourceAsset} className="text-white/60 hover:text-white disabled:text-white/30 disabled:cursor-wait p-1 rounded-full" title="Сгенерировать новые идеи">
                                        <span className={`material-symbols-outlined text-lg ${isLoadingSuggestions ? 'animate-spin' : ''}`}>refresh</span>
                                    </button>
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    {isLoadingSuggestions ? (
                                        Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-full bg-white/5 rounded-lg animate-pulse min-h-[60px]"></div>)
                                    ) : suggestions.length > 0 ? (
                                        suggestions.slice(0, 4).map((s, i) => (
                                            <button key={i} onClick={() => { setManualPrompt(s); setUiMode('manual'); }} className="p-2 bg-white/5 rounded-lg text-xs text-center text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center">
                                                {s}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="col-span-2 text-xs text-white/50 text-center py-4 bg-white/5 rounded-lg flex items-center justify-center">
                                            {sourceAsset ? "Не удалось сгенерировать идеи." : "Загрузите ассет, чтобы получить идеи."}
                                        </div>
                                    )}
                                </div>
                            </fieldset>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10 shrink-0">
                    <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">
                        Отмена
                    </button>
                    <button 
                        onClick={handleIntegrate}
                        disabled={isIntegrating || !sourceAsset}
                        className="flex min-w-[180px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed"
                    >
                        {isIntegrating ? 'Применение...' : mainButtonLabels[integrationMode]}
                    </button>
                </div>
            </div>
        </div>
    );
};