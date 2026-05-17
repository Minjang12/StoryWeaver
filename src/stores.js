import { writable, derived, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import { getColorFromString, parseScriptToStory, createUniqueId, checkStoryConsistency, analyzeCharacterStates } from './utils.js';
import { storage } from './storage.js'; // MIMINYAN: Import storage adapter

export const notifications = createNotificationStore();

// Stores the file path of the currently active project (for Electron "Save" vs "Save As")
export const currentFilePath = writable(null);

function createNotificationStore() {
    const { subscribe, update } = writable([]);

    function add(message, type = 'info', duration = 3000) {
        const id = uuidv4();
        update(all => [...all, { id, message, type }]);
        setTimeout(() => remove(id), duration);
    }

    function remove(id) {
        update(all => all.filter(n => n.id !== id));
    }

    return { subscribe, add, remove };
}

// --- Constants ---
const PROJECTS_STORAGE_KEY = 'storyweaver_projects';
const ACTIVE_PROJECT_ID_KEY = 'storyweaver_active_project_id';

// --- Helper Functions ---
function createNewStory() {
    const initialCharacter = {
        id: createUniqueId('char'),
        name: '나레이션',
        description: '스토리의 서술자입니다.',
        profileImage: '',
        relationships: [],
        attributes: {},
        customLists: [],
        color: '#6c757d',
        category: '기본',
        isFavorite: false
    };
    const secondSceneId = createUniqueId('scene');
    return {
        scenes: {
            'start': {
                id: 'start', name: 'START', position: { x: 100, y: 150 },
                content: [{ type: 'dialogue', id: createUniqueId('dialogue'), character: initialCharacter.name, text: '새로운 이야기가 시작됩니다.' }],
                choices: [], color: null, icon: null,
                autoTransitionTarget: null, // Add auto-transition property
                effects: { bgm: null, sfx: null, background: null }, // Add effects object
                plotThreadIds: [],
                referencedWikiIds: [] // New: Link to wiki items (locations, items, etc.)
            },
            [secondSceneId]: {
                id: secondSceneId, name: '두 번째 씬', position: { x: 400, y: 250 },
                content: [],
                choices: [], color: null, icon: null,
                autoTransitionTarget: null,
                effects: { bgm: null, sfx: null, background: null },
                plotThreadIds: [],
                referencedWikiIds: []
            }
        },
        sequences: {
            'seq_1': {
                id: 'seq_1',
                name: '인트로',
                scenes: ['start', secondSceneId],
                color: 'rgba(0, 123, 255, 0.1)'
            }
        },
        characters: [initialCharacter],
        variables: [],
        plotThreads: [],
        selectedSceneId: 'start',
        linkingState: { active: false, sourceSceneId: null, sourceItemId: null, sourceType: null },
        viewTransform: { scale: 1, x: 0, y: 0 },
        storylines: [],
        dictionary: [], // Keeping for backward compatibility, will serve as 'lore'
        locations: [], // New: Locations
        items: [],     // New: Items/Artifacts
        creatures: [], // New: Creatures
        groups: [],    // New: Organizations/Groups
        history: {     // New: Chronology
            eras: [],  // { id, name, description, color, order }
            events: [] // { id, title, description, date, sortOrder, eraId, tags, relatedWikiIds }
        },
        characterCategories: ['기본'],
        dictionaryCategories: [],
        locationCategories: [], // New
        itemCategories: [],     // New
        creatureCategories: [], // New
        groupCategories: [],    // New
        loreCategories: [],     // New (replaces dictionaryCategories eventually)
        characterStates: [],
        incapacitatedStates: [],
        plotHoleStates: [],
        consistencyCheckSettings: {
            unreachableConditions: true,
            logicalContradictions: true,
            incapacitatedDialogue: true,
            unresolvedStates: true,
            meaninglessChoices: true,
        },
        settings: { // Add settings object
        },
        mapData: { // MIMINYAN: New Map Data
            background: null,
            markers: [], // { id, x, y, type: 'location'|'custom', wikiId }
            connections: [] // { id, fromId, toId }
        },
        goals: { // MIMINYAN: Add goals object for the new feature
            dailyWordCount: {
                target: 500,
                current: 0,
                enabled: true
            },
            streak: 0,
            lastGoalMetDate: null,
            history: {}
        }
    };
}

// --- Core Stores ---

// Manages all projects, loaded from localStorage.
const initialProjects = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || '{}');
export const projectManager = writable(initialProjects);

// Holds the currently active project object.
const activeProjectId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
const initialActiveProject = initialProjects[activeProjectId] || null;

export const activeProject = writable(initialActiveProject);

// MIMINYAN: This function ensures that any loaded project (especially older ones)
// has the necessary data structures and gets an initial achievement check.
function initializeActiveProject() {
    activeProject.update(proj => {
        if (!proj) return null;

        // Ensure history exists
        if (!proj.history) {
            proj.history = { stack: [proj.story], index: 0 };
        }

        // Backward compatibility checks
        if (proj.story) {
            const baseStory = createNewStory();
            if (!proj.story.goals) proj.story.goals = baseStory.goals;
            if (!proj.story.plotThreads) proj.story.plotThreads = baseStory.plotThreads;

            // Missing wiki and other arrays
            if (!proj.story.dictionary) proj.story.dictionary = [];
            if (!proj.story.locations) proj.story.locations = [];
            if (!proj.story.items) proj.story.items = [];
            if (!proj.story.creatures) proj.story.creatures = [];
            if (!proj.story.groups) proj.story.groups = [];
            if (!proj.story.history) proj.story.history = { eras: [], events: [] };

            // Categories
            if (!proj.story.characterCategories) proj.story.characterCategories = ['기본']; // Legacy support
            if (!proj.story.dictionaryCategories) proj.story.dictionaryCategories = []; // Legacy support
            if (!proj.story.locationCategories) proj.story.locationCategories = [];
            if (!proj.story.itemCategories) proj.story.itemCategories = [];
            if (!proj.story.creatureCategories) proj.story.creatureCategories = [];
            if (!proj.story.groupCategories) proj.story.groupCategories = [];
            if (!proj.story.loreCategories) proj.story.loreCategories = [];

            if (!proj.story.mapData) {
                proj.story.mapData = { background: null, markers: [], connections: [] };
            } else if (!proj.story.mapData.connections) {
                proj.story.mapData.connections = [];
            }

            Object.values(proj.story.scenes).forEach(scene => {
                if (!scene.plotThreadIds) {
                    scene.plotThreadIds = [];
                }
                if (!scene.referencedWikiIds) {
                    scene.referencedWikiIds = [];
                }
            });
        }

        return proj;
    });
}

// Run initialization right after the store is defined for the initially loaded project
if (initialActiveProject) {
    initializeActiveProject();
}


// --- Persistence ---

// Auto-save all projects to localStorage whenever they change.
projectManager.subscribe(value => {
    if (!value || Object.keys(value).length === 0) return;

    try {
        // Optimize: Use replacer to exclude history during stringification, avoiding expensive deep cloning.
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(value, (key, val) => {
            // Exclude 'history' key to save space and improve performance
            if (key === 'history') return undefined;
            return val;
        }));
    } catch (e) {
        console.error("Failed to process and save projects:", e);
        // As a fallback, try to save the original data if cloning/processing fails.
        try {
            localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(value));
        } catch (saveError) {
            console.error("Critical: Failed to save to localStorage", saveError);
            notifications.add(`자동 저장 실패! 저장 공간이 부족할 수 있습니다. 프로젝트를 파일로 저장해주세요.`, 'error', 10000);
        }
    }
});

// Auto-save the active project ID.
activeProject.subscribe(value => {
    if (value && value.id) {
        localStorage.setItem(ACTIVE_PROJECT_ID_KEY, value.id);
    } else {
        localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    }
});

// Debounced auto-saving for the active project's story.
let debounceTimer;
activeProject.subscribe(project => {
    setTimeout(() => {
        if (project) {
            clearTimeout(debounceTimer);

            let isDragging = false;
            uiState.subscribe(s => isDragging = s.isDraggingOnCanvas)();

            if (!isDragging) {
                debounceTimer = setTimeout(() => {
                    projectManager.update(projs => {
                        projs[project.id] = project;
                        return projs;
                    });
                }, 500);
            }
        }
    }, 0);
});


