
import React, { useState, useEffect } from 'react';
import type { AppSettings, ModelSettings } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSave: (newSettings: AppSettings) => void;
}

const AVAILABLE_MODELS = {
    analysis: [
        { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Recommended)', desc: 'Лучшее качество анализа сюжета и сложных инструкций.' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast)', desc: 'Высокая скорость, подходит для простых задач.' },
    ],
    generation: [
        { id: 'imagen-4.0-generate-001', name: 'Imagen 3 (High Quality)', desc: 'Фотореалистичное качество, лучшее для генерации с нуля.' },
        { id: 'gemini-2.5-flash-image', name: 'NanoBanana (Gemini 2.5 Flash Image)', desc: 'Быстрая генерация, хорошее понимание промтов.' },
    ],
    editing: [
        { id: 'gemini-2.5-flash-image', name: 'NanoBanana (Gemini 2.5 Flash Image)', desc: 'Универсальная модель для редактирования, интеграции и адаптации.' },
    ]
};

const ToggleSwitch: React.FC<{ label: string; enabled: boolean; onChange: (enabled: boolean) => void }> = ({ label, enabled, onChange }) => {
    return (
        <label className="flex items-center justify-between cursor-pointer group p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10">
            <span className="text-sm font-medium text-white/90">{label}</span>
            <div
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

const ModelSelectCard: React.FC<{ 
    label: string; 
    value: string; 
    options: {id: string, name: string, desc: string}[]; 
    onChange: (val: string) => void;
    icon: string;
}> = ({ label, value, options, onChange, icon }) => (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-white/5 border border-white/5">
        <div className="flex items-center gap-3 mb-1">
            <div className="size-8 rounded-full bg-white/5 flex items-center justify-center text-primary-light">
                <span className="material-symbols-outlined">{icon}</span>
            </div>
            <h4 className="text-sm font-bold text-white/90 uppercase tracking-wide">{label}</h4>
        </div>
        <div className="relative group">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none bg-black/30 text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-medium"
            >
                {options.map(opt => <option key={opt.id} value={opt.id} className="bg-gray-900 text-white">{opt.name}</option>)}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50 group-hover:text-white/80 transition-colors">
                expand_more
            </span>
        </div>
        <p className="text-xs text-white/50 px-1">
            {options.find(o => o.id === value)?.desc}
        </p>
    </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [activeTab, setActiveTab] = useState<'general' | 'models'>('models'); // Default to models as requested update is about models

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    const handleSave = () => { onSave(localSettings); onClose(); };
    
    const updateModel = (key: keyof ModelSettings, value: string) => {
        setLocalSettings(prev => ({
            ...prev,
            models: { ...prev.models, [key]: value }
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-3xl overflow-hidden flex flex-col w-full max-w-4xl h-[85vh] max-h-[800px] shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-white/10 shadow-neon">
                            <span className="material-symbols-outlined text-white text-xl">tune</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold font-display text-white tracking-wide">Настройки приложения</h3>
                            <p className="text-xs text-white/40 font-medium">Конфигурация интерфейса и AI моделей</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="size-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex flex-1 min-h-0">
                    {/* Sidebar */}
                    <div className="w-64 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-2 shrink-0">
                        <button 
                            onClick={() => setActiveTab('general')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'general' ? 'bg-primary/20 text-white shadow-inner border border-primary/20' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-lg">settings</span>
                            Общие
                        </button>
                        <button 
                            onClick={() => setActiveTab('models')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'models' ? 'bg-primary/20 text-white shadow-inner border border-primary/20' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-lg">psychology</span>
                            AI Модели
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-gradient-to-br from-transparent to-white/5">
                        
                        {activeTab === 'general' && (
                            <div className="flex flex-col gap-6 animate-fade-in">
                                <div className="flex flex-col gap-2 mb-4">
                                    <h4 className="text-2xl font-bold font-display text-white">Общие настройки</h4>
                                    <p className="text-sm text-white/50">Управление поведением интерфейса</p>
                                </div>
                                <ToggleSwitch
                                    label="Двойной клик для генерации"
                                    enabled={localSettings.doubleClickToGenerate}
                                    onChange={(value) => setLocalSettings(prev => ({ ...prev, doubleClickToGenerate: value }))}
                                />
                                <p className="text-xs text-white/40 px-2">
                                    Если включено, двойной клик по пустому месту на доске откроет окно создания нового наброска.
                                </p>
                            </div>
                        )}

                        {activeTab === 'models' && (
                            <div className="flex flex-col gap-6 animate-fade-in">
                                <div className="flex flex-col gap-2 mb-2">
                                    <h4 className="text-2xl font-bold font-display text-white">Конфигурация AI</h4>
                                    <p className="text-sm text-white/50">Выберите модели для разных типов задач</p>
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    <ModelSelectCard
                                        label="Анализ сюжета и контекста"
                                        icon="auto_stories"
                                        value={localSettings.models.analysisModel}
                                        options={AVAILABLE_MODELS.analysis}
                                        onChange={(val) => updateModel('analysisModel', val)}
                                    />
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <ModelSelectCard
                                            label="Генерация изображений"
                                            icon="brush"
                                            value={localSettings.models.generationModel}
                                            options={AVAILABLE_MODELS.generation}
                                            onChange={(val) => updateModel('generationModel', val)}
                                        />
                                        <ModelSelectCard
                                            label="Редактирование и Интеграция"
                                            icon="auto_fix"
                                            value={localSettings.models.editingModel}
                                            options={AVAILABLE_MODELS.editing}
                                            onChange={(val) => updateModel('editingModel', val)}
                                        />
                                    </div>
                                </div>
                                
                                <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-blue-400 shrink-0">info</span>
                                    <div className="text-xs text-blue-200/80 leading-relaxed">
                                        <strong className="text-blue-200 block mb-1">О модели NanoBanana</strong>
                                        Новая модель Gemini 2.5 Flash Image (NanoBanana) обеспечивает высокую скорость и отличное понимание контекста, что делает её идеальной для задач редактирования и интеграции объектов.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-black/20 backdrop-blur-md flex justify-end gap-3">
                    <button onClick={onClose} className="glass-button px-6 py-3 rounded-xl text-sm font-bold text-white/70 hover:text-white">
                        Отмена
                    </button>
                    <button onClick={handleSave} className="glass-button-primary px-8 py-3 rounded-xl text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">save</span>
                        Сохранить изменения
                    </button>
                </div>
            </div>
        </div>
    );
};
