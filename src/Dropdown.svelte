<script>
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';

    export let show = false;

    const dispatch = createEventDispatcher();
    let dropdownEl;

    function handleClickOutside(event) {
        if (show && dropdownEl && !dropdownEl.contains(event.target)) {
            dispatch('close');
        }
    }

    onMount(() => {
        window.addEventListener('click', handleClickOutside, true);
    });

    onDestroy(() => {
        window.removeEventListener('click', handleClickOutside, true);
    });
</script>

<div class="dropdown-container" bind:this={dropdownEl}>
    <slot name="trigger"></slot>
    {#if show}
        <div class="dropdown-menu">
            <slot name="menu"></slot>
        </div>
    {/if}
</div>

<style>
    .dropdown-container {
        position: relative;
        display: inline-block;
    }
    .dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 2000;
        min-width: 220px;
        overflow: hidden;
        padding: 8px;
    }
</style>