// --- Project Action Manager ---
function createProjectActionManager() {
    const _recordHistory = (project) => {
        const { story, history } = project;
        const newStack = history.stack.slice(0, history.index + 1);
        newStack.push(story);
        return {
            ...history,
            stack: newStack,
            index: newStack.length - 1
        };
    };

    const updateActiveStory = (updater, record = true) => {
        activeProject.update(proj => {
            if (!proj) return null;
            let newStory = updater(proj.story);

            const newHistory = record ? _recordHistory({ ...proj, story: newStory }) : proj.history;
            return { ...proj, story: newStory, history: newHistory };
        });
    };

    const upgradeCharacterData = (characters) => {
        if (!Array.isArray(characters)) return [];
        return characters.map(char => {
            if (typeof char === 'string') { // Legacy: "Character Name"
                return {
                    id: createUniqueId('char'), name: char, description: '', profileImage: '',
                    attributes: {}, customLists: [], color: getColorFromString(char)
                };
            }
            if (typeof char === 'object' && char !== null) {
                const newChar = {
                    id: char.id || createUniqueId('char'),
                    name: char.name || 'Unknown',
                    description: char.description || '',
                    profileImage: char.profileImage || '',
                    profileImageTransform: char.profileImageTransform || { scale: 1, x: 0, y: 0 },
                    sprites: char.sprites || [],
                    relationships: char.relationships || [],
                    attributes: char.attributes || {},
                    customLists: char.customLists || [],
                    affiliation: char.affiliation || null, // Add affiliation field
                    color: char.color || getColorFromString(char.name || 'Unknown'),
                    category: char.category || null,
                    aliases: char.aliases || [],
                    isFavorite: char.isFavorite || false,
                    narrative: char.narrative || { goal: '', motivation: '', conflict: '', flaw: '', lie: '' },
                    voice: char.voice || { tone: '', habit: '', keywords: '' }
                };

                // Migrate legacy 'states' to a custom list
                if (Array.isArray(char.states) && char.states.length > 0) {
                    const statesList = {
                        id: createUniqueId('list'),
                        name: '상태',
                        items: char.states.map(s => ({ id: createUniqueId('item'), value: s }))
                    };
                    newChar.customLists.push(statesList);
                }
                delete newChar.states;

                return newChar;
            }
            return char; // Should not happen, but return as is if it does.
        });
    };

    const recalculateCharacters = (scenes, currentCharacters) => {
        const upgradedCharacters = upgradeCharacterData(currentCharacters);
        const characterDataMap = new Map(upgradedCharacters.map(c => [c.name, c]));
        const usedCharacterNames = new Set(['나레이션']);

        for (const sceneId in scenes) {
            scenes[sceneId].content.forEach(item => {
                if (item.type === 'dialogue' && item.character && item.character.trim()) {
                    usedCharacterNames.add(item.character.trim());
                }
            });
        }

        // MIMINYAN: Preserve characters that have settings/data even if unused in dialogue
        upgradedCharacters.forEach(char => {
            const hasData = (char.description && char.description.trim()) ||
                char.profileImage ||
                (char.attributes && Object.keys(char.attributes).length > 0) ||
                (char.sprites && char.sprites.length > 0) ||
                (char.customLists && char.customLists.length > 0) ||
                (char.relationships && char.relationships.length > 0) ||
                char.affiliation;
            if (hasData) {
                usedCharacterNames.add(char.name);
            }
        });

        return Array.from(usedCharacterNames).map(name => {
            const existingData = characterDataMap.get(name);
            if (existingData) return existingData;

            return {
                id: createUniqueId('char'), name, description: '', profileImage: '',
                sprites: [],
                relationships: [],
                attributes: {}, customLists: [], affiliation: null, color: getColorFromString(name),
                category: null,
                aliases: [],
                isFavorite: false,
                narrative: { goal: '', motivation: '', conflict: '', flaw: '', lie: '' },
                voice: { tone: '', habit: '', keywords: '' }
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    };

    const actions = {
        updateActiveStory, // MIMINYAN: Fix: Expose this function

        // --- Project Lifecycle ---
        createNewProject: (name, initialData = null) => {
            uiState.resetProjectSpecificStates();
            let newStory = createNewStory();

            // Merge initialData if provided
            if (initialData) {
                newStory = { ...newStory, ...initialData };
                // Ensure critical structures exist
                if (!newStory.scenes || Object.keys(newStory.scenes).length === 0) {
                    const base = createNewStory();
                    newStory.scenes = base.scenes;
                    newStory.sequences = base.sequences;
                }
            }

            const newProject = {
                id: createUniqueId('proj'),
                name: name || '새로운 프로젝트',
                story: newStory,
                history: { stack: [newStory], index: 0 }
            };
            projectManager.update(projs => ({ ...projs, [newProject.id]: newProject }));
            activeProject.set(newProject);
        },
        loadProject: (projectId) => {
            let projects;
            projectManager.subscribe(p => projects = p)();
            if (projects[projectId]) {
                uiState.resetProjectSpecificStates();
                currentFilePath.set(null); // Reset file path as we are loading from internal storage
                const projectToLoad = { ...projects[projectId] };

                // --- Backward Compatibility ---
                const baseStory = createNewStory();
                projectToLoad.story = { ...baseStory, ...projectToLoad.story };
                if (!projectToLoad.story.settings) projectToLoad.story.settings = baseStory.settings;
                if (!projectToLoad.story.assets) projectToLoad.story.assets = baseStory.assets;
                if (!projectToLoad.story.dictionary) projectToLoad.story.dictionary = [];
                if (!projectToLoad.story.locations) projectToLoad.story.locations = [];
                if (!projectToLoad.story.items) projectToLoad.story.items = [];
                if (!projectToLoad.story.creatures) projectToLoad.story.creatures = [];
                if (!projectToLoad.story.groups) projectToLoad.story.groups = [];
                if (!projectToLoad.story.history) projectToLoad.story.history = { eras: [], events: [] };
                if (!projectToLoad.story.locationCategories) projectToLoad.story.locationCategories = [];
                if (!projectToLoad.story.itemCategories) projectToLoad.story.itemCategories = [];
                if (!projectToLoad.story.creatureCategories) projectToLoad.story.creatureCategories = [];
                if (!projectToLoad.story.groupCategories) projectToLoad.story.groupCategories = [];
                if (!projectToLoad.story.loreCategories) projectToLoad.story.loreCategories = [];

                if (!projectToLoad.story.mapData) {
                    projectToLoad.story.mapData = { background: null, markers: [], connections: [] };
                } else if (!projectToLoad.story.mapData.connections) {
                    projectToLoad.story.mapData.connections = [];
                }

                if (!projectToLoad.story.goals) projectToLoad.story.goals = baseStory.goals;
                if (!projectToLoad.story.plotThreads) projectToLoad.story.plotThreads = [];
                if (!projectToLoad.story.characterStates) projectToLoad.story.characterStates = [];
                if (!projectToLoad.story.incapacitatedStates) projectToLoad.story.incapacitatedStates = [];
                if (!projectToLoad.story.plotHoleStates) projectToLoad.story.plotHoleStates = [];
                if (!projectToLoad.story.consistencyCheckSettings) {
                    projectToLoad.story.consistencyCheckSettings = {
                        unreachableConditions: true,
                        logicalContradictions: true,
                        incapacitatedDialogue: true,
                        unresolvedStates: true,
                        meaninglessChoices: true,
                    };
                }

                // MIMINYAN: Run achievement check when loading a project from the modal
                // projectToLoad.story = checkAchievements(projectToLoad.story);

                Object.values(projectToLoad.story.scenes).forEach(scene => {
                    if (!scene.effects) scene.effects = { bgm: null, sfx: null, background: null };
                    if (scene.comment === undefined) scene.comment = ''; // Add comment field if missing
                    if (!scene.plotThreadIds) scene.plotThreadIds = [];
                    scene.content.forEach(item => {
                        if (item.type === 'dialogue' && item.comment === undefined) {
                            item.comment = ''; // Add comment field to dialogues if missing
                        }
                    });
                });
                // --- End Compatibility ---

                // Reset transient UI states that shouldn't persist
                if (projectToLoad.story.linkingState) {
                    projectToLoad.story.linkingState = { active: false, sourceSceneId: null, sourceChoiceId: null };
                }

                // Ensure history object exists
                projectToLoad.history = { stack: [projectToLoad.story], index: 0 };

                activeProject.set(projectToLoad);
            }
        },
        deleteProject: (projectId) => {
            projectManager.update(projs => {
                const newProjs = { ...projs };
                delete newProjs[projectId];
                return newProjs;
            });
            activeProject.update(curr => {
                if (curr && curr.id === projectId) {
                    uiState.resetProjectSpecificStates();
                    return null;
                }
                return curr;
            });
        },
        openProjectModal: () => {
            uiState.openProjectModal();
        },



        // --- History ---
        undo: () => {
            activeProject.update(proj => {
                if (!proj) return null;
                const { history } = proj;
                if (history.index > 0) {
                    const newIndex = history.index - 1;
                    const newStory = history.stack[newIndex];
                    return { ...proj, story: newStory, history: { ...history, index: newIndex } };
                }
                return proj;
            });
        },
        redo: () => {
            activeProject.update(proj => {
                if (!proj) return null;
                const { history } = proj;
                if (history.index < history.stack.length - 1) {
                    const newIndex = history.index + 1;
                    const newStory = history.stack[newIndex];
                    return { ...proj, story: newStory, history: { ...history, index: newIndex } };
                }
                return proj;
            });
        },
        commitHistory: () => {
            activeProject.update(proj => {
                if (!proj) return null;
                const newHistory = _recordHistory(proj);
                return { ...proj, history: newHistory };
            });
        },

        // --- Story Elements ---
        selectScene: (sceneId) => updateActiveStory(story => {
            if (story.linkingState.active) {
                const { sourceSceneId, sourceItemId, sourceType } = story.linkingState;
                const sourceScene = story.scenes[sourceSceneId];

                if (sourceType === 'choice') {
                    const newChoices = sourceScene.choices.map(c => c.id === sourceItemId ? { ...c, targetSceneId: sceneId } : c);
                    return { ...story, scenes: { ...story.scenes, [sourceSceneId]: { ...sourceScene, choices: newChoices } }, linkingState: { active: false } };
                } else if (sourceType === 'scene') {
                    const updatedScene = { ...sourceScene, autoTransitionTarget: sceneId };
                    if (updatedScene.choices.length > 0) {
                        updatedScene.choices = [];
                        notifications.add(`'${sourceScene.name}' 씬의 기존 선택지가 삭제되고 자동 연결로 대체되었습니다.`, 'info');
                    }
                    return { ...story, scenes: { ...story.scenes, [sourceSceneId]: updatedScene }, linkingState: { active: false } };
                }
            }
            return { ...story, selectedSceneId: sceneId };
        }, false),
        addScene: (options = {}) => updateActiveStory(story => {
            const { position, sequenceId } = options;
            const newId = createUniqueId('scene');
            let targetPos = position;

            if (!targetPos) {
                targetPos = { x: 400, y: 150 };
                const scenesArray = Object.values(story.scenes);
                const currentScene = story.scenes[story.selectedSceneId];

                if (currentScene) {
                    targetPos = { x: currentScene.position.x + 40, y: currentScene.position.y + 80 };
                } else if (scenesArray.length > 0) {
                    let bottomMostScene = scenesArray[0];
                    scenesArray.forEach(scene => { if (scene.position.y > bottomMostScene.position.y) bottomMostScene = scene; });
                    targetPos = { x: bottomMostScene.position.x + 40, y: bottomMostScene.position.y + 80 };
                }
            }

            const newScene = { id: newId, name: '새로운 씬', position: targetPos, content: [], choices: [], color: null, icon: null, autoTransitionTarget: null, effects: {}, comment: '', plotThreadIds: [], referencedWikiIds: [] };
            const newScenes = { ...story.scenes, [newId]: newScene };
            let newSequences = story.sequences;

            if (sequenceId && newSequences[sequenceId]) {
                const targetSequence = newSequences[sequenceId];
                newSequences = {
                    ...newSequences,
                    [sequenceId]: {
                        ...targetSequence,
                        scenes: [...targetSequence.scenes, newId]
                    }
                };
            }

            return { ...story, scenes: newScenes, sequences: newSequences, selectedSceneId: newId };
        }),
        duplicateScene: (sceneId) => updateActiveStory(story => {
            const originalScene = story.scenes[sceneId];
            if (!originalScene) return story;
            const newId = createUniqueId('scene');
            const newScene = {
                ...originalScene, id: newId, name: `${originalScene.name} (복제)`,
                position: { x: originalScene.position.x + 40, y: originalScene.position.y + 40 },
                autoTransitionTarget: originalScene.autoTransitionTarget, // Preserve auto-transition link
                comment: originalScene.comment, // Preserve scene comment
                content: originalScene.content.map(item => ({
                    ...item,
                    id: createUniqueId(item.type),
                    actions: (item.actions || []).map(act => ({ ...act, id: createUniqueId('action') }))
                })),
                choices: originalScene.choices.map(choice => ({
                    ...choice,
                    id: createUniqueId('choice'),
                    conditions: (choice.conditions || []).map(cond => ({ ...cond, id: createUniqueId('cond') })),
                    actions: (choice.actions || []).map(act => ({ ...act, id: createUniqueId('action') }))
                }))
            };
            return { ...story, scenes: { ...story.scenes, [newId]: newScene }, selectedSceneId: newId };
        }),
        setStartScene: (newStartSceneId) => updateActiveStory(story => {
            if (newStartSceneId === 'start' || !story.scenes[newStartSceneId]) return story;
            const tempId = createUniqueId('temp');
            const allScenes = { ...story.scenes };
            allScenes[tempId] = { ...allScenes['start'], id: tempId };
            delete allScenes['start'];
            allScenes['start'] = { ...allScenes[newStartSceneId], id: 'start', name: 'START' };
            delete allScenes[newStartSceneId];
            allScenes[newStartSceneId] = { ...allScenes[tempId], id: newStartSceneId };
            delete allScenes[tempId];
            for (const sceneId in allScenes) {
                allScenes[sceneId].choices.forEach(choice => {
                    if (choice.targetSceneId === 'start') choice.targetSceneId = tempId;
                    else if (choice.targetSceneId === newStartSceneId) choice.targetSceneId = 'start';
                });
            }
            allScenes[newStartSceneId].choices.forEach(choice => {
                if (choice.targetSceneId === tempId) choice.targetSceneId = newStartSceneId;
            });
            return { ...story, scenes: allScenes, selectedSceneId: 'start' };
        }),
        removeSceneConnection: (sceneId) => updateActiveStory(story => ({ ...story, scenes: { ...story.scenes, [sceneId]: { ...story.scenes[sceneId], autoTransitionTarget: null } } })),
        updateScene: (sceneId, data, record = true) => updateActiveStory(story => ({ ...story, scenes: { ...story.scenes, [sceneId]: { ...story.scenes[sceneId], ...data } } }), record),
        removeScene: (sceneId) => updateActiveStory(story => {
            if (sceneId === 'start') return story;
            const newScenes = { ...story.scenes };
            delete newScenes[sceneId];
            for (const key in newScenes) {
                newScenes[key].choices = newScenes[key].choices.map(c => c.targetSceneId === sceneId ? { ...c, targetSceneId: null } : c);
            }
            const newStorylines = story.storylines.map(sl => ({
                ...sl,
                nodes: sl.nodes.filter(nodeId => nodeId !== sceneId)
            }));
            return { ...story, scenes: newScenes, storylines: newStorylines, selectedSceneId: story.selectedSceneId === sceneId ? 'start' : story.selectedSceneId };
        }),
        addDialogue: (sceneId, characterName = '') => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const newDialogue = { type: 'dialogue', id: createUniqueId('dialogue'), character: characterName, text: '', actions: [], comment: '' };
            return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, content: [...scene.content, newDialogue] } } };
        }),
        updateDialogue: (sceneId, dialogueId, data, record = true) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const newContent = scene.content.map(item => item.id === dialogueId ? { ...item, ...data } : item);
            return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, content: newContent } } };
        }, record),
        removeDialogue: (sceneId, dialogueId) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const newContent = scene.content.filter(item => item.id !== dialogueId);
            const newScenes = { ...story.scenes, [sceneId]: { ...scene, content: newContent } };
            return { ...story, scenes: newScenes, characters: recalculateCharacters(newScenes, story.characters) };
        }),
        reorderDialogues: (sceneId, reorderedDialogues) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            if (!scene) return story;

            const reorderedDialoguesCopy = [...reorderedDialogues];
            const newContent = scene.content.map(item => {
                if (item.type === 'dialogue') {
                    // Replace with the next dialogue from the reordered list
                    return reorderedDialoguesCopy.shift();
                }
                // Keep non-dialogue items as they are
                return item;
            });

            return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, content: newContent } } };
        }, true),
        moveDialogueToScene: (sourceSceneId, dialogueId, targetSceneId) => updateActiveStory(story => {
            const sourceScene = story.scenes[sourceSceneId];
            const targetScene = story.scenes[targetSceneId];
            if (!sourceScene || !targetScene) return story;

            const dialogueToMove = sourceScene.content.find(item => item.id === dialogueId);
            if (!dialogueToMove) return story;

            // Remove from source scene
            const newSourceContent = sourceScene.content.filter(item => item.id !== dialogueId);

            // Add to target scene
            const newTargetContent = [...targetScene.content, dialogueToMove];

            const newScenes = {
                ...story.scenes,
                [sourceSceneId]: { ...sourceScene, content: newSourceContent },
                [targetSceneId]: { ...targetScene, content: newTargetContent },
            };

            return { ...story, scenes: newScenes };
        }),
        updateCharacterNameInDialogue: (sceneId, dialogueId, newCharacterName, oldCharacterName) => updateActiveStory(story => {
            const newName = newCharacterName.trim();
            const oldName = oldCharacterName.trim();

            if (newName === oldName) return story;

            let newCharacters = [...story.characters];
            const newScenes = { ...story.scenes };

            // 1. Update just the one dialogue line
            const scene = newScenes[sceneId];
            scene.content = scene.content.map(item =>
                item.id === dialogueId ? { ...item, character: newName } : item
            );

            // 2. Check if the new character exists. If not, create it.
            if (newName && !newCharacters.some(c => c.name === newName)) {
                const newCharacter = {
                    id: createUniqueId('char'), name: newName, description: '', profileImage: '',
                    attributes: {}, states: [], color: getColorFromString(newName)
                };
                newCharacters.push(newCharacter);
                newCharacters.sort((a, b) => a.name.localeCompare(b.name));
            }

            // 3. (Auto-delete logic removed for safety)
            // Previously, we deleted the old character if it became unused and empty.
            // Now, we keep it to prevent accidental data loss. Users can use the 'Cleanup' feature manually.

            return { ...story, scenes: newScenes, characters: newCharacters };
        }),
        updateCharacter: (characterId, data) => updateActiveStory(story => {
            let oldName = null;
            const newCharacters = story.characters.map(c => {
                if (c.id === characterId) {
                    if (data.name && data.name !== c.name) oldName = c.name;
                    return { ...c, ...data };
                }
                return c;
            });

            let newScenes = story.scenes;
            if (oldName && data.name) {
                newScenes = { ...story.scenes };
                for (const sceneId in newScenes) {
                    const scene = newScenes[sceneId];
                    const newContent = scene.content.map(item => {
                        if (item.type === 'dialogue' && item.character === oldName) {
                            return { ...item, character: data.name };
                        }
                        return item;
                    });
                    newScenes[sceneId] = { ...scene, content: newContent };
                }
                notifications.add(`캐릭터 이름을 '${oldName}'에서 '${data.name}'(으)로 변경하고 모든 대사를 업데이트했습니다.`, 'success');
            }

            return { ...story, characters: newCharacters, scenes: newScenes };
        }),
        addNewCharacter: (name, category = null) => updateActiveStory(story => {
            let newName = name ? name.trim() : '새 등장인물';
            if (!newName) newName = '새 등장인물';

            if (story.characters.some(c => c.name === newName)) {
                let counter = 1;
                const baseName = newName;
                while (story.characters.some(c => c.name === newName)) {
                    newName = `${baseName} ${++counter}`;
                }
            }

            const newCharacter = {
                id: createUniqueId('char'), name: newName, description: '', profileImage: '',
                relationships: [],
                attributes: {}, customLists: [], affiliation: null, color: getColorFromString(newName), category: category,
                isFavorite: false,
                sortOrder: story.characters.length > 0 ? Math.max(...story.characters.map(c => c.sortOrder || 0)) + 1 : 0
            };
            const newCharacters = [...story.characters, newCharacter].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)); // Sort by order initially
            return { ...story, characters: newCharacters };
        }),
        toggleCharacterFavorite: (characterId) => updateActiveStory(story => {
            const newCharacters = story.characters.map(c =>
                c.id === characterId ? { ...c, isFavorite: !c.isFavorite } : c
            );
            return { ...story, characters: newCharacters };
        }),
        reorderWikiItems: (type, orderedIds) => updateActiveStory(story => {
            const itemMap = {
                character: 'characters',
                location: 'locations',
                item: 'items',
                creature: 'creatures',
                group: 'groups',
                lore: 'dictionary'
            };
            const field = itemMap[type];
            if (!field) return story;

            const newItems = story[field].map(item => {
                const newIndex = orderedIds.indexOf(item.id);
                if (newIndex !== -1) {
                    return { ...item, sortOrder: newIndex };
                }
                return item;
            });

            // Re-sort the array by sortOrder
            newItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

            return { ...story, [field]: newItems };
        }),
        removeCharacter: (characterId) => {
            let story;
            activeProject.subscribe(p => story = p.story)();
            const character = story.characters.find(c => c.id === characterId);

            if (!character) return;
            if (character.name === '나레이션') {
                notifications.add('기본 캐릭터는 삭제할 수 없습니다.', 'warning');
                return;
            }

            const isCharacterSheetEmpty = (char) => {
                if (!char) return true;
                return !char.description?.trim() &&
                    !char.profileImage &&
                    (!char.attributes || Object.keys(char.attributes).length === 0) &&
                    (!char.states || char.states.length === 0) &&
                    (!char.sprites || char.sprites.length === 0) &&
                    (!char.customLists || char.customLists.length === 0) &&
                    (!char.relationships || char.relationships.length === 0) &&
                    !char.affiliation;
            };

            const performDelete = () => {
                updateActiveStory(s => {
                    const newCharacters = s.characters.filter(c => c.id !== characterId);
                    // Also remove character from any dialogues
                    const newScenes = { ...s.scenes };
                    for (const sceneId in newScenes) {
                        newScenes[sceneId].content.forEach(item => {
                            if (item.type === 'dialogue' && item.character === character.name) {
                                item.character = '나레이션'; // Default to narrator
                            }
                        });
                    }
                    notifications.add(`'${character.name}' 등장인물을 삭제했습니다.`, 'info');
                    return { ...s, characters: newCharacters, scenes: newScenes };
                });
            };

            if (!isCharacterSheetEmpty(character)) {
                confirmation.prompt(
                    `'${character.name}' 등장인물은 캐릭터 시트에 정보가 있습니다. 정말로 삭제하시겠습니까? 이 등장인물을 사용하는 모든 대화에서 화자가 '나레이션'으로 변경됩니다.`,
                    performDelete
                );
            } else {
                performDelete();
            }
        },
        cleanupCharacters: () => updateActiveStory(story => {
            const isCharacterSheetEmpty = (character) => {
                if (!character) return true;
                return !character.description?.trim() &&
                    !character.profileImage &&
                    (!character.attributes || Object.keys(character.attributes).length === 0) &&
                    (!character.states || character.states.length === 0) &&
                    (!character.sprites || character.sprites.length === 0) &&
                    (!character.customLists || character.customLists.length === 0) &&
                    (!character.relationships || character.relationships.length === 0) &&
                    !character.affiliation;
            };

            const usedCharacterNames = new Set();
            for (const scene of Object.values(story.scenes)) {
                for (const item of scene.content) {
                    if (item.type === 'dialogue' && item.character) {
                        usedCharacterNames.add(item.character);
                    }
                }
            }

            const charactersToKeep = story.characters.filter(char => {
                return char.name === '나레이션' || usedCharacterNames.has(char.name) || !isCharacterSheetEmpty(char);
            });

            if (charactersToKeep.length < story.characters.length) {
                const removedCount = story.characters.length - charactersToKeep.length;
                notifications.add(`${removedCount}명의 사용되지 않는 등장인물을 정리했습니다.`, 'info');
            } else {
                notifications.add('정리할 등장인물이 없습니다.', 'info');
            }

            return { ...story, characters: charactersToKeep };
        }),
        addChoice: (sceneId) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const newChoice = { type: 'choice', id: createUniqueId('choice'), text: '', targetSceneId: null, conditions: [], actions: [] };
            return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, choices: [...scene.choices, newChoice] } } };
        }),
        updateChoice: (sceneId, choiceId, data, record = true) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const newChoices = scene.choices.map(item => item.id === choiceId ? { ...item, ...data } : item);
            return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, choices: newChoices } } };
        }, record),
        removeChoice: (sceneId, choiceId) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const newChoices = scene.choices.filter(item => item.id !== choiceId);
            return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, choices: newChoices } } };
        }),
        startLinking: (sceneId, itemId, type) => updateActiveStory(story => ({ ...story, linkingState: { active: true, sourceSceneId: sceneId, sourceItemId: itemId, sourceType: type } }), false),
        cancelLinking: () => updateActiveStory(story => ({ ...story, linkingState: { active: false } }), false),
        addVariable: (variableName) => updateActiveStory(story => {
            const trimmedName = variableName.trim();
            if (trimmedName && !story.variables.some(v => v.name === trimmedName)) {
                const newVariable = { name: trimmedName, type: 'Text', value: '' };
                const newVariables = [...story.variables, newVariable].sort((a, b) => a.name.localeCompare(b.name));
                return { ...story, variables: newVariables };
            }
            return story;
        }),
        updateVariable: (variableName, data) => updateActiveStory(story => {
            const newVariables = story.variables.map(v => {
                if (v.name === variableName) {
                    const updatedVar = { ...v, ...data };
                    if (data.type && data.type !== v.type) {
                        switch (data.type) {
                            case 'Number': updatedVar.value = 0; break;
                            case 'Boolean': updatedVar.value = false; break;
                            case 'Text':
                            default: updatedVar.value = ''; break;
                        }
                    }
                    return updatedVar;
                }
                return v;
            });
            return { ...story, variables: newVariables };
        }),
        removeVariable: (variableName) => updateActiveStory(story => {
            const newScenes = { ...story.scenes };
            for (const sceneId in newScenes) {
                const scene = newScenes[sceneId];
                scene.choices.forEach(choice => {
                    choice.conditions = choice.conditions.filter(cond => !(cond.type === 'variable' && cond.variable === variableName));
                });
            }
            return { ...story, variables: story.variables.filter(v => v.name !== variableName), scenes: newScenes };
        }),

        // --- Character State Management ---
        addCharacterState: (stateName) => updateActiveStory(story => {
            const trimmedName = stateName.trim();
            if (trimmedName && !(story.characterStates || []).includes(trimmedName)) {
                const newStates = [...(story.characterStates || []), trimmedName].sort();
                notifications.add(`'${trimmedName}' 상태를 추가했습니다.`, 'success');
                return { ...story, characterStates: newStates };
            }
            notifications.add('상태 이름이 비어있거나 이미 존재합니다.', 'warning');
            return story;
        }),
        renameCharacterState: (oldName, newName) => updateActiveStory(story => {
            const trimmedNewName = newName.trim();
            if (!trimmedNewName || (story.characterStates || []).includes(trimmedNewName)) {
                notifications.add('새 상태 이름이 비어있거나 이미 존재합니다.', 'warning');
                return story;
            }

            const newCharacterStates = (story.characterStates || []).map(s => s === oldName ? trimmedNewName : s).sort();
            const newIncapacitatedStates = (story.incapacitatedStates || []).map(s => s === oldName ? trimmedNewName : s).sort();

            const newScenes = JSON.parse(JSON.stringify(story.scenes));
            for (const scene of Object.values(newScenes)) {
                (scene.content || []).forEach(item => {
                    (item.actions || []).forEach(action => {
                        if (action.type === 'characterState' && action.state === oldName) {
                            action.state = trimmedNewName;
                        }
                    });
                });
                (scene.choices || []).forEach(choice => {
                    (choice.conditions || []).forEach(cond => {
                        if (cond.type === 'characterState' && cond.value === oldName) {
                            cond.value = trimmedNewName;
                        }
                    });
                    (choice.actions || []).forEach(action => {
                        if (action.type === 'characterState' && action.state === oldName) {
                            action.state = trimmedNewName;
                        }
                    });
                });
            }

            notifications.add(`'${oldName}' 상태를 '${trimmedNewName}'(으)로 변경했습니다.`, 'success');
            return { ...story, scenes: newScenes, characterStates: newCharacterStates, incapacitatedStates: newIncapacitatedStates };
        }),
        deleteCharacterState: (stateName) => updateActiveStory(story => {
            const newCharacterStates = (story.characterStates || []).filter(s => s !== stateName);
            const newIncapacitatedStates = (story.incapacitatedStates || []).filter(s => s !== stateName);

            const newScenes = JSON.parse(JSON.stringify(story.scenes));
            for (const scene of Object.values(newScenes)) {
                (scene.content || []).forEach(item => {
                    if (item.actions) {
                        item.actions = item.actions.filter(action => !(action.type === 'characterState' && action.state === stateName));
                    }
                });
                (scene.choices || []).forEach(choice => {
                    if (choice.conditions) {
                        choice.conditions = choice.conditions.filter(cond => !(cond.type === 'characterState' && cond.value === stateName));
                    }
                    if (choice.actions) {
                        choice.actions = choice.actions.filter(action => !(action.type === 'characterState' && action.state === stateName));
                    }
                });
            }

            notifications.add(`'${stateName}' 상태를 삭제했습니다.`, 'info');
            return { ...story, scenes: newScenes, characterStates: newCharacterStates, incapacitatedStates: newIncapacitatedStates };
        }),

        addCondition: (sceneId, choiceId) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const defaultVarName = story.variables.length > 0 ? story.variables[0].name : '';
            const newCondition = { id: createUniqueId('cond'), type: 'variable', variable: defaultVarName, operator: '==', value: '', characterId: null, attribute: null };
            const newChoices = scene.choices.map(c => c.id === choiceId ? { ...c, conditions: [...c.conditions, newCondition] } : c);
            return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, choices: newChoices } } };
        }),
        updateCondition: (sceneId, choiceId, conditionId, data, record = true) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const newChoices = scene.choices.map(c => {
                if (c.id === choiceId) {
                    c.conditions = c.conditions.map(cond => cond.id === conditionId ? { ...cond, ...data } : cond);
                }
                return c;
            });
            return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, choices: newChoices } } };
        }, record),
        removeCondition: (sceneId, choiceId, conditionId) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const newChoices = scene.choices.map(c => {
                if (c.id === choiceId) c.conditions = c.conditions.filter(cond => cond.id !== conditionId);
                return c;
            });
            return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, choices: newChoices } } };
        }),
        addAction: (sceneId, itemId, itemType) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const defaultVarName = story.variables.length > 0 ? story.variables[0].name : '';
            const newAction = {
                id: createUniqueId('action'),
                type: 'variable', // Always default to variable to be safe
                variable: defaultVarName,
                operator: '=',
                value: '',
                characterId: null,
                attribute: null,
                state: null
            };

            if (itemType === 'choice') {
                const newChoices = scene.choices.map(c => c.id === itemId ? { ...c, actions: [...(c.actions || []), newAction] } : c);
                return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, choices: newChoices } } };
            } else if (itemType === 'dialogue') {
                const newContent = scene.content.map(d => d.id === itemId ? { ...d, actions: [...(d.actions || []), newAction] } : d);
                return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, content: newContent } } };
            }
            return story;
        }),
        updateAction: (sceneId, itemId, itemType, actionId, data, record = true) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const updater = item => {
                if (item.id === itemId) {
                    item.actions = (item.actions || []).map(act => {
                        if (act.id === actionId) {
                            const updatedAction = { ...act, ...data };
                            // Reset irrelevant fields when type changes
                            if (data.type && data.type !== act.type) {
                                if (data.type === 'variable') {
                                    updatedAction.characterId = null;
                                    updatedAction.attribute = null;
                                    updatedAction.state = null;
                                    updatedAction.variable = story.variables[0]?.name || '';
                                } else if (data.type === 'characterAttribute') {
                                    updatedAction.variable = null;
                                    updatedAction.state = null;
                                    const charWithAttrs = story.characters.find(c => c.attributes && Object.keys(c.attributes).length > 0) || story.characters.find(c => c.name !== '나레이션') || story.characters[0];
                                    updatedAction.characterId = charWithAttrs?.id || null;
                                    updatedAction.attribute = (charWithAttrs && Object.keys(charWithAttrs.attributes).length > 0) ? Object.keys(charWithAttrs.attributes)[0] : '';
                                } else if (data.type === 'characterState') {
                                    updatedAction.variable = null;
                                    updatedAction.attribute = null;
                                    const targetChar = story.characters.find(c => c.name !== '나레이션') || story.characters[0];
                                    updatedAction.characterId = targetChar?.id || null;
                                    updatedAction.state = '';
                                    updatedAction.operator = '+='; // Default for states
                                } else if (data.type === 'sprite') {
                                    updatedAction.variable = null;
                                    updatedAction.attribute = null;
                                    updatedAction.state = null;
                                    updatedAction.operator = null;
                                    updatedAction.value = null;

                                    const charWithSprites = story.characters.find(c => c.sprites && c.sprites.length > 0);
                                    updatedAction.characterId = charWithSprites?.id || null;

                                    const characterForSprite = updatedAction.characterId ? story.characters.find(c => c.id === updatedAction.characterId) : null;

                                    updatedAction.command = 'show';
                                    updatedAction.spriteId = (characterForSprite && characterForSprite.sprites && characterForSprite.sprites.length > 0)
                                        ? characterForSprite.sprites[0].id
                                        : null;
                                    updatedAction.position = 'center';
                                } else if (data.type === 'variableRandom') {
                                    updatedAction.characterId = null;
                                    updatedAction.attribute = null;
                                    updatedAction.state = null;
                                    updatedAction.operator = null;
                                    updatedAction.value = null;
                                    updatedAction.command = null;
                                    updatedAction.spriteId = null;
                                    updatedAction.position = null;

                                    updatedAction.variable = story.variables.find(v => v.type === 'Number')?.name || '';
                                    updatedAction.min = data.min !== undefined ? data.min : 1;
                                    updatedAction.max = data.max !== undefined ? data.max : 10;
                                } else if (data.type === 'variableDice') {
                                    updatedAction.characterId = null;
                                    updatedAction.attribute = null;
                                    updatedAction.state = null;
                                    updatedAction.operator = null;
                                    updatedAction.value = null;
                                    updatedAction.command = null;
                                    updatedAction.spriteId = null;
                                    updatedAction.position = null;

                                    updatedAction.variable = story.variables.find(v => v.type === 'Number')?.name || '';
                                    updatedAction.diceCount = data.diceCount !== undefined ? data.diceCount : 1;
                                    updatedAction.diceSides = data.diceSides !== undefined ? data.diceSides : 6;
                                }
                            }

                            // MIMINYAN: Add new state to global list
                            if (updatedAction.type === 'characterState' && data.state) {
                                const newState = data.state.trim();
                                if (newState && !(story.characterStates || []).includes(newState)) {
                                    story.characterStates = [...(story.characterStates || []), newState].sort();
                                }
                            }

                            return updatedAction;
                        }
                        return act;
                    });
                }
                return item;
            };

            if (itemType === 'choice') {
                const newChoices = scene.choices.map(updater);
                return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, choices: newChoices } } };
            } else if (itemType === 'dialogue') {
                const newContent = scene.content.map(updater);
                return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, content: newContent } } };
            }
            return story;
        }, record),
        removeAction: (sceneId, itemId, itemType, actionId) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            const updater = item => {
                if (item.id === itemId) {
                    item.actions = (item.actions || []).filter(act => act.id !== actionId);
                }
                return item;
            };
            if (itemType === 'choice') {
                const newChoices = scene.choices.map(updater);
                return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, choices: newChoices } } };
            } else if (itemType === 'dialogue') {
                const newContent = scene.content.map(updater);
                return { ...story, scenes: { ...story.scenes, [sceneId]: { ...scene, content: newContent } } };
            }
            return story;
        }),
        addStoryline: (name) => updateActiveStory(story => {
            const trimmedName = name ? name.trim() : '';
            if (!trimmedName) {
                notifications.add('스토리라인 이름을 입력해야 합니다.', 'warning');
                return story;
            }
            if (story.storylines.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
                notifications.add('이미 있는 스토리라인 이름입니다.', 'warning');
                return story;
            }
            const newStoryline = {
                id: createUniqueId('storyline'),
                name: trimmedName,
                nodes: []
            };
            notifications.add(`'${trimmedName}' 스토리라인을 만들었습니다.`, 'success');
            return { ...story, storylines: [...story.storylines, newStoryline] };
        }),
        removeStoryline: (storylineId) => updateActiveStory(story => {
            return { ...story, storylines: story.storylines.filter(sl => sl.id !== storylineId) };
        }),
        updateStoryline: (storylineId, data) => updateActiveStory(story => {
            return {
                ...story,
                storylines: story.storylines.map(sl => sl.id === storylineId ? { ...sl, ...data } : sl)
            };
        }),
        toggleSceneInStoryline: (storylineId, sceneId) => updateActiveStory(story => {
            const newStorylines = story.storylines.map(sl => {
                if (sl.id === storylineId) {
                    const nodeIndex = sl.nodes.indexOf(sceneId);
                    if (nodeIndex > -1) {
                        return { ...sl, nodes: sl.nodes.filter(id => id !== sceneId) };
                    } else {
                        return { ...sl, nodes: [...sl.nodes, sceneId] };
                    }
                }
                return sl;
            });
            return { ...story, storylines: newStorylines };
        }, false),
        reorderStorylines: (oldIndex, newIndex) => updateActiveStory(story => {
            const newStorylines = [...story.storylines];
            const [removed] = newStorylines.splice(oldIndex, 1);
            newStorylines.splice(newIndex, 0, removed);
            return { ...story, storylines: newStorylines };
        }),

        // --- Sequence Management ---
        addSequence: (position) => updateActiveStory(story => {
            const newId = createUniqueId('seq');
            const newSequence = {
                id: newId,
                name: '새 시퀀스',
                scenes: [],
                color: 'rgba(108, 117, 125, 0.1)',
                position // Store position for empty sequences
            };
            return { ...story, sequences: { ...story.sequences, [newId]: newSequence } };
        }),
        updateSequence: (sequenceId, data) => updateActiveStory(story => {
            const targetSequence = story.sequences[sequenceId];
            if (targetSequence) {
                const updatedSequence = { ...targetSequence, ...data };
                return { ...story, sequences: { ...story.sequences, [sequenceId]: updatedSequence } };
            }
            return story;
        }),
        removeSequence: (sequenceId) => updateActiveStory(story => {
            const newSequences = { ...story.sequences };
            delete newSequences[sequenceId];
            return { ...story, sequences: newSequences };
        }),
        addSceneToSequence: (sequenceId, sceneId) => updateActiveStory(story => {
            const newSequences = { ...story.sequences };
            // First, remove the scene from any other sequence it might be in
            for (const seq of Object.values(newSequences)) {
                const sceneIndex = seq.scenes.indexOf(sceneId);
                if (sceneIndex > -1) {
                    seq.scenes.splice(sceneIndex, 1);
                }
            }
            // Then, add it to the target sequence
            const targetSequence = newSequences[sequenceId];
            if (targetSequence && !targetSequence.scenes.includes(sceneId)) {
                targetSequence.scenes.push(sceneId);
            }
            return { ...story, sequences: newSequences };
        }),
        removeSceneFromSequence: (sceneId) => updateActiveStory(story => {
            const newSequences = { ...story.sequences };
            for (const seq of Object.values(newSequences)) {
                const sceneIndex = seq.scenes.indexOf(sceneId);
                if (sceneIndex > -1) {
                    seq.scenes.splice(sceneIndex, 1);
                    break; // Assume a scene can only be in one sequence
                }
            }
            return { ...story, sequences: newSequences };
        }),

        // --- Plot Thread Management ---
        addPlotThread: (name) => updateActiveStory(story => {
            const trimmedName = name.trim();
            if (!trimmedName || story.plotThreads.some(pt => pt.name === trimmedName)) {
                notifications.add('이름이 비어있거나 이미 존재하는 플롯 스레드입니다.', 'warning');
                return story;
            }
            const newPlotThread = {
                id: createUniqueId('plot'),
                name: trimmedName,
                color: getColorFromString(trimmedName)
            };
            return { ...story, plotThreads: [...story.plotThreads, newPlotThread] };
        }),
        updatePlotThread: (id, data) => updateActiveStory(story => {
            return {
                ...story,
                plotThreads: story.plotThreads.map(pt => pt.id === id ? { ...pt, ...data } : pt)
            };
        }),
        removePlotThread: (id) => updateActiveStory(story => {
            const newPlotThreads = story.plotThreads.filter(pt => pt.id !== id);
            const newScenes = { ...story.scenes };
            Object.values(newScenes).forEach(scene => {
                scene.plotThreadIds = scene.plotThreadIds.filter(ptId => ptId !== id);
            });
            return { ...story, plotThreads: newPlotThreads, scenes: newScenes };
        }),
        toggleScenePlotThread: (sceneId, plotThreadId) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            if (!scene) return story;

            const index = scene.plotThreadIds.indexOf(plotThreadId);
            let newPlotThreadIds;

            if (index > -1) {
                newPlotThreadIds = scene.plotThreadIds.filter(id => id !== plotThreadId);
            } else {
                newPlotThreadIds = [...scene.plotThreadIds, plotThreadId];
            }

            return {
                ...story,
                scenes: {
                    ...story.scenes,
                    [sceneId]: { ...scene, plotThreadIds: newPlotThreadIds }
                }
            };
        }, false),

        toggleSceneReference: (sceneId, wikiItemId) => updateActiveStory(story => {
            const scene = story.scenes[sceneId];
            if (!scene) return story;

            const refs = scene.referencedWikiIds || [];
            let newRefs;

            if (refs.includes(wikiItemId)) {
                newRefs = refs.filter(id => id !== wikiItemId);
            } else {
                newRefs = [...refs, wikiItemId];
            }

            return {
                ...story,
                scenes: {
                    ...story.scenes,
                    [sceneId]: { ...scene, referencedWikiIds: newRefs }
                }
            };
        }, false),

        // --- Map Management ---
        setMapBackground: (filePath) => updateActiveStory(story => {
            return { ...story, mapData: { ...(story.mapData || {}), background: filePath } };
        }),
        addMapMarker: (wikiId, x, y) => updateActiveStory(story => {
            const currentMarkers = (story.mapData?.markers || []);
            // Check if marker for this wikiId already exists
            if (currentMarkers.some(m => m.wikiId === wikiId)) return story;

            const newMarker = {
                id: createUniqueId('marker'),
                wikiId,
                x,
                y
            };
            return {
                ...story,
                mapData: {
                    ...(story.mapData || {}),
                    markers: [...currentMarkers, newMarker]
                }
            };
        }),
        updateMapMarker: (markerId, data) => updateActiveStory(story => {
            const markers = (story.mapData?.markers || []).map(m =>
                m.id === markerId ? { ...m, ...data } : m
            );
            return { ...story, mapData: { ...(story.mapData || {}), markers } };
        }),
        removeMapMarker: (markerId) => updateActiveStory(story => {
            const markers = (story.mapData?.markers || []).filter(m => m.id !== markerId);
            return { ...story, mapData: { ...(story.mapData || {}), markers } };
        }),

        // --- MIMINYAN: Goal Management Actions ---
        setWordCountGoal: (target) => updateActiveStory(story => {
            const newGoals = {
                ...story.goals,
                dailyWordCount: {
                    ...story.goals.dailyWordCount,
                    target: Math.max(0, target) // Ensure target is not negative
                }
            };
            notifications.add(`일일 목표가 ${target} 단어로 설정되었습니다.`, 'success');
            return { ...story, goals: newGoals };
        }),
        updateWritingStats: () => updateActiveStory(story => {
            let totalWordCount = 0;
            for (const scene of Object.values(story.scenes)) {
                for (const item of scene.content) {
                    if (item.text) {
                        totalWordCount += item.text.split(/\s+/).filter(Boolean).length;
                    }
                }
            }
            const newGoals = {
                ...story.goals,
                dailyWordCount: {
                    ...story.goals.dailyWordCount,
                    current: totalWordCount
                }
            };
            return { ...story, goals: newGoals };
        }, false), // Do not record history for stat updates


        // --- Wiki Group Management ---
        addGroup: (type, name) => updateActiveStory(story => {
            const trimmedName = name.trim();
            if (!trimmedName) return story;

            const categoryMap = {
                character: 'characterCategories',
                dictionary: 'dictionaryCategories',
                location: 'locationCategories',
                item: 'itemCategories',
                creature: 'creatureCategories',
                group: 'groupCategories',
                lore: 'loreCategories'
            };
            const field = categoryMap[type];

            // Safety check: ensure the category array exists
            if (field && !story[field]) {
                story[field] = [];
            }

            if (field && !story[field].includes(trimmedName)) {
                return { ...story, [field]: [...story[field], trimmedName] };
            }
            return story;
        }),
        renameGroup: (type, oldName, newName) => updateActiveStory(story => {
            const trimmedNewName = newName.trim();
            if (!trimmedNewName) return story;

            const categoryMap = {
                character: 'characterCategories',
                dictionary: 'dictionaryCategories',
                location: 'locationCategories',
                item: 'itemCategories',
                creature: 'creatureCategories',
                group: 'groupCategories',
                lore: 'loreCategories'
            };
            const itemMap = {
                character: 'characters',
                dictionary: 'dictionary',
                location: 'locations',
                item: 'items',
                creature: 'creatures',
                group: 'groups',
                lore: 'dictionary'
            };

            const catField = categoryMap[type];
            const itemField = itemMap[type];

            if (catField && itemField && story[catField] && story[itemField]) {
                // 1. Update Categories List
                const newCategories = story[catField].map(cat => {
                    if (cat === oldName) return trimmedNewName;
                    if (cat.startsWith(oldName + '/')) {
                        return trimmedNewName + cat.substring(oldName.length);
                    }
                    return cat;
                });

                // 2. Update Items' Category Field
                const newItems = story[itemField].map(item => {
                    if (item.category === oldName) {
                        return { ...item, category: trimmedNewName };
                    }
                    if (item.category && item.category.startsWith(oldName + '/')) {
                        return { ...item, category: trimmedNewName + item.category.substring(oldName.length) };
                    }
                    return item;
                });
                return { ...story, [itemField]: newItems, [catField]: newCategories };
            }
            return story;
        }),
        deleteGroup: (type, groupName) => updateActiveStory(story => {
            const categoryMap = {
                character: 'characterCategories',
                dictionary: 'dictionaryCategories',
                location: 'locationCategories',
                item: 'itemCategories',
                creature: 'creatureCategories',
                group: 'groupCategories',
                lore: 'loreCategories'
            };
            const itemMap = {
                character: 'characters',
                dictionary: 'dictionary',
                location: 'locations',
                item: 'items',
                creature: 'creatures',
                group: 'groups',
                lore: 'dictionary'
            };

            const catField = categoryMap[type];
            const itemField = itemMap[type];

            if (catField && itemField && story[catField] && story[itemField]) {
                // 1. Remove Category and Subcategories
                const newCategories = story[catField].filter(cat => cat !== groupName && !cat.startsWith(groupName + '/')
                );

                // 2. Reset Items' Category to null (Move to Uncategorized)
                const newItems = story[itemField].map(item => {
                    if (item.category === groupName || (item.category && item.category.startsWith(groupName + '/'))) {
                        return { ...item, category: null };
                    }
                    return item;
                });
                return { ...story, [itemField]: newItems, [catField]: newCategories };
            }
            return story;
        }),
        moveCategory: (type, sourcePath, targetParentPath) => updateActiveStory(story => {
            // sourcePath: "Equipment/Sword"
            // targetParentPath: "Items" (Move Sword into Items) -> "Items/Sword"
            // targetParentPath: null (Move Sword to Root) -> "Sword"

            if (sourcePath === targetParentPath) return story; // Can't move to self
            if (targetParentPath && targetParentPath.startsWith(sourcePath + '/')) return story; // Can't move into own child (circular)
            if (targetParentPath && targetParentPath === sourcePath) return story;

            const categoryMap = {
                character: 'characterCategories',
                dictionary: 'dictionaryCategories',
                location: 'locationCategories',
                item: 'itemCategories',
                creature: 'creatureCategories',
                group: 'groupCategories',
                lore: 'loreCategories'
            };
            const itemMap = {
                character: 'characters',
                dictionary: 'dictionary',
                location: 'locations',
                item: 'items',
                creature: 'creatures',
                group: 'groups',
                lore: 'dictionary'
            };

            const catField = categoryMap[type];
            const itemField = itemMap[type];

            if (catField && itemField && story[catField] && story[itemField]) {
                const folderName = sourcePath.split('/').pop();
                const newPathBase = targetParentPath ? `${targetParentPath}/${folderName}` : folderName;

                // 1. Update Categories List
                const newCategories = story[catField].map(cat => {
                    if (cat === sourcePath) return newPathBase;
                    if (cat.startsWith(sourcePath + '/')) {
                        return newPathBase + cat.substring(sourcePath.length);
                    }
                    return cat;
                });

                // 2. Update Items' Category Field
                const newItems = story[itemField].map(item => {
                    if (item.category === sourcePath) {
                        return { ...item, category: newPathBase };
                    }
                    if (item.category && item.category.startsWith(sourcePath + '/')) {
                        return { ...item, category: newPathBase + item.category.substring(sourcePath.length) };
                    }
                    return item;
                });

                return { ...story, [itemField]: newItems, [catField]: newCategories };
            }
            return story;
        }),
        reorderCategories: (type, orderedCategories) => updateActiveStory(story => {
            const categoryMap = {
                character: 'characterCategories',
                dictionary: 'dictionaryCategories',
                location: 'locationCategories',
                item: 'itemCategories',
                creature: 'creatureCategories',
                group: 'groupCategories',
                lore: 'loreCategories'
            };
            const field = categoryMap[type];
            if (field && story[field]) {
                return { ...story, [field]: orderedCategories };
            }
            return story;
        }),

        // --- Wiki Item Management (Locations, Items, Groups) ---
        createWikiItem: (type, data) => updateActiveStory(story => {
            const itemMap = {
                location: 'locations',
                item: 'items',
                creature: 'creatures',
                group: 'groups',
                lore: 'dictionary'
            };
            const field = itemMap[type];
            if (!field) return story;

            const trimmedName = data.name ? data.name.trim() : '';
            if (!trimmedName) return story;

            // Check for duplicates
            if (story[field].some(e => (e.name || e.term) === trimmedName)) {
                notifications.add('이미 존재하는 이름입니다.', 'warning');
                return story;
            }

            const newItem = {
                id: createUniqueId(type),
                name: trimmedName,
                term: trimmedName, // For dictionary compatibility
                description: data.description || '',
                definition: data.definition || '',
                tags: [],
                image: null,
                category: data.category || null,
                aliases: [],
                relatedWikiIds: [],
                isAffiliation: type === 'group', // Default true for groups
                isFavorite: false,
                sortOrder: story[field].length > 0 ? Math.max(...story[field].map(i => i.sortOrder || 0)) + 1 : 0
            };

            const newItems = [...story[field], newItem].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            notifications.add(`'${trimmedName}' 항목이 생성되었습니다.`, 'success');
            return { ...story, [field]: newItems };
        }),

        addWikiItem: (type, name, category = null) => updateActiveStory(story => {
            const trimmedName = name.trim();
            if (!trimmedName) return story;

            const itemMap = {
                location: 'locations',
                item: 'items',
                creature: 'creatures',
                group: 'groups',
                lore: 'dictionary' // Treat lore as dictionary for now
            };
            const field = itemMap[type];
            if (!field) return story;

            if (!story[field].some(e => e.name === trimmedName || e.term === trimmedName)) {
                const newItem = {
                    id: createUniqueId(type),
                    name: trimmedName, // Unified name field (dictionary uses 'term' but we can migrate or handle both)
                    term: trimmedName, // For backward compatibility with dictionary
                    description: '',
                    definition: '', // For backward compatibility
                    tags: [],
                    image: null, // New: Image for card view
                    category: category,
                    aliases: [],
                    relatedWikiIds: [], // New: Links to other wiki items
                    linkedAnnotationId: null,
                    isAffiliation: type === 'group', // Groups can be affiliations
                    isFavorite: false,
                    sortOrder: story[field].length > 0 ? Math.max(...story[field].map(i => i.sortOrder || 0)) + 1 : 0
                };
                const newItems = [...story[field], newItem].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                return { ...story, [field]: newItems };
            }
            return story;
        }),
        updateWikiItem: (type, id, data) => updateActiveStory(story => {
            const itemMap = {
                location: 'locations',
                item: 'items',
                creature: 'creatures',
                group: 'groups',
                lore: 'dictionary'
            };
            const field = itemMap[type];
            if (!field) return story;

            const newItems = story[field].map(item => {
                if (item.id === id) {
                    // Sync name and term for compatibility
                    if (data.name) data.term = data.name;
                    if (data.term) data.name = data.term;
                    return { ...item, ...data };
                }
                return item;
            });

            // Only sort if sortOrder is explicitly changed in data (which usually happens via reorderWikiItems, but just in case)
            if (data.sortOrder !== undefined) {
                newItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            }

            return { ...story, [field]: newItems };
        }),
        removeWikiItem: (type, id) => updateActiveStory(story => {
            const itemMap = {
                location: 'locations',
                item: 'items',
                creature: 'creatures',
                group: 'groups',
                lore: 'dictionary'
            };
            const field = itemMap[type];
            if (!field) return story;

            const newItems = story[field].filter(item => item.id !== id);
            return { ...story, [field]: newItems };
        }),
        toggleWikiItemFavorite: (type, id) => updateActiveStory(story => {
            const itemMap = {
                location: 'locations',
                item: 'items',
                creature: 'creatures',
                group: 'groups',
                lore: 'dictionary'
            };
            const field = itemMap[type];
            if (!field) return story;

            const newItems = story[field].map(item =>
                item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
            );
            return { ...story, [field]: newItems };
        }),

        // --- History (Chronology) Management ---
        addHistoryEra: (name) => updateActiveStory(story => {
            const trimmedName = name.trim();
            if (!trimmedName) return story;
            const newEra = {
                id: createUniqueId('era'),
                name: trimmedName,
                description: '',
                color: getColorFromString(trimmedName),
                order: (story.history.eras.length + 1) * 10
            };
            return { ...story, history: { ...story.history, eras: [...story.history.eras, newEra] } };
        }),
        updateHistoryEra: (id, data) => updateActiveStory(story => {
            const newEras = story.history.eras.map(e => e.id === id ? { ...e, ...data } : e);
            // Sort by order if order changed
            if (data.order !== undefined) {
                newEras.sort((a, b) => a.order - b.order);
            }
            return { ...story, history: { ...story.history, eras: newEras } };
        }),
        removeHistoryEra: (id) => updateActiveStory(story => {
            const newEras = story.history.eras.filter(e => e.id !== id);
            // Move events in this era to no era (null)
            const newEvents = story.history.events.map(ev => ev.eraId === id ? { ...ev, eraId: null } : ev);
            return { ...story, history: { ...story.history, eras: newEras, events: newEvents } };
        }),
        reorderHistoryEras: (orderedIds) => updateActiveStory(story => {
            const newEras = story.history.eras.map(era => {
                const newIndex = orderedIds.indexOf(era.id);
                if (newIndex !== -1) {
                    return { ...era, order: (newIndex + 1) * 10 }; // Keep 10, 20, 30... spacing logic
                }
                return era;
            });
            newEras.sort((a, b) => a.order - b.order);
            return { ...story, history: { ...story.history, eras: newEras } };
        }),
        reorderHistoryEvents: (orderedIds) => updateActiveStory(story => {
            const newEvents = story.history.events.map(ev => {
                const newIndex = orderedIds.indexOf(ev.id);
                if (newIndex !== -1) {
                    return { ...ev, sortOrder: (newIndex + 1) * 10 };
                }
                return ev;
            });
            newEvents.sort((a, b) => a.sortOrder - b.sortOrder);
            return { ...story, history: { ...story.history, events: newEvents } };
        }),
        addHistoryEvent: (title, eraId = null) => updateActiveStory(story => {
            const trimmedTitle = title.trim();
            if (!trimmedTitle) return story;
            const newEvent = {
                id: createUniqueId('event'),
                title: trimmedTitle,
                description: '',
                displayDate: '???', // Text representation of date
                sortOrder: (story.history.events.length + 1) * 10,
                eraId: eraId, // Use passed eraId
                type: 'generic', // generic, war, political, birth, death
                relatedWikiIds: []
            };
            return { ...story, history: { ...story.history, events: [...story.history.events, newEvent] } };
        }),
        updateHistoryEvent: (id, data) => updateActiveStory(story => {
            const newEvents = story.history.events.map(e => e.id === id ? { ...e, ...data } : e);
            if (data.sortOrder !== undefined) {
                newEvents.sort((a, b) => a.sortOrder - b.sortOrder);
            }
            return { ...story, history: { ...story.history, events: newEvents } };
        }),
        removeHistoryEvent: (id) => updateActiveStory(story => {
            const newEvents = story.history.events.filter(e => e.id !== id);
            return { ...story, history: { ...story.history, events: newEvents } };
        }),

        // --- Dictionary ---
        addDictionaryEntry: (term, definition = '', category = null) => updateActiveStory(story => {
            const trimmedTerm = term.trim();
            if (trimmedTerm && !story.dictionary.some(e => e.term.toLowerCase() === trimmedTerm.toLowerCase())) {
                const newEntry = {
                    id: uuidv4(),
                    term: trimmedTerm,
                    definition: definition,
                    tags: [],
                    linkedAnnotationId: null, // Add this line
                    isAffiliation: false, // Designates if it can be used as a character affiliation
                    category: category,
                    aliases: [],
                    sortOrder: story.dictionary.length > 0 ? Math.max(...story.dictionary.map(d => d.sortOrder || 0)) + 1 : 0
                };
                const newDictionary = [...story.dictionary, newEntry].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                return { ...story, dictionary: newDictionary };
            }
            return story;
        }),
        updateDictionaryEntry: (entryId, data) => updateActiveStory(story => {
            const newDictionary = story.dictionary.map(entry => {
                if (entry.id === entryId) {
                    return { ...entry, ...data };
                }
                return entry;
            });

            if (data.sortOrder !== undefined) {
                newDictionary.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            }
            return { ...story, dictionary: newDictionary };
        }),
        removeDictionaryEntry: (entryId) => updateActiveStory(story => {
            const newDictionary = story.dictionary.filter(entry => entry.id !== entryId);
            return { ...story, dictionary: newDictionary };
        }),

        createWikiFromAnnotation: (type, name, annotationId) => updateActiveStory(story => {
            const trimmedName = name.trim();
            if (!trimmedName) return story;

            let newId, field, newItem;

            if (type === 'character') {
                newId = createUniqueId('char');
                field = 'characters';
                newItem = {
                    id: newId, name: trimmedName, description: '', profileImage: '',
                    relationships: [], attributes: {}, customLists: [], affiliation: null, color: getColorFromString(trimmedName), category: null,
                    aliases: [], narrative: { goal: '', motivation: '', conflict: '', flaw: '', lie: '' }, voice: { tone: '', habit: '', keywords: '' },
                    linkedAnnotationId: annotationId,
                    sortOrder: story.characters.length > 0 ? Math.max(...story.characters.map(c => c.sortOrder || 0)) + 1 : 0
                };
            } else if (type === 'lore' || type === 'dictionary') {
                newId = uuidv4();
                field = 'dictionary';
                newItem = {
                    id: newId, term: trimmedName, definition: '', tags: [],
                    linkedAnnotationId: annotationId, category: null, aliases: [],
                    sortOrder: story.dictionary.length > 0 ? Math.max(...story.dictionary.map(d => d.sortOrder || 0)) + 1 : 0
                };
            } else {
                field = type + 's'; // locations, items, groups
                newId = createUniqueId(type);
                newItem = {
                    id: newId, name: trimmedName, term: trimmedName, description: '', definition: '', tags: [],
                    linkedAnnotationId: annotationId, category: null, aliases: [], relatedWikiIds: [], image: null,
                    isAffiliation: type === 'group',
                    sortOrder: story[field].length > 0 ? Math.max(...story[field].map(i => i.sortOrder || 0)) + 1 : 0
                };
            }

            const newList = [...story[field], newItem].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            notifications.add(`'${trimmedName}' 위키 항목이 생성되었습니다.`, 'success');
            return { ...story, [field]: newList };
        }),

        updateViewTransform: (transform) => updateActiveStory(story => ({ ...story, viewTransform: { ...story.viewTransform, ...transform } }), false),
        exportProjectData: () => {
            let project;
            activeProject.subscribe(v => project = v)();
            if (!project) { notifications.add('활성화된 프로젝트가 없습니다.', 'warning'); return; }
            const { name, story } = project;
            const exportData = {
                projectName: name, exportVersion: '1.0.0', startSceneId: 'start',
                scenes: Object.fromEntries(Object.entries(story.scenes).map(([id, scene]) => [id, {
                    name: scene.name,
                    dialogues: scene.content.filter(item => item.type === 'dialogue').map(({ character, text, actions }) => ({
                        character, text,
                        actions: (actions || []).map(({ id, type, variable, characterId, attribute, state, operator, value }) => ({ id, type, variable, characterId, attribute, state, operator, value }))
                    })),
                    choices: scene.choices.map(({ text, targetSceneId, conditions, actions }) => ({
                        text, targetSceneId: targetSceneId || null,
                        conditions: (conditions || []).map(({ id, type, variable, characterId, attribute, operator, value }) => ({ id, type, variable, characterId, attribute, operator, value })),
                        actions: (actions || []).map(({ id, type, variable, characterId, attribute, state, operator, value }) => ({ id, type, variable, characterId, attribute, state, operator, value }))
                    }))
                }])),
                characters: story.characters, variables: story.variables.map(({ name, type, value }) => ({ name, type, value }))
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.story.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        },
        saveProject: async (projectId) => {
            let projectToSave;
            if (projectId) {
                const allProjects = get(projectManager);
                projectToSave = allProjects[projectId];
            } else {
                projectToSave = get(activeProject);
            }

            if (!projectToSave) {
                notifications.add('저장할 프로젝트를 찾지 못했습니다.', 'warning');
                return;
            }

            // Remove history before saving to keep file size down
            const saveData = { ...projectToSave, history: undefined };

            // MIMINYAN: Use storage adapter with Overwrite capability
            const filePath = get(currentFilePath);
            const result = await storage.saveProject(saveData, projectToSave.name, filePath);

            if (result.success) {
                if (result.filePath) {
                    currentFilePath.set(result.filePath);
                }
                notifications.add(`프로젝트가 성공적으로 저장되었습니다.`, 'success');
            } else if (!result.cancelled) {
                notifications.add(`프로젝트 저장에 실패했습니다: ${result.error}`, 'error');
            }
        },
        loadProjectFromFile: async () => {
            // MIMINYAN: Use storage adapter (Note: for web, this might need a different UI trigger like <input type="file">)
            // But let's assume storage.loadProject handles the dialog part or we redirect.
            // Actually, for Web, loadProjectFromFile usually implies "Import".
            // Since storage.loadProject is for internal loading, we need an "Import" method in storage or handle it here.

            // For now, let's keep electronAPI check inside storage.js or here?
            // storage.js handles the switch.

            // Wait, storage.loadProject(id) is for internal load.
            // We need storage.importProject() equivalent.
            // Since I didn't add importProject to storage.js yet, I will add logic here or update storage.js.
            // Let's stick to the current logic for now, but use window.electronAPI only if available.

            if (window.electronAPI) {
                const result = await window.electronAPI.loadProject();
                if (result.success) {
                    uiState.resetProjectSpecificStates();
                    const loadedProject = result.projectData;

                    // Set the current file path for overwrite saving
                    if (result.filePath) {
                        currentFilePath.set(result.filePath);
                    }

                    // ... (rest of the loading logic is common, extract it?) ...

                    // --- Common Loading Logic Start ---
                    if (!loadedProject || !loadedProject.id || !loadedProject.name || !loadedProject.story) {
                        notifications.add('유효하지 않은 프로젝트 파일입니다.', 'error');
                        return;
                    }
                    loadedProject.id = createUniqueId('proj');
                    if (!loadedProject.history) loadedProject.history = { stack: [loadedProject.story], index: 0 };

                    const baseStory = createNewStory();
                    loadedProject.story = { ...baseStory, ...loadedProject.story };
                    // ... (Deep merge logic omitted for brevity, assume similar to before) ...
                    // To be safe, I should preserve the existing deep merge logic block.
                    // Let's copy the block from the original file.

                    // ... (Original Logic) ...
                    if (!loadedProject.story.settings) loadedProject.story.settings = baseStory.settings;
                    if (!loadedProject.story.assets) loadedProject.story.assets = baseStory.assets;
                    if (!loadedProject.story.dictionary) loadedProject.story.dictionary = [];
                    if (!loadedProject.story.locations) loadedProject.story.locations = [];
                    if (!loadedProject.story.items) loadedProject.story.items = [];
                    if (!loadedProject.story.groups) loadedProject.story.groups = [];
                    if (!loadedProject.story.history) loadedProject.story.history = { eras: [], events: [] };
                    if (!loadedProject.story.locationCategories) loadedProject.story.locationCategories = [];
                    if (!loadedProject.story.itemCategories) loadedProject.story.itemCategories = [];
                    if (!loadedProject.story.groupCategories) loadedProject.story.groupCategories = [];
                    if (!loadedProject.story.loreCategories) loadedProject.story.loreCategories = [];

                    Object.values(loadedProject.story.scenes).forEach(scene => {
                        if (!scene.effects) scene.effects = { bgm: null, sfx: null, background: null };
                    });

                    loadedProject.story.characters = upgradeCharacterData(loadedProject.story.characters);
                    loadedProject.story.characters = recalculateCharacters(loadedProject.story.scenes, loadedProject.story.characters);

                    projectManager.update(projs => ({ ...projs, [loadedProject.id]: loadedProject }));
                    activeProject.set(loadedProject);
                    notifications.add(`"${loadedProject.name}" 프로젝트를 성공적으로 불러왔습니다.`, 'success');
                    // --- Common Loading Logic End ---

                } else if (!result.cancelled) {
                    notifications.add(`프로젝트를 불러오지 못했습니다: ${result.error}`, 'error');
                }
            } else {
                // Web Fallback: Create a hidden file input to trigger upload
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = event => {
                        try {
                            const loadedProject = JSON.parse(event.target.result);
                            // --- Reuse Common Loading Logic ---
                            uiState.resetProjectSpecificStates();

                            if (!loadedProject || !loadedProject.id || !loadedProject.name || !loadedProject.story) {
                                notifications.add('유효하지 않은 프로젝트 파일입니다.', 'error');
                                return;
                            }
                            loadedProject.id = createUniqueId('proj');
                            if (!loadedProject.history) loadedProject.history = { stack: [loadedProject.story], index: 0 };

                            const baseStory = createNewStory();
                            loadedProject.story = { ...baseStory, ...loadedProject.story };

                            if (!loadedProject.story.settings) loadedProject.story.settings = baseStory.settings;
                            if (!loadedProject.story.assets) loadedProject.story.assets = baseStory.assets;
                            if (!loadedProject.story.dictionary) loadedProject.story.dictionary = [];
                            if (!loadedProject.story.locations) loadedProject.story.locations = [];
                            if (!loadedProject.story.items) loadedProject.story.items = [];
                            if (!loadedProject.story.creatures) loadedProject.story.creatures = [];
                            if (!loadedProject.story.groups) loadedProject.story.groups = [];
                            if (!loadedProject.story.history) loadedProject.story.history = { eras: [], events: [] };
                            if (!loadedProject.story.locationCategories) loadedProject.story.locationCategories = [];
                            if (!loadedProject.story.itemCategories) loadedProject.story.itemCategories = [];
                            if (!loadedProject.story.creatureCategories) loadedProject.story.creatureCategories = [];
                            if (!loadedProject.story.groupCategories) loadedProject.story.groupCategories = [];
                            if (!loadedProject.story.loreCategories) loadedProject.story.loreCategories = [];

                            Object.values(loadedProject.story.scenes).forEach(scene => {
                                if (!scene.effects) scene.effects = { bgm: null, sfx: null, background: null };
                            });

                            loadedProject.story.characters = upgradeCharacterData(loadedProject.story.characters);
                            loadedProject.story.characters = recalculateCharacters(loadedProject.story.scenes, loadedProject.story.characters);

                            projectManager.update(projs => ({ ...projs, [loadedProject.id]: loadedProject }));
                            activeProject.set(loadedProject);
                            notifications.add(`"${loadedProject.name}" 프로젝트를 성공적으로 불러왔습니다.`, 'success');
                        } catch (err) {
                            notifications.add('파일을 읽는 중 오류가 발생했습니다.', 'error');
                        }
                    };
                    reader.readAsText(file);
                };
                input.click();
            }
        },
        createProjectFromText: async () => {
            if (window.electronAPI) {
                const result = await window.electronAPI.loadTextFile();
                if (result.success) {
                    uiState.resetProjectSpecificStates();
                    const projectName = result.fileName.replace(/\.(txt|md)$/i, '');
                    const newStory = parseScriptToStory(result.textData);

                    const newProject = {
                        id: createUniqueId('proj'),
                        name: projectName,
                        story: newStory,
                        history: { stack: [newStory], index: 0 }
                    };

                    // MIMINYAN: Run achievement check after creating from text
                    // newProject.story = checkAchievements(newProject.story);

                    projectManager.update(projs => ({ ...projs, [newProject.id]: newProject }));
                    activeProject.set(newProject);
                    notifications.add(`"${projectName}" 프로젝트를 성공적으로 만들었습니다.`, 'success');

                } else if (!result.cancelled) {
                    notifications.add(`텍스트 파일을 불러오지 못했습니다: ${result.error}`, 'error');
                }
            } else {
                notifications.add('Electron API를 사용할 수 없습니다. 개발 모드인지 확인해주세요.', 'error');
            }
        },

        importWikiData: (importedStory) => updateActiveStory(story => {
            let addedCount = 0;
            let skippedCount = 0;

            // Helper to merge lists
            const mergeList = (key, singularType) => {
                const currentList = story[key] || [];
                const newList = [...currentList];
                const incomingList = importedStory[key] || [];

                incomingList.forEach(item => {
                    const name = item.name || item.term;
                    // Check duplicate by name (case insensitive?) Let's be strict for now.
                    if (newList.some(existing => (existing.name || existing.term) === name)) {
                        skippedCount++;
                    } else {
                        // Re-generate ID to avoid conflicts with existing items
                        const newId = createUniqueId(singularType);
                        // Also update linkedAnnotationId if any? No, text import doesn't have that.
                        newList.push({ ...item, id: newId });
                        addedCount++;
                    }
                });
                return newList;
            };

            // Helper to merge categories
            const mergeCats = (key) => {
                const currentCats = story[key] || [];
                const incomingCats = importedStory[key] || [];
                // Create Set for uniqueness
                const set = new Set([...currentCats, ...incomingCats]);
                return Array.from(set);
            };

            const newCharacters = mergeList('characters', 'char');
            const newLocations = mergeList('locations', 'loc');
            const newItems = mergeList('items', 'item');
            const newGroups = mergeList('groups', 'group');
            const newDictionary = mergeList('dictionary', 'lore');

            const newCharCats = mergeCats('characterCategories');
            const newLocCats = mergeCats('locationCategories');
            const newItemCats = mergeCats('itemCategories');
            const newGroupCats = mergeCats('groupCategories');
            const newLoreCats = mergeCats('loreCategories');

            // Post-process: Resolve affiliation names to IDs for characters
            newCharacters.forEach(char => {
                if (char.affiliationName && !char.affiliation) {
                    // Search in groups first
                    const foundGroup = newGroups.find(g => g.name === char.affiliationName);
                    if (foundGroup) {
                        char.affiliation = foundGroup.id;
                    } else {
                        // Search in dictionary (lore)
                        const foundLore = newDictionary.find(d => d.term === char.affiliationName);
                        if (foundLore) {
                            char.affiliation = foundLore.id;
                        }
                    }
                    // Clean up temporary field
                    delete char.affiliationName;
                }
            });

            notifications.add(`${addedCount}개 항목 추가 완료 (중복 ${skippedCount}개 건너뜀)`, 'success');

            return {
                ...story,
                characters: newCharacters,
                locations: newLocations,
                items: newItems,
                groups: newGroups,
                dictionary: newDictionary,
                characterCategories: newCharCats,
                locationCategories: newLocCats,
                itemCategories: newItemCats,
                groupCategories: newGroupCats,
                loreCategories: newLoreCats
            };
        }),

    };
    return actions;
}

