<script>
  import { createEventDispatcher } from 'svelte';
  import { activeStory, projectActions, annotationSelection } from './stores.js';
  import Icon from './Icon.svelte';

  const dispatch = createEventDispatcher();

  let allAnnotations = [];
  let expandedId = null;

  $: {
    if ($activeStory && $activeStory.scenes) {
      const annotations = [];
      for (const scene of Object.values($activeStory.scenes)) {
        const baseId = `scene-${scene.id}`;
        if (scene.comment && scene.comment.trim()) {
          annotations.push({
            id: baseId,
            type: 'scene',
            sceneId: scene.id,
            sceneName: scene.name,
            content: scene.comment,
          });
        }
        for (const item of scene.content) {
          if (item.type === 'dialogue' && item.comment && item.comment.trim()) {
            annotations.push({
              id: `dialogue-${item.id}`,
              type: 'dialogue',
              sceneId: scene.id,
              sceneName: scene.name,
              dialogueId: item.id,
              dialogueText: item.text,
              character: item.character,
              content: item.comment,
            });
          }
        }
      }
      allAnnotations = annotations;
    } else {
      allAnnotations = [];
    }
  }

  function gotoAnnotation(annotation) {
    projectActions.selectScene(annotation.sceneId);
    dispatch('close');
  }

  function selectAnnotation(annotation) {
    annotationSelection.completeSelection(annotation.id);
  }

  function getPreview(text, maxLength = 40) {
    if (!text) return '...';
    const trimmed = text.trim();
    return trimmed.length > maxLength ? `${trimmed.substring(0, maxLength)}...` : trimmed;
  }

  function toggleExpand(id) {
    expandedId = expandedId === id ? null : id;
  }

  function handleClose() {
    if ($annotationSelection.isSelecting) {
      annotationSelection.cancelSelection();
    }
    dispatch('close');
  }

  // Wiki Creation Logic
  let createWikiOverlay = {
      isOpen: false,
      annotationId: null,
      name: '',
      type: 'lore'
  };

  function openCreateWiki(annotation) {
      createWikiOverlay = {
          isOpen: true,
          annotationId: annotation.id,
          name: '', // User must input name
          type: 'lore'
      };
  }
  
  function confirmCreateWiki() {
      if (!createWikiOverlay.name.trim()) return;
      projectActions.createWikiFromAnnotation(createWikiOverlay.type, createWikiOverlay.name, createWikiOverlay.annotationId);
      createWikiOverlay.isOpen = false;
  }
</script>

