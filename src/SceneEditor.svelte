<script>
    import { projectActions, uiState, confirmation } from './stores.js';
    import { getContrastColor } from './utils.js';
    import VariablePalette from './VariablePalette.svelte';
    import CollapsibleSection from './CollapsibleSection.svelte';
    import Icon from './Icon.svelte';
    import CharacterPalette from './CharacterPalette.svelte';
    import CustomizationPalette from './CustomizationPalette.svelte';
    import DialoguesEditor from './DialoguesEditor.svelte';
    import ChoicesEditor from './ChoicesEditor.svelte';
    
    export let scene; // This scene object is passed from App.svelte
    export let story; // The entire story object for the active project

    let activeTab = 'script'; // 'script' or 'setup'

    // --- SCENE ACTIONS ---
    function updateSceneName(event, record) {
        projectActions.updateScene(scene.id, { name: event.target.value }, record);
    }

    function handleRemoveScene() {
        confirmation.prompt(
            `정말로 "${scene.name}" 씬을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
            () => {
                projectActions.removeScene(scene.id);
            }
        );
    }

    $: allWikiItems = story ? [
        ...(story.characters || []).map(c => ({...c, type: 'character', _label: c.name})),
        ...(story.locations || []).map(i => ({...i, type: 'location', _label: i.name})),
        ...(story.items || []).map(i => ({...i, type: 'item', _label: i.name})),
        ...(story.groups || []).map(i => ({...i, type: 'group', _label: i.name})),
        ...(story.dictionary || []).map(d => ({...d, type: 'lore', _label: d.term})),
        ...(story.history?.events || []).map(e => ({...e, type: 'history', _label: e.title}))
    ] : [];
</script>

<div class="scene-editor-layout">
<div class="scene-editor" class:isFocusMode={$uiState.isFocusMode}>
    {#if scene && story}
        <div class="editor-sticky-group">
            <div class="editor-header">
                <input 
                    type="text" 
                    class="scene-name-input" 
                    value={scene.name} 
                    on:change={(e) => {
                        updateSceneName(e, false);
                        projectActions.commitHistory();
                    }}
                    placeholder="씬 이름"
                />
                <button 
                    class="icon-btn" 
                    class:active={story?.linkingState?.active && story?.linkingState?.sourceSceneId === scene.id}
                    on:click={() => {
                        if (story?.linkingState?.active && story?.linkingState?.sourceSceneId === scene.id) {
                            projectActions.cancelLinking();
                        } else {
                            projectActions.startLinking(scene.id, null, 'scene');
                        }
                    }} 
                    title={story?.linkingState?.active && story?.linkingState?.sourceSceneId === scene.id ? "연결을 취소합니다" : "다른 씬으로 연결합니다"}
                >
                    <Icon name="link" size={18} />
                </button>
                <button class="icon-btn danger" on:click={handleRemoveScene} title="이 씬을 삭제합니다">
                    <Icon name="trash-2" size={18} />
                </button>
            </div>
            
            {#if !$uiState.isFocusMode}
            <div class="scene-tabs">
                <button 
                    class="tab-btn" 
                    class:active={activeTab === 'script'} 
                    on:click={() => activeTab = 'script'}
                >
                    <Icon name="edit-2" size={14} />
                    <span>대본 작성</span>
                </button>
                <button 
                    class="tab-btn" 
                    class:active={activeTab === 'setup'} 
                    on:click={() => activeTab = 'setup'}
                >
                    <Icon name="sliders" size={14} />
                    <span>설정 및 도구</span>
                </button>
            </div>
            {/if}
        </div>
        
        <div class="tab-content" class:script-tab={activeTab === 'script'}>
            <!-- SETUP TAB -->
            {#if activeTab === 'setup' && !$uiState.isFocusMode}
                <span class="scene-id">ID: {scene.id}</span>

                <div class="plot-threads-panel">
                    <div class="panel-header-row">
                        <h4><Icon name="git-merge" size={16}/> 플롯 스레드</h4>
                        <div class="add-tag-wrapper">
                            <button class="add-thread-text-btn" on:click={(e) => { 
                                const menu = e.currentTarget.nextElementSibling;
                                menu.hidden = !menu.hidden;
                            }}>
                                <Icon name="plus" size={12} /> 연결
                            </button>
                            <div class="dropdown-menu" hidden>
                                {#each (story.plotThreads || []) as thread}
                                    <button 
                                        class="menu-item"
                                        on:click={() => {
                                            projectActions.toggleScenePlotThread(scene.id, thread.id);
                                        }}
                                    >
                                        <Icon name={(scene.plotThreadIds || []).includes(thread.id) ? 'check-square' : 'square'} size={16} />
                                        <div class="thread-color-dot" style="background-color: {thread.color}"></div>
                                        <span class="menu-thread-name" style="font-weight: bold;">
                                            {thread.name}
                                        </span>
                                    </button>
                                {/each}
                                {#if (story.plotThreads || []).length === 0}
                                    <div class="empty-menu-msg">생성된 플롯 스레드가 없습니다.</div>
                                {/if}
                            </div>
                        </div>
                    </div>
                    
                    <div class="tags-container">
                        {#each (story.plotThreads || []).filter(pt => (scene.plotThreadIds || []).includes(pt.id)) as thread}
                            <span class="tag" style="background-color: {thread.color};">
                                {thread.name}
                                <button on:click={() => projectActions.toggleScenePlotThread(scene.id, thread.id)}>
                                    <Icon name="x" size={12} />
                                </button>
                            </span>
                        {/each}
                        {#if (scene.plotThreadIds || []).length === 0}
                            <span class="empty-threads-text">연결된 플롯이 없습니다.</span>
                        {/if}
                    </div>
                </div>

                {#if $uiState.widgets.customization.visible}
                    <CollapsibleSection 
                        widgetId="customization"
                        isOpen={!$uiState.widgets.customization.collapsed} 
                        on:toggle={() => uiState.toggleWidgetCollapsed('customization')}
                    >
                        <span slot="header">꾸미기</span>
                        <div slot="body">
                            <CustomizationPalette {scene} />
                        </div>
                    </CollapsibleSection>
                {/if}

                {#if $uiState.widgets.variables.visible}
                    <CollapsibleSection 
                        widgetId="variables"
                        isOpen={!$uiState.widgets.variables.collapsed} 
                        on:toggle={() => uiState.toggleWidgetCollapsed('variables')}
                        helpText="'호감도' 같은 숫자 변수나 '열쇠획득' 같은 참/거짓 변수를 만들어 스토리 분기에 사용할 수 있습니다. 선택지의 '조건'이나 '액션'에서 이 변수들을 활용하세요."
                    >
                        <span slot="header">변수 팔레트</span>
                        <div slot="body">
                            <VariablePalette {story} />
                        </div>
                    </CollapsibleSection>
                {/if}
            {/if}

            <!-- SCRIPT TAB (Also shown in Focus Mode regardless of tab selection) -->
            {#if activeTab === 'script' || $uiState.isFocusMode}
                <div class="script-editor-wrapper">
                    <div class="script-section">
                        {#if !$uiState.isFocusMode}
                        <div class="section-header-simple">
                            <span>대사 및 이벤트</span>
                            <button class="icon-btn" on:click={uiState.toggleFocusMode} title="집중 모드">
                                <Icon name="maximize-2" size={16} />
                            </button>
                        </div>
                        {:else}
                        <div class="focus-mode-exit-btn">
                             <button class="icon-btn" on:click={uiState.toggleFocusMode} title="집중 모드 종료">
                                <Icon name="minimize-2" size={16} />
                            </button>
                        </div>
                        {/if}
                        <DialoguesEditor {scene} {story} />
                    </div>
                    
                    <div class="choices-section">
                        {#if !$uiState.isFocusMode}
                        <div class="section-header-simple">
                            <span>선택지</span>
                        </div>
                        {/if}
                        <ChoicesEditor {scene} {story} />
                    </div>
                </div>
            {/if}
        </div>

    {:else}
        <div class="no-scene-placeholder">
            <Icon name="mouse-pointer" size={48} color="var(--text-color-muted)" />
            <p>캔버스에서 장면을 선택하거나,<br/>빈 공간을 더블클릭하여 새 장면을 만드세요.</p>
        </div>
    {/if}
</div>
</div>

<style>
    .scene-editor-layout {
        display: flex; width: 100%; height: 100%; overflow: hidden;
    }
    .scene-editor { flex: 1; min-width: 0; }
    
    .scene-editor { padding: 0; background-color: var(--sidebar-bg); height: 100%; overflow-y: auto; box-sizing: border-box; display: flex; flex-direction: column; }
    
    .editor-sticky-group {
        position: sticky;
        top: 0;
        z-index: 30;
        background-color: var(--sidebar-bg);
    }

    .editor-header { 
        display: flex; align-items: center; padding: 20px 8px 10px 8px; 
    }
    .scene-tabs {
        display: flex; gap: 5px; padding: 0 8px; margin-bottom: 0; 
        border-bottom: 1px solid var(--border-color);
    }
    
    .tab-content {
        padding: 15px 8px 20px 8px;
        flex: 1;
    }

    .scene-name-input {
        flex-grow: 1;
        flex-shrink: 1; /* Allow the input to shrink */
        min-width: 0; /* Allow shrinking below the content's intrinsic width */
        margin-right: 8px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--text-color);
        font-size: 1.4em;
        font-weight: 600;
        padding: 4px 0;
        transition: border-color var(--transition-speed);
    }
    .scene-name-input:focus {
        outline: none;
        border-bottom-color: var(--accent-color);
    }
    .scene-id { font-size: 0.8em; color: var(--text-color-muted); display: block; margin-bottom: 10px; }

    /* Tabs */
    .tab-btn {
        flex: 1;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        background: none; border: none; border-bottom: 2px solid transparent;
        padding: 10px; color: var(--text-color-muted); cursor: pointer;
        font-size: 0.9em; font-weight: 500;
        transition: all 0.2s;
    }
    .tab-btn:hover { color: var(--text-color); background-color: rgba(255,255,255,0.03); }
    .tab-btn.active { color: var(--accent-color); border-bottom-color: var(--accent-color); background-color: rgba(255,255,255,0.05); }

    /* Sections */
    .section-header-simple {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 0; margin-bottom: 5px;
        font-weight: bold; color: var(--text-color); border-bottom: 1px dashed var(--border-color);
    }
    .script-section, .choices-section { margin-bottom: 30px; }

    /* Plot Threads - Shared Styles */
    .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: var(--border-radius-sm);
        font-size: 0.85em;
        color: #fff;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.4);
    }
    .tag button {
        background: none;
        border: none;
        color: #fff;
        padding: 0;
        margin: 0;
        cursor: pointer;
        opacity: 0.7;
    }
    .tag button:hover {
        opacity: 1;
    }
    .add-tag-wrapper {
        position: relative;
    }
    .dropdown-menu {
        position: absolute;
        right: 0;
        top: 100%;
        margin-top: 5px;
        background-color: var(--sidebar-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: 5px;
        z-index: 100; /* Increased z-index to ensure it floats above other elements */
        width: 200px;
        box-shadow: var(--box-shadow-lg);
    }
    .menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px;
        background: none;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        text-align: left;
        border-radius: 4px;
    }
    .menu-item:hover {
        background-color: var(--primary-bg);
    }

    .icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        background-color: transparent; border: 1px solid var(--border-color);
        color: var(--text-color-muted); width: 36px; height: 36px;
        padding: 0; border-radius: var(--border-radius); cursor: pointer;
        transition: all var(--transition-speed);
    }
    .icon-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
    .icon-btn.danger:hover { border-color: var(--danger-color); color: var(--danger-color); }

    .no-scene-placeholder {
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        height: 100%; text-align: center; color: var(--text-color-muted);
    }
    .no-scene-placeholder p { margin-top: 16px; }

    /* --- Focus Mode Specific Styles --- */
    .scene-editor.isFocusMode { 
        padding: 20px 0;
        max-width: 1000px;
        margin: 0 auto;
        width: 100%;
    }
    /* Hide header elements in focus mode except for exit button */
    .isFocusMode .editor-header,
    .isFocusMode .scene-id,
    .isFocusMode .plot-threads-panel {
        display: none;
    }
    
    .focus-mode-exit-btn {
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 1000;
    }
    .focus-mode-exit-btn .icon-btn {
        width: 50px; height: 50px;
        background-color: var(--sidebar-bg);
        border: 1px solid var(--accent-color);
        color: var(--accent-color);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border-radius: 50%;
        transition: transform 0.2s, background-color 0.2s;
    }
    .focus-mode-exit-btn .icon-btn:hover {
        transform: scale(1.1);
        background-color: var(--accent-color);
        color: white;
    }

    /* Plot Threads Panel Redesign */
    .plot-threads-panel {
        background-color: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: 12px;
        margin-bottom: 20px;
    }
    .panel-header-row {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px dashed var(--border-color);
    }
    .panel-header-row h4 {
        margin: 0; font-size: 1em; color: var(--text-color);
        display: flex; align-items: center; gap: 6px;
    }
    .add-thread-text-btn {
        background: none; border: 1px solid var(--border-color);
        color: var(--text-color-muted); border-radius: 12px;
        padding: 2px 8px; font-size: 0.85em; cursor: pointer;
        display: flex; align-items: center; gap: 4px;
        transition: all 0.2s;
    }
    .add-thread-text-btn:hover {
        border-color: var(--accent-color); color: var(--accent-color);
        background-color: rgba(var(--accent-rgb), 0.05);
    }
    .empty-threads-text {
        font-size: 0.85em; color: var(--text-color-muted); font-style: italic; opacity: 0.7;
    }
    .empty-menu-msg { padding: 10px; text-align: center; color: var(--text-color-muted); font-size: 0.8em; }

    .thread-color-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .menu-thread-name {
        font-size: 0.9em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>