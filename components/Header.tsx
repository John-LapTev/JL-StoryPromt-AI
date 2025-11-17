
import React, { useState, useRef, useEffect } from 'react';
import { LogoIcon } from './icons';

interface HeaderProps {
    projectName: string;
    hasUnsavedChanges: boolean;
    onNewProject: () => void;
    onSaveProject: () => void;
    onSaveAsProject: () => void;
    onLoadProject: () => void;
}

export const Header: React.FC<HeaderProps> = ({ projectName, hasUnsavedChanges, onNewProject, onSaveProject, onSaveAsProject, onLoadProject }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-white/10 px-6 py-3 shrink-0">
            <div className="flex items-center gap-4">
                <div className="size-6 text-white">
                    <LogoIcon />
                </div>
                <div className="flex flex-col">
                    <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">JL StoryPromt AI</h2>
                    <p className="text-xs text-white/60 leading-tight">Создание промтов для генерации видео</p>
                </div>
                <div className="h-6 w-px bg-white/10 mx-2"></div>
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(prev => !prev)} className="flex items-center gap-2 text-white/80 hover:text-white">
                        <span className="font-medium">{projectName}{hasUnsavedChanges ? '*' : ''}</span>
                        <span className="material-symbols-outlined text-xl transition-transform" style={{ transform: isMenuOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-[#191C2D] border border-white/10 rounded-lg shadow-lg z-50 p-1">
                            <button onClick={() => { onNewProject(); setIsMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-white/10 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">add</span> Новый проект
                            </button>
                             <button onClick={() => { onLoadProject(); setIsMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-white/10 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">folder_open</span> Загрузить...
                            </button>
                            <div className="h-px bg-white/10 my-1"></div>
                            <button onClick={() => { onSaveProject(); setIsMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-white/10 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">save</span> Сохранить
                            </button>
                            <button onClick={() => { onSaveAsProject(); setIsMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-white/10 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">save_as</span> Сохранить как...
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: `url("https://picsum.photos/40/40")` }}></div>
            </div>
        </header>
    );
};