<script>
    import { createEventDispatcher } from 'svelte';
    import Icon from './Icon.svelte';

    export let message = '정말로 진행하시겠습니까?';

    const dispatch = createEventDispatcher();

    function handleConfirm() {
        dispatch('confirm');
    }

    function handleCancel() {
        dispatch('cancel');
    }
</script>

<div 
    class="confirm-backdrop" 
    on:click={handleCancel}
    on:keydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') handleCancel(); }}
    role="button" 
    tabindex="0"
>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="confirm-modal" on:click|stopPropagation>
        <div class="modal-icon">
            <Icon name="alert-triangle" size={32} color="var(--danger-color)" />
        </div>
        <p class="modal-message">{message}</p>
        <div class="modal-actions">
            <button class="btn cancel-btn" on:click={handleCancel}>취소</button>
            <button class="btn confirm-btn" on:click={handleConfirm}>확인</button>
        </div>
    </div>
</div>

<style>
    .confirm-backdrop {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background-color: rgba(0, 0, 0, 0.6);
        z-index: 6000;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .confirm-modal {
        background-color: var(--secondary-bg);
        padding: 32px;
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        width: 90%;
        max-width: 400px;
        text-align: center;
    }
    .modal-icon {
        margin-bottom: 16px;
    }
    .modal-message {
        font-size: 1.1em;
        line-height: 1.6;
        margin: 0 0 24px 0;
        color: var(--text-color);
    }
    .modal-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
    }
    .btn {
        padding: 10px 24px;
        border: none;
        border-radius: var(--border-radius);
        font-size: 1em;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--transition-speed);
    }
    .cancel-btn {
        background-color: var(--primary-bg);
        border: 1px solid var(--border-color);
        color: var(--text-color);
    }
    .cancel-btn:hover {
        background-color: var(--border-color);
    }
    .confirm-btn {
        background-color: var(--danger-color);
        color: white;
    }
    .confirm-btn:hover {
        opacity: 0.85;
    }
</style>
