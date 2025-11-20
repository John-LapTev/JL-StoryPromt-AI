
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
        <label htmlFor="toggle-switch" className="flex items-center justify-between cursor-pointer group p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
            <span className="text-sm font-medium text-white/90">{label}</span>
            <div
                id="toggle-switch"
                role="switch"
                aria-checked={enabled}
                onClick={() => onChange(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${enabled ? 'bg-primary shadow-neon' : 'bg-white/10 border border-white/10'}`}
            >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
        </label>
    );
};


export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    const handleSave = () => { onSave(localSettings); onClose(); };
    const handleSettingChange = (key: keyof AppSettings, value: boolean) => { setLocalSettings(prev => ({ ...prev, [key]: value })); };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h3 className="text-xl font-bold font-display text-white tracking-wide">Настройки</h3>
                        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <ToggleSwitch
                            label="Двойной клик по столу для генерации"
                            enabled={localSettings.doubleClickToGenerate}
                            onChange={(value) => handleSettingChange('doubleClickToGenerate', value)}
                        />
                         <p className="text-xs text-white/40 px-3">Если включено, двойной клик по пустому месту на столе откроет окно создания наброска.</p>
                    </div>
                </div>

                <div className="bg-white/5 p-4 rounded-b-2xl flex justify-end gap-3 border-t border-white/10 backdrop-blur-md">
                    <button onClick={onClose} className="glass-button px-5 py-2.5 rounded-lg text-sm font-medium text-white/70">Отмена</button>
                    <button onClick={handleSave} className="glass-button-primary px-6 py-2.5 rounded-lg text-white text-sm font-bold">Сохранить</button>
                </div>
            </div>
        </div>
    );
};
