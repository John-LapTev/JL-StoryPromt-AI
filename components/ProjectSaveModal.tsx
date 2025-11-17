
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-md w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold">{title}</h3>
                <form onSubmit={handleSave}>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Название проекта"
                        className="w-full bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none"
                        autoFocus
                    />
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">
                            Отмена
                        </button>
                        <button type="submit" disabled={!name.trim()} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:bg-gray-500">
                            Сохранить
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};