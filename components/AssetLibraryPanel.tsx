
import React, { useState, useRef } from 'react';
import type { Asset } from '../types';

interface AssetLibraryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    selectedAssetIds: Set<string>;
    onAddAssets: (files: File[]) => void;
    onDeleteAsset: (id: string) => void;
    onToggleSelectAsset: (id: string) => void;
    onGenerateStory: (frameCount: number) => void;
}

export const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({ isOpen, onClose, assets, selectedAssetIds, onAddAssets, onDeleteAsset, onToggleSelectAsset, onGenerateStory }) => {
    const [frameCount, setFrameCount] = useState(10);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            onAddAssets(Array.from(event.target.files));
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleGenerateClick = () => {
        if (frameCount < 2 || frameCount > 20) {
            alert("Пожалуйста, укажите количество кадров от 2 до 20.");
            return;
        }
        onGenerateStory(frameCount);
    };

    return (
        <div 
            className={`absolute top-0 right-0 h-full bg-[#101322]/80 backdrop-blur-lg border-l border-white/10 shadow-2xl z-30 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} w-full max-w-sm flex flex-col`}
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

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div className="grid grid-cols-3 gap-3">
                    {assets.map(asset => (
                        <div key={asset.id} className="relative group/asset cursor-pointer" onClick={() => onToggleSelectAsset(asset.id)}>
                            <img 
                                src={asset.imageUrl}
                                alt={asset.name}
                                className={`w-full h-24 object-cover rounded-lg border-2 transition-all ${selectedAssetIds.has(asset.id) ? 'border-primary' : 'border-transparent'}`}
                            />
                             <div className={`absolute inset-0 rounded-lg bg-black/50 transition-opacity ${selectedAssetIds.has(asset.id) ? 'opacity-100' : 'opacity-0 group-hover/asset:opacity-100'}`}>
                                <div className={`absolute top-1.5 left-1.5 size-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedAssetIds.has(asset.id) ? 'bg-primary border-primary' : 'bg-black/50 border-white/50'}`}>
                                    {selectedAssetIds.has(asset.id) && <span className="material-symbols-outlined text-sm text-white">check</span>}
                                </div>
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
                <div className="flex flex-col gap-2">
                    <label htmlFor="frame-count" className="text-sm font-bold text-white/80">Количество кадров в сюжете:</label>
                    <input
                        type="number"
                        id="frame-count"
                        value={frameCount}
                        onChange={(e) => setFrameCount(parseInt(e.target.value, 10))}
                        min="2"
                        max="20"
                        className="w-full bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none"
                    />
                </div>
                <button 
                    onClick={handleGenerateClick}
                    disabled={assets.length === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-lg h-12 px-4 bg-primary text-white text-base font-bold hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined">auto_awesome</span>
                    Создать сюжет
                </button>
            </div>
        </div>
    );
};
