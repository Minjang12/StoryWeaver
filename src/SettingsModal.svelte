<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { settings, saveSettings, uiState } from './stores.js';
    import Icon from './Icon.svelte';

    const dispatch = createEventDispatcher();


    function handleKeydown(event) {
        if (event.key === 'Escape') {
            close();
        }
    }

    let currentSettings;
    const unsubscribe = settings.subscribe(value => {
        currentSettings = value;
    });

    function handleSave() {
        saveSettings({ ...currentSettings });
        close();
    }

    function close() {
        dispatch('close');
    }

    onMount(() => {
        // Component is ready
    });

    // Cleanup subscription
    import { onDestroy } from 'svelte';
    onDestroy(unsubscribe);
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal-backdrop" on:click={close} role="presentation">
    <div class="modal-content" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="-1" on:keydown>
        <div class="modal-header">
            <h3><Icon name="settings" size={20}/> 설정</h3>
            <button class="close-btn" on:click={close}><Icon name="x" size={18}/></button>
        </div>
        <div class="modal-body">
            <div class="setting-item">
                <div class="setting-info">
                    <h4>캐릭터 상태 관리</h4>
                    <p>프로젝트 전체에서 사용되는 캐릭터 상태를 관리하고, 행동 불능 상태를 지정합니다.</p>
                </div>
                <button class="primary-btn" on:click={() => uiState.openStateManagerModal()}>
                    상태 관리 열기
                </button>
            </div>
        </div>
        <div class="modal-footer">
            <button class="secondary-btn" on:click={close}>닫기</button>
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
        width: 90%; max-width: 550px;
        display: flex; flex-direction: column;
    }
    .modal-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 20px; border-bottom: 1px solid var(--border-color);
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
        padding: 20px;
    }
    .setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 0;
        border-bottom: 1px solid var(--border-color);
    }
    .setting-item:last-child {
        border-bottom: none;
    }
    .setting-info h4 {
        margin: 0 0 4px 0;
        font-size: 1em;
        color: var(--text-color);
    }
    .setting-info p {
        margin: 0;
        font-size: 0.9em;
        color: var(--text-color-muted);
    }
    .primary-btn {
        padding: 8px 16px;
        border-radius: var(--border-radius);
        cursor: pointer;
        font-weight: 500;
        transition: all var(--transition-speed);
        border: 1px solid var(--accent-color);
        background-color: var(--accent-color);
        color: white;
    }
    .primary-btn:hover {
        background-color: var(--accent-color-dark);
        border-color: var(--accent-color-dark);
    }
    .modal-footer {
        padding: 12px 20px;
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }
    .secondary-btn {
        padding: 8px 16px;
        border-radius: var(--border-radius);
        cursor: pointer;
        font-weight: 500;
        transition: all var(--transition-speed);
        border: 1px solid var(--border-color);
        background-color: var(--secondary-bg);
        color: var(--text-color);
    }
    .secondary-btn:hover {
        border-color: var(--text-color-muted);
    }
</style>
