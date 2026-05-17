<script>
    import { projectActions, uiState, confirmation, notifications } from './stores.js';
    import Icon from './Icon.svelte';
    import { slide } from 'svelte/transition';
    import { flip } from 'svelte/animate';

    export let story;
    $: storylines = story?.storylines || [];

    let isExpanded = false;
    let isAdding = false;
    let newStorylineName = '';
    let editingStoryline = null; // { id, name }

    $: activeStorylineId = $uiState.activeStorylineId;
    $: activeStoryline = activeStorylineId ? storylines.find(s => s.id === activeStorylineId) : null;
    $: isEditingScene = $uiState.storylineEditMode.active && $uiState.storylineEditMode.storylineId === activeStorylineId;

    function toggleSceneEditMode() {
        if (activeStoryline) {
            uiState.toggleStorylineEditMode(activeStoryline.id);
        }
    }

    function handleSelectStoryline(storylineId) {
        const storyline = storylines.find(s => s.id === storylineId);
        if (storyline) {
            uiState.setActiveStoryline(storyline.id);
            if (storyline.nodes.length > 0) {
                projectActions.selectScene(storyline.nodes[0]);
            }
        }
    }

    function handleAdd() {
        if (newStorylineName.trim()) {
            projectActions.addStoryline(newStorylineName.trim());
            newStorylineName = '';
            isAdding = false;
        }
    }

    function startEditing(storyline) {
        editingStoryline = { ...storyline };
    }

    function cancelEditing() {
        editingStoryline = null;
    }

    function saveNameChange() {
        if (editingStoryline && editingStoryline.name.trim()) {
            projectActions.updateStoryline(editingStoryline.id, { name: editingStoryline.name.trim() });
        }
        editingStoryline = null;
    }
    
    function handleDelete(storyline) {
        confirmation.prompt(
            `'${storyline.name}' 스토리라인을 정말로 삭제하시겠냥?`,
            () => projectActions.removeStoryline(storyline.id)
        );
    }

    function openScriptViewer() {
        if (activeStoryline) {
            uiState.openStorylineScriptViewer(activeStoryline.id);
        } else {
            notifications.add('먼저 활성화할 스토리라인을 선택해달라냥.', 'info');
        }
    }
</script>

