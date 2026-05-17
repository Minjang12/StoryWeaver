<script>
    export let analysis;
</script>

<div class="analysis-section">
    <h3>흐름 & 완급 분석</h3>

    <div class="stat-card full-width">
        <h4>씬별 단어 수 및 대사 비율</h4>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>씬 이름</th>
                        <th>총 단어 수</th>
                        <th>대사 비율</th>
                    </tr>
                </thead>
                <tbody>
                    {#each analysis.pacing as scenePacing (scenePacing.name)}
                        <tr>
                            <td>{scenePacing.name}</td>
                            <td>{scenePacing.wordCount.toLocaleString()}</td>
                            <td>
                                <div class="ratio-cell-content">
                                    <div class="dialogue-ratio-bar-container">
                                        <div class="dialogue-ratio-bar" style="width: {scenePacing.dialogueRatio}%;"></div>
                                    </div>
                                    <span>{scenePacing.dialogueRatio}%</span>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</div>

<style>
    .analysis-section {
        background-color: var(--secondary-bg);
        border-radius: var(--border-radius);
        padding: 20px;
        border: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    h3, h4 {
        margin-top: 0;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 10px;
        margin-bottom: 15px;
    }
    .stat-card {
        background-color: var(--primary-bg);
        border-radius: var(--border-radius);
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    .stat-card.full-width {
        width: 100%;
    }
    .table-container {
        max-height: 400px;
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
        background-color: var(--secondary-bg);
        position: sticky;
        top: 0;
    }
    .dialogue-ratio-bar-container {
        width: 100px; /* Fixed width for the bar */
        height: 10px;
        background-color: var(--primary-bg);
        border-radius: 5px;
        overflow: hidden;
    }
    .dialogue-ratio-bar {
        height: 100%;
        background-color: var(--accent-color);
        transition: width 0.3s ease-out;
    }
    .ratio-cell-content {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .ratio-cell-content span {
        font-size: 0.85em;
        color: var(--text-color-muted);
        min-width: 35px; /* Prevent layout shift */
    }
</style>