<script>
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { fly } from 'svelte/transition';
    import Icon from './Icon.svelte';

    export let isOpen = false;
    export let title = '입력';
    export let message = '';
    export let placeholder = '';
    export let initialValue = '';
    export let onConfirm = null;

    const dispatch = createEventDispatcher();
    let inputValue = initialValue;

    function handleConfirm() {
        if (onConfirm) {
            onConfirm(inputValue);
        }
        close();
    }

    function close() {
        dispatch('close');
    }

    function handleGlobalKeyDown(event) {
        if (isOpen && event.key === 'Escape') {
            close();
        }
    }

    function handleInputKeyDown(event) {
        if (event.key === 'Enter') {
            handleConfirm();
        }
    }

    onMount(() => {
        window.addEventListener('keydown', handleGlobalKeyDown);
    });

    onDestroy(() => {
        window.removeEventListener('keydown', handleGlobalKeyDown);
    });
</script>

{#if isOpen}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="modal-backdrop" on:click={close} transition:fly={{ y: 20, duration: 200 }}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="modal-content" on:click|stopPropagation transition:fly={{ y: -20, duration: 200 }}>
        <div class="modal-header">
            <h3>{title}</h3>
            <button class="close-btn" on:click={close}><Icon name="x" /></button>
        </div>
        <div class="modal-body">
            <p>{message}</p>
            <input
                type="text"
                bind:value={inputValue}
                {placeholder}
                on:keydown={handleInputKeyDown}
            />
        </div>
        <div class="modal-footer">
            <button class="button-secondary" on:click={close}>취소</button>
            <button class="button-primary" on:click={handleConfirm}>확인</button>
        </div>
    </div>
</div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1200;
    }
    .modal-content {
        background-color: var(--secondary-bg);
        padding: 24px;
        border-radius: var(--border-radius-lg);
        box-shadow: var(--box-shadow-lg);
        width: 100%;
        max-width: 450px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .modal-header h3 {
        margin: 0;
        font-size: 1.25em;
    }
    .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-color-muted);
    }
    .modal-body p {
        margin: 0 0 12px 0;
        color: var(--text-color-muted);
    }
    input {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        background-color: var(--primary-bg);
        color: var(--text-color);
    }
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }
    .button-primary, .button-secondary {
        padding: 10px 20px;
        border-radius: var(--border-radius);
        border: none;
        cursor: pointer;
        font-weight: 600;
    }
    .button-primary {
        background-color: var(--accent-color);
        color: white;
    }
    .button-secondary {
        background-color: var(--node-border);
        color: var(--text-color);
    }
</style>