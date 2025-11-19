
import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';

interface ContextMenuAction {
    label: string;
    icon: string;
    onClick: () => void;
    isDestructive?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    actions: ContextMenuAction[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, actions, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x, y });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        // Use capture phase to catch clicks on any element and prevent them from firing their own handlers first
        document.addEventListener('mousedown', handleClickOutside, true); 
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    useLayoutEffect(() => {
        if (menuRef.current) {
            const menuRect = menuRef.current.getBoundingClientRect();
            let newX = x;
            let newY = y;
            if (x + menuRect.width > window.innerWidth) {
                newX = window.innerWidth - menuRect.width - 8; // Adjust to stay in viewport with padding
            }
            if (y + menuRect.height > window.innerHeight) {
                newY = window.innerHeight - menuRect.height - 8; // Adjust to stay in viewport with padding
            }
            setPosition({ x: newX, y: newY });
        }
    }, [x, y]);

    return (
        <div 
            ref={menuRef}
            style={{ top: position.y, left: position.x }}
            className="absolute z-50 w-56 bg-[#191C2D] border border-white/10 rounded-lg shadow-lg p-1 animate-fade-in"
        >
            {actions.map((action, index) => (
                <button
                    key={index}
                    onClick={() => {
                        action.onClick();
                        onClose();
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded-md flex items-center gap-3 ${
                        action.isDestructive 
                        ? 'text-red-400 hover:bg-red-500/20' 
                        : 'text-white/90 hover:bg-white/10'
                    }`}
                >
                    <span className="material-symbols-outlined text-base w-5 text-center">{action.icon}</span>
                    <span>{action.label}</span>
                </button>
            ))}
        </div>
    );
};