export const projectActions = createProjectActionManager();

export const activeStory = derived(activeProject, ($activeProject) => {
    return $activeProject ? $activeProject.story : null;
});

// App Settings
const SETTINGS_STORAGE_KEY = 'storyweaver_settings';

function createSettingsStore() {
    const initialSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    const { subscribe, set, update } = writable(initialSettings);

    return {
        subscribe,
        set,
        update
    };
}
export const settings = createSettingsStore();

export function saveSettings(newSettings) {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    settings.set(newSettings);
}

// ==============================================
//  PROJECT DATA & ACTIONS
// ==============================================

export const theme = createThemeStore();

function createThemeStore() {
    const THEME_STORAGE_KEY = 'storyweaver_theme';
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const { subscribe, set, update } = writable(storedTheme || preferredTheme);
    return {
        subscribe,
        toggleTheme: () => update(current => {
            const newTheme = current === 'light' ? 'dark' : 'light';
            localStorage.setItem(THEME_STORAGE_KEY, newTheme);
            return newTheme;
        }),
        setTheme: (theme) => {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
            set(theme);
        }
    };
}

export const uiState = createUiStateStore();

function createUiStateStore() {
    const { subscribe, update } = writable({
        sidebarWidth: 350,
        isFocusMode: false,
        isSidebarOpen: false, // For mobile view
        isMobileView: false, // For responsive UI
        isDraggingOnCanvas: false, // To prevent auto-save during drag
        isAnalyticsOpen: false,
        isSettingsModalOpen: false,
        isCharacterSheetOpen: false,
        isStorylineViewerOpen: false,
        isStorylineScriptViewerOpen: false, // New state for the script viewer
        storylineIdForScriptViewer: null, // ID of the storyline to view/print
        isAnnotationManagerOpen: false,
        isWikiModalOpen: false,
        isPlotThreadModalOpen: false,
        isGoalSettingModalOpen: false, // MIMINYAN: Add state for the new modal
        isGuideModalOpen: false, // MIMINYAN: Add state for Guide Modal
        isStateManagerOpen: false,
        isProjectModalOpen: false, // New state for Project Modal
        wikiSelectedItemId: null,
        wikiSelectedItemType: null,
        showVariableRangesOnCanvas: false, // <-- New state
        inputModal: { // State for the new InputModal
            isOpen: false,
            title: '',
            message: '',
            initialValue: '',
            onConfirm: () => { }
        },
        editingCharacterId: null,
        highlightedLink: { sourceSceneId: null, sourceChoiceId: null, targetSceneId: null },
        highlightedStorylineId: null,
        highlightedPath: null,
        storylineEditMode: { active: false, storylineId: null },
        activeStorylineId: null,
        activeTaggingPlotThreadId: null, // MIMINYAN: Add state for the new feature
        currentView: 'canvas', // 'canvas' or 'timeline'
        rightSidebar: {
            isOpen: false,
            activeTab: 'context' // 'context', 'customization', 'characters', etc.
        },
        draggedDialogue: null, // To hold { dialogue, sourceSceneId }
        isDraggingOverCanvas: false, // To know if the drop target is the canvas
        widgets: {
            customization: { docked: true, visible: true, collapsed: false, x: 0, y: 0, z: 1 },
            characters: { docked: true, visible: true, collapsed: false, x: 0, y: 0, z: 1 },
            variables: { docked: true, visible: true, collapsed: false, x: 0, y: 0, z: 1 },
            storylines: { docked: true, visible: false, collapsed: false, x: 0, y: 0, z: 1 },
            dialogues: { docked: true, visible: true, collapsed: false, x: 0, y: 0, z: 1 },
            choices: { docked: true, visible: true, collapsed: false, x: 0, y: 0, z: 1 },
            goals: { docked: false, visible: false, collapsed: false, x: 20, y: 70, z: 100 } // MIMINYAN: Set visible to false by default
        }
    });

    const focusWidget = (state, widgetId) => {
        const widgets = state.widgets;
        const maxZ = Math.max(1, ...Object.values(widgets).map(w => w.z));
        widgets[widgetId].z = maxZ + 1;
        return { ...state, widgets };
    };

    const resetProjectSpecificStates = () => update(s => ({
        ...s,
        isFocusMode: false,
        highlightedLink: { sourceSceneId: null, sourceChoiceId: null, targetSceneId: null },
        highlightedStorylineId: null,
        storylineEditMode: { active: false, storylineId: null },
        activeStorylineId: null,
        activeTaggingPlotThreadId: null,
        currentView: 'canvas',
        canvasViewMode: 'flow' // Default view
    }));

    const setCanvasViewMode = (mode) => update(s => ({ ...s, canvasViewMode: mode }));

    return {
        subscribe,
        setView: (view) => update(s => ({ ...s, currentView: view })),
        setCanvasViewMode, // Add to return object
        toggleRightSidebar: () => update(s => ({ ...s, rightSidebar: { ...s.rightSidebar, isOpen: !s.rightSidebar.isOpen } })),
        openRightSidebar: (tab) => update(s => ({
            ...s,
            rightSidebar: {
                isOpen: true,
                activeTab: tab || s.rightSidebar.activeTab
            }
        })),
        closeRightSidebar: () => update(s => ({ ...s, rightSidebar: { ...s.rightSidebar, isOpen: false } })),
        setRightSidebarTab: (tab) => update(s => ({ ...s, rightSidebar: { ...s.rightSidebar, activeTab: tab, isOpen: true } })),
        setIsMobileView: (isMobile) => update(s => ({ ...s, isMobileView: isMobile })),
        toggleSidebar: () => update(s => ({ ...s, isSidebarOpen: !s.isSidebarOpen })),
        setDraggingOnCanvas: (isDragging) => update(s => ({ ...s, isDraggingOnCanvas: isDragging })),
        setDraggedDialogue: (dialogue, sourceSceneId) => update(s => ({ ...s, draggedDialogue: { dialogue, sourceSceneId } })),
        clearDraggedDialogue: () => update(s => ({ ...s, draggedDialogue: null, isDraggingOverCanvas: false })),
        setDraggingOverCanvas: (isOver) => update(s => ({ ...s, isDraggingOverCanvas: isOver })),
        openAnalyticsModal: () => update(s => ({ ...s, isAnalyticsOpen: true })),
        closeAnalyticsModal: () => update(s => ({ ...s, isAnalyticsOpen: false })),
        openSettingsModal: () => update(s => ({ ...s, isSettingsModalOpen: true })),
        closeSettingsModal: () => update(s => ({ ...s, isSettingsModalOpen: false })),
        openCharacterSheet: (characterId) => update(s => ({ ...s, isCharacterSheetOpen: true, editingCharacterId: characterId })),
        closeCharacterSheet: () => update(s => ({ ...s, isCharacterSheetOpen: false, editingCharacterId: null })),
        openStorylineViewer: () => update(s => ({ ...s, isStorylineViewerOpen: true })),
        closeStorylineViewer: () => update(s => ({ ...s, isStorylineViewerOpen: false })),
        openStorylineScriptViewer: (storylineId) => update(s => ({ ...s, isStorylineScriptViewerOpen: true, storylineIdForScriptViewer: storylineId })),
        closeStorylineScriptViewer: () => update(s => ({ ...s, isStorylineScriptViewerOpen: false, storylineIdForScriptViewer: null })),
        openAnnotationManager: () => update(s => ({ ...s, isAnnotationManagerOpen: true })),
        closeAnnotationManager: () => update(s => ({ ...s, isAnnotationManagerOpen: false })),
        openWikiModal: (selectedItemId = null, selectedItemType = null) => update(s => ({ ...s, isWikiModalOpen: true, wikiSelectedItemId: selectedItemId, wikiSelectedItemType: selectedItemType })),
        closeWikiModal: () => update(s => ({ ...s, isWikiModalOpen: false, wikiSelectedItemId: null, wikiSelectedItemType: null })),
        openPlotThreadModal: () => update(s => ({ ...s, isPlotThreadModalOpen: true })),
        closePlotThreadModal: () => update(s => ({ ...s, isPlotThreadModalOpen: false })),
        openGoalSettingModal: () => update(s => ({ ...s, isGoalSettingModalOpen: true })),
        closeGoalSettingModal: () => update(s => ({ ...s, isGoalSettingModalOpen: false })),
        openGuideModal: () => update(s => ({ ...s, isGuideModalOpen: true })),
        closeGuideModal: () => update(s => ({ ...s, isGuideModalOpen: false })),
        openStateManagerModal: () => update(s => ({ ...s, isStateManagerOpen: true })),
        closeStateManagerModal: () => update(s => ({ ...s, isStateManagerOpen: false })),
        openProjectModal: () => update(s => ({ ...s, isProjectModalOpen: true })),
        closeProjectModal: () => update(s => ({ ...s, isProjectModalOpen: false })),
        clearWikiSelection: () => update(s => ({ ...s, wikiSelectedItemId: null, wikiSelectedItemType: null })),
        closeInputModal: () => update(s => ({ ...s, inputModal: { isOpen: false } })),
        toggleShowVariableRangesOnCanvas: () => update(s => ({ ...s, showVariableRangesOnCanvas: !s.showVariableRangesOnCanvas })),
        prompt: (options) => update(s => ({
            ...s,
            inputModal: {
                isOpen: true,
                title: options.title || '입력',
                message: options.message || '',
                initialValue: options.initialValue || '',
                placeholder: options.placeholder || '',
                onConfirm: options.onConfirm || (() => { })
            }
        })),
        toggleFocusMode: () => update(s => {
            const newFocusMode = !s.isFocusMode;
            if (newFocusMode && s.widgets.dialogues.collapsed) {
                notifications.add('대사 편집기가 접혀있어 집중 모드를 켤 수 없습니다.', 'warning');
                return s;
            }
            s.widgets.dialogues.docked = true;
            return { ...s, isFocusMode: newFocusMode };
        }),
        setSidebarWidth: (width) => update(s => ({ ...s, sidebarWidth: Math.max(280, Math.min(width, 1200)) })),
        highlightLink: (sourceSceneId, sourceChoiceId, targetSceneId) => update(s => ({ ...s, highlightedLink: { sourceSceneId, sourceChoiceId, targetSceneId } })),
        clearHighlight: () => update(s => ({ ...s, highlightedLink: { sourceSceneId: null, sourceChoiceId: null, targetSceneId: null } })),

        setHighlightedPath: (pathNodeIds) => {
            if (!pathNodeIds || pathNodeIds.length === 0) {
                return;
            }
            const edges = [];
            for (let i = 0; i < pathNodeIds.length - 1; i++) {
                edges.push([pathNodeIds[i], pathNodeIds[i + 1]]);
            }
            update(s => ({ ...s, highlightedPath: { nodes: pathNodeIds, edges } }));
        },
        clearHighlightedPath: () => update(s => ({ ...s, highlightedPath: null })),

        setActiveStoryline: (storylineId) => update(s => ({
            ...s,
            activeStorylineId: storylineId,
            highlightedStorylineId: storylineId
        })),

        togglePlotThreadTagMode: (threadId) => update(s => ({
            ...s,
            activeTaggingPlotThreadId: s.activeTaggingPlotThreadId === threadId ? null : threadId
        })),

        toggleStorylineEditMode: (storylineId) => update(s => {
            if (s.storylineEditMode.active && s.storylineEditMode.storylineId === storylineId) {
                return { ...s, storylineEditMode: { active: false, storylineId: null } };
            } else {
                return { ...s, storylineEditMode: { active: true, storylineId: storylineId }, activeStorylineId: storylineId, highlightedStorylineId: storylineId };
            }
        }),

        toggleWidgetCollapsed: (widgetId) => update(s => { s.widgets[widgetId].collapsed = !s.widgets[widgetId].collapsed; return s; }),
        toggleWidget: (widgetId) => update(s => { s.widgets[widgetId].visible = !s.widgets[widgetId].visible; return s; }),
        dockWidget: (widgetId) => update(s => {
            const newWidgets = { ...s.widgets };
            newWidgets[widgetId] = { ...newWidgets[widgetId], docked: true, visible: true };
            return { ...s, widgets: newWidgets };
        }),
        undockWidget: (widgetId, x, y) => update(s => {
            const widgets = s.widgets;
            widgets[widgetId].docked = false;
            widgets[widgetId].visible = true;
            widgets[widgetId].x = x;
            widgets[widgetId].y = y;
            return focusWidget(s, widgetId);
        }),
        moveWidget: (widgetId, dx, dy) => update(s => {
            s.widgets[widgetId].x += dx;
            s.widgets[widgetId].y += dy;
            return s;
        }),
        focusWidget: (widgetId) => update(s => focusWidget(s, widgetId)),
        resetProjectSpecificStates
    };
}

