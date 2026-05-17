<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { projectActions, activeStory, uiState, confirmation } from './stores.js';
  import Icon from './Icon.svelte';

  const dispatch = createEventDispatcher();

  let story;
  activeStory.subscribe(s => story = s);

  let localIncapacitatedStates = new Set(story?.incapacitatedStates || []);
  let localPlotHoleStates = new Set(story?.plotHoleStates || []);
  let editingState = null; // The name of the state being edited
  let editingValue = '';
  let editingInput;
  let newStateName = '';
  let searchResults = null; // { stateName: string, usages: array }

  function handleCheckboxChange(stateName, checked) {
    if (checked) {
      localIncapacitatedStates.add(stateName);
    } else {
      localIncapacitatedStates.delete(stateName);
    }
    projectActions.updateActiveStory(s => ({
      ...s,
      incapacitatedStates: Array.from(localIncapacitatedStates).sort()
    }));
  }

  function handlePlotHoleCheckboxChange(stateName, checked) {
    if (checked) {
      localPlotHoleStates.add(stateName);
    } else {
      localPlotHoleStates.delete(stateName);
    }
    projectActions.updateActiveStory(s => ({
      ...s,
      plotHoleStates: Array.from(localPlotHoleStates).sort()
    }));
  }

  function handleAddNewState() {
    if (newStateName.trim()) {
      projectActions.addCharacterState(newStateName);
      newStateName = '';
    }
  }

  async function startEditing(stateName) {
    editingState = stateName;
    editingValue = stateName;
    await tick();
    editingInput?.focus();
  }

  function cancelEditing() {
    editingState = null;
    editingValue = '';
  }

  function handleRenameState() {
    if (editingState && editingValue.trim() && editingState !== editingValue.trim()) {
      projectActions.renameCharacterState(editingState, editingValue);
    }
    cancelEditing();
  }

  function handleDeleteState(stateName) {
    confirmation.prompt(
      `'${stateName}' 상태를 정말로 삭제하시겠습니까? 이 상태를 사용하는 모든 액션과 조건이 프로젝트에서 제거됩니다. 이 작업은 되돌릴 수 없습니다.`,
      () => projectActions.deleteCharacterState(stateName)
    );
  }

  function findStateUsages(stateName) {
    const usages = [];
    if (!story || !story.scenes) {
      searchResults = { stateName, usages: [] };
      return;
    }

    for (const scene of Object.values(story.scenes)) {
      // Check dialogue actions
      (scene.content || []).forEach(item => {
        if (item.type === 'dialogue' && item.actions) {
          item.actions.forEach(action => {
            if (action.type === 'characterState' && action.state === stateName) {
              usages.push({ sceneId: scene.id, sceneName: scene.name, type: '대사 액션', context: `"${item.text.substring(0, 20)}..."` });
            }
          });
        }
      });

      // Check choice conditions and actions
      (scene.choices || []).forEach(choice => {
        if (choice.conditions) {
          choice.conditions.forEach(cond => {
            if (cond.type === 'characterState' && cond.value === stateName) {
              usages.push({ sceneId: scene.id, sceneName: scene.name, type: '선택지 조건', context: `"${choice.text.substring(0, 20)}..."` });
            }
          });
        }
        if (choice.actions) {
          choice.actions.forEach(action => {
            if (action.type === 'characterState' && action.state === stateName) {
              usages.push({ sceneId: scene.id, sceneName: scene.name, type: '선택지 액션', context: `"${choice.text.substring(0, 20)}..."` });
            }
          });
        }
      });
    }
    searchResults = { stateName, usages };
  }

  function goToScene(sceneId) {
    projectActions.selectScene(sceneId);
    close();
  }

  function close() {
    dispatch('close');
  }
</script>

