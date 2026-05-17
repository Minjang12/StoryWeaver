<script>
    import { fly } from "svelte/transition";
    import Icon from "./Icon.svelte";

    export let term;
    export let definition;
    export let linkedAnnotation = null;
    export let x;
    export let y;
    export let viewportWidth;
    export let viewportHeight;

    let tooltipEl;
    let position = { top: "0px", left: "0px" };

    $: {
        if (tooltipEl) {
            const elRect = tooltipEl.getBoundingClientRect();
            let newX = x + 10;
            let newY = y + 15;

            // 1. Horizontal Bounds Check
            if (newX + elRect.width > viewportWidth - 20) {
                newX = viewportWidth - elRect.width - 20;
            }
            if (newX < 20) newX = 20;

            // 2. Vertical Bounds Check
            // If tooltip goes off bottom, try placing it above the mouse
            if (newY + elRect.height > viewportHeight - 20) {
                newY = y - elRect.height - 15;
            }

            // 3. Final safety check for top bound
            if (newY < 20) {
                newY = 20;
            }

            position.left = `${newX}px`;
            position.top = `${newY}px`;
        }
    }

    const getPreview = (text, maxLength = 20) =>
        text && text.length > maxLength
            ? `${text.substring(0, maxLength)}...`
            : text;
</script>

<div
    class="tooltip-container"
    bind:this={tooltipEl}
    style="top: {position.top}; left: {position.left};"
    transition:fly={{ y: -10, duration: 200 }}
>
    <strong class="tooltip-term">{term}</strong>
    <p class="tooltip-def">{definition || "정의가 아직 없습니다."}</p>

    {#if linkedAnnotation}
        <div class="separator"></div>
        <div class="annotation-section">
            <div class="annotation-header">
                <Icon name="link" size={14} color="var(--accent-color)" />
                <span>연결된 주석</span>
            </div>
            <div class="annotation-source">
                {#if linkedAnnotation.type === "scene"}
                    <strong>[{linkedAnnotation.sceneName}]</strong> 씬 메모
                {:else}
                    <strong>[{linkedAnnotation.sceneName}]</strong>
                    "{getPreview(linkedAnnotation.dialogueText)}"
                {/if}
            </div>
            <p class="annotation-content">{linkedAnnotation.content}</p>
        </div>
    {/if}
</div>

<style>
    .tooltip-container {
        position: fixed;
        z-index: 9999;
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: 12px 16px;
        box-shadow: var(--shadow-lg);
        max-width: 350px;
        max-height: 80vh;
        overflow-y: auto;
        width: max-content;
        color: var(--text-color);
        font-size: 0.9em;
        line-height: 1.5;
        pointer-events: none; /* So it doesn't interfere with other mouse events */
    }
    .tooltip-term {
        font-weight: 600;
        color: var(--accent-color);
        display: block;
        margin-bottom: 6px;
    }
    .tooltip-def {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
    }
    .separator {
        height: 1px;
        background-color: var(--border-color);
        margin: 12px 0;
    }
    .annotation-section {
        font-size: 0.9em;
    }
    .annotation-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        color: var(--text-color-muted);
        margin-bottom: 8px;
    }
    .annotation-source {
        font-size: 0.9em;
        color: var(--text-color-muted);
        margin-bottom: 4px;
    }
    .annotation-source strong {
        color: var(--accent-color);
    }
    .annotation-content {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        background-color: var(--secondary-bg);
        padding: 8px;
        border-radius: var(--border-radius);
        font-style: italic;
    }
</style>