export const searchQuery = writable('');

export const searchResults = derived(
    [activeStory, searchQuery],
    ([$activeStory, $searchQuery]) => {
        const query = $searchQuery.trim().toLowerCase();
        if (!query || !$activeStory) return [];

        const results = [];

        // 1. Search Scenes (title), Dialogues (text), and Choices (text)
        for (const scene of Object.values($activeStory.scenes)) {
            if (scene.name.toLowerCase().includes(query)) {
                results.push({ type: 'Scene', id: scene.id, name: scene.name, context: '씬 제목' });
            }
            for (const item of scene.content) {
                if (item.type === 'dialogue' && item.text?.toLowerCase().includes(query)) {
                    results.push({ type: 'Dialogue', id: item.id, sceneId: scene.id, name: `"${item.text.substring(0, 20)}..."`, context: `${scene.name} (${item.character})` });
                }
            }
            for (const choice of scene.choices) {
                if (choice.text?.toLowerCase().includes(query)) {
                    results.push({ type: 'Choice', id: choice.id, sceneId: scene.id, name: `"${choice.text.substring(0, 20)}..."`, context: scene.name });
                }
            }
        }

        // Helper for Wiki Search
        const searchWikiItems = (list, typeLabel, categoryLabel, displayType) => {
            (list || []).forEach(item => {
                const name = item.name || item.term || item.title;
                const desc = item.description || item.definition || '';

                // Name
                if (name && name.toLowerCase().includes(query)) {
                    results.push({ type: typeLabel, id: item.id, name: name, context: categoryLabel });
                }
                // Description
                else if (desc && desc.toLowerCase().includes(query)) {
                    results.push({ type: typeLabel, id: item.id, name: name, context: `${categoryLabel} 설명` });
                }
                // Aliases
                else if (item.aliases && item.aliases.some(a => a.toLowerCase().includes(query))) {
                    const matchedAlias = item.aliases.find(a => a.toLowerCase().includes(query));
                    results.push({ type: typeLabel, id: item.id, name: name, context: `${categoryLabel} 별칭: ${matchedAlias}` });
                }
                // Tags
                else if (item.tags && item.tags.some(t => t.toLowerCase().includes(query))) {
                    const matchedTag = item.tags.find(t => t.toLowerCase().includes(query));
                    results.push({ type: typeLabel, id: item.id, name: name, context: `${categoryLabel} 태그: #${matchedTag}` });
                }
            });
        };

        // 2. Search Characters
        searchWikiItems($activeStory.characters, 'Character', '인물', 'character');

        // 3. Search Locations
        searchWikiItems($activeStory.locations, 'Location', '장소', 'location');

        // 4. Search Items
        searchWikiItems($activeStory.items, 'Item', '아이템', 'item');

        // 5. Search Groups
        searchWikiItems($activeStory.groups, 'Group', '단체', 'group');

        // 6. Search Lore (Dictionary)
        searchWikiItems($activeStory.dictionary, 'Lore', '설정/지식', 'lore');

        // 7. Search History
        ($activeStory.history?.events || []).forEach(evt => {
            if (evt.title.toLowerCase().includes(query)) {
                results.push({ type: 'History', id: evt.id, name: evt.title, context: '역사' });
            } else if (evt.description && evt.description.toLowerCase().includes(query)) {
                results.push({ type: 'History', id: evt.id, name: evt.title, context: '역사 설명' });
            }
        });

        // 8. Search Plot Threads (name)
        for (const thread of ($activeStory.plotThreads || [])) {
            if (thread.name.toLowerCase().includes(query)) {
                results.push({ type: 'PlotThread', id: thread.id, name: thread.name, context: '플롯 스레드' });
            }
        }

        return results;
    }
);

