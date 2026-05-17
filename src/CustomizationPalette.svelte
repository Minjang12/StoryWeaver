<script>
    import { projectActions, notifications } from './stores.js';
    import Icon from './Icon.svelte';

    export let scene;

    const colors = ['#4A5568', '#9B2C2C', '#975A16', '#2F855A', '#2B6CB0', '#5A32A3', '#A020F0'];
    const icons = ['💬', '❓', '❗', '💡', '❤️', '💔', '⚔️', '🛡️', '🔑', '🔒', '💰', '☠️', '🏁'];

    function updateSceneStyle(key, value) {
        if (!scene) return;
        const currentValue = scene[key];
        projectActions.updateScene(scene.id, { [key]: currentValue === value ? null : value });
    }

    function resetSceneColor() {
        if (!scene) return;
        projectActions.updateScene(scene.id, { color: null });
    }

    async function openImageFile() {
        if (window.electronAPI) {
            const result = await window.electronAPI.openImageFile();
            if (result.success) {
                projectActions.updateScene(scene.id, { backgroundImage: result.filePath });
            }
        } else {
            notifications.add('Electron API를 사용할 수 없다냥. 개발 모드인지 확인해달라냥.', 'error');
        }
    }
</script>

{#if scene}
<div class="customization-section-body">
    <div class="color-palette">
        <button 
            class="color-swatch default" 
            class:selected={!scene.color}
            on:click={resetSceneColor}
            title="기본 색상">
            <Icon name="rotate-ccw" size={16} />
        </button>
        {#each colors as color}
            <button 
                class="color-swatch" 
                class:selected={scene.color === color}
                style="background-color: {color};"
                on:click={() => updateSceneStyle('color', color)}
                title={color}>
            </button>
        {/each}
    </div>
    <div class="icon-palette">
        <button 
            class="icon-btn"
            class:selected={!scene.icon}
            on:click={() => updateSceneStyle('icon', null)}>
            <Icon name="slash" size={16} />
        </button>
        {#each icons as icon}
            <button 
                class="icon-btn"
                class:selected={scene.icon === icon}
                on:click={() => updateSceneStyle('icon', icon)}>
                {icon}
            </button>
        {/each}
    </div>
</div>
{:else}
    <p class="no-scene-msg">씬을 선택해야 꾸미기 옵션을 사용할 수 있다냥.</p>
{/if}

<style>
    .customization-section-body { padding: 4px 4px; }
    
    .color-palette, .icon-palette { 
        display: flex; flex-wrap: wrap; gap: 8px; 
    }
    .icon-palette { margin-top: 12px; }
    
    .color-swatch {
        width: 24px; height: 24px; border-radius: 50%;
        border: 2px solid transparent; 
        cursor: pointer; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        position: relative;
    }
    .color-swatch.default { 
        background-color: var(--secondary-bg); 
        border: 1px solid var(--border-color);
        color: var(--text-color-muted);
    }
    .color-swatch:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    
    /* Selection Indicator Ring */
    .color-swatch.selected::after {
        content: '';
        position: absolute;
        top: -3px; left: -3px; right: -3px; bottom: -3px;
        border: 2px solid var(--accent-color);
        border-radius: 50%;
        animation: pop-in 0.2s;
    }

    .icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        background-color: transparent; border: 1px solid transparent;
        color: var(--text-color-muted); width: 28px; height: 28px;
        padding: 0; border-radius: 6px; cursor: pointer;
        transition: all 0.2s; font-size: 1em;
    }
    .icon-btn:hover { 
        background-color: rgba(255, 255, 255, 0.05); 
        color: var(--text-color); 
        border-color: var(--border-color);
    }
    .icon-btn.selected { 
        background-color: rgba(var(--accent-rgb), 0.1); 
        color: var(--accent-color); 
        border-color: var(--accent-color); 
        font-weight: bold;
    }
    
    .no-scene-msg {
        text-align: center;
        color: var(--text-color-muted);
        font-size: 0.9em;
        padding: 16px 0;
        font-style: italic;
    }

    @keyframes pop-in {
        0% { transform: scale(0.8); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }
</style>