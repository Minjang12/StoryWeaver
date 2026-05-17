<script>
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { uiState, notifications } from './stores.js';
    import Icon from './Icon.svelte';

    export let story;
    
    let viewingStorylineId = null;
    uiState.subscribe(s => viewingStorylineId = s.storylineIdForScriptViewer);

    $: viewingStoryline = story && viewingStorylineId ? story.storylines.find(s => s.id === viewingStorylineId) : null;
    $: scenes = story?.scenes;
    $: characters = story?.characters;

    const dispatch = createEventDispatcher();

    function close() {
        dispatch('close');
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            close();
        }
    }

    onMount(() => window.addEventListener('keydown', handleKeydown));
    onDestroy(() => window.removeEventListener('keydown', handleKeydown));

    let characterColorMap = new Map();
    $: {
        characterColorMap.clear();
        if (characters) {
            for (const char of characters) {
                characterColorMap.set(char.name, char.color);
            }
        }
    }

    $: scriptData = (() => {
        if (!viewingStoryline || !viewingStoryline.nodes || viewingStoryline.nodes.length === 0) {
            return { 
                lines: [{ type: 'info', content: '이 스토리라인에는 씬이 없다냥.' }],
                stats: { sceneCount: 0, dialogueCount: 0, choiceCount: 0 }
            };
        }

        let lines = [];
        let sceneCount = 0, dialogueCount = 0, choiceCount = 0;

        viewingStoryline.nodes.forEach((sceneId, index) => {
            const scene = scenes[sceneId];
            if (!scene) return;

            sceneCount++;
            if (index > 0) lines.push({ type: 'separator' });
            lines.push({ type: 'scene', content: `씬 ${index + 1}: ${scene.name}`, sceneId: sceneId, sceneIndex: index + 1 });

            scene.content.forEach(item => {
                if (item.type === 'dialogue') {
                    dialogueCount++;
                    if (item.character === '나레이션') {
                        lines.push({ type: 'narration', content: item.text });
                    } else {
                        lines.push({ type: 'dialogue', character: item.character, content: item.text });
                    }
                }
            });

            const nextSceneId = viewingStoryline.nodes[index + 1];
            if (nextSceneId) {
                const choiceToNextScene = scene.choices.find(choice => choice.targetSceneId === nextSceneId);
                if (choiceToNextScene) {
                    choiceCount++;
                    lines.push({ type: 'choice', content: `[선택: ${choiceToNextScene.text}]` });
                } else if (scene.autoTransitionTarget === nextSceneId) {
                    choiceCount++;
                    lines.push({ type: 'choice', content: `[자동으로 다음 씬으로 이동]` });
                }
            }
        });

        return { lines, stats: { sceneCount, dialogueCount, choiceCount } };
    })();

    function getPlainTextScript() {
        let plainText = `### 스토리라인: ${viewingStoryline?.name || '알 수 없음'}\n\n`;
        plainText += `씬 개수: ${scriptData.stats.sceneCount}, 총 대사 수: ${scriptData.stats.dialogueCount}, 총 선택지/연결 수: ${scriptData.stats.choiceCount}\n\n`;
        
        plainText += scriptData.lines.map(line => {
            switch (line.type) {
                case 'separator': return '---\n';
                case 'scene': return `## ${line.content}\n\n`;
                case 'dialogue': return `${line.character}: ${line.content}\n\n`;
                case 'narration': return `${line.content}\n\n`;
                case 'choice': return `${line.content}\n\n`;
                case 'info': return line.content;
                default: return '';
            }
        }).join('');
        return plainText;
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(getPlainTextScript()).then(() => {
            notifications.add('대본이 클립보드에 복사되었다냥!', 'success');
        }).catch(() => {
            notifications.add('클립보드 복사에 실패했다냥... 미안하다냥.', 'error');
        });
    }

    function downloadScript() {
        const blob = new Blob([getPlainTextScript()], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${viewingStoryline.name.replace(/[^a-z0-9가-힣]/gi, '_')}_대본.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
    
    function printScript() {
        const printWindow = window.open('', '_blank');
        const content = document.getElementById('script-to-print');
        if (printWindow && content) {
            printWindow.document.write('<html><head><title>대본 인쇄</title>');
            printWindow.document.write('<style>body{font-family:sans-serif;line-height:1.6;} h2,h4{margin-bottom:0.5em;} hr{border:0;border-top:1px dashed #ccc;margin:2em 0;} p{margin:0 0 1em;} strong{margin-right:0.5em;} .choice{font-style:italic;color:#555;}</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<h2>스토리라인: ${viewingStoryline?.name || ''}</h2>`);
            printWindow.document.write(content.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }
    }
</script>

<div class="modal-backdrop" on:click|self={close} on:keydown|self={(e) => { if (e.key === 'Enter' || e.key === ' ') close(); }} role="button" tabindex="0">
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
            <Icon name="book-open" size={24} />
            <h2 id="modal-title">스토리라인 대본: {viewingStoryline?.name || ''}</h2>
            <button class="icon-btn close-btn" on:click={close} title="닫기"><Icon name="x" size={20} /></button>
        </div>

        <div class="modal-body">
            {#if viewingStoryline}
                <div class="storyline-viewer-layout">
                    <aside class="scene-nav">
                        <div class="nav-header"><Icon name="list" size={14} /> 씬 목록</div>
                        <div class="nav-list">
                            {#each viewingStoryline.nodes as sceneId, i}
                                {@const scene = scenes[sceneId]}
                                {#if scene}
                                    <button class="nav-item" on:click={() => {
                                        const el = document.getElementById(`scene-${sceneId}`);
                                        const container = document.getElementById('script-to-print');
                                        if (el && container) {
                                            container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
                                        }
                                    }}>
                                        <span class="num">{i + 1}</span>
                                        <span class="name">{scene.name}</span>
                                    </button>
                                {/if}
                            {/each}
                        </div>
                    </aside>

                    <div class="viewer-main">
                        <div class="storyline-stats">
                            <div class="stat-item"><Icon name="layout" size={16} /><span>씬: {scriptData.stats.sceneCount}</span></div>
                            <div class="stat-item"><Icon name="message-square" size={16} /><span>대사: {scriptData.stats.dialogueCount}</span></div>
                            <div class="stat-item"><Icon name="git-merge" size={16} /><span>선택지: {scriptData.stats.choiceCount}</span></div>
                        </div>

                        <div class="script-viewer" id="script-to-print">
                            {#each scriptData.lines as line, idx}
                                {#if line.type === 'separator'}<hr class="scene-divider" />
                                {:else if line.type === 'scene'}
                                    <div class="scene-header-block" id="scene-{line.sceneId}">
                                        <div class="scene-number">SCENE {line.sceneIndex}</div>
                                        <h3 class="scene-title">{line.content}</h3>
                                    </div>
                                {:else if line.type === 'dialogue'}
                                    <div class="dialogue-block">
                                        <div class="speaker" style="color: {characterColorMap.get(line.character) || 'var(--text-color)'}">
                                            {line.character}
                                        </div>
                                        <div class="bubble-text">{line.content}</div>
                                    </div>
                                {:else if line.type === 'narration'}
                                    <div class="narration-block">
                                        {line.content}
                                    </div>
                                {:else if line.type === 'choice'}
                                    <div class="choice-block">
                                        <span class="choice-arrow">➔</span> {line.content}
                                    </div>
                                {:else if line.type === 'info'}<p class="info">{line.content}</p>
                                {/if}
                            {/each}
                        </div>
                    </div>
                </div>
            {:else}
                <div class="no-selection">
                    <Icon name="alert-circle" size={48} />
                    <p>대본을 표시할 스토리라인을 찾을 수 없다냥.</p>
                </div>
            {/if}
        </div>

        <div class="modal-footer">
            <button class="action-btn" on:click={copyToClipboard}><Icon name="copy" size={16} /> 텍스트 복사</button>
            <button class="action-btn desktop-only" on:click={downloadScript}><Icon name="download" size={16} /> 파일로 저장</button>
            <button class="action-btn primary desktop-only" on:click={printScript}><Icon name="printer" size={16} /> 인쇄</button>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex; justify-content: center; align-items: center;
        z-index: 2000;
    }
    .modal-content {
        background-color: var(--secondary-bg);
        border-radius: var(--border-radius);
        width: 1000px; max-width: 95%; height: 85vh;
        box-shadow: var(--box-shadow);
        display: flex; flex-direction: column;
        overflow: hidden;
    }
    .modal-header {
        display: flex; align-items: center; gap: 12px;
        padding: 16px 24px;
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
    }
    .modal-header h2 { margin: 0; font-size: 1.4em; font-weight: 600; flex-grow: 1; }
    .icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        background: none; border: none; color: var(--text-color-muted);
        cursor: pointer; width: 32px; height: 32px;
        border-radius: var(--border-radius); transition: all var(--transition-speed);
    }
    .icon-btn:hover { background-color: var(--primary-bg); color: var(--text-color); }
    .close-btn { margin-left: auto; }

    .modal-body {
        flex-grow: 1; min-height: 0;
        padding: 0;
        display: flex; flex-direction: column;
    }
    
    .storyline-viewer-layout {
        display: flex; height: 100%; overflow: hidden;
    }

    .scene-nav {
        width: 220px; border-right: 1px solid var(--border-color);
        background-color: var(--primary-bg); display: flex; flex-direction: column;
        flex-shrink: 0;
    }

    @media (max-width: 768px) {
        .modal-content {
            width: 100%;
            height: 100dvh; /* Use dynamic viewport height */
            max-width: 100%;
            border-radius: 0;
        }
        
        .storyline-viewer-layout {
            flex-direction: column;
        }
        .scene-nav {
            width: 100%;
            height: 120px; /* Slightly shorter for more reading space */
            border-right: none;
            border-bottom: 1px solid var(--border-color);
        }
        .script-viewer {
            padding: 20px; /* Reduce padding */
            font-size: 0.95em; /* Smaller font */
        }
        .scene-header-block { margin: 40px 0 20px 0; }
        .scene-title { font-size: 1.4em; }
        .storyline-stats { display: none; } /* Hide stats on mobile */
        
        /* Hide buttons that are not useful on mobile */
        .desktop-only { display: none !important; }
        
        .modal-footer {
            padding: 10px 15px; /* Compact footer */
        }
    }

    .nav-header { padding: 12px 16px; font-size: 0.8em; font-weight: bold; color: var(--text-color-muted); text-transform: uppercase; border-bottom: 1px solid var(--border-color); }
    .nav-list { flex: 1; overflow-y: auto; padding: 8px; }
    .nav-item {
        width: 100%; text-align: left; background: none; border: none; padding: 8px 12px;
        border-radius: 4px; color: var(--text-color); cursor: pointer; display: flex; align-items: center; gap: 10px;
        font-size: 0.9em; transition: all 0.2s; margin-bottom: 2px;
    }
    .nav-item:hover { background-color: var(--secondary-bg); color: var(--accent-color); }
    .nav-item .num { font-size: 0.8em; color: var(--text-color-muted); width: 18px; }
    .nav-item .name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .viewer-main {
        flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;
        background-color: var(--secondary-bg);
        overflow: hidden;
    }

    .storyline-stats {
        display: flex; gap: 24px; padding: 12px 30px;
        background-color: var(--primary-bg);
        border-bottom: 1px solid var(--border-color); font-size: 0.9em; color: var(--text-color-muted);
        flex-shrink: 0;
    }
    .stat-item { display: flex; align-items: center; gap: 6px; }

    .script-viewer {
        position: relative;
        flex-grow: 1; min-height: 0;
        padding: 40px 60px; 
        overflow-y: auto; 
        -webkit-overflow-scrolling: touch;
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 1.05em; line-height: 1.8; max-width: 900px; margin: 0 auto; width: 100%;
        box-sizing: border-box;
    }

    .scene-header-block { margin: 60px 0 30px 0; border-left: 5px solid var(--accent-color); padding-left: 20px; }
    .scene-header-block:first-child { margin-top: 0; }
    .scene-number { font-size: 0.8em; font-weight: 800; color: var(--accent-color); letter-spacing: 1.5px; text-transform: uppercase; }
    .scene-title { margin: 6px 0 0 0; font-size: 1.8em; font-weight: 800; color: var(--text-color); }

    .dialogue-block { margin-bottom: 24px; }
    .speaker { font-weight: 800; font-size: 0.95em; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .bubble-text { 
        background: var(--primary-bg); padding: 14px 20px; border-radius: 4px 20px 20px 20px; 
        display: inline-block; max-width: 95%; color: var(--text-color); border: 1px solid var(--border-color);
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .narration-block {
        margin: 16px 0;
        padding: 4px 0;
        color: var(--text-color);
        font-style: normal;
        text-align: left;
    }

    .choice-block { 
        margin: 30px 0; padding: 14px 24px; background-color: color-mix(in srgb, var(--accent-color) 5%, transparent);
        border-radius: 12px; border: 1px dashed var(--accent-color); color: var(--accent-color); font-weight: 700; 
    }
    .choice-arrow { margin-right: 10px; font-weight: normal; }

    .scene-divider { border: none; border-top: 1px solid var(--border-color); margin: 60px 0; opacity: 0.5; }
    
    .no-selection {
        flex-grow: 1; display: flex; flex-direction: column;
        justify-content: center; align-items: center; gap: 16px;
        color: var(--text-color-muted); padding: 60px; text-align: center;
    }
    .info { color: var(--text-color-muted); text-align: center; padding: 40px; font-style: italic; }

    .modal-footer {
        display: flex; justify-content: flex-end; gap: 12px;
        padding: 16px 24px;
        border-top: 1px solid var(--border-color);
        flex-shrink: 0;
        background-color: var(--primary-bg);
    }
    .action-btn {
        display: flex; align-items: center; gap: 8px; padding: 10px 20px;
        border: 1px solid var(--border-color); background-color: var(--secondary-bg);
        color: var(--text-color); border-radius: var(--border-radius); cursor: pointer;
        font-weight: 600; font-size: 0.95em; transition: all 0.2s;
    }
    .action-btn:hover { border-color: var(--accent-color); color: var(--accent-color); background-color: var(--primary-bg); }
    .action-btn.primary { background-color: var(--accent-color); color: white; border-color: var(--accent-color); }
    .action-btn.primary:hover { background-color: var(--accent-color-dark); box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.3); }
</style>