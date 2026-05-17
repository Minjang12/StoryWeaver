<script>
    import { createEventDispatcher } from 'svelte';
    import { projectActions, activeStory } from './stores.js';
    import Icon from './Icon.svelte';

    const dispatch = createEventDispatcher();

    let newPlotThreadName = '';
    let editingThread = null;
    let selectedThreadId = null;

    $: scenesInSelectedThread = selectedThreadId 
        ? Object.values($activeStory.scenes).filter(scene => scene.plotThreadIds.includes(selectedThreadId))
        : [];

    function handleAddPlotThread() {
        if (newPlotThreadName.trim()) {
            projectActions.addPlotThread(newPlotThreadName.trim());
            newPlotThreadName = '';
        }
    }

    function startEditing(thread) {
        editingThread = { ...thread };
    }

    function saveChanges() {
        if (editingThread && editingThread.name.trim()) {
            projectActions.updatePlotThread(editingThread.id, { 
                name: editingThread.name.trim(),
                color: editingThread.color
            });
        }
        editingThread = null;
    }

    function handleSceneClick(sceneId) {
        projectActions.selectScene(sceneId);
        dispatch('close');
    }

    function close() {
        dispatch('close');
    }
</script>

<div class="modal-backdrop" on:click={close} on:keydown={(e) => { if (e.key === 'Escape') close(); }} role="presentation">
    <div class="modal-content" on:click|stopPropagation role="dialog" aria-modal="true" on:keydown|stopPropagation>
        <div class="modal-header">
            <h3><Icon name="git-merge" size={20}/> 플롯 스레드 관리</h3>
            <button class="close-btn" on:click={close}><Icon name="x" size={18}/></button>
        </div>
        <div class="modal-body">
            <div class="left-panel">
                <div class="input-group">
                    <input type="text" placeholder="새 플롯 스레드..." bind:value={newPlotThreadName} on:keydown={(e) => e.key === 'Enter' && handleAddPlotThread()} />
                    <button class="icon-btn" on:click={handleAddPlotThread} title="새 플롯 스레드 추가"><Icon name="plus" /></button>
                </div>
                <div class="plot-list">
                    {#each $activeStory.plotThreads as thread (thread.id)}
                        {@const count = Object.values($activeStory.scenes).filter(s => s.plotThreadIds.includes(thread.id)).length}
                        <div 
                            class="plot-item" 
                            class:selected={selectedThreadId === thread.id} 
                            on:click={() => selectedThreadId = thread.id}
                            on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectedThreadId = thread.id; }}
                            role="button"
                            tabindex="0"
                        >
                            {#if editingThread && editingThread.id === thread.id}
                                <div class="color-input-wrapper">
                                    <input type="color" bind:value={editingThread.color} />
                                </div>
                                <input type="text" class="edit-input" bind:value={editingThread.name} on:keydown={(e) => e.key === 'Enter' && saveChanges()} on:blur={saveChanges} />
                                <div class="edit-actions">
                                    <button class="icon-btn success" on:click={saveChanges} title="저장"><Icon name="check" size={16} /></button>
                                    <button class="icon-btn" on:click={() => editingThread = null} title="취소"><Icon name="x" size={16} /></button>
                                </div>
                            {:else}
                                <div class="plot-color" style="background-color: {thread.color};"></div>
                                <div class="plot-info">
                                    <span class="plot-name">{thread.name}</span>
                                    <span class="scene-count-badge" class:zero={count === 0}>{count} 씬</span>
                                </div>
                                <div class="plot-actions">
                                    <button class="icon-btn" on:click|stopPropagation={() => startEditing(thread)} title="편집"><Icon name="edit-2" size={14} /></button>
                                    <button class="icon-btn danger" on:click|stopPropagation={() => projectActions.removePlotThread(thread.id)} title="삭제"><Icon name="trash-2" size={14} /></button>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
            <div class="right-panel">
                {#if selectedThreadId}
                    <h3>'{$activeStory.plotThreads.find(t => t.id === selectedThreadId)?.name}'에 연결된 씬</h3>
                    <div class="scene-list">
                        {#each scenesInSelectedThread as scene (scene.id)}
                        <div 
                            class="scene-list-item" 
                            on:click={() => handleSceneClick(scene.id)}
                            on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSceneClick(scene.id); }}
                            role="button"
                            tabindex="0"
                        >
                            <Icon name="file-text" size={16} />
                            <span>{scene.name}</span>
                        </div>
                        {:else}
                            <p class="empty-message">아직 이 플롯에 연결된 씬이 없습니다.</p>
                        {/each}
                    </div>
                {:else}
                    <div class="empty-state">
                        <Icon name="git-merge" size={48} />
                        <p>왼쪽에서 플롯 스레드를 선택하여<br/>연결된 씬 목록을 확인하세요.</p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex; justify-content: center; align-items: center;
        z-index: 1000;
    }
    .modal-content {
        background-color: var(--primary-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-large);
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        width: 90%; max-width: 800px; height: 70vh;
        display: flex; flex-direction: column;
    }
    .modal-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 20px; border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
    }
    .modal-header h3 {
        margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1.1em;
    }
    .close-btn {
        background: none; border: none; cursor: pointer; color: var(--text-color-muted);
        padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    }
    .close-btn:hover { background-color: var(--secondary-bg); color: var(--text-color); }

    .modal-body { 
        display: flex; 
        flex-grow: 1; 
        min-height: 0; 
        overflow: hidden; /* Prevent body overflow */
    }
    .left-panel {
        width: 350px; 
        border-right: 1px solid var(--border-color);
        display: flex; 
        flex-direction: column; 
        padding: 16px;
        flex-shrink: 0;
        overflow-y: auto; /* Allow independent scrolling */
    }
    .right-panel { 
        flex-grow: 1; 
        padding: 20px; 
        overflow-y: auto; 
        display: flex;
        flex-direction: column;
    }

    @media (max-width: 768px) {
        .modal-body {
            flex-direction: column;
        }
        .left-panel {
            width: 100%;
            height: 50%;
            border-right: none;
            border-bottom: 1px solid var(--border-color);
        }
        .right-panel {
            height: 50%;
            padding: 15px;
        }
        
        /* Card-like layout for plot items on mobile */
        .plot-item {
            flex-wrap: wrap;
        }
        .plot-info {
            min-width: 120px;
        }
        .plot-actions {
            opacity: 1; /* Always show actions on mobile */
        }
    }
    .right-panel h3 {
        margin-top: 0;
        font-size: 1.1em;
        color: var(--text-color);
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 10px;
        margin-bottom: 10px;
    }

    .input-group { 
        display: flex; 
        gap: 8px; 
        margin-bottom: 16px; 
    }
    .input-group input {
        flex-grow: 1;
        background-color: var(--secondary-bg);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        padding: 8px 12px;
        border-radius: var(--border-radius);
        font-size: 0.9em;
    }
    .input-group input:focus {
        outline: none;
        border-color: var(--accent-color);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color) 20%, transparent);
    }

    .plot-list { 
        flex-grow: 1; 
        overflow-y: auto; 
        margin-right: -8px;
        padding-right: 8px;
    }
    .plot-item {
        display: flex; align-items: center; gap: 12px; padding: 12px;
        border-radius: var(--border-radius); cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
        margin-bottom: 4px;
    }
    .plot-item:hover { background-color: var(--secondary-bg); border-color: var(--border-color); }
    .plot-item.selected { 
        background-color: color-mix(in srgb, var(--accent-color) 10%, transparent);
        border-color: var(--accent-color);
    }
    .plot-item .plot-actions {
        display: flex;
        gap: 2px;
        margin-left: auto;
        opacity: 0;
        transition: opacity 0.15s;
    }
    .plot-item:hover .plot-actions,
    .plot-item.selected .plot-actions {
        opacity: 1;
    }

    .plot-color {
        width: 14px; height: 14px; border-radius: 4px;
        box-shadow: 0 0 0 2px var(--primary-bg), 0 0 0 3px var(--border-color);
        flex-shrink: 0;
    }
    .plot-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex-grow: 1;
        min-width: 0;
    }
    .plot-name { 
        font-weight: 600;
        font-size: 0.95em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .scene-count-badge {
        font-size: 0.75em;
        color: var(--text-color-muted);
        background: rgba(0,0,0,0.05);
        padding: 1px 6px;
        border-radius: 4px;
        align-self: flex-start;
    }
    .scene-count-badge.zero { opacity: 0.5; }

    .edit-actions { display: flex; gap: 4px; }
    .icon-btn.success:hover { background-color: var(--success-color); color: white; }

    .color-input-wrapper {
        position: relative;
        width: 24px; height: 24px;
        flex-shrink: 0;
    }
    .color-input-wrapper input[type="color"] {
        -webkit-appearance: none; -moz-appearance: none; appearance: none;
        width: 24px; height: 24px; background-color: transparent;
        border: none; cursor: pointer; padding: 0;
        position: absolute; top: 0; left: 0;
    }
    .color-input-wrapper input[type="color"]::-webkit-color-swatch { 
        border-radius: 50%; border: 2px solid var(--primary-bg);
    }
    .color-input-wrapper input[type="color"]::-moz-color-swatch { 
        border-radius: 50%; border: 2px solid var(--primary-bg);
    }
    .edit-input {
        flex-grow: 1;
        background-color: var(--secondary-bg);
        border: 1px solid var(--accent-color);
        padding: 4px 8px;
        border-radius: var(--border-radius);
        color: var(--text-color);
    }

    .scene-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .scene-list-item {
        padding: 10px 12px; 
        border-radius: var(--border-radius); 
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-color-muted);
        transition: all 0.15s;
    }
    .scene-list-item:hover { 
        background-color: var(--hover-bg); 
        color: var(--text-color);
    }
    .scene-list-item :global(.icon-wrapper) {
        flex-shrink: 0;
    }

    .empty-message {
        text-align: center;
        color: var(--text-color-muted);
        font-size: 0.9em;
        margin-top: 20px;
    }
    .empty-state {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: var(--text-color-muted);
        text-align: center;
    }
    .empty-state :global(.icon-wrapper) {
        opacity: 0.3;
    }
    .empty-state p {
        margin-top: 16px;
        line-height: 1.6;
    }

    .icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        background: none; border: none; color: var(--text-color-muted);
        cursor: pointer; width: 28px; height: 28px; flex-shrink: 0;
        border-radius: var(--border-radius); transition: all var(--transition-speed);
    }
    .icon-btn:hover { background-color: var(--hover-bg); color: var(--text-color); }
    .icon-btn.danger:hover { background-color: var(--danger-color); color: white; }
</style>