<style>
  .modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.6); display: flex;
    justify-content: center; align-items: center; z-index: 1001;
  }
  .modal-content {
    background-color: var(--sidebar-bg); padding: 25px;
    border-radius: var(--border-radius-lg); width: 90%;
    max-width: 700px; max-height: 80vh; display: flex;
    flex-direction: column; box-shadow: var(--box-shadow-lg);
  }
  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 20px; padding-bottom: 15px;
    border-bottom: 1px solid var(--border-color);
  }
  .modal-header h2 { margin: 0; font-size: 1.4em; }
  .close-btn {
    background: none; border: none; cursor: pointer; color: var(--text-color-muted);
    padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    transition: all var(--transition-speed);
  }
  .close-btn:hover { background-color: var(--primary-bg); color: var(--text-color); }
  
  .modal-body { display: flex; gap: 20px; overflow: hidden; flex-grow: 1; }
  .state-list-container, .usage-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  
  .add-state-form {
    display: flex; gap: 8px; margin-bottom: 15px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 5px;
    background-color: var(--primary-bg);
  }
  .add-state-form input {
    flex-grow: 1; border: none; background: none; color: var(--text-color);
    padding: 4px 8px; font-size: 1em;
  }
  .add-state-form input:focus { outline: none; }
  .add-state-form .primary-btn {
    background-color: var(--accent-color); color: white; border: none;
    padding: 6px 12px; border-radius: var(--border-radius-sm); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all var(--transition-speed);
  }
  .add-state-form .primary-btn:hover { background-color: var(--accent-color-dark); }
  
  .state-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex-grow: 1; }
  .state-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 8px; border-radius: var(--border-radius);
    transition: background-color 0.2s;
    margin-bottom: 4px;
  }
  .state-item:hover { background-color: var(--hover-bg); }
  
  .state-name-display {
    display: flex; align-items: center; gap: 16px; flex-grow: 1;
    color: var(--text-color);
  }
  .checkbox-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.9em; color: var(--text-color-muted);
    cursor: pointer;
  }
  .checkbox-label input[type="checkbox"] {
    width: 16px; height: 16px; accent-color: var(--accent-color);
    cursor: pointer;
  }
  .state-name-text {
    font-weight: 500;
    margin-left: auto; /* Push the name to the right */
  }
  
  .editing-form {
    display: flex; align-items: center; gap: 6px; flex-grow: 1;
    background-color: var(--primary-bg); border-radius: var(--border-radius);
    padding: 2px;
  }

  .state-actions {
    display: flex; gap: 4px;
  }
  .state-actions button {
    background: none; border: none; color: var(--text-color-muted);
    cursor: pointer; padding: 4px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px;
    transition: all var(--transition-speed);
  }
  .state-actions button:hover {
    background-color: var(--primary-bg); color: var(--accent-color);
  }
  .state-actions button[title="삭제"]:hover { color: var(--danger-color); }
  
  .usage-container {
    border-left: 1px solid var(--border-color);
    padding-left: 20px;
    display: flex;
    flex-direction: column;
  }
  .usage-container h4 {
    margin-top: 0; margin-bottom: 15px;
    font-size: 1.2em; color: var(--text-color);
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-color);
  }
  .usage-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex-grow: 1; }
  .usage-item {
    padding: 10px 12px; border-radius: var(--border-radius); margin-bottom: 8px;
    background-color: var(--primary-bg); border: 1px solid var(--border-color);
    transition: all var(--transition-speed);
  }
  .usage-item:hover { background-color: var(--hover-bg); border-color: var(--accent-color); }
  .usage-item button {
    background: none; border: none; color: inherit; font: inherit;
    text-align: left; padding: 0; cursor: pointer; width: 100%;
  }
  .usage-item strong { color: var(--accent-color); font-weight: 600; }
  .usage-context { font-size: 0.85em; color: var(--text-color-muted); margin-top: 4px; }

  .no-states, .no-usages {
    text-align: center; padding: 40px 20px;
    color: var(--text-color-muted); font-size: 0.95em;
    background-color: var(--primary-bg);
    border-radius: var(--border-radius);
    border: 1px dashed var(--border-color);
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .no-states p, .no-usages p { margin: 5px 0; }
</style>

<div class="modal-overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close} role="button" tabindex="0">
  <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" aria-labelledby="state-manager-title">
    <div class="modal-header">
      <h2 id="state-manager-title">상태 관리자</h2>
      <button class="close-btn" on:click={close}><Icon name="x" size={24} /></button>
    </div>
    <div class="modal-body">
      <div class="state-list-container">
        <form class="add-state-form" on:submit|preventDefault={handleAddNewState}>
          <input type="text" placeholder="새 상태 이름..." bind:value={newStateName} />
          <button type="submit" class="primary-btn"><Icon name="plus" size={16}/></button>
        </form>

        {#if story && story.characterStates && story.characterStates.length > 0}
          <ul class="state-list">
            {#each story.characterStates as stateName (stateName)}
              <li class="state-item">
                {#if editingState === stateName}
                  <form class="editing-form" on:submit|preventDefault={handleRenameState}>
                    <input type="text" bind:value={editingValue} on:keydown={(e) => e.key === 'Escape' && cancelEditing()} bind:this={editingInput} />
                    <button type="submit" class="icon-btn"><Icon name="check" size={16}/></button>
                    <button type="button" class="icon-btn" on:click={cancelEditing}><Icon name="x" size={16}/></button>
                  </form>
                {:else}
                  <div class="state-name-display">
                    <label class="checkbox-label" title="이 상태의 캐릭터가 대사를 하면 오류로 간주합니다.">
                      <input 
                        type="checkbox" 
                        checked={localIncapacitatedStates.has(stateName)}
                        on:change={(e) => handleCheckboxChange(stateName, e.currentTarget.checked)}
                      />
                      <span>행동 불능</span>
                    </label>
                    <label class="checkbox-label" title="이 상태가 부여된 후 제거되지 않고 이야기가 끝나면 경고합니다.">
                      <input 
                        type="checkbox" 
                        checked={localPlotHoleStates.has(stateName)}
                        on:change={(e) => handlePlotHoleCheckboxChange(stateName, e.currentTarget.checked)}
                      />
                      <span>해결 추적</span>
                    </label>
                    <span class="state-name-text">{stateName}</span>
                  </div>
                  <div class="state-actions">
                    <button title="사용처 찾기" on:click={() => findStateUsages(stateName)}><Icon name="search" size={16} /></button>
                    <button title="이름 바꾸기" on:click={() => startEditing(stateName)}><Icon name="edit-2" size={16} /></button>
                    <button title="삭제" on:click={() => handleDeleteState(stateName)}><Icon name="trash-2" size={16} /></button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <div class="no-states">
            <p>아직 추가된 캐릭터 상태가 없습니다냥.</p>
          </div>
        {/if}
      </div>

      <div class="usage-container">
        {#if searchResults}
          <h4>'{searchResults.stateName}' 사용처</h4>
          {#if searchResults.usages.length > 0}
            <ul class="usage-list">
              {#each searchResults.usages as usage}
                <li class="usage-item">
                  <button on:click={() => goToScene(usage.sceneId)}>
                    <strong>{usage.sceneName}</strong>
                    <div class="usage-context">{usage.type} - {usage.context}</div>
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <div class="no-usages">
              <p>이 상태는 아직 사용되지 않고 있습니다냥.</p>
            </div>
          {/if}
        {:else}
          <div class="no-usages">
            <p>왼쪽 목록에서 돋보기(🔍) 아이콘을 눌러 상태가 사용된 위치를 찾아보세요.</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>