
import React, { useState } from 'react';
import type { Frame } from '../types';

interface EditPromptModalProps {
    frame: Frame;
    onClose: () => void;
    onSave: (id: string, newPrompt: string) => void;
}

export const EditPromptModal: React.FC<EditPromptModalProps> = ({ frame, onClose, onSave }) => {
    const [prompt, setPrompt] = useState(frame.prompt);

    const handleSave = () => { onSave(frame.id, prompt); onClose(); };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col max-w-xl w-full" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-2xl">edit_note</span>
                            <h3 className="text-xl font-bold font-display text-white tracking-wide">Редактор промта</h3>
                        </div>
                        <div className="px-2 py-1 rounded bg-white/5 text-xs font-mono text-white/50 border border-white/5">
                            #{frame.id.substring(0, 4)}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Текст промта</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-48 glass-input p-4 rounded-xl text-sm placeholder:text-white/30 resize-none leading-relaxed custom-scrollbar"
                            placeholder="Опишите, что происходит в кадре..."
                            autoFocus
                            aria-label="Edit prompt"
                        />
                    </div>
                </div>

                <div className="bg-white/5 p-4 rounded-b-2xl flex justify-end gap-3 border-t border-white/10 backdrop-blur-md">
                    <button onClick={onClose} className="glass-button px-5 py-2.5 rounded-lg text-sm font-medium text-white/70">Отмена</button>
                    <button onClick={handleSave} className="glass-button-primary px-6 py-2.5 rounded-lg text-white text-sm font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">save</span>
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
};
