<script>
    import { createEventDispatcher } from 'svelte';
    import { projectActions, notifications, activeStory, settings } from './stores.js';
    import { getTagColor } from './utils.js';
    import Icon from './Icon.svelte';

    export let character;
    export let isOpen = false;

    const dispatch = createEventDispatcher();

    // Tabs configuration
    const tabs = [
        { id: 'basic', label: '기본 정보', icon: 'user' },
        { id: 'narrative', label: '서사 설정', icon: 'book-open' },
        { id: 'voice', label: '말투/화법', icon: 'message-circle' },
        { id: 'stats', label: '능력치/설정', icon: 'sliders' },
        { id: 'relations', label: '인물 관계', icon: 'users' }
    ];
    let activeTab = 'basic';

    // Temporary states for adding new items
    let newAttributeName = '';
    let newAttributeValue = '';
    let newTag = '';
    let newRelationshipTargetId = '';
    let newRelationshipType = '';
    let newRelationshipDescription = '';

    // Image transform state
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let startX, startY;

    // Reactive styles
    $: imageTransformStyle = `transform: translate(${offsetX}px, ${offsetY}px) scale(${scale}); cursor: ${isDragging ? 'grabbing' : 'grab'};`;

    // Initialize transform when character loads
    $: if (character) {
        const transform = character.profileImageTransform || { scale: 1, x: 0, y: 0 };
        scale = transform.scale;
        offsetX = transform.x;
        offsetY = transform.y;
    }

    // --- Auto-Save Helpers ---
    function updateField(field, value) {
        projectActions.updateCharacter(character.id, { [field]: value });
    }

    function updateNarrative(key, value) {
        const currentNarrative = character.narrative || {};
        const newNarrative = { ...currentNarrative, [key]: value };
        updateField('narrative', newNarrative);
    }

    function updateVoice(key, value) {
        const currentVoice = character.voice || {};
        const newVoice = { ...currentVoice, [key]: value };
        updateField('voice', newVoice);
    }

    function commit() {
        // Optional: Call this on blur if you want to create undo checkpoints
        projectActions.commitHistory(); 
    }

    // --- Attributes ---
    function addAttribute() {
        if (newAttributeName && !character.attributes.hasOwnProperty(newAttributeName)) {
            const newAttributes = { ...character.attributes, [newAttributeName]: newAttributeValue };
            updateField('attributes', newAttributes);
            newAttributeName = '';
            newAttributeValue = '';
        } else {
            notifications.add('속성 이름이 비어있거나 이미 존재합니다.', 'warning');
        }
    }

    function removeAttribute(name) {
        const newAttributes = { ...character.attributes };
        delete newAttributes[name];
        updateField('attributes', newAttributes);
    }

    function updateAttributeKey(oldKey, newKey) {
        if (!newKey || newKey === oldKey) return;
        if (character.attributes.hasOwnProperty(newKey)) {
            notifications.add('이미 존재하는 속성 이름입니다.', 'warning');
            return;
        }
        const newAttributes = {};
        for (const key in character.attributes) {
            if (key === oldKey) newAttributes[newKey] = character.attributes[oldKey];
            else newAttributes[key] = character.attributes[key];
        }
        updateField('attributes', newAttributes);
    }

    function updateAttributeValue(key, value) {
        const newAttributes = { ...character.attributes, [key]: value };
        updateField('attributes', newAttributes);
    }

    // --- Tags ---
    function addTag() {
        const tagToAdd = newTag.trim();
        if (tagToAdd && !(character.tags || []).includes(tagToAdd)) {
            updateField('tags', [...(character.tags || []), tagToAdd]);
            newTag = '';
        } else if ((character.tags || []).includes(tagToAdd)) {
            notifications.add('이미 존재하는 태그입니다.', 'warning');
        }
    }

    function removeTag(tag) {
        updateField('tags', (character.tags || []).filter(t => t !== tag));
    }

    // --- Custom Lists ---
    function addCustomList() {
        const newList = { id: `list_${Date.now()}`, name: '새 목록', items: [] };
        updateField('customLists', [...(character.customLists || []), newList]);
    }

    function removeCustomList(listId) {
        updateField('customLists', (character.customLists || []).filter(l => l.id !== listId));
    }

    function updateCustomListName(listId, name) {
        const newLists = (character.customLists || []).map(l => l.id === listId ? { ...l, name } : l);
        updateField('customLists', newLists);
    }

    function addCustomListItem(listId, value) {
        if (!value.trim()) return;
        const newLists = (character.customLists || []).map(l => {
            if (l.id === listId) {
                return { ...l, items: [...l.items, { id: `item_${Date.now()}`, value }] };
            }
            return l;
        });
        updateField('customLists', newLists);
    }

    function removeCustomListItem(listId, itemId) {
        const newLists = (character.customLists || []).map(l => {
            if (l.id === listId) {
                return { ...l, items: l.items.filter(i => i.id !== itemId) };
            }
            return l;
        });
        updateField('customLists', newLists);
    }

    // --- Relationships ---
    function addRelationship() {
        if (!newRelationshipTargetId || !newRelationshipType) {
            notifications.add('대상과 관계 유형을 선택해주세요.', 'warning');
            return;
        }
        if (newRelationshipTargetId === character.id) {
            notifications.add('자기 자신과의 관계는 추가할 수 없습니다.', 'warning');
            return;
        }
        if ((character.relationships || []).some(r => r.targetId === newRelationshipTargetId)) {
            notifications.add('이미 관계가 설정된 캐릭터입니다.', 'warning');
            return;
        }

        const newRel = {
            id: `rel_${Date.now()}`,
            targetId: newRelationshipTargetId,
            type: newRelationshipType,
            description: newRelationshipDescription
        };
        updateField('relationships', [...(character.relationships || []), newRel]);
        
        // Reset inputs
        newRelationshipTargetId = '';
        newRelationshipType = '';
        newRelationshipDescription = '';
    }

    function removeRelationship(relId) {
        updateField('relationships', (character.relationships || []).filter(r => r.id !== relId));
    }

    // --- Image Handling ---
    async function openImageFile() {
        if (window.electronAPI) {
            const result = await window.electronAPI.openImageFile();
            if (result.success) {
                updateField('profileImage', result.filePath);
                resetImageTransform(); // Save default transform immediately
            }
        } else {
            notifications.add('Electron 환경이 아닙니다.', 'error');
        }
    }

    function saveImageTransform() {
        updateField('profileImageTransform', { scale, x: offsetX, y: offsetY });
    }

    function resetImageTransform() {
        scale = 1; offsetX = 0; offsetY = 0;
        saveImageTransform();
    }

    // Image dragging
    function handleMouseDown(e) { isDragging = true; startX = e.clientX - offsetX; startY = e.clientY - offsetY; }
    function handleMouseMove(e) { if (isDragging) { offsetX = e.clientX - startX; offsetY = e.clientY - startY; } }
    function handleMouseUp() { if(isDragging) { isDragging = false; saveImageTransform(); } }
    function handleMouseLeave() { if(isDragging) { isDragging = false; saveImageTransform(); } }

    function close() {
        dispatch('close');
    }

    function handleKeyDown(event) {
        if (event.key === 'Escape') close();
    }

    function getCharacterNameById(id) {
        return $activeStory.characters.find(c => c.id === id)?.name || '알 수 없음';
    }
