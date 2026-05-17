<script>
    import { characterStatesByScene } from './stores.js';
    import Icon from './Icon.svelte';

    export let scene;
    export let position; // { x, y }
    export let story;

    let sceneStates;
    $: sceneStates = $characterStatesByScene?.[scene?.id] || {};

    $: dialogues = scene ? scene.content.filter(item => item.type === 'dialogue') : [];
    $: scenePlotThreads = (scene && story && scene.plotThreadIds) 
        ? story.plotThreads.filter(pt => scene.plotThreadIds.includes(pt.id))
        : [];
    
    $: sceneCharacters = (() => {
        if (!story || !story.characters) return [];
        const characterIdsInScene = new Set();
        
        // Add characters from dialogues
        dialogues.forEach(d => {
            const char = story.characters.find(c => c.name === d.character);
            if (char) characterIdsInScene.add(char.id);
        });

        // Add characters who have states in this scene
        if (sceneStates) {
            for (const charId in sceneStates) {
                if (sceneStates[charId].length > 0) {
                    characterIdsInScene.add(charId);
                }
            }
        }
        
        return Array.from(characterIdsInScene).map(id => story.characters.find(c => c.id === id)).filter(Boolean);
    })();

    $: characterColorMap = (story && story.characters) ? story.characters.reduce((acc, char) => {
        acc[char.name] = char.color;
        return acc;
    }, {}) : {};
</script>

{#if scene}
<div class="scene-tooltip" style="left: {position.x}px; top: {position.y}px;">
    <div class="tooltip-header">{scene.name}</div>
    <div class="tooltip-content">
        {#if dialogues.length > 0}
            <ul>
                {#each dialogues.slice(0, 5) as dialogue}
                    <li>
                        <span class="character-name" style="color: {characterColorMap[dialogue.character] || 'var(--accent-color)'}">{dialogue.character || '나레이션'}:</span>
                        <span class="dialogue-text">{dialogue.text || '...'}</span>
                    </li>
                {/each}
            </ul>
            {#if dialogues.length > 5}
                <div class="more-items">... 외 {dialogues.length - 5}개 대사</div>
            {/if}
        {:else}
            <p class="no-dialogue">이 씬에는 대사가 없습니다.</p>
        {/if}
    </div>
    {#if sceneCharacters.length > 0}
        <div class="tooltip-characters">
            <div class="character-list-header">
                <Icon name="users" size={14} />
                <span>등장인물</span>
            </div>
            <div class="character-list">
                {#each sceneCharacters as character}
                    <div class="character-item">
                        <span class="character-tag" style="color: {character.color}">{character.name}</span>
                        <div class="state-tags">
                            {#if sceneStates[character.id] && sceneStates[character.id].length > 0}
                                {#each sceneStates[character.id] as state}
                                    <span class="state-tag">{state}</span>
                                {/each}
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
    {#if scenePlotThreads.length > 0}
        <div class="tooltip-footer">
            {#each scenePlotThreads as thread}
                <div class="plot-tag">
                    <div class="plot-tag-color" style="background-color: {thread.color};"></div>
                    <span>{thread.name}</span>
                </div>
            {/each}
        </div>
    {/if}
</div>
{/if}

<style>
    .scene-tooltip {
        position: absolute;
        z-index: 1000;
        background-color: var(--secondary-bg);
        border: 1px solid var(--node-border);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow-lg);
        width: 280px;
        max-height: 300px;
        display: flex;
        flex-direction: column;
        pointer-events: none;
        opacity: 0;
        transform: scale(0.95);
        transition: opacity 0.15s ease-out, transform 0.15s ease-out;
        font-size: 13px;
    }

    :global(.scene-tooltip-visible) .scene-tooltip {
        opacity: 1;
        transform: scale(1);
    }

    .tooltip-header {
        padding: 8px 12px;
        font-weight: 600;
        border-bottom: 1px solid var(--node-border);
        background-color: var(--primary-bg);
        flex-shrink: 0;
    }

    .tooltip-content {
        padding: 4px;
        overflow-y: auto;
        min-height: 0;
    }

    .tooltip-content ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .tooltip-content li {
        padding: 6px 8px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        gap: 6px;
    }

    .tooltip-content li:last-child {
        border-bottom: none;
    }

    .character-name {
        font-weight: 500;
        color: var(--accent-color);
        flex-shrink: 0;
    }

    .dialogue-text {
        color: var(--text-color);
        white-space: pre-wrap;
        word-break: break-all;
    }

    .no-dialogue {
        padding: 12px;
        text-align: center;
        color: var(--text-color-muted);
    }
    .more-items {
        font-size: 0.8em;
        text-align: center;
        color: var(--text-color-muted);
        padding: 4px;
    }
    .tooltip-characters {
        padding: 8px 12px;
        border-top: 1px solid var(--node-border);
    }
    .character-list-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8em;
        color: var(--text-color-muted);
        text-transform: uppercase;
        margin-bottom: 8px;
    }
    .character-list {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 6px;
    }
    .character-item {
        display: flex;
        align-items: center;
        gap: 4px;
        background-color: var(--primary-bg);
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid var(--border-color);
    }
    .character-tag {
        background-color: transparent;
        padding: 0;
        border-radius: 0;
        font-size: 0.9em;
        font-weight: 600;
        flex-shrink: 0;
    }
    .state-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    .state-tag {
        background-color: var(--accent-color);
        color: white;
        padding: 1px 5px;
        border-radius: 8px;
        font-size: 0.8em;
        font-weight: 500;
    }
    .tooltip-footer {
        border-top: 1px solid var(--node-border);
        padding: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        background-color: var(--primary-bg);
    }
    .plot-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background-color: var(--secondary-bg);
        border-radius: 12px;
        padding: 3px 8px;
        font-size: 0.85em;
    }
    .plot-tag-color {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1px solid rgba(0,0,0,0.2);
    }
</style>