<div class="storyline-panel" class:expanded={isExpanded}>
    <button class="panel-header" on:click={() => isExpanded = !isExpanded}>
        <div class="current-storyline-display">
            {#if activeStoryline}
                <div class="active-indicator" class:editing={isEditingScene}></div>
                <span class="label">{isEditingScene ? '씬 편집 중:' : '활성 스토리라인:'}</span>
                <span class="storyline-name">{activeStoryline.name}</span>
            {:else}
                <Icon name="git-branch" size={16} />
                <span class="label">스토리라인 관리</span>
            {/if}
        </div>
        <Icon name={isExpanded ? 'chevron-down' : 'chevron-up'} size={20} />
    </button>

    {#if isExpanded}
        <div class="panel-content" transition:slide>
            <div class="panel-controls">
                <button class="control-btn" on:click={() => isAdding = !isAdding} class:active={isAdding}>
                    <Icon name="plus" size={16} />
                    <span>새로 추가</span>
                </button>
                <button class="control-btn" on:click={toggleSceneEditMode} class:active={isEditingScene} disabled={!activeStoryline}>
                    <Icon name="edit" size={16} />
                    <span>씬 편집</span>
                </button>
                <button class="control-btn" on:click={openScriptViewer} disabled={!activeStoryline}>
                    <Icon name="book-open" size={16} />
                    <span>대본 보기</span>
                </button>
            </div>

            {#if isAdding}
                <div class="add-form" transition:slide>
                    <input
                        type="text"
                        placeholder="새 스토리라인 이름..."
                        bind:value={newStorylineName}
                        on:keydown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <button class="icon-btn" on:click={handleAdd} title="추가"><Icon name="check" size={16} /></button>
                    <button class="icon-btn" on:click={() => isAdding = false} title="취소"><Icon name="x" size={16} /></button>
                </div>
            {/if}

            <div class="storyline-list">
                {#if storylines.length > 0}
                    {#each storylines as storyline (storyline.id)}
                        <div class="storyline-item" class:active={activeStorylineId === storyline.id} animate:flip={{duration: 300}}>
                            {#if editingStoryline && editingStoryline.id === storyline.id}
                                <input 
                                    type="text" 
                                    class="name-input"
                                    bind:value={editingStoryline.name}
                                    on:keydown={e => { if(e.key === 'Enter') saveNameChange(); if(e.key === 'Escape') cancelEditing(); }}
                                    on:blur={saveNameChange}
                                />
                                <button class="icon-btn" on:click={saveNameChange} title="저장"><Icon name="check" size={16} /></button>
                            {:else}
                                <div class="item-name" on:click={() => handleSelectStoryline(storyline.id)} on:keydown={e => e.key === 'Enter' && handleSelectStoryline(storyline.id)} role="button" tabindex="0">
                                    <span>{storyline.name}</span>
                                    <span class="scene-count">({storyline.nodes.length}씬)</span>
                                </div>
                                <button class="icon-btn" on:click|stopPropagation={() => startEditing(storyline)} title="이름 변경"><Icon name="edit-2" size={16} /></button>
                                <button class="icon-btn danger" on:click|stopPropagation={() => handleDelete(storyline)} title="삭제"><Icon name="trash-2" size={16} /></button>
                            {/if}
                        </div>
                    {/each}
                {:else}
                    <p class="no-items-msg">스토리라인이 없다냥. '새로 추가' 버튼으로 만들어보라냥.</p>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .storyline-panel {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 11;
        width: 320px;
        background-color: var(--header-bg);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        border: 1px solid var(--border-color);
        backdrop-filter: blur(5px);
        transition: all var(--transition-speed);
    }
    .storyline-panel.expanded {
        height: auto;
        max-height: 50vh;
    }
    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        cursor: pointer;
        width: 100%;
        background: none;
        border: none;
        color: var(--text-color);
    }
    .current-storyline-display {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9em;
    }
    .active-indicator {
        width: 10px; height: 10px;
        background-color: var(--accent-color);
        border-radius: 50%;
        animation: pulse-blue 2s infinite;
    }
    .active-indicator.editing {
        background-color: var(--success-color);
        animation: pulse-green 2s infinite;
    }
    .label { color: var(--text-color-muted); }
    .storyline-name { font-weight: 600; }

    .panel-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 0 12px 12px 12px;
        border-top: 1px solid var(--border-color);
    }
    .panel-controls {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
        padding-top: 12px;
    }
    .control-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        background-color: var(--primary-bg); border: 1px solid var(--border-color);
        color: var(--text-color); padding: 8px; border-radius: var(--border-radius);
        cursor: pointer; font-size: 0.85em; transition: all var(--transition-speed);
    }
    .control-btn:hover:not(:disabled) { border-color: var(--accent-color); color: var(--accent-color); }
    .control-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .control-btn.active { background-color: var(--success-color); border-color: var(--success-color); color: white; }
    
    .add-form { display: flex; gap: 4px; }
    .add-form input {
        flex-grow: 1; padding: 6px 10px; background-color: var(--secondary-bg);
        border: 1px solid var(--border-color); color: var(--text-color);
        border-radius: var(--border-radius);
    }
    .add-form input:focus { outline: none; border-color: var(--accent-color); }

    .storyline-list {
        display: flex; flex-direction: column; gap: 6px;
        max-height: calc(50vh - 150px);
        overflow-y: auto;
        padding-right: 4px;
    }
    .storyline-item {
        display: flex; align-items: center; gap: 8px;
        background-color: var(--primary-bg); padding: 8px;
        border-radius: var(--border-radius); border: 1px solid transparent;
    }
    .storyline-item.active { border-color: var(--accent-color); }
    .item-name {
        flex-grow: 1; cursor: pointer; display: flex; align-items: baseline; gap: 6px;
        padding: 4px; border-radius: var(--border-radius);
    }
    .item-name:hover { background-color: var(--hover-bg); }
    .scene-count { font-size: 0.8em; color: var(--text-color-muted); }
    .name-input {
        flex-grow: 1; background: var(--secondary-bg); border: 1px solid var(--accent-color);
        color: var(--text-color); padding: 4px; border-radius: var(--border-radius);
    }
    .no-items-msg { text-align: center; font-size: 0.85em; color: var(--text-color-muted); padding: 16px; }

    .icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        background: none; border: none; color: var(--text-color-muted);
        cursor: pointer; width: 28px; height: 28px; flex-shrink: 0;
        border-radius: var(--border-radius); transition: all var(--transition-speed);
    }
    .icon-btn:hover { background-color: var(--hover-bg); color: var(--text-color); }
    .icon-btn.danger:hover { background-color: var(--danger-color); color: white; }

    @keyframes pulse-blue {
        0% { box-shadow: 0 0 0 0 rgba(var(--accent-color-rgb), 0.7); }
        70% { box-shadow: 0 0 0 8px rgba(var(--accent-color-rgb), 0); }
        100% { box-shadow: 0 0 0 0 rgba(var(--accent-color-rgb), 0); }
    }
    @keyframes pulse-green {
        0% { box-shadow: 0 0 0 0 rgba(var(--success-color-rgb), 0.7); }
        70% { box-shadow: 0 0 0 8px rgba(var(--success-color-rgb), 0); }
        100% { box-shadow: 0 0 0 0 rgba(var(--success-color-rgb), 0); }
    }

    @media (max-width: 768px) {
        .storyline-panel {
            left: 16px;
            right: 16px;
            width: auto;
        }
    }
</style>