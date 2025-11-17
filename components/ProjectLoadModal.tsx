

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#191C2D] border border-white/10 rounded-xl p-6 flex flex-col gap-4 text-white max-w-2xl w-full max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Загрузить проект</h3>
                    <button onClick={onNew} className="flex items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold gap-2 hover:bg-primary/90">
                         <span className="material-symbols-outlined text-base">add</span>
                        <span>Новый проект</span>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    <ul className="space-y-2">
                        {sortedProjects.length > 0 ? sortedProjects.map(project => (
                            <li key={project.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                <div>
                                    <p className="font-bold text-white">{project.name}</p>
                                    <p className="text-xs text-white/60">
                                        Последнее изменение: {new Date(project.lastModified).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {project.id !== 'demo-project' && (
                                        <button
                                            onClick={() => onDelete(project.id)}
                                            className="flex size-8 items-center justify-center rounded-md text-white/60 hover:bg-red-500/20 hover:text-red-400"
                                            title="Удалить"
                                        >
                                            <span className="material-symbols-outlined text-xl">delete</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onLoad(project.id)}
                                        className="flex items-center justify-center rounded-md h-8 px-3 bg-white/10 text-white text-xs font-bold hover:bg-white/20"
                                        disabled={project.id === currentProjectId}
                                    >
                                        {project.id === currentProjectId ? 'Текущий' : 'Загрузить'}
                                    </button>
                                </div>
                            </li>
                        )) : (
                            <p className="text-center text-white/60 py-8">Сохраненных проектов нет.</p>
                        )}
                    </ul>
                </div>
                 <div className="flex justify-end mt-2">
                    <button onClick={onClose} className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold hover:bg-white/20">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};