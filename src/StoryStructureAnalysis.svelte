<script>
    export let analysis;
</script>

    <div class="stat-card">
        <h4>고립된 씬 (Orphan Scenes)</h4>
        <p class="description">다른 씬에서 연결되지 않아 도달할 수 없는 씬입니다.</p>
        {#if analysis.structure.isolatedScenes.length > 0}
            <ul>
                {#each analysis.structure.isolatedScenes as scene (scene.id)}
                    <li>{scene.name}</li>
                {/each}
            </ul>
        {:else}
            <p>고립된 씬이 없습니다.</p>
        {/if}
    </div>

    <div class="stat-card">
        <h4>막다른 씬 (Dead-end Scenes)</h4>
        <p class="description">다음으로 이어지는 선택지나 자동 연결이 없는 씬입니다. (엔딩으로 의도된 씬 제외)</p>
        {#if analysis.structure.deadEndScenes.length > 0}
            <ul>
                {#each analysis.structure.deadEndScenes as scene (scene.id)}
                    <li>{scene.name}</li>
                {/each}
            </ul>
        {:else}
            <p>막다른 씬이 없습니다.</p>
        {/if}
    </div>

<style>
    h4 {
        margin-top: 0;
        margin-bottom: 10px;
    }
    .stat-card {
        background-color: var(--secondary-bg);
        border-radius: var(--border-radius);
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    .description {
        font-size: 0.85em;
        color: var(--text-color-muted);
        margin-bottom: 15px;
    }
    ul {
        padding-left: 20px;
        margin: 0;
    }
    li {
        margin-bottom: 5px;
    }
</style>