<script>
    import { projectActions, uiState, notifications, confirmation } from './stores.js';
    import Icon from './Icon.svelte';

    export let story;
    export let selectedSceneId; // Needed to add dialogue to the correct scene

    let tagFilter = '';
    let sortMode = 'favorite'; // favorite, name, dialogue, recent
    let isSortMenuOpen = false;

    const sortOptions = [
        { id: 'favorite', label: '즐겨찾기순', icon: 'star' },
        { id: 'name', label: '이름순', icon: 'type' },
        { id: 'dialogue', label: '대사량순', icon: 'message-circle' },
        { id: 'recent', label: '최신순', icon: 'clock' }
    ];

    function toggleSortMenu() {
        isSortMenuOpen = !isSortMenuOpen;
    }

    function setSortMode(mode) {
        sortMode = mode;
        isSortMenuOpen = false;
    }

    // Helper to get dialogue count (simple approximation)
    function getDialogueCount(charName) {
        if (!story || !story.scenes) return 0;
        let count = 0;
        Object.values(story.scenes).forEach(scene => {
            scene.content.forEach(item => {
                if (item.type === 'dialogue' && item.character === charName) {
                    count++;
                }
            });
        });
        return count;
    }

    function addDialogue(characterName = '') {
        if (selectedSceneId) {
            projectActions.addDialogue(selectedSceneId, characterName);
        } else {
            notifications.add('대사를 추가할 씬을 먼저 선택해주세요.', 'warning');
        }
    }

    $: groupedCharacters = {};
    $: categoryOrder = [];

    $: if (story && story.characters) {
        let filteredCharacters = story.characters.filter(char => {
            const filterText = tagFilter.toLowerCase();
            if (!filterText) return true;

            const nameMatch = char.name.toLowerCase().includes(filterText);
            const tagMatch = char.tags && char.tags.some(tag => tag.toLowerCase().includes(filterText));

            return nameMatch || tagMatch;
        });

        // Apply Sorting
        filteredCharacters.sort((a, b) => {
            if (sortMode === 'favorite') {
                if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
                return a.name.localeCompare(b.name);
            } else if (sortMode === 'name') {
                return a.name.localeCompare(b.name);
            } else if (sortMode === 'dialogue') {
                const countA = getDialogueCount(a.name);
                const countB = getDialogueCount(b.name);
                if (countA !== countB) return countB - countA;
                return a.name.localeCompare(b.name);
            } else if (sortMode === 'recent') {
                // Assuming newer characters have larger/later created IDs or are appended later.
                // If we tracked creationDate it would be better, but ID/index proxy is okay-ish or just array order (if not re-sorted)
                // Actually, projectActions.addNewCharacter pushes to end, so index is proxy for time if not reordered.
                // But we don't have original index here easily after filter.
                // Let's use sortOrder if available, or just rely on ID timestamp if present.
                // Our IDs are `char_TIMESTAMP_RANDOM`.
                const timeA = parseInt(a.id.split('_')[1]) || 0;
                const timeB = parseInt(b.id.split('_')[1]) || 0;
                return timeB - timeA;
            }
            return 0;
        });

        const groups = {};
        // Initialize with all known categories to maintain order
        story.characterCategories.forEach(cat => {
            groups[cat] = [];
        });
        groups['미분류'] = []; // Default for uncategorized

        filteredCharacters.forEach(char => {
            const category = char.category || '미분류';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(char);
        });
        
        groupedCharacters = groups;
        
        // MIMINYAN: Ensure orphan categories (not in the official list) are also displayed
        const knownCategories = new Set(story.characterCategories);
        const orphanCategories = Object.keys(groups).filter(cat => !knownCategories.has(cat) && cat !== '미분류');
        
        categoryOrder = [...story.characterCategories, ...orphanCategories, '미분류'];
    }
</script>

