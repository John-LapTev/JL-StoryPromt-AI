
import React from 'react';

interface LoadingModalProps {
    message: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ message }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="glass-modal rounded-2xl p-8 flex flex-col items-center gap-6 text-white min-w-[300px]">
                <div className="relative">
                     <div className="w-16 h-16 border-4 border-white/10 rounded-full"></div>
                     <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-neon"></div>
                </div>
                <p className="text-lg font-medium tracking-wide text-center">{message}</p>
            </div>
        </div>
    );
};
