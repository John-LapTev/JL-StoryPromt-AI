
import React, { useState } from 'react';
import type { Frame } from '../types';

interface EditPromptModalProps {
    frame: Frame;
    onClose: () => void;
    onSave: (id: string, newPrompt: string) => void;
}

export const EditPromptModal: React.FC<EditPromptModalProps> = ({ frame, onClose, onSave }) => {
    const [prompt, setPrompt] = useState(frame.prompt);

    const handleSave = () => {
        onSave(frame.id, prompt);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-xl w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold">Редактировать промт кадра #{frame.id.substring(0, 4)}</h3>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full h-48 bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-y"
                    aria-label="Edit prompt"
                />
                <div className="flex justify-end gap-3 mt-2">
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