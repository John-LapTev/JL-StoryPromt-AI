
import React from 'react';
import { LogoIcon } from './icons';

export const Header: React.FC = () => {
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
            </div>
            <div className="flex items-center gap-4">
                <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: `url("https://picsum.photos/40/40")` }}></div>
            </div>
        </header>
    );
};
