<script>
    import { projectActions, searchResults, searchQuery, uiState } from './stores.js';

    function gotoResult(result) {
        searchQuery.set(''); // Clear search on selection

        switch (result.type) {
            case 'Scene':
            case 'Dialogue':
            case 'Choice':
                // If it's a dialogue or choice, use the sceneId attached to the result
                projectActions.selectScene(result.sceneId || result.id);
                break;
            case 'Character':
                uiState.openWikiModal(result.id, 'character');
                break;
            case 'Location':
                uiState.openWikiModal(result.id, 'location');
                break;
            case 'Item':
                uiState.openWikiModal(result.id, 'item');
                break;
            case 'Group':
                uiState.openWikiModal(result.id, 'group');
                break;
            case 'Lore':
                uiState.openWikiModal(result.id, 'lore');
                break;
            case 'History':
                uiState.openWikiModal(result.id, 'history');
                break;
            case 'PlotThread':
                uiState.openPlotThreadModal();
                break;
        }
    }

	function handleKeyDown(event, result) {
        if (event.key === 'Enter') {
            gotoResult(result);
        }
    }

    function highlight(text, query) {
        if (!query || !text) return text;
        const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
</script>

<div class="search-results-container">
    {#if $searchResults.length > 0}
        <div class="search-results-list">
            {#each $searchResults as result (result.type + result.id + result.name)}
                <div class="search-result-item" on:click={() => gotoResult(result)} on:keydown={(e) => handleKeyDown(e, result)} role="button" tabindex="0">
                    <div class="result-context">{result.context}</div>
                    <div class="result-content">
                        <strong>{result.type}:</strong> {@html highlight(result.name, $searchQuery)}
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <p class="no-results-msg">검색 결과가 없다냥.</p>
    {/if}
</div>

<style>
    .search-results-container {
        position: absolute;
        top: calc(100% + 8px); /* Position below the search input */
        left: 0;
        right: 0;
        margin: 0 auto;
        width: 100%;
        max-height: 400px;
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        z-index: 1100;
        overflow-y: auto;
    }
    .search-results-list {
        padding: 6px;
        margin: 0;
    }
    .search-result-item {
        padding: 10px 14px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color var(--transition-speed);
    }
    .search-result-item:hover {
        background-color: var(--primary-bg);
    }
    .result-context {
        font-size: 0.85em;
        color: var(--text-color-muted);
        margin-bottom: 4px;
    }
    .result-content {
        font-size: 0.95em;
    }
    .result-content strong {
        color: var(--accent-color);
        font-weight: 500;
        text-transform: capitalize;
    }
    .no-results-msg {
        padding: 20px;
        text-align: center;
        color: var(--text-color-muted);
    }
    :global(mark) {
        background-color: rgba(0, 170, 255, 0.25);
        color: inherit;
        padding: 1px 2px;
        border-radius: 3px;
    }
</style>
