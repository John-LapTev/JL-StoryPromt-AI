
import React, { useState, useEffect, useCallback } from 'react';
import type { Frame, Position } from '../types';
import { generateEditSuggestions, editImage, generatePromptSuggestions } from '../services/geminiService';

interface AdvancedGenerateModalProps {
    onClose: () => void;
    onGenerate?: (data: { prompt: string; position?: Position, aspectRatio?: string }) => void;
    onApplyEdit?: (frameId: string, newImageUrl: string, newPrompt: string) => void;
    config: {
        mode: 'generate' | 'edit' | 'generate-sketch';
        frameToEdit?: Frame;
        insertIndex?: number;
        position?: Position;
    };
    frames: Frame[];
}

type EditHistoryItem = { imageUrl: string; prompt: string };

const aspectRatios = ['16:9', '4:3', '1:1', '9:16'];

export const AdvancedGenerateModal: React.FC<AdvancedGenerateModalProps> = ({ onClose, onGenerate, onApplyEdit, config, frames }) => {
    const [generateModePrompt, setGenerateModePrompt] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    
    const [editInstruction, setEditInstruction] = useState('');
    const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
    
    const currentImage = editHistory[historyIndex]?.imageUrl;
    const hasEdits = editHistory.length > 1;

    const leftFrame = config.mode === 'generate' && typeof config.insertIndex !== 'undefined' ? frames[config.insertIndex - 1] || null : null;
    const rightFrame = config.mode === 'generate' && typeof config.insertIndex !== 'undefined' ? frames[config.insertIndex] || null : null;

    const fetchGenerateSuggestions = useCallback(async () => {
        setIsLoadingSuggestions(true);
        setSuggestions([]);
        try {
            const leftCtx = config.mode === 'generate-sketch' ? null : leftFrame;
            const rightCtx = config.mode === 'generate-sketch' ? null : rightFrame;
            const newSuggestions = await generatePromptSuggestions(leftCtx, rightCtx);
            setSuggestions(newSuggestions);
        } catch (error) {
            console.error("Failed to get suggestions:", error);
        } finally {
            setIsLoadingSuggestions(false);
        }
    }, [leftFrame, rightFrame, config.mode]);

    const fetchEditSuggestions = useCallback(async () => {
        if (!config.frameToEdit) return;
        const currentIndex = frames.findIndex(f => f.id === config.frameToEdit!.id);
        const leftFrameCtx = currentIndex > 0 ? frames[currentIndex - 1] : null;
        const rightFrameCtx = currentIndex < frames.length - 1 ? frames[currentIndex + 1] : null;
        setIsLoadingSuggestions(true);
        setSuggestions([]);
        try {
            const newSuggestions = await generateEditSuggestions(config.frameToEdit, leftFrameCtx, rightFrameCtx);
            setSuggestions(newSuggestions);
        } catch (error) {
            console.error("Failed to get suggestions:", error);
        } finally {
            setIsLoadingSuggestions(false);
        }
    }, [config.frameToEdit, frames]);


    useEffect(() => {
        if (config.mode === 'edit' && config.frameToEdit) {
            const initialUrl = config.frameToEdit.imageUrls[config.frameToEdit.activeVersionIndex];
            const initialPrompt = config.frameToEdit.prompt;
            setEditHistory([{ imageUrl: initialUrl, prompt: initialPrompt }]);
            setHistoryIndex(0);
            setEditInstruction('');
            fetchEditSuggestions();
        } else if (config.mode === 'generate' || config.mode === 'generate-sketch') {
            setGenerateModePrompt('');
            fetchGenerateSuggestions();
        } else {
            setEditHistory([]);
            setHistoryIndex(0);
        }
    }, [config, fetchEditSuggestions, fetchGenerateSuggestions]);

    const handleGenerateClick = () => {
        if (!generateModePrompt.trim() || !onGenerate) {
            alert("Пожалуйста, введите промт или выберите одну из идей.");
            return;
        }
        onGenerate({ prompt: generateModePrompt, position: config.position, aspectRatio });
    };

    const handleAutoGenerateClick = () => {
        if (onGenerate && config.mode === 'generate') {
            onGenerate({ prompt: '__AUTO__' });
        }
    };
    
    const handlePerformEdit = async () => {
        if (!editInstruction.trim() || isGeneratingEdit || !config.frameToEdit) return;
        setIsGeneratingEdit(true);
        try {
            const currentHistoryItem = editHistory[historyIndex];
            const tempFrameForEdit: Omit<Frame, 'file'> = {
                id: config.frameToEdit.id,
                imageUrls: [currentHistoryItem.imageUrl],
                activeVersionIndex: 0,
                prompt: currentHistoryItem.prompt,
                duration: config.frameToEdit.duration,
            };
            const { imageUrl: newImageUrl, prompt: newPrompt } = await editImage(tempFrameForEdit, editInstruction);
            const newHistory = editHistory.slice(0, historyIndex + 1);
            newHistory.push({ imageUrl: newImageUrl, prompt: newPrompt });
            setEditHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            setEditInstruction(''); 
        } catch (error) {
            console.error("Error performing edit:", error);
            alert(`Не удалось отредактировать изображение: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGeneratingEdit(false);
        }
    };
    
    const handleUndo = () => historyIndex > 0 && setHistoryIndex(prev => prev - 1);
    const handleRedo = () => historyIndex < editHistory.length - 1 && setHistoryIndex(prev => prev + 1);

    const handleApply = () => {
        if (config.mode === 'edit' && config.frameToEdit && onApplyEdit && hasEdits) {
            const finalState = editHistory[historyIndex];
            onApplyEdit(config.frameToEdit.id, finalState.imageUrl, finalState.prompt);
        }
    };

    const ContextFrame: React.FC<{ frame: Frame | null, label: string }> = ({ frame, label }) => (
        <div className="flex flex-col gap-2 text-center bg-white/5 p-3 rounded-xl border border-white/5">
            <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">{label}</h4>
            <div className="aspect-video w-full rounded-lg bg-black/30 flex items-center justify-center border border-white/10 overflow-hidden">
                {frame ? (
                    <img src={frame.imageUrls[frame.activeVersionIndex]} alt={label} className="w-full h-full object-cover" />
                ) : (
                    <span className="material-symbols-outlined text-4xl text-white/20">image</span>
                )}
            </div>
        </div>
    );

    const renderGenerateMode = () => (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar">
                <div className="flex flex-col gap-6">
                     {config.mode === 'generate' && (
                        <div className="flex flex-col gap-3">
                            <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">Контекст сюжета</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <ContextFrame frame={leftFrame} label="Кадр до" />
                                <ContextFrame frame={rightFrame} label="Кадр после" />
                            </div>
                        </div>
                    )}
    
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">Идеи от AI</h4>
                            <button onClick={fetchGenerateSuggestions} disabled={isLoadingSuggestions} className="text-white/50 hover:text-white disabled:text-white/20 transition-colors" title="Обновить">
                                <span className={`material-symbols-outlined text-sm ${isLoadingSuggestions ? 'animate-spin' : ''}`}>refresh</span>
                            </button>
                        </div>
                        {isLoadingSuggestions ? (
                            <div className="grid grid-cols-2 gap-3">
                                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse"></div>)}
                            </div>
                        ) : suggestions.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {suggestions.slice(0, 4).map((s, i) => (
                                    <button key={i} onClick={() => setGenerateModePrompt(s)} className="glass-button p-3 rounded-xl text-xs text-left text-white/80">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-white/30 text-center py-4 border-2 border-dashed border-white/5 rounded-lg">Нет идей</div>
                        )}
                    </div>
                </div>
    
                <div className="flex flex-col gap-6">
                     {config.mode === 'generate-sketch' && (
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-white/60 uppercase tracking-wider" htmlFor="aspect-ratio-select">Соотношение сторон</label>
                             <div className="relative group">
                                <select
                                    id="aspect-ratio-select"
                                    value={aspectRatio}
                                    onChange={e => setAspectRatio(e.target.value)}
                                    className="w-full appearance-none glass-input text-white/90 text-sm rounded-xl px-4 py-3"
                                >
                                    {aspectRatios.map(r => <option key={r} value={r} className="bg-surface text-white">{r}</option>)}
                                </select>
                                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50 group-hover:text-white/80 transition-colors">
                                    expand_more
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-2 flex-1">
                        <label className="text-xs font-bold text-white/60 uppercase tracking-wider" htmlFor="manual-prompt-textarea">Ваш промт</label>
                        <textarea
                            id="manual-prompt-textarea"
                            value={generateModePrompt}
                            onChange={(e) => setGenerateModePrompt(e.target.value)}
                            placeholder={config.mode === 'generate-sketch' ? "Опишите набросок, например: Схема космического корабля..." : "Опишите кадр, например: Крупный план героя под дождем..."}
                            className="w-full flex-1 glass-input p-4 rounded-xl text-sm placeholder:text-white/30 resize-none custom-scrollbar leading-relaxed"
                        />
                    </div>
                </div>
            </div>
            <div className="bg-white/5 p-4 rounded-b-2xl flex items-center justify-between border-t border-white/10 shrink-0 backdrop-blur-md">
                 <div>
                     {config.mode === 'generate' && (
                        <button onClick={handleAutoGenerateClick} disabled={!leftFrame || !rightFrame} className="glass-button flex items-center gap-2 px-4 py-2 rounded-lg text-white/80 text-xs font-bold" title="Использовать контекст для генерации">
                            <span className="material-symbols-outlined text-base text-primary">auto_fix</span>
                            <span>Авто-режим</span>
                        </button>
                    )}
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="glass-button px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white">Отмена</button>
                    <button onClick={handleGenerateClick} className="glass-button-primary px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2">
                         <span className="material-symbols-outlined text-lg">add_circle</span>
                        Создать
                    </button>
                </div>
            </div>
        </>
    );

    const renderEditMode = () => (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 p-6 overflow-y-auto custom-scrollbar">
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="relative w-full aspect-video bg-black/40 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shadow-inner">
                        {currentImage ? (
                            <img src={currentImage} alt="Редактируемый кадр" className="w-full h-full object-contain" />
                        ) : (
                            <div className="text-white/50">Изображение не загружено</div>
                        )}
                        {isGeneratingEdit && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-3">
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-neon"></div>
                                <p className="font-bold text-sm tracking-wide animate-pulse">Применение изменений...</p>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-center gap-6 shrink-0 py-2 bg-white/5 rounded-xl border border-white/5">
                        <button onClick={handleUndo} disabled={historyIndex === 0 || isGeneratingEdit} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs font-bold uppercase tracking-wide">
                            <span className="material-symbols-outlined text-lg">undo</span>
                            Отменить
                        </button>
                        <div className="text-xs font-mono font-bold text-white/50 select-none bg-black/30 px-3 py-1 rounded-md border border-white/5">
                            ШАГ {historyIndex + 1} / {editHistory.length}
                        </div>
                        <button onClick={handleRedo} disabled={historyIndex >= editHistory.length - 1 || isGeneratingEdit} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs font-bold uppercase tracking-wide">
                            <span className="material-symbols-outlined text-lg">redo</span>
                            Повторить
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-1 flex flex-col gap-6 min-h-0">
                    <div className="flex flex-col gap-2 flex-1">
                        <label className="text-xs font-bold text-white/60 uppercase tracking-wider" htmlFor="edit-instruction-textarea">Инструкция</label>
                        <textarea
                            id="edit-instruction-textarea"
                            value={editInstruction}
                            onChange={(e) => setEditInstruction(e.target.value)}
                            placeholder="Что изменить? Например: Добавить дождь, сделать черно-белым..."
                            className="w-full flex-1 glass-input p-4 rounded-xl text-sm placeholder:text-white/30 resize-none"
                        />
                    </div>
                     <div className="flex flex-col gap-3 flex-1 min-h-0">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">Подсказки</h4>
                            <button onClick={fetchEditSuggestions} disabled={isLoadingSuggestions} className="text-white/50 hover:text-white disabled:text-white/20 transition-colors">
                                <span className={`material-symbols-outlined text-sm ${isLoadingSuggestions ? 'animate-spin' : ''}`}>refresh</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                            {isLoadingSuggestions ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse"></div>)}
                                </div>
                            ) : suggestions.length > 0 ? (
                                suggestions.slice(0, 5).map((s, i) => (
                                    <button key={i} onClick={() => setEditInstruction(s)} className="glass-button w-full p-3 rounded-lg text-xs text-left text-white/70">
                                        {s}
                                    </button>
                                ))
                            ) : (
                                 <div className="text-xs text-white/30 text-center py-8 border-2 border-dashed border-white/5 rounded-lg">Нет подсказок</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-white/5 p-4 rounded-b-2xl flex justify-end gap-3 border-t border-white/10 shrink-0 backdrop-blur-md">
                <button onClick={onClose} className="glass-button px-5 py-2.5 rounded-lg text-sm font-medium text-white/70">Отмена</button>
                <button onClick={handlePerformEdit} disabled={isGeneratingEdit || !editInstruction.trim()} className="glass-button px-6 py-2.5 rounded-lg text-primary-light text-sm font-bold hover:bg-primary/10 disabled:opacity-50 flex items-center gap-2">
                    {isGeneratingEdit ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <span className="material-symbols-outlined text-lg">auto_awesome</span>}
                    {isGeneratingEdit ? 'Генерация...' : 'Сгенерировать'}
                </button>
                <button onClick={handleApply} disabled={!hasEdits || isGeneratingEdit} className="glass-button-primary px-6 py-2.5 rounded-lg text-white text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">check</span>
                    Применить
                </button>
            </div>
        </>
    );
    
    const modalTitle = () => {
        switch(config.mode) {
            case 'generate': return 'Создать новый кадр';
            case 'generate-sketch': return 'Создать набросок';
            case 'edit': return 'Редактировать кадр';
        }
    }
    
    const modalIcon = () => {
         switch(config.mode) {
            case 'generate': return 'add_a_photo';
            case 'generate-sketch': return 'draw';
            case 'edit': return 'tune';
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col w-full max-w-5xl h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-white/10 shrink-0 bg-white/5 rounded-t-2xl backdrop-blur-md">
                     <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-2xl">{modalIcon()}</span>
                        <h3 className="text-xl font-bold font-display text-white tracking-wide">{modalTitle()}</h3>
                    </div>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                {config.mode === 'edit' ? renderEditMode() : renderGenerateMode()}
            </div>
        </div>
    );
};
