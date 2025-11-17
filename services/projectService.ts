import type { Project } from '../types';

const PROJECTS_KEY = 'jl-storyprompt-ai-projects';
const LAST_PROJECT_ID_KEY = 'jl-storyprompt-ai-last-project-id';

export const projectService = {
    getProjects: (): Project[] => {
        try {
            const projectsJson = localStorage.getItem(PROJECTS_KEY);
            return projectsJson ? JSON.parse(projectsJson) : [];
        } catch (error) {
            console.error("Error loading projects from localStorage:", error);
            return [];
        }
    },

    saveProjects: (projects: Project[]): void => {
        try {
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
        } catch (error) {
            console.error("Error saving projects to localStorage:", error);
        }
    },

    getLastProjectId: (): string | null => {
        return localStorage.getItem(LAST_PROJECT_ID_KEY);
    },

    setLastProjectId: (id: string): void => {
        localStorage.setItem(LAST_PROJECT_ID_KEY, id);
    },
};
