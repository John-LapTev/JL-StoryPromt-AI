
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
    isOpen, onClose, assets, selectedAssetIds, storySettings, frameCount, isDropTarget,
    onAddAssets, onAddAssetFromSketch, onDeleteAsset, onToggleSelectAsset, onSelectAllAssets,
    onDeselectAllAssets, onGenerateStory, onOpenStorySettings, onFrameCountChange,
}, ref) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [viewingAssetIndex, setViewingAssetIndex] = useState<number | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.files) { onAddAssets(Array.from(event.target.files)); } };
    const handleUploadClick = () => { fileInputRef.current?.click(); };
    const handleAssetClick = (assetId: string, index: number) => { if (isSelectionMode) { onToggleSelectAsset(assetId); } else { setViewingAssetIndex(index); } };
    const handleToggleSelectionMode = () => { const newMode = !isSelectionMode; setIsSelectionMode(newMode); if (!newMode) { onDeselectAllAssets(); } };

    const handleDragStart = (e: React.DragEvent, assetId: string) => {
        const isMultiDrag = isSelectionMode && selectedAssetIds.has(assetId);
        const idsToDrag = isMultiDrag ? Array.from(selectedAssetIds) : [assetId];
        
        const dragImage = e.currentTarget.querySelector('img');
        if (dragImage) {
            if (isMultiDrag) {
                const wrapper = document.createElement('div'); wrapper.style.position = 'absolute'; wrapper.style.top = '-1000px'; wrapper.style.left = '-1000px';
                const countBadge = document.createElement('div'); countBadge.textContent = `${idsToDrag.length}`; countBadge.style.position = 'absolute'; countBadge.style.top = '0px'; countBadge.style.right = '0px'; countBadge.style.background = '#3b82f6'; countBadge.style.color = 'white'; countBadge.style.borderRadius = '9999px'; countBadge.style.width = '24px'; countBadge.style.height = '24px'; countBadge.style.display = 'flex'; countBadge.style.alignItems = 'center'; countBadge.style.justifyContent = 'center'; countBadge.style.fontSize = '12px'; countBadge.style.fontWeight = 'bold';
                const imageClone = dragImage.cloneNode(true) as HTMLImageElement; imageClone.style.width = '96px'; imageClone.style.height = '56px'; imageClone.style.objectFit = 'cover'; imageClone.style.borderRadius = '8px';
                const container = document.createElement('div'); container.style.position = 'relative'; container.appendChild(imageClone); container.appendChild(countBadge);
                wrapper.appendChild(container); document.body.appendChild(wrapper); e.dataTransfer.setDragImage(container, 10, 10); setTimeout(() => document.body.removeChild(wrapper), 0);
            } else { e.dataTransfer.setDragImage(dragImage, dragImage.width / 2, dragImage.height / 2); }
        }
        e.dataTransfer.setData('application/json;type=asset-ids', JSON.stringify(idsToDrag)); e.dataTransfer.effectAllowed = 'copy';
    };

    const handlePanelDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); const isFile = e.dataTransfer.types.includes('Files'); const isSketch = e.dataTransfer.types.includes('application/json;type=sketch-id'); if (isFile || isSketch) { setIsDraggingOver(true); e.dataTransfer.dropEffect = 'copy'; } };
    const handlePanelDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); };
    const handlePanelDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); const sketchId = e.dataTransfer.getData('application/json;type=sketch-id'); if (sketchId) { onAddAssetFromSketch(sketchId); return; } const files = e.dataTransfer.files; if (files && files.length > 0) { const imageFiles = Array.from(files).filter((file: File) => file.type.startsWith('image/')); if (imageFiles.length > 0) { onAddAssets(imageFiles); } } };

    const modeText = storySettings.mode === 'auto' ? 'Авто' : 'Ручной';
    let createStoryButtonText = `Создать сюжет (${modeText})`;
    if (selectedAssetIds.size > 0) { createStoryButtonText = `Создать сюжет из ${selectedAssetIds.size} ассетов`; }
    const isDropActive = isDraggingOver || isDropTarget;

    return (
        <>
            <div 
                ref={ref}
                className={`absolute top-0 right-0 h-full glass-panel z-30 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} w-full max-w-sm flex flex-col ${isDropActive ? 'ring-2 ring-primary ring-inset' : ''}`}
            >
                <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0 bg-black/20">
                    <h3 className="text-lg font-bold text-white flex items-center gap-3 font-display tracking-wide">
                        <span className="material-symbols-outlined text-primary">photo_library</span>
                        Ассеты
                    </h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-4 border-b border-white/5 shrink-0 space-y-3">
                    <div className="flex items-center justify-between">
                        <label htmlFor="selection-mode-toggle" className="text-xs font-bold text-white/60 uppercase tracking-wider select-none">Выбор</label>
                        <button id="selection-mode-toggle" role="switch" aria-checked={isSelectionMode} onClick={handleToggleSelectionMode} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isSelectionMode ? 'bg-primary' : 'bg-white/10'}`}>
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isSelectionMode ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {isSelectionMode && (
                        <div className="flex items-center gap-2">
                            <button onClick={onSelectAllAssets} className="flex-1 text-[10px] font-bold uppercase tracking-wide bg-white/5 text-white/70 h-7 rounded hover:bg-white/10 hover:text-white transition-colors">Все</button>
                            <button onClick={onDeselectAllAssets} className="flex-1 text-[10px] font-bold uppercase tracking-wide bg-white/5 text-white/70 h-7 rounded hover:bg-white/10 hover:text-white transition-colors">Сброс</button>
                        </div>
                    )}
                </div>

                <div onDragOver={handlePanelDragOver} onDragLeave={handlePanelDragLeave} onDrop={handlePanelDrop} className={`flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4 transition-colors ${isDraggingOver ? 'bg-primary/10' : ''}`}>
                    <div className="grid grid-cols-3 gap-3">
                        <button onClick={handleUploadClick} className="aspect-square rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center text-white/40 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all group">
                            <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">add</span>
                            <span className="text-[10px] font-bold mt-1">ЗАГРУЗИТЬ</span>
                        </button>
                        {assets.map((asset, index) => (
                            <div key={asset.id} className="relative group/asset cursor-pointer aspect-square" onMouseDown={(e) => { if (e.button === 0) e.stopPropagation(); }} onClick={() => handleAssetClick(asset.id, index)} draggable={true} onDragStart={(e) => handleDragStart(e, asset.id)}>
                                <img src={asset.imageUrl} alt={asset.name} className={`w-full h-full object-cover rounded-xl border-2 transition-all ${selectedAssetIds.has(asset.id) && isSelectionMode ? 'border-primary shadow-neon scale-95' : 'border-transparent hover:border-white/20'}`} />
                                <div className={`absolute inset-0 rounded-xl bg-black/40 transition-opacity flex items-center justify-center ${(selectedAssetIds.has(asset.id) && isSelectionMode) ? 'opacity-100' : 'opacity-0 group-hover/asset:opacity-100'}`}>
                                    {!isSelectionMode && <span className="material-symbols-outlined text-3xl text-white drop-shadow-md">zoom_in</span>}
                                    {isSelectionMode && (
                                        <div className={`absolute top-2 right-2 size-5 rounded-full flex items-center justify-center transition-all shadow-md ${selectedAssetIds.has(asset.id) ? 'bg-primary text-white' : 'bg-black/50 border border-white/50'}`}>
                                            {selectedAssetIds.has(asset.id) && <span className="material-symbols-outlined text-xs">check</span>}
                                        </div>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); onDeleteAsset(asset.id); }} className="absolute top-2 left-2 size-6 rounded-full bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover/asset:opacity-100 hover:bg-red-600 transition-opacity shadow-md"><span className="material-symbols-outlined text-[14px]">delete</span></button>
                                </div>
                            </div>
                        ))}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
                    </div>
                </div>

                <div className="p-6 border-t border-white/5 shrink-0 space-y-4 bg-black/20">
                     <div className="flex items-center gap-3">
                         <div className="flex-1">
                             <label htmlFor="frame-count" className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Кадров в сюжете</label>
                             <div className="relative">
                                <input type="number" id="frame-count" value={frameCount} onChange={(e) => onFrameCountChange(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2)))} min="2" max="20" className="w-full bg-white/5 p-2.5 rounded-lg text-sm font-bold text-white focus:ring-1 focus:ring-primary border border-white/10" />
                             </div>
                        </div>
                        <button onClick={onOpenStorySettings} className="self-end flex-shrink-0 size-11 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors" aria-label="Настройки сюжета">
                             <span className="material-symbols-outlined">tune</span>
                        </button>
                    </div>
                     <button onClick={onGenerateStory} disabled={assets.length === 0} className="w-full flex items-center justify-center gap-2 rounded-xl h-12 px-4 bg-gradient-to-r from-primary to-accent text-white text-sm font-bold hover:shadow-neon transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                        <span className="material-symbols-outlined">auto_awesome</span>
                        <span>{createStoryButtonText}</span>
                    </button>
                </div>
            </div>
            {viewingAssetIndex !== null && <AssetViewerModal assets={assets} startIndex={viewingAssetIndex} onClose={() => setViewingAssetIndex(null)} />}
        </>
    );
});
