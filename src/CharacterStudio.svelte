<script>
        import { projectActions, uiState, notifications, confirmation, activeProject } from './stores.js';
        import { fade, slide } from 'svelte/transition';
        import Icon from './Icon.svelte';
        import CharacterRelationshipDiagram from './CharacterRelationshipDiagram.svelte'; // Import Diagram
        import { createEventDispatcher } from 'svelte';
        import { getColorFromString, getProfileImageStyle } from './utils.js';
    
        export let story;
        export let isOpen = false;
    
        const dispatch = createEventDispatcher();
    
            // Local State
            let selectedCharacterId = null;
            let searchText = '';
            let activeTab = 'basic'; // basic, appearance, personality, narrative, voice, stats, relationships
            let showFullDiagram = false; // State for full diagram view
        
            // Image Transform State
            let imageScale = 1;
            let imageOffsetX = 0;
            let imageOffsetY = 0;
            let isDraggingImage = false;
            let dragStart = { x: 0, y: 0 };
            
            // UI State
            let collapsedGroups = {};
            let currentProjectId = null;

            $: if ($activeProject?.id && $activeProject.id !== currentProjectId) {
                currentProjectId = $activeProject.id;
                const stored = localStorage.getItem(`sw_collapsed_groups_${currentProjectId}`);
                if (stored) {
                    try { 
                        collapsedGroups = JSON.parse(stored); 
                    } catch(e) {
                        collapsedGroups = {};
                    }
                } else {
                    collapsedGroups = {};
                }
            }

            function toggleGroup(groupId) {
                collapsedGroups[groupId] = !collapsedGroups[groupId];
                if (currentProjectId) {
                    localStorage.setItem(`sw_collapsed_groups_${currentProjectId}`, JSON.stringify(collapsedGroups));
                }
            }
        
            $: if (selectedCharacter) {
                const t = selectedCharacter.profileImageTransform || { scale: 1, x: 0, y: 0 };
                imageScale = t.scale;
                imageOffsetX = t.x;
                imageOffsetY = t.y;
            }
        
            $: imageTransformStyle = `transform: translate(${imageOffsetX}px, ${imageOffsetY}px) scale(${imageScale});`;
        
            function saveImageTransform() {
                if (!selectedCharacterId) return;
                projectActions.updateCharacter(selectedCharacterId, {
                    profileImageTransform: { scale: imageScale, x: imageOffsetX, y: imageOffsetY }
                });
            }
        
            function handleImageWheel(e) {
                if (!selectedCharacter?.profileImage) return;
                e.preventDefault();
                const delta = e.deltaY * -0.001;
                const newScale = Math.min(Math.max(0.5, imageScale + delta), 3);
                imageScale = newScale;
                saveImageTransform();
            }
        
            function handleImageMouseDown(e) {
                if (!selectedCharacter?.profileImage) return;
                isDraggingImage = true;
                dragStart = { x: e.clientX - imageOffsetX, y: e.clientY - imageOffsetY };
            }
        
            function handleImageMouseMove(e) {
                if (!isDraggingImage) return;
                imageOffsetX = e.clientX - dragStart.x;
                imageOffsetY = e.clientY - dragStart.y;
            }
        
            function handleImageMouseUp() {
                if (isDraggingImage) {
                    isDraggingImage = false;
                    saveImageTransform();
                }
            }
        
            function resetImageTransform() {
                imageScale = 1;
                imageOffsetX = 0;
                imageOffsetY = 0;
                saveImageTransform();
            }
        
            // Track previous editing ID to prevent overwriting local selection
    let lastEditingId = null;

    // Check if a specific character was requested to be edited via store
    $: if (isOpen && $uiState.editingCharacterId && $uiState.editingCharacterId !== lastEditingId) {
        selectedCharacterId = $uiState.editingCharacterId;
        lastEditingId = $uiState.editingCharacterId;
        activeTab = 'basic';
    }

    // Role Definitions
    const ROLE_MAP = {
        'protagonist': { label: '주인공', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.1)' },
        'antagonist': { label: '반동인물', color: '#FF8C00', bg: 'rgba(255, 140, 0, 0.1)' },
        'villain': { label: '악역', color: '#DC143C', bg: 'rgba(220, 20, 60, 0.1)' },
        'rival': { label: '적대자/라이벌', color: '#9932CC', bg: 'rgba(153, 50, 204, 0.1)' },
        'supporting': { label: '조연', color: '#87CEEB', bg: 'rgba(135, 206, 235, 0.1)' },
        'extra': { label: '단역', color: '#A9A9A9', bg: 'rgba(169, 169, 169, 0.1)' },
        'uncategorized': { label: '미설정', color: '#6c757d', bg: 'rgba(108, 117, 125, 0.1)' }
    };
    const ROLES = Object.keys(ROLE_MAP);

    $: selectedCharacter = story.characters.find(c => c.id === selectedCharacterId);

    // Group Characters by Affiliation
    $: groupedCharacters = groupCharactersByAffiliation(story.characters, story.groups, story.dictionary, searchText);

    function groupCharactersByAffiliation(characters, groups, dictionary, filter) {
        const grouped = {};
        (groups || []).forEach(g => grouped[g.id] = { id: g.id, name: g.name, type: 'group', items: [] });
        grouped['unassigned'] = { id: 'unassigned', name: '소속 없음', type: 'system', items: [] };
        
        // Favorites group
        grouped['__favorites__'] = { id: '__favorites__', name: '즐겨찾기', type: 'system', items: [] };

        characters.forEach(char => {
            if (filter) {
                const f = filter.toLowerCase();
                const roleLabel = ROLE_MAP[char.role]?.label || '';
                if (!char.name.toLowerCase().includes(f) && 
                    !char.description?.toLowerCase().includes(f) &&
                    !char.tags?.some(t => t.toLowerCase().includes(f)) &&
                    !roleLabel.toLowerCase().includes(f)) {
                    return;
                }
            }
            
            // Prioritize Favorites
            if (char.isFavorite) {
                grouped['__favorites__'].items.push(char);
                return;
            }
            
            const affId = char.affiliation;
            if (affId && grouped[affId]) {
                grouped[affId].items.push(char);
            } else if (affId) {
                const dictEntry = dictionary.find(d => d.id === affId);
                const groupName = dictEntry ? dictEntry.term : '알 수 없는 소속';
                if (!grouped[affId]) grouped[affId] = { id: affId, name: groupName, type: 'virtual', items: [] };
                grouped[affId].items.push(char);
            } else {
                grouped['unassigned'].items.push(char);
            }
        });

        const result = Object.values(grouped).filter(g => g.items.length > 0 || g.type === 'group');
        return result.sort((a, b) => {
            if (a.id === '__favorites__') return -1; // Favorites always first
            if (b.id === '__favorites__') return 1;
            
            // Pinned Groups Logic
            const groupA = groups.find(g => g.id === a.id);
            const groupB = groups.find(g => g.id === b.id);
            const favA = groupA?.isFavorite || false;
            const favB = groupB?.isFavorite || false;
            if (favA !== favB) return favA ? -1 : 1;

            if (a.id === 'unassigned') return 1;
            if (b.id === 'unassigned') return -1;
            return a.name.localeCompare(b.name);
        });
    }

    function selectCharacter(id) {
        selectedCharacterId = id;
        activeTab = 'basic';
    }

    function handleDragStart(e, charId) {
        e.dataTransfer.setData('charId', charId);
    }

    function handleDrop(e, targetGroupId) {
        const charId = e.dataTransfer.getData('charId');
        if (charId) {
            const affId = targetGroupId === 'unassigned' ? null : targetGroupId;
            projectActions.updateCharacter(charId, { affiliation: affId });
            notifications.add(`소속이 변경되었습니다.`, 'success');
        }
    }

    function updateCharacter(field, value) {
        if (!selectedCharacterId) return;
        projectActions.updateCharacter(selectedCharacterId, { [field]: value });
    }

    function updateNarrative(field, value) {
        if (!selectedCharacterId) return;
        const narrative = { ...(selectedCharacter.narrative || {}), [field]: value };
        projectActions.updateCharacter(selectedCharacterId, { narrative });
    }

    function updateVoice(field, value) {
        if (!selectedCharacterId) return;
        const voice = { ...(selectedCharacter.voice || {}), [field]: value };
        projectActions.updateCharacter(selectedCharacterId, { voice });
    }

    // Stats Logic
    let newAttributeName = '';
    let newAttributeValue = '';

    function addAttribute() {
        if (!newAttributeName.trim()) return;
        const attributes = { ...selectedCharacter.attributes, [newAttributeName]: newAttributeValue };
        projectActions.updateCharacter(selectedCharacterId, { attributes });
        newAttributeName = '';
        newAttributeValue = '';
    }

    function removeAttribute(key) {
        const attributes = { ...selectedCharacter.attributes };
        delete attributes[key];
        projectActions.updateCharacter(selectedCharacterId, { attributes });
    }

    function updateAttributeKey(oldKey, newKey) {
        if (!newKey.trim() || oldKey === newKey) return;
        const attributes = { ...selectedCharacter.attributes };
        attributes[newKey] = attributes[oldKey];
        delete attributes[oldKey];
        projectActions.updateCharacter(selectedCharacterId, { attributes });
    }

    function updateAttributeValue(key, value) {
        const attributes = { ...selectedCharacter.attributes, [key]: value };
        projectActions.updateCharacter(selectedCharacterId, { attributes });
    }

    // Traits & Abilities Logic
    let newStrength = '';
    let newWeakness = '';
    let newAbility = '';

    function addTrait(field, value) {
        if (!value || !value.trim()) return;
        const currentList = selectedCharacter[field] || [];
        projectActions.updateCharacter(selectedCharacterId, { [field]: [...currentList, value.trim()] });
        if (field === 'strengths') newStrength = '';
        if (field === 'weaknesses') newWeakness = '';
        if (field === 'abilities') newAbility = '';
    }

    function removeTrait(field, index) {
        const currentList = selectedCharacter[field] || [];
        const newList = currentList.filter((_, i) => i !== index);
        projectActions.updateCharacter(selectedCharacterId, { [field]: newList });
    }
    
    function updateTrait(field, index, value) {
        const currentList = selectedCharacter[field] || [];
        const newList = [...currentList];
        newList[index] = value;
        projectActions.updateCharacter(selectedCharacterId, { [field]: newList });
    }

    // Relationship Logic
    let newRelTargetId = '';
    let newRelType = '';
    let newRelDesc = '';

    // Custom List Logic
    import { createUniqueId } from './utils.js';

    function addCustomList() {
        const newList = {
            id: createUniqueId('list'),
            name: '새 목록',
            items: []
        };
        const currentLists = selectedCharacter.customLists || [];
        projectActions.updateCharacter(selectedCharacterId, { customLists: [...currentLists, newList] });
    }

    function removeCustomList(listId) {
        confirmation.prompt('정말로 이 목록을 삭제하시겠습니까?', () => {
            const currentLists = selectedCharacter.customLists || [];
            projectActions.updateCharacter(selectedCharacterId, { customLists: currentLists.filter(l => l.id !== listId) });
        });
    }

    function updateCustomListName(listId, newName) {
        const currentLists = selectedCharacter.customLists || [];
        const newLists = currentLists.map(l => l.id === listId ? { ...l, name: newName } : l);
        projectActions.updateCharacter(selectedCharacterId, { customLists: newLists });
    }

    function addCustomListItem(listId) {
        const currentLists = selectedCharacter.customLists || [];
        const newLists = currentLists.map(l => {
            if (l.id === listId) {
                return { ...l, items: [...l.items, { id: createUniqueId('item'), value: '' }] };
            }
            return l;
        });
        projectActions.updateCharacter(selectedCharacterId, { customLists: newLists });
    }

    function updateCustomListItem(listId, itemId, value) {
        const currentLists = selectedCharacter.customLists || [];
        const newLists = currentLists.map(l => {
            if (l.id === listId) {
                const newItems = l.items.map(i => i.id === itemId ? { ...i, value } : i);
                return { ...l, items: newItems };
            }
            return l;
        });
        projectActions.updateCharacter(selectedCharacterId, { customLists: newLists });
    }

    function removeCustomListItem(listId, itemId) {
        const currentLists = selectedCharacter.customLists || [];
        const newLists = currentLists.map(l => {
            if (l.id === listId) {
                return { ...l, items: l.items.filter(i => i.id !== itemId) };
            }
            return l;
        });
        projectActions.updateCharacter(selectedCharacterId, { customLists: newLists });
    }

    function addRelationship() {
        if (!newRelTargetId || !newRelType.trim()) {
            notifications.add('대상과 관계 유형을 입력해주세요.', 'warning');
            return;
        }
        if (newRelTargetId === selectedCharacterId) {
            notifications.add('자기 자신과는 관계를 맺을 수 없습니다.', 'warning');
            return;
        }

        const currentRels = selectedCharacter.relationships || [];
        // Check if already exists
        if (currentRels.some(r => r.targetId === newRelTargetId)) {
            notifications.add('이미 관계가 존재하는 대상입니다.', 'warning');
            return;
        }

        const newRels = [
            ...currentRels,
            { targetId: newRelTargetId, type: newRelType.trim(), description: newRelDesc.trim() }
        ];
        updateCharacter('relationships', newRels);
        
        // Reset inputs
        newRelTargetId = '';
        newRelType = '';
        newRelDesc = '';
        notifications.add('관계가 추가되었습니다.', 'success');
    }

    function removeRelationship(targetId) {
        const currentRels = selectedCharacter.relationships || [];
        const newRels = currentRels.filter(r => r.targetId !== targetId);
        updateCharacter('relationships', newRels);
    }

    function updateRelationship(targetId, field, value) {
        const currentRels = selectedCharacter.relationships || [];
        const newRels = currentRels.map(r => {
            if (r.targetId === targetId) {
                return { ...r, [field]: value };
            }
            return r;
        });
        updateCharacter('relationships', newRels);
    }

    // Tags Logic
    let isAddingTag = false;
    let newTagInput = '';

    function addTag() {
        const tag = newTagInput.trim().replace(/^#/, '');
        if (!tag) {
            isAddingTag = false;
            return;
        }
        const currentTags = selectedCharacter.tags || [];
        if (!currentTags.includes(tag)) {
            updateCharacter('tags', [...currentTags, tag]);
        }
        newTagInput = '';
        isAddingTag = false;
    }

    function removeTag(tagToRemove) {
        const currentTags = selectedCharacter.tags || [];
        updateCharacter('tags', currentTags.filter(t => t !== tagToRemove));
    }

    function deleteCharacter(id) {
        // We let projectActions.removeCharacter handle the confirmation prompt
        // as it knows more about the character's data state.
        projectActions.removeCharacter(id);
        
        // Check if character was removed (by listening to story change or just checking selectedCharacterId)
        // Since store updates are reactive, we just need to ensure the selection is cleared 
        // if the character is no longer in the list.
        setTimeout(() => {
            if (!story.characters.some(c => c.id === id)) {
                selectedCharacterId = null;
            }
        }, 100);
    }

    function createCharacter(affiliationId = null) {
        // 1. Create a new character with a default name
        projectActions.addNewCharacter('');
        
        // 2. Since addNewCharacter doesn't return the ID, we wait for the update
        // and find the newly created character (it will be the last one added).
        // However, we can't await synchronous store updates easily here without a tick or subscription check.
        // But since svelte stores update synchronously in this context:
        
        setTimeout(() => {
            const chars = story.characters;
            const newChar = chars[chars.length - 1]; // Assume appended to end
            
            if (newChar) {
                // 3. Update affiliation if provided
                if (affiliationId && affiliationId !== 'unassigned') {
                    projectActions.updateCharacter(newChar.id, { affiliation: affiliationId });
                }
                
                // 4. Select the new character
                selectCharacter(newChar.id);
                notifications.add('새 캐릭터가 생성되었습니다.', 'success');
            }
        }, 50);
    }

    function createGroup() {
        uiState.prompt({
            title: '새 소속/단체 만들기',
            placeholder: '단체 이름 (예: 붉은 기사단)',
            onConfirm: (name) => {
                if (name) projectActions.createWikiItem('group', { name });
            }
        });
    }

    async function exportCharacterSheet() {
        if (!selectedCharacter) return;
        
        const c = selectedCharacter;
        const roleInfo = ROLE_MAP[c.role] || { label: c.role || '미설정', color: '#333', bg: '#eee' };
        
        let profileImageSrc = null;
        if (c.profileImage && window.electronAPI) {
            try {
                const result = await window.electronAPI.readImageBase64(c.profileImage);
                if (result.success) {
                    profileImageSrc = result.dataUri;
                }
            } catch (e) {
                console.error("Failed to load image for export", e);
            }
        }
        
        // Fallback if base64 conversion failed or not in electron
        if (!profileImageSrc && c.profileImage) {
             profileImageSrc = c.profileImage;
        }

        const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${c.name} - Character Sheet</title>
<style>
    body { font-family: 'Malgun Gothic', sans-serif; padding: 40px; background: #f0f0f0; color: #333; margin: 0; }
    .sheet { max-width: 800px; margin: 0 auto; background: white; padding: 50px; box-shadow: 0 0 20px rgba(0,0,0,0.1); border-radius: 8px; }
    .header { display: flex; gap: 30px; margin-bottom: 40px; border-bottom: 2px solid #222; padding-bottom: 30px; }
    .avatar-box { width: 150px; height: 150px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: #eee; border: 4px solid ${c.color || '#ddd'}; position: relative; }
    .avatar-box img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 3em; color: #aaa; background: #eee; }
    
    .info { flex: 1; }
    h1 { margin: 0 0 10px 0; font-size: 2.5em; color: #222; line-height: 1.2; }
    .role-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.9em; margin-bottom: 15px; }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 15px; }
    .tag { background: #f1f3f5; border: 1px solid #e9ecef; color: #495057; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; }
    .desc { font-size: 1.1em; line-height: 1.6; color: #555; font-style: italic; }

    .section { margin-bottom: 35px; page-break-inside: avoid; }
    .section h2 { border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 20px; font-size: 1.3em; color: ${c.color || '#333'}; text-transform: uppercase; letter-spacing: 1px; }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .field { margin-bottom: 15px; }
    .field.full { grid-column: 1 / -1; }
    .label { font-weight: bold; color: #888; font-size: 0.85em; display: block; margin-bottom: 4px; text-transform: uppercase; }
    .value { font-size: 1.1em; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px; }
    
    .long-text { white-space: pre-wrap; line-height: 1.7; background: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid ${c.color || '#ddd'}; }
    
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; }
    .stat-box { background: #fff; border: 1px solid #eee; padding: 15px; text-align: center; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.03); }
    .stat-key { font-size: 0.9em; color: #888; display: block; margin-bottom: 5px; }
    .stat-val { font-weight: bold; font-size: 1.4em; color: #333; }

    .trait-list { display: flex; flex-wrap: wrap; gap: 10px; }
    .trait-item { background: #fff; border: 1px solid #eee; padding: 8px 15px; border-radius: 20px; font-size: 1em; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .trait-item.strength { border-color: #a5d6a7; background: #e8f5e9; }
    .trait-item.weakness { border-color: #ef9a9a; background: #ffebee; }
    
    @media print {
        body { background: white; padding: 0; -webkit-print-color-adjust: exact; }
        .sheet { box-shadow: none; max-width: 100%; padding: 0; width: 100%; }
        .no-print { display: none; }
    }
</style>
</head>
<body>
    <div class="sheet">
        <div class="header">
            <div class="avatar-box">
                ${profileImageSrc ? 
                    `<img src="${profileImageSrc}" style="${getProfileImageStyle(c.profileImageTransform)}" />` : 
                    `<div class="avatar-placeholder">${c.name[0]}</div>`
                }
            </div>
            <div class="info">
                <h1>${c.name}</h1>
                <div class="role-badge" style="background-color: ${roleInfo.bg}; color: ${roleInfo.color}">
                    ${roleInfo.label}
                </div>
                <div class="tags">
                    ${(c.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}
                </div>
                <div class="desc">${c.description || '설명이 없습니다.'}</div>
            </div>
        </div>

        <div class="section">
            <h2>기본 정보</h2>
            <div class="grid-2">
                <div class="field"><span class="label">나이</span><div class="value">${c.appearance?.age || '-'}</div></div>
                <div class="field"><span class="label">생일</span><div class="value">${c.appearance?.birthday || '-'}</div></div>
                <div class="field"><span class="label">신체</span><div class="value">${c.appearance?.height || '-'}</div></div>
                <div class="field"><span class="label">소속</span><div class="value">${(story.groups.find(g => g.id === c.affiliation) || {}).name || '-'}</div></div>
                <div class="field"><span class="label">별칭</span><div class="value">${(c.aliases || []).join(', ') || '-'}</div></div>
                <div class="field"><span class="label">MBTI/성격</span><div class="value">${c.personality?.type || '-'}</div></div>
            </div>
        </div>
        
        ${c.appearance?.description ? `
        <div class="section">
            <h2>외모 묘사</h2>
            <div class="long-text">${c.appearance.description}</div>
        </div>` : ''}

        ${(c.personality?.likes?.length || c.personality?.dislikes?.length || c.personality?.hobbies?.length) ? `
        <div class="section">
            <h2>성격 & 기호</h2>
            <div class="grid-2">
                ${c.personality?.likes?.length ? `<div class="field"><span class="label">좋아하는 것</span><div class="value">${c.personality.likes.join(', ')}</div></div>` : ''}
                ${c.personality?.dislikes?.length ? `<div class="field"><span class="label">싫어하는 것</span><div class="value">${c.personality.dislikes.join(', ')}</div></div>` : ''}
                ${c.personality?.hobbies?.length ? `<div class="field full"><span class="label">취미</span><div class="value">${c.personality.hobbies.join(', ')}</div></div>` : ''}
            </div>
        </div>` : ''}

        <div class="section">
            <h2>서사 (Narrative)</h2>
            <div class="grid-2">
                <div class="field"><span class="label">목표</span><div class="value">${c.narrative?.goal || '-'}</div></div>
                <div class="field"><span class="label">동기</span><div class="value">${c.narrative?.motivation || '-'}</div></div>
                <div class="field"><span class="label">갈등</span><div class="value">${c.narrative?.conflict || '-'}</div></div>
                <div class="field"><span class="label">결점</span><div class="value">${c.narrative?.flaw || '-'}</div></div>
                <div class="field"><span class="label">거짓말 (Lie)</span><div class="value">${c.narrative?.lie || '-'}</div></div>
                <div class="field"><span class="label">트라우마</span><div class="value">${c.narrative?.trauma || '-'}</div></div>
                <div class="field full"><span class="label">키 아이템</span><div class="value">${c.narrative?.keyitem || '-'}</div></div>
            </div>
        </div>

        ${(c.voice?.tone || c.voice?.habit || c.voice?.keywords) ? `
        <div class="section">
            <h2>말투 (Voice)</h2>
            <div class="grid-2">
                ${c.voice?.tone ? `<div class="field"><span class="label">어조</span><div class="value">${c.voice.tone}</div></div>` : ''}
                ${c.voice?.habit ? `<div class="field"><span class="label">말버릇</span><div class="value">${c.voice.habit}</div></div>` : ''}
                ${c.voice?.keywords ? `<div class="field full"><span class="label">주요 단어</span><div class="value">${c.voice.keywords}</div></div>` : ''}
            </div>
        </div>` : ''}

        ${(c.strengths?.length || c.weaknesses?.length || c.abilities?.length) ? `
        <div class="section">
            <h2>특성 & 능력</h2>
            ${c.strengths?.length ? `
                <div class="field">
                    <span class="label">장점</span>
                    <div class="trait-list">
                        ${c.strengths.map(s => `<span class="trait-item strength">+ ${s}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            ${c.weaknesses?.length ? `
                <div class="field">
                    <span class="label">단점</span>
                    <div class="trait-list">
                        ${c.weaknesses.map(w => `<span class="trait-item weakness">- ${w}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            ${c.abilities?.length ? `
                <div class="field">
                    <span class="label">능력/특기</span>
                    <div class="trait-list">
                        ${c.abilities.map(a => `<span class="trait-item">★ ${a}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        </div>` : ''}

        ${Object.keys(c.attributes || {}).length > 0 ? `
        <div class="section">
            <h2>능력치</h2>
            <div class="stat-grid">
                ${Object.entries(c.attributes).map(([k, v]) => `
                    <div class="stat-box">
                        <span class="stat-key">${k}</span>
                        <div class="stat-val">${v}</div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        ${(c.customLists || []).length > 0 ? `
        <div class="section">
            <h2>기타 정보</h2>
            <div class="grid-2">
                ${c.customLists.map(list => `
                    <div class="field">
                        <span class="label">${list.name}</span>
                        <div class="value">
                            <div class="trait-list">
                                ${list.items.map(i => `<span class="trait-item">${i.value}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}
        
        <div class="section">
            <h2>인물 관계</h2>
            ${(c.relationships || []).length > 0 ? `
            <div class="grid-2">
                ${c.relationships.map(r => {
                    const target = story.characters.find(ch => ch.id === r.targetId);
                    return target ? `
                    <div class="field">
                        <span class="label">vs ${target.name}</span>
                        <div class="value"><strong>${r.type}</strong>: ${r.description || ''}</div>
                    </div>` : '';
                }).join('')}
            </div>` : '<div class="desc">등록된 관계가 없습니다.</div>'}
        </div>

    </div>
</body>
</html>
        `;

        // Use the existing saveHtmlGame API which is generic enough
        if (window.electronAPI) {
            const result = await window.electronAPI.saveHtmlGame(html, `${c.name}_시트`);
            if (result.success) {
                notifications.add('캐릭터 시트가 저장되었습니다.', 'success');
            }
        } else {
            // Fallback for web (not likely used in this context but good practice)
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${c.name}_시트.html`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    async function openImageFile() {
        if (!selectedCharacterId) return;
        const result = await window.electronAPI.openImageFile();
        if (result && result.filePath) {
            projectActions.updateCharacter(selectedCharacterId, { profileImage: result.filePath });
        }
    }

    function focus(node) {
        node.focus();
    }

    function close() {
        dispatch('close');
    }
</script>

<svelte:window 
    on:mousemove={handleImageMouseMove} 
    on:mouseup={handleImageMouseUp} 
/>

{#if isOpen}
    <div 
        class="modal-backdrop" 
        on:click={close} 
        on:keydown={(e) => e.key === 'Escape' && close()}
        role="button"
        tabindex="0"
        transition:fade={{ duration: 200 }}
    >
        <div class="modal-content studio-modal" on:click|stopPropagation role="none">
            <div class="studio-container">
                <!-- Left Panel: Sidebar (Affiliations) -->
                <div class="studio-sidebar">
                    <div class="sidebar-header">
                        <div class="sidebar-top">
                            <h2>캐릭터 스튜디오</h2>
                            <button class="sidebar-icon-btn" on:click={createGroup} title="새 소속 추가">
                                <Icon name="flag" size={18} />
                            </button>
                        </div>
                        <div class="search-box">
                            <Icon name="search" size={14} />
                            <input type="text" bind:value={searchText} placeholder="검색..." />
                        </div>
                    </div>
                    
                    <div class="roles-container">
                        {#each groupedCharacters as group (group.id)}
                            <div 
                                class="role-group"
                                on:dragover|preventDefault
                                on:drop={(e) => handleDrop(e, group.id)}
                            >
                                <div 
                                    class="role-header group-header" 
                                    on:click={() => toggleGroup(group.id)}
                                    on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleGroup(group.id)}
                                    role="button"
                                    tabindex="0"
                                >
                                    <Icon name={collapsedGroups[group.id] ? "chevron-right" : "chevron-down"} size={12} />
                                    {#if group.id === '__favorites__'}
                                        <Icon name="star" size={12} fill="var(--accent-color)" color="var(--accent-color)" />
                                    {/if}
                                    <span class="role-title">{group.name}</span>
                                    <span class="role-count">{group.items.length}</span>
                                    
                                    {#if group.type === 'group'}
                                        {@const realGroup = story.groups.find(g => g.id === group.id)}
                                        <button 
                                            class="add-mini-btn" 
                                            style="margin-left: auto; margin-right: 4px;"
                                            class:active={realGroup?.isFavorite}
                                            on:click|stopPropagation={() => projectActions.toggleWikiItemFavorite('group', group.id)}
                                            title="이 소속 고정하기"
                                        >
                                            <Icon name="star" size={12} fill={realGroup?.isFavorite ? "var(--text-color-muted)" : "none"} />
                                        </button>
                                        <button class="add-mini-btn" style="margin-left: 0;" on:click|stopPropagation={() => createCharacter(group.id)} title="이 소속에 캐릭터 추가">
                                            <Icon name="plus" size={12} />
                                        </button>
                                    {:else if group.id !== '__favorites__' && group.id !== 'unassigned'}
                                        <button class="add-mini-btn" on:click|stopPropagation={() => createCharacter(group.id)} title="이 소속에 캐릭터 추가">
                                            <Icon name="plus" size={12} />
                                        </button>
                                    {:else if group.id === 'unassigned'}
                                         <button class="add-mini-btn" on:click|stopPropagation={() => createCharacter('unassigned')} title="캐릭터 추가">
                                            <Icon name="plus" size={12} />
                                        </button>
                                    {/if}
                                </div>
                                {#if !collapsedGroups[group.id]}
                                    <div class="char-list" transition:slide|local={{ duration: 200 }}>
                                        {#each group.items as char (char.id)}
                                            <div 
                                                class="char-card" 
                                                class:selected={selectedCharacterId === char.id}
                                                draggable="true"
                                                on:dragstart={(e) => handleDragStart(e, char.id)}
                                                on:click={() => selectCharacter(char.id)}
                                                role="button"
                                                tabindex="0"
                                                on:keydown={(e) => e.key === 'Enter' && selectCharacter(char.id)}
                                            >
                                                <div class="char-avatar" style="background-color: {char.color}">
                                                    {#if char.profileImage}
                                                        <img src={char.profileImage} alt={char.name} />
                                                    {:else}
                                                        {char.name[0]}
                                                    {/if}
                                                </div>
                                                <div class="char-info">
                                                    <div class="char-name-row">
                                                        <span class="char-name">{char.name}</span>
                                                        {#if char.role && ROLE_MAP[char.role]}
                                                            <span 
                                                                class="role-badge" 
                                                                style="color: {ROLE_MAP[char.role].color}; background: {ROLE_MAP[char.role].bg}"
                                                            >
                                                                {ROLE_MAP[char.role].label}
                                                            </span>
                                                        {/if}
                                                    </div>
                                                    <div class="char-sub">{char.description?.substring(0, 20) || ''}</div>
                                                </div>
                                                <button 
                                                    class="fav-btn-mini" 
                                                    class:active={char.isFavorite}
                                                    on:click|stopPropagation={() => projectActions.toggleCharacterFavorite(char.id)}
                                                >
                                                    <Icon name="star" size={14} fill={char.isFavorite ? "var(--accent-color)" : "none"} color={char.isFavorite ? "var(--accent-color)" : "var(--text-color-muted)"} />
                                                </button>
                                            </div>
                                        {/each}
                                        {#if group.items.length === 0}
                                            <div class="empty-role-placeholder">
                                                드래그하여 소속 이동
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>

                    <div class="sidebar-footer">
                        <button class="cleanup-btn" on:click={() => {
                            confirmation.prompt('대사나 설정에 사용되지 않는 "빈 캐릭터"들을 모두 삭제하시겠습니까? (캐릭터 시트 내용이 있거나 즐겨찾기된 캐릭터는 제외됩니다.)', () => {
                                projectActions.cleanupCharacters();
                            });
                        }}>
                            <Icon name="trash-2" size={14} /> <span>미사용 캐릭터 정리</span>
                        </button>
                    </div>
                </div>

                <!-- Right Panel: Editor -->
                <div class="studio-main">
                    {#if selectedCharacter}
                        <div class="editor-header">
                            <div class="header-main">
                                <div 
                                    class="avatar-large-wrapper"
                                    on:wheel={handleImageWheel}
                                    on:mousedown={handleImageMouseDown}
                                    role="button"
                                    tabindex="0"
                                >
                                    <div class="avatar-large" style="background-color: {selectedCharacter.color}; cursor: {selectedCharacter.profileImage ? (isDraggingImage ? 'grabbing' : 'grab') : 'default'}">
                                        {#if selectedCharacter.profileImage}
                                            <img 
                                                src={selectedCharacter.profileImage} 
                                                alt={selectedCharacter.name} 
                                                style={imageTransformStyle}
                                                draggable="false"
                                            />
                                        {:else}
                                            {selectedCharacter.name[0]}
                                        {/if}
                                    </div>
                                    <div class="avatar-controls">
                                        <button class="avatar-control-btn" on:click|stopPropagation={openImageFile} title="프로필 이미지 변경">
                                            <Icon name="camera" size={14} color="white" />
                                        </button>
                                        <div 
                                            class="avatar-control-btn color-picker-wrapper" 
                                            title="지정색 변경" 
                                            on:click|stopPropagation 
                                            on:keydown|stopPropagation
                                            role="button"
                                            tabindex="0"
                                        >
                                            <Icon name="droplet" size={14} color="white" />
                                            <input 
                                                type="color" 
                                                class="hidden-color-input"
                                                value={selectedCharacter.color} 
                                                on:input={(e) => updateCharacter('color', e.target.value)}
                                            />
                                        </div>
                                        {#if selectedCharacter.profileImage}
                                            <button class="avatar-control-btn" on:click|stopPropagation={resetImageTransform} title="위치/크기 초기화">
                                                <Icon name="refresh-cw" size={14} color="white" />
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                                <div class="header-info">
                                    <div class="name-row">
                                        <button 
                                            class="fav-btn-header" 
                                            class:active={selectedCharacter.isFavorite}
                                            on:click={() => projectActions.toggleCharacterFavorite(selectedCharacter.id)}
                                            title="즐겨찾기 토글"
                                        >
                                            <Icon name="star" size={24} fill={selectedCharacter.isFavorite ? "#FFD700" : "none"} color={selectedCharacter.isFavorite ? "#FFD700" : "var(--text-color-muted)"} />
                                        </button>
                                        <input 
                                            class="name-input" 
                                            type="text" 
                                            value={selectedCharacter.name} 
                                            on:change={(e) => updateCharacter('name', e.target.value)}
                                        />
                                    </div>
                                    
                                    <div class="sub-info-row">
                                        <div class="role-select-wrapper">
                                            <span class="role-dot" style="background-color: {ROLE_MAP[selectedCharacter.role || 'uncategorized'].color}"></span>
                                            <select 
                                                value={selectedCharacter.role || 'uncategorized'} 
                                                on:change={(e) => updateCharacter('role', e.target.value)}
                                            >
                                                {#each ROLES as r}
                                                    <option value={r}>{ROLE_MAP[r].label}</option>
                                                {/each}
                                            </select>
                                        </div>
                                        <span class="divider">|</span>
                                        <div class="header-tags">
                                            {#each (selectedCharacter.tags || []) as tag}
                                                <span 
                                                    class="tag-chip" 
                                                    style="color: {getColorFromString(tag)}; background-color: {getColorFromString(tag)}15; border-color: {getColorFromString(tag)}30;"
                                                >
                                                    #{tag}
                                                    <button on:click={() => removeTag(tag)}>×</button>
                                                </span>
                                            {/each}
                                            
                                            {#if isAddingTag}
                                                <input 
                                                    class="tag-input-mini"
                                                    type="text" 
                                                    bind:value={newTagInput}
                                                    on:keydown={(e) => {
                                                        if (e.key === 'Enter') addTag();
                                                        if (e.key === 'Escape') isAddingTag = false;
                                                    }}
                                                    on:blur={addTag}
                                                    placeholder="태그..."
                                                    use:focus
                                                />
                                            {:else}
                                                <button class="add-tag-btn" on:click={() => isAddingTag = true}>
                                                    <Icon name="plus" size={12} />
                                                </button>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="header-actions">
                                <button class="action-icon-btn" title="시트 내보내기" on:click={exportCharacterSheet}>
                                    <Icon name="printer" size={20} />
                                </button>
                                <button class="action-icon-btn danger" title="캐릭터 삭제" on:click={() => deleteCharacter(selectedCharacter.id)}>
                                    <Icon name="trash-2" size={20} />
                                </button>
                                <button class="action-icon-btn close" title="닫기" on:click={close}>
                                    <Icon name="x" size={24} />
                                </button>
                            </div>
                        </div>

                        <!-- Editor Tabs -->
                        <div class="editor-tabs">
                            <button class:active={activeTab === 'basic'} on:click={() => activeTab = 'basic'}>기본 정보</button>
                            <button class:active={activeTab === 'appearance'} on:click={() => activeTab = 'appearance'}>외모</button>
                            <button class:active={activeTab === 'personality'} on:click={() => activeTab = 'personality'}>성격 & 기호</button>
                            <button class:active={activeTab === 'narrative'} on:click={() => activeTab = 'narrative'}>서사</button>
                            <button class:active={activeTab === 'voice'} on:click={() => activeTab = 'voice'}>말투</button>
                            <button class:active={activeTab === 'stats'} on:click={() => activeTab = 'stats'}>능력치</button>
                            <button class:active={activeTab === 'traits'} on:click={() => activeTab = 'traits'}>특성 & 능력</button>
                            <button class:active={activeTab === 'relationships'} on:click={() => activeTab = 'relationships'}>관계</button>
                            <button class:active={activeTab === 'custom'} on:click={() => activeTab = 'custom'}>사용자 지정</button>
                        </div>

                        <div class="editor-body">
                            <!-- Tab: Basic Info -->
                            {#if activeTab === 'basic'}
                                <div class="form-grid">
                                    <div class="form-group full">
                                        <label for="char-desc">개요 (Description)</label>
                                        <textarea 
                                            id="char-desc"
                                            class="desc-area"
                                            value={selectedCharacter.description || ''} 
                                            on:change={(e) => updateCharacter('description', e.target.value)}
                                            placeholder="캐릭터에 대한 전반적인 설명이나 배경을 입력하세요..."
                                        ></textarea>
                                    </div>

                                    <div class="form-group">
                                        <label for="char-alias">별칭 (Aliases)</label>
                                        <input 
                                            id="char-alias"
                                            type="text" 
                                            value={(selectedCharacter.aliases || []).join(', ')} 
                                            on:change={(e) => updateCharacter('aliases', e.target.value.split(',').map(s => s.trim()))}
                                            placeholder="별명, 애칭 (쉼표로 구분)"
                                        />
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="char-cat">카테고리</label>
                                         <input 
                                            id="char-cat"
                                            type="text" 
                                            list="char-cats"
                                            value={selectedCharacter.category || ''} 
                                            on:change={(e) => updateCharacter('category', e.target.value)}
                                            placeholder="종족, 직업 등"
                                        />
                                        <datalist id="char-cats">
                                            {#each (story.characterCategories || []) as cat}
                                                <option value={cat} />
                                            {/each}
                                        </datalist>
                                    </div>

                                    <div class="form-group">
                                        <label for="char-aff">소속 (Affiliation)</label>
                                         <select 
                                            id="char-aff"
                                            value={selectedCharacter.affiliation || ''} 
                                            on:change={(e) => updateCharacter('affiliation', e.target.value || null)}
                                        >
                                            <option value="">소속 없음</option>
                                            {#each (story.groups || []) as g}
                                                <option value={g.id}>{g.name}</option>
                                            {/each}
                                        </select>
                                    </div>
                                </div>
                            {/if}

                            <!-- Tab: Appearance -->
                            {#if activeTab === 'appearance'}
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label for="app-age">나이 (Age)</label>
                                        <input 
                                            id="app-age" 
                                            type="text" 
                                            value={selectedCharacter.appearance?.age || ''} 
                                            on:change={(e) => {
                                                const appearance = { ...(selectedCharacter.appearance || {}), age: e.target.value };
                                                updateCharacter('appearance', appearance);
                                            }}
                                            placeholder="예: 24세, 불명"
                                        />
                                    </div>
                                    <div class="form-group">
                                        <label for="app-birth">생일 (Birthday)</label>
                                        <input 
                                            id="app-birth" 
                                            type="text" 
                                            value={selectedCharacter.appearance?.birthday || ''} 
                                            on:change={(e) => {
                                                const appearance = { ...(selectedCharacter.appearance || {}), birthday: e.target.value };
                                                updateCharacter('appearance', appearance);
                                            }}
                                            placeholder="예: 1월 1일"
                                        />
                                    </div>
                                    <div class="form-group">
                                        <label for="app-height">신체 (Height/Body)</label>
                                        <input 
                                            id="app-height" 
                                            type="text" 
                                            value={selectedCharacter.appearance?.height || ''} 
                                            on:change={(e) => {
                                                const appearance = { ...(selectedCharacter.appearance || {}), height: e.target.value };
                                                updateCharacter('appearance', appearance);
                                            }}
                                            placeholder="예: 175cm, 마른 체형"
                                        />
                                    </div>
                                    <div class="form-group">
                                        <label for="app-hair">머리스타일 (Hair)</label>
                                        <input 
                                            id="app-hair" 
                                            type="text" 
                                            value={selectedCharacter.appearance?.hair || ''} 
                                            on:change={(e) => {
                                                const appearance = { ...(selectedCharacter.appearance || {}), hair: e.target.value };
                                                updateCharacter('appearance', appearance);
                                            }}
                                            placeholder="예: 검은색 긴 생머리"
                                        />
                                    </div>
                                    <div class="form-group">
                                        <label for="app-eyes">눈동자 (Eyes)</label>
                                        <input 
                                            id="app-eyes" 
                                            type="text" 
                                            value={selectedCharacter.appearance?.eyes || ''} 
                                            on:change={(e) => {
                                                const appearance = { ...(selectedCharacter.appearance || {}), eyes: e.target.value };
                                                updateCharacter('appearance', appearance);
                                            }}
                                            placeholder="예: 짙은 갈색, 날카로운 눈매"
                                        />
                                    </div>
                                    <div class="form-group">
                                        <label for="app-skin">피부 (Skin)</label>
                                        <input 
                                            id="app-skin" 
                                            type="text" 
                                            value={selectedCharacter.appearance?.skin || ''} 
                                            on:change={(e) => {
                                                const appearance = { ...(selectedCharacter.appearance || {}), skin: e.target.value };
                                                updateCharacter('appearance', appearance);
                                            }}
                                            placeholder="예: 하얀 피부, 주근깨"
                                        />
                                    </div>
                                    <div class="form-group full">
                                        <label for="app-clothing">옷차림 (Clothing)</label>
                                        <input 
                                            id="app-clothing" 
                                            type="text" 
                                            value={selectedCharacter.appearance?.clothing || ''} 
                                            on:change={(e) => {
                                                const appearance = { ...(selectedCharacter.appearance || {}), clothing: e.target.value };
                                                updateCharacter('appearance', appearance);
                                            }}
                                            placeholder="예: 단정한 정장, 낡은 로브"
                                        />
                                    </div>
                                    <div class="form-group full">
                                        <label for="app-desc">기타 외모 묘사 (Description)</label>
                                        <textarea 
                                            id="app-desc" 
                                            class="desc-area"
                                            value={selectedCharacter.appearance?.description || ''} 
                                            on:change={(e) => {
                                                const appearance = { ...(selectedCharacter.appearance || {}), description: e.target.value };
                                                updateCharacter('appearance', appearance);
                                            }} 
                                            placeholder="위 항목에 없는 외형적인 특징이나 분위기를 묘사하세요."
                                        ></textarea>
                                    </div>
                                </div>
                            {/if}

                            <!-- Tab: Personality -->
                            {#if activeTab === 'personality'}
                                <div class="form-grid">
                                    <div class="form-group full">
                                        <label for="p-mbti">성격 유형 / MBTI</label>
                                        <input 
                                            id="p-mbti" 
                                            type="text" 
                                            value={selectedCharacter.personality?.type || ''} 
                                            on:change={(e) => {
                                                const personality = { ...(selectedCharacter.personality || {}), type: e.target.value };
                                                updateCharacter('personality', personality);
                                            }}
                                            placeholder="예: INTJ, 대담한 통솔자"
                                        />
                                    </div>
                                    <div class="form-group full">
                                        <label for="p-likes">좋아하는 것 (Likes)</label>
                                        <input 
                                            id="p-likes" 
                                            type="text" 
                                            value={(selectedCharacter.personality?.likes || []).join(', ')} 
                                            on:change={(e) => {
                                                const likes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                                const personality = { ...(selectedCharacter.personality || {}), likes };
                                                updateCharacter('personality', personality);
                                            }}
                                            placeholder="커피, 고양이 (쉼표로 구분)"
                                        />
                                    </div>
                                    <div class="form-group full">
                                        <label for="p-dislikes">싫어하는 것 (Dislikes)</label>
                                        <input 
                                            id="p-dislikes" 
                                            type="text" 
                                            value={(selectedCharacter.personality?.dislikes || []).join(', ')} 
                                            on:change={(e) => {
                                                const dislikes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                                const personality = { ...(selectedCharacter.personality || {}), dislikes };
                                                updateCharacter('personality', personality);
                                            }}
                                            placeholder="비, 쓴 약 (쉼표로 구분)"
                                        />
                                    </div>
                                    <div class="form-group full">
                                        <label for="p-hobbies">취미 (Hobbies)</label>
                                        <input 
                                            id="p-hobbies" 
                                            type="text" 
                                            value={(selectedCharacter.personality?.hobbies || []).join(', ')} 
                                            on:change={(e) => {
                                                const hobbies = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                                const personality = { ...(selectedCharacter.personality || {}), hobbies };
                                                updateCharacter('personality', personality);
                                            }}
                                            placeholder="독서, 검술 수련 (쉼표로 구분)"
                                        />
                                    </div>
                                </div>
                            {/if}

                            <!-- Tab: Narrative -->
                            {#if activeTab === 'narrative'}
                                <div class="form-grid">
                                    <div class="form-group full">
                                        <label for="n-goal">목표 (Goal)</label>
                                        <textarea id="n-goal" class="desc-area" value={selectedCharacter.narrative?.goal || ''} on:change={(e) => updateNarrative('goal', e.target.value)} placeholder="이 캐릭터가 이루고자 하는 궁극적인 목표"></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label for="n-motiv">동기 (Motivation)</label>
                                        <textarea id="n-motiv" class="desc-area" value={selectedCharacter.narrative?.motivation || ''} on:change={(e) => updateNarrative('motivation', e.target.value)} placeholder="왜 그 목표를 이루려고 하는가?"></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label for="n-conflict">갈등 (Conflict)</label>
                                        <textarea id="n-conflict" class="desc-area" value={selectedCharacter.narrative?.conflict || ''} on:change={(e) => updateNarrative('conflict', e.target.value)} placeholder="목표를 가로막는 장애물"></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label for="n-flaw">결점 (Flaw)</label>
                                        <textarea id="n-flaw" class="desc-area" value={selectedCharacter.narrative?.flaw || ''} on:change={(e) => updateNarrative('flaw', e.target.value)} placeholder="치명적인 약점이나 성격적 결함"></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label for="n-lie">거짓말 (Lie)</label>
                                        <textarea id="n-lie" class="desc-area" value={selectedCharacter.narrative?.lie || ''} on:change={(e) => updateNarrative('lie', e.target.value)} placeholder="스스로에게 하고 있는 거짓말이나 잘못된 믿음"></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label for="n-trauma">트라우마 (Trauma)</label>
                                        <textarea id="n-trauma" class="desc-area" value={selectedCharacter.narrative?.trauma || ''} on:change={(e) => updateNarrative('trauma', e.target.value)} placeholder="과거의 상처나 정신적 충격"></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label for="n-keyitem">키 아이템 (Key Item)</label>
                                        <textarea id="n-keyitem" class="desc-area" value={selectedCharacter.narrative?.keyitem || ''} on:change={(e) => updateNarrative('keyitem', e.target.value)} placeholder="캐릭터에게 중요한 의미를 가지는 물건"></textarea>
                                    </div>
                                </div>
                            {/if}

                            <!-- Tab: Voice -->
                            {#if activeTab === 'voice'}
                                <div class="form-grid">
                                    <div class="form-group full">
                                        <label for="v-tone">어조 (Tone)</label>
                                        <textarea id="v-tone" class="desc-area" value={selectedCharacter.voice?.tone || ''} on:change={(e) => updateVoice('tone', e.target.value)} placeholder="목소리 톤이나 말투의 특징"></textarea>
                                    </div>
                                    <div class="form-group full">
                                        <label for="v-habit">말버릇 (Habit)</label>
                                        <textarea id="v-habit" class="desc-area" value={selectedCharacter.voice?.habit || ''} on:change={(e) => updateVoice('habit', e.target.value)} placeholder="자주 쓰는 문장 끝맺음이나 습관"></textarea>
                                    </div>
                                    <div class="form-group full">
                                        <label for="v-key">주요 단어 (Keywords)</label>
                                        <textarea id="v-key" class="desc-area" value={selectedCharacter.voice?.keywords || ''} on:change={(e) => updateVoice('keywords', e.target.value)} placeholder="자주 사용하는 단어나 표현"></textarea>
                                    </div>
                                </div>
                            {/if}

                            <!-- Tab: Stats -->
                            {#if activeTab === 'stats'}
                                <div class="stats-list">
                                    {#each Object.entries(selectedCharacter.attributes || {}) as [key, value]}
                                        <div class="stat-row">
                                            <input type="text" class="stat-key" value={key} on:change={(e) => updateAttributeKey(key, e.target.value)} />
                                            <input type="text" class="stat-value" value={value} on:change={(e) => updateAttributeValue(key, e.target.value)} />
                                            <button class="icon-btn danger" on:click={() => removeAttribute(key)}><Icon name="trash-2" size={16}/></button>
                                        </div>
                                    {/each}
                                    <div class="stat-add-row">
                                        <input type="text" class="stat-key" bind:value={newAttributeName} placeholder="새 능력치 (예: 근력)" />
                                        <input type="text" class="stat-value" bind:value={newAttributeValue} placeholder="값" on:keydown={(e) => e.key === 'Enter' && addAttribute()} />
                                        <button class="icon-btn primary" on:click={addAttribute}><Icon name="plus" size={16}/></button>
                                    </div>
                                </div>
                            {/if}

                            <!-- Tab: Traits & Abilities -->
                            {#if activeTab === 'traits'}
                                <div class="traits-container">
                                    <div class="traits-grid">
                                        <!-- Strengths -->
                                        <div class="trait-section">
                                            <h4>장점 (Strengths)</h4>
                                            <div class="trait-list">
                                                {#each (selectedCharacter.strengths || []) as item, index}
                                                    <div class="trait-item">
                                                        <span class="bullet positive">+</span>
                                                        <input type="text" value={item} on:change={(e) => updateTrait('strengths', index, e.target.value)} />
                                                        <button class="icon-btn tiny ghost danger" on:click={() => removeTrait('strengths', index)}><Icon name="x" size={12}/></button>
                                                    </div>
                                                {/each}
                                                <div class="trait-add">
                                                    <input 
                                                        type="text" 
                                                        bind:value={newStrength} 
                                                        placeholder="장점 추가..." 
                                                        on:keydown={(e) => e.key === 'Enter' && addTrait('strengths', newStrength)}
                                                    />
                                                    <button class="icon-btn small primary" on:click={() => addTrait('strengths', newStrength)}><Icon name="plus" size={14}/></button>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Weaknesses -->
                                        <div class="trait-section">
                                            <h4>단점 (Weaknesses)</h4>
                                            <div class="trait-list">
                                                {#each (selectedCharacter.weaknesses || []) as item, index}
                                                    <div class="trait-item">
                                                        <span class="bullet negative">-</span>
                                                        <input type="text" value={item} on:change={(e) => updateTrait('weaknesses', index, e.target.value)} />
                                                        <button class="icon-btn tiny ghost danger" on:click={() => removeTrait('weaknesses', index)}><Icon name="x" size={12}/></button>
                                                    </div>
                                                {/each}
                                                <div class="trait-add">
                                                    <input 
                                                        type="text" 
                                                        bind:value={newWeakness} 
                                                        placeholder="단점 추가..." 
                                                        on:keydown={(e) => e.key === 'Enter' && addTrait('weaknesses', newWeakness)}
                                                    />
                                                    <button class="icon-btn small primary" on:click={() => addTrait('weaknesses', newWeakness)}><Icon name="plus" size={14}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Abilities -->
                                    <div class="trait-section full-width">
                                        <h4>능력 & 특기 (Abilities)</h4>
                                        <div class="trait-list">
                                            {#each (selectedCharacter.abilities || []) as item, index}
                                                <div class="trait-item">
                                                    <span class="bullet star">★</span>
                                                    <input type="text" value={item} on:change={(e) => updateTrait('abilities', index, e.target.value)} />
                                                    <button class="icon-btn tiny ghost danger" on:click={() => removeTrait('abilities', index)}><Icon name="x" size={12}/></button>
                                                </div>
                                            {/each}
                                            <div class="trait-add">
                                                <input 
                                                    type="text" 
                                                    bind:value={newAbility} 
                                                    placeholder="능력이나 특기 추가..." 
                                                    on:keydown={(e) => e.key === 'Enter' && addTrait('abilities', newAbility)}
                                                />
                                                <button class="icon-btn small primary" on:click={() => addTrait('abilities', newAbility)}><Icon name="plus" size={14}/></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {/if}

                            <!-- Tab: Relationships -->
                            {#if activeTab === 'relationships'}
                                <div class="relationships-container">
                                    <div class="rel-actions-top">
                                        <div class="rel-add-row">
                                            <select bind:value={newRelTargetId} class="ghost-select">
                                                <option value="">+ 대상 선택...</option>
                                                {#each story.characters as char}
                                                    {#if char.id !== selectedCharacterId}
                                                        <option value={char.id}>{char.name}</option>
                                                    {/if}
                                                {/each}
                                            </select>
                                            {#if newRelTargetId}
                                                <input type="text" bind:value={newRelType} placeholder="관계 유형 (예: 친구)" class="ghost-input" />
                                                <input type="text" bind:value={newRelDesc} placeholder="설명 (선택)" class="ghost-input flex-grow" />
                                                <button class="icon-btn primary small" on:click={addRelationship}>
                                                    <Icon name="plus" size={16} />
                                                </button>
                                            {/if}
                                        </div>
                                        <button class="text-btn small" on:click={() => showFullDiagram = true}>
                                            <Icon name="share-2" size={14} /> 전체 관계도
                                        </button>
                                    </div>

                                    <div class="rel-list">
                                        {#each (selectedCharacter.relationships || []) as rel}
                                            {@const targetChar = story.characters.find(c => c.id === rel.targetId)}
                                            {#if targetChar}
                                                <div class="rel-item">
                                                    <div class="rel-avatar-small" style="background-color: {targetChar.color}">
                                                        {#if targetChar.profileImage}
                                                            <img src={targetChar.profileImage} alt={targetChar.name} />
                                                        {:else}
                                                            {targetChar.name[0]}
                                                        {/if}
                                                    </div>
                                                    <div class="rel-content">
                                                        <div class="rel-header-line">
                                                            <span class="rel-target-name">{targetChar.name}</span>
                                                            <input 
                                                                type="text" 
                                                                class="rel-type-input"
                                                                value={rel.type} 
                                                                on:change={(e) => updateRelationship(rel.targetId, 'type', e.target.value)}
                                                                placeholder="관계 유형"
                                                            />
                                                        </div>
                                                        <input 
                                                            type="text" 
                                                            class="rel-desc-input"
                                                            value={rel.description || ''} 
                                                            on:change={(e) => updateRelationship(rel.targetId, 'description', e.target.value)}
                                                            placeholder="관계에 대한 상세 설명..."
                                                        />
                                                    </div>
                                                    <button class="icon-btn danger ghost" on:click={() => removeRelationship(rel.targetId)}>
                                                        <Icon name="x" size={16} />
                                                    </button>
                                                </div>
                                            {/if}
                                        {/each}
                                        {#if !(selectedCharacter.relationships || []).length}
                                            <div class="empty-text-centered">등록된 관계가 없습니다. 대상을 선택하여 추가해보세요.</div>
                                        {/if}
                                    </div>
                                </div>
                            {/if}

                            <!-- Tab: Custom Lists -->
                            {#if activeTab === 'custom'}
                                <div class="custom-lists-container">
                                    <div class="custom-header-actions">
                                        <button class="primary-btn small" on:click={addCustomList}>
                                            <Icon name="plus" size={14} /> 새 목록 만들기
                                        </button>
                                    </div>
                                    
                                    <div class="custom-lists-grid">
                                        {#each (selectedCharacter.customLists || []) as list (list.id)}
                                            <div class="custom-list-card">
                                                <div class="list-header-row">
                                                    <input 
                                                        type="text" 
                                                        class="list-title-input" 
                                                        value={list.name} 
                                                        on:change={(e) => updateCustomListName(list.id, e.target.value)} 
                                                    />
                                                    <button class="icon-btn danger ghost" on:click={() => removeCustomList(list.id)}>
                                                        <Icon name="trash-2" size={14} />
                                                    </button>
                                                </div>
                                                <div class="list-items">
                                                    {#each list.items as item (item.id)}
                                                        <div class="list-item-row">
                                                            <span class="bullet">•</span>
                                                            <input 
                                                                type="text" 
                                                                class="list-item-input" 
                                                                value={item.value} 
                                                                on:change={(e) => updateCustomListItem(list.id, item.id, e.target.value)} 
                                                                placeholder="내용 입력..."
                                                            />
                                                            <button class="icon-btn danger tiny ghost" on:click={() => removeCustomListItem(list.id, item.id)}>
                                                                <Icon name="x" size={12} />
                                                            </button>
                                                        </div>
                                                    {/each}
                                                    <button class="add-item-btn" on:click={() => addCustomListItem(list.id)}>
                                                        <Icon name="plus" size={12} /> 항목 추가
                                                    </button>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>

                                    {#if !(selectedCharacter.customLists || []).length}
                                        <div class="empty-text-centered">
                                            생성된 사용자 지정 목록이 없습니다.<br>
                                            '새 목록 만들기'를 눌러 좋아하는 것, 싫어하는 것, 소지품 등을 관리해보세요.
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {:else}
                        <div class="empty-state">
                            <div class="empty-actions-right">
                                <button class="action-icon-btn close" on:click={close}><Icon name="x" size={24} /></button>
                            </div>
                            <div class="empty-content">
                                <Icon name="users" size={48} />
                                <p>캐릭터를 선택하거나 새로운 캐릭터를 추가하세요.</p>
                                <button class="primary-btn big" on:click={() => createCharacter()}>
                                    <Icon name="plus" size={18} /> 새 캐릭터 만들기
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Full Diagram Modal -->
{#if showFullDiagram}
    <div class="modal-backdrop" style="z-index: 1300;">
        <div class="modal-content full-screen-modal">
            <div class="diagram-header">
                <h3>인물 관계도</h3>
                <button class="close-btn" on:click={() => showFullDiagram = false}><Icon name="x" size={24}/></button>
            </div>
            <div class="diagram-body">
                <CharacterRelationshipDiagram characters={story.characters} dictionary={story.dictionary} groups={story.groups} />
            </div>
        </div>
    </div>
{/if}

<style>
    /* Modal Wrapper Styles */
    .modal-backdrop {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.7); z-index: 1100;
        display: flex; justify-content: center; align-items: center;
    }
    .modal-content.studio-modal {
        width: 95%; height: 92%;
        background: var(--primary-bg);
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        display: flex;
        overflow: hidden;
    }
    .studio-container { display: flex; height: 100%; width: 100%; overflow: hidden; }
    
    /* Sidebar */
    .studio-sidebar {
        width: 320px; min-width: 320px;
        border-right: 1px solid var(--border-color);
        display: flex; flex-direction: column;
        background: var(--secondary-bg);
    }
    .sidebar-header { padding: 12px 16px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px; }
    .sidebar-top { display: flex; justify-content: space-between; align-items: center; }
    .sidebar-header h2 { margin: 0; font-size: 1.05em; color: var(--text-color); font-weight: 700; }
    .search-box {
        display: flex; align-items: center; gap: 6px;
        background: var(--primary-bg); border: 1px solid var(--border-color);
        padding: 2px 10px; border-radius: 6px; transition: all 0.2s;
    }
    .search-box:focus-within { border-color: var(--accent-color); background: var(--secondary-bg); }
    .sidebar-icon-btn {
        background: none; border: none; color: var(--text-color-muted);
        padding: 4px; cursor: pointer; transition: all 0.2s;
        display: flex; align-items: center; justify-content: center;
    }
    .sidebar-icon-btn:hover { color: var(--accent-color); transform: scale(1.1); }

    .search-box input { border: none; background: none; width: 100%; color: var(--text-color); font-size: 0.85em; }
    .search-box input:focus { outline: none; }
    
    .sidebar-footer {
        padding: 12px;
        border-top: 1px solid var(--border-color);
        background: var(--secondary-bg);
    }
    .cleanup-btn {
        width: 100%; padding: 8px; background: rgba(var(--danger-color-rgb), 0.05);
        border: 1px dashed var(--border-color); color: var(--text-color-muted);
        border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
        font-size: 0.85em; transition: all 0.2s;
    }
    .cleanup-btn:hover {
        background: rgba(var(--danger-color-rgb), 0.1);
        border-color: var(--danger-color);
        color: var(--danger-color);
    }

    .roles-container {
        flex: 1; overflow-y: auto; padding: 15px;
        display: flex; flex-direction: column; gap: 20px;
    }
    .role-group { display: flex; flex-direction: column; gap: 8px; }
    .role-header.group-header {
        display: flex; align-items: center; gap: 8px;
        font-size: 0.9em; font-weight: bold; color: var(--text-color-muted);
        padding-left: 8px; 
    }
    .role-count { background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 10px; font-size: 0.8em; }
    .add-mini-btn {
        margin-left: auto; background: none; border: none; color: var(--text-color-muted);
        cursor: pointer; opacity: 0; transition: opacity 0.2s;
    }
    .role-group:hover .add-mini-btn { opacity: 1; }
    
    .fav-btn-mini {
        background: none; border: none; padding: 4px; cursor: pointer;
        opacity: 0; transition: opacity 0.2s; display: flex; align-items: center;
    }
    .char-card:hover .fav-btn-mini, .fav-btn-mini.active { opacity: 1; }
    
    .char-list { display: flex; flex-direction: column; gap: 5px; min-height: 10px; }
    
    .char-card {
        display: flex; align-items: center; gap: 10px;
        padding: 10px; border-radius: 6px;
        background: var(--primary-bg);
        border: 1px solid transparent;
        cursor: pointer; transition: all 0.2s;
    }
    .char-card:hover { transform: translateX(2px); border-color: var(--border-color); }
    .char-card.selected { background: var(--accent-color); color: white; }
    .char-avatar {
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; justify-content: center; align-items: center;
        font-weight: bold; overflow: hidden; background: #555; flex-shrink: 0;
    }
    .char-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .char-info { flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
    .char-name-row { display: flex; align-items: center; gap: 6px; }
    .char-name { font-weight: bold; font-size: 0.95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .role-badge {
        font-size: 0.7em; padding: 1px 4px; border-radius: 4px; font-weight: bold; white-space: nowrap;
    }
    .char-sub { font-size: 0.8em; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty-role-placeholder {
        padding: 10px; border: 1px dashed var(--border-color); border-radius: 4px;
        text-align: center; font-size: 0.8em; color: var(--text-color-muted); opacity: 0.5;
    }

    /* Main Editor */
    .studio-main {
        flex: 1; display: flex; flex-direction: column;
        background: var(--primary-bg);
    }
    .empty-state {
        flex: 1; display: flex; flex-direction: column;
        justify-content: center; align-items: center; gap: 20px;
        color: var(--text-color-muted);
        position: relative;
    }
    .empty-actions-right { position: absolute; top: 30px; right: 30px; }
    .primary-btn.big {
        padding: 12px 24px; font-size: 1.1em;
        background: var(--accent-color); color: white;
        border: none; border-radius: 6px; cursor: pointer;
        display: flex; align-items: center; gap: 8px;
    }

    .editor-header {
        padding: 30px 30px 20px 30px; border-bottom: 1px solid var(--border-color);
        display: flex; justify-content: space-between; align-items: flex-start;
    }
    .header-main { display: flex; gap: 20px; align-items: center; flex: 1; }
    
    .avatar-large-wrapper {
        position: relative;
        width: 80px; height: 80px;
        flex-shrink: 0;
    }
    .avatar-large {
        width: 100%; height: 100%; border-radius: 50%;
        background: #555; display: flex; justify-content: center; align-items: center;
        font-size: 2em; font-weight: bold; color: rgba(255,255,255,0.3); overflow: hidden;
        position: relative; /* Contain the transformed image */
    }
    .avatar-controls {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        border-radius: 50%; background: rgba(0,0,0,0.4);
        display: flex; justify-content: center; align-items: center; gap: 2px;
        flex-wrap: wrap;
        opacity: 0; transition: opacity 0.2s; 
        pointer-events: none; /* Allow clicks to pass through to wrapper for drag */
    }
    .avatar-large-wrapper:hover .avatar-controls {
        opacity: 1;
        pointer-events: auto;
    }
    .avatar-control-btn {
        background: rgba(255,255,255,0.2); border: none; padding: 4px; border-radius: 50%;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
        pointer-events: auto;
    }
    .avatar-control-btn:hover { background: rgba(255,255,255,0.4); }
    
    .color-picker-wrapper {
        position: relative;
        overflow: hidden;
    }
    .hidden-color-input {
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        opacity: 0; cursor: pointer;
        padding: 0; margin: 0; border: none;
    }

    .avatar-large img { 
        width: 100%; height: 100%; object-fit: cover; 
        transform-origin: center center;
        /* transition: transform 0.1s linear; Remove transition for smoother dragging */
    }
    
    /* Header Layout Refinement */
    .header-info { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .name-row { display: flex; align-items: center; gap: 10px; }
    
    .fav-btn-header {
        background: none; border: none; padding: 4px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        opacity: 0.5; transition: opacity 0.2s;
    }
    .fav-btn-header:hover, .fav-btn-header.active { opacity: 1; }

    .header-info .name-input {
        font-size: 2.5em; 
        font-weight: 900; 
        letter-spacing: -0.02em;
        background: none; 
        border: none;
        color: var(--text-color); 
        width: 100%; 
        min-width: 150px; 
        padding: 0;
        line-height: 1.2;
        margin-bottom: 2px;
    }
    .header-info .name-input:focus { outline: none; border-bottom: none; background: rgba(0,0,0,0.02); }

    .sub-info-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 0; }
    .divider { color: var(--border-color); font-size: 0.8em; }

    /* Role Select Badge Style */
    .role-select-wrapper {
        display: inline-flex; align-items: center; gap: 6px;
        background: transparent; padding: 2px 0;
        font-size: 0.9em; font-weight: bold;
    }
    .role-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .role-select-wrapper select {
        background: none; border: none; font-size: inherit; font-weight: inherit; cursor: pointer; padding: 0;
        color: var(--text-color); width: auto; margin: 0;
    }
    .role-select-wrapper select:hover { color: var(--accent-color); text-decoration: underline; }
    
    /* Header Tags */
    .header-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .tag-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 600;
        border: 1px solid transparent;
        background: rgba(0,0,0,0.05);
    }
    .tag-chip button {
        background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; padding: 0; font-size: 1.1em; line-height: 1;
    }
    .tag-chip button:hover { opacity: 1; }
    .add-tag-btn {
        background: none; border: 1px dashed var(--border-color); color: var(--text-color-muted);
        padding: 2px 8px; border-radius: 12px; font-size: 0.8em; cursor: pointer;
        display: flex; align-items: center; gap: 4px;
    }
    .add-tag-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
    .tag-input-mini {
        background: var(--secondary-bg); border: none; border-radius: 12px;
        padding: 2px 8px; font-size: 0.85em; color: var(--text-color); width: 100px;
    }

    /* Header Actions */
    .header-actions { display: flex; gap: 8px; align-items: flex-start; }
    .action-icon-btn {
        background: transparent; border: none; color: var(--text-color-muted);
        padding: 8px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 0.2s;
    }
    .action-icon-btn:hover { background: rgba(0,0,0,0.05); color: var(--text-color); }
    .action-icon-btn.danger:hover { background: rgba(var(--danger-color-rgb), 0.1); color: var(--danger-color); }
    
    .close-btn { background: none; border: none; color: var(--text-color-muted); cursor: pointer; }

    .editor-tabs {
        display: flex; padding: 0 30px; border-bottom: 1px solid var(--border-color);
        background: var(--secondary-bg);
    }
    .editor-tabs button {
        background: none; border: none; padding: 15px 20px;
        color: var(--text-color-muted); cursor: pointer;
        font-weight: bold; border-bottom: 2px solid transparent;
        transition: all 0.2s;
    }
    .editor-tabs button:hover { color: var(--text-color); }
    .editor-tabs button.active {
        color: var(--accent-color); border-bottom-color: var(--accent-color);
    }

    .editor-body {
        flex: 1; padding: 30px; overflow-y: auto;
        max-width: 800px; margin: 0 auto; width: 100%;
    }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
    .form-group.full { grid-column: 1 / -1; }
    
    /* Ghost Input Styles */
    label { 
        font-size: 0.8em; 
        font-weight: 700; 
        color: var(--text-color-muted); 
        margin-bottom: 2px;
        display: block;
    }
    input[type="text"], textarea, select {
        padding: 8px 10px; 
        background: transparent; 
        border: 1px solid transparent;
        border-radius: 4px; 
        color: var(--text-color); 
        font-size: 1em;
        transition: all 0.2s ease;
        /* margin-left: -10px; Removed to prevent overlaps in flex containers */
        /* width: calc(100% + 10px); Removed */
        width: 100%; /* Safe default */
        font-family: inherit;
    }

    /* Apply negative margin alignment only within form groups where it is intended */
    .form-group input[type="text"], 
    .form-group textarea, 
    .form-group select {
        margin-left: -10px;
        width: calc(100% + 10px);
    }
    input[type="text"]:hover, textarea:hover, select:hover {
        background: rgba(0, 0, 0, 0.03);
    }
    :global(body.dark-theme) input[type="text"]:hover, 
    :global(body.dark-theme) textarea:hover, 
    :global(body.dark-theme) select:hover {
        background: rgba(255, 255, 255, 0.03);
    }
    input[type="text"]:focus, textarea:focus, select:focus {
        outline: none;
        background: var(--secondary-bg);
        border-color: var(--accent-color);
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .desc-area { 
        min-height: 100px; 
        resize: vertical; 
        line-height: 1.7; 
    }

    .stat-row, .stat-add-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
    .stat-key { width: 150px !important; margin-left: 0 !important; flex-shrink: 0; }
    .stat-value { flex: 1 !important; margin-left: 0 !important; width: auto !important; }
    .icon-btn {
        width: 40px; border: 1px solid var(--border-color); background: var(--secondary-bg);
        border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .icon-btn.primary { background: var(--accent-color); color: white; border-color: var(--accent-color); }
    .icon-btn.danger { color: var(--danger-color); border-color: var(--danger-color); }

    /* Relationship Tab Styles (New List View) */
    .relationships-container { display: flex; flex-direction: column; gap: 20px; }
    .rel-actions-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 15px; }
    .rel-add-row { display: flex; gap: 10px; align-items: center; flex: 1; }
    
    .ghost-select, .ghost-input {
        background: transparent; border: none; color: var(--text-color); padding: 5px; font-size: 0.95em;
    }
    .ghost-select { font-weight: bold; color: var(--accent-color); cursor: pointer; }
    .ghost-input::placeholder { color: var(--text-color-muted); font-style: italic; }
    
    .rel-list { display: flex; flex-direction: column; gap: 0; }
    .rel-item {
        display: flex; align-items: center; gap: 15px;
        padding: 12px 5px; border-bottom: 1px solid var(--border-color);
        transition: background 0.2s;
    }
    .rel-item:hover { background: rgba(0,0,0,0.02); }
    
    .rel-avatar-small {
        width: 36px; height: 36px; border-radius: 50%;
        background: #555; display: flex; justify-content: center; align-items: center;
        font-weight: bold; color: white; font-size: 0.9em; overflow: hidden; flex-shrink: 0;
    }
    .rel-avatar-small img { width: 100%; height: 100%; object-fit: cover; }
    
    .rel-content { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .rel-header-line { display: flex; align-items: center; gap: 8px; }
    .rel-target-name { font-weight: bold; font-size: 0.95em; }
    
    .rel-type-input {
        font-size: 0.85em; color: var(--accent-color); font-weight: bold; width: auto; min-width: 50px; padding: 0; margin: 0;
    }
    .rel-desc-input {
        font-size: 0.9em; color: var(--text-color-muted); padding: 0; margin: 0; width: 100%;
    }
    .rel-desc-input:focus { color: var(--text-color); }
    
    .icon-btn.ghost { background: transparent; border: none; color: var(--text-color-muted); opacity: 0; transition: opacity 0.2s; }
    .rel-item:hover .icon-btn.ghost { opacity: 1; }
    .icon-btn.ghost:hover { color: var(--danger-color); background: rgba(var(--danger-color-rgb), 0.1); opacity: 1; }
    
    .empty-text-centered { text-align: center; padding: 30px; color: var(--text-color-muted); font-style: italic; }
    
    .text-btn { background: none; border: none; color: var(--text-color-muted); cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 0.9em; }
    .text-btn:hover { color: var(--accent-color); }
    .icon-btn.small { width: 28px; height: 28px; }

    /* Full Screen Modal */
    .full-screen-modal { width: 95vw; height: 90vh; background: var(--primary-bg); border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 0 50px rgba(0,0,0,0.8); overflow: hidden; }
    .diagram-header { padding: 15px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--secondary-bg); }
    .diagram-header h3 { margin: 0; }
    .diagram-body { flex: 1; overflow: hidden; background: #222; }

    /* Custom Lists Styles */
    .custom-lists-container { display: flex; flex-direction: column; gap: 20px; }
    .custom-header-actions { 
        display: flex; 
        justify-content: flex-end; 
        padding-bottom: 15px;
        margin-bottom: 10px;
        border-bottom: 1px solid var(--border-color);
    }

    .primary-btn {
        background: var(--accent-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        transition: all 0.2s;
    }
    .primary-btn:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    .custom-list-card {
        background: var(--secondary-bg); border: 1px solid var(--border-color);
        border-radius: 6px; padding: 15px; display: flex; flex-direction: column; gap: 10px;
    }
    .list-header-row { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed var(--border-color); margin-bottom: 5px; }
    .list-title-input { font-weight: bold; color: var(--accent-color); font-size: 1em; padding: 4px; border: 1px solid transparent; width: 100%; }
    .list-title-input:hover { border-color: var(--border-color); }
    .list-title-input:focus { border-color: var(--accent-color); background: var(--primary-bg); }
    
    .list-items { display: flex; flex-direction: column; gap: 6px; }
    .list-item-row { display: flex; align-items: center; gap: 6px; }
    .bullet { color: var(--text-color-muted); }
    .list-item-input { flex: 1; padding: 4px 8px; font-size: 0.9em; background: rgba(0,0,0,0.1); border-radius: 4px; border: none; color: var(--text-color); }
    .list-item-input:focus { background: var(--primary-bg); outline: 1px solid var(--accent-color); }
    
    .add-item-btn {
        margin-top: 5px; background: none; border: 1px dashed var(--border-color);
        color: var(--text-color-muted); padding: 6px; border-radius: 4px;
        cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 0.85em;
        transition: all 0.2s;
    }
    .add-item-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
    
    .icon-btn.tiny { width: 20px; height: 20px; padding: 0; }
    .primary-btn.small { padding: 6px 12px; font-size: 0.9em; }

    /* Traits & Abilities Styles */
    .traits-container { display: flex; flex-direction: column; gap: 25px; }
    .traits-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
    .trait-section h4 { margin: 0 0 10px 0; font-size: 0.95em; color: var(--text-color-muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid var(--border-color); padding-bottom: 5px; }
    .trait-list { display: flex; flex-direction: column; gap: 8px; }
    .trait-item { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.03); padding: 5px 8px; border-radius: 4px; transition: background 0.2s; }
    .trait-item:hover { background: rgba(0,0,0,0.06); }
    .trait-item input { flex: 1; border: none; background: transparent; font-size: 0.95em; color: var(--text-color); padding: 2px; }
    .trait-item input:focus { outline: none; }
    
    .bullet { font-weight: bold; font-size: 1.2em; line-height: 1; width: 15px; text-align: center; }
    .bullet.positive { color: #4caf50; }
    .bullet.negative { color: #f44336; }
    .bullet.star { color: #ff9800; font-size: 1em; }

    .trait-add { display: flex; gap: 8px; align-items: center; margin-top: 5px; padding-left: 5px; }
    .trait-add input { flex: 1; background: transparent; border: none; border-bottom: 1px solid var(--border-color); padding: 5px; font-size: 0.9em; transition: border-color 0.2s; }
    .trait-add input:focus { outline: none; border-bottom-color: var(--accent-color); }
    .trait-section.full-width { grid-column: 1 / -1; }
</style>