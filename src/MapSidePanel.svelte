<script>
    import { activeStory, projectActions, uiState } from './stores.js';
    import Icon from './Icon.svelte';
    import { slide } from 'svelte/transition';

    export let story;

    let activeTab = 'locations'; // 'locations' or 'scenes'
    let searchText = '';

    $: locations = story?.locations || [];
    $: scenes = story?.scenes ? Object.values(story.scenes) : [];
    $: sequences = story?.sequences ? Object.values(story.sequences) : [];
    
    // Filtered Locations
    $: filteredLocations = locations.filter(l => 
        l.name.toLowerCase().includes(searchText.toLowerCase())
    );
    
    // Grouped Scenes (by Sequence)
    $: groupedScenes = (() => {
        const groups = [];
        const assignedSceneIds = new Set();
        
        // 1. Process Sequences
        sequences.forEach(seq => {
            const seqScenes = (seq.scenes || [])
                .map(id => story.scenes[id])
                .filter(s => s && s.name.toLowerCase().includes(searchText.toLowerCase()));
            
            if (seqScenes.length > 0) {
                seqScenes.forEach(s => assignedSceneIds.add(s.id));
                groups.push({
                    id: seq.id,
                    name: seq.name,
                    color: seq.color,
                    scenes: seqScenes
                });
            }
        });
        
        // 2. Uncategorized Scenes
        const unassignedScenes = scenes.filter(s => 
            !assignedSceneIds.has(s.id) && 
            s.name.toLowerCase().includes(searchText.toLowerCase())
        );
        
        if (unassignedScenes.length > 0) {
            groups.push({
                id: 'uncategorized',
                name: '미분류',
                color: '#6c757d',
                scenes: unassignedScenes
            });
        }
        
        return groups;
    })();

    // Helpers
    function handleDragStart(e, type, id) {
        e.dataTransfer.setData('type', type);
        e.dataTransfer.setData('id', id);
        e.dataTransfer.effectAllowed = 'all'; // Allow link and copy
    }
    
    function isMapped(locationId) {
        return (story.mapData?.markers || []).some(m => m.wikiId === locationId);
    }
    
    function getLinkedLocationName(scene) {
        if (!scene.referencedWikiIds || scene.referencedWikiIds.length === 0) return null;
        const loc = locations.find(l => scene.referencedWikiIds.includes(l.id));
        return loc ? loc.name : null;
    }
</script>

