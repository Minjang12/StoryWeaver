<script>
    import { getColorFromString } from './utils.js';

    export let data = []; // Expects an array of objects like [{ name: '...', value: 10, color: '#...' }]

    $: sortedData = [...data].sort((a, b) => b.value - a.value);
    $: total = sortedData.reduce((sum, d) => sum + d.value, 0);

    function getCoordinatesForPercent(percent) {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    }

    let cumulativePercent = 0;
    $: slices = sortedData.map(d => {
        const percent = d.value / total;
        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        cumulativePercent += percent;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = percent > 0.5 ? 1 : 0;

        const pathData = [
            `M ${startX} ${startY}`, // Move
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
            `L 0 0`, // Line to center
        ].join(' ');

        return {
            path: pathData,
            color: d.color || getColorFromString(d.name),
            name: d.name,
            percentage: (percent * 100).toFixed(1)
        };
    });

    // Reset cumulativePercent when data changes
    $: if (data) {
        cumulativePercent = 0;
    }
</script>

<div class="pie-chart-container">
    <svg viewBox="-1 -1 2 2" style="transform: rotate(-90deg);">
        {#if total > 0}
            {#each slices as slice}
                <path d={slice.path} fill={slice.color}></path>
            {/each}
        {/if}
    </svg>
    <div class="legend">
        {#each slices as slice}
            <div class="legend-item">
                <span class="legend-color" style="background-color: {slice.color};"></span>
                <span class="legend-name">{slice.name}</span>
                <span class="legend-percent">{slice.percentage}%</span>
            </div>
        {/each}
    </div>
</div>

<style>
    .pie-chart-container {
        display: flex;
        align-items: center;
        gap: 20px;
        width: 100%;
    }
    svg {
        width: 150px;
        height: 150px;
        flex-shrink: 0;
    }
    .legend {
        flex-grow: 1;
        font-size: 0.9em;
        overflow-y: auto;
        max-height: 150px; /* Match SVG height */
    }
    .legend-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
    }
    .legend-color {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 8px;
        flex-shrink: 0;
    }
    .legend-name {
        font-weight: 500;
        margin-right: auto;
    }
    .legend-percent {
        color: var(--text-color-muted);
    }
</style>
