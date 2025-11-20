
import React from 'react';

export const DragDropOverlay: React.FC = () => {
    return (
        <div className="pointer-events-none fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex items-center justify-center p-6">
            <div className="glass-modal flex flex-col items-center justify-center text-white text-center p-10 rounded-3xl border-2 border-dashed border-primary/50 max-w-lg shadow-neon">
                <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-bounce">
                    <span className="material-symbols-outlined text-5xl text-primary">upload_file</span>
                </div>
                <h2 className="text-3xl font-bold font-display tracking-wide mb-2">Перетащите изображения</h2>
                <p className="text-white/70 text-lg">Чтобы добавить их в таймлайн или библиотеку ассетов</p>
            </div>
        </div>
    );
};
