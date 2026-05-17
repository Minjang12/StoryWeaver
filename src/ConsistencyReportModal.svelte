<script>
  import { createEventDispatcher } from 'svelte';
  import { uiState, projectActions, activeStory } from './stores.js';
  import Icon from './Icon.svelte';
  import { slide } from 'svelte/transition';

  export let issues = [];

  const dispatch = createEventDispatcher();

  let story;
  activeStory.subscribe(s => story = s);

  let expandedIssueId = null;
  let showSettings = false;

  // Default settings in case they don't exist on the story object yet
  const defaultSettings = {
    unreachableConditions: true,
    logicalContradictions: true,
    incapacitatedDialogue: true,
    unresolvedStates: true,
    meaninglessChoices: true,
  };

  let settings = { ...(story?.consistencyCheckSettings || defaultSettings) };

  const settingLabels = {
    unreachableConditions: '도달 불가능한 조건',
    logicalContradictions: '논리 오류',
    incapacitatedDialogue: '행동 불능 중 대사',
    unresolvedStates: '해결되지 않은 상태',
    meaninglessChoices: '의미 없는 선택지',
  };

  const issueTypeToSettingKey = {
    '도달 불가능한 조건': 'unreachableConditions',
    '논리 오류': 'logicalContradictions',
    '오류': 'incapacitatedDialogue', // This maps the generic '오류' to the specific setting
    '해결되지 않은 상태': 'unresolvedStates',
    '의미 없는 선택지': 'meaninglessChoices',
  };

  let filteredIssues = [];
  $: filteredIssues = issues.filter(issue => {
    const settingKey = issueTypeToSettingKey[issue.type];
    return settingKey ? settings[settingKey] : true; // Show if setting is on or if type is unmapped
  });

  $: issuesByType = filteredIssues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = [];
    acc[issue.type].push(issue);
    return acc;
  }, {});

  function toggleSetting(key) {
    settings[key] = !settings[key];
    projectActions.updateActiveStory(s => ({
      ...s,
      consistencyCheckSettings: { ...s.consistencyCheckSettings, ...settings }
    }));
  }

  function toggleDebugView(issue) {
    expandedIssueId = expandedIssueId === issue.message ? null : issue.message;
  }

  function close() {
    dispatch('close');
  }

  function goToSceneAndClose(sceneId) {
    projectActions.selectScene(sceneId);
    close();
  }

  function setHighlight(path) {
    if (path && path.length > 0) uiState.setHighlightedPath(path);
  }

  function clearHighlight() {
    uiState.clearHighlightedPath();
  }
</script>

<style>
  .modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.6); display: flex;
    justify-content: center; align-items: center; z-index: 1000;
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
  .header-actions { display: flex; align-items: center; gap: 8px; }
  .icon-btn { background: none; border: none; cursor: pointer; color: var(--text-color-muted); padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
  .icon-btn:hover { background-color: var(--hover-bg); }
  
  .settings-panel {
    padding: 15px 20px;
    background-color: var(--primary-bg);
    border-bottom: 1px solid var(--border-color);
  }
  .settings-panel h4 { margin-top: 0; margin-bottom: 12px; font-size: 1em; }
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
  }
  .checkbox-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.9em; cursor: pointer;
    padding: 5px; border-radius: var(--border-radius);
  }
  .checkbox-label:hover { background-color: var(--hover-bg); }
  .checkbox-label input { accent-color: var(--accent-color); }

  .modal-body { overflow-y: auto; padding-right: 10px; }
  .issue-group { margin-bottom: 20px; }
  .issue-group h3 {
    margin-top: 0; margin-bottom: 10px; font-size: 1.1em;
    color: var(--accent-color);
  }
  .issue-item {
    background-color: var(--primary-bg);
    border-radius: var(--border-radius);
    margin-bottom: 10px;
    transition: background-color 0.2s;
  }
  .issue-item:hover { background-color: var(--hover-bg); }
  
  .issue-summary {
    padding: 15px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .issue-details {
    color: var(--text-color-muted);
    margin-top: 5px;
  }
  .issue-scene { font-weight: 600; color: var(--text-color); }
  
  .debug-btn {
    background: none; border: 1px solid var(--border-color);
    color: var(--text-color-muted); font-size: 0.8em;
    padding: 4px 8px; border-radius: var(--border-radius);
    cursor: pointer; transition: all 0.2s;
  }
  .debug-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }

  .debug-info {
    padding: 15px;
    border-top: 1px solid var(--border-color);
    background-color: var(--secondary-bg);
  }
  .debug-info h4 { margin-top: 0; margin-bottom: 10px; }
  .debug-timeline { list-style: none; padding: 0; margin: 0; position: relative; }
  .debug-timeline::before {
    content: ''; position: absolute;
    left: 10px; top: 5px; bottom: 5px;
    width: 2px; background-color: var(--border-color);
  }
  .timeline-item {
    position: relative; padding-left: 30px; margin-bottom: 12px;
  }
  .timeline-item::before {
    content: ''; position: absolute;
    left: 4px; top: 5px; width: 14px; height: 14px;
    background-color: var(--sidebar-bg);
    border: 2px solid var(--accent-color);
    border-radius: 50%; z-index: 1;
  }
  .timeline-item:first-child::before { border-color: var(--success-color); }
  .timeline-reason { font-weight: 500; }
  .timeline-context { font-size: 0.85em; color: var(--text-color-muted); }

  .no-issues {
    text-align: center; padding: 40px;
    color: var(--text-color-muted);
  }
