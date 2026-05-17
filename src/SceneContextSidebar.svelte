<script>
    import { uiState, notifications, projectActions } from './stores.js';
    import Icon from './Icon.svelte';
    import { slide } from 'svelte/transition';
    import { getProfileImageStyle } from './utils.js';

    export let scene;
    export let story;

    let expandedItems = {}; // { itemId: boolean }
    let activeFilter = 'all'; // 'all', 'character', 'location', 'other'

    function toggleExpand(id) {
        expandedItems[id] = !expandedItems[id];
        expandedItems = { ...expandedItems };
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            notifications.add(`'${text}' 복사됨`, 'success', 1500);
        });
    }

    // Combine explicitly referenced items AND characters appearing in dialogues
    $: allContextItems = getContextItems(scene, story);
    $: filteredItems = filterItems(allContextItems, activeFilter);

    function filterItems(items, filter) {
        if (filter === 'all') return items;
        if (filter === 'character') return items.filter(i => i.type === 'character');
        if (filter === 'location') return items.filter(i => i.type === 'location');
        if (filter === 'other') return items.filter(i => i.type !== 'character' && i.type !== 'location');
        return items;
    }

    function getContextItems(scene, story) {
        if (!scene || !story) return [];

        const itemsMap = new Map();

        // 1. Referenced Wiki Items (Explicit)
        (scene.referencedWikiIds || []).forEach(refId => {
            const item = getWikiItemById(refId, story);
            if (item) itemsMap.set(item.id, { ...item, source: 'reference' });
        });

        // 2. Detected Characters in Dialogues (Speaking)
        (scene.content || []).forEach(dialogue => {
            if (dialogue.type === 'dialogue' && dialogue.character) {
                const charName = dialogue.character.trim();
                const character = story.characters.find(c => c.name === charName);
                if (character) {
                    if (!itemsMap.has(character.id)) {
                        itemsMap.set(character.id, { ...character, type: 'character', source: 'dialogue' });
                    }
                }
            }
        });

        // 3. Auto-Detect from Text Content (New Feature)
        const sceneText = (scene.content || [])
            .map(item => item.text || '')
            .join(' ')
            .toLowerCase();

        const checkAndAdd = (collection, type) => {
            if (!collection) return;
            collection.forEach(item => {
                if (itemsMap.has(item.id)) return;

                const name = (item.name || item.term || item.title || '').trim().toLowerCase();
                const aliases = (item.aliases || []).map(a => a.trim().toLowerCase()).filter(Boolean);
                
                let match = false;
                // Check main name
                if (name.length > 1 && sceneText.includes(name)) {
                    match = true;
                } 
                // Check aliases
                else if (aliases.length > 0) {
                    if (aliases.some(alias => alias.length > 1 && sceneText.includes(alias))) {
                        match = true;
                    }
                }

                if (match) {
                    // For history events, map title to name for consistency in UI
                    const entry = type === 'history' ? { ...item, name: item.title } : item;
                    itemsMap.set(item.id, { ...entry, type, source: 'text-match' });
                }
            });
        };

        checkAndAdd(story.characters, 'character');
        checkAndAdd(story.locations, 'location');
        checkAndAdd(story.items, 'item');
        checkAndAdd(story.groups, 'group');
        checkAndAdd(story.dictionary, 'lore');
        checkAndAdd(story.history?.events, 'history');

        // Convert map to array and sort
        return Array.from(itemsMap.values()).sort((a, b) => {
            // Characters first, then others
            if (a.type === 'character' && b.type !== 'character') return -1;
            if (a.type !== 'character' && b.type === 'character') return 1;
            return (a.name || a.term || '').localeCompare(b.name || b.term || '');
        });
    }

    function getWikiItemById(id, story) {
        if (!story) return null;
        let found = story.characters.find(c => c.id === id);
        if (found) return { ...found, type: 'character' };
        
        found = story.locations.find(i => i.id === id);
        if (found) return { ...found, type: 'location' };
        
        found = story.items.find(i => i.id === id);
        if (found) return { ...found, type: 'item' };
        
        found = story.groups.find(i => i.id === id);
        if (found) return { ...found, type: 'group' };
        
        found = story.dictionary.find(i => i.id === id);
        if (found) return { ...found, type: 'lore' };

        found = story.history?.events?.find(e => e.id === id);
        if (found) return { ...found, type: 'history', name: found.title }; 

        return null;
    }

    function getIconForType(type) {
        switch(type) {
            case 'character': return 'user';
            case 'location': return 'map-pin';
            case 'item': return 'package';
            case 'group': return 'users';
            case 'lore': return 'book';
            case 'history': return 'clock';
            default: return 'help-circle';
        }
    }

    function getLabelForType(type) {
        switch(type) {
            case 'character': return '인물';
            case 'location': return '장소';
            case 'item': return '사물';
            case 'group': return '단체';
            case 'lore': return '지식';
            case 'history': return '사건';
            default: return '기타';
        }
    }

    function jumpToLocationOnMap(wikiId) {
        const marker = (story.mapData?.markers || []).find(m => m.wikiId === wikiId);
        if (marker) {
            uiState.setView('map');
            // Center on marker with offset for sidebar
            // Shift target screen center to the left by 160px (approx half of sidebar width)
            // ensuring the marker appears in the visible area not covered by the sidebar.
            const centerX = window.innerWidth / 2 - 160; 
            const centerY = window.innerHeight / 2;
            const targetX = centerX - (marker.x * 1); // Assuming scale 1
            const targetY = centerY - (marker.y * 1);
            projectActions.updateViewTransform({ x: targetX, y: targetY, scale: 1 });
        } else {
            notifications.add('지도에 핀이 없는 장소입니다.', 'warning');
        }
    }
