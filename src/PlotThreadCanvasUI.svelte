<script>
    import { projectActions, uiState, confirmation } from './stores.js';
    import Icon from './Icon.svelte';
    import { slide } from 'svelte/transition';
    import { flip } from 'svelte/animate';

    export let story;
    $: plotThreads = story?.plotThreads || [];
    $: scenes = story?.scenes || {};

    let isExpanded = false;
    let isAdding = false;
    let newPlotThreadName = '';
    let editingPlotThread = null; // { id, name, color }

    $: activePlotThreadId = $uiState.activePlotThreadId;
    $: activePlotThread = activePlotThreadId ? plotThreads.find(p => p.id === activePlotThreadId) : null;

    function getSceneCount(plotThreadId) {
        return Object.values(scenes).filter(scene => scene.plotThreadIds.includes(plotThreadId)).length;
    }

    function handleSelectPlotThread(plotThreadId) {
        uiState.setActivePlotThread(plotThreadId);
    }

    function handleAdd() {
        if (newPlotThreadName.trim()) {
            projectActions.addPlotThread(newPlotThreadName.trim());
            newPlotThreadName = '';
            isAdding = false;
        }
    }

    function startEditing(thread) {
        editingPlotThread = { ...thread };
    }

    function cancelEditing() {
        editingPlotThread = null;
    }

    function saveChanges() {
        if (editingPlotThread && editingPlotThread.name.trim()) {
            projectActions.updatePlotThread(editingPlotThread.id, { 
                name: editingPlotThread.name.trim(),
                color: editingPlotThread.color
            });
        }
        editingPlotThread = null;
    }
    
    function handleDelete(thread) {
        confirmation.prompt(
            `'${thread.name}' 플롯 스레드를 정말로 삭제하시겠냥?`,
            () => projectActions.removePlotThread(thread.id)
        );
    }
</script>

<div class="plot-thread-panel" class:expanded={isExpanded}>
    <button class="panel-header" on:click={() => isExpanded = !isExpanded}>
        <div class="current-display">
            {#if activePlotThread}
                <div class="active-indicator" style="background-color: {activePlotThread.color};"></div>
                <span class="label">활성 플롯:</span>
                <span class="thread-name">{activePlotThread.name}</span>
            {:else}
                <Icon name="git-merge" size={16} />
                <span class="label">플롯 스레드 관리</span>
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
                 <button class="control-btn" on:click={() => uiState.setActivePlotThread(null)} disabled={!activePlotThread}>
                    <Icon name="x-circle" size={16} />
                    <span>선택 해제</span>
                </button>
            </div>

            {#if isAdding}
                <div class="add-form" transition:slide>
                    <input
                        type="text"
                        placeholder="새 플롯 스레드 이름..."
                        bind:value={newPlotThreadName}
                        on:keydown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <button class="icon-btn" on:click={handleAdd} title="추가"><Icon name="check" size={16} /></button>
                    <button class="icon-btn" on:click={() => isAdding = false} title="취소"><Icon name="x" size={16} /></button>
                </div>
            {/if}

            <div class="thread-list">
                {#if plotThreads.length > 0}
                    {#each plotThreads as thread (thread.id)}
                        <div class="thread-item" class:active={activePlotThreadId === thread.id} animate:flip={{duration: 300}}>
                            {#if editingPlotThread && editingPlotThread.id === thread.id}
                                <input type="color" class="color-input" bind:value={editingPlotThread.color} />
                                <input 
                                    type="text" 
                                    class="name-input"
                                    bind:value={editingPlotThread.name}
                                    on:keydown={e => { if(e.key === 'Enter') saveChanges(); if(e.key === 'Escape') cancelEditing(); }}
                                    on:blur={saveChanges}
                                />
                                <button class="icon-btn" on:click={saveChanges} title="저장"><Icon name="check" size={16} /></button>
                            {:else}
                                <div class="item-name" on:click={() => handleSelectPlotThread(thread.id)} on:keydown={e => e.key === 'Enter' && handleSelectPlotThread(thread.id)} role="button" tabindex="0">
                                    <div class="thread-color" style="background-color: {thread.color};"></div>
                                    <span>{thread.name}</span>
                                    <span class="scene-count">({getSceneCount(thread.id)}씬)</span>
                                </div>
                                <button class="icon-btn" on:click|stopPropagation={() => startEditing(thread)} title="편집"><Icon name="edit-2" size={16} /></button>
                                <button class="icon-btn danger" on:click|stopPropagation={() => handleDelete(thread)} title="삭제"><Icon name="trash-2" size={16} /></button>
                            {/if}
                        </div>
                    {/each}
                {:else}
                    <p class="no-items-msg">플롯 스레드가 없다냥. '새로 추가' 버튼으로 만들어보라냥.</p>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .plot-thread-panel {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 10;
        width: 320px;
        background-color: var(--header-bg);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        border: 1px solid var(--border-color);
        backdrop-filter: blur(5px);
        transition: all var(--transition-speed);
    }
    .plot-thread-panel.expanded {
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
    .current-display {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9em;
    }
    .active-indicator {
        width: 10px; height: 10px;
        border-radius: 50%;
        animation: pulse-blue 2s infinite;
    }
    .label { color: var(--text-color-muted); }
    .thread-name { font-weight: 600; }

    .panel-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 0 12px 12px 12px;
        border-top: 1px solid var(--border-color);
    }
    .panel-controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
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

    .thread-list {
        display: flex; flex-direction: column; gap: 6px;
        max-height: calc(50vh - 150px);
        overflow-y: auto;
        padding-right: 4px;
    }
    .thread-item {
        display: flex; align-items: center; gap: 8px;
        background-color: var(--primary-bg); padding: 8px;
        border-radius: var(--border-radius); border: 1px solid transparent;
    }
    .thread-item.active { border-color: var(--accent-color); }
    .item-name {
        flex-grow: 1; cursor: pointer; display: flex; align-items: center; gap: 8px;
        padding: 4px; border-radius: var(--border-radius);
    }
    .item-name:hover { background-color: var(--hover-bg); }
    .thread-color {
        width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
        border: 1px solid var(--border-color);
    }
    .scene-count { font-size: 0.8em; color: var(--text-color-muted); margin-left: auto; }
    .name-input {
        flex-grow: 1; background: var(--secondary-bg); border: 1px solid var(--accent-color);
        color: var(--text-color); padding: 4px; border-radius: var(--border-radius);
    }
    .color-input {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        background-color: transparent;
        border: none;
        cursor: pointer;
    }
    .color-input::-webkit-color-swatch {
        border-radius: 50%;
        border: 1px solid var(--border-color);
    }
    .color-input::-moz-color-swatch {
        border-radius: 50%;
        border: 1px solid var(--border-color);
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
</style>