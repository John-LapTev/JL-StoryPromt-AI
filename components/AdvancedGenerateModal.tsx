import React, { useState, useEffect, useCallback } from 'react';
import type { Frame } from '../types';
import { generateEditSuggestions, editImage } from '../services/geminiService';

interface AdvancedGenerateModalProps {
    onClose: () => void;
    onGenerate?: (data: { mode: 'generate', prompt: string, maintainContext?: boolean }) => void;
    onApplyEdit?: (frameId: string, newImageUrl: string, newPrompt: string) => void;
    config: {
        mode: 'generate' | 'edit';
        frameToEdit?: Frame;
        insertIndex?: number;
    };
    frames: Frame[];
}

type EditHistoryItem = { imageUrl: string; prompt: string };

export const AdvancedGenerateModal: React.FC<AdvancedGenerateModalProps> = ({ onClose, onGenerate, onApplyEdit, config, frames }) => {
    // State for 'generate' mode
    const [generateModePrompt, setGenerateModePrompt] = useState('');
    const [maintainContext, setMaintainContext] = useState(true);
    
    // State for 'edit' mode
    const [editInstruction, setEditInstruction] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
    
    const currentImage = editHistory[historyIndex]?.imageUrl;
    const hasEdits = editHistory.length > 1;

    const fetchSuggestions = useCallback(async () => {
        if (!config.frameToEdit) return;
        
        const currentIndex = frames.findIndex(f => f.id === config.frameToEdit!.id);
        const leftFrame = currentIndex > 0 ? frames[currentIndex - 1] : null;
        const rightFrame = currentIndex < frames.length - 1 ? frames[currentIndex + 1] : null;

        setIsLoadingSuggestions(true);
        setSuggestions([]);
        try {
            const newSuggestions = await generateEditSuggestions(config.frameToEdit, leftFrame, rightFrame);
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
            fetchSuggestions();
        } else {
            setGenerateModePrompt('');
            setMaintainContext(true);
            setEditHistory([]);
            setHistoryIndex(0);
        }
    }, [config, fetchSuggestions]);

    const handleGenerateClick = () => {
        if (!generateModePrompt.trim() || !onGenerate) {
            alert("Пожалуйста, введите промт.");
            return;
        }
        onGenerate({
            mode: 'generate',
            prompt: generateModePrompt,
            maintainContext,
        });
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
    const handleRedo = () => historyIndex < editHistory.length - 1 && setHistoryIndex(prev => prev + 1);

    const handleApply = () => {
        if (config.mode === 'edit' && config.frameToEdit && onApplyEdit && hasEdits) {
            const finalState = editHistory[historyIndex];
            onApplyEdit(config.frameToEdit.id, finalState.imageUrl, finalState.prompt);
        }
    };

    const renderGenerateMode = () => (
        <>
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 p-3 bg-white/5 rounded-lg my-1">
                    <div>
                        <label htmlFor="maintain-context" className="text-sm text-white/80 cursor-pointer font-bold">
                            Сохранять контекст сюжета
                        </label>
                        <p className="text-xs text-white/60">AI учтет соседние кадры для лучшего соответствия стилю и истории.</p>
                    </div>
                    <button 
                        role="switch"
                        aria-checked={maintainContext}
                        id="maintain-context"
                        onClick={() => setMaintainContext(!maintainContext)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#191C2D] ${maintainContext ? 'bg-primary' : 'bg-gray-600'}`}
                    >
                        <span aria-hidden="true" className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${maintainContext ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
                <textarea
                    value={generateModePrompt}
                    onChange={(e) => setGenerateModePrompt(e.target.value)}
                    placeholder="Промт для генерации: футуристический городской пейзаж..." 
                    className="w-full h-36 bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-none"
                    aria-label="Prompt for new frame"
                />
            </div>
            <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-white/10">
                <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">Отмена</button>
                <button onClick={handleGenerateClick} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90">Создать</button>
            </div>
        </>
    );

    const renderEditMode = () => (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Left Column */}
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
                    <div className="flex items-center justify-center gap-4">
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

                {/* Right Column */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="flex-1 flex flex-col gap-4">
                        <label className="text-sm font-bold text-white/80">Ваша инструкция для редактирования:</label>
                        <textarea
                            value={editInstruction}
                            onChange={(e) => setEditInstruction(e.target.value)}
                            placeholder="Например: Сделать кадр в стиле аниме, добавить дождь..."
                            className="w-full flex-1 bg-white/5 p-3 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-none"
                            aria-label="Instruction for editing frame"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white/80">Умные подсказки</h4>
                            <button onClick={fetchSuggestions} disabled={isLoadingSuggestions} className="text-white/60 hover:text-white disabled:text-white/30 disabled:cursor-wait p-1" title="Сгенерировать новые подсказки">
                                <span className={`material-symbols-outlined ${isLoadingSuggestions ? 'animate-spin' : ''}`}>refresh</span>
                            </button>
                        </div>
                        {isLoadingSuggestions ? (
                            <div className="grid grid-cols-2 gap-2">
                                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse"></div>)}
                            </div>
                        ) : suggestions.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {suggestions.slice(0, 4).map((s, i) => (
                                    <button key={i} onClick={() => setEditInstruction(s)} className="p-2.5 min-h-[64px] bg-white/5 rounded-lg text-xs text-left text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center text-center">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-white/50 text-center py-4">Не удалось сгенерировать подсказки.</div>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-7xl w-full h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold shrink-0">{config.mode === 'generate' ? 'Создать новый кадр' : 'Редактировать кадр'}</h3>
                {config.mode === 'generate' ? renderGenerateMode() : renderEditMode()}
            </div>
        </div>
    );
};