<div class="character-palette-wrapper">
    <div class="filter-controls">
        <div class="input-with-icon">
            <Icon name="search" size={28} />
            <input type="text" bind:value={tagFilter} placeholder="이름 또는 태그로 검색..." />
        </div>
    </div>
    
    <!-- New Studio Button -->
    <button class="studio-btn" on:click={() => uiState.openCharacterSheet()}>
        <Icon name="users" size={16} />
        <span>캐릭터 스튜디오 열기</span>
    </button>

    <div class="palette-controls">
        <button class="subtle-btn" on:click={() => projectActions.addNewCharacter()} title="새 등장인물을 목록에 추가합니다">
            <Icon name="user-plus" size={14} />
            <span>추가</span>
        </button>
        <div class="sort-menu-container">
            <button class="subtle-btn sort-trigger" on:click={toggleSortMenu} title="정렬 기준 변경">
                <Icon name="list" size={14} />
                <span>{sortOptions.find(o => o.id === sortMode).label}</span>
            </button>
            {#if isSortMenuOpen}
                <div class="sort-dropdown">
                    {#each sortOptions as option}
                        <button class="sort-option" class:selected={sortMode === option.id} on:click={() => setSortMode(option.id)}>
                            <Icon name={option.icon} size={14} />
                            <span>{option.label}</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
        <button 
            class="subtle-btn icon-only" 
            on:click={() => confirmation.prompt(
                '대화에 사용되지 않는 모든 등장인물을 목록에서 삭제합니다. 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?',
                projectActions.cleanupCharacters
            )} 
            title="사용하지 않는 등장인물을 목록에서 정리합니다"
        >
            <Icon name="wind" size={14} />
        </button>
    </div>
    <div class="character-palette-grid">
        {#if story.characters.length > 0}
            {#each categoryOrder as category (category)}
                {@const characters = groupedCharacters[category]}
                {#if characters && characters.length > 0}
                    <div class="category-group">
                        <h4 class="category-header">{category}</h4>
                        <div class="character-palette">
                            {#each characters as character (character.id)}
                                <div 
                                    class="char-tag" 
                                    style="border-left-color: {character.color};"
                                >
                                    <input 
                                        type="color" 
                                        class="char-color-picker" 
                                        value={character.color} 
                                        on:input={(e) => projectActions.updateCharacter(character.id, { color: e.target.value })}
                                        title="캐릭터 색상 변경"
                                    />
                                    <button class="char-btn" on:click={() => addDialogue(character.name)} title="{character.name}(으)로 새 대사 추가">
                                        {character.name}
                                    </button>
                                    <button class="char-edit-btn" on:click={() => uiState.openCharacterSheet(character.id)} title="{character.name} 정보 편집">
                                        <Icon name="edit" size={14} />
                                    </button>
                                    <button class="char-delete-btn" on:click={() => projectActions.removeCharacter(character.id)} title="{character.name}을(를) 목록에서 삭제">
                                        <Icon name="x" size={14} />
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            {/each}
        {:else}
            <p class="no-characters-msg">
                대사 편집기에서 <code>인물: 대사</code> 형식으로 입력하면<br/>등장인물이 자동으로 이곳에 추가됩니다.
            </p>
        {/if}
    </div>
</div>

<style>
    .character-palette-wrapper {
        padding-top: 8px;
        max-height: 400px;
        overflow-y: auto;
    }
    
    /* Search Bar - Flat Style */
    .filter-controls {
        margin-bottom: 16px;
    }
    .input-with-icon {
        position: relative;
        display: flex;
        align-items: center;
        /* background-color: var(--secondary-bg); removed background */
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 4px;
        transition: border-color 0.2s;
    }
    .input-with-icon:focus-within {
        border-color: var(--accent-color);
    }
    .input-with-icon :global(svg) {
        margin-right: 8px;
        color: var(--text-color-muted);
        pointer-events: none;
    }
    .input-with-icon input {
        width: 100%;
        padding: 6px 0;
        background-color: transparent;
        border: none;
        color: var(--text-color);
        font-size: 0.95em;
    }
    .input-with-icon input:focus {
        outline: none;
    }

    .studio-btn {
        width: 100%;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        background-color: var(--accent-color);
        color: white;
        border: none;
        padding: 10px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        margin-bottom: 12px;
        transition: background-color 0.2s;
    }
    .studio-btn:hover {
        background-color: var(--accent-color-hover, #5bc0de);
    }

    .palette-controls {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
    }
    .subtle-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: none; border: 1px dashed var(--border-color);
        color: var(--text-color-muted); border-radius: 4px;
        cursor: pointer; padding: 6px 12px;
        transition: all 0.2s; font-size: 0.85em;
        flex: 1; justify-content: center;
        white-space: nowrap;
    }
    .subtle-btn:hover { color: var(--accent-color); border-color: var(--accent-color); background-color: rgba(var(--accent-rgb), 0.05); }
    .subtle-btn.icon-only { flex: 0; padding: 6px 8px; }

    .sort-menu-container {
        position: relative;
        flex: 1;
        display: flex;
    }
    .sort-trigger {
        width: 100%;
    }
    .sort-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        margin-top: 4px;
        background-color: var(--sidebar-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 100;
        overflow: hidden;
    }
    .sort-option {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: none;
        color: var(--text-color);
        font-size: 0.85em;
        cursor: pointer;
        text-align: left;
    }
    .sort-option:hover {
        background-color: var(--primary-bg);
    }
    .sort-option.selected {
        color: var(--accent-color);
        font-weight: bold;
        background-color: rgba(var(--accent-rgb), 0.05);
    }

    .character-palette-grid {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    .category-group {
        width: 100%;
    }
    .category-header {
        font-size: 0.8em;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-color-muted);
        margin: 0 0 10px 0;
        opacity: 0.7;
    }
    .character-palette { display: flex; flex-wrap: wrap; gap: 8px; }
    
    /* Character Chip Style */
    .char-tag { 
        display: flex; align-items: center; 
        background-color: transparent; 
        border: 1px solid var(--border-color); 
        border-left-width: 4px; /* Color indicator */
        border-radius: 4px; 
        overflow: hidden; 
        font-size: 0.9em;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .char-tag:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        background-color: rgba(255, 255, 255, 0.02);
    }

    .char-color-picker {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        background-color: transparent;
        border: none;
        cursor: pointer;
        margin: 0 4px 0 8px;
        opacity: 0.5; transition: opacity 0.2s;
    }
    .char-color-picker:hover { opacity: 1; }
    .char-color-picker::-webkit-color-swatch {
        border-radius: 50%;
        border: 1px solid rgba(0,0,0,0.2);
    }
    .char-color-picker::-moz-color-swatch {
        border-radius: 50%;
        border: 1px solid rgba(0,0,0,0.2);
    }
    
    .char-btn { 
        background: none; border: none; color: var(--text-color); 
        padding: 6px 10px; cursor: pointer; font-weight: 500;
        transition: all 0.2s; 
    }
    .char-btn:hover { color: var(--accent-color); }
    
    .char-edit-btn, .char-delete-btn {
        background: none; border: none; color: var(--text-color-muted); 
        cursor: pointer; padding: 6px 8px; 
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s; opacity: 0.6;
        border-left: 1px solid rgba(255, 255, 255, 0.05);
    }
    .char-edit-btn:hover { color: var(--text-color); opacity: 1; background-color: rgba(255, 255, 255, 0.05); }
    .char-delete-btn:hover { color: var(--danger-color); opacity: 1; background-color: rgba(255, 0, 0, 0.05); }

    .no-characters-msg {
        width: 100%;
        text-align: center;
        color: var(--text-color-muted);
        font-size: 0.9em;
        padding: 20px 0;
        border-top: 1px dashed var(--border-color);
        margin-top: 10px;
    }
    .no-characters-msg code {
        background-color: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
    }
</style>