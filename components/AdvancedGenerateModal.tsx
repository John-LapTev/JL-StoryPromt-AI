import React, { useState } from 'react';
import { fileToBase64, dataUrlToFile, fetchCorsImage } from '../utils/fileUtils';
import type { Frame } from '../types';

interface AdvancedGenerateModalProps {
    onClose: () => void;
    onGenerate: (data: { mode: 'generate' | 'edit', prompt: string, maintainContext?: boolean, file?: File, preview?: string }) => void;
    frames: Frame[];
}

type Mode = 'generate' | 'edit';

export const AdvancedGenerateModal: React.FC<AdvancedGenerateModalProps> = ({ onClose, onGenerate, frames }) => {
    const [mode, setMode] = useState<Mode>('generate');
    const [prompt, setPrompt] = useState('');
    const [editImageFile, setEditImageFile] = useState<File | null>(null);
    const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
    const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
    const [maintainContext, setMaintainContext] = useState(true);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFrameId(null);
            setEditImageFile(file);
            const preview = await fileToBase64(file);
            setEditImagePreview(preview);
        }
    };

    const handleSelectFrameForEdit = async (frame: Frame) => {
        setSelectedFrameId(frame.id);
        setEditImagePreview(frame.imageUrl);

        if (frame.file) {
            setEditImageFile(frame.file);
        } else {
            try {
                let file: File;
                if (frame.imageUrl.startsWith('data:')) {
                    const mimeType = frame.imageUrl.match(/:(.*?);/)?.[1] || 'image/png';
                    const extension = mimeType.split('/')[1] || 'png';
                    file = dataUrlToFile(frame.imageUrl, `frame-${frame.id}.${extension}`);
                } else {
                    const blob = await fetchCorsImage(frame.imageUrl);
                    const extension = blob.type.split('/')[1] || 'jpeg';
                    file = new File([blob], `frame-${frame.id}.${extension}`, { type: blob.type });
                }
                setEditImageFile(file);
            } catch (e) {
                console.error("Could not fetch image from URL to create a file:", e);
                alert("Не удалось загрузить изображение кадра для редактирования.");
                setSelectedFrameId(null);
                setEditImagePreview(null);
            }
        }
    };


    const handleGenerateClick = () => {
        if (!prompt.trim()) {
            alert("Пожалуйста, введите промт.");
            return;
        }

        if (mode === 'edit' && !editImageFile) {
            alert("Пожалуйста, выберите изображение для редактирования.");
            return;
        }
        
        onGenerate({
            mode,
            prompt,
            maintainContext: mode === 'generate' ? maintainContext : undefined,
            file: editImageFile ?? undefined,
            preview: editImagePreview ?? undefined
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                     <h3 className="text-xl font-bold">Создать новый кадр</h3>
                     <div className="flex items-center bg-white/5 rounded-lg p-1 text-sm">
                        <button onClick={() => setMode('generate')} className={`px-3 py-1 rounded-md ${mode === 'generate' ? 'bg-primary' : ''}`}>Сгенерировать</button>
                        <button onClick={() => setMode('edit')} className={`px-3 py-1 rounded-md ${mode === 'edit' ? 'bg-primary' : ''}`}>Редактировать</button>
                     </div>
                </div>
               
                {mode === 'edit' && (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-white/70">Выберите кадр из таймлайна:</p>
                            <div className="flex overflow-x-auto gap-2 p-2 bg-white/5 rounded-lg">
                                {frames.map(frame => (
                                    <img 
                                        key={frame.id} 
                                        src={frame.imageUrl} 
                                        alt={`Frame ${frame.id.substring(0,4)}`}
                                        onClick={() => handleSelectFrameForEdit(frame)}
                                        className={`h-16 w-auto object-contain rounded-md cursor-pointer border-2 shrink-0 ${selectedFrameId === frame.id ? 'border-primary' : 'border-transparent'} hover:border-primary/50 transition-all`}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <hr className="flex-grow border-white/10"/>
                            <span className="text-xs text-white/50">ИЛИ</span>
                            <hr className="flex-grow border-white/10"/>
                        </div>
                        <div className="flex flex-col items-center justify-center w-full h-32 bg-white/5 rounded-lg border-2 border-dashed border-white/20">
                            <input type="file" id="upload-edit" accept="image/*" className="hidden" onChange={handleFileChange} />
                            <label htmlFor="upload-edit" className="cursor-pointer flex flex-col items-center justify-center gap-2 text-white/60 hover:text-white w-full h-full">
                                {editImagePreview ? (
                                    <img src={editImagePreview} alt="Preview" className="h-full w-full object-contain p-1 rounded-md" />
                                ): (
                                    <>
                                    <span className="material-symbols-outlined">upload</span>
                                    <span className="text-sm text-center">Загрузить изображение для редактирования</span>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>
                )}
                 {mode === 'generate' && (
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
                            <span
                                aria-hidden="true"
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${maintainContext ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                )}
                
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={mode === 'generate' 
                        ? "Промт для генерации: A futuristic cityscape..." 
                        : "Промт для редактирования: Add a retro filter..."}
                    className="w-full h-24 bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-none"
                    aria-label="Prompt for new frame"
                />
                <div className="flex justify-end gap-3 mt-2">
                    <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">
                        Отмена
                    </button>
                    <button onClick={handleGenerateClick} disabled={mode === 'edit' && !editImageFile} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        Создать
                    </button>
                </div>
            </div>
        </div>
    );
};