export const commandPalette = createCommandPaletteStore();

export const annotationSelection = createAnnotationSelectionStore();

function createAnnotationSelectionStore() {
    const { subscribe, set } = writable({
        isSelecting: false,
        targetItemId: null,
        targetItemType: null
    });

    return {
        subscribe,
        startSelection: (id, type = 'lore') => {
            set({ isSelecting: true, targetItemId: id, targetItemType: type });
            uiState.openAnnotationManager();
        },
        cancelSelection: () => {
            set({ isSelecting: false, targetItemId: null, targetItemType: null });
        },
        completeSelection: (annotationId) => {
            let targetId, targetType;
            annotationSelection.subscribe(s => { targetId = s.targetItemId; targetType = s.targetItemType; })();

            if (targetId) {
                if (!targetType || targetType === 'lore' || targetType === 'dictionary') {
                    projectActions.updateDictionaryEntry(targetId, { linkedAnnotationId: annotationId });
                } else if (targetType === 'character') {
                    projectActions.updateCharacter(targetId, { linkedAnnotationId: annotationId });
                } else {
                    // location, item, group
                    projectActions.updateWikiItem(targetType, targetId, { linkedAnnotationId: annotationId });
                }
                notifications.add('주석이 성공적으로 연결되었습니다.', 'success');
            }
            set({ isSelecting: false, targetItemId: null, targetItemType: null });
            uiState.closeAnnotationManager();
        }
    };
}

