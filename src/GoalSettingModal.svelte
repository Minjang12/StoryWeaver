<script>
    import { createEventDispatcher } from 'svelte';
    import { activeStory, projectActions } from './stores.js';
    import Icon from './Icon.svelte';

    const dispatch = createEventDispatcher();

    let dailyWordCountTarget = $activeStory?.goals?.dailyWordCount?.target || 500;

    function saveGoal() {
        projectActions.setWordCountGoal(Number(dailyWordCountTarget));
        close();
    }

    function close() {
        dispatch('close');
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            close();
        } else if (event.key === 'Enter') {
            saveGoal();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal-backdrop" on:click={close} on:keydown={handleKeydown}>
    <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
        <div class="modal-header">
            <h2 id="goal-modal-title">일일 창작 목표 설정</h2>
            <button class="close-btn" on:click={close} aria-label="닫기"><Icon name="x" /></button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label for="word-count-goal">
                    <Icon name="target" />
                    일일 단어 수 목표
                </label>
                <p class="description">하루에 달성하고 싶은 단어 수를 설정하세요. 작은 목표가 꾸준한 창작을 이끌어줍니다.</p>
                <input 
                    type="number" 
                    id="word-count-goal" 
                    bind:value={dailyWordCountTarget}
                    min="10"
                    step="10"
                    placeholder="예: 500"
                />
            </div>
        </div>
        <div class="modal-footer">
            <button class="button-secondary" on:click={close}>취소</button>
            <button class="button-primary" on:click={saveGoal}>저장</button>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.6);
        display: flex; justify-content: center; align-items: center;
        z-index: 2000;
    }
    .modal-content {
        background-color: var(--primary-bg);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow-lg);
        width: 500px;
        max-width: 90%;
        display: flex;
        flex-direction: column;
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid var(--border-color);
    }
    .modal-header h2 { margin: 0; font-size: 1.2em; }
    .close-btn { background: none; border: none; color: var(--text-color); cursor: pointer; padding: 5px; }
    .modal-body {
        padding: 25px 20px;
    }
    .form-group label {
        font-weight: 600;
        font-size: 1.1em;
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }
    .form-group .description {
        font-size: 0.9em;
        color: var(--text-color-muted);
        margin-top: 0;
        margin-bottom: 15px;
    }
    .form-group input {
        width: 100%;
        padding: 10px;
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
        background-color: var(--input-bg);
        color: var(--text-color);
        font-size: 1em;
    }
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 15px 20px;
        border-top: 1px solid var(--border-color);
    }
    .button-primary, .button-secondary {
        padding: 8px 15px;
        border-radius: var(--border-radius);
        border: none;
        cursor: pointer;
        font-weight: 500;
    }
    .button-primary {
        background-color: var(--accent-color);
        color: white;
    }
    .button-secondary {
        background-color: var(--secondary-bg);
        color: var(--text-color);
        border: 1px solid var(--border-color);
    }
</style>
