<script>
    import { commandPalette, projectActions, activeStory, uiState, theme } from './stores.js';
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import Icon from './Icon.svelte';

    const dispatch = createEventDispatcher();

    let inputElement;
    let filteredCommands = [];
    let selectedIndex = 0;

    // All available commands
    // This will be dynamically generated or expanded later
    $: allCommands = [
        { id: 'add-scene', label: '새 씬 추가 (Alt+N)', icon: 'plus', action: () => projectActions.addScene() },
        { id: 'open-project-modal', label: '프로젝트 관리 열기', icon: 'folder', action: () => projectActions.openProjectModal() },
        { id: 'export-project', label: '프로젝트 데이터 추출', icon: 'download', action: () => projectActions.exportProjectData() },
        { id: 'toggle-theme', label: '테마 변경', icon: $theme === 'dark' ? 'sun' : 'moon', action: () => theme.toggleTheme() },
        { id: 'undo', label: '실행 취소 (Ctrl+Z)', icon: 'rotate-ccw', action: () => projectActions.undo() },
        { id: 'redo', label: '다시 실행 (Ctrl+Y)', icon: 'rotate-cw', action: () => projectActions.redo() },
        { id: 'toggle-focus-mode', label: '대사 집중 모드 토글', icon: $uiState.isFocusMode ? 'minimize-2' : 'maximize-2', action: () => uiState.toggleFocusMode() },
        { id: 'cleanup-characters', label: '미사용 등장인물 정리', icon: 'wind', action: () => projectActions.cleanupCharacters() },
        // Add more commands dynamically based on context (e.g., scenes, characters)
    ];

    // Reactive filtering of commands
    $: {
        const query = $commandPalette.query.toLowerCase();
        if (query) {
            filteredCommands = allCommands.filter(cmd => cmd.label.toLowerCase().includes(query));
        } else {
            filteredCommands = allCommands;
        }
        selectedIndex = 0; // Reset selection on query change
    }

    function handleInput(event) {
        commandPalette.setQuery(event.target.value);
    }

    function handleKeyDown(event) {
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
                break;
            case 'ArrowDown':
                event.preventDefault();
                selectedIndex = (selectedIndex + 1) % filteredCommands.length;
                break;
            case 'Enter':
                event.preventDefault();
                executeCommand(filteredCommands[selectedIndex]);
                break;
            case 'Escape':
                event.preventDefault();
                commandPalette.close();
                break;
        }
    }

    function executeCommand(command) {
        if (command && command.action) {
            command.action();
            commandPalette.close();
        }
    }

    onMount(() => {
        // Focus the input when the palette opens
        if (inputElement) {
            inputElement.focus();
        }

        const handleGlobalKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                commandPalette.toggle();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    });

    // When the palette opens, focus the input
    $: if ($commandPalette.isOpen && inputElement) {
        inputElement.focus();
    }
</script>

{#if $commandPalette.isOpen}
<div class="command-palette-backdrop" on:click={commandPalette.close} on:keydown|self={(e) => { if (e.key === 'Enter' || e.key === ' ') commandPalette.close(); }} tabindex="-1">
    <div class="command-palette-modal" on:click|stopPropagation on:keydown|stopPropagation tabindex="-1" role="dialog" aria-modal="true">
        <div class="command-palette-input-wrapper">
            <Icon name="search" size={18} />
            <input 
                type="text" 
                placeholder="명령어를 입력하세요..." 
                bind:value={$commandPalette.query}
                on:input={handleInput}
                on:keydown={handleKeyDown}
                bind:this={inputElement}
            />
        </div>
        
        {#if filteredCommands.length > 0}
            <ul class="command-list">
                {#each filteredCommands as command, i (command.id)}
                    <li 
                        class="command-item" 
                        class:selected={i === selectedIndex}
                        on:click={() => executeCommand(command)}
                        on:keydown={(e) => { if (e.key === 'Enter') executeCommand(command); }}
                        on:mouseenter={() => selectedIndex = i}
                        role="option"
                        aria-selected={i === selectedIndex}
                    >
                        <Icon name={command.icon || 'command'} size={16} />
                        <span>{command.label}</span>
                    </li>
                {/each}
            </ul>
        {:else}
            <p class="no-commands-msg">검색 결과가 없다냥.</p>
        {/if}
    </div>
</div>
{/if}

<style>
    .command-palette-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: flex-start; /* Align to top */
        padding-top: 10vh; /* Offset from top */
        z-index: 3000; /* Ensure it's on top of everything */
    }

    .command-palette-modal {
        background-color: var(--secondary-bg);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        width: 500px;
        max-width: 90%;
        max-height: 70vh; /* Limit height */
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .command-palette-input-wrapper {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);
    }

    .command-palette-input-wrapper :global(.icon-wrapper) {
        margin-right: 10px;
        color: var(--text-color-muted);
    }

    .command-palette-input-wrapper input {
        flex-grow: 1;
        border: none;
        background: none;
        font-size: 1.1em;
        color: var(--text-color);
        padding: 0;
    }

    .command-palette-input-wrapper input:focus {
        outline: none;
    }

    .command-list {
        list-style: none;
        margin: 0;
        padding: 8px 0;
        overflow-y: auto; /* Scroll for long lists */
    }

    .command-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px;
        cursor: pointer;
        transition: background-color var(--transition-speed);
    }

    .command-item:hover, .command-item.selected {
        background-color: var(--accent-color);
        color: white;
    }

    .command-item:hover :global(.icon-wrapper), .command-item.selected :global(.icon-wrapper) {
        color: white;
    }

    .command-item span {
        font-weight: 500;
    }

    .no-commands-msg {
        text-align: center;
        color: var(--text-color-muted);
        padding: 20px;
        font-size: 0.95em;
    }
</style>
