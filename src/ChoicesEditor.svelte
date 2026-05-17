<script>
    import { projectActions, uiState } from './stores.js';
    import Icon from './Icon.svelte';

    export let scene;
    export let story;

    const operators = ['==', '!=', '>', '<', '>=', '<='];
    const actionOperators = ['='];
    const numericActionOperators = ['=', '+=', '-='];

    // --- CHOICE ACTIONS ---
    function addChoice() {
        projectActions.addChoice(scene.id);
    }

    function updateChoice(choiceId, field, value, record) {
        projectActions.updateChoice(scene.id, choiceId, { [field]: value }, record);
    }

    function removeChoice(choiceId) {
        projectActions.removeChoice(scene.id, choiceId);
    }

        // --- CONDITION ACTIONS ---
        function addCondition(choiceId) {
            projectActions.addCondition(scene.id, choiceId);
        }
    
        function updateCondition(choiceId, conditionId, field, value, record = true) {
            projectActions.updateCondition(scene.id, choiceId, conditionId, { [field]: value }, record);
        }
    
        function removeCondition(choiceId, conditionId) {
            projectActions.removeCondition(scene.id, choiceId, conditionId);
        }
    
        let variableMap = new Map();
        $: if (story?.variables) {
            variableMap.clear();
            for (const v of story.variables) {
                variableMap.set(v.name, v);
            }
        }
    
            let characterMap = new Map();
            let charactersWithSprites = [];
            let anySpritesExist = false;
            $: if (story?.characters) {
                characterMap.clear();
                charactersWithSprites = story.characters.filter(c => c.sprites && c.sprites.length > 0);
                anySpritesExist = charactersWithSprites.length > 0;
                for (const c of story.characters) {
                    characterMap.set(c.id, c);
                }
            }
            
            function getVariableByName(variableName) {
                return variableMap.get(variableName);    }

    function getCharacterById(characterId) {
        return characterMap.get(characterId);
    }

    function getCharacterAttributeNames(characterId) {
        const char = getCharacterById(characterId);
        return char ? Object.keys(char.attributes) : [];
    }

    function getCharacterStateValues(characterId) {
        const char = getCharacterById(characterId);
        return char ? char.states : [];
    }

    function handleConditionTypeChange(choiceId, conditionId, newType) {
        let newData = { type: newType };
        if (newType === 'variable') {
            newData = { ...newData, characterId: null, attribute: null, variable: story.variables[0]?.name || '' };
        } else if (newType === 'characterAttribute') {
            const defaultCharId = story.characters[0]?.id || null;
            const defaultAttribute = defaultCharId ? getCharacterAttributeNames(defaultCharId)[0] || '' : '';
            newData = { ...newData, variable: null, characterId: defaultCharId, attribute: defaultAttribute };
        } else if (newType === 'characterState') {
            const defaultCharId = story.characters[0]?.id || null;
            newData = { ...newData, variable: null, attribute: null, characterId: defaultCharId, operator: '==', value: '' }; // States only use ==/!=
        }
        projectActions.updateCondition(scene.id, choiceId, conditionId, newData);
    }

    function handleCharacterChange(choiceId, conditionId, newCharId, conditionType) {
        let newData = { characterId: newCharId };
        if (conditionType === 'characterAttribute') {
            newData.attribute = getCharacterAttributeNames(newCharId)[0] || '';
        } else if (conditionType === 'characterState') {
            // No attribute for state, value will be the state itself
        }
        projectActions.updateCondition(scene.id, choiceId, conditionId, newData);
    }

    function handleActionTypeChange(choiceId, actionId, newType) {
        let newData = { type: newType };
        // Reset fields and set defaults based on new type
        if (newType === 'variable') {
            newData = { ...newData, variable: story.variables[0]?.name || '', value: '', operator: '=' };
        } else if (newType === 'variableRandom') {
            const firstNumericVar = story.variables.find(v => v.type === 'Number');
            newData = { ...newData, variable: firstNumericVar?.name || '', min: 1, max: 10 };
        } else if (newType === 'variableDice') {
            const firstNumericVar = story.variables.find(v => v.type === 'Number');
            newData = { ...newData, variable: firstNumericVar?.name || '', diceCount: 1, diceSides: 6 };
        } else if (newType === 'characterAttribute') {
            const defaultCharId = story.characters[0]?.id || null;
            newData = { ...newData, characterId: defaultCharId, attribute: getCharacterAttributeNames(defaultCharId)[0] || '', value: 0, operator: '=' };
        } else if (newType === 'characterState') {
            newData = { ...newData, characterId: story.characters[0]?.id || null, state: '', operator: '+=' };
        } else if (newType === 'sprite') {
            const charWithSprites = charactersWithSprites[0];
            newData = { ...newData, characterId: charWithSprites?.id || null, command: 'show', spriteId: charWithSprites?.sprites[0]?.id || null, position: 'center' };
        }
        projectActions.updateAction(scene.id, choiceId, 'choice', action.id, newData);
    }

    function handleActionCharacterChange(choiceId, actionId, newCharId, actionType) {
        let newData = { characterId: newCharId };
        if (actionType === 'characterAttribute') {
            newData.attribute = getCharacterAttributeNames(newCharId)[0] || '';
        } else if (actionType === 'characterState') {
            // No attribute for state, value will be the state itself
        }
        projectActions.updateAction(scene.id, choice.id, 'choice', action.id, newData);
    }
