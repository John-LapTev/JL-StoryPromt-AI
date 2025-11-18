import type { AppSettings } from '../types';

const SETTINGS_KEY = 'jl-storyprompt-ai-settings';

const defaultSettings: AppSettings = {
    doubleClickToGenerate: false, // Default is off, as requested
};

export const settingsService = {
    getSettings: (): AppSettings => {
        try {
            const settingsJson = localStorage.getItem(SETTINGS_KEY);
            const savedSettings = settingsJson ? JSON.parse(settingsJson) : {};
            // Merge with defaults to ensure all keys are present
            return { ...defaultSettings, ...savedSettings };
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