</style>

<div class="modal-overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()} tabindex="0" role="button">
  <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation role="none">
    <div class="modal-header">
      <h2>정합성 검사 보고서</h2>
      <div class="header-actions">
        <button class="icon-btn" title="검사 항목 필터" on:click={() => showSettings = !showSettings}>
          <Icon name="filter" size={20} />
        </button>
        <button class="icon-btn" on:click={close}><Icon name="x" size={24} /></button>
      </div>
    </div>

    {#if showSettings}
      <div class="settings-panel" transition:slide={{ duration: 200 }}>
        <h4>표시할 경고 유형</h4>
        <div class="settings-grid">
          {#each Object.entries(settingLabels) as [key, label]}
            <label class="checkbox-label">
              <input type="checkbox" checked={settings[key]} on:change={() => toggleSetting(key)} />
              {label}
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <div class="modal-body">
      {#if issues.length === 0}
        <div class="no-issues">
          <Icon name="check-circle" size={48} />
          <p>축하합니다! 발견된 논리적 모순점이 없습니다냥.</p>
        </div>
      {:else if filteredIssues.length === 0}
        <div class="no-issues">
          <Icon name="info" size={48} />
          <p>현재 필터 설정으로는 표시할 경고가 없습니다냥.</p>
        </div>
      {:else}
        {#each Object.entries(issuesByType) as [type, issueList]}
          <div class="issue-group">
            <h3>{type} ({issueList.length})</h3>
            {#each issueList as issue (issue.message)}
              <div 
                class="issue-item" 
                on:mouseenter={() => setHighlight(issue.path)}
                on:mouseleave={clearHighlight}
              >
                <div 
                  class="issue-summary"
                  on:click={() => goToSceneAndClose(issue.sceneId)} 
                  on:keydown={(e) => e.key === 'Enter' && goToSceneAndClose(issue.sceneId)}
                  role="button" tabindex="0"
                >
                  <div>
                    <div class="issue-scene">씬: {issue.sceneName}</div>
                    <div class="issue-details">{issue.message}</div>
                  </div>
                  {#if issue.debugInfo}
                    <button class="debug-btn" on:click|stopPropagation={() => toggleDebugView(issue)}>
                      {expandedIssueId === issue.message ? '숨기기' : '상세 분석'}
                    </button>
                  {/if}
                </div>

                {#if expandedIssueId === issue.message && issue.debugInfo}
                  <div class="debug-info">
                    <h4>'{issue.debugInfo.variable}' 변수 추적</h4>
                    <ul class="debug-timeline">
                      {#each issue.debugInfo.history as step}
                        <li class="timeline-item">
                          <div class="timeline-reason">{step.reason} &rarr; <strong>{step.value}</strong></div>
                          <div class="timeline-context">({step.sceneName || '시작'})</div>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>
