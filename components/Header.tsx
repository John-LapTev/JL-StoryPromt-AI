
import React, { useState, useRef, useEffect } from 'react';
import { LogoIcon } from './icons';

interface HeaderProps {
    projectName: string;
    hasUnsavedChanges: boolean;
    onNewProject: () => void;
    onSaveProject: () => void;
    onSaveAsProject: () => void;
    onLoadProject: () => void;
    onManageApiKey: () => void;
    onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ projectName, hasUnsavedChanges, onNewProject, onSaveProject, onSaveAsProject, onLoadProject, onManageApiKey, onOpenSettings }) => {
    const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const projectMenuRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
                setIsProjectMenuOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="fixed top-4 left-4 z-50 flex items-center gap-4 p-2 pr-6 glass-panel rounded-2xl w-fit">
            <div className="flex items-center gap-3">
                <div className="size-8 text-primary ml-2">
                    <LogoIcon />
                </div>
                <div className="flex flex-col">
                    <h2 className="text-white text-lg font-bold leading-none tracking-wide font-display uppercase">StoryPrompt</h2>
                </div>
            </div>
            
            <div className="h-6 w-px bg-white/10"></div>
            
            <div className="relative" ref={projectMenuRef}>
                <button 
                    onClick={() => setIsProjectMenuOpen(prev => !prev)} 
                    className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                >
                    <span className="material-symbols-outlined text-lg group-hover:text-primary transition-colors">folder_open</span>
                    <span className="font-medium text-sm tracking-wide truncate max-w-[200px]">{projectName}{hasUnsavedChanges ? '*' : ''}</span>
                    <span className="material-symbols-outlined text-lg transition-transform duration-200" style={{ transform: isProjectMenuOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                </button>
                
                {isProjectMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 glass-panel rounded-xl z-50 p-1.5 animate-fade-in">
                        <button onClick={() => { onNewProject(); setIsProjectMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/10 text-white/90 hover:text-white flex items-center gap-3 transition-colors">
                            <span className="material-symbols-outlined text-[18px] text-primary">add_circle</span> Новый проект
                        </button>
                         <button onClick={() => { onLoadProject(); setIsProjectMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/10 text-white/90 hover:text-white flex items-center gap-3 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">folder</span> Открыть
                        </button>
                        <div className="h-px bg-white/10 my-1.5 mx-2"></div>
                        <button onClick={() => { onSaveProject(); setIsProjectMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/10 text-white/90 hover:text-white flex items-center gap-3 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">save</span> Сохранить
                        </button>
                        <button onClick={() => { onSaveAsProject(); setIsProjectMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/10 text-white/90 hover:text-white flex items-center gap-3 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">save_as</span> Сохранить как...
                        </button>
                    </div>
                )}
            </div>
            
            <div className="h-6 w-px bg-white/10"></div>

            <div className="relative" ref={userMenuRef}>
                <button 
                    onClick={() => setIsUserMenuOpen(prev => !prev)} 
                    className="flex items-center justify-center size-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary/50 transition-all"
                    aria-label="Меню пользователя"
                >
                    <span className="material-symbols-outlined text-xl text-white/90">person</span>
                </button>
                 {isUserMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 glass-panel rounded-xl z-50 p-1.5 animate-fade-in">
                        <button onClick={() => { onManageApiKey(); setIsUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/10 text-white/90 hover:text-white flex items-center gap-3 transition-colors">
                            <span className="material-symbols-outlined text-[18px] text-yellow-400">key</span> API Ключ (Veo)
                        </button>
                        <button onClick={() => { onOpenSettings(); setIsUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/10 text-white/90 hover:text-white flex items-center gap-3 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">settings</span> Настройки
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
