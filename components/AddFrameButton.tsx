
import React, { useRef, useEffect } from 'react';

interface AddFrameButtonProps {
    index: number;
    onOpenMenu: (index: number, rect: DOMRect) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    isDropTarget?: boolean;
    onRegisterDropZone?: (index: number, element: HTMLElement | null) => void;
}

export const AddFrameButton: React.FC<AddFrameButtonProps> = ({ 
    index, onOpenMenu, onDragOver, onDrop, isDropTarget, onRegisterDropZone,
}) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = dropZoneRef.current;
        if (element && onRegisterDropZone) { onRegisterDropZone(index, element); }
        return () => { if (onRegisterDropZone) { onRegisterDropZone(index, null); } };
    }, [index, onRegisterDropZone]);

    const handleClick = () => { if (buttonRef.current) { onOpenMenu(index, buttonRef.current.getBoundingClientRect()); } };
    
    return (
        <div 
            ref={dropZoneRef}
            className={`group shrink-0 flex items-center justify-center px-1 transition-all duration-200 w-14 h-[135px] ${isDropTarget ? 'w-20' : ''}`}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <div className={`h-full w-[2px] bg-white/5 group-hover:bg-primary/50 transition-colors rounded-full relative ${isDropTarget ? 'bg-primary w-1' : ''}`}>
                <button
                    ref={buttonRef}
                    onClick={handleClick}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-surface border border-white/10 text-white/30 flex items-center justify-center transition-all duration-200 group-hover:scale-125 group-hover:border-primary group-hover:text-primary z-20 ${isDropTarget ? 'scale-150 border-primary text-primary' : ''}`}
                >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
            </div>
        </div>
    );
};