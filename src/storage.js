import { get } from 'svelte/store';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI;

export const storage = {
    // --- Save Project ---
    async saveProject(projectData, projectName, filePath = null) {
        if (isElectron) {
            return await window.electronAPI.saveProject(projectData, projectName, filePath);
        } else {
            // Web Mode: Save to LocalStorage (Auto-save behavior)
            try {
                // Save list of projects metadata
                const projectsList = JSON.parse(localStorage.getItem('storyweaver_projects') || '{}');
                projectsList[projectData.id] = {
                    id: projectData.id,
                    name: projectData.name,
                    lastModified: Date.now()
                };
                localStorage.setItem('storyweaver_projects', JSON.stringify(projectsList));

                // Save actual project data
                localStorage.setItem(`project_${projectData.id}`, JSON.stringify(projectData));
                console.log('Saved to LocalStorage:', projectName);
                return { success: true };
            } catch (e) {
                console.error('Web Save Error:', e);
                // QuotaExceededError handling could go here
                return { success: false, error: '브라우저 저장 공간이 부족합니다.' };
            }
        }
    },

    // --- Load Project ---
    async loadProject(projectId) {
        if (isElectron) {
            // Electron loads by file path usually, but here we might need adaptation if we use internal IDs
            // For now, Electron relies on "Open File" dialog mainly.
            // If we want to support "Recent Projects" in Electron, we need persistent store there too.
            // But for now, let's assume this is mostly for Web internal loading.
            return null; 
        } else {
            // Web Mode
            try {
                const data = localStorage.getItem(`project_${projectId}`);
                if (data) {
                    return { success: true, projectData: JSON.parse(data) };
                }
                return { success: false, error: '프로젝트를 찾을 수 없습니다.' };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
    },

    // --- Get Project List (Web Only mainly) ---
    getProjectList() {
        if (isElectron) return {}; // Electron manages files, not a hidden list (usually)
        try {
            return JSON.parse(localStorage.getItem('storyweaver_projects') || '{}');
        } catch (e) {
            return {};
        }
    },

    // --- Delete Project ---
    deleteProject(projectId) {
        if (isElectron) {
            // Electron deletion involves file system, usually we don't do this automatically for safety
            return;
        } else {
            const projectsList = this.getProjectList();
            delete projectsList[projectId];
            localStorage.setItem('storyweaver_projects', JSON.stringify(projectsList));
            localStorage.removeItem(`project_${projectId}`);
        }
    },

    // --- Export (Download) for Web ---
    exportToFile(projectData, filename) {
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'project.json';
        a.click();
        URL.revokeObjectURL(url);
    }
};
