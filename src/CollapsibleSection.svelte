<script>
    import { createEventDispatcher } from 'svelte';
    import Icon from './Icon.svelte';
    import HelpTooltip from './HelpTooltip.svelte';

    export let isOpen = true;
    export let widgetId = ''; // To identify which widget is being dragged
    export let helpText = '';
    const dispatch = createEventDispatcher();

    function toggle() {
        dispatch('toggle');
    }

    function handleDragStart(event) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', widgetId);
    }
</script>

<div class="collapsible-section">
    <button 
        class="section-header" 
        on:click={toggle}
        draggable={widgetId !== 'dialogues'}
        on:dragstart={handleDragStart}
        aria-expanded={isOpen}
    >
        <div class="arrow-wrapper" class:open={isOpen}>
            <Icon name="chevron-down" size={18} />
        </div>
        <div class="header-content">
            <slot name="header"></slot>
        </div>
        {#if helpText}
            <HelpTooltip text={helpText} />
        {/if}
    </button>
    {#if isOpen}
        <div class="section-content">
            <slot name="body"></slot>
        </div>
    {/if}
</div>

<style>
    .collapsible-section {
        margin-bottom: 0;
        border: none;
        border-bottom: 1px solid var(--border-color);
        border-radius: 0;
        overflow: hidden;
        background-color: transparent;
    }
    .section-header {
        display: flex;
        align-items: center;
        width: 100%;
        background-color: transparent;
        padding: 10px 4px;
        cursor: pointer;
        border: none;
        color: var(--text-color-muted);
        font-size: 0.9em;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        text-align: left;
        transition: color 0.2s;
        overflow: hidden;
    }
    .header-content {
        flex-shrink: 1;
        flex-grow: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .collapsible-section:last-child {
        border-bottom: none;
    }
    .section-header:hover {
        color: var(--text-color);
        background-color: rgba(255, 255, 255, 0.02);
    }
    .arrow-wrapper {
        margin-right: 8px;
        transition: transform var(--transition-speed) ease;
        display: flex;
        align-items: center;
        opacity: 0.5;
    }
    .arrow-wrapper.open {
        transform: rotate(180deg);
    }
    .section-content {
        padding: 4px 4px 16px 4px;
    }
</style>
