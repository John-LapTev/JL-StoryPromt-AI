
import React, { useState } from 'react';

interface GenerateFrameModalProps {
    onClose: () => void;
    onGenerate: (data: { mode: 'generate', prompt: string, maintainContext: boolean }) => void;
}

export const GenerateFrameModal: React.FC<GenerateFrameModalProps> = ({ onClose, onGenerate }) => {
    const [prompt, setPrompt] = useState('');
    const [maintainContext, setMaintainContext] = useState(true);

    const handleGenerateClick = () => {
        if (!prompt.trim()) {
            alert("Пожалуйста, введите промт.");
            return;
        }
        
        onGenerate({
            mode: 'generate',
            prompt,
            maintainContext,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold">Создать новый кадр</h3>
                
                <div className="flex items-center justify-between gap-4 p-3 bg-white/5 rounded-lg my-1">
                    <div>
                        <label htmlFor="maintain-context" className="text-sm text-white/80 cursor-pointer font-bold">
                            Сохранять контекст сюжета
                        </label>
                            <p className="text-xs text-white/60">AI учтет соседние кадры для лучшего соответствия стилю и истории.</p>
                    </div>
                    <button 
                        role="switch"
                        aria-checked={maintainContext}
                        id="maintain-context"
                        onClick={() => setMaintainContext(!maintainContext)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#191C2D] ${maintainContext ? 'bg-primary' : 'bg-gray-600'}`}
                    >
                        <span
                            aria-hidden="true"
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${maintainContext ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>
                
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Промт для генерации: A futuristic cityscape..." 
                    className="w-full h-24 bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none resize-none"
                    aria-label="Prompt for new frame"
                />
                <div className="flex justify-end gap-3 mt-2">
                    <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">
                        Отмена
                    </button>
                    <button onClick={handleGenerateClick} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90">
                        Создать
                    </button>
                </div>
            </div>
        </div>
    );
};
