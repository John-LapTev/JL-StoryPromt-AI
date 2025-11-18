import React, { useEffect } from 'react';

interface ToastProps {
    message: string;
    actionText: string;
    onAction: () => void;
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, actionText, onAction, onClose, duration = 10000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);
    
    return (
        <div 
            className="fixed bottom-6 right-6 z-50 bg-[#191C2D] border border-white/10 rounded-xl shadow-2xl p-4 flex items-center gap-4 max-w-md animate-fade-in-up"
            role="alert"
        >
            <div className="flex-shrink-0 size-8 bg-primary/20 text-primary flex items-center justify-center rounded-full">
                <span className="material-symbols-outlined">auto_fix</span>
            </div>
            <div className="flex-grow">
                <p className="text-sm font-bold text-white">{message}</p>
                <button onClick={onAction} className="text-sm font-bold text-primary hover:underline">
                    {actionText}
                </button>
            </div>
             <button onClick={onClose} className="flex-shrink-0 size-8 text-white/60 hover:text-white hover:bg-white/10 rounded-full flex items-center justify-center" aria-label="Close">
                <span className="material-symbols-outlined text-base">close</span>
            </button>
        </div>
    );
};

// Add this animation to index.html's style tag or a global CSS file
/*
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out forwards;
}
*/
