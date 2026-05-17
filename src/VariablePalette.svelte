<script>
    import { projectActions, notifications, activeProject } from './stores.js';
    import { analyzeVariableUsage } from './utils.js';
    import Icon from './Icon.svelte';

    export let story;

    let newVariableName = '';
    let expandedVariables = {};

    $: variableUsage = $activeProject ? analyzeVariableUsage($activeProject.story) : {};

    function toggleExpand(variableName) {
        expandedVariables[variableName] = !expandedVariables[variableName];
    }

    function handleAddVariable() {
        if (newVariableName.trim()) {
            // Prevent adding variable with a name that already exists
            if (story.variables.some(v => v.name === newVariableName.trim())) {
                notifications.add('이미 있는 변수 이름이다냥!', 'warning');
            } else {
                projectActions.addVariable(newVariableName.trim());
                newVariableName = '';
            }
        } else {
            notifications.add('변수 이름을 입력해달라냥!', 'warning');
        }
    }

    function handleValueUpdate(variableName, event) {
        const variable = story.variables.find(v => v.name === variableName);
        if (!variable) return;

        let newValue = event.target.value;
        if (variable.type === 'Number') {
            newValue = Number(newValue) || 0;
        } else if (variable.type === 'Boolean') {
            newValue = (newValue === 'true');
        }
        projectActions.updateVariable(variableName, { value: newValue });
    }
</script>

