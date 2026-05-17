<script>
    import { projectActions, searchQuery, commandPalette, theme, uiState, activeStory, notifications } from './stores.js';
    import { tick } from 'svelte';
    import Icon from './Icon.svelte';
    import SearchResults from './SearchResults.svelte';
    import Dropdown from './Dropdown.svelte';

    let showResults = false;
    searchQuery.subscribe(value => {
        showResults = value.trim().length > 0;
    });

    let showSettingsDropdown = false;
    let showViewDropdown = false; // MIMINYAN: Add state for the new dropdown
    let isSearchActive = false;
    let searchInput;

    function handleFocus() {
        if ($searchQuery.trim().length > 0) {
            showResults = true;
        }
    }

    function handleBlur() {
        // Use a timeout to allow click events on search results to register
        setTimeout(() => {
            showResults = false;
        }, 200);
    }

    // --- Electron environment detection ---
    let isElectron = false;
    if (window.electronAPI) {
        isElectron = true;
    }
</script>

<header class:search-active={isSearchActive && $uiState.isMobileView}>
    <div class="header-left">
        <button class="mobile-nav-btn" on:click={() => uiState.toggleSidebar()}>
            <Icon name="menu" size={24} />
        </button>
        <div class="logo">
            <Icon name="feather" size={24} color="var(--accent-color)" />
            <h1>StoryWeaver</h1>
        </div>
        <div class="main-controls">
            <button class="header-btn" on:click={() => projectActions.openProjectModal()}>
                <Icon name="folder" size={16} />
                <span>프로젝트</span>
            </button>
            <div class="divider-vertical"></div>
            {#if !isElectron}
            <button class="icon-btn" on:click={() => projectActions.loadProjectFromFile()} title="불러오기">
                <Icon name="upload" size={18} />
            </button>
            <button class="icon-btn" on:click={() => projectActions.saveProject()} title="저장">
                <Icon name="save" size={18} />
            </button>
            {/if}
            <button class="icon-btn" on:click={() => projectActions.exportProjectData()} title="내보내기">
                <Icon name="download" size={18} />
            </button>
        </div>
    </div>

    <div class="header-right">
        {#if $uiState.isMobileView}
            <!-- Mobile View Logic Kept As Is -->
            {#if isSearchActive}
                <div class="search-wrapper active">
                    <button class="icon-btn" on:click={() => isSearchActive = false}>
                        <Icon name="arrow-left" size={18} />
                    </button>
                    <input
                        type="text"
                        placeholder="검색..."
                        bind:value={$searchQuery}
                        on:focus={handleFocus}
                        on:blur={handleBlur}
                        bind:this={searchInput}
                    />
                    {#if showResults}
                        <SearchResults />
                    {/if}
                </div>
            {:else}
                <button class="icon-btn" on:click={async () => { isSearchActive = true; await tick(); searchInput.focus(); }}>
                    <Icon name="search" size={18} />
                </button>
                <Dropdown bind:show={showSettingsDropdown} on:close={() => showSettingsDropdown = false}>
                     <!-- Mobile Dropdown Content -->
                    <button class="icon-btn" slot="trigger" on:click={() => showSettingsDropdown = !showSettingsDropdown}>
                        <Icon name="more-vertical" size={18} />
                    </button>
                    <div slot="menu">
                        <div class="menu-label">프로젝트</div>
                        <button class="menu-item" on:click={() => { projectActions.openProjectModal(); showSettingsDropdown = false; }}>
                            <Icon name="folder" size={16} /> <span>프로젝트 관리</span>
                        </button>
                        {#if !isElectron}
                        <button class="menu-item" on:click={() => { projectActions.loadProjectFromFile(); showSettingsDropdown = false; }}>
                            <Icon name="upload" size={16} /> <span>불러오기</span>
                        </button>
                        <button class="menu-item" on:click={() => { projectActions.saveProject(); showSettingsDropdown = false; }}>
                            <Icon name="save" size={16} /> <span>저장</span>
                        </button>
                        {/if}
                        <button class="menu-item" on:click={() => { projectActions.exportProjectData(); showSettingsDropdown = false; }}>
                            <Icon name="download" size={16} /> <span>내보내기</span>
                        </button>
                        
                        <div class="menu-separator"></div>
                        <div class="menu-label">도구 및 보기</div>
                        <button class="menu-item" on:click={() => { uiState.openWikiModal(); showSettingsDropdown = false; }}>
                            <Icon name="book-open" size={16} /> <span>위키</span>
                        </button>
                        <button class="menu-item" on:click={() => { uiState.openAnalyticsModal(); showSettingsDropdown = false; }}>
                            <Icon name="bar-chart-2" size={16} /> <span>분석</span>
                        </button>
                         <button class="menu-item" on:click={() => { uiState.openGoalSettingModal(); showSettingsDropdown = false; }}>
                            <Icon name="target" size={16} /> <span>목표</span>
                        </button>
                        <button class="menu-item" on:click={() => { theme.toggleTheme(); showSettingsDropdown = false; }}>
                            <Icon name={$theme === 'dark' ? 'sun' : 'moon'} size={16} /> <span>테마 변경</span>
                        </button>
                    </div>
                </Dropdown>
            {/if}
        {:else}
            <!-- Desktop View -->
            <div class="search-wrapper">
                <Icon name="search" size={16} />
                <input
                    type="text"
                    placeholder="검색 (Ctrl+K)"
                    bind:value={$searchQuery}
                    on:focus={handleFocus}
                    on:blur={handleBlur}
                />
                {#if showResults}
                    <SearchResults />
                {/if}
            </div>

            <div class="divider-vertical"></div>

            <div class="control-group">
                <button class="header-toggle-btn" class:active={$uiState.currentView === 'canvas'} on:click={() => uiState.setView('canvas')} title="캔버스 뷰">
                    <Icon name="grid" size={18} />
                </button>
                <button class="header-toggle-btn" class:active={$uiState.currentView === 'map'} on:click={() => uiState.setView('map')} title="월드 맵 뷰">
                    <Icon name="globe" size={18} />
                </button>
                <button class="header-toggle-btn" class:active={$uiState.currentView === 'timeline'} on:click={() => uiState.setView('timeline')} title="타임라인 뷰">
                    <Icon name="git-branch" size={18} />
                </button>
            </div>

            <div class="divider-vertical"></div>

            <div class="control-group">
                <button 
                    class="icon-btn" 
                    on:click={() => uiState.openCharacterSheet()} 
                    title="캐릭터 스튜디오"
                >
                    <Icon name="users" size={18} />
                </button>
                <button class="icon-btn" on:click={() => uiState.openWikiModal()} title="위키">
                    <Icon name="book-open" size={18} />
                </button>
                <button class="icon-btn" on:click={() => uiState.openAnalyticsModal()} title="분석">
                    <Icon name="bar-chart-2" size={18} />
                </button>
            </div>

            <div class="control-group">
                <button class="icon-btn" on:click={() => theme.toggleTheme()} title="테마 변경">
                    <Icon name={$theme === 'dark' ? 'sun' : 'moon'} size={18} />
                </button>
                <Dropdown bind:show={showSettingsDropdown} on:close={() => showSettingsDropdown = false}>
                    <button class="icon-btn" slot="trigger" on:click={() => showSettingsDropdown = !showSettingsDropdown}>
                        <Icon name="settings" size={18} />
                    </button>
                    <!-- Settings Menu Content -->
                    <div slot="menu">
                         <div class="menu-label">도구</div>
                        <button class="menu-item" on:click={() => { commandPalette.open(); showSettingsDropdown = false; }}>
                            <Icon name="command" size={16} />
                            <span>명령어 팔레트</span>
                        </button>
                        <button class="menu-item" on:click={() => { uiState.openAnnotationManager(); showSettingsDropdown = false; }}>
                            <Icon name="message-square" size={16} />
                            <span>주석 관리</span>
                        </button>
                        <button class="menu-item" on:click={() => { uiState.openGuideModal(); showSettingsDropdown = false; }}>
                            <Icon name="help-circle" size={16} />
                            <span>도움말 / 가이드</span>
                        </button>
                        <div class="menu-separator"></div>
                        <div class="menu-label">보기 설정</div>
                        <button class="menu-item" on:click={() => uiState.toggleWidget('customization')}>
                            <Icon name={$uiState.widgets.customization.visible ? 'check-square' : 'square'} size={16} />
                            <span>꾸미기 팔레트</span>
                        </button>
                        <button class="menu-item" on:click={() => uiState.toggleWidget('variables')}>
                            <Icon name={$uiState.widgets.variables.visible ? 'check-square' : 'square'} size={16} />
                            <span>변수 팔레트</span>
                        </button>
                    </div>
                </Dropdown>
            </div>
        {/if}
    </div>
</header>

<style>
    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px;
        height: 56px;
        background-color: var(--header-bg);
        border-bottom: 1px solid var(--border-color);
        width: 100%;
        box-sizing: border-box;
        flex-shrink: 0;
        z-index: 100;
        /* Glassmorphism effect */
        backdrop-filter: blur(10px);
        background-color: color-mix(in srgb, var(--header-bg) 95%, transparent);
    }
    
    .divider-vertical {
        width: 1px;
        height: 24px;
        background-color: var(--border-color);
        margin: 0 8px;
    }

    .control-group {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    header.search-active .header-left,
    header.search-active .header-right > *:not(.search-wrapper) {
        display: none;
    }
    header.search-active .search-wrapper {
        width: 100%;
    }
    header.search-active .search-wrapper input {
        width: 100%;
    }

    .search-wrapper.active {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .search-wrapper.active input {
        flex-grow: 1;
        border: none !important;
        padding-left: 0 !important;
        box-shadow: none !important;
    }

    .mobile-nav-btn {
        display: none; /* Hidden by default */
        background: none;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        padding: 0;
        margin-right: 16px;
    }

    .header-left, .header-right, .main-controls {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .logo {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-right: 12px;
    }

    .logo h1 {
        font-size: 1.15em;
        font-weight: 700;
        margin: 0;
        letter-spacing: -0.5px;
        color: var(--text-color);
    }

    .header-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background-color: transparent;
        border: 1px solid transparent;
        color: var(--text-color);
        padding: 6px 12px;
        border-radius: var(--border-radius);
        cursor: pointer;
        font-size: 0.9em;
        font-weight: 500;
        transition: all var(--transition-speed);
    }

    .header-btn:hover {
        background-color: var(--primary-bg);
        color: var(--accent-color);
    }
    
    .header-toggle-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: var(--text-color-muted);
        width: 32px;
        height: 32px;
        border-radius: var(--border-radius);
        cursor: pointer;
        transition: all 0.2s;
    }
    .header-toggle-btn:hover {
        background-color: var(--primary-bg);
        color: var(--text-color);
    }
    .header-toggle-btn.active {
        background-color: color-mix(in srgb, var(--accent-color) 10%, transparent);
        color: var(--accent-color);
    }


    :global(.check-icon) {
        margin-left: auto;
        color: var(--accent-color);
    }

    .search-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        color: var(--text-color-muted);
    }

    .search-wrapper :global(.icon-wrapper) {
        position: absolute;
        left: 10px;
        pointer-events: none;
    }

    .search-wrapper input {
        background-color: var(--primary-bg);
        border: 1px solid transparent;
        border-radius: 20px; /* Rounded search bar */
        padding: 6px 12px 6px 34px;
        width: 220px;
        color: var(--text-color);
        font-size: 0.9em;
        transition: all var(--transition-speed);
    }

    .search-wrapper input:focus {
        outline: none;
        background-color: var(--secondary-bg);
        border-color: var(--accent-color);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 10%, transparent);
        width: 280px; /* Expand on focus */
    }

    .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background-color: transparent;
        border: 1px solid transparent;
        color: var(--text-color-muted);
        width: 32px;
        height: 32px;
        padding: 0;
        border-radius: var(--border-radius);
        cursor: pointer;
        transition: all var(--transition-speed);
    }

    .icon-btn:hover {
        background-color: var(--primary-bg);
        color: var(--accent-color);
    }

    .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px 12px;
        background: none;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        text-align: left;
        border-radius: 4px;
        font-size: 0.9em;
    }
    .menu-item:hover {
        background-color: var(--primary-bg);
        color: var(--accent-color);
    }
    .menu-separator {
        height: 1px;
        background-color: var(--border-color);
        margin: 4px 0;
    }
    .menu-label {
        font-size: 0.75em;
        padding: 4px 12px;
        color: var(--text-color-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    @media (max-width: 768px) {
        .main-controls {
            display: none;
        }
        .mobile-nav-btn {
            display: block;
        }
        .logo h1 {
            display: none;
        }
        .search-wrapper input {
            width: 150px;
        }
        header {
            padding: 0 16px;
        }
    }
</style>
