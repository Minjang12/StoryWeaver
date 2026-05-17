const COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB',
  '#1E88E5', '#039BE5', '#00ACC1', '#00897B', '#43A047',
  '#7CB342', '#C0CA33', '#FDD835', '#FFB300', '#FB8C00',
  '#F4511E', '#6D4C41', '#757575', '#546E7A'
];

/**
 * Generates a consistent, non-random color from a predefined palette based on a string hash.
 * @param {string} str The input string (e.g., a character's name).
 * @returns {string} A hex color code.
 */
export function getColorFromString(str) {
  if (!str) {
    return COLORS[COLORS.length - 1]; // Return a default color for empty strings
  }

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}

/**
 * Calculates a contrasting text color (black or white) for a given hex background color.
 * @param {string} hexColor The background color in hex format (e.g., #RRGGBB).
 * @returns {string} '#000000' (black) or '#ffffff' (white).
 */
export function getContrastColor(hexColor) {
    if (!hexColor || !hexColor.startsWith('#')) return 'var(--text-color)';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

/**
 * Generates CSS transform style for profile images based on saved transform data.
 * @param {object} transform { scale: number, x: number, y: number } (stored relative to 80px base)
 * @returns {string} CSS transform string
 */
export function getProfileImageStyle(transform) {
    if (!transform) return '';
    // Use percentage-based translation to be responsive to container size
    // Base size in CharacterStudio was 80px.
    // x/80 = ratio. ratio * 100 = percentage.
    const xPct = (transform.x / 80) * 100;
    const yPct = (transform.y / 80) * 100;
    return `transform: translate(${xPct}%, ${yPct}%) scale(${transform.scale});`;
}

export function createUniqueId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Counts the number of words in a given text.
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
}



/**
 * Parses a loosely formatted text string into a StoryWeaver story object using heuristics.
 * @param {string} textContent The raw text content from the file.
 * @returns {object} A StoryWeaver story object.
 */
/**
 * Smart Script Parser
 * Parses text into a StoryWeaver story object.
 * Supports:
 * 1. Standard "Name: Dialogue" format.
 * 2. Scene headers (INT., EXT., 씬, #, etc.).
 * 3. Screenplay format (Name on one line, dialogue on next).
 * 4. Stage directions (Narrative text).
 */
