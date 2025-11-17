import React, { useState, useRef, useEffect } from 'react';

interface AddFrameButtonProps {
    index: number;
    onAddFrame: (index: number, type: 'upload' | 'generate' | 'intermediate') => void;
    onGenerateTransition?: (index: number) => void;
    showIntermediateOption?: boolean;
    // Drag and drop props
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: () => void;
    onDrop?: (e: React.DragEvent) => void;
    isDropTarget?: boolean;
}

export const AddFrameButton: React.FC<AddFrameButtonProps> = ({ 
    index, 
    onAddFrame, 
    onGenerateTransition, 
    showIntermediateOption = false,
    onDragOver,
    onDragLeave,
    onDrop,
    isDropTarget 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);
    
    const dropTargetClasses = isDropTarget 
        ? 'border-primary bg-primary/20 scale-105'
        : 'border-white/20 hover:border-white/40 hover:text-white/80';
    
    return (
        <div className="relative shrink-0" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(prev => !prev)}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed w-12 h-[152px] p-2 text-white/50 transition-all duration-200 ${dropTargetClasses}`}
            >
                <span className="material-symbols-outlined text-3xl">add</span>
            </button>
            {isOpen && (
                 <div className="absolute top-full left-1/2 z-10 w-max -translate-x-1/2 mt-2">
                    <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-[#191C2D] p-1 shadow-lg">
                        <button onClick={() => { onAddFrame(index, 'upload'); setIsOpen(false); }} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-md h-8 px-2.5 bg-white/10 text-white text-xs font-bold leading-normal tracking-[0.015em] hover:bg-white/20 w-full gap-2">
                            <span className="material-symbols-outlined text-base">upload</span>
                            <span>Загрузить кадр</span>
                        </button>
                        <button onClick={() => { onAddFrame(index, 'generate'); setIsOpen(false); }} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-md h-8 px-2.5 bg-white/10 text-white text-xs font-bold leading-normal tracking-[0.015em] hover:bg-white/20 w-full gap-2">
                            <span className="material-symbols-outlined text-base">layers</span>
                            <span>Сгенерировать</span>
                        </button>
                         {showIntermediateOption && (
                            <button onClick={() => { onAddFrame(index, 'intermediate'); setIsOpen(false); }} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-md h-8 px-2.5 bg-white/10 text-white text-xs font-bold leading-normal tracking-[0.015em] hover:bg-white/20 w-full gap-2">
                                <span className="material-symbols-outlined text-base"> Splitscreen </span>
                                <span>Сгенерировать промежуточный</span>
                            </button>
                        )}
                        {showIntermediateOption && onGenerateTransition && (
                            <button onClick={() => { onGenerateTransition(index); setIsOpen(false); }} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-md h-8 px-2.5 bg-white/10 text-white text-xs font-bold leading-normal tracking-[0.015em] hover:bg-white/20 w-full gap-2">
                                <span className="material-symbols-outlined text-base">sync_alt</span>
                                <span>Сгенерировать переход</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};