<div class="variable-palette-container">
    <div class="variable-list">
        {#if story.variables.length > 0}
            {#each story.variables as variable (variable.name)}
                <div class="variable-item">
                    <div class="variable-header">
                        <span class="var-name">{variable.name}</span>
                         <div class="variable-controls">
                            <button 
                                class="icon-btn" 
                                on:click={() => toggleExpand(variable.name)} 
                                title="사용처 보기">
                                <Icon name="info" size={16} />
                            </button>
                            <button 
                                class="icon-btn danger" 
                                on:click={() => projectActions.removeVariable(variable.name)} 
                                title="{variable.name} 변수를 삭제합니다">
                                <Icon name="trash-2" size={16} />
                            </button>
                        </div>
                    </div>
                    <div class="variable-editor">
                        <select 
                            class="var-type" 
                            value={variable.type} 
                            on:change={(e) => projectActions.updateVariable(variable.name, { type: e.target.value })}
                            title="변수 타입"
                        >
                            <option value="Text">글자</option>
                            <option value="Number">숫자</option>
                            <option value="Boolean">참/거짓</option>
                        </select>

                        {#if variable.type === 'Text'}
                            <input 
                                type="text" 
                                class="var-value"
                                placeholder="초기값"
                                value={variable.value}
                                on:change={(e) => handleValueUpdate(variable.name, e)}
                            />
                        {:else if variable.type === 'Number'}
                            <input 
                                type="number" 
                                class="var-value"
                                placeholder="초기값"
                                value={variable.value}
                                on:change={(e) => handleValueUpdate(variable.name, e)}
                            />
                        {:else if variable.type === 'Boolean'}
                            <select 
                                class="var-value"
                                value={variable.value}
                                on:change={(e) => handleValueUpdate(variable.name, e)}
                            >
                                <option value={true}>참</option>
                                <option value={false}>거짓</option>
                            </select>
                        {/if}
                    </div>
                    {#if expandedVariables[variable.name] && variableUsage[variable.name]}
                        <div class="variable-usage">
                            {#if variableUsage[variable.name].modifiedIn.length > 0}
                                <div class="usage-section">
                                    <strong>값이 바뀌는 곳:</strong>
                                    <ul>
                                        {#each variableUsage[variable.name].modifiedIn as mod}
                                            <li><strong>{mod.sceneName}:</strong> {mod.context} (<code>{mod.details}</code>)</li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}
                            {#if variableUsage[variable.name].readIn.length > 0}
                                <div class="usage-section">
                                    <strong>조건으로 쓰는 곳:</strong>
                                    <ul>
                                        {#each variableUsage[variable.name].readIn as read}
                                            <li><strong>{read.sceneName}:</strong> {read.context} (<code>{read.details}</code>)</li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}
                            {#if variableUsage[variable.name].modifiedIn.length === 0 && variableUsage[variable.name].readIn.length === 0}
                                <p class="no-usage-msg">아직 이 변수를 쓰는 곳이 없다냥.</p>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        {:else}
            <p class="no-variables-msg">아직 추가된 변수가 없다냥.</p>
        {/if}
    </div>
    <div class="new-variable-form">
        <input type="text" bind:value={newVariableName} placeholder="새 변수 이름..." on:keydown={(e) => e.key === 'Enter' && handleAddVariable()} />
        <button on:click={handleAddVariable} class="add-variable-btn">
            <Icon name="plus" size={18} />
        </button>
    </div>
</div>

<style>
    .variable-palette-container {
        padding-top: 8px;
    }
    .variable-list {
        display: flex;
        flex-direction: column;
        gap: 0;
        margin-bottom: 16px;
        border-top: 1px solid var(--border-color);
    }
    .variable-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
        background-color: transparent;
        padding: 12px 4px;
        border-bottom: 1px solid var(--border-color);
        transition: background-color 0.2s;
    }
    .variable-item:hover {
        background-color: rgba(255, 255, 255, 0.02);
    }
    .variable-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    }
    .var-name {
        font-weight: 600;
        font-family: monospace;
        word-break: break-all;
        font-size: 1em;
        color: var(--accent-color);
    }
    .variable-controls {
        display: flex;
        gap: 4px;
    }
    .variable-editor {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        width: 100%;
        align-items: center;
    }
    
    /* Flat Inputs */
    .var-type, .var-value {
        background-color: transparent;
        color: var(--text-color);
        border: none;
        border-bottom: 1px solid var(--border-color);
        padding: 6px 4px;
        border-radius: 0;
        box-sizing: border-box;
        height: 30px;
        font-size: 0.9em;
        transition: border-color 0.2s;
    }
    .var-type {
        width: 80px; 
        flex-shrink: 0;
        font-size: 0.85em; color: var(--text-color-muted);
    }
    .var-value {
        flex-grow: 1;
        min-width: 60px;
    }
    .var-type:focus, .var-value:focus {
        outline: none;
        border-color: var(--accent-color);
        background-color: rgba(255, 255, 255, 0.02);
    }

    .variable-usage {
        width: 100%;
        box-sizing: border-box;
        background-color: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
        padding: 10px;
        margin-top: 6px;
        font-size: 0.85em;
        border-left: 2px solid var(--accent-color);
    }
    .usage-section {
        margin-bottom: 8px;
    }
    .usage-section:last-child {
        margin-bottom: 0;
    }
    .usage-section strong {
        color: var(--text-color);
        font-weight: 500;
        display: block; margin-bottom: 4px;
    }
    .usage-section ul {
        list-style: none;
        padding-left: 0;
        margin: 0;
        color: var(--text-color-muted);
    }
    .usage-section li {
        margin-bottom: 4px;
        word-break: break-all;
        padding-left: 10px; border-left: 2px solid var(--border-color);
    }
    .usage-section code {
        background-color: rgba(255, 255, 255, 0.1);
        padding: 1px 4px;
        border-radius: 3px;
        font-family: monospace;
    }
    .no-usage-msg {
        color: var(--text-color-muted);
        font-style: italic; opacity: 0.7;
    }
    
    .icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        background-color: transparent; border: none;
        color: var(--text-color-muted); width: 28px; height: 28px;
        padding: 0; border-radius: 4px; cursor: pointer;
        transition: all 0.2s; opacity: 0.6;
    }
    .icon-btn:hover { 
        color: var(--text-color); 
        background-color: rgba(255, 255, 255, 0.1);
        opacity: 1;
    }
    .icon-btn.danger:hover { color: var(--danger-color); background-color: rgba(255, 0, 0, 0.1); }

    .new-variable-form {
        display: flex; 
        gap: 8px;
        margin-top: 10px;
        align-items: center;
    }
    .new-variable-form input {
        flex-grow: 1; 
        min-width: 0;
        background-color: transparent;
        color: var(--text-color);
        border: none;
        border-bottom: 1px solid var(--border-color);
        padding: 8px 4px;
        border-radius: 0;
        transition: border-color 0.2s;
    }
    .new-variable-form input:focus {
        outline: none;
        border-color: var(--accent-color);
    }
    .add-variable-btn {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px; height: 32px;
        border: 1px solid var(--accent-color);
        background-color: transparent;
        color: var(--accent-color);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .add-variable-btn:hover {
        background-color: var(--accent-color);
        color: white;
    }
    .no-variables-msg {
        text-align: center;
        color: var(--text-color-muted);
        font-size: 0.9em;
        padding: 16px 0;
        border-bottom: 1px solid var(--border-color);
    }
</style>