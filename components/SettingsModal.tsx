import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSave: (newSettings: AppSettings) => void;
}

const ToggleSwitch: React.FC<{ label: string; enabled: boolean; onChange: (enabled: boolean) => void }> = ({ label, enabled, onChange }) => {
    return (
        <label htmlFor="toggle-switch" className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-white/80">{label}</span>
            <div
                id="toggle-switch"
                role="switch"
                aria-checked={enabled}
                onClick={() => onChange(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-white/20'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
        </label>
    );
};


export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };

    const handleSettingChange = (key: keyof AppSettings, value: boolean) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold">Настройки</h3>
                
                <div className="space-y-4 py-4">
                    <ToggleSwitch
                        label="Двойной клик по столу для генерации"
                        enabled={localSettings.doubleClickToGenerate}
                        onChange={(value) => handleSettingChange('doubleClickToGenerate', value)}
                    />
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
                    <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">
                        Отмена
                    </button>
                    <button onClick={handleSave} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90">
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
};