export function parseScriptToStory(textContent) {
    const lines = textContent.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
    
    // Data Structures
    const scenes = {};
    let currentSceneId = 'start';
    let sceneCount = 0;
    
    // Initialize Start Scene
    scenes[currentSceneId] = {
        id: 'start', name: 'START', position: { x: 100, y: 150 },
        content: [], choices: [], color: null, icon: null
    };

    // Helper: Create new scene
    const createScene = (name) => {
        sceneCount++;
        const id = `scene-${Date.now()}-${sceneCount}`;
        const x_spacing = 300;
        const y_spacing = 200;
        const scenes_per_row = 3;
        
        scenes[id] = {
            id: id,
            name: name,
            content: [],
            choices: [],
            position: {
                x: 100 + (sceneCount % scenes_per_row) * x_spacing,
                y: 150 + Math.floor(sceneCount / scenes_per_row) * y_spacing
            },
            color: null, 
            icon: null
        };
        currentSceneId = id;
    };

    // Regex Patterns
    const sceneHeaderRegex = /^(?:INT\.|EXT\.|EST\.|I\/E\.|씬\s|S#|SCENE\s|#\s|\[.*?\]|○|●).*/i;
    const dialogueRegex = /^([^:(\[]+?)\s*:\s*(.*)$/; // Name: Text
    const parentheticalRegex = /^\(.*\)$/; // (Action)

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 1. Scene Detection
        if (sceneHeaderRegex.test(line)) {
            let sceneName = line.replace(/^(?:INT\.|EXT\.|EST\.|I\/E\.|씬\s|S#|SCENE\s|#\s|○|●)\s*/i, '').trim();
            if (line.startsWith('[')) sceneName = line.replace(/[\[\]]/g, ''); // Remove brackets
            createScene(sceneName);
            continue;
        }

        // 2. Explicit Dialogue (Name: Text)
        const colonMatch = line.match(dialogueRegex);
        if (colonMatch) {
            scenes[currentSceneId].content.push({
                id: `dialogue-${Date.now()}-${Math.random()}`,
                type: 'dialogue',
                character: colonMatch[1].trim(),
                text: colonMatch[2].trim()
            });
            continue;
        }

        // 3. Screenplay Style (Name \n Dialogue)
        // Heuristic: Current line is short, UPPERCASE or Title Case, no punctuation at end (except maybe colon), NOT a parenthetical
        // And NEXT line exists and is NOT a scene header.
        const looksLikeName = line.length < 20 && !/[.?!]$/.test(line) && !parentheticalRegex.test(line);
        if (looksLikeName && i + 1 < lines.length) {
            const nextLine = lines[i+1];
            if (!sceneHeaderRegex.test(nextLine)) {
                // It's likely a character name followed by dialogue
                let charName = line.trim();
                let dialogueText = nextLine.trim();
                
                // Check if next line is parenthetical (Character \n (Action) \n Dialogue)
                if (parentheticalRegex.test(dialogueText) && i + 2 < lines.length) {
                    const afterParen = lines[i+2];
                    if (!sceneHeaderRegex.test(afterParen)) {
                         dialogueText = `${dialogueText} ${afterParen}`; // Merge parenthetical
                         i++; // Skip parenthetical line
                    }
                }

                scenes[currentSceneId].content.push({
                    id: `dialogue-${Date.now()}-${Math.random()}`,
                    type: 'dialogue',
                    character: charName,
                    text: dialogueText
                });
                i++; // Skip the dialogue line we just consumed
                continue;
            }
        }

        // 4. Fallback: Action / Narration
        // If it's a parenthetical on its own, or just text description
        scenes[currentSceneId].content.push({
            id: `dialogue-${Date.now()}-${Math.random()}`,
            type: 'dialogue',
            character: '나레이션',
            text: line
        });
    }
    
    // Extract Characters
    const characterNames = Object.values(scenes).flatMap(scene => 
        scene.content
            .filter(item => item.type === 'dialogue' && item.character !== '나레이션')
            .map(item => item.character)
    ).filter((value, index, self) => self.indexOf(value) === index);

    const characters = characterNames.map(name => ({
        id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name,
        color: getColorFromString(name),
        description: '',
        profileImage: ''
    }));
    characters.unshift({ 
        id: `char_narrator`, 
        name: '나레이션', 
        color: '#6c757d',
        description: '서술자',
        profileImage: ''
    });

    return {
        scenes: Object.keys(scenes).length > 0 ? scenes : {
            'start': {
                id: 'start', name: 'START', position: { x: 100, y: 150 },
                content: [{ type: 'dialogue', id: `dialogue-${Date.now()}`, character: '나레이션', text: '대본을 분석했지만 내용을 찾지 못했다냥.' }],
                choices: [], color: null, icon: null
            }
        },
        characters: characters,
        variables: [],
        selectedSceneId: 'start',
        linkingState: { active: false, sourceSceneId: null, sourceChoiceId: null },
        viewTransform: { scale: 1, x: 0, y: 0 },
        storylines: [],
        sequences: {},
        dictionary: [],
        locations: [],
        items: [],
        groups: [],
        history: { eras: [], events: [] },
        characterCategories: ['기본'],
        dictionaryCategories: [],
        locationCategories: [],
        itemCategories: [],
        groupCategories: [],
        loreCategories: []
    };
}

/**
 * Parses a World Bible text format into story data.
 */
export function parseWorldBible(text) {
    const createId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const story = {
        characters: [],
        locations: [],
        groups: [],
        items: [],
        dictionary: [],
        history: { eras: [], events: [] },
        characterCategories: ['기본'],
        dictionaryCategories: [],
        locationCategories: [],
        itemCategories: [],
        groupCategories: [],
        loreCategories: []
    };

    // Helper to extract value from line "Label: Value"
    const extractVal = (line, label) => {
        if (line.includes(label)) return line.split(label)[1].trim();
        return null;
    };

    // Helper to add category if new
    const addCat = (list, cat) => {
        if (cat && !list.includes(cat)) list.push(cat);
    };

    // Regex for sections
    const sectionRegex = /^\[(\d+)\.\s*(.*?)\]/gm;
    let match;
    let lastIndex = 0;
    const sections = [];

    while ((match = sectionRegex.exec(text)) !== null) {
        if (sections.length > 0) {
            sections[sections.length - 1].end = match.index;
            sections[sections.length - 1].content = text.substring(sections[sections.length - 1].start, match.index);
        }
        sections.push({
            type: match[2].toLowerCase(), // e.g., "등장인물 (characters)"
            start: match.index + match[0].length,
            end: text.length // default to end
        });
        lastIndex = match.index;
    }
    if (sections.length > 0) {
        sections[sections.length - 1].content = text.substring(sections[sections.length - 1].start);
    } else {
        // Fallback: No sections detected. Treat entire text as Characters by default (common use case)
        sections.push({
            type: 'characters',
            content: text,
            start: 0,
            end: text.length
        });
    }

    sections.forEach(sec => {
        const content = sec.content;
        const typeStr = sec.type;
        
        // Item Parser
        const parseItems = (targetArray, categoryArray, typePrefix) => {
            let items = [];
            // Check for strict markers first
            if (/^(?:■|###)\s+/m.test(content)) {
                items = content.split(/^(?:■|###)\s+/gm).slice(1);
            } else {
                // Flexible Mode: Split by double newlines
                // Filter out empty blocks
                items = content.split(/\n{2,}/).filter(b => b.trim());
            }

            items.forEach(itemBlock => {
                const lines = itemBlock.trim().split('\n');
                if (lines.length === 0) return;
                
                const nameLine = lines[0].trim();
                // Remove potential markdown bold markers if user pasted formatted text
                const name = nameLine.replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '');
                
                const newItem = {
                    id: createId(typePrefix),
                    name: name,
                    description: '',
                    aliases: [],
                    tags: [],
                    category: null,
                    attributes: {}
                };

                // Add color for characters
                if (typePrefix === 'char') newItem.color = getColorFromString(name);

                let descriptionLines = [];
                
                lines.slice(1).forEach(line => {
                    const l = line.trim();
                    if (l.startsWith('=')) return; // Divider
                    if (l.startsWith('-') && l.length > 5 && /^-+$/.test(l)) return; // Horizontal rule Divider
                    
                    // Flexible attribute parsing (allow spaces around colon)
                    const attrMatch = l.match(/^([^:]+?)\s*:\s*(.*)$/);
                    if (attrMatch) {
                        const key = attrMatch[1].trim();
                        const val = attrMatch[2].trim();
                        
                        if (['별칭', 'alias', 'aliases'].includes(key)) {
                            newItem.aliases = val.split(',').map(s => s.trim());
                        } else if (['태그', 'tag', 'tags'].includes(key)) {
                            newItem.tags = val.split(/#|,/).map(s => s.trim()).filter(Boolean);
                        } else if (['분류', '카테고리', 'category'].includes(key)) {
                            newItem.category = val;
                            addCat(categoryArray, val);
                        } else if (['소속', 'affiliation'].includes(key) && typePrefix === 'char') {
                            newItem.affiliationName = val; 
                        } else if (['정의', 'definition'].includes(key) && typePrefix === 'lore') {
                             newItem.definition = val;
                        } else {
                            // Treat unknown key:value as description line (or attribute if we had support)
                            // For now, add to description to preserve info
                            descriptionLines.push(line);
                        }
                    } else {
                        descriptionLines.push(line);
                    }
                });

                if (typePrefix === 'lore') {
                    if (!newItem.definition) newItem.definition = descriptionLines.join('\n').trim();
                     newItem.term = newItem.name; // Lore uses term
                     delete newItem.name;
                } else {
                    newItem.description = descriptionLines.join('\n').trim();
                }

                targetArray.push(newItem);
            });
        };

        if (typeStr.includes('character') || typeStr.includes('등장인물')) {
            parseItems(story.characters, story.characterCategories, 'char');
        } else if (typeStr.includes('location') || typeStr.includes('장소')) {
            parseItems(story.locations, story.locationCategories, 'loc');
        } else if (typeStr.includes('group') || typeStr.includes('세력')) {
            parseItems(story.groups, story.groupCategories, 'group');
        } else if (typeStr.includes('item') || typeStr.includes('아이템')) {
            parseItems(story.items, story.itemCategories, 'item');
        } else if (typeStr.includes('lore') || typeStr.includes('설정') || typeStr.includes('dictionary')) {
            parseItems(story.dictionary, story.loreCategories, 'lore');
        } else if (typeStr.includes('history') || typeStr.includes('역사')) {
            // History Parsing
            const eras = content.split(/===\s+\[시대\]\s+(.*?)\s+===/g);
            // split results: [pre-text, era1name, era1content, era2name, era2content...]
            let currentEra = null;
            
            for (let i = 1; i < eras.length; i += 2) {
                const eraName = eras[i];
                const eraContent = eras[i+1];
                
                const newEra = {
                    id: createId('era'),
                    name: eraName,
                    color: getColorFromString(eraName),
                    description: ''
                };
                story.history.eras.push(newEra);

                // Parse Events
                const eventRegex = /^\s*•\s+\[(.*?)\]\s+(.*)$/gm; // • [Date] Title
                let evtMatch;
                // We need to loop line by line to capture description
                const lines = eraContent.split('\n');
                let currentEvent = null;

                lines.forEach(line => {
                    const trimmed = line.trim();
                    const evtMatch = /^\s*•\s+\[(.*?)\]\s+(.*)$/.exec(trimmed);
                    if (evtMatch) {
                        currentEvent = {
                            id: createId('evt'),
                            eraId: newEra.id,
                            displayDate: evtMatch[1],
                            title: evtMatch[2],
                            description: ''
                        };
                        story.history.events.push(currentEvent);
                    } else if (currentEvent && trimmed) {
                        currentEvent.description += trimmed + '\n';
                    }
                });
            }
        }
    });
    
    // Default Narration Character if missing
    if (!story.characters.some(c => c.name === '나레이션')) {
        story.characters.unshift({ 
            id: createId('char'), 
            name: '나레이션', 
            color: '#6c757d', 
            description: '스토리의 서술자입니다.' 
        });
    }

    // Initialize basic scene structure
    story.scenes = {
        'start': {
            id: 'start', name: 'START', position: { x: 100, y: 150 },
            content: [{ type: 'dialogue', id: `dialogue-${Date.now()}`, character: '나레이션', text: '설정집을 바탕으로 프로젝트가 생성되었습니다.' }],
            choices: [], color: null, icon: null
        }
    };
    story.selectedSceneId = 'start';
    story.linkingState = { active: false };
    story.viewTransform = { scale: 1, x: 0, y: 0 };
    story.storylines = [];

    return story;
}

/**
 * Smart Parser: Choose between Script or Bible format
 */
export function parseSmartInput(text) {
    if (/^\[\d+\.\s*.*?\]/m.test(text)) {
        return parseWorldBible(text);
    }
    return parseScriptToStory(text);
}


/**
 * Creates a single regex that matches any of the provided wiki items.
 * Items are sorted by length (descending) to ensure "Fire Ball" matches before "Fire".
 * @param {Array} items Array of objects with { id, type, _matchText }
 * @returns {RegExp|null}
 */
export function createWikiLinkRegex(items) {
    if (!items || items.length === 0) return null;

    // Sort by length descending to match longest terms first
    const sorted = [...items].sort((a, b) => b._matchText.length - a._matchText.length);
    
    // Escape regex characters
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create alternation group: (Fire Ball|Fire|Water)
    // Use word boundaries or other checks if needed, but for now simple replacement
    const pattern = `(${sorted.map(i => escapeRegExp(i._matchText)).join('|')})`;
    
    return new RegExp(pattern, 'gi');
}

/**
 * Replaces wiki terms in text with HTML links, preventing nested or partial replacement issues.
 * @param {string} text Raw text
 * @param {Array} items Wiki items list (must have _matchText)
 * @param {string|null} currentId ID of the item currently being viewed (to avoid self-linking)
 * @returns {string} HTML string
 */
export function linkifyText(text, items, currentId = null) {
    if (!text) return '';
    
    // 1. Basic HTML escaping (preserve existing <br> if any, but usually we get raw text)
    // If text already translates \n to <br>, we should be careful. 
    // Assuming input is raw text most of the time.
    let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // 2. Filter items
    const validItems = items.filter(i => i.id !== currentId && i._matchText && i._matchText.length >= 1);
    
    if (validItems.length === 0) return safeText.replace(/\n/g, '<br/>');

    const regex = createWikiLinkRegex(validItems);
    if (!regex) return safeText.replace(/\n/g, '<br/>');

    // 3. Replace
    // We used a capture group in regex, so split works
    const parts = safeText.split(regex);
    
    const result = parts.map(part => {
        if (!part) return '';
        
        // Check if this part matches an item (case-insensitive)
        // Since split divides by the exact match, we just need to find WHICH item it matched.
        // But wait, split with capture group returns the match as well.
        // We need to know if 'part' is a separator (match) or content.
        
        // Optimization: Create a lookup map for case-insensitive matching
        const matchItem = validItems.find(i => i._matchText.toLowerCase() === part.toLowerCase());
        
        if (matchItem) {
             return `<span class="wiki-link" data-id="${matchItem.id}" data-type="${matchItem.type}" style="color: #4da6ff; font-weight: bold; cursor: pointer;">${part}</span>`;
        } else {
            return part;
        }
    }).join('');

    return result.replace(/\n/g, '<br/>');
}

export function analyzeStory(story) {
    const scenes = Object.values(story.scenes);
    const allCharacters = story.characters || [];
    const characterNames = allCharacters.map(c => c.name);
    const sceneCount = scenes.length;
    let totalDialogueCount = 0;
    let totalChoiceCount = 0;
    let totalWordCount = 0;
    let fullStoryText = '';

    const characterColorMap = new Map(allCharacters.map(c => [c.name, c.color]));
    const characterStats = {}; // For dialogue count, word count, and readability
    const sceneCentrality = {};
    const scenePacing = {}; // For scene word count, dialogue/narration ratio
    const characterInteractions = {}; // For heatmap

    // Initialize character stats and interaction matrix
    allCharacters.forEach(char => {
        characterStats[char.name] = {
            name: char.name,
            dialogueCount: 0,
            wordCount: 0,
            totalText: '',
            color: char.color
        };
        // MIMINYAN: Exclude '나레이션' from heatmap initialization
        if (char.name !== '나레이션') {
            characterInteractions[char.name] = {};
            allCharacters.forEach(targetChar => {
                if (targetChar.name !== '나레이션') {
                    characterInteractions[char.name][targetChar.name] = 0;
                }
            });
        }
    });

    let previousCharacterInDialogue = null;

    scenes.forEach(scene => {
        sceneCentrality[scene.id] = { name: scene.name, centrality: 0 };
        scenePacing[scene.id] = {
            name: scene.name,
            wordCount: 0,
            dialogueWordCount: 0,
            narrationWordCount: 0,
            dialogueRatio: 0,
            content: [] // Store content for pacing analysis
        };

        let sceneText = '';
        let sceneDialogueText = '';
        let sceneNarrationText = '';
        let currentSceneWordCount = 0;

        scene.content.forEach(item => {
            if (item.type === 'dialogue') {
                totalDialogueCount++;
                const text = item.text || '';
                const wordsInItem = countWords(text);
                totalWordCount += wordsInItem;
                currentSceneWordCount += wordsInItem;
                fullStoryText += text + ' ';

                const charName = item.character || '나레이션';
                
                // MIMINYAN: Always count dialogue for stats, including narration, for the pie chart toggle.
                if (!characterStats[charName]) {
                    const color = characterColorMap.get(charName) || getColorFromString(charName);
                    characterStats[charName] = { name: charName, dialogueCount: 0, wordCount: 0, totalText: '', color: color };
                }
                characterStats[charName].dialogueCount++;
                characterStats[charName].wordCount += wordsInItem;
                characterStats[charName].totalText += text + ' ';
                sceneText += text + ' ';

                // MIMINYAN: Correctly separate narration from dialogue for ratio and heatmap analysis.
                if (charName === '나레이션') {
                    sceneNarrationText += text + ' ';
                    scenePacing[scene.id].content.push({ type: 'narration', text: text, wordCount: wordsInItem });
                    previousCharacterInDialogue = null; // Narration breaks the interaction chain.
                } else {
                    sceneDialogueText += text + ' ';
                    scenePacing[scene.id].content.push({ type: 'dialogue', character: charName, text: text, wordCount: wordsInItem });

                    // Character Interaction
                    // MIMINYAN: Exclude '나레이션' from interaction tracking
                    if (previousCharacterInDialogue && previousCharacterInDialogue !== charName && charName !== '나레이션') {
                        // Ensure both characters exist in the interaction map before accessing
                        if (characterInteractions[previousCharacterInDialogue] && characterInteractions[previousCharacterInDialogue][charName] !== undefined) {
                            characterInteractions[previousCharacterInDialogue][charName]++;
                        }
                    }
                    previousCharacterInDialogue = charName;
                }
            } else { // Assume narration or other non-dialogue content
                const text = item.text || ''; // Assuming other content types also have a 'text' field
                const wordsInItem = countWords(text);
                totalWordCount += wordsInItem;
                currentSceneWordCount += wordsInItem;
                fullStoryText += text + ' ';
                sceneText += text + ' ';
                sceneNarrationText += text + ' ';
                scenePacing[scene.id].content.push({ type: 'narration', text: text, wordCount: wordsInItem });
                previousCharacterInDialogue = null; // Reset for narration
            }
        });

        scenePacing[scene.id].wordCount = currentSceneWordCount;
        scenePacing[scene.id].dialogueWordCount = countWords(sceneDialogueText);
        scenePacing[scene.id].narrationWordCount = countWords(sceneNarrationText);
        scenePacing[scene.id].dialogueRatio = currentSceneWordCount > 0 ? (scenePacing[scene.id].dialogueWordCount / currentSceneWordCount) * 100 : 0;

        totalChoiceCount += scene.choices.length;
        scene.choices.forEach(choice => {
            if (choice.targetSceneId && sceneCentrality[choice.targetSceneId]) {
                sceneCentrality[choice.targetSceneId].centrality++;
            }
        });
    });

    // Calculate character-specific stats (sorted by dialogue count)
    const charactersWithReadability = Object.values(characterStats).sort((a, b) => b.dialogueCount - a.dialogueCount);

    const sceneDetails = scenes.map(scene => {
        let actionCount = 0;
        scene.content.forEach(item => {
            if (item.actions) actionCount += item.actions.length;
        });
        scene.choices.forEach(choice => {
            if (choice.actions) actionCount += choice.actions.length;
        });

        return {
            id: scene.id,
            name: scene.name,
            branchFactor: scene.choices.length,
            centrality: sceneCentrality[scene.id]?.centrality || 0,
            wordCount: scenePacing[scene.id]?.wordCount || 0,
            dialogueRatio: parseFloat(scenePacing[scene.id]?.dialogueRatio.toFixed(2)) || 0,
            actionCount: actionCount
        };
    }).sort((a, b) => b.centrality - a.centrality);

    // --- Story Structure Analysis ---
    const allSceneIds = new Set(scenes.map(s => s.id));
    const connectedSceneIds = new Set();
    const deadEndScenes = [];
    const isolatedScenes = [];

    scenes.forEach(scene => {
        let hasOutgoingConnection = false;
        if (scene.autoTransitionTarget) {
            connectedSceneIds.add(scene.autoTransitionTarget);
            hasOutgoingConnection = true;
        }
        scene.choices.forEach(choice => {
            if (choice.targetSceneId) {
                connectedSceneIds.add(choice.targetSceneId);
                hasOutgoingConnection = true;
            }
        });

        // Check for dead-end scenes (excluding 'start' and scenes with outgoing connections)
        if (!hasOutgoingConnection && scene.id !== 'start') {
            // Only consider it a dead-end if it's not an explicit ending scene (e.g., named 'END' or similar)
            if (!scene.name.toLowerCase().includes('end') && !scene.name.toLowerCase().includes('ending')) {
                deadEndScenes.push({ id: scene.id, name: scene.name });
            }
        }
    });

    // Find isolated scenes (not connected from anywhere, and not 'start')
    scenes.forEach(scene => {
        if (scene.id !== 'start' && !connectedSceneIds.has(scene.id) && !scenes.some(s => s.autoTransitionTarget === scene.id || s.choices.some(c => c.targetSceneId === scene.id))) {
            isolatedScenes.push({ id: scene.id, name: scene.name });
        }
    });

    return {
        general: {
            sceneCount,
            dialogueCount: totalDialogueCount,
            choiceCount: totalChoiceCount,
            wordCount: totalWordCount
        },
        characters: charactersWithReadability,
        scenes: sceneDetails,
        pacing: Object.values(scenePacing),
        characterInteractions: characterInteractions,
        structure: {
            isolatedScenes,
            deadEndScenes,
            // Placeholder for choice balance analysis (more complex, requires path traversal)
            choiceBalance: [] 
        }
    };
}

export function analyzeVariableUsage(story) {
    if (!story || !story.scenes || !story.variables) {
        return {};
    }

    const usage = story.variables.reduce((acc, v) => {
        acc[v.name] = { modifiedIn: [], readIn: [] };
        return acc;
    }, {});

    for (const scene of Object.values(story.scenes)) {
        // Check actions in dialogue
        scene.content.forEach(item => {
            if (item.type === 'dialogue' && item.actions) {
                item.actions.forEach(action => {
                    if (action.type === 'variable' && usage[action.variable]) {
                        usage[action.variable].modifiedIn.push({
                            sceneId: scene.id,
                            sceneName: scene.name,
                            context: `씬 "${scene.name}"의 대화`,
                            details: `${action.operator} ${action.value}`
                        });
                    }
                });
            }
        });

        // Check conditions and actions in choices
        scene.choices.forEach(choice => {
            if (choice.conditions) {
                choice.conditions.forEach(cond => {
                    if (cond.type === 'variable' && usage[cond.variable]) {
                        usage[cond.variable].readIn.push({
                            sceneId: scene.id,
                            sceneName: scene.name,
                            choiceId: choice.id,
                            context: `선택지 "${choice.text}"`,
                            details: `${cond.operator} ${cond.value}`
                        });
                    }
                });
            }
            if (choice.actions) {
                choice.actions.forEach(action => {
                    if (action.type === 'variable' && usage[action.variable]) {
                        usage[action.variable].modifiedIn.push({
                            sceneId: scene.id,
                            sceneName: scene.name,
                            choiceId: choice.id,
                            context: `선택지 "${choice.text}"`,
                            details: `${action.operator} ${action.value}`
                        });
                    }
                });
            }
        });
    }

    return usage;
}

export function analyzeVariableRanges(story) {
    if (!story || !story.scenes || !story.variables) {
        return {};
    }

    const { scenes, variables } = story;
    const numericVariables = variables.filter(v => v.type === 'Number').map(v => v.name);

    if (numericVariables.length === 0) {
        return {};
    }

    const ranges = Object.keys(scenes).reduce((acc, sceneId) => {
        acc[sceneId] = {};
        numericVariables.forEach(varName => {
            acc[sceneId][varName] = { min: Infinity, max: -Infinity };
        });
        return acc;
    }, {});

    const initialVarRanges = {};
    variables.forEach(v => {
        if (v.type === 'Number') {
            const val = Number(v.value);
            initialVarRanges[v.name] = { min: val, max: val };
        }
    });

    const visitedStates = new Set();
    const MAX_DEPTH = 50;

    function traverse(sceneId, currentVarRanges, depth = 0) {
        if (depth > MAX_DEPTH) return;

        const scene = scenes[sceneId];
        if (!scene) return;

        const stateKey = `${sceneId}|${JSON.stringify(currentVarRanges)}`;
        if (visitedStates.has(stateKey)) {
            return;
        }
        visitedStates.add(stateKey);

        // Update global ranges for the current scene
        numericVariables.forEach(varName => {
            const currentRange = currentVarRanges[varName];
            const globalRange = ranges[sceneId][varName];
            if (currentRange) {
                globalRange.min = Math.min(globalRange.min, currentRange.min);
                globalRange.max = Math.max(globalRange.max, currentRange.max);
            }
        });

        const rangesAfterContent = applyActions(currentVarRanges, scene.content.flatMap(item => item.actions || []));

        const outgoingPaths = scene.choices.map(choice => ({
            target: choice.targetSceneId,
            actions: choice.actions || []
        }));
        if (scene.autoTransitionTarget) {
            outgoingPaths.push({ target: scene.autoTransitionTarget, actions: [] });
        }

        outgoingPaths.forEach(({ target, actions }) => {
            if (target) {
                const newRanges = applyActions(rangesAfterContent, actions);
                traverse(target, newRanges, depth + 1);
            }
        });
    }

    function applyActions(currentRanges, actions) {
        const newRanges = JSON.parse(JSON.stringify(currentRanges));
        actions.forEach(action => {
            if (!action) return; // MIMINYAN: Add guard clause to prevent crash on invalid actions
            const varName = action.variable;
            if (!varName || newRanges[varName] === undefined) return;

            const type = action.type || 'variable';

            switch (type) {
                case 'variable':
                    const val = Number(action.value);
                    if (!isNaN(val)) {
                        if (action.operator === '=') newRanges[varName] = { min: val, max: val };
                        else if (action.operator === '+=') {
                            newRanges[varName].min += val;
                            newRanges[varName].max += val;
                        } else if (action.operator === '-=') {
                            newRanges[varName].min -= val;
                            newRanges[varName].max -= val;
                        }
                    }
                    break;
                case 'variableRandom':
                    const min = Number(action.min);
                    const max = Number(action.max);
                    if (!isNaN(min) && !isNaN(max)) {
                        newRanges[varName] = { min, max };
                    }
                    break;
                case 'variableDice':
                    const count = Number(action.diceCount);
                    const sides = Number(action.diceSides);
                    if (!isNaN(count) && !isNaN(sides) && count > 0 && sides > 0) {
                        newRanges[varName] = { min: count, max: count * sides };
                    }
                    break;
            }
        });
        return newRanges;
    }

    traverse('start', initialVarRanges);

    for (const sceneId in ranges) {
        for (const varName in ranges[sceneId]) {
            if (ranges[sceneId][varName].min === Infinity) {
                ranges[sceneId][varName] = { min: null, max: null };
            }
        }
    }

    return ranges;
}

export function trackVariableOverStoryline(story, storylineId, variableToTrack) {
    const storyline = story.storylines.find(sl => sl.id === storylineId);
    if (!storyline || !variableToTrack) {
        return [];
    }

    // Helper to apply actions
    function applyActions(currentVars, actions) {
        const newVars = { ...currentVars };
        actions.forEach(action => {
            if (action.type === 'variable' && newVars.variables[action.variable] !== undefined) {
                const currentValue = newVars.variables[action.variable];
                const actionValue = (typeof currentValue === 'number') ? Number(action.value) : action.value;
                newVars.variables[action.variable] = calculate(currentValue, action.operator, actionValue);
            } else if (action.type === 'characterAttribute' && newVars.characters[action.characterId]) {
                 const char = newVars.characters[action.characterId];
                 const attrName = action.attribute;
                 const currentValue = char.attributes[attrName] || 0;
                 const actionValue = Number(action.value);
                 char.attributes[attrName] = calculate(currentValue, action.operator, actionValue);
            }
        });
        return newVars;
    }

    // Helper to calculate new value
    function calculate(val1, op, val2) {
        switch (op) {
            case '=': return val2;
            case '+=': return val1 + val2;
            case '-=': return val1 - val2;
            default: return val1;
        }
    }

    // 1. Set up initial state
    let simState = {
        variables: story.variables.reduce((acc, v) => {
            acc[v.name] = v.type === 'Number' ? Number(v.value) : v.value;
            return acc;
        }, {}),
        characters: story.characters.reduce((acc, c) => {
            acc[c.id] = JSON.parse(JSON.stringify(c)); // Deep copy to avoid mutation
            return acc;
        }, {})
    };

    const trackingData = [];
    const storylineScenes = storyline.nodes.map(id => story.scenes[id]).filter(Boolean);

    // Function to get the current value of the tracked item
    const getCurrentValue = () => {
        if (variableToTrack.type === 'variable') {
            return simState.variables[variableToTrack.name];
        } else if (variableToTrack.type === 'characterAttribute') {
            const char = simState.characters[variableToTrack.characterId];
            return char ? (char.attributes[variableToTrack.attributeName] || 0) : 'N/A';
        }
        return 'N/A';
    };

    // 2. Iterate through the storyline scenes
    for (let i = 0; i < storylineScenes.length; i++) {
        const currentScene = storylineScenes[i];
        if (!currentScene) continue;

        // 3. Record value at the start of the scene
        trackingData.push({
            sceneId: currentScene.id,
            sceneName: currentScene.name,
            value: getCurrentValue()
        });

        // 4. Apply actions within the scene's content
        currentScene.content.forEach(item => {
            if (item.type === 'dialogue' && item.actions) {
                simState = applyActions(simState, item.actions);
            }
        });

        // 5. Find the choice/transition that leads to the next scene in the storyline and apply its actions
        const nextScene = storylineScenes[i + 1];
        if (nextScene) {
            const connectingChoice = currentScene.choices.find(c => c.targetSceneId === nextScene.id);
            if (connectingChoice && connectingChoice.actions) {
                simState = applyActions(simState, connectingChoice.actions);
            }
            // Also check auto-transition (no actions on auto-transition)
        }
    }

    return trackingData;
}


    
    export function calculateTimelineLayout(scenes, connections, sequences) {
        if (!scenes || Object.keys(scenes).length === 0) {
            return { scenes: [], connections: [], sequences: [], width: 2000, height: 2000 };
        }
    
        const sceneData = {};
        const sceneList = Object.values(scenes);
    
        // 1. Initialize scene data
        sceneList.forEach(scene => {
            sceneData[scene.id] = {
                ...scene,
                depth: -1,
                y_order: 0,
                children: [],
                parents: []
            };
        });
    
        // 2. Build dependency graph (children and parents)
        sceneList.forEach(scene => {
            const choices = scene.choices || [];
            const outgoingConnections = choices.map(c => c.targetSceneId);
            if (scene.autoTransitionTarget) {
                outgoingConnections.push(scene.autoTransitionTarget);
            }

            outgoingConnections.forEach(targetId => {
                if (targetId && sceneData[targetId]) {
                    sceneData[scene.id].children.push(targetId);
                    sceneData[targetId].parents.push(scene.id);
                }
            });
        });
    
        // 3. Assign depth using DFS, handling cycles
        const visitedDepths = {}; // Caches the max depth calculated for a node to avoid redundant work

        function assignDepth(sceneId, currentDepth, path) {
            if (path.has(sceneId)) {
                // Cycle detected, abort this path
                return;
            }

            // If we've already calculated a depth for this node that's greater or equal, no need to proceed
            if (visitedDepths[sceneId] !== undefined && visitedDepths[sceneId] >= currentDepth) {
                return;
            }
            visitedDepths[sceneId] = currentDepth;

            sceneData[sceneId].depth = Math.max(sceneData[sceneId].depth, currentDepth);
            
            path.add(sceneId); // Add current scene to the path

            sceneData[sceneId].children.forEach(childId => {
                assignDepth(childId, sceneData[sceneId].depth + 1, path);
            });

            path.delete(sceneId); // Backtrack: remove current scene from the path
        }

        assignDepth('start', 0, new Set());
        
        // Assign depth to isolated nodes that weren't reached from 'start'
        sceneList.forEach(scene => {
            if (sceneData[scene.id].depth === -1) {
                assignDepth(scene.id, 0, new Set());
            }
        });
    
    
        // 4. Group scenes by depth and assign y-order
        // Helper: Map scene to sequence ID for grouping to prevent visual interleaving
        const sceneToSequenceId = {};
        Object.values(sequences).forEach(seq => {
            seq.scenes.forEach(sId => {
                sceneToSequenceId[sId] = seq.id;
            });
        });

        const scenesByDepth = {};
        let maxDepth = 0;
        sceneList.forEach(scene => {
            const depth = sceneData[scene.id].depth;
            if (depth === -1) return; // Skip unreached nodes
            if (!scenesByDepth[depth]) {
                scenesByDepth[depth] = [];
            }
            scenesByDepth[depth].push(scene.id);
            if (depth > maxDepth) maxDepth = depth;
        });
    
        Object.values(scenesByDepth).forEach(depthGroup => {
            // Sort scenes in this column so that those in the same sequence are adjacent
            depthGroup.sort((a, b) => {
                const seqA = sceneToSequenceId[a];
                const seqB = sceneToSequenceId[b];
                
                // Group by Sequence ID
                if (seqA !== seqB) {
                    if (!seqA) return 1; // Put non-sequenced items at the bottom
                    if (!seqB) return -1;
                    return seqA.localeCompare(seqB);
                }
                return 0;
            });

            depthGroup.forEach((sceneId, index) => {
                sceneData[sceneId].y_order = index;
            });
        });
    
            // 5. Calculate positions
            const NODE_WIDTH = 180;
            const NODE_HEIGHT = 80;
            const H_SPACING = 100;
            const V_SPACING = 100; // Increased from 40 to 100 to prevent sequence box overlap
            const PADDING = 50;    
        const layoutScenes = Object.values(sceneData).map(data => {
            if (data.depth === -1) return null; // Don't render unreached nodes
            return {
                ...data,
                x: data.depth * (NODE_WIDTH + H_SPACING) + PADDING,
                y: data.y_order * (NODE_HEIGHT + V_SPACING) + PADDING
            };
        }).filter(Boolean);
    
        // 6. Calculate total dimensions
        let maxWidth = 0;
        let maxHeight = 0;
        layoutScenes.forEach(scene => {
            if (scene.x + NODE_WIDTH > maxWidth) maxWidth = scene.x + NODE_WIDTH;
            if (scene.y + NODE_HEIGHT > maxHeight) maxHeight = scene.y + NODE_HEIGHT;
        });
    
                // 7. Calculate sequence boundaries
                const layoutSequences = Object.values(sequences).map(seq => {
                    const seqScenes = seq.scenes.map(id => sceneData[id]).filter(Boolean);
                    if (seqScenes.length === 0) return null;
            
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    seqScenes.forEach(s => {
                        const sceneLayout = layoutScenes.find(ls => ls.id === s.id);
                        if (sceneLayout) {
                            minX = Math.min(minX, sceneLayout.x);
                            minY = Math.min(minY, sceneLayout.y);
                            maxX = Math.max(maxX, sceneLayout.x + NODE_WIDTH);
                            maxY = Math.max(maxY, sceneLayout.y + NODE_HEIGHT);
                        }
                    });
                    
                    if (minX === Infinity) return null;
            
                    return {
                        ...seq,
                        x: minX - PADDING / 2,
                        y: minY - PADDING / 2,
                        width: maxX - minX + PADDING,
                        height: maxY - minY + PADDING
                    };
                }).filter(Boolean);
        
                // Filter out duplicate or contained sequences with the same name (handling legacy data issues)
                const uniqueSequences = layoutSequences.filter((seq, index, self) => {
                    return !self.some((other, otherIndex) => {
                        if (index === otherIndex) return false;
                        if (seq.name !== other.name) return false;
        
                        // Check if 'seq' is contained within 'other'
                        const isContained = 
                            seq.x >= other.x &&
                            seq.y >= other.y &&
                            (seq.x + seq.width) <= (other.x + other.width) &&
                            (seq.y + seq.height) <= (other.y + other.height);
        
                        if (isContained) {
                            // If identical, keep the first one found (remove if current index > found index)
                            const isIdentical = 
                                seq.x === other.x && 
                                seq.y === other.y && 
                                seq.width === other.width && 
                                seq.height === other.height;
                            
                            if (isIdentical) {
                                return index > otherIndex;
                            }
                            // If strictly contained (smaller), remove it
                            return true;
                        }
                        return false;
                    });
                });
            
                return {
                    scenes: layoutScenes,
                    connections: [], // Connection rendering will be handled in the component
                    sequences: uniqueSequences,
                    width: maxWidth + PADDING * 2,
                    height: maxHeight + PADDING * 2
                };            }
            
            export function checkStoryConsistency(story) {
    if (!story || !story.scenes || !story.variables || !story.characters) {
        return [];
    }
    const { scenes, variables, characters } = story;
    const issues = [];
    
    const defaultSettings = {
        unreachableConditions: true,
        logicalContradictions: true,
        incapacitatedDialogue: true,
        unresolvedStates: true,
        meaninglessChoices: true,
    };
    const settings = { ...defaultSettings, ...(story.consistencyCheckSettings || {}) };

    // --- Helper Functions ---
    function generateVariableHistory(variableName, initialValue, actionsLog) {
        const history = [{ sceneId: 'start', reason: '초기값', value: initialValue }];
        let currentValue = initialValue;

        actionsLog.forEach(log => {
            const { sceneId, sceneName, action } = log;
            if (action.variable !== variableName) return;

            let reason = '';
            let newValue = currentValue;

            switch (action.type) {
                case 'variable':
                    const val = Number(action.value);
                    if (isNaN(val)) return;
                    reason = `액션: ${action.operator} ${val}`;
                    if (action.operator === '=') newValue = val;
                    else if (action.operator === '+=') newValue += val;
                    else if (action.operator === '-=') newValue -= val;
                    break;
                case 'variableRandom':
                    const min = Number(action.min);
                    const max = Number(action.max);
                    if (isNaN(min) || isNaN(max)) return;
                    reason = `랜덤 액션: ${min}~${max}`;
                    newValue = `[${min}~${max}]`; 
                    break;
                case 'variableDice':
                     const count = Number(action.diceCount);
                    const sides = Number(action.diceSides);
                    if (isNaN(count) || isNaN(sides)) return;
                    reason = `주사위 액션: ${count}d${sides}`;
                    newValue = `[${count}~${count*sides}]`;
                    break;
            }
            
            if (newValue !== currentValue) {
                history.push({ sceneId, sceneName, reason, value: newValue });
                currentValue = (typeof newValue === 'number') ? currentValue : currentValue;
            }
        });

        return history;
    }

    function applyConditionToRanges(currentRanges, cond) {
        const newRanges = JSON.parse(JSON.stringify(currentRanges));
        if (!cond || cond.type !== 'variable') return { newRanges, contradiction: null };

        const varName = cond.variable;
        const range = newRanges[varName];
        if (!range) return { newRanges, contradiction: null };

        const condValue = Number(cond.value);
        if (isNaN(condValue)) return { newRanges, contradiction: null };

        const originalMin = range.min;
        const originalMax = range.max;

        switch (cond.operator) {
            case '>':  range.min = Math.max(range.min, condValue + 1e-9); break;
            case '>=': range.min = Math.max(range.min, condValue); break;
            case '<':  range.max = Math.min(range.max, condValue - 1e-9); break;
            case '<=': range.max = Math.min(range.max, condValue); break;
            case '==':
                range.min = Math.max(range.min, condValue);
                range.max = Math.min(range.max, condValue);
                break;
            case '!=':
                if (range.min === condValue && range.max === condValue) range.min = Infinity;
                break;
        }

        if (range.min > range.max) {
            const contradictionMsg = `조건(${varName} ${cond.operator} ${condValue})이 이전 경로의 범위(${originalMin.toFixed(1)}~${originalMax.toFixed(1)})와 충돌합니다.`;
            return { newRanges, contradiction: contradictionMsg, variable: varName };
        }
        return { newRanges, contradiction: null };
    }

    function applyActionsToRanges(currentRanges, actions) {
        const newRanges = JSON.parse(JSON.stringify(currentRanges));
        (actions || []).forEach(action => {
            if (!action) return;
            const varName = action.variable;
            if (!varName || !newRanges[varName]) return;

            switch (action.type) {
                case 'variable': {
                    const val = Number(action.value);
                    if (isNaN(val)) return;
                    if (action.operator === '=') newRanges[varName] = { min: val, max: val };
                    else if (action.operator === '+=') { newRanges[varName].min += val; newRanges[varName].max += val; }
                    else if (action.operator === '-=') { newRanges[varName].min -= val; newRanges[varName].max -= val; }
                    break;
                }
                case 'variableRandom': {
                    const min = Number(action.min);
                    const max = Number(action.max);
                    if (isNaN(min) || isNaN(max)) return;
                    newRanges[varName] = { min: min, max: max };
                    break;
                }
                case 'variableDice': {
                    const count = Number(action.diceCount);
                    const sides = Number(action.diceSides);
                    if (isNaN(count) || isNaN(sides) || count <= 0 || sides <= 0) return;
                    newRanges[varName] = { min: count, max: count * sides };
                    break;
                }
            }
        });
        return newRanges;
    }

    function applyStateActions(currentStates, actions) {
        const newStates = JSON.parse(JSON.stringify(currentStates));
        (actions || []).forEach(action => {
            if (!action || action.type !== 'characterState') return;
            const states = newStates[action.characterId] || [];
            const stateExists = states.includes(action.state);
            if (action.operator === '+=' && !stateExists) states.push(action.state);
            else if (action.operator === '-=' && stateExists) newStates[action.characterId] = states.filter(s => s !== action.state);
        });
        return newStates;
    }

    function compare(val1, op, val2) {
        const numVal1 = Number(val1);
        const numVal2 = Number(val2);
        if (!isNaN(numVal1) && !isNaN(numVal2)) { val1 = numVal1; val2 = numVal2; }
        else if (typeof val1 === 'boolean') { val2 = val2 === 'true' || val2 === true; }
        switch (op) {
            case '==': return val1 == val2;
            case '!=': return val1 != val2;
            case '>': return val1 > val2;
            case '<': return val1 < val2;
            case '>=': return val1 >= val2;
            case '<=': return val1 <= val2;
            default: return false;
        }
    }

    // --- 1. Static Analysis ---
    if (settings.unreachableConditions) {
        const staticVariableRanges = analyzeVariableRanges(story);
        for (const scene of Object.values(scenes)) {
            if (!scene || !scene.choices) continue;
            for (const choice of scene.choices) {
                if (!choice || !choice.conditions) continue;
                for (const cond of choice.conditions) {
                    if (!cond || cond.type !== 'variable') continue;
                    const range = staticVariableRanges[scene.id]?.[cond.variable];
                    if (!range || range.min === null) continue;
                    const condValue = Number(cond.value);
                    if (isNaN(condValue)) continue;
                    let isUnreachable = false;
                    if (cond.operator === '>' && range.max <= condValue) isUnreachable = true;
                    else if (cond.operator === '>=' && range.max < condValue) isUnreachable = true;
                    else if (cond.operator === '<' && range.min >= condValue) isUnreachable = true;
                    else if (cond.operator === '<=' && range.min > condValue) isUnreachable = true;
                    else if (cond.operator === '==' && (range.min > condValue || range.max < condValue)) isUnreachable = true;
                    else if (cond.operator === '!=' && range.min === condValue && range.max === condValue) isUnreachable = true;
                    if (isUnreachable) {
                        issues.push({
                            type: '도달 불가능한 조건',
                            sceneId: scene.id,
                            sceneName: scene.name,
                            message: `선택지 "${choice.text || ''}"의 조건(${cond.variable} ${cond.operator} ${cond.value})은 절대 만족될 수 없습니다. (가능 범위: ${range.min}~${range.max})`,
                            path: [scene.id]
                        });
                    }
                }
            }
        }
    }

    // --- 2. Dynamic Analysis ---
    const initialVarRanges = {};
    const initialVarValues = {};
     variables.forEach(v => {
        if (v && v.type === 'Number') {
            const val = Number(v.value);
            initialVarRanges[v.name] = { min: val, max: val };
            initialVarValues[v.name] = val;
        }
    });
    const initialCharacterStates = characters.reduce((acc, c) => { if(c) acc[c.id] = []; return acc; }, {});
    const visitedStates = new Set();
    const MAX_DEPTH = 50;
    const MAX_ISSUES = 100; // Limit total issues to prevent UI lag

    function findEffectiveOutcome(startSceneId, initialRanges, initialStates, visitedPath) {
        let currentSceneId = startSceneId;
        let currentRanges = JSON.parse(JSON.stringify(initialRanges));
        let currentStates = JSON.parse(JSON.stringify(initialStates));
        const path = [...visitedPath];

        // Limit search depth to prevent infinite loops
        for (let i = 0; i < MAX_DEPTH; i++) { 
            if (!currentSceneId || path.includes(currentSceneId)) {
                return {
                    endSceneId: path[path.length - 1],
                    finalRanges: currentRanges,
                    finalStates: currentStates,
                };
            }

            const scene = scenes[currentSceneId];
            if (!scene) {
                 return {
                    endSceneId: path[path.length - 1],
                    finalRanges: currentRanges,
                    finalStates: currentStates,
                };
            }
            
            path.push(currentSceneId);

            const contentActions = (scene.content || []).flatMap(item => item?.actions || []);
            currentRanges = applyActionsToRanges(currentRanges, contentActions);
            currentStates = applyStateActions(currentStates, contentActions);

            const availableChoices = (scene.choices || []).filter(choice => {
                return (choice.conditions || []).every(cond => {
                    if (!cond || cond.type !== 'characterState') return true;
                    const hasState = currentStates[cond.characterId]?.includes(cond.state);
                    return compare(hasState, cond.operator, true);
                });
            });

            if (availableChoices.length > 1) {
                return { endSceneId: currentSceneId, finalRanges: currentRanges, finalStates: currentStates };
            }

            let nextSceneId = null;
            if (availableChoices.length === 1) {
                const choice = availableChoices[0];
                currentRanges = applyActionsToRanges(currentRanges, choice.actions);
                currentStates = applyStateActions(currentStates, choice.actions);
                nextSceneId = choice.targetSceneId;
            } else if (scene.autoTransitionTarget) {
                nextSceneId = scene.autoTransitionTarget;
            }

            if (nextSceneId) {
                currentSceneId = nextSceneId;
            } else {
                return { endSceneId: currentSceneId, finalRanges: currentRanges, finalStates: currentStates };
            }
        }
        return { endSceneId: currentSceneId, finalRanges: currentRanges, finalStates: currentStates };
    }

    function traverse(sceneId, path, currentVarRanges, currentStates, actionsLog, depth = 0) {
        if (depth > MAX_DEPTH) return;
        if (issues.length >= MAX_ISSUES) return; // Stop if too many issues found

        const stateKey = `${sceneId}|${JSON.stringify(currentVarRanges)}|${JSON.stringify(currentStates)}`;
        if (visitedStates.has(stateKey) || path.includes(sceneId)) return;
        visitedStates.add(stateKey);

        const scene = scenes[sceneId];
        if (!scene) return;
        
        const currentPath = [...path, sceneId];

        if (settings.incapacitatedDialogue) {
            (scene.content || []).forEach(item => {
                if (!item) return;
                if (item.type === 'dialogue') {
                    const character = characters.find(c => c && c.name === item.character);
                    if (character && (story.incapacitatedStates || []).some(state => currentStates[character.id]?.includes(state))) {
                        const problematicState = (story.incapacitatedStates || []).find(state => currentStates[character.id]?.includes(state));
                        issues.push({ type: '오류', sceneId: scene.id, sceneName: scene.name, message: `'${scene.name}' 씬에서 행동 불능 상태('${problematicState}')인 '${character.name}'이(가) 대사를 합니다.`, path: currentPath });
                    }
                }
            });
        }

        const contentActions = (scene.content || []).flatMap(item => item?.actions?.map(a => ({ ...a, sceneId, sceneName: scene.name })) || []);
        const newActionsLog = [...actionsLog, ...contentActions];
        const statesAfterContent = applyStateActions(currentStates, contentActions);
        const rangesAfterContent = applyActionsToRanges(currentVarRanges, contentActions);

        let hasOutgoingPath = false;
        const choiceOutcomes = [];

        (scene.choices || []).forEach(choice => {
            if (!choice) return;
            hasOutgoingPath = true;
            let rangesForChoice = JSON.parse(JSON.stringify(rangesAfterContent));
            let contradictionFound = false;

            const choiceActionsLog = [...newActionsLog, ...(choice.actions || []).map(a => ({ ...a, sceneId, sceneName: scene.name }))];

            if (settings.logicalContradictions) {
                for (const cond of (choice.conditions || [])) {
                    if (!cond) continue;
                    const result = applyConditionToRanges(rangesForChoice, cond);
                    rangesForChoice = result.newRanges;
                    if (result.contradiction) {
                        contradictionFound = true;
                        const debugInfo = {
                            variable: result.variable,
                            history: generateVariableHistory(result.variable, initialVarValues[result.variable], choiceActionsLog)
                        };
                        issues.push({ type: '논리 오류', sceneId: scene.id, sceneName: scene.name, message: result.contradiction, path: currentPath, debugInfo });
                        break;
                    }
                }
            }
            if (contradictionFound) return;

            const isReachableByState = (choice.conditions || []).every(cond => {
                if (!cond || cond.type !== 'characterState') return true;
                const hasState = statesAfterContent[cond.characterId]?.includes(cond.state);
                return compare(hasState, cond.operator, true);
            });
            if (!isReachableByState) return;

            const statesAfterChoiceActions = applyStateActions(statesAfterContent, choice.actions);
            const rangesAfterChoiceActions = applyActionsToRanges(rangesForChoice, choice.actions);

            choiceOutcomes.push({
                choiceId: choice.id,
                targetSceneId: choice.targetSceneId,
                finalRanges: rangesAfterChoiceActions,
                finalStates: statesAfterChoiceActions
            });

            if (choice.targetSceneId) {
                traverse(choice.targetSceneId, currentPath, rangesAfterChoiceActions, statesAfterChoiceActions, choiceActionsLog, depth + 1);
            } else {
                checkForUnresolvedStates(scene, currentPath, statesAfterChoiceActions);
            }
        });

        if (settings.meaninglessChoices && choiceOutcomes.length > 1) {
            const effectiveOutcomes = choiceOutcomes.map(outcome => {
                if (!outcome.targetSceneId) {
                    return {
                        endSceneId: scene.id,
                        finalRanges: outcome.finalRanges,
                        finalStates: outcome.finalStates,
                    };
                }
                return findEffectiveOutcome(outcome.targetSceneId, outcome.finalRanges, outcome.finalStates, currentPath);
            });

            const firstEffectiveOutcome = effectiveOutcomes[0];
            if (firstEffectiveOutcome) {
                const isMeaningless = effectiveOutcomes.every(outcome =>
                    outcome &&
                    outcome.endSceneId === firstEffectiveOutcome.endSceneId &&
                    JSON.stringify(outcome.finalRanges) === JSON.stringify(firstEffectiveOutcome.finalRanges) &&
                    JSON.stringify(outcome.finalStates) === JSON.stringify(firstEffectiveOutcome.finalStates)
                );

                if (isMeaningless) {
                    issues.push({
                        type: '의미 없는 선택지',
                        sceneId: scene.id,
                        sceneName: scene.name,
                        message: `'${scene.name}' 씬의 선택지들이 결국 동일한 결과(변수, 상태, 귀결 씬)를 가집니다.`,
                        path: currentPath
                    });
                }
            }
        }

        if (scene.autoTransitionTarget) {
            hasOutgoingPath = true;
            traverse(scene.autoTransitionTarget, currentPath, rangesAfterContent, statesAfterContent, newActionsLog, depth + 1);
        }

        if (!hasOutgoingPath) {
            checkForUnresolvedStates(scene, currentPath, statesAfterContent);
        }
    }

    function checkForUnresolvedStates(scene, path, finalStates) {
        if (!settings.unresolvedStates) return;
        const plotHoleStates = story.plotHoleStates || [];
        if (plotHoleStates.length === 0) return;

        for (const char of characters) {
            if (!char) continue;
            const charStates = finalStates[char.id] || [];
            const unresolved = charStates.find(s => plotHoleStates.includes(s));
            
            if (unresolved) {
                const isIncapacitated = (story.incapacitatedStates || []).some(s => charStates.includes(s));
                if (!isIncapacitated) {
                    issues.push({
                        type: '해결되지 않은 상태',
                        sceneId: scene.id,
                        sceneName: scene.name,
                        message: `경로의 끝에서 '${char.name}' 캐릭터의 '${unresolved}' 상태가 해결되지 않았습니다.`,
                        path: path
                    });
                }
            }
        }
    }

    if (scenes['start']) {
        traverse('start', [], initialVarRanges, initialCharacterStates, []);
    }

    const uniqueIssues = issues.filter((issue, index, self) =>
        index === self.findIndex((t) => (t.sceneId === issue.sceneId && t.message === issue.message))
    );
    return uniqueIssues;
}

export function analyzeCharacterStates(story) {
    if (!story || !story.scenes || !story.characters) {
        return {};
    }
    const { scenes, characters } = story;

    const statesByScene = Object.keys(scenes).reduce((acc, sceneId) => {
        acc[sceneId] = {};
        characters.forEach(char => {
            if (char) acc[sceneId][char.id] = new Set();
        });
        return acc;
    }, {});

    const initialCharacterStates = characters.reduce((acc, c) => { if(c) acc[c.id] = []; return acc; }, {});
    const visitedStates = new Set();

    function applyStateActions(currentStates, actions) {
        const newStates = JSON.parse(JSON.stringify(currentStates));
        (actions || []).forEach(action => {
            if (!action || action.type !== 'characterState' || !newStates[action.characterId]) return;
            const states = newStates[action.characterId];
            const stateExists = states.includes(action.state);
            if (action.operator === '+=' && !stateExists) states.push(action.state);
            else if (action.operator === '-=' && stateExists) newStates[action.characterId] = states.filter(s => s !== action.state);
        });
        return newStates;
    }

    function traverse(sceneId, currentStates) {
        const scene = scenes[sceneId];
        if (!scene) return;

        const stateKey = `${sceneId}|${JSON.stringify(currentStates)}`;
        if (visitedStates.has(stateKey)) return;
        visitedStates.add(stateKey);

        // Update global states for the current scene
        characters.forEach(char => {
            if (char && currentStates[char.id]) {
                currentStates[char.id].forEach(state => {
                    statesByScene[sceneId][char.id].add(state);
                });
            }
        });

        const contentActions = (scene.content || []).flatMap(item => item?.actions || []);
        const statesAfterContent = applyStateActions(currentStates, contentActions);

        (scene.choices || []).forEach(choice => {
            if (!choice || !choice.targetSceneId) return;
            
            // We don't check conditions here, as we want to know all *possible* states
            // regardless of whether a path is logically sound.
            const statesForNext = applyStateActions(statesAfterContent, choice.actions);
            traverse(choice.targetSceneId, statesForNext);
        });

        if (scene.autoTransitionTarget) {
            traverse(scene.autoTransitionTarget, statesAfterContent);
        }
    }

    if (scenes['start']) {
        traverse('start', initialCharacterStates);
    }

    // Convert sets to arrays for easier use
    const finalStates = {};
    for (const sceneId in statesByScene) {
        finalStates[sceneId] = {};
        for (const charId in statesByScene[sceneId]) {
            finalStates[sceneId][charId] = Array.from(statesByScene[sceneId][charId]);
        }
    }

    return finalStates;
}
            
            // A simple string hashing function
            function simpleHashCode(str) {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = (hash << 5) - hash + char;
                    hash |= 0; // Convert to 32bit integer
                }
                return hash;
            }

            export function getTagColor(tag) {
                const hash = simpleHashCode(tag);
                const hue = Math.abs(hash % 360);
                const saturation = 65 + (Math.abs(hash % 15)); // 65 to 80
                const lightness = 45 + (Math.abs(hash % 10)); // 45 to 55
                return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            }