</script>

<div class="context-sidebar">
    <div class="sidebar-header">
        <Icon name="book-open" size={16} />
        <span>문맥 자료</span>
        <span class="count">{allContextItems.length}</span>
    </div>
    
    <div class="filter-tabs">
        <button class:active={activeFilter === 'all'} on:click={() => activeFilter = 'all'}>전체</button>
        <button class:active={activeFilter === 'character'} on:click={() => activeFilter = 'character'}>인물</button>
        <button class:active={activeFilter === 'location'} on:click={() => activeFilter = 'location'}>장소</button>
        <button class:active={activeFilter === 'other'} on:click={() => activeFilter = 'other'}>기타</button>
    </div>

    <div class="items-list">
        {#if filteredItems.length === 0}
            <div class="empty-state">
                표시할 항목이 없습니다.<br>
                <small class="muted">위키 태그를 추가하거나<br>대사를 작성해보세요.</small>
            </div>
        {/if}

        {#each filteredItems as item (item.id)}
            <div class="context-card" class:expanded={expandedItems[item.id]}>
                <div 
                    class="card-header" 
                    on:click={() => toggleExpand(item.id)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpand(item.id)}
                >
                    <div class="icon-wrapper" class:char={item.type === 'character'}>
                        {#if item.type === 'character' && item.profileImage}
                            <img src={item.profileImage} alt={item.name} class="char-thumb" />
                        {:else}
                            <Icon name={getIconForType(item.type)} size={16} />
                        {/if}
                    </div>
                    <div class="card-title">
                        <span class="name">{item.name || item.term}</span>
                        <span class="type-label">{getLabelForType(item.type)}</span>
                    </div>
                    <div class="card-actions">
                        {#if item.type === 'location' && (story.mapData?.markers || []).some(m => m.wikiId === item.id)}
                            <button 
                                class="action-btn" 
                                on:click|stopPropagation={() => jumpToLocationOnMap(item.id)}
                                title="지도에서 보기"
                            >
                                <Icon name="map-pin" size={14} />
                            </button>
                        {/if}
                        <button 
                            class="action-btn" 
                            on:click|stopPropagation={() => copyToClipboard(item.name || item.term)}
                            title="이름 복사"
                        >
                            <Icon name="copy" size={14} />
                        </button>
                        <button class="expand-btn">
                            <Icon name={expandedItems[item.id] ? 'chevron-up' : 'chevron-down'} size={14} />
                        </button>
                    </div>
                </div>

                {#if expandedItems[item.id]}
                    <div class="card-body" transition:slide={{ duration: 200 }}>
                        {#if item.type === 'character'}
                            <div class="char-details">
                                {#if item.affiliation}
                                    {@const group = story.groups.find(g => g.id === item.affiliation) || story.dictionary.find(d => d.id === story.affiliation)}
                                    {#if group}
                                        <div class="detail-row">
                                            <Icon name="flag" size={12} />
                                            <span>{group.name || group.term}</span>
                                        </div>
                                    {/if}
                                {/if}
                                {#if item.attributes && Object.keys(item.attributes).length > 0}
                                    <div class="attributes-grid">
                                        {#each Object.entries(item.attributes) as [key, val]}
                                            <div class="attr-chip">
                                                <span class="attr-key">{key}</span>
                                                <span class="attr-val">{val}</span>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                                
                                <!-- Narrative Summary -->
                                {#if item.narrative && (item.narrative.goal || item.narrative.motivation)}
                                    <div class="context-sub-section">
                                        <div class="section-title"><Icon name="book-open" size={10} /> 서사 (Narrative)</div>
                                        {#if item.narrative.goal}<div class="summary-item"><strong>목표:</strong> {item.narrative.goal}</div>{/if}
                                        {#if item.narrative.motivation}<div class="summary-item"><strong>동기:</strong> {item.narrative.motivation}</div>{/if}
                                    </div>
                                {/if}

                                <!-- Voice Guide -->
                                {#if item.voice && (item.voice.tone || item.voice.habit)}
                                    <div class="context-sub-section">
                                        <div class="section-title"><Icon name="message-circle" size={10} /> 말투 (Voice)</div>
                                        {#if item.voice.tone}<div class="summary-item"><strong>어조:</strong> {item.voice.tone}</div>{/if}
                                        {#if item.voice.habit}<div class="summary-item"><strong>말버릇:</strong> {item.voice.habit}</div>{/if}
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <p class="description">
                            {#if item.description || item.definition}
                                {(item.description || item.definition)}
                            {:else}
                                <span class="muted">설명이 없습니다.</span>
                            {/if}
                        </p>
                        
                        <div class="actions">
                            <button class="text-btn" on:click={() => uiState.openWikiModal(item.id, item.type)}>
                                <Icon name="external-link" size={12} /> 위키 열기
                            </button>
                        </div>
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>

<style>
    .context-sidebar {
        width: 100%;
        height: 100%;
        background: var(--primary-bg);
        border-left: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .sidebar-header {
        padding: 15px;
        border-bottom: 1px solid var(--border-color);
        font-weight: bold;
        display: flex; align-items: center; gap: 8px;
        background: var(--secondary-bg);
        font-size: 0.95em;
        color: var(--text-color);
    }
    .count {
        background: var(--accent-color); color: white;
        padding: 2px 6px; border-radius: 10px; font-size: 0.75em; font-weight: bold;
    }

    .filter-tabs {
        display: flex;
        padding: 8px 10px;
        gap: 5px;
        border-bottom: 1px solid var(--border-color);
        background: var(--primary-bg);
        overflow-x: auto; /* Handle overflow on small screens */
    }
    .filter-tabs button {
        flex: 1;
        background: none; border: none;
        padding: 6px 10px;
        font-size: 0.85em;
        color: var(--text-color-muted);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    }
    .filter-tabs button:hover { background-color: rgba(255,255,255,0.05); color: var(--text-color); }
    .filter-tabs button.active { background-color: var(--accent-color); color: white; font-weight: bold; }

    .items-list {
        flex: 1; overflow-y: auto; padding: 12px;
        background-color: var(--primary-bg);
    }

    .empty-state {
        text-align: center; color: var(--text-color-muted);
        padding: 40px 10px; font-size: 0.9em;
        line-height: 1.6;
        opacity: 0.7;
    }

    .context-card {
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        margin-bottom: 10px;
        overflow: hidden;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .context-card:hover {
        border-color: var(--accent-color);
    }
    .context-card.expanded {
        border-color: var(--accent-color);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .card-header {
        display: flex; align-items: center; gap: 12px;
        padding: 12px; cursor: pointer;
        transition: background 0.2s;
    }
    
    .icon-wrapper {
        width: 32px; height: 32px;
        border-radius: 50%; background: rgba(255,255,255,0.05);
        display: flex; justify-content: center; align-items: center;
        flex-shrink: 0; color: var(--text-color-muted);
        border: 1px solid var(--border-color);
    }
    .icon-wrapper.char { border: none; padding: 0; }
    .char-thumb { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

    .card-title { flex: 1; display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
    .name { font-weight: bold; font-size: 0.95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-color); }
    .type-label { font-size: 0.75em; color: var(--text-color-muted); }

    .card-actions {
        display: flex; align-items: center; gap: 2px;
    }
    .action-btn, .expand-btn {
        background: none; border: none; color: var(--text-color-muted); 
        padding: 6px; border-radius: 4px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        opacity: 0.7; transition: opacity 0.2s, background 0.2s;
    }
    .action-btn:hover, .expand-btn:hover { opacity: 1; background-color: rgba(255,255,255,0.1); color: var(--text-color); }

    .card-body {
        padding: 0 15px 15px 15px;
        border-top: 1px solid var(--border-color);
        background: rgba(0,0,0,0.02);
    }

    .description {
        font-size: 0.9em; color: var(--text-color-muted);
        line-height: 1.6; margin: 12px 0;
        white-space: pre-wrap;
    }
    .muted { font-style: italic; opacity: 0.6; }

    .char-details { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
    .detail-row { display: flex; align-items: center; gap: 6px; font-size: 0.85em; color: var(--accent-color); font-weight: 500; }
    
    .attributes-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .attr-chip {
        background: var(--primary-bg); border-radius: 4px;
        padding: 3px 8px; font-size: 0.8em; border: 1px solid var(--border-color);
        display: flex; align-items: center; gap: 4px;
    }
    .attr-key { color: var(--text-color-muted); font-weight: normal; }
    .attr-val { color: var(--text-color); font-weight: 600; }

    .context-sub-section {
        margin-top: 10px;
        padding: 8px;
        background: rgba(var(--accent-rgb), 0.05);
        border-radius: 6px;
        border: 1px solid rgba(var(--accent-rgb), 0.1);
    }
    .context-sub-section .section-title {
        font-size: 0.75em;
        font-weight: 800;
        text-transform: uppercase;
        color: var(--accent-color);
        margin-bottom: 5px;
        display: flex; align-items: center; gap: 4px;
    }
    .summary-item {
        font-size: 0.85em;
        line-height: 1.4;
        margin-bottom: 3px;
        color: var(--text-color);
    }
    .summary-item strong { opacity: 0.7; font-weight: 600; margin-right: 4px; }

    .actions { 
        margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border-color);
        display: flex; justify-content: flex-end; 
    }
    .text-btn {
        background: none; border: none; color: var(--accent-color);
        font-size: 0.85em; cursor: pointer; padding: 4px 8px;
        display: flex; align-items: center; gap: 4px;
        border-radius: 4px; font-weight: 500;
    }
    .text-btn:hover { background-color: rgba(var(--accent-rgb), 0.1); }
</style>