</script>

<svelte:window on:keydown={handleKeyDown} on:mouseup={handleMouseUp} on:mousemove={handleMouseMove} />

{#if isOpen && character}
<div class="modal-overlay" on:click={close} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && close()}>
    <div class="modal-content" on:click|stopPropagation role="none">
        <div class="modal-header">
            <div class="header-left">
                <h2>{character.name}</h2>
                <span class="id-badge">ID: {character.id}</span>
            </div>
            <div class="tabs">
                {#each tabs as tab}
                    <button 
                        class="tab-btn" 
                        class:active={activeTab === tab.id}
                        on:click={() => activeTab = tab.id}
                    >
                        <Icon name={tab.icon} size={16} />
                        <span>{tab.label}</span>
                    </button>
                {/each}
            </div>
            <button class="close-btn" on:click={close}><Icon name="x" size={20}/></button>
        </div>

        <div class="modal-body">
            <!-- TAB: BASIC INFO -->
            {#if activeTab === 'basic'}
                <div class="tab-content basic-tab">
                    <div class="profile-section">
                        <div class="profile-image-wrapper">
                            {#if character.profileImage}
                                <div class="img-crop">
                                    <img 
                                        src={character.profileImage} 
                                        alt={character.name}
                                        style={imageTransformStyle}
                                        on:mousedown={handleMouseDown}
                                        on:mouseleave={handleMouseLeave}
                                        draggable="false"
                                    />
                                </div>
                                <div class="img-overlay-hint">드래그하여 이동</div>
                            {:else}
                                <div class="img-placeholder"><Icon name="user" size={64}/></div>
                            {/if}
                        </div>
                        
                        {#if character.profileImage}
                            <div class="img-controls">
                                <Icon name="zoom-out" size={14}/>
                                <input type="range" bind:value={scale} min="0.5" max="3" step="0.1" on:change={saveImageTransform} title="확대/축소"/>
                                <Icon name="zoom-in" size={14}/>
                                <button class="icon-btn tiny" on:click={resetImageTransform} title="초기화"><Icon name="refresh-cw" size={14}/></button>
                            </div>
                        {/if}
                        
                        <button class="img-upload-btn" on:click={openImageFile}>이미지 변경</button>
                    </div>

                    <div class="info-form">
                        <div class="form-group">
                            <label for="char-name-input">이름</label>
                            <input id="char-name-input" type="text" value={character.name} on:change={(e) => updateField('name', e.target.value)} placeholder="이름 입력" />
                        </div>

                        <div class="form-group">
                            <label for="char-aliases-input">별칭 (콤마로 구분)</label>
                            <input 
                                id="char-aliases-input"
                                type="text" 
                                placeholder="예: 주인공, 그, 용사" 
                                value={(character.aliases || []).join(', ')}
                                on:change={(e) => {
                                    const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                    updateField('aliases', val);
                                }}
                            />
                        </div>
                        
                        <div class="form-group">
                            <label for="char-affiliation-select">소속</label>
                            <select id="char-affiliation-select" value={character.affiliation || ''} on:change={(e) => updateField('affiliation', e.target.value || null)}>
                                <option value="">소속 없음</option>
                                {#if $activeStory.groups}
                                    {#each $activeStory.groups as group}
                                        <option value={group.id}>{group.name}</option>
                                    {/each}
                                {/if}
                                <!-- Backward compatibility check for dictionary items marked as affiliation -->
                                {#if $activeStory.dictionary}
                                    {#each $activeStory.dictionary.filter(d => d.isAffiliation) as entry}
                                        <option value={entry.id}>{entry.term}</option>
                                    {/each}
                                {/if}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="char-desc-textarea">설명</label>
                            <textarea 
                                id="char-desc-textarea"
                                value={character.description} 
                                on:change={(e) => updateField('description', e.target.value)} 
                                rows="6" 
                                placeholder="캐릭터의 외모, 성격, 배경 등을 자유롭게 기술하세요."
                            ></textarea>
                        </div>

                        <div class="form-group">
                            <label for="char-tags-input">태그</label>
                            <div class="tags-list">
                                {#each (character.tags || []) as tag}
                                    <span class="tag" style="background-color: {getTagColor(tag)}">
                                        {tag}
                                        <button on:click={() => removeTag(tag)}><Icon name="x" size={12}/></button>
                                    </span>
                                {/each}
                            </div>
                            <input 
                                id="char-tags-input"
                                type="text" 
                                bind:value={newTag} 
                                placeholder="태그 추가... (Enter)" 
                                on:keydown={(e) => { if(e.key === 'Enter') { addTag(); e.preventDefault(); }}}
                            />
                        </div>
                    </div>
                </div>
            {/if}

            <!-- TAB: NARRATIVE -->
            {#if activeTab === 'narrative'}
                <div class="tab-content narrative-tab">
                    <div class="narrative-grid">
                        <div class="narrative-item full-width">
                            <label for="char-goal">목표 (Goal)</label>
                            <textarea 
                                id="char-goal"
                                placeholder="이 캐릭터가 이루고자 하는 궁극적인 목표는 무엇인가요?" 
                                value={character.narrative?.goal || ''} 
                                on:change={(e) => updateNarrative('goal', e.target.value)}
                            ></textarea>
                        </div>
                        <div class="narrative-item">
                            <label for="char-motivation">동기 (Motivation)</label>
                            <textarea 
                                id="char-motivation"
                                placeholder="왜 그 목표를 이루려고 하나요?" 
                                value={character.narrative?.motivation || ''} 
                                on:change={(e) => updateNarrative('motivation', e.target.value)}
                            ></textarea>
                        </div>
                        <div class="narrative-item">
                            <label for="char-conflict">갈등 (Conflict)</label>
                            <textarea 
                                id="char-conflict"
                                placeholder="목표를 가로막는 장애물은 무엇인가요?" 
                                value={character.narrative?.conflict || ''} 
                                on:change={(e) => updateNarrative('conflict', e.target.value)}
                            ></textarea>
                        </div>
                        <div class="narrative-item">
                            <label for="char-flaw">결점 (Flaw)</label>
                            <textarea 
                                id="char-flaw"
                                placeholder="캐릭터의 치명적인 약점이나 성격적 결함은?" 
                                value={character.narrative?.flaw || ''} 
                                on:change={(e) => updateNarrative('flaw', e.target.value)}
                            ></textarea>
                        </div>
                        <div class="narrative-item">
                            <label for="char-lie">거짓말 (Lie)</label>
                            <textarea 
                                id="char-lie"
                                placeholder="캐릭터가 스스로에게 하고 있는 거짓말이나 잘못된 믿음은?" 
                                value={character.narrative?.lie || ''} 
                                on:change={(e) => updateNarrative('lie', e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- TAB: VOICE -->
            {#if activeTab === 'voice'}
                <div class="tab-content narrative-tab">
                    <div class="narrative-grid">
                        <div class="narrative-item full-width">
                            <label for="char-tone">어조 (Tone)</label>
                            <textarea 
                                id="char-tone"
                                placeholder="캐릭터의 목소리 톤이나 말투의 전반적인 특징은 무엇인가요? (예: 냉소적, 활기참, 사투리)" 
                                value={character.voice?.tone || ''} 
                                on:change={(e) => updateVoice('tone', e.target.value)}
                            ></textarea>
                        </div>
                        <div class="narrative-item full-width">
                            <label for="char-habit">말버릇 (Habit)</label>
                            <textarea 
                                id="char-habit"
                                placeholder="자주 쓰는 문장 끝맺음이나 습관적인 표현이 있나요? (예: ~말이야, 흠..., 사실은)" 
                                value={character.voice?.habit || ''} 
                                on:change={(e) => updateVoice('habit', e.target.value)}
                            ></textarea>
                        </div>
                        <div class="narrative-item full-width">
                            <label for="char-keywords">주요 단어 (Keywords)</label>
                            <textarea 
                                id="char-keywords"
                                placeholder="대화 중에 자주 사용하는 특정 단어나 표현들을 나열해보세요." 
                                value={character.voice?.keywords || ''} 
                                on:change={(e) => updateVoice('keywords', e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- TAB: STATS & LISTS -->
            {#if activeTab === 'stats'}
                <div class="tab-content stats-tab">
                    <div class="section">
                        <h3>능력치 (Attributes)</h3>
                        <div class="list-container">
                            {#each Object.entries(character.attributes || {}) as [key, value]}
                                <div class="list-row">
                                    <input type="text" class="key-input" value={key} on:change={(e) => updateAttributeKey(key, e.target.value)} />
                                    <input type="text" class="value-input" value={value} on:change={(e) => updateAttributeValue(key, e.target.value)} />
                                    <button class="icon-btn danger" on:click={() => removeAttribute(key)}><Icon name="trash-2" size={16}/></button>
                                </div>
                            {/each}
                            <div class="add-row">
                                <input type="text" bind:value={newAttributeName} placeholder="새 능력치 이름 (예: 근력)" />
                                <input type="text" bind:value={newAttributeValue} placeholder="값" />
                                <button class="icon-btn primary" on:click={addAttribute}><Icon name="plus" size={16}/></button>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <h3>사용자 정의 목록 (Custom Lists)</h3>
                        <div class="custom-lists-wrapper">
                            {#each (character.customLists || []) as list (list.id)}
                                <div class="custom-list-card">
                                    <div class="list-header">
                                        <input type="text" value={list.name} on:change={(e) => updateCustomListName(list.id, e.target.value)} />
                                        <button class="icon-btn danger tiny" on:click={() => removeCustomList(list.id)}><Icon name="trash-2" size={14}/></button>
                                    </div>
                                    <div class="list-body">
                                        {#each list.items as item (item.id)}
                                            <div class="cl-item">
                                                <div class="bullet">•</div>
                                                <span>{item.value}</span>
                                                <button class="del-btn" on:click={() => removeCustomListItem(list.id, item.id)}>×</button>
                                            </div>
                                        {/each}
                                        <div class="cl-add">
                                            <input 
                                                type="text" 
                                                placeholder="항목 추가..." 
                                                on:keydown={(e) => { 
                                                    if(e.key === 'Enter') { 
                                                        addCustomListItem(list.id, e.currentTarget.value); 
                                                        e.currentTarget.value = ''; 
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            {/each}
                            <button class="add-list-card-btn" on:click={addCustomList}>
                                <Icon name="plus" size={24}/>
                                <span>새 목록 만들기</span>
                            </button>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- TAB: RELATIONSHIPS -->
            {#if activeTab === 'relations'}
                <div class="tab-content relations-tab">
                    <div class="add-relation-bar">
                        <select bind:value={newRelationshipTargetId}>
                            <option value="">대상 캐릭터 선택...</option>
                            {#each $activeStory.characters.filter(c => c.id !== character.id) as char}
                                <option value={char.id}>{char.name}</option>
                            {/each}
                        </select>
                        <input type="text" bind:value={newRelationshipType} placeholder="관계 (예: 친구, 적)" />
                        <input type="text" bind:value={newRelationshipDescription} placeholder="설명 (선택)" class="desc-input" />
                        <button class="primary-btn" on:click={addRelationship}>추가</button>
                    </div>

                    <div class="relations-list">
                        {#if (character.relationships || []).length === 0}
                            <div class="empty-state">등록된 관계가 없습니다.</div>
                        {:else}
                            {#each character.relationships as rel (rel.id)}
                                <div class="relation-card">
                                    <div class="rel-target">
                                        <Icon name="user" size={16}/>
                                        <strong>{getCharacterNameById(rel.targetId)}</strong>
                                    </div>
                                    <div class="rel-arrow">
                                        <span class="rel-label">{rel.type}</span>
                                        <div class="line"></div>
                                    </div>
                                    <div class="rel-desc">{rel.description || '설명 없음'}</div>
                                    <button class="icon-btn danger" on:click={() => removeRelationship(rel.id)}><Icon name="trash-2" size={16}/></button>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            {/if}

        </div>
    </div>
</div>
{/if}

<style>
    .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.6); z-index: 2000;
        display: flex; justify-content: center; align-items: center;
    }
    .modal-content {
        background: var(--sidebar-bg);
        width: 1000px; height: 85vh; max-width: 95%;
        border-radius: 12px; border: 1px solid var(--border-color);
        box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; overflow: hidden;
    }
    .modal-header {
        padding: 15px 20px; border-bottom: 1px solid var(--border-color);
        display: flex; justify-content: space-between; align-items: center;
        background: var(--secondary-bg);
    }
    .header-left h2 { margin: 0; font-size: 1.2em; display: inline-block; margin-right: 10px; }
    .id-badge { font-size: 0.8em; color: var(--text-color-muted); font-family: monospace; }
    .close-btn { background: none; border: none; color: var(--text-color); cursor: pointer; }
    
    /* Tabs */
    .tabs { display: flex; gap: 5px; }
    .tab-btn {
        display: flex; align-items: center; gap: 6px;
        padding: 8px 12px; background: none; border: none;
        color: var(--text-color-muted); cursor: pointer;
        border-radius: 4px; transition: 0.2s;
    }
    .tab-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-color); }
    .tab-btn.active { background: var(--primary-bg); color: var(--accent-color); font-weight: bold; }

    .modal-body { flex: 1; overflow-y: auto; background: var(--primary-bg); padding: 20px; }
    .tab-content { height: 100%; }

    /* Basic Tab */
    .basic-tab { display: flex; gap: 30px; }
    .profile-section { width: 220px; display: flex; flex-direction: column; align-items: center; gap: 15px; }
    .profile-image-wrapper {
        width: 200px; height: 200px; border-radius: 50%;
        border: 4px solid var(--secondary-bg);
        overflow: hidden; background: #333; position: relative;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    }
    .img-crop { width: 100%; height: 100%; position: relative; overflow: hidden; }
    .img-crop img { width: 100%; height: 100%; object-fit: cover; }
    .img-placeholder { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: #666; }
    .img-overlay-hint {
        position: absolute; bottom: 0; width: 100%; text-align: center;
        background: rgba(0,0,0,0.5); color: white; font-size: 0.7em; padding: 2px 0;
        pointer-events: none;
    }
    .img-controls { display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center; }
    .img-upload-btn {
        width: 100%; padding: 8px; background: var(--secondary-bg);
        border: 1px solid var(--border-color); color: var(--text-color);
        border-radius: 4px; cursor: pointer;
    }
    .img-upload-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }

    .info-form { flex: 1; display: flex; flex-direction: column; gap: 15px; }
    .form-group label { display: block; margin-bottom: 5px; color: var(--text-color-muted); font-size: 0.9em; }
    .form-group input, .form-group textarea, .form-group select {
        width: 100%; padding: 10px; background: var(--secondary-bg);
        border: 1px solid var(--border-color); border-radius: 4px;
        color: var(--text-color); box-sizing: border-box;
    }
    .form-group textarea { resize: none; line-height: 1.6; }
    .tags-list { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
    .tag { 
        padding: 4px 8px; border-radius: 12px; font-size: 0.85em; 
        display: flex; align-items: center; gap: 5px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    .tag button { background: none; border: none; padding: 0; color: inherit; cursor: pointer; opacity: 0.7; }
    .tag button:hover { opacity: 1; }

    /* Narrative Tab */
    .narrative-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        height: 100%;
        overflow-y: auto;
        padding-bottom: 20px;
    }
    .narrative-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .narrative-item.full-width {
        grid-column: 1 / -1;
    }
    .narrative-item label {
        font-weight: bold;
        color: var(--accent-color);
        font-size: 0.9em;
    }
    .narrative-item textarea {
        flex: 1;
        resize: none;
        padding: 12px;
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-color);
        line-height: 1.6;
        min-height: 120px;
        transition: all 0.2s;
    }
    .narrative-item textarea:focus {
        outline: none;
        border-color: var(--accent-color);
        background: var(--primary-bg);
        box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.1);
    }

    /* Stats Tab */
    .section { margin-bottom: 30px; }
    h3 { margin-top: 0; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px; }
    
    .list-container { background: var(--secondary-bg); border-radius: 4px; padding: 10px; }
    .list-row, .add-row { display: flex; gap: 10px; margin-bottom: 8px; }
    .list-row input, .add-row input {
        flex: 1; padding: 8px; background: var(--primary-bg);
        border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color);
    }
    .icon-btn { 
        width: 36px; height: 36px; display: flex; justify-content: center; align-items: center;
        background: none; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-color-muted);
    }
    .icon-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
    .icon-btn.danger:hover { border-color: var(--danger-color); color: var(--danger-color); }
    .icon-btn.primary { background: var(--accent-color); border-color: var(--accent-color); color: white; }
    .icon-btn.tiny { width: 24px; height: 24px; padding: 0; }

    .custom-lists-wrapper { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
    .custom-list-card {
        background: var(--secondary-bg); border: 1px solid var(--border-color); border-radius: 6px;
        overflow: hidden; display: flex; flex-direction: column;
    }
    .list-header {
        padding: 8px; background: rgba(0,0,0,0.1); border-bottom: 1px solid var(--border-color);
        display: flex; gap: 5px;
    }
    .list-header input { 
        flex: 1; background: none; border: none; font-weight: bold; color: var(--text-color); 
        border-bottom: 1px dashed transparent; 
    }
    .list-header input:focus { border-bottom-color: var(--accent-color); outline: none; }
    .list-body { padding: 10px; flex: 1; max-height: 200px; overflow-y: auto; }
    .cl-item { display: flex; align-items: center; gap: 5px; margin-bottom: 4px; font-size: 0.9em; }
    .cl-item .bullet { color: var(--accent-color); }
    .cl-item span { flex: 1; }
    .del-btn { background: none; border: none; color: var(--text-color-muted); cursor: pointer; opacity: 0; }
    .cl-item:hover .del-btn { opacity: 1; }
    .cl-add input { 
        width: 100%; background: none; border: none; border-bottom: 1px solid var(--border-color); 
        padding: 4px 0; color: var(--text-color); font-size: 0.9em; margin-top: 5px;
    }
    .add-list-card-btn {
        background: none; border: 2px dashed var(--border-color); border-radius: 6px;
        color: var(--text-color-muted); cursor: pointer; display: flex; flex-direction: column;
        justify-content: center; align-items: center; gap: 10px; min-height: 150px;
    }
    .add-list-card-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }

    /* Relations Tab */
    .add-relation-bar { display: flex; gap: 10px; margin-bottom: 20px; background: var(--secondary-bg); padding: 15px; border-radius: 6px; }
    .add-relation-bar select, .add-relation-bar input {
        padding: 8px; background: var(--primary-bg); border: 1px solid var(--border-color);
        border-radius: 4px; color: var(--text-color);
    }
    .add-relation-bar select { width: 150px; }
    .add-relation-bar input { width: 120px; }
    .add-relation-bar input.desc-input { flex: 1; }
    .primary-btn { padding: 0 20px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; }

    .relations-list { display: flex; flex-direction: column; gap: 10px; }
    .relation-card {
        background: var(--secondary-bg); border: 1px solid var(--border-color); border-radius: 6px;
        padding: 15px; display: flex; align-items: center; gap: 20px;
    }
    .rel-target { display: flex; align-items: center; gap: 8px; width: 150px; font-size: 1.1em; }
    .rel-arrow { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
    .rel-label { background: var(--primary-bg); padding: 2px 8px; border-radius: 10px; font-size: 0.85em; border: 1px solid var(--border-color); z-index: 1; }
    .rel-arrow .line { height: 1px; background: var(--border-color); width: 100%; position: absolute; top: 50%; }
    .rel-desc { width: 40%; color: var(--text-color-muted); font-size: 0.9em; font-style: italic; }
    .empty-state { text-align: center; padding: 40px; color: var(--text-color-muted); }

    @media (max-width: 768px) {
        .modal-content { width: 100%; height: 100%; border-radius: 0; }
        .basic-tab { flex-direction: column; }
        .profile-section { width: 100%; flex-direction: row; }
        .add-relation-bar { flex-direction: column; }
        .add-relation-bar select, .add-relation-bar input { width: 100%; }
    }
</style>