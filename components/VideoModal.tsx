
import React from 'react';

interface VideoModalProps {
    videoUrl: string;
    onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ videoUrl, onClose }) => {
    return (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-4 flex flex-col items-center gap-4 text-white max-w-3xl w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold">Сгенерированное видео</h3>
                <video src={videoUrl} controls autoPlay className="w-full rounded-lg" />
                 <button onClick={onClose} className="mt-2 flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 hover:bg-primary/90">
                    Закрыть
                </button>
            </div>
        </div>
    );
};
