
import React from 'react';
import type { Project } from '../types';

interface ProjectLoadModalProps {
    projects: Project[];
    currentProjectId: string | null;
    onClose: () => void;
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
    onNew: () => void;
}

export const ProjectLoadModal: React.FC<ProjectLoadModalProps> = ({ projects, currentProjectId, onClose, onLoad, onDelete, onNew }) => {
    const sortedProjects = [...projects].sort((a, b) => b.lastModified - a.lastModified);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="glass-modal rounded-2xl p-1 flex flex-col max-w-2xl w-full max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5 rounded-t-2xl backdrop-blur-md">
                     <h3 className="text-xl font-bold font-display text-white tracking-wide">Проекты</h3>
                     <div className="flex gap-4">
                        <button onClick={onNew} className="flex items-center gap-2 text-primary hover:text-primary-light font-bold text-sm transition-colors">
                            <span className="material-symbols-outlined text-lg">add_circle</span>
                            Новый
                        </button>
                        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                     </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    <ul className="space-y-2">
                        {sortedProjects.length > 0 ? sortedProjects.map(project => (
                            <li key={project.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all group glass-button ${project.id === currentProjectId ? 'bg-primary/10 border-primary/30' : 'bg-transparent hover:bg-white/5'}`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className={`font-bold text-base ${project.id === currentProjectId ? 'text-primary-light' : 'text-white'}`}>{project.name}</p>
                                        {project.id === currentProjectId && <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase">Текущий</span>}
                                    </div>
                                    <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                                        {new Date(project.lastModified).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onLoad(project.id)}
                                        disabled={project.id === currentProjectId}
                                        className="glass-button rounded-lg px-4 py-2 text-xs font-bold hover:bg-white/20 disabled:opacity-0"
                                    >
                                        Загрузить
                                    </button>
                                     {project.id !== 'demo-project' && (
                                        <button
                                            onClick={() => onDelete(project.id)}
                                            className="flex size-8 items-center justify-center rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                            title="Удалить"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    )}
                                </div>
                            </li>
                        )) : (
                            <div className="flex flex-col items-center justify-center py-12 text-white/40">
                                <span className="material-symbols-outlined text-5xl mb-2 opacity-50">folder_off</span>
                                <p>Сохраненных проектов нет</p>
                            </div>
                        )}
                    </ul>
                </div>
                 
                 <div className="bg-white/5 p-4 rounded-b-2xl flex justify-end border-t border-white/10 shrink-0 backdrop-blur-md">
                    <button onClick={onClose} className="glass-button px-5 py-2 rounded-lg text-sm font-medium text-white/70">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};
