
import React, { useState, useEffect } from 'react';
import type { Frame } from '../types';

interface FrameDetailModalProps {
    frame: Frame;
    onClose: () => void;
    onSave: (id: string, newPrompt: string, newDuration: number) => void;
}

export const FrameDetailModal: React.FC<FrameDetailModalProps> = ({ frame, onClose, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [prompt, setPrompt] = useState(frame.prompt);
    const [duration, setDuration] = useState(frame.duration);

    useEffect(() => {
        setPrompt(frame.prompt);
        setDuration(frame.duration);
    }, [frame]);

    const handleSave = () => {
        onSave(frame.id, prompt, duration);
        setIsEditing(false);
        onClose();
    };
    
    const handleCancel = () => {
        setPrompt(frame.prompt);
        setDuration(frame.duration);
        setIsEditing(false);
    }
    
    const activeImageUrl = frame.imageUrls[frame.activeVersionIndex];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-6 flex flex-col md:flex-row gap-6 text-white max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="w-full md:w-1/2 flex-shrink-0 flex items-center justify-center bg-black/30 rounded-xl border border-white/10 p-2">
                    <img src={activeImageUrl} alt={`Frame ${frame.id.substring(0,4)}`} className="w-full h-auto object-contain rounded-lg max-h-[80vh]" />
                </div>
                <div className="w-full md:w-1/2 flex flex-col">
                    <div className="border-b border-white/10 pb-4 mb-4">
                        <h3 className="text-xl font-bold font-display tracking-wide">Детали кадра #{frame.id.substring(0, 4)}</h3>
                    </div>
                    
                    <div className="mb-4">
                        <label className="text-xs font-bold text-white/60 uppercase tracking-wider mb-1 block">Длительность</label>
                        {isEditing ? (
                             <input 
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(Math.max(0.25, parseFloat(e.target.value) || 0))}
                                step="0.25"
                                className="w-full glass-input p-2 rounded-lg text-sm"
                             />
                        ) : (
                            <p className="text-white/90 bg-white/5 p-2 rounded-lg border border-white/5">{frame.duration.toFixed(2)}s</p>
                        )}
                    </div>

                    <div className="mb-4 flex-1 flex flex-col min-h-0">
                         <label className="text-xs font-bold text-white/60 uppercase tracking-wider mb-1 block">Промт</label>
                         {isEditing ? (
                             <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full flex-1 glass-input p-2 rounded-lg text-sm resize-y custom-scrollbar"
                             />
                         ) : (
                            <div className="bg-white/5 p-3 rounded-lg text-sm text-white/80 leading-snug w-full flex-1 overflow-auto whitespace-pre-wrap custom-scrollbar border border-white/5">
                                {frame.prompt || <span className="italic text-white/50">Промт не указан.</span>}
                            </div>
                         )}
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-auto pt-4 border-t border-white/10">
                        {isEditing ? (
                            <>
                                <button onClick={handleCancel} className="glass-button px-4 py-2 rounded-lg text-sm font-bold">Отмена</button>
                                <button onClick={handleSave} className="glass-button-primary px-4 py-2 rounded-lg text-white text-sm font-bold">Сохранить</button>
                            </>
                        ) : (
                            <>
                                <button onClick={onClose} className="glass-button px-4 py-2 rounded-lg text-sm font-bold">Закрыть</button>
                                <button onClick={() => setIsEditing(true)} className="glass-button-primary px-4 py-2 rounded-lg text-white text-sm font-bold">Редактировать</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
