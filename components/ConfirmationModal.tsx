
import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Продолжить",
    cancelText = "Отмена"
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in" onClick={onCancel}>
            <div className="glass-modal rounded-2xl p-6 flex flex-col gap-4 text-white max-w-md w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold font-display tracking-wide">{title}</h3>
                <p className="text-sm text-white/80 leading-relaxed">{message}</p>
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onCancel} className="glass-button px-4 py-2 rounded-lg text-sm font-bold text-white/70">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className="glass-button-primary px-4 py-2 rounded-lg text-white text-sm font-bold">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