</script>

{#if scene && story}
    {#each scene.choices as choice (choice.id)}
        <div 
            class="choice-item" 
            class:linking={story.linkingState.active && story.linkingState.sourceChoiceId === choice.id}
            on:mouseenter={() => uiState.highlightLink(scene.id, choice.id, choice.targetSceneId)}
            on:mouseleave={() => uiState.clearHighlight()}
        >
            <div class="choice-controls">
                <input 
                    type="text" placeholder="선택지 텍스트" 
                    value={choice.text} 
                    on:change={(e) => {
                        updateChoice(choice.id, 'text', e.target.value, false);
                        projectActions.commitHistory();
                    }}
                />
                <button 
                    class="icon-btn" 
                    class:active={story.linkingState.active && story.linkingState.sourceChoiceId === choice.id}
                    on:click={() => {
                        if (story.linkingState.active && story.linkingState.sourceChoiceId === choice.id) {
                            projectActions.cancelLinking();
                        } else {
                            projectActions.startLinking(scene.id, choice.id, 'choice');
                        }
                    }} 
                    title={story.linkingState.active && story.linkingState.sourceChoiceId === choice.id ? "연결을 취소합니다" : "다른 씬에 연결합니다"}
                >
                    <Icon name="link" size={16} />
                </button>
                <button class="icon-btn danger" on:click={() => removeChoice(choice.id)} title="선택지 삭제">
                    <Icon name="x" size={16} />
                </button>
            </div>
            <div class="target-scene">
                <Icon name="arrow-right-circle" size={14} />
                <span>{choice.targetSceneId ? story.scenes[choice.targetSceneId]?.name : '연결 없음'}</span>
            </div>
        
            <div class="conditions-section">
                {#if choice.conditions && choice.conditions.length > 0}
                    {#each choice.conditions as condition (condition.id)}
                        <div class="condition-item">
                            <select value={condition.type || 'variable'} on:change={(e) => handleConditionTypeChange(choice.id, condition.id, e.target.value)}>
                                <option value="variable">변수</option>
                                <option value="characterAttribute">캐릭터 능력치</option>
                                <option value="characterState">캐릭터 상태</option>
                            </select>

                            {#if condition.type === 'variable' || !condition.type}
                                <select value={condition.variable} on:change={(e) => updateCondition(choice.id, condition.id, 'variable', e.target.value)}>
                                    {#if story.variables.length > 0}
                                        {#each story.variables as v (v.name)}
                                            <option value={v.name}>{v.name}</option>
                                        {/each}
                                    {:else}
                                        <option value="" disabled>변수 없음</option>
                                    {/if}
                                </select>
                                <select value={condition.operator} on:change={(e) => updateCondition(choice.id, condition.id, 'operator', e.target.value)}>
                                    {#each operators as op}
                                        <option value={op}>{op}</option>
                                    {/each}
                                </select>
                                <input 
                                    type="text" placeholder="값" 
                                    value={condition.value} 
                                    on:change={(e) => {
                                        updateCondition(choice.id, condition.id, 'value', e.target.value, false);
                                        projectActions.commitHistory();
                                    }}
                                />
                            {:else if condition.type === 'characterAttribute'}
                                <select value={condition.characterId} on:change={(e) => handleCharacterChange(choice.id, condition.id, e.target.value, 'characterAttribute')}> 
                                    {#if story.characters.length > 0}
                                        {#each story.characters as char (char.id)}
                                            <option value={char.id}>{char.name}</option>
                                        {/each}
                                    {:else}
                                        <option value="" disabled>캐릭터 없음</option>
                                    {/if}
                                </select>
                                <select value={condition.attribute} on:change={(e) => updateCondition(choice.id, condition.id, 'attribute', e.target.value)}>
                                    {#if getCharacterAttributeNames(condition.characterId).length > 0}
                                        {#each getCharacterAttributeNames(condition.characterId) as attr (attr)}
                                            <option value={attr}>{attr}</option>
                                        {/each}
                                    {:else}
                                        <option value="" disabled>속성 없음</option>
                                    {/if}
                                </select>
                                <select value={condition.operator} on:change={(e) => updateCondition(choice.id, condition.id, 'operator', e.target.value)}>
                                    {#each operators as op}
                                        <option value={op}>{op}</option>
                                    {/each}
                                </select>
                                <input 
                                    type="number" placeholder="값" 
                                    value={condition.value} 
                                    on:change={(e) => {
                                        updateCondition(choice.id, condition.id, 'value', e.target.value, false);
                                        projectActions.commitHistory();
                                    }}
                                />
                            {:else if condition.type === 'characterState'}
                                <select value={condition.characterId} on:change={(e) => handleCharacterChange(choice.id, condition.id, e.target.value, 'characterState')}> 
                                    {#if story.characters.length > 0}
                                        {#each story.characters as char (char.id)}
                                            <option value={char.id}>{char.name}</option>
                                        {/each}
                                    {:else}
                                        <option value="" disabled>캐릭터 없음</option>
                                    {/if}
                                </select>
                                <select value={condition.operator} on:change={(e) => updateCondition(choice.id, condition.id, 'operator', e.target.value)}>
                                    <option value="==">포함</option>
                                    <option value="!=">미포함</option>
                                </select>
                                <input 
                                    type="text" placeholder="상태명" 
                                    value={condition.value} 
                                    on:change={(e) => {
                                        updateCondition(choice.id, condition.id, 'value', e.target.value, false);
                                        projectActions.commitHistory();
                                    }}
                                />
                            {/if}
                            <button class="icon-btn danger" on:click={() => removeCondition(choice.id, condition.id)}>
                                <Icon name="x" size={14} />
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>
            <div class="actions-section">
                {#if choice.actions && choice.actions.length > 0}
                    {#each choice.actions as action (action.id)}
                        <div class="action-item">
                            <select value={action.type || 'variable'} on:change={(e) => handleActionTypeChange(choice.id, action.id, e.target.value)}>
                                <option value="variable">변수 (값 설정)</option>
                                <option value="variableRandom">변수 (랜덤값)</option>
                                <option value="variableDice">변수 (주사위)</option>
                                <option value="characterAttribute">캐릭터 능력치</option>
                                <option value="characterState">캐릭터 상태</option>
                                {#if anySpritesExist}
                                <option value="sprite">스프라이트</option>
                                {/if}
                            </select>

                            {#if action.type === 'variable' || !action.type}
                                {@const variable = getVariableByName(action.variable)}
                                <select 
                                    value={story.variables.length > 0 ? action.variable : undefined} 
                                    on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { variable: e.target.value })}
                                >
                                    {#if story.variables.length > 0}
                                        {#each story.variables as v (v.name)}
                                            <option value={v.name}>{v.name}</option>
                                        {/each}
                                    {:else}
                                        <option value="" disabled>변수 없음</option>
                                    {/if}
                                </select>
                                <select 
                                    value={action.operator} 
                                    on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { operator: e.target.value })}
                                >
                                    {#if variable?.type === 'Number'}
                                        {#each numericActionOperators as op}
                                            <option value={op}>{op}</option>
                                        {/each}
                                    {:else}
                                        {#each actionOperators as op}
                                            <option value={op}>{op}</option>
                                        {/each}
                                    {/if}
                                </select>

                                {#if variable?.type === 'Boolean'}
                                    <select 
                                        value={action.value}
                                        on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { value: e.target.value === 'true' })}
                                    >
                                        <option value={true}>참</option>
                                        <option value={false}>거짓</option>
                                    </select>
                                {:else}
                                    <input 
                                        type={variable?.type === 'Number' ? 'number' : 'text'}
                                        placeholder="값" 
                                        value={action.value} 
                                        on:change={(e) => {
                                            projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { value: e.target.value }, false);
                                            projectActions.commitHistory();
                                        }}
                                    />
                                {/if}
                            {:else if action.type === 'variableRandom'}
                                <select 
                                    value={story.variables.length > 0 ? action.variable : undefined} 
                                    on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { variable: e.target.value })}
                                >
                                    {#if story.variables.length > 0}
                                        {#each story.variables as v (v.name)}
                                            {#if v.type === 'Number'}
                                                <option value={v.name}>{v.name}</option>
                                            {/if}
                                        {/each}
                                    {:else}
                                        <option value="" disabled>숫자 변수 없음</option>
                                    {/if}
                                </select>
                                <div class="action-input-group">
                                    <span class="action-label">최소:</span>
                                    <input 
                                        type="number" placeholder="값" 
                                        value={action.min} 
                                        on:change={(e) => {
                                            projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { min: Number(e.target.value) }, false);
                                            projectActions.commitHistory();
                                        }}
                                    />
                                </div>
                                <div class="action-input-group">
                                    <span class="action-label">최대:</span>
                                    <input 
                                        type="number" placeholder="값" 
                                        value={action.max} 
                                        on:change={(e) => {
                                            projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { max: Number(e.target.value) }, false);
                                            projectActions.commitHistory();
                                        }}
                                    />
                                </div>
                            {:else if action.type === 'variableDice'}
                                <select 
                                    value={story.variables.length > 0 ? action.variable : undefined} 
                                    on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { variable: e.target.value })}
                                >
                                    {#if story.variables.length > 0}
                                        {#each story.variables as v (v.name)}
                                            {#if v.type === 'Number'}
                                                <option value={v.name}>{v.name}</option>
                                            {/if}
                                        {/each}
                                    {:else}
                                        <option value="" disabled>숫자 변수 없음</option>
                                    {/if}
                                </select>
                                <div class="action-input-group">
                                    <input 
                                        type="number" placeholder="개수" 
                                        value={action.diceCount} 
                                        on:change={(e) => {
                                            projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { diceCount: Number(e.target.value) }, false);
                                            projectActions.commitHistory();
                                        }}
                                    />
                                    <span class="action-label">d</span>
                                    <input 
                                        type="number" placeholder="면체" 
                                        value={action.diceSides} 
                                        on:change={(e) => {
                                            projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { diceSides: Number(e.target.value) }, false);
                                            projectActions.commitHistory();
                                        }}
                                    />
                                </div>
                            {:else if action.type === 'characterAttribute'}
                                <select value={action.characterId} on:change={(e) => handleActionCharacterChange(choice.id, action.id, e.target.value, 'characterAttribute')}> 
                                    {#if story.characters.length > 0}
                                        {#each story.characters as char (char.id)}
                                            <option value={char.id}>{char.name}</option>
                                        {/each}
                                    {:else}
                                        <option value="" disabled>캐릭터 없음</option>
                                    {/if}
                                </select>
                                <select value={action.attribute} on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { attribute: e.target.value })}> 
                                    {#if getCharacterAttributeNames(action.characterId).length > 0}
                                        {#each getCharacterAttributeNames(action.characterId) as attr (attr)}
                                            <option value={attr}>{attr}</option>
                                        {/each}
                                    {:else}
                                        <option value="" disabled>속성 없음</option>
                                    {/if}
                                </select>
                                <select value={action.operator} on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { operator: e.target.value })}>
                                    {#each numericActionOperators as op}
                                        <option value={op}>{op}</option>
                                    {/each}
                                </select>
                                <input 
                                    type="number" placeholder="값" 
                                    value={action.value} 
                                    on:change={(e) => {
                                        projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { value: e.target.value }, false);
                                        projectActions.commitHistory();
                                    }}
                                />
                            {:else if action.type === 'characterState'}
                                <select value={action.characterId} on:change={(e) => handleActionCharacterChange(choice.id, action.id, e.target.value, 'characterState')}> 
                                    {#if story.characters.length > 0}
                                        {#each story.characters as char (char.id)}
                                            <option value={char.id}>{char.name}</option>
                                        {/each}
                                    {:else}
                                        <option value="" disabled>캐릭터 없음</option>
                                    {/if}
                                </select>
                                <select value={action.operator} on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { operator: e.target.value })}>
                                    <option value="&#43;=">상태 추가</option>
                                    <option value="-=">상태 제거</option>
                                </select>
                                <input 
                                    type="text" placeholder="상태명" 
                                    value={action.state} 
                                    on:change={(e) => {
                                        projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { state: e.target.value }, false);
                                        projectActions.commitHistory();
                                    }}
                                    list="character-states-suggestions"
                                />
                                <datalist id="character-states-suggestions">
                                    {#each story.characterStates || [] as stateName}
                                        <option value={stateName}></option>
                                    {/each}
                                </datalist>
                            {:else if action.type === 'sprite'}
                                <select value={action.characterId} on:change={(e) => handleActionCharacterChange(choice.id, action.id, e.target.value, 'sprite')}>
                                    {#if charactersWithSprites.length > 0}
                                        {#each charactersWithSprites as char (char.id)}
                                            <option value={char.id}>{char.name}</option>
                                        {/each}
                                    {:else}
                                        <option value="" disabled>캐릭터 없음</option>
                                    {/if}
                                </select>
                                <select value={action.command || 'show'} on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { command: e.target.value })}>
                                    <option value="show">보이기</option>
                                    <option value="hide">숨기기</option>
                                </select>
                                {#if action.command === 'show' || action.command === undefined}
                                    {@const targetChar = getCharacterById(action.characterId)}
                                    <select 
                                        value={(targetChar && targetChar.sprites.length > 0) ? action.spriteId : undefined}
                                        on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { spriteId: e.target.value })}>
                                        {#if targetChar && targetChar.sprites.length > 0}
                                            {#each targetChar.sprites as sprite (sprite.id)}
                                                <option value={sprite.id}>{sprite.name}</option>
                                            {/each}
                                        {:else}
                                            <option value="" disabled>스프라이트 없음</option>
                                        {/if}
                                    </select>
                                    <select value={action.position || 'center'} on:change={(e) => projectActions.updateAction(scene.id, choice.id, 'choice', action.id, { position: e.target.value })}>
                                        <option value="left">왼쪽</option>
                                        <option value="center">중앙</option>
                                        <option value="right">오른쪽</option>
                                    </select>
                                {/if}
                            {/if}
                            <button class="icon-btn danger" on:click={() => projectActions.removeAction(scene.id, choice.id, 'choice', action.id)}>
                                <Icon name="x" size={14} />
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>
            <div class="choice-buttons-container">
                <button class="subtle-btn" on:click={() => addCondition(choice.id)}>
                    <Icon name="plus" size={14} />
                    <span>조건 추가</span>
                </button>
                <button class="subtle-btn" on:click={() => projectActions.addAction(scene.id, choice.id, 'choice')}>
                    <Icon name="plus" size={14} />
                    <span>액션 추가</span>
                </button>
            </div>
        </div>
    {/each}
    <button on:click={addChoice} class="add-btn">
        <Icon name="plus" size={16} />
        <span>선택지 추가</span>
    </button>
{/if}
    <style>
    .choice-item { 
        background-color: transparent; 
        border-bottom: 1px solid var(--border-color); 
        padding: 15px 5px; 
        margin-bottom: 0; 
        position: relative; 
        transition: background-color 0.2s ease;
    }
    .choice-item:hover {
        background-color: rgba(255, 255, 255, 0.02);
    }
    .choice-item.linking { 
        background-color: color-mix(in srgb, var(--accent-color) 10%, transparent); 
        border-radius: 4px;
    }

    .choice-controls { display: flex; align-items: center; gap: 8px; }
    .choice-controls input { flex-grow: 1; }
    
    /* Flat Inputs */
    input[type="text"], select, input[type="number"] { 
        background-color: transparent; 
        color: var(--text-color); 
        border: none; 
        border-bottom: 1px solid var(--border-color);
        padding: 8px 4px; 
        border-radius: 0; 
        margin-bottom: 0; 
        box-sizing: border-box; 
        width: 100%; 
        font-family: inherit; font-size: 1em;
        transition: border-color 0.2s;
    }
    input[type="text"]:focus, select:focus, input[type="number"]:focus {
        outline: none; 
        border-bottom-color: var(--accent-color);
        box-shadow: none;
        background-color: rgba(255, 255, 255, 0.02);
    }
    
    .target-scene { 
        font-size: 0.85em; color: var(--text-color-muted); 
        padding: 4px 0 4px 6px; 
        display: flex; align-items: center; gap: 6px;
        margin-top: 4px;
    }

    .conditions-section,
    .actions-section {
        margin-top: 8px;
        padding-left: 12px;
        border-left: 2px solid var(--border-color);
    }
    
    .condition-item,
    .action-item {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
        background: rgba(255, 255, 255, 0.03);
        padding: 6px;
        border-radius: 4px;
    }
    /* Make inputs inside conditions/actions look slightly distinct */
    .condition-item input, .action-item input,
    .condition-item select, .action-item select {
        background-color: transparent;
        border: 1px solid transparent;
        border-bottom: 1px solid var(--border-color);
        font-size: 0.9em;
        height: 30px;
        padding: 2px 6px;
    }
    .condition-item input:focus, .action-item input:focus,
    .condition-item select:focus, .action-item select:focus {
        border-color: var(--accent-color);
    }

    .condition-item > *,
    .action-item > * {
        flex-grow: 1;
        flex-basis: auto;
        min-width: 60px;
    }
    .condition-item .icon-btn,
    .action-item .icon-btn {
        flex-grow: 0;
        flex-shrink: 0;
        width: 24px; height: 24px;
        min-width: 24px;
    }

    .choice-buttons-container {
        display: flex;
        gap: 10px;
        margin-top: 10px;
        opacity: 0; /* Hide by default on desktop */
        transition: opacity 0.2s;
    }
    .choice-item:hover .choice-buttons-container,
    .choice-item:focus-within .choice-buttons-container {
        opacity: 1;
    }

    @media (max-width: 768px) {
        .choice-buttons-container {
            opacity: 1; /* Always show on mobile */
            margin-top: 15px;
        }
        
        .condition-item, .action-item {
            padding: 10px;
        }

        .condition-item > *, .action-item > * {
            min-width: 120px; /* Make inputs larger on mobile */
        }
    }

    .subtle-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        background: none; border: 1px dashed var(--border-color);
        color: var(--text-color-muted);
        border-radius: 4px;
        cursor: pointer; padding: 6px 12px;
        transition: all 0.2s; font-size: 0.85em;
    }
    .subtle-btn:hover { color: var(--accent-color); border-color: var(--accent-color); background: rgba(255,255,255,0.02); }

    .icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        background-color: transparent; border: none;
        color: var(--text-color-muted); width: 32px; height: 32px;
        padding: 0; border-radius: 4px; cursor: pointer;
        transition: all 0.2s;
    }
    .icon-btn:hover { background-color: rgba(255,255,255,0.1); color: var(--text-color); }
    .icon-btn.danger:hover { background-color: rgba(255,0,0,0.1); color: var(--danger-color); }

    .add-btn { 
        display: flex; align-items: center; justify-content: center; gap: 8px;
        background-color: transparent; color: var(--accent-color); 
        border: 1px dashed var(--border-color); padding: 12px; 
        border-radius: 4px; cursor: pointer; width: 100%; 
        font-weight: 500; margin-top: 20px; transition: all 0.2s;
    }
    .add-btn:hover { background-color: rgba(var(--accent-rgb), 0.05); border-color: var(--accent-color); }

    .action-label {
        font-size: 0.85em; color: var(--text-color-muted); margin-right: 4px;
    }
    .action-input-group {
        display: flex; align-items: center; flex-grow: 1;
    }
</style>