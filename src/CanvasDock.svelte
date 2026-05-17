<script>
    import { uiState, activeStory, projectActions } from './stores.js';
    import Icon from './Icon.svelte';
    import { slide, fade } from 'svelte/transition';

    let isHovered = false;

    // --- Active States ---
    $: activePlotThreadId = $uiState.activeTaggingPlotThreadId;
    $: activeStorylineId = $uiState.storylineEditMode.storylineId;

    // --- Handlers ---
    function togglePlotMode(threadId) {
        uiState.togglePlotThreadTagMode(threadId);
    }

    function toggleStorylineMode(storylineId) {
        uiState.toggleStorylineEditMode(storylineId);
    }
</script>

<div 
    class="bottom-dock-container"
    class:hovered={isHovered}
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
>
    <div class="dock-content">
        
        <!-- SECTION 1: PLOT THREADS -->
        <div class="dock-section" title="플롯 스레드 관리: 씬에 플롯 태그를 지정하여 복합적인 이야기 구조를 추적합니다.">
            <div class="items-row">
                <div class="section-icon-wrapper">
                    <Icon name="git-merge" size={14} color="var(--text-color-muted)" />
                </div>
                {#each $activeStory?.plotThreads || [] as thread}
                    <button 
                        class="dock-chip plot-chip" 
                        class:active={activePlotThreadId === thread.id}
                        style="--thread-color: {thread.color};"
                        on:click={() => togglePlotMode(thread.id)}
                        title="{thread.name} 태깅"
                    >
                        <span class="color-dot"></span>
                        <span class="chip-label">{thread.name}</span>
                    </button>
                {/each}
                <button class="icon-btn-small" on:click={() => uiState.openPlotThreadModal()} title="플롯 관리">
                    <Icon name="settings" size={12} />
                </button>
            </div>
        </div>

        <div class="divider"></div>

        <!-- SECTION 2: STORYLINES -->
        <div class="dock-section" title="스토리라인 관리: 특정 경로를 따라가는 이야기의 흐름을 정의하고 검토합니다.">
            <div class="items-row">
                <div class="section-icon-wrapper">
                    <Icon name="layers" size={14} color="var(--text-color-muted)" />
                </div>
                {#each $activeStory?.storylines || [] as sl}
                    <div class="storyline-item-group">
                        <button 
                            class="dock-chip storyline-chip" 
                            class:active={activeStorylineId === sl.id}
                            on:click={() => toggleStorylineMode(sl.id)}
                            title="{sl.name} 편집"
                        >
                            <span class="chip-label">{sl.name}</span>
                        </button>
                        <button 
                            class="script-view-btn" 
                            on:click|stopPropagation={() => uiState.openStorylineScriptViewer(sl.id)}
                            title="대본 보기"
                        >
                            <Icon name="file-text" size={12} />
                        </button>
                    </div>
                {/each}
                <button class="icon-btn-small" on:click={() => {
                    uiState.prompt({
                        title: '새 스토리라인',
                        message: '이름 입력:',
                        onConfirm: (name) => projectActions.addStoryline(name)
                    });
                }} title="추가">
                    <Icon name="plus" size={12} />
                </button>
            </div>
        </div>

    </div>
</div>

<style>
    .bottom-dock-container {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 90;
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: all 0.3s ease;
        opacity: 0.6; /* Default transparent */
        max-width: 90%;
        width: auto;
    }

    @media (max-width: 768px) {
        .bottom-dock-container {
            opacity: 1; /* Always opaque on mobile */
            bottom: 10px;
            max-width: 95%;
            width: 95%; /* Take up more width */
            padding: 2px 0; /* Add slight vertical padding */
        }
        
        .dock-content {
            padding: 8px 12px;
            overflow-x: auto;
            width: 100%;
            -webkit-overflow-scrolling: touch;
            justify-content: flex-start; /* Align start to allow scrolling */
            display: flex;
            gap: 15px; /* Increase gap between sections */
        }

        .dock-section {
            flex-shrink: 0; /* Important: don't let sections shrink */
            display: flex;
            align-items: center;
        }

        .items-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0; /* Important: don't let rows shrink */
            white-space: nowrap; /* Prevent any internal wrapping */
        }
        
        /* Ensure chips don't wrap or squash */
        .dock-chip, .storyline-item-group {
            flex-shrink: 0;
        }

        /* --- Mobile Refinements --- */
        /* Hide decorative icons and divider to save space */
        .section-icon-wrapper, .divider {
            display: none;
        }

        /* Enlarge small icon buttons for touch */
        .icon-btn-small {
            width: 36px; height: 36px;
            background-color: var(--primary-bg); /* Add bg for better visibility */
            border-color: var(--border-color);
        }
        
        /* Enlarge chips and text */
        .dock-chip {
            padding: 6px 12px;
            font-size: 0.9em;
        }
        
        /* Make script view button larger */
        .script-view-btn {
            padding: 0 12px;
            min-width: 36px;
        }
        
        /* Adjust gap */
        .items-row {
            gap: 8px;
        }

        /* Hide scrollbar for a cleaner look but keep functionality */
        .dock-content::-webkit-scrollbar {
            display: none;
        }
        .dock-content {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
    }

    .bottom-dock-container:hover, 
    .bottom-dock-container.hovered,
    .bottom-dock-container:has(.active) { /* Keep visible if active item exists */
        opacity: 1;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        transform: translateX(-50%) translateY(-2px);
    }

    .dock-content {
        display: flex;
        padding: 8px 16px;
        gap: 12px;
        align-items: center;
    }

    .dock-section {
        display: flex;
        align-items: center;
    }

    .items-row {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .storyline-item-group {
        display: flex;
        align-items: center;
        background-color: var(--primary-bg);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        overflow: hidden;
        transition: border-color 0.2s;
    }
    .storyline-item-group:hover { border-color: var(--accent-color); }

    .divider {
        width: 1px;
        height: 20px;
        background-color: var(--border-color);
        margin: 0 4px;
    }

    /* Chip Styles */
    .dock-chip {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border-radius: 14px;
        border: 1px solid var(--border-color);
        background-color: var(--primary-bg);
        color: var(--text-color);
        font-size: 0.8em;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    }
    .storyline-item-group .dock-chip { border: none; border-radius: 0; padding-right: 4px; }

    .script-view-btn {
        background: transparent; border: none; border-left: 1px solid var(--border-color);
        padding: 4px 6px; cursor: pointer; color: var(--text-color-muted);
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s;
    }
    .script-view-btn:hover { color: var(--accent-color); background-color: rgba(0,0,0,0.03); }

    .dock-chip:hover {
        background-color: var(--secondary-bg);
        transform: translateY(-1px);
    }
    
    /* Plot Chip Active */
    .plot-chip .color-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background-color: var(--thread-color);
    }
    .plot-chip.active {
        background-color: var(--thread-color);
        color: white;
        border-color: var(--thread-color);
        font-weight: bold;
    }
    .plot-chip.active .color-dot { background-color: white; }

    /* Storyline Chip Active */
    .storyline-chip.active {
        background-color: var(--accent-color);
        color: white;
        font-weight: bold;
    }
    .storyline-chip.active + .script-view-btn { border-left-color: rgba(255,255,255,0.3); color: white; }

    .icon-btn-small {
        width: 22px; height: 22px;
        border-radius: 50%;
        border: 1px dashed var(--border-color);
        background: transparent;
        color: var(--text-color-muted);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s;
        margin-left: 2px;
    }
    .icon-btn-small:hover { border-color: var(--accent-color); color: var(--accent-color); }
</style>