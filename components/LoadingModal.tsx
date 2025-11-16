
import React from 'react';

interface LoadingModalProps {
    message: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ message }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-8 flex flex-col items-center gap-4 text-white">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-lg font-medium">{message}</p>
            </div>
        </div>
    );
};
