<script>
  import { writable, derived } from 'svelte/store';
  import { onMount } from 'svelte';
  import { activeStory, uiState, projectActions } from './stores.js';
  import { analyzeStory, calculateTimelineLayout, checkStoryConsistency, analyzeVariableRanges } from './utils.js';
  import Icon from './Icon.svelte';
  import ConsistencyReportModal from './ConsistencyReportModal.svelte';
  import SceneTooltip from './SceneTooltip.svelte';

  let timelineScenes = [];
  let timelineSequences = [];
  let containerWidth = 8000;
  let containerHeight = 4000;
  let viewTransform = { x: 0, y: 0, scale: 1 };

  let container;
  let isPanning = false;
  let lastMousePos = { x: 0, y: 0 };

  let showConsistencyReport = false;
  let consistencyIssues = [];
  let highlightedSceneId = null;

  // --- Tooltip State ---
  let tooltipVisible = false;
  let hoveredScene = null;
  let tooltipPosition = { x: 0, y: 0 };
  let hoverTimeout;

  // --- Analysis State ---
  let selectedAnalysis = 'none';
  let analysisData = null;
  let densityData = {};
  let numericVariables = [];
  let charactersWithNumericAttributes = [];

  const storyData = derived(activeStory, ($activeStory) => {
      if (!$activeStory) return { numericVariables: [], charactersWithNumericAttributes: [] };
      
      const numericVars = $activeStory.variables.filter(v => v.type === 'Number');
      
      const charsWithAttrs = $activeStory.characters.map(c => {
          const numericAttrs = {};
          for (const key in c.attributes) {
              if (typeof c.attributes[key] === 'number') {
                  numericAttrs[key] = c.attributes[key];
              }
          }
          return { ...c, attributes: numericAttrs };
      }).filter(c => Object.keys(c.attributes).length > 0);

      return { numericVariables: numericVars, charactersWithNumericAttributes: charsWithAttrs };
  });

  storyData.subscribe(data => {
      numericVariables = data.numericVariables;
      charactersWithNumericAttributes = data.charactersWithNumericAttributes;
  });

  function runAnalysis() {
      densityData = {};
      analysisData = null;

      if (selectedAnalysis === 'none') return;
      
      const [type, ...rest] = selectedAnalysis.split('-');
      
      if (type === 'var' || type === 'char') {
          let target;
          if (type === 'var') {
              target = { type: 'variable', name: rest[0] };
          } else {
              target = { type: 'characterAttribute', characterId: rest[0], attribute: rest[1] };
          }
          analysisData = analyzeVariableRanges($activeStory, target);
      } else if (type === 'density') {
          const metric = rest[0];
          const storyAnalysis = analyzeStory($activeStory);
          const values = storyAnalysis.scenes.map(s => s[metric]);
          const max = Math.max(...values);
          
          storyAnalysis.scenes.forEach(scene => {
              densityData[scene.id] = max > 0 ? scene[metric] / max : 0;
          });
      }
  }


  let analysisGraphPath = '';
  let analysisLinePath = '';

  $: {
      if (analysisData) {
          const scenesWithData = timelineScenes
              .map(scene => ({ ...scene, data: analysisData[scene.id] }))
              .filter(scene => scene.data && scene.data.min !== null)
              .sort((a, b) => a.depth - b.depth || a.y_order - b.y_order);

          if (scenesWithData.length > 1) {
              let globalMin = Infinity;
              let globalMax = -Infinity;
              scenesWithData.forEach(scene => {
                  if (scene.data.min < globalMin) globalMin = scene.data.min;
                  if (scene.data.max > globalMax) globalMax = scene.data.max;
              });

              const yRange = Math.max(10, globalMax - globalMin); 
              const getY = (value) => containerHeight - ((value - globalMin) / yRange * (containerHeight - 200)) - 100;

              const points = scenesWithData.map(scene => ({
                  x: scene.x + 90, // Center of the node
                  yMin: getY(scene.data.min),
                  yMax: getY(scene.data.max)
              }));

              const upperPath = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x},${p.yMax}`).join(' ');
              const lowerPath = points.reverse().map((p, i) => 'L' + `${p.x},${p.yMin}`).join(' ');
              
              if (points.length > 0 && points[0].yMin !== points[0].yMax) {
                  analysisGraphPath = `${upperPath} ${lowerPath} Z`;
                  analysisLinePath = '';
              } else {
                  analysisLinePath = upperPath;
                  analysisGraphPath = '';
              }
          } else {
              analysisGraphPath = '';
              analysisLinePath = '';
          }
      } else {
          analysisGraphPath = '';
          analysisLinePath = '';
      }
  }

  function updateLayout() {
    if (!$activeStory) return;
    const layout = calculateTimelineLayout($activeStory.scenes, $activeStory.connections, $activeStory.sequences);
    timelineScenes = layout.scenes;
    timelineSequences = layout.sequences;
    containerWidth = layout.width;
    containerHeight = layout.height;
    runAnalysis(); // Re-run analysis on layout update
  }

  activeStory.subscribe(story => {
    if (story) updateLayout();
  });

  onMount(() => {
    updateLayout();
  });

  function handleMouseDown(event) {
    // Allow Left Click (0) or Middle Click (1) for panning
    if (event.button !== 0 && event.button !== 1) return;
    
    isPanning = true;
    lastMousePos = { x: event.clientX, y: event.clientY };
    container.style.cursor = 'grabbing';
  }

  function handleMouseMove(event) {
    if (isPanning) {
        const dx = event.clientX - lastMousePos.x;
        const dy = event.clientY - lastMousePos.y;
        lastMousePos = { x: event.clientX, y: event.clientY };
        viewTransform.x += dx;
        viewTransform.y += dy;
    }
    updateTooltipPosition(event);
  }

  function handleMouseUp() {
    isPanning = false;
    container.style.cursor = 'grab';
  }

  function handleWheel(event) {
    event.preventDefault();
    const scaleAmount = -event.deltaY * 0.001;
    const newScale = Math.max(0.1, Math.min(2, viewTransform.scale + scaleAmount));
    
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    viewTransform.x = mouseX - (mouseX - viewTransform.x) * (newScale / viewTransform.scale);
    viewTransform.y = mouseY - (mouseY - viewTransform.y) * (newScale / viewTransform.scale);
    viewTransform.scale = newScale;
  }

  function handleSceneClick(sceneId) {
    projectActions.selectScene(sceneId);
  }

  function runConsistencyCheck() {
    consistencyIssues = checkStoryConsistency($activeStory);
    showConsistencyReport = true;
  }

  function handleHighlight(event) {
    const sceneId = event.detail;
    const scene = timelineScenes.find(s => s.id === sceneId);
    if (scene) {
        viewTransform.x = -scene.x * viewTransform.scale + container.clientWidth / 2;
        viewTransform.y = -scene.y * viewTransform.scale + container.clientHeight / 2;
        highlightedSceneId = sceneId;
        setTimeout(() => highlightedSceneId = null, 2000);
    }
    showConsistencyReport = false;
  }

  function handleNodeMouseEnter(scene) {
      if (isPanning) return;
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
          hoveredScene = scene;
          tooltipVisible = true;
      }, 500);
  }

  function handleNodeMouseLeave() {
      clearTimeout(hoverTimeout);
      tooltipVisible = false;
      hoveredScene = null;
  }

  function updateTooltipPosition(event) {
      if (!tooltipVisible || !container) return;
      const rect = container.getBoundingClientRect();
      const TOOLTIP_OFFSET = 15;
      tooltipPosition = { 
          x: event.clientX - rect.left + TOOLTIP_OFFSET, 
          y: event.clientY - rect.top + TOOLTIP_OFFSET 
      };
  }
</script>

<style>
  .timeline-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background-color: var(--canvas-bg);
    cursor: grab;
  }
  .timeline-container:active {
    cursor: grabbing;
  }
  .timeline-controls {
    position: absolute;
    top: 15px;
    right: 15px;
    z-index: 10;
    display: flex;
    gap: 10px;
  }
  .analysis-panel {
    display: flex;
    gap: 8px;
    background-color: var(--sidebar-bg);
    padding: 8px 12px;
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    align-items: center;
    font-size: 0.9em;
  }
  .analysis-panel-label {
    color: var(--text-color-muted);
    font-weight: 500;
  }
  .analysis-panel select {
    background-color: var(--primary-bg);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 4px 8px;
    transition: border-color var(--transition-speed);
  }
  .analysis-panel select:hover {
    border-color: var(--accent-color);
  }
  .control-btn {
    background-color: var(--sidebar-bg);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    padding: 8px 14px;
    border-radius: var(--border-radius);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .control-btn:hover {
      background-color: var(--hover-bg);
  }
  .timeline-viewport {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }
  .timeline-content {
    position: absolute;
    width: var(--container-width, 8000px);
    height: var(--container-height, 4000px);
    transform-origin: 0 0;
  }
  .scene-node {
    position: absolute;
    width: 180px;
    height: 80px;
    background-color: var(--sidebar-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 10px;
    box-sizing: border-box;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }
  .scene-node:hover {
    border-color: var(--accent-color);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent-color) 20%, transparent);
  }
  .scene-node.selected {
    border-color: var(--accent-color);
    border-width: 2px;
  }
  .scene-node.highlighted {
      box-shadow: 0 0 20px var(--accent-color), 0 0 10px var(--accent-color) inset;
      border-color: var(--accent-color);
  }
  .scene-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .connections-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .connection-line {
    stroke: var(--text-color-muted);
    stroke-width: 2;
    fill: none;
  }
  .sequence-box {
    position: absolute;
    border: 1px dashed var(--border-color);
    border-radius: var(--border-radius-lg);
    box-sizing: border-box;
    pointer-events: none;
  }
  .sequence-name {
    position: absolute;
    top: -28px;
    left: 0;
    font-size: 0.9em;
    font-weight: 600;
    color: var(--text-color);
    background-color: var(--canvas-bg);
    padding: 4px 10px;
    border: 1px solid var(--border-color);
    border-radius: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
    z-index: 5;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  .analysis-graph-area {
      fill: color-mix(in srgb, var(--accent-color) 30%, transparent);
      stroke: var(--accent-color);
      stroke-width: 2px;
  }
  .analysis-graph-line {
      fill: none;
      stroke: var(--accent-color);
      stroke-width: 2px;
  }
</style>

<div 
  class="timeline-container" 
  bind:this={container}
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
  on:wheel={handleWheel}
  class:scene-tooltip-visible={tooltipVisible}
>
  <div class="timeline-controls" on:mousedown|stopPropagation>
    <div class="analysis-panel">
        <Icon name="bar-chart-2" size={16} />
        <span class="analysis-panel-label">분석:</span>
        <select bind:value={selectedAnalysis} on:change={runAnalysis}>
            <option value="none">비활성화</option>
            <optgroup label="캐릭터 아크">
                {#each numericVariables as v}
                    <option value={`var-${v.name}`}>{v.name}</option>
                {/each}
            </optgroup>
            {#each charactersWithNumericAttributes as char}
            <optgroup label={char.name}>
                {#each Object.keys(char.attributes) as attr}
                    <option value={`char-${char.id}-${attr}`}>{attr}</option>
                {/each}
            </optgroup>
            {/each}
            <optgroup label="스토리 밀도">
                <option value="density-wordCount">단어 수</option>
                <option value="density-actionCount">이벤트 수</option>
            </optgroup>
        </select>
    </div>
    <button class="control-btn" on:click={runConsistencyCheck}>
      <Icon name="check-circle" size={16} />
      <span>정합성 검사</span>
    </button>
  </div>

  <div class="timeline-viewport" style="transform: translate({viewTransform.x}px, {viewTransform.y}px) scale({viewTransform.scale});">
    <div
      class="timeline-content"
      style="--container-width: {containerWidth}px; --container-height: {containerHeight}px;"
    >
      {#each timelineSequences as seq}
        <div class="sequence-box" style="left: {seq.x}px; top: {seq.y}px; width: {seq.width}px; height: {seq.height}px; background-color: {seq.color};">
          <div class="sequence-name" title={seq.name}>{seq.name}</div>
        </div>
      {/each}

      <svg class="connections-svg">
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>

        {#if analysisData && analysisGraphPath}
            <path class="analysis-graph-area" d={analysisGraphPath} />
        {:else if analysisData && analysisLinePath}
            <path class="analysis-graph-line" d={analysisLinePath} />
        {/if}

        {#each timelineScenes as sourceScene}
          {#each sourceScene.choices as choice}
            {#if choice.targetSceneId && timelineScenes.some(s => s.id === choice.targetSceneId)}
              {@const targetScene = timelineScenes.find(s => s.id === choice.targetSceneId)}
              <path 
                class="connection-line"
                d="M {sourceScene.x + 180} {sourceScene.y + 40} C {sourceScene.x + 180 + 50} {sourceScene.y + 40}, {targetScene.x - 50} {targetScene.y + 40}, {targetScene.x} {targetScene.y + 40}"
                marker-end="url(#arrowhead)"
                style="color: var(--text-color-muted);"
              />
            {/if}
          {/each}

          {#if sourceScene.autoTransitionTarget && timelineScenes.some(s => s.id === sourceScene.autoTransitionTarget)}
            {@const targetScene = timelineScenes.find(s => s.id === sourceScene.autoTransitionTarget)}
            <path 
              class="connection-line"
              d="M {sourceScene.x + 180} {sourceScene.y + 40} C {sourceScene.x + 180 + 50} {sourceScene.y + 40}, {targetScene.x - 50} {targetScene.y + 40}, {targetScene.x} {targetScene.y + 40}"
              marker-end="url(#arrowhead)"
              stroke-dasharray="5,5"
              style="color: var(--text-color-muted);"
            />
          {/if}
        {/each}
      </svg>

      {#each timelineScenes as scene}
        <div 
          class="scene-node"
          class:selected={$activeStory?.selectedSceneId === scene.id}
          class:highlighted={highlightedSceneId === scene.id}
          style="left: {scene.x}px; top: {scene.y}px; border-left-color: {scene.color || 'var(--border-color)'}; border-left-width: 5px; background-color: {densityData[scene.id] ? `color-mix(in srgb, var(--accent-color) ${densityData[scene.id] * 100}%, var(--sidebar-bg))` : 'var(--sidebar-bg)'};"
          on:click|stopPropagation={() => handleSceneClick(scene.id)}
          on:keydown={(e) => e.key === 'Enter' && handleSceneClick(scene.id)}
          on:mousedown|stopPropagation
          on:mouseenter={() => handleNodeMouseEnter(scene)}
          on:mouseleave={handleNodeMouseLeave}
        >
          <Icon name={scene.icon || 'file-text'} size={20} />
          <div class="scene-name">{scene.name}</div>
        </div>
      {/each}
    </div>
  </div>
  <SceneTooltip story={$activeStory.story} scene={hoveredScene} position={tooltipPosition} />
</div>

{#if showConsistencyReport}
  <ConsistencyReportModal issues={consistencyIssues} on:close={() => showConsistencyReport = false} on:highlight={handleHighlight} />
{/if}