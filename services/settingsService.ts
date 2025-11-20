
import type { AppSettings } from '../types';

const SETTINGS_KEY = 'jl-storyprompt-ai-settings';

const defaultSettings: AppSettings = {
    doubleClickToGenerate: false,
    models: {
        analysisModel: 'gemini-3-pro-preview',
        generationModel: 'imagen-4.0-generate-001',
        editingModel: 'gemini-2.5-flash-image',
    }
};

export const settingsService = {
    getSettings: (): AppSettings => {
        try {
            const settingsJson = localStorage.getItem(SETTINGS_KEY);
            const savedSettings = settingsJson ? JSON.parse(settingsJson) : {};
            // Deep merge logic for models to ensure new keys exist if updating from old version
            const mergedSettings = { ...defaultSettings, ...savedSettings };
            if (!mergedSettings.models) {
                mergedSettings.models = defaultSettings.models;
            }
            return mergedSettings;
        } catch (error) {
            console.error("Error loading settings from localStorage:", error);
            return defaultSettings;
        }
    },

    saveSettings: (settings: AppSettings): void => {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error("Error saving settings to localStorage:", error);
        }
    },
};
