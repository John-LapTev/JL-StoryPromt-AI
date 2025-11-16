
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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col md:flex-row gap-6 text-white max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="w-full md:w-1/2 flex-shrink-0">
                    <img src={frame.imageUrl} alt={`Frame ${frame.id.substring(0,4)}`} className="w-full h-auto object-contain rounded-lg max-h-[80vh]" />
                </div>
                <div className="w-full md:w-1/2 flex flex-col">
                    <h3 className="text-xl font-bold mb-4">Детали кадра #{frame.id.substring(0, 4)}</h3>
                    
                    <div className="mb-4">
                        <label className="text-sm font-bold text-white/70 mb-1 block">Длительность</label>
                        {isEditing ? (
                             <input 
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(Math.max(0.25, parseFloat(e.target.value) || 0))}
                                step="0.25"
                                className="w-full bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none"
                             />
                        ) : (
                            <p className="text-white/90 bg-white/5 p-2 rounded-lg">{frame.duration.toFixed(2)}s</p>
                        )}
                    </div>

                    <div className="mb-4 flex-1 flex flex-col min-h-0">
                         <label className="text-sm font-bold text-white/70 mb-1 block">Промт</label>
                         {isEditing ? (
                             <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full flex-1 bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-y"
                             />
                         ) : (
                            <div className="bg-white/5 p-3 rounded-lg text-sm text-white/80 leading-snug w-full flex-1 overflow-auto whitespace-pre-wrap">
                                {frame.prompt || <span className="italic text-white/50">Промт не указан.</span>}
                            </div>
                         )}
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-auto pt-4">
                        {isEditing ? (
                            <>
                                <button onClick={handleCancel} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">
                                    Отмена
                                </button>
                                <button onClick={handleSave} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90">
                                    Сохранить
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">
                                    Закрыть
                                </button>
                                <button onClick={() => setIsEditing(true)} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90">
                                    Редактировать
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
