import React from 'react';
import type { Frame } from '../types';
import { GeneratingVideoState } from '../App';

interface FrameCardProps {
    frame: Frame;
    index: number;
    isGeneratingPrompt: boolean;
    generatingVideoState: GeneratingVideoState;
    onDurationChange: (id: string, newDuration: number) => void;
    onPromptChange: (id: string, newPrompt: string) => void;
    onDeleteFrame: (id: string) => void;
    onGenerateSinglePrompt: (id: string) => void;
    onEditPrompt: (frame: Frame) => void;
    onViewImage: (imageUrl: string) => void;
    onGenerateVideo: (frame: Frame) => void;
    onOpenDetailView: (frame: Frame) => void;
}

export const FrameCard: React.FC<FrameCardProps> = ({ frame, index, isGeneratingPrompt, generatingVideoState, onDurationChange, onPromptChange, onDeleteFrame, onGenerateSinglePrompt, onEditPrompt, onViewImage, onGenerateVideo, onOpenDetailView }) => {
    const DURATION_STEP = 0.25;

    const handleDecrease = () => {
        onDurationChange(frame.id, frame.duration - DURATION_STEP);
    };

    const handleIncrease = () => {
        onDurationChange(frame.id, frame.duration + DURATION_STEP);
    };

    const handleGenerateVideoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onGenerateVideo(frame);
    };

    const PromptSection: React.FC = () => {
        if (isGeneratingPrompt) {
            return (
                 <div className="flex items-center justify-center gap-2 w-48 h-[76px] bg-white/5 p-2 rounded-lg">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            );
        }

        if (frame.prompt) {
             const promptBgClass = frame.isTransition
                ? 'bg-gradient-to-r from-primary/20 to-white/5'
                : 'bg-white/5';
                
            return (
                <div className={`flex items-start gap-2 w-48 h-[76px] p-2 rounded-lg relative group/prompt ${promptBgClass}`}>
                    <span 
                        className="material-symbols-outlined text-base text-primary pt-0.5"
                        title={frame.isTransition ? "Промт для перехода" : "Промт для анимации"}
                    >
                        {frame.isTransition ? 'sync_alt' : 'auto_awesome'}
                    </span>
                     <p className="text-xs text-white/80 leading-snug w-full h-full overflow-hidden">
                        {frame.prompt}
                    </p>
                    <button onClick={() => onEditPrompt(frame)} className="absolute top-1 right-1 p-0.5 bg-white/10 rounded-sm text-white opacity-0 group-hover/prompt:opacity-100 hover:bg-white/20 focus:opacity-100">
                        <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                </div>
            );
        }

        return (
            <button onClick={() => onGenerateSinglePrompt(frame.id)} className="flex min-w-[84px] w-48 max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 hover:bg-white/20">
                <span className="material-symbols-outlined">auto_awesome</span>
                <span className="truncate">Сгенерировать промт</span>
            </button>
        );
    };


    return (
        <div className="flex flex-col gap-2 shrink-0">
            <div className="flex flex-col items-center gap-1">
                <div 
                    className="relative group"
                    onDoubleClick={() => onOpenDetailView(frame)}
                >
                    <div 
                        className="w-48 h-28 rounded-lg bg-cover bg-center border-2 border-primary cursor-pointer" 
                        style={{ backgroundImage: `url(${frame.imageUrl})` }}
                        onClick={() => onViewImage(frame.imageUrl)}
                    ></div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDeleteFrame(frame.id); }}
                        className="absolute top-1.5 right-1.5 z-10 size-6 rounded-full bg-red-600/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 backdrop-blur-sm transition-opacity"
                        aria-label="Delete frame"
                    >
                        <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                    <div 
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                        onClick={() => onViewImage(frame.imageUrl)}
                    >
                        <button onClick={handleGenerateVideoClick} className="size-10 rounded-full bg-white/20 flex flex-col items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm text-xs">
                             <span className="material-symbols-outlined text-lg">movie</span>
                             <span className="text-[10px]">VEO</span>
                        </button>
                    </div>
                    {generatingVideoState && (
                         <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center text-white rounded-lg p-2 gap-2 text-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-xs font-medium">{generatingVideoState.message}</p>
                        </div>
                    )}
                    <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">{index + 1}</div>
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-center">
                        <div className="flex h-6 items-center rounded-full bg-black/70 px-0.5 backdrop-blur-sm">
                            <button onClick={handleDecrease} className="flex size-5 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"><span className="material-symbols-outlined text-base font-bold">remove</span></button>
                            <div className="flex items-baseline whitespace-nowrap px-1.5 text-xs font-medium text-white">
                                <span>({frame.duration.toFixed(2)})</span><span className="text-[0.625rem] ml-0.5">s</span>
                            </div>
                            <button onClick={handleIncrease} className="flex size-5 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"><span className="material-symbols-outlined text-base font-bold">add</span></button>
                        </div>
                    </div>
                </div>
            </div>
            <PromptSection />
        </div>
    );
};