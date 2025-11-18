
import React from 'react';

export const DragDropOverlay: React.FC = () => {
    return (
        <div className="pointer-events-none fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex items-center justify-center p-6">
            <div className="flex flex-col items-center justify-center text-white text-center p-8 rounded-2xl border-2 border-dashed border-primary bg-background-dark/80 max-w-lg">
                <span className="material-symbols-outlined text-7xl text-primary animate-bounce">upload_file</span>
                <h2 className="text-3xl font-bold mt-4">Перетащите изображения</h2>
                <p className="text-white/70 mt-1">Чтобы добавить их в таймлайн или библиотеку ассетов</p>
            </div>
        </div>
    );
};