<div class="map-palette" on:mousedown|stopPropagation>
    <div class="palette-header">
        <div class="tabs">
            <button class:active={activeTab === 'locations'} on:click={() => activeTab = 'locations'}>
                <Icon name="map-pin" size={14} /> 장소
            </button>
            <button class:active={activeTab === 'scenes'} on:click={() => activeTab = 'scenes'}>
                <Icon name="film" size={14} /> 씬
            </button>
        </div>
        <div class="search-box">
            <Icon name="search" size={12} />
            <input type="text" bind:value={searchText} placeholder="검색..." />
        </div>
    </div>

    <div class="palette-content" on:mousedown|stopPropagation>
        {#if activeTab === 'locations'}
            <div class="list-section">
                {#each filteredLocations as loc (loc.id)}
                    <div 
                        class="palette-item location-item" 
                        class:mapped={isMapped(loc.id)}
                        draggable="true"
                        on:dragstart={(e) => handleDragStart(e, 'location', loc.id)}
                    >
                        <Icon name="map-pin" size={14} color={isMapped(loc.id) ? 'var(--accent-color)' : 'var(--text-color-muted)'} />
                        <span class="item-name">{loc.name}</span>
                        {#if isMapped(loc.id)}
                            <Icon name="check" size={12} color="var(--success-color)" />
                        {/if}
                    </div>
                {/each}
                {#if filteredLocations.length === 0}
                    <div class="empty-msg">장소가 없습니다.<br>위키에서 장소를 추가하세요.</div>
                {/if}
            </div>
        {:else}
            <div class="list-section">
                <div class="hint-msg">
                    <Icon name="info" size={12} />
                    <span>드래그하여 지도 핀에 연결하세요.</span>
                </div>
                
                {#each groupedScenes as group (group.id)}
                    <div class="scene-group" transition:slide|local={{ duration: 200 }}>
                        <div class="group-header">
                            <span class="group-badge" style="background-color: {group.color || 'var(--accent-color)'};">
                                {group.name}
                            </span>
                            <span class="group-count">{group.scenes.length}</span>
                        </div>
                        <div class="group-items">
                            {#each group.scenes as scene (scene.id)}
                                {@const linkedLocName = getLinkedLocationName(scene)}
                                <div 
                                    class="palette-item scene-item"
                                    class:linked={!!linkedLocName}
                                    draggable="true"
                                    on:dragstart={(e) => handleDragStart(e, 'scene', scene.id)}
                                >
                                    <div class="scene-icon">
                                        <Icon name={scene.icon || 'film'} size={14} />
                                    </div>
                                    <div class="scene-info">
                                        <span class="item-name">{scene.name}</span>
                                        {#if linkedLocName}
                                            <span class="linked-badge">
                                                <Icon name="link" size={10} /> {linkedLocName}
                                            </span>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
                
                {#if groupedScenes.length === 0}
                     <div class="empty-msg">씬이 없거나 검색 결과가 없습니다.</div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .map-palette {
        position: absolute;
        top: 20px;
        left: 20px;
        width: 260px;
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        height: auto;
        max-height: calc(100% - 140px); /* Leave space for dock */
        z-index: 100;
        overflow: hidden;
    }
    
    .palette-header {
        padding: 10px;
        background: var(--primary-bg);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .tabs {
        display: flex;
        background: var(--secondary-bg);
        border-radius: 4px;
        padding: 2px;
        border: 1px solid var(--border-color);
    }
    .tabs button {
        flex: 1;
        border: none;
        background: transparent;
        padding: 6px;
        font-size: 0.85em;
        cursor: pointer;
        border-radius: 2px;
        color: var(--text-color-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }
    .tabs button.active {
        background: var(--primary-bg);
        color: var(--accent-color);
        font-weight: bold;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .search-box {
        display: flex;
        align-items: center;
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 4px 8px;
        gap: 6px;
    }
    .search-box input {
        border: none;
        background: transparent;
        width: 100%;
        color: var(--text-color);
        font-size: 0.9em;
    }
    .search-box input:focus { outline: none; }
    
    .palette-content {
        flex: 1;
        overflow-y: auto;
        background: var(--secondary-bg);
    }
    
    .list-section {
        padding: 5px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    
    .palette-item {
        padding: 8px 10px;
        background: var(--primary-bg);
        border: 1px solid transparent;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: grab;
        font-size: 0.9em;
        transition: all 0.2s;
    }
    .palette-item:hover {
        border-color: var(--accent-color);
        transform: translateX(2px);
    }
    .palette-item:active {
        cursor: grabbing;
    }
    
    .item-name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .location-item.mapped {
        opacity: 0.7;
    }
    
    /* Scene Group Styles */
    .scene-group {
        margin-bottom: 8px;
    }
    .group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 6px;
        margin-bottom: 2px;
    }
    .group-badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75em;
        color: white;
        font-weight: bold;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 180px;
    }
    .group-count {
        font-size: 0.7em;
        color: var(--text-color-muted);
    }
    .group-items {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding-left: 4px;
        border-left: 2px solid var(--border-color);
        margin-left: 8px;
    }
    
    .scene-item {
        align-items: flex-start;
    }
    .scene-icon {
        padding-top: 2px;
        color: var(--text-color-muted);
    }
    .scene-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: hidden;
    }
    .linked-badge {
        font-size: 0.75em;
        color: var(--accent-color);
        display: flex;
        align-items: center;
        gap: 3px;
    }
    
    .empty-msg {
        padding: 20px;
        text-align: center;
        color: var(--text-color-muted);
        font-size: 0.85em;
        line-height: 1.5;
    }
    .hint-msg {
        padding: 8px 10px;
        font-size: 0.8em;
        color: var(--text-color-muted);
        display: flex;
        align-items: center;
        gap: 6px;
        border-bottom: 1px dashed var(--border-color);
        margin-bottom: 4px;
    }
</style>