function createCommandPaletteStore() {
    const { subscribe, set, update } = writable({
        isOpen: false,
        query: '',
    });

    return {
        subscribe,
        open: () => set({ isOpen: true, query: '' }),
        close: () => set({ isOpen: false, query: '' }),
        setQuery: (query) => update(s => ({ ...s, query })),
        toggle: () => update(s => ({ ...s, isOpen: !s.isOpen, query: s.isOpen ? '' : s.query }))
    };
}

export const confirmation = createConfirmationStore();

function createConfirmationStore() {
    const { subscribe, set } = writable({
        isOpen: false,
        message: '',
        onConfirm: () => { },
        onCancel: () => { }
    });

    return {
        subscribe,
        prompt: (message, onConfirm, onCancel = () => { }) => {
            set({
                isOpen: true,
                message,
                onConfirm: () => {
                    onConfirm();
                    set({ isOpen: false, message: '', onConfirm: () => { }, onCancel: () => { } });
                },
                onCancel: () => {
                    onCancel();
                    set({ isOpen: false, message: '', onConfirm: () => { }, onCancel: () => { } });
                }
            });
        }
    };
}

export const consistencyIssues = derived(activeStory, ($activeStory) => {
    if (!$activeStory) {
        return [];
    }
    return checkStoryConsistency($activeStory);
});

export const characterStatesByScene = derived(activeStory, ($activeStory) => {
    if (!$activeStory) {
        return {};
    }
    return analyzeCharacterStates($activeStory);
});