<div class="modal-overlay" on:click={handleClose} on:keydown|self={(e) => e.key === 'Escape' && handleClose()} role="dialog" aria-modal="true" aria-labelledby="annotation-manager-title">
  <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation role="document">
    <div class="modal-header">
      <div class="header-content">
        <h2 id="annotation-manager-title">주석 관리자</h2>
        {#if $annotationSelection.isSelecting}
          <span class="selection-mode-indicator">위키 항목에 연결할 주석을 선택하세요...</span>
        {/if}
      </div>
      <button class="close-button" on:click={handleClose}>
        <Icon name="close" />
      </button>
    </div>
    <div class="modal-body">
      {#if allAnnotations.length > 0}
        <div class="table-container">
          <table class="annotation-table">
            <thead>
              <tr>
                <th class="type-col">종류</th>
                <th class="source-col">출처</th>
                <th class="content-col">내용</th>
                <th class="actions-col">액션</th>
              </tr>
            </thead>
            <tbody>
              {#each allAnnotations as annotation (annotation.id)}
                <tr class="annotation-row">
                  <td class="type-col">
                    {#if annotation.type === 'scene'}
                      <Icon name="clipboard" size={16} title="씬 메모" />
                    {:else}
                      <Icon name="message-circle" size={16} title="대사 주석" />
                    {/if}
                  </td>
                  <td class="source-col">
                    <div class="source-content">
                      <span class="scene-name">[{annotation.sceneName}]</span>
                      {#if annotation.type === 'dialogue'}
                        <span class="dialogue-preview">"{getPreview(annotation.dialogueText, 20)}"</span>
                      {/if}
                    </div>
                  </td>
                  <td class="content-col">
                    <span class="content-preview">{getPreview(annotation.content)}</span>
                  </td>
                  <td class="actions-col">
                    <button class="action-btn" on:click={() => toggleExpand(annotation.id)} title="내용 보기">
                      <Icon name={expandedId === annotation.id ? 'chevron-up' : 'chevron-down'} size={16} />
                    </button>
                    {#if $annotationSelection.isSelecting}
                      <button class="action-btn select-btn" on:click={() => selectAnnotation(annotation)} title="이 주석 선택">
                        <Icon name="check-circle" size={16} />
                      </button>
                    {:else}
                      <button class="action-btn" on:click={() => gotoAnnotation(annotation)} title="주석으로 이동">
                        <Icon name="arrow-right-circle" size={16} />
                      </button>
                      <button class="action-btn" on:click={() => openCreateWiki(annotation)} title="위키 항목 생성">
                        <Icon name="book-open" size={16} />
                      </button>
                    {/if}
                  </td>
                </tr>
                {#if expandedId === annotation.id}
                  <tr class="expanded-row">
                    <td colspan="4">
                      <div class="expanded-content">
                        <textarea readonly>{annotation.content}</textarea>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="empty-state">
          <Icon name="info" size={24} />
          <p>아직 작성된 주석이 없다냥.</p>
          <p class="small-text">씬 노드나 대화 블록에서 주석을 추가해보라냥!</p>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if createWikiOverlay.isOpen}
    <div class="overlay-backdrop">
        <div class="overlay-content">
             <h3>위키 항목 생성</h3>
             <div class="field">
                <label for="new-wiki-name">이름</label>
                <input id="new-wiki-name" type="text" bind:value={createWikiOverlay.name} placeholder="항목 이름" />
             </div>
             <div class="field">
                <label for="new-wiki-type">종류</label>
                <select id="new-wiki-type" bind:value={createWikiOverlay.type}>
                    <option value="lore">지식 (Lore)</option>
                    <option value="character">인물</option>
                    <option value="location">장소</option>
                    <option value="item">아이템</option>
                    <option value="group">단체</option>
                </select>
             </div>
             <div class="overlay-actions">
                <button on:click={() => createWikiOverlay.isOpen = false}>취소</button>
                <button class="primary" on:click={confirmCreateWiki}>생성</button>
             </div>
        </div>
    </div>
{/if}

<style>
  .modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.6); display: flex;
    justify-content: center; align-items: center; z-index: 1002;
  }
  .modal-content {
    background-color: var(--sidebar-bg); 
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-xl); 
    width: 90%;
    max-width: 900px; 
    max-height: 85vh; 
    display: flex; 
    flex-direction: column;
    z-index: 1003;
    border: 1px solid var(--border-color);
  }
  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 24px; 
    border-bottom: 1px solid var(--border-color); 
    flex-shrink: 0;
  }
  .header-content {
    display: flex;
    align-items: baseline;
    gap: 16px;
  }
  .modal-header h2 { 
    margin: 0; 
    font-size: 1.4em; 
    color: var(--text-color); 
  }
  .selection-mode-indicator {
    font-size: 0.9em;
    color: var(--accent-color);
    font-weight: 500;
  }
  .close-button {
    background: none; 
    border: none; 
    cursor: pointer;
    color: var(--text-color-muted); 
    padding: 4px;
  }
  .close-button:hover { 
    color: var(--text-color); 
  }
  .modal-body { 
    padding: 0; 
    overflow-y: auto; 
    color: var(--text-color-muted); 
  }

  .table-container { padding: 8px; }
  .annotation-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .annotation-table th {
    text-align: left;
    padding: 12px 16px;
    background-color: var(--primary-bg);
    border-bottom: 2px solid var(--accent-color);
    font-size: 0.9em;
    color: var(--text-color);
  }
  .annotation-row td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }
  .type-col { width: 8%; text-align: center; }
  .source-col { width: 32%; }
  .content-col { width: 45%; }
  .actions-col { width: 15%; text-align: right; }

  .source-content { display: flex; flex-direction: column; gap: 2px; }
  .scene-name { 
    font-weight: bold; 
    color: var(--text-color); 
  }
  .dialogue-preview { 
    font-size: 0.85em; 
    color: var(--text-color-muted); 
    font-style: italic; 
  }
  .content-preview { 
    font-size: 0.9em; 
    color: var(--text-color); 
  }

  .actions-col { white-space: nowrap; }
  .action-btn {
    background: none; 
    border: 1px solid transparent; 
    color: var(--text-color-muted);
    cursor: pointer; 
    padding: 6px; 
    border-radius: var(--border-radius);
    margin-left: 4px; 
    transition: all 0.2s;
  }
  .action-btn:hover { 
    background-color: var(--primary-bg); 
    color: var(--text-color); 
  }
  .action-btn.select-btn:hover {
    color: var(--accent-color);
    border-color: var(--accent-color);
    background-color: transparent;
  }

  .expanded-row td { padding: 0; }
  .expanded-content {
    padding: 16px;
    background-color: var(--secondary-bg);
  }
  .expanded-content textarea {
    width: 100%; 
    height: 100px; 
    background: none; 
    border: none;
    color: var(--text-color); 
    font-family: inherit; 
    resize: none;
  }

  .empty-state {
    display: flex; 
    flex-direction: column; 
    align-items: center;
    justify-content: center; 
    padding: 48px; 
    text-align: center; 
    color: var(--text-color-muted);
  }
  .empty-state p { 
    margin: 0; 
    font-size: 1.1em; 
  }
  .empty-state .small-text { 
    font-size: 0.9em; 
    margin-top: 8px; 
  }

  /* Overlay Styles */
  .overlay-backdrop {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.7); display: flex;
    justify-content: center; align-items: center; z-index: 1100;
  }
  .overlay-content {
    background-color: var(--primary-bg);
    border-radius: 8px;
    padding: 20px;
    width: 400px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    display: flex; flex-direction: column; gap: 15px;
    color: var(--text-color);
  }
  .overlay-content h3 { margin: 0 0 10px 0; font-size: 1.2em; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field label { font-size: 0.9em; color: var(--text-color-muted); }
  .field input, .field select {
      padding: 8px;
      border: 1px solid var(--border-color);
      background: var(--secondary-bg);
      color: var(--text-color);
      border-radius: 4px;
  }
  .overlay-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
  .overlay-actions button {
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-color);
      border-radius: 4px;
      cursor: pointer;
  }
  .overlay-actions button.primary {
      background: var(--accent-color);
      border-color: var(--accent-color);
      color: white;
  }
</style>
