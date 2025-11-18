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
    // State for 'generate' mode
    const [generateModePrompt, setGenerateModePrompt] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    
    // State for 'edit' mode
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
            // For sketch mode, there's no context
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

            const { imageUrl: newImageUrl, prompt: newPrompt } = await editImage(
                tempFrameForEdit,
                editInstruction
            );

            const newHistory = editHistory.slice(0, historyIndex + 1);
            newHistory.push({ imageUrl: newImageUrl, prompt: newPrompt });
            setEditHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            setEditInstruction(''); // Clear instruction field after use
        } catch (error) {
            console.error("Error performing edit:", error);
            alert(`Не удалось отредактировать изображение: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGeneratingEdit(false);
        }
    };
    
    const handleUndo = () => historyIndex > 0 && setHistoryIndex(prev => prev - 1);
    const handleRedo = () => historyIndex < editHistory.length - 1 && setHistoryIndex(prev => prev - 1);

    const handleApply = () => {
        if (config.mode === 'edit' && config.frameToEdit && onApplyEdit && hasEdits) {
            const finalState = editHistory[historyIndex];
            onApplyEdit(config.frameToEdit.id, finalState.imageUrl, finalState.prompt);
        }
    };

    const ContextFrame: React.FC<{ frame: Frame | null, label: string }> = ({ frame, label }) => (
        <div className="flex flex-col gap-2 text-center">
            <h4 className="text-sm font-bold text-white/60">{label}</h4>
            <div className="aspect-video w-full rounded-lg bg-black/30 flex items-center justify-center border border-white/10">
                {frame ? (
                    <img src={frame.imageUrls[frame.activeVersionIndex]} alt={label} className="max-h-full max-w-full object-contain rounded-md" />
                ) : (
                    <span className="material-symbols-outlined text-4xl text-white/20">image</span>
                )}
            </div>
        </div>
    );

    const renderGenerateMode = () => (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto p-1">
                {/* Left Column - Context & Suggestions */}
                <div className="flex flex-col gap-6">
                     {config.mode === 'generate' && (
                        <div>
                            <h3 className="text-base font-bold text-white/80 border-b border-white/10 pb-2 mb-4">Контекст сюжета</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <ContextFrame frame={leftFrame} label="Кадр до" />
                                <ContextFrame frame={rightFrame} label="Кадр после" />
                            </div>
                        </div>
                    )}
    
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white/80">Идеи от AI</h4>
                            <button onClick={fetchGenerateSuggestions} disabled={isLoadingSuggestions} className="text-white/60 hover:text-white disabled:text-white/30 disabled:cursor-wait p-1 rounded-full" title="Сгенерировать новые идеи">
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
                                    <button key={i} onClick={() => setGenerateModePrompt(s)} className="p-3 min-h-[80px] bg-white/5 rounded-lg text-xs text-left text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center text-center">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-white/50 text-center py-4 bg-white/5 rounded-lg">Не удалось сгенерировать идеи.</div>
                        )}
                    </div>
                </div>
    
                {/* Right Column - Manual Prompt */}
                <div className="flex flex-col gap-4">
                     {config.mode === 'generate-sketch' && (
                        <div>
                            <label className="text-sm font-bold text-white/80 mb-2 block" htmlFor="aspect-ratio-select">Соотношение сторон</label>
                             <div className="relative">
                                <select
                                    id="aspect-ratio-select"
                                    value={aspectRatio}
                                    onChange={e => setAspectRatio(e.target.value)}
                                    className="w-full appearance-none bg-white/5 px-3 py-2 rounded-lg text-sm font-bold text-white/90 focus:ring-2 focus:ring-primary border-none pr-8"
                                >
                                    {aspectRatios.map(r => <option key={r} value={r} className="bg-[#191C2D] text-white">{r}</option>)}
                                </select>
                                <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/50">
                                    expand_more
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-2 flex-1">
                        <label className="text-sm font-bold text-white/80" htmlFor="manual-prompt-textarea">Введите промт вручную:</label>
                        <textarea
                            id="manual-prompt-textarea"
                            value={generateModePrompt}
                            onChange={(e) => setGenerateModePrompt(e.target.value)}
                            placeholder="Например: Крупный план, герой смотрит на неоновый город..."
                            className="w-full flex-1 bg-white/5 p-3 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-none"
                            aria-label="Prompt for new frame"
                        />
                    </div>
                </div>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10 shrink-0">
                <div>
                     {config.mode === 'generate' && (
                        <button onClick={handleAutoGenerateClick} disabled={!leftFrame || !rightFrame} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/20 text-white text-sm font-bold hover:bg-white/30 gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title={!leftFrame || !rightFrame ? "Необходимы оба соседних кадра для автоматической генерации" : ""}>
                            <span className="material-symbols-outlined text-base">auto_fix</span>
                            Сгенерировать автоматически
                        </button>
                    )}
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">Отмена</button>
                    <button onClick={handleGenerateClick} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90">Создать</button>
                </div>
            </div>
        </>
    );

    const renderEditMode = () => (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Left Column - Image & History */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="relative w-full aspect-video bg-black/30 rounded-lg flex items-center justify-center overflow-hidden border border-white/10">
                        {currentImage ? (
                            <img src={currentImage} alt="Редактируемый кадр" className="max-h-full max-w-full object-contain" />
                        ) : (
                            <div className="text-white/50">Изображение не загружено</div>
                        )}
                        {isGeneratingEdit && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-2">
                                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="font-medium">Применяем магию...</p>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-center gap-4 shrink-0">
                        <button onClick={handleUndo} disabled={historyIndex === 0 || isGeneratingEdit} className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed">
                            <span className="material-symbols-outlined">undo</span>
                            Отменить
                        </button>
                        <div className="text-sm font-mono text-white/60 select-none">
                            {historyIndex + 1} / {editHistory.length}
                        </div>
                        <button onClick={handleRedo} disabled={historyIndex >= editHistory.length - 1 || isGeneratingEdit} className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed">
                            <span className="material-symbols-outlined">redo</span>
                            Повторить
                        </button>
                    </div>
                </div>

                {/* Right Column - Controls */}
                <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-white/80" htmlFor="edit-instruction-textarea">Ваша инструкция для редактирования:</label>
                        <textarea
                            id="edit-instruction-textarea"
                            value={editInstruction}
                            onChange={(e) => setEditInstruction(e.target.value)}
                            placeholder="Например: Сделать кадр в стиле аниме, добавить дождь..."
                            className="w-full h-32 bg-white/5 p-3 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-none"
                            aria-label="Instruction for editing frame"
                        />
                    </div>
                     <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white/80">Умные подсказки</h4>
                            <button onClick={fetchEditSuggestions} disabled={isLoadingSuggestions} className="text-white/60 hover:text-white disabled:text-white/30 disabled:cursor-wait p-1 rounded-full" title="Сгенерировать новые подсказки">
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
                                    <button key={i} onClick={() => setEditInstruction(s)} className="p-3 min-h-[80px] bg-white/5 rounded-lg text-xs text-left text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center text-center">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        ) : (
                             <div className="text-xs text-white/50 text-center py-4 bg-white/5 rounded-lg">Не удалось сгенерировать подсказки.</div>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10 shrink-0">
                <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">Отмена</button>
                <button onClick={handlePerformEdit} disabled={isGeneratingEdit || !editInstruction.trim()} className="flex min-w-[120px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/20 text-white text-sm font-bold hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isGeneratingEdit ? 'Генерация...' : 'Сгенерировать'}
                </button>
                <button onClick={handleApply} disabled={!hasEdits || isGeneratingEdit} className="flex min-w-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed">
                    Применить и закрыть
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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-5xl w-full h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold shrink-0">{modalTitle()}</h3>
                {config.mode === 'edit' ? renderEditMode() : renderGenerateMode()}
            </div>
        </div>
    );
};