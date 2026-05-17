<script>
    import { tick } from 'svelte';
    import Icon from './Icon.svelte';

    export let text = '';

    let visible = false;
    let top = 0;
    let left = 0;
    let wrapperEl;
    let tooltipEl;
    let isFlipped = false;

    async function handleMouseEnter() {
        visible = true;
        // Wait for the tooltip to be rendered to get its dimensions
        await tick();

        if (!wrapperEl || !tooltipEl) return;

        const iconRect = wrapperEl.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        const viewportMargin = 8;

        // Default position: above the icon
        let newTop = iconRect.top - tooltipRect.height - 8;
        isFlipped = false;

        // If it overflows the top of the viewport, flip it to be below the icon
        if (newTop < viewportMargin) {
            newTop = iconRect.bottom + 8;
            isFlipped = true;
        }

        // Center it horizontally
        let newLeft = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);

        // Adjust if it overflows horizontally
        if (newLeft < viewportMargin) {
            newLeft = viewportMargin;
        } else if (newLeft + tooltipRect.width > window.innerWidth - viewportMargin) {
            newLeft = window.innerWidth - tooltipRect.width - viewportMargin;
        }

        top = newTop;
        left = newLeft;
    }

    function handleMouseLeave() {
        visible = false;
    }
</script>

<div 
    class="help-tooltip-wrapper"
    bind:this={wrapperEl}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
>
    <div class="icon-wrapper">
        <Icon name="help-circle" size={16} color="var(--text-color-muted)" />
    </div>

    {#if visible}
    <div 
        class="tooltip-content"
        class:flipped={isFlipped}
        bind:this={tooltipEl}
        style="top: {top}px; left: {left}px;"
        role="tooltip"
    >
        {@html text}
    </div>
    {/if}
</div>

<style>
    .help-tooltip-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 8px;
    }

    .icon-wrapper {
        cursor: help;
    }

    .tooltip-content {
        position: fixed; /* Use fixed positioning to break out of parent overflow */
        background-color: var(--tooltip-bg, #2c3e50);
        color: var(--tooltip-text-color, white);
        padding: 10px 15px;
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow-heavy);
        width: max-content;
        max-width: 320px;
        font-size: 0.95em;
        line-height: 1.6;
        z-index: 7000;
        pointer-events: none;
        text-align: left;
    }

    /* Arrow pointing down */
    .tooltip-content::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: var(--tooltip-bg, #2c3e50);
    }

    /* Flipped arrow pointing up */
    .tooltip-content.flipped::after {
        top: auto;
        bottom: 100%;
        border-top-color: transparent;
        border-bottom-color: var(--tooltip-bg, #2c3e50);
    }
</style>