<script>
    import { onMount, afterUpdate } from 'svelte';

    export let name;
    export let size = 20;
    export let strokeWidth = 2;
    export let color = 'currentColor';
    export let fill = 'none';
    export let className = '';

    let iconHTML;
    let prevProps = {};

    function updateIcon() {
        if (window.feather && window.feather.icons[name]) {
            const props = { name, size, strokeWidth, color, fill };
            // Check if any prop has changed to avoid unnecessary re-renders
            if (JSON.stringify(props) !== JSON.stringify(prevProps)) {
                const svg = window.feather.icons[name].toSvg({
                    width: size,
                    height: size,
                    'stroke-width': strokeWidth,
                    color: color,
                    fill: fill
                });
                iconHTML = svg;
                prevProps = props;
            }
        }
    }

    onMount(updateIcon);
    afterUpdate(updateIcon);
</script>

{#if iconHTML}
    <i class="icon-wrapper {className}" style="width: {size}px; height: {size}px;">
        {@html iconHTML}
    </i>
{:else}
    <!-- Fallback or placeholder -->
    <i class="icon-wrapper {className}" style="width: {size}px; height: {size}px;"></i>
{/if}

<style>
    .icon-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .icon-wrapper :global(svg) {
        width: 100%;
        height: 100%;
    }
</style>
