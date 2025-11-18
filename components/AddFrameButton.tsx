import React, { useRef } from 'react';

interface AddFrameButtonProps {
    index: number;
    onOpenMenu: (index: number, rect: DOMRect) => void;
    // Drag and drop props
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: () => void;
    onDrop?: (e: React.DragEvent) => void;
    isDropTarget?: boolean;
}

export const AddFrameButton: React.FC<AddFrameButtonProps> = ({ 
    index, 
    onOpenMenu,
    onDragOver,
    onDragLeave,
    onDrop,
    isDropTarget 
}) => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleClick = () => {
        if (buttonRef.current) {
            onOpenMenu(index, buttonRef.current.getBoundingClientRect());
        }
    };
    
    const dropTargetClasses = isDropTarget 
        ? 'border-primary bg-primary/20 scale-105'
        : 'border-white/20 hover:border-white/40 hover:text-white/80';
    
    return (
        <div className="shrink-0">
            <button
                ref={buttonRef}
                onClick={handleClick}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed w-12 h-[196px] p-2 text-white/50 transition-all duration-200 ${dropTargetClasses}`}
            >
                <span className="material-symbols-outlined text-3xl">add</span>
            </button>
        </div>
    );
};