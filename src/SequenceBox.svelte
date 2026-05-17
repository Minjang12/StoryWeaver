<script>
    import { createEventDispatcher } from 'svelte';
    export let sequence;
    export let scenes;

    const dispatch = createEventDispatcher();

    function handleContextMenu(event) {
        event.preventDefault();
        dispatch('contextmenu', { sequence, event });
    }

    let box = { x: 0, y: 0, width: 0, height: 0 };

    $: {
        const PADDING = 40;
        const MIN_WIDTH = 200;
        const MIN_HEIGHT = 150;
        const NODE_WIDTH = 160;
        const NODE_HEIGHT = 60; // Should match scene-node styling

        const scenesInSequence = sequence.scenes
            .map(id => scenes[id])
            .filter(Boolean);

        if (scenesInSequence.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            for (const scene of scenesInSequence) {
                minX = Math.min(minX, scene.position.x);
                minY = Math.min(minY, scene.position.y);
                maxX = Math.max(maxX, scene.position.x + NODE_WIDTH);
                maxY = Math.max(maxY, scene.position.y + NODE_HEIGHT);
            }

            box.x = minX - PADDING;
            box.y = minY - PADDING;
            box.width = Math.max(MIN_WIDTH, (maxX - minX) + PADDING * 2);
            box.height = Math.max(MIN_HEIGHT, (maxY - minY) + PADDING * 2);
        } else {
            // Default size for an empty sequence
            box = { x: sequence.position?.x || 200, y: sequence.position?.y || 200, width: MIN_WIDTH, height: MIN_HEIGHT };
        }
    }
</script>

<div
    class="sequence-box"
    style="
        left: {box.x}px;
        top: {box.y}px;
        width: {box.width}px;
        height: {box.height}px;
        background-color: {sequence.color || 'rgba(108, 117, 125, 0.1)'};
    "
    on:contextmenu|stopPropagation={handleContextMenu}
>
    <div 
        class="sequence-header"
        on:mousedown|stopPropagation={(e) => dispatch('dragstart', { sequence, event: e })}
    >
        {sequence.name}
    </div>
</div>

<style>
    .sequence-box {
        position: absolute;
        border: 2px dashed var(--node-border);
        border-radius: var(--border-radius-lg);
        z-index: -1; /* Render behind scenes */
    }

    .sequence-header {
        position: absolute;
        top: -28px;
        left: 10px;
        background-color: var(--primary-bg);
        padding: 2px 10px;
        border-radius: var(--border-radius);
        font-size: 14px;
        font-weight: 600;
        color: var(--text-color);
        border: 1px solid var(--node-border);
        cursor: grab;
    }
    .sequence-header:active {
        cursor: grabbing;
    }
</style>
