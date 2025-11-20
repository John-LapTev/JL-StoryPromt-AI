
import React, { useState } from 'react';

interface ProjectSaveModalProps {
    onClose: () => void;
    onSave: (name: string) => void;
    initialName?: string;
    title: string;
}

export const ProjectSaveModal: React.FC<ProjectSaveModalProps> = ({ onClose, onSave, initialName = '', title }) => {
    const [name, setName] = useState(initialName);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave(name.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col max-w-md w-full" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex flex-col gap-6">
                     <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h3 className="text-xl font-bold font-display text-white tracking-wide">{title}</h3>
                         <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Название</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Введите название..."
                            className="w-full glass-input rounded-lg p-4 text-white placeholder:text-white/30"
                            autoFocus
                        />
                    </form>
                </div>

                <div className="bg-white/5 p-4 rounded-b-2xl flex justify-end gap-3 border-t border-white/10 backdrop-blur-md">
                    <button onClick={onClose} className="glass-button px-5 py-2.5 rounded-lg text-sm font-medium text-white/70">Отмена</button>
                    <button onClick={(e) => handleSave(e)} disabled={!name.trim()} className="glass-button-primary px-6 py-2.5 rounded-lg text-white text-sm font-bold">
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
};
