import React, { useRef } from 'react';

interface AddFrameButtonProps {
    index: number;
    onOpenMenu: (index: number, rect: DOMRect) => void;
    // Drag and drop props
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    isDropTarget?: boolean;
}

export const AddFrameButton: React.FC<AddFrameButtonProps> = ({ 
    index, 
    onOpenMenu,
    onDragOver,
    onDrop,
    isDropTarget 
}) => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleClick = () => {
        if (buttonRef.current) {
            onOpenMenu(index, buttonRef.current.getBoundingClientRect());
        }
    };
    
    const dropZoneClasses = isDropTarget ? 'bg-primary/20' : '';
    const buttonClasses = isDropTarget 
        ? 'border-primary scale-110'
        : 'border-white/20 group-hover:border-white/40 group-hover:text-white/80';
    
    return (
        <div 
            className={`group shrink-0 h-[228px] flex items-center justify-center px-2 transition-colors ${dropZoneClasses}`}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <button
                ref={buttonRef}
                onClick={handleClick}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed w-12 h-full p-2 text-white/50 transition-all duration-200 ${buttonClasses}`}
            >
                <span className="material-symbols-outlined text-3xl">add</span>
            </button>
        </div>
    );
};