import React from 'react';

interface SimpleImageViewerModalProps {
    imageUrl: string;
    title: string;
    onClose: () => void;
}

export const SimpleImageViewerModal: React.FC<SimpleImageViewerModalProps> = ({ imageUrl, title, onClose }) => {
    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[70]"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div className="relative w-full h-full flex flex-col items-center p-4" onClick={e => e.stopPropagation()}>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg text-lg font-bold">
                    {title}
                </div>
                
                <div className="flex-1 flex items-center justify-center w-full min-h-0 relative">
                     <img
                        src={imageUrl}
                        alt={title}
                        className="object-contain max-w-full max-h-full rounded-lg shadow-2xl"
                    />
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 size-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm"
                    aria-label="Close image viewer"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
        </div>
    );
};
