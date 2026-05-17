<script>
    import PieChart from './PieChart.svelte';
    import { activeStory } from './stores.js';
    import { trackVariableOverStoryline } from './utils.js'; // Import the new tracking function

    export let analysis;
    export let pieChartData;

    let includeNarration = false;
    $: displayPieChartData = includeNarration 
        ? pieChartData.filter(c => c.value > 0) 
        : pieChartData.filter(c => c.name !== '나레이션' && c.value > 0);

    // Reactive statement to update pieChartData if it changes
    $: if (analysis && analysis.characters) {
        pieChartData = analysis.characters.map(c => ({ name: c.name, value: c.dialogueCount, color: c.color }));
    }

    // Placeholder for selected storyline and variable for tracking
    let selectedStorylineId = null;
    let selectedVariable = null; // { type: 'variable' | 'characterAttribute', name: string, id: string }
    let variableTrackingData = [];

    // Derived store for available storylines
    $: availableStorylines = $activeStory ? $activeStory.storylines : [];
    // Derived store for available variables (including character attributes)
    $: availableVariables = (() => {
        if (!$activeStory) return [];
        let vars = $activeStory.variables.map(v => ({ type: 'variable', name: v.name, id: v.name }));
        $activeStory.characters.forEach(char => {
            for (const attr in char.attributes) {
                vars.push({ type: 'characterAttribute', name: `${char.name}.${attr}`, id: `${char.id}.${attr}`, characterId: char.id, attributeName: attr });
            }
        });
        return vars;
    })();

    $: if ($activeStory && analysis) {
        if (selectedStorylineId && selectedVariable) {
            variableTrackingData = trackVariableOverStoryline($activeStory, selectedStorylineId, selectedVariable);
        }
    }

    function getHeatmapColor(count) {
        if (count === 0) return 'transparent';
        if (count < 3) return 'rgba(0, 170, 255, 0.1)';
        if (count < 7) return 'rgba(0, 170, 255, 0.3)';
        if (count < 15) return 'rgba(0, 170, 255, 0.5)';
        return 'rgba(0, 170, 255, 0.7)';
    }
</script>

<div class="analysis-section">
    <h3>캐릭터 심층 분석</h3>
    
    <div class="stat-card full-width-desktop">
        <div class="card-header">
            <h3>캐릭터 대사 비중</h3>
            <div class="toggle-switch">
                <label>
                    <input type="checkbox" bind:checked={includeNarration}>
                    나레이션 포함
                </label>
            </div>
        </div>
        {#if displayPieChartData.length > 0}
            <PieChart data={displayPieChartData} />
        {:else}
            <p>분석할 캐릭터가 없습니다.</p>
        {/if}
    </div>

    <div class="stat-card full-width">
        <h3>캐릭터 상호작용 (히트맵)</h3>
        {#if analysis.characterInteractions && Object.keys(analysis.characterInteractions).length > 0}
            <div class="table-container">
                <table class="heatmap-table">
                    <thead>
                        <tr>
                            <th>화자 \ 청자</th>
                            {#each analysis.characters.filter(c => c.name !== '나레이션') as char (char.name)}
                                <th>{char.name}</th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each analysis.characters.filter(c => c.name !== '나레이션') as speaker (speaker.name)}
                            <tr>
                                <th>{speaker.name}</th>
                                {#each analysis.characters.filter(c => c.name !== '나레이션') as listener (listener.name)}
                                    {@const count = analysis.characterInteractions[speaker.name]?.[listener.name] || 0}
                                    <td style="background-color: {getHeatmapColor(count)};">
                                        {#if count > 0}{count}{/if}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {:else}
            <p>상호작용 데이터가 없습니다.</p>
        {/if}
    </div>

    <div class="stat-card full-width">
        <h3>변수/능력치 진행 상황 추적</h3>
        <div class="controls">
            <select bind:value={selectedStorylineId}>
                <option value={null} disabled>스토리라인 선택</option>
                {#each availableStorylines as sl (sl.id)}
                    <option value={sl.id}>{sl.name}</option>
                {/each}
            </select>
            <select bind:value={selectedVariable}>
                <option value={null} disabled>변수/능력치 선택</option>
                {#each availableVariables as v (v.id)}
                    <option value={v}>{v.name}</option>
                {/each}
            </select>
        </div>
        {#if variableTrackingData.length > 0}
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>씬 이름</th>
                            <th>{selectedVariable?.name || '값'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each variableTrackingData as dataPoint (dataPoint.sceneId)}
                            <tr>
                                <td>{dataPoint.sceneName}</td>
                                <td>{dataPoint.value}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {:else}
            <p>추적할 데이터가 없습니다. 스토리라인과 변수를 선택해주세요.</p>
        {/if}
    </div>
</div>

<style>
    .analysis-section {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    .stat-card {
        background-color: var(--secondary-bg);
        border-radius: var(--border-radius);
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    .stat-card.full-width {
        width: 100%;
    }
    h3 {
        margin-top: 0;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 10px;
        margin-bottom: 15px;
    }
    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        /* To ensure h3 border stretches */
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 15px;
    }
    .card-header h3 {
        border-bottom: none;
        margin-bottom: 0;
    }
    .toggle-switch {
        font-size: 0.9em;
        color: var(--text-color-muted);
    }
    .toggle-switch label {
        display: flex;
        align-items: center;
        cursor: pointer;
    }
    .toggle-switch input {
        margin-right: 5px;
    }
    .controls {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
    }
    .controls select {
        padding: 8px;
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
        background-color: var(--input-bg);
        color: var(--text-color);
    }
    .table-container {
        max-height: 300px;
        overflow-y: auto;
    }
    table {
        width: 100%;
        border-collapse: collapse;
    }
    th, td {
        padding: 10px;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
    }
    th {
        background-color: var(--primary-bg);
        position: sticky;
        top: 0;
    }
    .heatmap-table th, .heatmap-table td {
        text-align: center;
        min-width: 60px;
    }
    .heatmap-table th:first-child {
        text-align: left;
    }
</style>