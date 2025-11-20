
import React, { useState, useEffect, useRef } from 'react';
import type { Frame } from '../types';

interface ImageViewerModalProps {
    frames: Frame[];
    startIndex: number;
    onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ frames, startIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const activeThumbnailRef = useRef<HTMLImageElement>(null);

    const handleNext = () => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % frames.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + frames.length) % frames.length);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [frames.length]);

    useEffect(() => {
        if (activeThumbnailRef.current) {
            activeThumbnailRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
            });
        }
    }, [currentIndex]);

    if (!frames || frames.length === 0) {
        return null;
    }
    
    const currentFrame = frames[currentIndex];
    const isGenerating = currentFrame.isGenerating;
    const hasError = currentFrame.hasError;
    // Only access imageUrl if it exists and is not generating (unless optimistic update provided)
    const activeImageUrl = (!isGenerating && !hasError && currentFrame.imageUrls.length > 0) 
        ? currentFrame.imageUrls[currentFrame.activeVersionIndex] 
        : null;

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div className="relative w-full h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
                {/* Main Image Display */}
                <div className="flex-1 flex items-center justify-center w-full min-h-0 relative">
                     {isGenerating ? (
                         <div className="flex flex-col items-center justify-center text-white gap-4">
                             <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                             <p className="font-bold text-lg animate-pulse">{currentFrame.generatingMessage || "Генерация..."}</p>
                         </div>
                     ) : hasError ? (
                         <div className="flex flex-col items-center justify-center text-red-400 gap-4">
                             <span className="material-symbols-outlined text-6xl">broken_image</span>
                             <p className="font-bold text-lg">Ошибка загрузки изображения</p>
                         </div>
                     ) : activeImageUrl ? (
                        <img
                            src={activeImageUrl}
                            alt={`Enlarged frame view ${currentIndex + 1}`}
                            className="object-contain max-w-full max-h-full rounded-lg shadow-2xl"
                        />
                     ) : (
                         <div className="text-white/50">Нет изображения</div>
                     )}
                </div>

                 {/* Navigation Buttons */}
                <button
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 size-12 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm transition-transform hover:scale-110"
                    aria-label="Previous image"
                >
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 size-12 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm transition-transform hover:scale-110"
                    aria-label="Next image"
                >
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>

                 {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 size-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm"
                    aria-label="Close image viewer"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {/* Thumbnail Strip */}
                <div className="w-full max-w-screen-lg mt-4 shrink-0">
                    <div className="flex justify-center p-2">
                        <div className="flex items-center gap-3 overflow-x-auto pb-2">
                            {frames.map((frame, index) => (
                                <div key={frame.id} className="relative shrink-0">
                                    {frame.isGenerating ? (
                                        <div 
                                            className={`w-24 h-14 flex items-center justify-center bg-primary/10 rounded-md border-2 transition-all ${currentIndex === index ? 'border-primary' : 'border-transparent'}`}
                                            onClick={() => setCurrentIndex(index)}
                                        >
                                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : (
                                        <img
                                            ref={index === currentIndex ? activeThumbnailRef : null}
                                            src={frame.imageUrls[frame.activeVersionIndex]}
                                            alt={`Thumbnail ${index + 1}`}
                                            className={`w-24 h-14 object-cover rounded-md cursor-pointer border-2 transition-all ${
                                                currentIndex === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                                            }`}
                                            onClick={() => setCurrentIndex(index)}
                                        />
                                    )}
                                    <div className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{index + 1}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
