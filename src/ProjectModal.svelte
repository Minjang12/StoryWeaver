<script>
    import { projectManager, projectActions, confirmation, uiState } from './stores.js';
    import { onMount } from 'svelte';
    import Icon from './Icon.svelte';
    import { parseSmartInput } from './utils.js';

    export let activeProjectId = null; // Passed from parent

    let newProjectName = '';
    let importText = ''; // New: For text import
    let isImportMode = false; // Toggle import view
    let projects = [];
    let inputElement;

    projectManager.subscribe(value => {
        projects = Object.values(value).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    function handleCreateProject() {
        if (newProjectName.trim()) {
            projectActions.createNewProject(newProjectName.trim());
            newProjectName = '';
            uiState.closeProjectModal();
        }
    }

    function handleSmartImport() {
        if (!newProjectName.trim()) {
            alert('프로젝트 이름을 입력해주세요!');
            return;
        }
        if (!importText.trim()) {
             alert('가져올 텍스트를 입력해주세요!');
             return;
        }

        const initialData = parseSmartInput(importText);
        projectActions.createNewProject(newProjectName.trim(), initialData);
        
        newProjectName = '';
        importText = '';
        isImportMode = false;
        uiState.closeProjectModal();
    }

    function handleLoadProject(projectId) {
        projectActions.loadProject(projectId);
        uiState.closeProjectModal();
    }

    function handleLoadFromFile() {
        projectActions.loadProjectFromFile();
        uiState.closeProjectModal();
    }

    function handleCreateFromText() {
        projectActions.createProjectFromText();
        uiState.closeProjectModal();
    }

    function deleteProject(projectId, projectName) {
        confirmation.prompt(
            `정말로 "${projectName}" 프로젝트를 삭제할거냥? 모든 데이터가 영원히 사라진다냥!`,
            () => {
                projectActions.deleteProject(projectId);
                // After the project is deleted and the modal closes,
                // explicitly move focus to the 'new project' input.
                setTimeout(() => {
                    if (inputElement) {
                        inputElement.focus();
                    }
                }, 0);
            }
        );
    }

    function close() {
        if (activeProjectId) {
            uiState.closeProjectModal();
        }
    }

    onMount(() => {
        if (inputElement) {
            inputElement.focus();
        }
    });
</script>

<div class="modal-backdrop" on:click={close} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && close()}>
    <div class="modal-content" on:click|stopPropagation role="none">
        <div class="modal-header">
            <h2>프로젝트 관리</h2>
            {#if activeProjectId}
                <button class="close-btn" on:click={close} title="닫기"><Icon name="x" size={24}/></button>
            {/if}
        </div>
        <div class="modal-body">
            <div class="project-list">
                {#if Object.values(projects).length > 0}
                    {#each Object.values(projects) as project (project.id)}
                        <div class="project-item" class:active={project.id === activeProjectId}>
                            <div class="project-info">
                                <span class="project-name">{project.name}</span>
                                {#if project.id === activeProjectId}
                                    <span class="active-badge">현재 편집 중</span>
                                {/if}
                            </div>
                            <div class="project-controls">
                                {#if project.id !== activeProjectId}
                                    <button on:click={() => handleLoadProject(project.id)}>불러오기</button>
                                {/if}
                                <button on:click={() => projectActions.saveProject(project.id)}>파일로 저장</button>
                                <button class="danger" on:click={() => deleteProject(project.id, project.name)}>삭제</button>
                            </div>
                        </div>
                    {/each}
                {:else}
                    <p class="no-projects">아직 만들어진 프로젝트가 없다냥.</p>
                {/if}
            </div>
            
            <div class="create-section">
                <div class="create-tabs">
                    <button class:active={!isImportMode} on:click={() => isImportMode = false}>새 프로젝트</button>
                    <button class:active={isImportMode} on:click={() => isImportMode = true}>텍스트로 가져오기</button>
                </div>

                <div class="create-project-form">
                    <input 
                        bind:this={inputElement}
                        type="text" 
                        placeholder="프로젝트 이름..." 
                        bind:value={newProjectName}
                        on:keydown={(e) => e.key === 'Enter' && (isImportMode ? handleSmartImport() : handleCreateProject())}
                    />
                    
                    {#if isImportMode}
                        <textarea 
                            class="import-textarea" 
                            placeholder="설정집 텍스트나 대본을 붙여넣으세요... (예: [1. 등장인물] ...)"
                            bind:value={importText}
                        ></textarea>
                        <button class="primary-btn full" on:click={handleSmartImport}>
                            <Icon name="download-cloud" size={18} />
                            <span>분석 및 생성</span>
                        </button>
                    {:else}
                        <button class="icon-btn" on:click={handleCreateProject} title="생성">
                            <Icon name="plus" size={20} />
                        </button>
                    {/if}
                </div>
                {#if !isImportMode}
                    <div class="extra-actions">
                        <button class="text-btn" on:click={handleLoadFromFile}>파일 불러오기 (.json)</button>
                        <!-- Electron Import is redundant with file load usually, keeping hidden or removed -->
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    /* ... Existing Styles ... */
    .modal-backdrop {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5); z-index: 1000;
        display: flex; justify-content: center; align-items: center;
    }
    .modal-content {
        width: 600px; max-width: 95%; max-height: 90vh;
        background: var(--primary-bg);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        display: flex; flex-direction: column;
    }
    .modal-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 20px; border-bottom: 1px solid var(--border-color);
    }
    .modal-header h2 { margin: 0; }
    .close-btn { background: none; border: none; color: var(--text-color); cursor: pointer; }
    
    .modal-body { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; height: 100%; }
    
    .project-list { 
        display: flex; flex-direction: column; gap: 10px; 
        flex: 1; min-height: 200px; overflow-y: auto;
    }
    .project-item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 15px; background: var(--secondary-bg);
        border: 1px solid var(--border-color); border-radius: 4px;
    }
    .project-item.active { border-color: var(--accent-color); background: rgba(var(--accent-color-rgb, 100, 108, 255), 0.05); }
    
    .project-info { display: flex; flex-direction: column; gap: 4px; }
    .project-name { font-weight: bold; font-size: 1.1em; }
    .active-badge { font-size: 0.8em; color: var(--accent-color); }
    
    .project-controls { display: flex; gap: 8px; }
    .project-controls button {
        padding: 6px 12px; border: 1px solid var(--border-color);
        background: transparent; color: var(--text-color);
        border-radius: 4px; cursor: pointer; font-size: 0.9em;
    }
    .project-controls button:hover {
        background-color: var(--secondary-bg);
        border-color: var(--text-color);
    }
    .project-controls button.danger { color: var(--danger-color); border-color: rgba(220, 53, 69, 0.3); }
    .project-controls button.danger:hover { background-color: var(--danger-color); color: white; border-color: var(--danger-color); }
    
    .no-projects { text-align: center; color: var(--text-color-muted); padding: 40px 0; }
    
    .create-section {
        margin-top: auto;
        border-top: 1px solid var(--border-color);
        padding-top: 20px;
    }
    .create-tabs {
        display: flex; gap: 10px; margin-bottom: 15px;
    }
    .create-tabs button {
        background: none; border: none; padding: 5px 0;
        color: var(--text-color-muted); cursor: pointer;
        border-bottom: 2px solid transparent;
        font-weight: bold;
    }
    .create-tabs button.active {
        color: var(--accent-color);
        border-bottom-color: var(--accent-color);
    }

    .create-project-form {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .create-project-form input {
        width: 100%;
        padding: 12px;
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        color: var(--text-color);
        border-radius: var(--border-radius);
        box-sizing: border-box;
    }
    .import-textarea {
        width: 100%; height: 150px;
        padding: 12px;
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        color: var(--text-color);
        border-radius: var(--border-radius);
        resize: vertical;
        font-family: monospace;
        font-size: 0.9em;
        box-sizing: border-box;
    }
    .primary-btn.full {
        width: 100%;
        justify-content: center;
        background-color: var(--accent-color);
        color: white; border: none;
        padding: 12px;
        display: flex; align-items: center; gap: 8px;
        border-radius: var(--border-radius);
        cursor: pointer;
    }
    
    .create-project-form button.icon-btn {
        align-self: flex-end; /* Align normal create button to right */
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
        width: 40px;
        height: 40px;
        border: 1px solid var(--border-color);
        background-color: var(--primary-bg);
        color: var(--text-color);
        cursor: pointer;
        border-radius: var(--border-radius);
        flex-shrink: 0;
        transition: all 0.2s;
    }
    .create-project-form button.icon-btn:hover {
        border-color: var(--accent-color);
        color: var(--accent-color);
    }
    
    .extra-actions {
        display: flex; justify-content: flex-end; margin-top: 10px;
    }
    .text-btn {
        background: none; border: none; color: var(--text-color-muted);
        text-decoration: underline; cursor: pointer; font-size: 0.9em;
    }
</style>
