import React from 'react';

interface ImageViewerModalProps {
    imageUrl: string;
    onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ imageUrl, onClose }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="relative max-w-screen-lg max-h-[90vh] w-auto h-auto" 
                onClick={e => e.stopPropagation()}
            >
                <img 
                    src={imageUrl} 
                    alt="Enlarged frame view" 
                    className="object-contain w-full h-full max-w-full max-h-full rounded-lg shadow-2xl"
                />
                <button 
                    onClick={onClose}
                    className="absolute -top-4 -right-4 z-10 size-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm"
                    aria-label="Close image viewer"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
        </div>
    );
};
