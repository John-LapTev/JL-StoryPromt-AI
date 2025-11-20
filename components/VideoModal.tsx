
import React from 'react';

interface VideoModalProps {
    videoUrl: string;
    onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ videoUrl, onClose }) => {
    return (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col items-center gap-4 text-white max-w-3xl w-full" onClick={e => e.stopPropagation()}>
                <div className="w-full p-4 flex items-center justify-between border-b border-white/10 bg-white/5 rounded-t-xl">
                    <h3 className="text-xl font-bold font-display tracking-wide">Сгенерированное видео</h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="w-full p-4">
                     <video src={videoUrl} controls autoPlay className="w-full rounded-lg border border-white/10 shadow-lg" />
                </div>
                 <div className="w-full p-4 flex justify-end border-t border-white/10 bg-white/5 rounded-b-xl">
                     <button onClick={onClose} className="glass-button px-6 py-2 rounded-lg text-white text-sm font-bold">
                        Закрыть
                    </button>
                 </div>
            </div>
        </div>
    );
};
