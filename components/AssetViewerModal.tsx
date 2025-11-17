import React, { useState, useEffect, useRef } from 'react';
import type { Asset } from '../types';

interface AssetViewerModalProps {
    assets: Asset[];
    startIndex: number;
    onClose: () => void;
}

export const AssetViewerModal: React.FC<AssetViewerModalProps> = ({ assets, startIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const activeThumbnailRef = useRef<HTMLImageElement>(null);

    const handleNext = () => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % assets.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + assets.length) % assets.length);
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
    }, [assets.length]);

    useEffect(() => {
        if (activeThumbnailRef.current) {
            activeThumbnailRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
            });
        }
    }, [currentIndex]);

    if (!assets || assets.length === 0) {
        return null;
    }
    
    const currentAsset = assets[currentIndex];

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-4"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div className="relative w-full h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
                {/* Main Image Display */}
                <div className="flex-1 flex items-center justify-center w-full min-h-0 relative">
                     <img
                        src={currentAsset.imageUrl}
                        alt={currentAsset.name}
                        className="object-contain max-w-full max-h-full rounded-lg shadow-2xl"
                    />
                </div>

                 {/* Navigation Buttons */}
                <button
                    onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 size-12 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm transition-transform hover:scale-110"
                    aria-label="Previous asset"
                >
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 size-12 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm transition-transform hover:scale-110"
                    aria-label="Next asset"
                >
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>

                 {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 size-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm"
                    aria-label="Close asset viewer"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {/* Thumbnail Strip */}
                <div className="w-full max-w-screen-lg mt-4 shrink-0">
                    <div className="flex justify-center p-2">
                        <div className="flex items-center gap-3 overflow-x-auto pb-2">
                            {assets.map((asset, index) => (
                                <div key={asset.id} className="relative shrink-0">
                                    <img
                                        ref={index === currentIndex ? activeThumbnailRef : null}
                                        src={asset.imageUrl}
                                        alt={`Thumbnail ${asset.name}`}
                                        className={`w-24 h-14 object-cover rounded-md cursor-pointer border-2 transition-all ${
                                            currentIndex === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
                                    />
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
