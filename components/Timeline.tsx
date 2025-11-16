
import React, { useRef, useState, useEffect } from 'react';
import type { Frame } from '../types';
import { FrameCard } from './FrameCard';
import { AddFrameButton } from './AddFrameButton';
import { IntermediateLoadingCard } from './IntermediateLoadingCard';
import { GeneratingVideoState } from '../App';

interface Transform {
    scale: number;
    x: number;
    y: number;
}
interface TimelineProps {
    frames: Frame[];
    totalDuration: number;
    transform: Transform;
    setTransform: React.Dispatch<React.SetStateAction<Transform>>;
    generatingIntermediateIndex: number | null;
    generatingNewFrameIndex: number | null;
    generatingStory: boolean;
    generatingPromptFrameId: string | null;
    generatingVideoState: GeneratingVideoState;
    onDurationChange: (id: string, newDuration: number) => void;
    onPromptChange: (id: string, newPrompt: string) => void;
    onAddFrame: (index: number, type: 'upload' | 'generate' | 'intermediate') => void;
    onDeleteFrame: (id: string) => void;
    onAnalyzeStory: () => void;
    onGenerateSinglePrompt: (id: string) => void;
    onGenerateTransition: (index: number) => void;
    onGenerateVideo: (frame: Frame) => void;
    onEditPrompt: (frame: Frame) => void;
    onViewImage: (imageUrl: string) => void;
    onOpenDetailView: (frame: Frame) => void;
}


export const Timeline: React.FC<TimelineProps> = ({
    frames,
    totalDuration,
    transform,
    setTransform,
    generatingIntermediateIndex,
    generatingNewFrameIndex,
    generatingStory,
    generatingPromptFrameId,
    generatingVideoState,
    onDurationChange,
    onPromptChange,
    onAddFrame,
    onDeleteFrame,
    onAnalyzeStory,
    onGenerateSinglePrompt,
    onGenerateTransition,
    onGenerateVideo,
    onEditPrompt,
    onViewImage,
    onOpenDetailView,
}) => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.clientX - startPos.x;
            const dy = e.clientY - startPos.y;
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setStartPos({ x: e.clientX, y: e.clientY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            if(timelineRef.current) {
                timelineRef.current.style.cursor = 'default';
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, startPos, setTransform]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.frame-card-interactive')) {
            return;
        }
        e.preventDefault();
        setIsDragging(true);
        setStartPos({ x: e.clientX, y: e.clientY });
         if(timelineRef.current) {
            timelineRef.current.style.cursor = 'grabbing';
        }
    };
    
    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.max(0.2, Math.min(2, transform.scale + scaleAmount));
        
        const rect = timelineRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
        const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
        
        setTransform({ scale: newScale, x: newX, y: newY });
    };

    const handleResetView = () => {
        setTransform({ scale: 1, x: 0, y: 0 });
    };

    return (
        <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Timeline</h3>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        <span className="material-symbols-outlined text-sm">timer</span>
                        <span>{totalDuration.toFixed(2)} s</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button onClick={handleResetView} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 hover:bg-white/20">
                        <span className="material-symbols-outlined text-base">settings_backup_restore</span>
                        <span className="truncate">Сбросить вид</span>
                    </button>
                    <button onClick={onAnalyzeStory} disabled={generatingStory} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed">
                        {generatingStory ? (
                             <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                             <span className="material-symbols-outlined text-base">auto_awesome</span>
                        )}
                        <span className="truncate">{generatingStory ? 'Анализ...' : 'Анализировать сюжет и создать промты'}</span>
                    </button>
                </div>
            </div>
            <div 
                ref={timelineRef}
                className="flex-1 rounded-lg p-4 overflow-hidden grid-bg-metallic border border-white/20 min-h-[220px] relative"
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                <div
                     style={{
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        transformOrigin: 'top left',
                        width: 'max-content'
                     }}
                >
                    <div className="flex items-start gap-4 h-full p-4">
                        <div className="frame-card-interactive">
                             {generatingNewFrameIndex === 0 ? <IntermediateLoadingCard /> : <AddFrameButton index={0} onAddFrame={onAddFrame} showIntermediateOption={false} />}
                        </div>
                        {frames.map((frame, index) => (
                            <React.Fragment key={frame.id}>
                                <div className="frame-card-interactive">
                                    <FrameCard
                                        frame={frame}
                                        index={index}
                                        isGeneratingPrompt={generatingPromptFrameId === frame.id}
                                        generatingVideoState={generatingVideoState?.frameId === frame.id ? generatingVideoState : null}
                                        onDurationChange={onDurationChange}
                                        onPromptChange={onPromptChange}
                                        onDeleteFrame={onDeleteFrame}
                                        onGenerateSinglePrompt={onGenerateSinglePrompt}
                                        onEditPrompt={onEditPrompt}
                                        onViewImage={onViewImage}
                                        onGenerateVideo={onGenerateVideo}
                                        onOpenDetailView={onOpenDetailView}
                                    />
                                </div>
                                <div className="frame-card-interactive">
                                    {generatingIntermediateIndex === index + 1 || generatingNewFrameIndex === index + 1 ? (
                                        <IntermediateLoadingCard />
                                    ) : (
                                        <AddFrameButton
                                            index={index + 1}
                                            onAddFrame={onAddFrame}
                                            onGenerateTransition={onGenerateTransition}
                                            showIntermediateOption={index < frames.length - 1}
                                        />
                                    )}
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
