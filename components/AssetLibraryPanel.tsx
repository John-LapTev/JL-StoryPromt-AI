
import React, { useState, useRef, forwardRef } from 'react';
import type { Asset, StorySettings } from '../types';
import { AssetViewerModal } from './AssetViewerModal';

interface AssetLibraryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    selectedAssetIds: Set<string>;
    storySettings: StorySettings;
    frameCount: number;
    isDropTarget?: boolean;
    onAddAssets: (files: File[]) => void;
    onAddAssetFromSketch: (sketchId: string) => void;
    onDeleteAsset: (id: string) => void;
    onToggleSelectAsset: (id: string) => void;
    onSelectAllAssets: () => void;
    onDeselectAllAssets: () => void;
    onGenerateStory: () => void;
    onOpenStorySettings: () => void;
    onFrameCountChange: (count: number) => void;
}

export const AssetLibraryPanel = forwardRef<HTMLDivElement, AssetLibraryPanelProps>(({ 
    isOpen, 
    onClose, 
    assets, 
    selectedAssetIds, 
    storySettings,
    frameCount,
    isDropTarget,
    onAddAssets, 
    onAddAssetFromSketch,
    onDeleteAsset, 
    onToggleSelectAsset, 
    onSelectAllAssets,
    onDeselectAllAssets,
    onGenerateStory,
    onOpenStorySettings,
    onFrameCountChange,
}, ref) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [viewingAssetIndex, setViewingAssetIndex] = useState<number | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            onAddAssets(Array.from(event.target.files));
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleAssetClick = (assetId: string, index: number) => {
        if (isSelectionMode) {
            onToggleSelectAsset(assetId);
        } else {
            setViewingAssetIndex(index);
        }
    };
    
    const handleToggleSelectionMode = () => {
        const newMode = !isSelectionMode;
        setIsSelectionMode(newMode);
        if (!newMode) { // If turning selection mode OFF
            onDeselectAllAssets();
        }
    };

    const handleDragStart = (e: React.DragEvent, assetId: string) => {
        const isMultiDrag = isSelectionMode && selectedAssetIds.has(assetId);
        const idsToDrag = isMultiDrag ? Array.from(selectedAssetIds) : [assetId];
        
        const dragImage = e.currentTarget.querySelector('img');
        if (dragImage) {
            if (isMultiDrag) {
                const wrapper = document.createElement('div');
                wrapper.style.position = 'absolute';
                wrapper.style.top = '-1000px';
                wrapper.style.left = '-1000px';
    
                const countBadge = document.createElement('div');
                countBadge.textContent = `${idsToDrag.length}`;
                countBadge.style.position = 'absolute';
                countBadge.style.top = '0px';
                countBadge.style.right = '0px';
                countBadge.style.background = '#1337ec';
                countBadge.style.color = 'white';
                countBadge.style.borderRadius = '9999px';
                countBadge.style.width = '24px';
                countBadge.style.height = '24px';
                countBadge.style.display = 'flex';
                countBadge.style.alignItems = 'center';
                countBadge.style.justifyContent = 'center';
                countBadge.style.fontSize = '12px';
                countBadge.style.fontWeight = 'bold';
    
                const imageClone = dragImage.cloneNode(true) as HTMLImageElement;
                imageClone.style.width = '96px';
                imageClone.style.height = '56px';
                imageClone.style.objectFit = 'cover';
                imageClone.style.borderRadius = '8px';
    
                const container = document.createElement('div');
                container.style.position = 'relative';
                container.appendChild(imageClone);
                container.appendChild(countBadge);
                
                wrapper.appendChild(container);
                document.body.appendChild(wrapper);
                
                e.dataTransfer.setDragImage(container, 10, 10);
    
                setTimeout(() => document.body.removeChild(wrapper), 0);
            } else {
                e.dataTransfer.setDragImage(dragImage, dragImage.width / 2, dragImage.height / 2);
            }
        }
    
        e.dataTransfer.setData('application/json;type=asset-ids', JSON.stringify(idsToDrag));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handlePanelDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const isFile = e.dataTransfer.types.includes('Files');
        const isSketch = e.dataTransfer.types.includes('application/json;type=sketch-id');

        if (isFile || isSketch) {
            setIsDraggingOver(true);
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handlePanelDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handlePanelDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        
        const sketchId = e.dataTransfer.getData('application/json;type=sketch-id');
        if (sketchId) {
            onAddAssetFromSketch(sketchId);
            return;
        }

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            // FIX: Explicitly type the 'file' parameter in the filter to resolve 'unknown' type error.
            const imageFiles = Array.from(files).filter((file: File) => file.type.startsWith('image/'));
            if (imageFiles.length > 0) {
                onAddAssets(imageFiles);
            }
        }
    };

    const modeText = storySettings.mode === 'auto' ? 'Авто' : 'Ручной';
    let createStoryButtonText = `Создать сюжет (${modeText})`;
    if (selectedAssetIds.size > 0) {
        createStoryButtonText = `Создать сюжет из ${selectedAssetIds.size} ассетов (${modeText})`;
    }

    const isDropActive = isDraggingOver || isDropTarget;

    return (
        <>
            <div 
                ref={ref}
                className={`absolute top-0 right-0 h-full bg-[#101322]/80 backdrop-blur-lg border-l border-white/10 shadow-2xl z-30 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} w-full max-w-sm flex flex-col ${isDropActive ? 'ring-2 ring-primary ring-inset' : ''}`}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">photo_library</span>
                        Библиотека Ассетов
                    </h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-4 border-b border-white/10 shrink-0 space-y-3">
                    <div className="flex items-center justify-between">
                        <label htmlFor="selection-mode-toggle" className="text-sm font-bold text-white/80 select-none">
                            Режим выделения
                        </label>
                        <button
                            id="selection-mode-toggle"
                            role="switch"
                            aria-checked={isSelectionMode}
                            onClick={handleToggleSelectionMode}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                isSelectionMode ? 'bg-primary' : 'bg-white/20'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    isSelectionMode ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                    {isSelectionMode && (
                        <div className="flex items-center gap-2">
                            <button onClick={onSelectAllAssets} className="flex-1 text-xs font-bold bg-white/10 text-white/80 h-8 rounded-md hover:bg-white/20">Выделить всё</button>
                            <button onClick={onDeselectAllAssets} className="flex-1 text-xs font-bold bg-white/10 text-white/80 h-8 rounded-md hover:bg-white/20">Снять выделение</button>
                        </div>
                    )}
                </div>

                <div 
                    onDragOver={handlePanelDragOver}
                    onDragLeave={handlePanelDragLeave}
                    onDrop={handlePanelDrop}
                    className={`flex-1 p-4 overflow-y-auto space-y-4 transition-colors rounded-lg m-2 -mt-0 ${isDraggingOver ? 'bg-primary/20' : ''}`}
                >
                    <div className="grid grid-cols-3 gap-3">
                        {assets.map((asset, index) => (
                            <div 
                                key={asset.id} 
                                className="relative group/asset cursor-pointer" 
                                onMouseDown={(e) => { if (e.button === 0) e.stopPropagation(); }}
                                onClick={() => handleAssetClick(asset.id, index)}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, asset.id)}
                            >
                                <img 
                                    src={asset.imageUrl}
                                    alt={asset.name}
                                    className={`w-full h-24 object-cover rounded-lg border-2 transition-all ${selectedAssetIds.has(asset.id) && isSelectionMode ? 'border-primary' : 'border-transparent'}`}
                                />
                                <div className={`absolute inset-0 rounded-lg bg-black/50 transition-opacity flex items-center justify-center ${
                                    (selectedAssetIds.has(asset.id) && isSelectionMode) ? 'opacity-100' : 'opacity-0 group-hover/asset:opacity-100'
                                }`}>
                                    {!isSelectionMode && <span className="material-symbols-outlined text-4xl text-white">zoom_in</span>}
                                    
                                    {isSelectionMode && (
                                        <div className={`absolute top-1.5 left-1.5 size-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedAssetIds.has(asset.id) ? 'bg-primary border-primary' : 'bg-black/50 border-white/50'}`}>
                                            {selectedAssetIds.has(asset.id) && <span className="material-symbols-outlined text-sm text-white">check</span>}
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteAsset(asset.id); }}
                                        className="absolute top-1.5 right-1.5 z-10 size-5 rounded-full bg-red-600/80 flex items-center justify-center text-white opacity-0 group-hover/asset:opacity-100 hover:bg-red-500 backdrop-blur-sm transition-opacity"
                                        aria-label="Delete asset"
                                    >
                                        <span className="material-symbols-outlined text-xs">delete</span>
                                    </button>
                                    <p className="absolute bottom-0 left-0 right-0 text-white text-xs p-1 bg-black/50 text-center truncate">{asset.name}</p>
                                </div>
                            </div>
                        ))}
                        <button onClick={handleUploadClick} className="w-full h-24 rounded-lg border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-white/50 hover:border-primary hover:text-primary transition-colors">
                            <span className="material-symbols-outlined">add_photo_alternate</span>
                            <span className="text-xs">Загрузить</span>
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 shrink-0 space-y-4 bg-[#191C2D]/50">
                     <div className="flex items-center gap-2">
                         <div className="flex-1">
                             <label htmlFor="frame-count" className="text-xs font-bold text-white/70 mb-1 block">Количество кадров</label>
                             <input
                                type="number"
                                id="frame-count"
                                value={frameCount}
                                onChange={(e) => onFrameCountChange(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2)))}
                                min="2"
                                max="20"
                                className="w-full bg-white/5 p-2 rounded-lg text-sm text-white/90 focus:ring-2 focus:ring-primary border-none"
                             />
                        </div>
                        <button
                            onClick={onOpenStorySettings}
                            className="self-end flex-shrink-0 size-10 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                            aria-label="Настройки сюжета"
                        >
                             <span className="material-symbols-outlined">tune</span>
                        </button>
                    </div>
                     <button 
                        onClick={onGenerateStory}
                        disabled={assets.length === 0}
                        className="w-full flex items-center justify-center gap-2 rounded-lg h-12 px-4 bg-primary text-white text-base font-bold hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined">auto_awesome</span>
                        <span>{createStoryButtonText}</span>
                    </button>
                </div>
            </div>
            {viewingAssetIndex !== null && (
                <AssetViewerModal
                    assets={assets}
                    startIndex={viewingAssetIndex}
                    onClose={() => setViewingAssetIndex(null)}
                />
            )}
        </>
    );
});
