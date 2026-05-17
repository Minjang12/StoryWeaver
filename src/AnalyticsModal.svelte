<script>
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { activeStory } from './stores.js';
    import { analyzeStory } from './utils.js';
    import Icon from './Icon.svelte';
    import PieChart from './PieChart.svelte';

    // New analysis components (placeholders for now)
    import PacingFlowAnalysis from './PacingFlowAnalysis.svelte';
    import CharacterDeepDiveAnalysis from './CharacterDeepDiveAnalysis.svelte';
    import StoryStructureAnalysis from './StoryStructureAnalysis.svelte';

    import GoalsAnalysis from './GoalsAnalysis.svelte'; // MIMINYAN: Import new component

    const dispatch = createEventDispatcher();

    let analysis = null;
    let pieChartData = [];
    let activeTab = 'overview'; // 'overview', 'pacing-flow', 'character-deep-dive', 'story-structure', 'readability', 'achievements', 'goals'

    activeStory.subscribe(story => {
        if (story) {
            analysis = analyzeStory(story);
            pieChartData = analysis.characters.map(c => ({ name: c.name, value: c.dialogueCount, color: c.color }));
        } else {
            analysis = null;
            pieChartData = [];
        }
    });

    function close() {
        dispatch('close');
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            close();
        }
    }

    onMount(() => {
        window.addEventListener('keydown', handleKeydown);
    });

    onDestroy(() => {
        window.removeEventListener('keydown', handleKeydown);
    });
</script>

<div class="modal-backdrop" on:click={close} on:keydown={close}>
    <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true">
        <div class="modal-header">
            <h2>스토리 분석 대시보드</h2>
            <button class="close-btn" on:click={close}><Icon name="x" /></button>
        </div>
        <div class="tab-navigation">
            <button class="tab-btn" class:active={activeTab === 'overview'} on:click={() => activeTab = 'overview'}>
                <Icon name="bar-chart-2" /> 개요
            </button>
            <button class="tab-btn" class:active={activeTab === 'pacing-flow'} on:click={() => activeTab = 'pacing-flow'}>
                <Icon name="trending-up" /> 흐름 & 완급
            </button>
            <button class="tab-btn" class:active={activeTab === 'character-deep-dive'} on:click={() => activeTab = 'character-deep-dive'}>
                <Icon name="users" /> 캐릭터 심층 분석
            </button>
            <button class="tab-btn" class:active={activeTab === 'story-structure'} on:click={() => activeTab = 'story-structure'}>
                <Icon name="git-branch" /> 스토리 구조
            </button>

            <button class="tab-btn" class:active={activeTab === 'goals'} on:click={() => activeTab = 'goals'}>
                <Icon name="target" /> 목표 & 습관
            </button>
        </div>
        <div class="modal-body">
            {#if analysis}
                {#if activeTab === 'overview'}
                    <div class="grid-container">
                        <!-- General Stats -->
                        <div class="stat-card">
                            <h3>종합 통계</h3>
                            <ul>
                                <li><strong>총 씬 개수:</strong> {analysis.general.sceneCount}</li>
                                <li><strong>총 대사 수:</strong> {analysis.general.dialogueCount}</li>
                                <li><strong>총 선택지 수:</strong> {analysis.general.choiceCount}</li>
                                <li><strong>총 단어 수:</strong> {analysis.general.wordCount.toLocaleString()}</li>
                            </ul>
                        </div>
                    </div>
                {:else if activeTab === 'pacing-flow'}
                    <PacingFlowAnalysis {analysis} />
                {:else if activeTab === 'character-deep-dive'}
                    <CharacterDeepDiveAnalysis {analysis} {pieChartData} />
                {:else if activeTab === 'story-structure'}
                    <StoryStructureAnalysis {analysis} />

                {:else if activeTab === 'goals'}
                    <GoalsAnalysis />
                {/if}
            {:else}
                <p>분석할 스토리가 없습니다.</p>
            {/if}
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.6);
        display: flex; justify-content: center; align-items: center;
        z-index: 2000;
    }
    .modal-content {
        background-color: var(--primary-bg);
        border-radius: var(--border-radius);
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        width: 900px;
        max-width: 90%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
    }
    .modal-header h2 { margin: 0; }
    .close-btn { background: none; border: none; color: var(--text-color); cursor: pointer; padding: 5px; }

    .tab-navigation {
        display: flex;
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
    }
    .tab-btn {
        flex: 1 0 auto; /* MIMINYAN: Allow shrinking but prevent wrapping */
        padding: 12px 15px;
        background: none;
        border: none;
        color: var(--text-color-muted);
        cursor: pointer;
        font-size: 0.95em;
        border-bottom: 2px solid transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s ease;
        white-space: nowrap; /* MIMINYAN: Prevent text wrapping */
    }
    .tab-btn:hover {
        color: var(--text-color);
    }
    .tab-btn.active {
        color: var(--accent-color);
        border-bottom-color: var(--accent-color);
        font-weight: 600;
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex-grow: 1;
    }
    .grid-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
    }
    .stat-card {
        background-color: var(--secondary-bg);
        border-radius: var(--border-radius);
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    .stat-card h3 {
        margin-top: 0;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 10px;
        margin-bottom: 15px;
    }
    .stat-card ul {
        padding-left: 20px;
        margin: 0;
    }
    .stat-card li {
        margin-bottom: 10px;
    }
</style>
