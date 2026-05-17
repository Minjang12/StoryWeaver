<script>
    import { projectActions, uiState, confirmation, activeProject, consistencyIssues } from './stores.js';
    import { onMount } from 'svelte';
    import { analyzeVariableRanges } from './utils.js';
    import ContextMenu from './ContextMenu.svelte';
    import Icon from './Icon.svelte';
    import SceneTooltip from './SceneTooltip.svelte';
    import SequenceBox from './SequenceBox.svelte';

    export let story;  // The entire story object for the active project
    $: scenes = story?.scenes;
    $: sequences = story?.sequences;

    $: variableRanges = $activeProject ? analyzeVariableRanges($activeProject.story) : {};

    let canvasElement;
    let isDraggingNode = false;
    let draggedSceneId = null;
    let dragOffsetX, dragOffsetY;

    // --- Optimization: Viewport Culling ---
    let canvasWidth = 0;
    let canvasHeight = 0;
    let visibleScenes = [];
    let visibleSceneIds = new Set();

    $: {
        if (canvasWidth > 0 && canvasHeight > 0 && scenes && viewTransform) {
            const CULLING_BUFFER = 200; // Render nodes 200px outside the viewport
            const NODE_WIDTH = 160;
            const NODE_HEIGHT = 60;

            // Calculate visible world coordinates
            const viewLeft = (-viewTransform.x - CULLING_BUFFER) / viewTransform.scale;
            const viewTop = (-viewTransform.y - CULLING_BUFFER) / viewTransform.scale;
            const viewRight = (-viewTransform.x + canvasWidth + CULLING_BUFFER) / viewTransform.scale;
            const viewBottom = (-viewTransform.y + canvasHeight + CULLING_BUFFER) / viewTransform.scale;

            const allScenes = Object.values(scenes);
            visibleScenes = allScenes.filter(scene => {
                const sceneRight = scene.position.x + NODE_WIDTH;
                const sceneBottom = scene.position.y + NODE_HEIGHT;
                // Check for intersection
                return scene.position.x < viewRight &&
                       sceneRight > viewLeft &&
                       scene.position.y < viewBottom &&
                       sceneBottom > viewTop;
            });
            visibleSceneIds = new Set(visibleScenes.map(s => s.id));
        }
    }
    // --- End Optimization ---

    // For sequence dragging
    let isDraggingSequence = false;
    let draggedSequenceId = null;
    let dragStartPositions = {};

    // For panning
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let spacebarPressed = false;

    // For dropping dialogues
    let draggedDialogue = null;
    uiState.subscribe(s => draggedDialogue = s.draggedDialogue);
    let dropTargetSceneId = null;
    let animatedSceneId = null;

    // For scene tooltip
    let tooltipVisible = false;
    let hoveredScene = null;
    let tooltipPosition = { x: 0, y: 0 };
    let mouseScreenPosition = { x: 0, y: 0 };
    let hoverTimeout;

    function handleNodeMouseEnter(scene) {
        if (isDraggingNode || isPanning) return;
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
            hoveredScene = scene;
            tooltipVisible = true;
            updateTooltipPosition();
        }, 500); // 500ms delay before showing tooltip
    }

    function handleNodeMouseLeave() {
        clearTimeout(hoverTimeout);
        tooltipVisible = false;
        hoveredScene = null;
    }
    
    function updateTooltipPosition() {
        if (!tooltipVisible || !canvasElement) return;
        const rect = canvasElement.getBoundingClientRect();
        const TOOLTIP_OFFSET = 15;
        tooltipPosition = { 
            x: mouseScreenPosition.x - rect.left + TOOLTIP_OFFSET, 
            y: mouseScreenPosition.y - rect.top + TOOLTIP_OFFSET 
        };
    }

    // For comment editing
    let editingCommentSceneId = null;
    let isDraggingCommentEditor = false;
    let commentEditorPos = { x: 0, y: 0 };
    let dragStartOffset = { x: 0, y: 0 };
    let sidebarWidth = 350; // Default value
    uiState.subscribe(s => sidebarWidth = s.sidebarWidth);

    function handleCommentEditorDragStart(event) {
        isDraggingCommentEditor = true;
        dragStartOffset.x = event.clientX - commentEditorPos.x;
        dragStartOffset.y = event.clientY - commentEditorPos.y;
    }

    function handleCommentEditorDrag(event) {
        if (!isDraggingCommentEditor) return;
        commentEditorPos.x = event.clientX - dragStartOffset.x;
        commentEditorPos.y = event.clientY - dragStartOffset.y;
    }

    function handleCommentEditorDragEnd() {
        isDraggingCommentEditor = false;
    }

    function toggleCommentEditor(sceneId) {
        if (editingCommentSceneId === sceneId) {
            editingCommentSceneId = null;
        } else {
            editingCommentSceneId = sceneId;
            
            // Calculate initial position when opening
            const sceneNode = scenes[sceneId];
            if (!sceneNode || !canvasElement) return;
            const canvasRect = canvasElement.getBoundingClientRect();
            const EDITOR_WIDTH = 180; // Initial width
            const EDITOR_HEIGHT = 120; // Initial height

            let targetX = (sceneNode.position.x + 170) * viewTransform.scale + viewTransform.x;
            let targetY = sceneNode.position.y * viewTransform.scale + viewTransform.y;

            // Boundary checks
            if (targetX + EDITOR_WIDTH > canvasRect.right) {
                targetX = (sceneNode.position.x - EDITOR_WIDTH - 10) * viewTransform.scale + viewTransform.x;
            }
            if (targetX < sidebarWidth) {
                targetX = sidebarWidth + 10;
            }
            if (targetY + EDITOR_HEIGHT > canvasRect.bottom) {
                targetY = canvasRect.bottom - EDITOR_HEIGHT - 10;
            }
            if (targetY < canvasRect.top) {
                targetY = canvasRect.top + 10;
            }
            
            commentEditorPos = { x: targetX, y: targetY };
        }
    }

    // For the linking line
    let mouseWorldX = 0;
    let mouseWorldY = 0;
    let sourceNodePosition = { x: 0, y: 0 };


    // --- Context Menu State ---
    let isContextMenuOpen = false;
    let contextMenuPos = { x: 0, y: 0 };
    let contextMenuItems = [];
    let contextMenuTarget = { id: null, worldPos: { x: 0, y: 0 } };

    $: viewTransform = story.viewTransform || { scale: 1, x: 0, y: 0 };
    $: linkingState = story.linkingState;
    $: storylineEditMode = $uiState.storylineEditMode;
    $: activeTaggingPlotThreadId = $uiState.activeTaggingPlotThreadId; // MIMINYAN: Add this
    $: editingStoryline = storylineEditMode.active ? story.storylines.find(sl => sl.id === storylineEditMode.storylineId) : null;
    $: highlightedStorylineId = $uiState.highlightedStorylineId;
    $: highlightedStoryline = highlightedStorylineId ? story.storylines.find(sl => sl.id === highlightedStorylineId) : null;
    $: activeStorylineId = $uiState.activeStorylineId;
    $: activeStoryline = activeStorylineId ? story.storylines.find(sl => sl.id === activeStorylineId) : null;

    let storylineHighlightLinks = new Set();
    $: {
        const newSet = new Set();
        if (highlightedStoryline && highlightedStoryline.nodes.length > 1) {
            for (let i = 0; i < highlightedStoryline.nodes.length - 1; i++) {
                const sourceSceneId = highlightedStoryline.nodes[i];
                const targetSceneId = highlightedStoryline.nodes[i + 1];
                const sourceScene = scenes[sourceSceneId];
                if (!sourceScene) continue;

                const choice = sourceScene.choices.find(c => c.targetSceneId === targetSceneId);
                if (choice) {
                    newSet.add(`${sourceSceneId}-${choice.id}`);
                } else if (sourceScene.autoTransitionTarget === targetSceneId) {
                    newSet.add(`${sourceSceneId}-auto`);
                }
            }
        }
        storylineHighlightLinks = newSet;
    }

    let highlightedPath = null;
    $: highlightedPath = $uiState.highlightedPath;

    let editingStorylineLinks = new Set();
    $: {
        const newSet = new Set();
        if (editingStoryline && editingStoryline.nodes.length > 1) {
            for (let i = 0; i < editingStoryline.nodes.length - 1; i++) {
                const sourceSceneId = editingStoryline.nodes[i];
                const targetSceneId = editingStoryline.nodes[i + 1];
                const sourceScene = scenes[sourceSceneId];
                if (!sourceScene) continue;

                const choice = sourceScene.choices.find(c => c.targetSceneId === targetSceneId);
                if (choice) {
                    newSet.add(`${sourceSceneId}-${choice.id}`);
                } else if (sourceScene.autoTransitionTarget === targetSceneId) {
                    newSet.add(`${sourceSceneId}-auto`);
                }
            }
        }
        editingStorylineLinks = newSet;
    }

    let activeStorylineLinks = new Set();
    $: {
        const newSet = new Set();
        if (activeStoryline && activeStoryline.nodes.length > 1) {
            for (let i = 0; i < activeStoryline.nodes.length - 1; i++) {
                const sourceSceneId = activeStoryline.nodes[i];
                const targetSceneId = activeStoryline.nodes[i + 1];
                const sourceScene = scenes[sourceSceneId];
                if (!sourceScene) continue;

                const choice = sourceScene.choices.find(c => c.targetSceneId === targetSceneId);
                if (choice) {
                    newSet.add(`${sourceSceneId}-${choice.id}`);
                } else if (sourceScene.autoTransitionTarget === targetSceneId) {
                    newSet.add(`${sourceSceneId}-auto`);
                }
            }
        }
        activeStorylineLinks = newSet;
    }

    // --- Dynamic SVG Sizing ---
    let svgBounds = { left: 0, top: 0, width: '100%', height: '100%' };

    $: {
        if (scenes) {
            const sceneValues = Object.values(scenes);
            if (sceneValues.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                const NODE_WIDTH = 160;
                const NODE_HEIGHT = 60;
                const PADDING = 200;

                for (const scene of sceneValues) {
                    minX = Math.min(minX, scene.position.x);
                    minY = Math.min(minY, scene.position.y);
                    maxX = Math.max(maxX, scene.position.x + NODE_WIDTH);
                    maxY = Math.max(maxY, scene.position.y + NODE_HEIGHT);
                }

                svgBounds = {
                    left: minX - PADDING,
                    top: minY - PADDING,
                    width: (maxX - minX) + PADDING * 2,
                    height: (maxY - minY) + PADDING * 2
                };
            } else {
                svgBounds = { left: 0, top: 0, width: '100%', height: '100%' };
            }
        }
    }

    // --- Utility Functions ---
    function formatConditions(conditions) {
        if (!conditions || conditions.length === 0) return '';
        return conditions.map(c => `${c.variable} ${c.operator} ${c.value}`).join(', ');
    }

    // --- Coordinate Transformation ---
    function getViewToWorld(clientX, clientY) {
        if (!canvasElement) return { x: 0, y: 0 };
        const rect = canvasElement.getBoundingClientRect();
        const viewX = clientX - rect.left;
        const viewY = clientY - rect.top;
        return {
            x: (viewX - viewTransform.x) / viewTransform.scale,
            y: (viewY - viewTransform.y) / viewTransform.scale,
        };
    }

    // --- Anchor Point Calculation (in world coordinates) ---
    function getChoiceAnchorPoint(sceneId, choiceId) {
        const scene = scenes[sceneId];
        if (!scene || !scene.choices) return { x: 0, y: 0 };
        const choiceIndex = scene.choices.findIndex(c => c.id === choiceId);
        const yOffset = 30 + (choiceIndex >= 0 ? choiceIndex * 15 : 0);
        return { x: scene.position.x + 160, y: scene.position.y + yOffset };
    }

    function getSceneRightCenterAnchorPoint(sceneId) {
        const scene = scenes[sceneId];
        if (!scene) return { x: 0, y: 0 };
        const NODE_WIDTH = 160;
        // Approximate vertical center. 30px is the middle of the header.
        const yOffset = 30; 
        return { x: scene.position.x + NODE_WIDTH, y: scene.position.y + yOffset };
    }

    function getSceneCenterPoint(sceneId) {
        const scene = scenes[sceneId];
        if (!scene) return { x: 0, y: 0 };
        const NODE_WIDTH = 160; // Defined in CSS, ensure consistency
        const NODE_HEIGHT = 60; // Defined in CSS, ensure consistency
        return {
            x: scene.position.x + NODE_WIDTH / 2,
            y: scene.position.y + NODE_HEIGHT / 2
        };
    }

    let incomingLinksMap = {};
    $: {
        const newMap = {};
        if (scenes) {
            for (const scene of Object.values(scenes)) {
                if (scene && scene.choices) {
                    for (const choice of scene.choices) {
                        if (choice.targetSceneId) {
                            if (!newMap[choice.targetSceneId]) newMap[choice.targetSceneId] = [];
                            newMap[choice.targetSceneId].push(`${scene.id}-${choice.id}`);
                        }
                    }
                }
            }
        }
        Object.keys(newMap).forEach(key => newMap[key].sort());
        incomingLinksMap = newMap;
    }

    function getTargetAnchorPoint(targetScene, sourceSceneId, sourceChoiceId) {
        if (!targetScene) return { x: 0, y: 0 };
        const incoming = incomingLinksMap[targetScene.id] || [];
        const linkIdentifier = `${sourceSceneId}-${sourceChoiceId}`;
        const linkIndex = incoming.indexOf(linkIdentifier);
        const yOffset = 30 + (linkIndex >= 0 ? linkIndex * 15 : 0);
        return { x: targetScene.position.x, y: targetScene.position.y + yOffset };
    }

    function getSceneLeftCenterAnchorPoint(sceneId) {
        const scene = scenes[sceneId];
        if (!scene) return { x: 0, y: 0 };
        // Approximate vertical center. 30px is the middle of the header.
        const yOffset = 30; 
        return { x: scene.position.x, y: scene.position.y + yOffset };
    }

    $: {
        if (linkingState.active && linkingState.sourceSceneId) {
            const sourceScene = scenes[linkingState.sourceSceneId];
            if (sourceScene) {
                if (linkingState.sourceType === 'choice') {
                    const sourceChoiceId = linkingState.sourceItemId;
                    if (sourceChoiceId) {
                        sourceNodePosition = getChoiceAnchorPoint(sourceScene.id, sourceChoiceId);
                    }
                } else if (linkingState.sourceType === 'scene') {
                    sourceNodePosition = getSceneRightCenterAnchorPoint(sourceScene.id);
                }
            }
        }
    }

    // --- Touch event states ---
    let lastTouchDistance = null;
    let longPressTimer = null;

    // --- Event Handlers ---
    function handleTouchStart(event) {
        clearTimeout(longPressTimer);
        
        if (linkingState.active) return;

        // Long press for context menu
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            longPressTimer = setTimeout(() => {
                handleContextMenu(touch);
            }, 500); // 500ms for long press
        }

        if (event.touches.length === 2) {
            // Pinch-to-zoom start
            isPanning = true; // Use panning state for two-finger movements
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            lastTouchDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            panStart = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2,
            };
            event.preventDefault();
            return;
        }
        
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const targetNode = touch.target.closest('.scene-node');

            if (targetNode) {
                isDraggingNode = true;
                draggedSceneId = targetNode.dataset.id;
                const worldCoords = getViewToWorld(touch.clientX, touch.clientY);
                const scene = scenes[draggedSceneId];
                dragOffsetX = worldCoords.x - scene.position.x;
                dragOffsetY = worldCoords.y - scene.position.y;
            } else {
                isPanning = true;
                panStart.x = touch.clientX;
                panStart.y = touch.clientY;
            }
            event.preventDefault();
        }
    }

    function handleTouchMove(event) {
        clearTimeout(longPressTimer); // Cancel context menu on move
        
        if (event.touches.length === 2 && isPanning) {
            // Pinch-to-zoom move
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const newTouchDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            const midPoint = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2,
            };

            // --- Zooming ---
            const scaleFactor = newTouchDistance / lastTouchDistance;
            const newScale = Math.max(0.2, Math.min(2, viewTransform.scale * scaleFactor));
            const worldPos = getViewToWorld(midPoint.x, midPoint.y);
            const newX = viewTransform.x + (worldPos.x * viewTransform.scale - worldPos.x * newScale);
            const newY = viewTransform.y + (worldPos.y * viewTransform.scale - worldPos.y * newScale);
            projectActions.updateViewTransform({ scale: newScale, x: newX, y: newY });
            
            lastTouchDistance = newTouchDistance;

            // --- Panning (with two fingers) ---
            const dx = midPoint.x - panStart.x;
            const dy = midPoint.y - panStart.y;
            projectActions.updateViewTransform({
                x: viewTransform.x + dx,
                y: viewTransform.y + dy,
            });
            panStart = midPoint;
            
            event.preventDefault();
            return;
        }

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const worldCoords = getViewToWorld(touch.clientX, touch.clientY);

            if (isDraggingNode && draggedSceneId) {
                projectActions.updateScene(draggedSceneId, {
                    position: {
                        x: worldCoords.x - dragOffsetX,
                        y: worldCoords.y - dragOffsetY
                    }
                }, false);
            } else if (isPanning) {
                const dx = touch.clientX - panStart.x;
                const dy = touch.clientY - panStart.y;
                projectActions.updateViewTransform({
                    x: viewTransform.x + dx,
                    y: viewTransform.y + dy,
                });
                panStart.x = touch.clientX;
                panStart.y = touch.clientY;
            }
            event.preventDefault();
        }
    }

    function handleTouchEnd(event) {
        clearTimeout(longPressTimer);

        if (isDraggingNode) {
            projectActions.commitHistory();
        }

        isDraggingNode = false;
        draggedSceneId = null;
        isPanning = false;
        lastTouchDistance = null;

        // If it was a tap (no movement), handle it like a click
        if (event.changedTouches.length === 1 && !isDraggingNode && !isPanning) {
             handleCanvasClick(event.changedTouches[0]);
        }
    }

    function handleSequenceDragStart(e) {
        const { sequence, event } = e.detail;
        uiState.setDraggingOnCanvas(true);
        isDraggingSequence = true;
        draggedSequenceId = sequence.id;
        panStart = getViewToWorld(event.clientX, event.clientY);
        
        dragStartPositions = {};
        for (const sceneId of sequence.scenes) {
            if (scenes[sceneId]) {
                dragStartPositions[sceneId] = { ...scenes[sceneId].position };
            }
        }
    }

    function handleDragEnter(e, sceneId) {
        e.preventDefault();
        if (draggedDialogue && draggedDialogue.sourceSceneId !== sceneId) {
            dropTargetSceneId = sceneId;
        }
    }

    function handleDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
    }

    function handleDragLeave() {
        dropTargetSceneId = null;
    }

    function handleDrop(e, targetSceneId) {
        e.preventDefault();
        if (draggedDialogue && draggedDialogue.sourceSceneId !== targetSceneId) {
            projectActions.moveDialogueToScene(
                draggedDialogue.sourceSceneId,
                draggedDialogue.dialogue.id,
                targetSceneId
            );
            animatedSceneId = targetSceneId;
            setTimeout(() => { animatedSceneId = null; }, 500); // Animation duration
        }
        dropTargetSceneId = null;
    }

    function handleMouseDown(event) {
        uiState.setDraggingOnCanvas(true);
        if (isContextMenuOpen) closeContextMenu();
        if (linkingState.active) return;

        if (storylineEditMode.active || activeTaggingPlotThreadId) { 
            // If in storyline edit mode, don't drag, just toggle scene
            return;
        }

        // Pan on Left Click (empty space), Middle Click, or Spacebar + Drag
        const isLeftClickOnEmpty = event.button === 0 && !event.target.closest('.scene-node') && !event.target.closest('.canvas-fab') && !event.target.closest('.canvas-dock');
        
        if (spacebarPressed || event.button === 1 || isLeftClickOnEmpty) { 
            isPanning = true;
            panStart.x = event.clientX;
            panStart.y = event.clientY;
            // event.preventDefault(); // Remove preventDefault to allow focus changes if needed, but for panning usually good to prevent text selection
            return;
        }
        
        const targetNode = event.target.closest('.scene-node');
        if (targetNode) {
            isDraggingNode = true;
            draggedSceneId = targetNode.dataset.id;
            const worldCoords = getViewToWorld(event.clientX, event.clientY);
            const scene = scenes[draggedSceneId];
            dragOffsetX = worldCoords.x - scene.position.x;
            dragOffsetY = worldCoords.y - scene.position.y;
            event.preventDefault();
        }
    }

    function onMouseMove(event) {
        mouseScreenPosition = { x: event.clientX, y: event.clientY };
        updateTooltipPosition();

        const worldCoords = getViewToWorld(event.clientX, event.clientY);
        mouseWorldX = worldCoords.x;
        mouseWorldY = worldCoords.y;

        if (isPanning) {
            const dx = event.clientX - panStart.x;
            const dy = event.clientY - panStart.y;
            projectActions.updateViewTransform({
                x: viewTransform.x + dx,
                y: viewTransform.y + dy,
            });
            if (editingCommentSceneId) {
                commentEditorPos.x += dx;
                commentEditorPos.y += dy;
            }
            panStart.x = event.clientX;
            panStart.y = event.clientY;
            return;
        }

        if (isDraggingSequence) {
            const dx = worldCoords.x - panStart.x;
            const dy = worldCoords.y - panStart.y;
            const sequence = sequences[draggedSequenceId];
            if (sequence) {
                for (const sceneId of sequence.scenes) {
                    const startPos = dragStartPositions[sceneId];
                    if (startPos) {
                        projectActions.updateScene(sceneId, {
                            position: {
                                x: startPos.x + dx,
                                y: startPos.y + dy
                            }
                        }, false);
                    }
                }
            }
            return;
        }

        if (!isDraggingNode || !draggedSceneId) return;

        projectActions.updateScene(draggedSceneId, {
            position: {
                x: mouseWorldX - dragOffsetX,
                y: mouseWorldY - dragOffsetY
            }
        }, false); // Do not record history while dragging
    }

    function handleMouseUp() {
        if (isDraggingNode || isDraggingSequence) {
            projectActions.commitHistory();
        }
        isDraggingNode = false;
        draggedSceneId = null;
        isDraggingSequence = false;
        draggedSequenceId = null;
        dragStartPositions = {};
        isPanning = false;
        uiState.setDraggingOnCanvas(false);
    }

    function handleCanvasClick(event) {
        if (linkingState.active) {
            projectActions.cancelLinking();
        }

        const targetNode = event.target.closest('.scene-node');

        if (storylineEditMode.active) {
            if (targetNode) {
                const sceneId = targetNode.dataset.id;
                projectActions.toggleSceneInStoryline(storylineEditMode.storylineId, sceneId);
            }
        } else if (activeTaggingPlotThreadId) { // MIMINYAN: Add this block
            if (targetNode) {
                const sceneId = targetNode.dataset.id;
                projectActions.toggleScenePlotThread(sceneId, activeTaggingPlotThreadId);
            }
        }
    }

    function handleWheel(event) {
        event.preventDefault();
        const scaleAmount = -event.deltaY * 0.001;
        const newScale = Math.max(0.2, Math.min(2, viewTransform.scale + scaleAmount));
        
        const worldPos = getViewToWorld(event.clientX, event.clientY);

        const newX = viewTransform.x + (worldPos.x * viewTransform.scale - worldPos.x * newScale);
        const newY = viewTransform.y + (worldPos.y * viewTransform.scale - worldPos.y * newScale);

        projectActions.updateViewTransform({ scale: newScale, x: newX, y: newY });

        if (editingCommentSceneId) {
            const mouseScreenX = event.clientX;
            const mouseScreenY = event.clientY;
            const oldDistX = commentEditorPos.x - mouseScreenX;
            const oldDistY = commentEditorPos.y - mouseScreenY;
            const scaleRatio = newScale / viewTransform.scale;
            const newDistX = oldDistX * scaleRatio;
            const newDistY = oldDistY * scaleRatio;
            commentEditorPos.x = mouseScreenX + newDistX;
            commentEditorPos.y = mouseScreenY + newDistY;
        }
    }
    
    function handleGlobalKeyDown(event) {
        if (event.key === 'Escape') {
            if (linkingState.active) {
                projectActions.cancelLinking();
            }
            if (storylineEditMode.active) {
                uiState.toggleStorylineEditMode(storylineEditMode.storylineId);
            }
            if (activeTaggingPlotThreadId) { // MIMINYAN: Add this
                uiState.togglePlotThreadTagMode(activeTaggingPlotThreadId);
            }
        }
        
        const target = event.target;
        const isInputFocused = target.isContentEditable || ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase());

        if (event.code === 'Space' && !spacebarPressed && !isInputFocused) {
            spacebarPressed = true;
            event.preventDefault();
        }
    }

    function handleGlobalKeyUp(event) {
        if (event.code === 'Space') {
            spacebarPressed = false;
            
            const targetTagName = event.target.tagName.toLowerCase();
            const isInputFocused = ['input', 'textarea', 'select'].includes(targetTagName);
            
            if (!isInputFocused) {
                event.preventDefault();
            }
        }
    }

    // --- Navigation Helpers ---
    function centerOnScene(sceneId) {
        if (!sceneId || !scenes[sceneId] || !canvasElement) return;
        const scene = scenes[sceneId];
        const rect = canvasElement.getBoundingClientRect();
        
        // Target scale: keep current scale or default to 1 if too zoomed out
        const targetScale = Math.max(viewTransform.scale, 0.7);
        
        // Calculate new X, Y to put the node in the center of the viewport
        const NODE_WIDTH = 160;
        const NODE_HEIGHT = 60;
        
        const newX = (rect.width / 2) - (scene.position.x + NODE_WIDTH / 2) * targetScale;
        const newY = (rect.height / 2) - (scene.position.y + NODE_HEIGHT / 2) * targetScale;
        
        projectActions.updateViewTransform({ scale: targetScale, x: newX, y: newY });
        
        // Flash animation effect
        animatedSceneId = sceneId;
        setTimeout(() => { animatedSceneId = null; }, 1000);
    }

    function centerOnStart() {
        // Try to find 'start' node or the first node in the list
        const startNode = scenes['start'] || Object.values(scenes)[0];
        if (startNode) {
            centerOnScene(startNode.id);
        }
    }

    // --- Location Logic ---
    function getSceneLocation(scene) {
        if (!scene || !scene.referencedWikiIds || !story.locations) return null;
        // Find the first referenced ID that exists in the locations list
        return story.locations.find(loc => scene.referencedWikiIds.includes(loc.id));
    }

    function jumpToLocation(locationId) {
        const marker = (story.mapData?.markers || []).find(m => m.wikiId === locationId);
        if (marker) {
            uiState.setView('map');
            // Center on marker with offset (reuse logic from Sidebar)
            const centerX = window.innerWidth / 2 - 100;
            const centerY = window.innerHeight / 2;
            const targetX = centerX - (marker.x * 1);
            const targetY = centerY - (marker.y * 1);
            projectActions.updateViewTransform({ x: targetX, y: targetY, scale: 1 });
        } else {
            // If no pin, just open the wiki modal for that location
            uiState.openWikiModal(locationId, 'location');
        }
    }

    // --- Context Menu Handlers ---
    function handleSequenceContextMenu(e) {
        const { sequence, event } = e.detail;
        const worldPos = getViewToWorld(event.clientX, event.clientY);
        event.preventDefault();
        contextMenuPos = { x: event.clientX, y: event.clientY };
        // Set target for both scene creation (using worldPos and sequenceId) and sequence management
        contextMenuTarget = { id: null, worldPos, sequenceId: sequence.id };

        contextMenuItems = [
            { label: '여기에 새 씬 추가', action: 'add-scene-here' },
            { label: '여기에 새 시퀀스 추가', action: 'add-sequence-here' },
            { type: 'separator' },
            { label: '이름 바꾸기', action: 'rename-sequence', sequenceId: sequence.id },
            { label: '색상 변경 (회색)', action: 'change-sequence-color', sequenceId: sequence.id, color: 'rgba(108, 117, 125, 0.1)' },
            { label: '색상 변경 (빨강)', action: 'change-sequence-color', sequenceId: sequence.id, color: 'rgba(220, 53, 69, 0.1)' },
            { label: '색상 변경 (파랑)', action: 'change-sequence-color', sequenceId: sequence.id, color: 'rgba(0, 123, 255, 0.1)' },
            { label: '색상 변경 (초록)', action: 'change-sequence-color', sequenceId: sequence.id, color: 'rgba(40, 167, 69, 0.1)' },
            { label: '색상 변경 (노랑)', action: 'change-sequence-color', sequenceId: sequence.id, color: 'rgba(255, 193, 7, 0.1)' },
            { type: 'separator' },
            { label: '시퀀스 삭제', action: 'delete-sequence', sequenceId: sequence.id }
        ];
        isContextMenuOpen = true;
    }

    function getSequenceBounds(sequence, scenes) {
        const PADDING = 40;
        const NODE_WIDTH = 160;
        const NODE_HEIGHT = 60;

        const scenesInSequence = sequence.scenes.map(id => scenes[id]).filter(Boolean);
        if (scenesInSequence.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const scene of scenesInSequence) {
                minX = Math.min(minX, scene.position.x);
                minY = Math.min(minY, scene.position.y);
                maxX = Math.max(maxX, scene.position.x + NODE_WIDTH);
                maxY = Math.max(maxY, scene.position.y + NODE_HEIGHT);
            }
            return {
                x: minX - PADDING,
                y: minY - PADDING,
                width: (maxX - minX) + PADDING * 2,
                height: (maxY - minY) + PADDING * 2
            };
        } else {
            const MIN_WIDTH = 200;
            const MIN_HEIGHT = 150;
            return {
                x: sequence.position?.x || 200,
                y: sequence.position?.y || 200,
                width: MIN_WIDTH,
                height: MIN_HEIGHT
            };
        }
    }

    function handleContextMenu(event) {
        event.preventDefault();
        const targetNode = event.target.closest('.scene-node');
        const worldPos = getViewToWorld(event.clientX, event.clientY);

        contextMenuPos = { x: event.clientX, y: event.clientY };
        
        if (targetNode) {
            const sceneId = targetNode.dataset.id;
            const scene = scenes[sceneId];
            contextMenuTarget = { id: sceneId, worldPos };
            
            let sceneSequence = null;
            if (sequences) {
                for (const seq of Object.values(sequences)) {
                    if (seq.scenes.includes(sceneId)) {
                        sceneSequence = seq;
                        break;
                    }
                }
            }

            const baseItems = [
                { label: '복제하기', action: 'duplicate-scene' },
                { label: '시작 씬으로 지정', action: 'set-start-scene' },
                { label: '삭제하기', action: 'delete-scene' }
            ];
            
            // Location Submenu
            if (story.locations && story.locations.length > 0) {
                const locationItems = story.locations.map(loc => ({
                    label: loc.name,
                    action: 'toggle-location',
                    locationId: loc.id,
                    icon: (scene.referencedWikiIds || []).includes(loc.id) ? 'check' : undefined
                }));
                baseItems.unshift({
                    label: '장소 설정',
                    submenu: locationItems
                });
            }

            if (scene && scene.autoTransitionTarget) {
                baseItems.unshift({ label: '씬 연결 해제', action: 'disconnect-scene' });
            }

            const sequenceItems = [];
            if (sceneSequence) {
                sequenceItems.push({ label: `시퀀스 '${sceneSequence.name}'에서 제거`, action: 'remove-from-sequence' });
            } else if (sequences && Object.keys(sequences).length > 0) {
                sequenceItems.push({
                    label: '시퀀스에 추가',
                    submenu: Object.values(sequences).map(seq => ({
                        label: seq.name,
                        action: 'add-to-sequence',
                        sequenceId: seq.id
                    }))
                });
            }
            
            let menu = [...sequenceItems];
            if (sequenceItems.length > 0 && baseItems.length > 0) {
                const lastItem = sequenceItems[sequenceItems.length - 1];
                if (lastItem.type !== 'separator') {
                    menu.push({ type: 'separator' });
                }
            }
            menu.push(...baseItems);
            contextMenuItems = menu;

            if (sceneId === 'start') {
                contextMenuItems = contextMenuItems.filter(
                    item => item.action === 'duplicate-scene' || item.action === 'disconnect-scene' || item.action === 'remove-from-sequence' || item.action === 'add-to-sequence' || item.type === 'separator' || item.submenu
                );
            }
        } else {
            let targetSequenceId = null;
            if (sequences) {
                for (const sequence of Object.values(sequences)) {
                    const bounds = getSequenceBounds(sequence, scenes);
                    if (
                        worldPos.x >= bounds.x &&
                        worldPos.x <= bounds.x + bounds.width &&
                        worldPos.y >= bounds.y &&
                        worldPos.y <= bounds.y + bounds.height
                    ) {
                        targetSequenceId = sequence.id;
                        break;
                    }
                }
            }
            contextMenuTarget = { id: null, worldPos, sequenceId: targetSequenceId };
            contextMenuItems = [
                { label: '여기에 새 씬 추가', action: 'add-scene-here' },
                { label: '여기에 새 시퀀스 추가', action: 'add-sequence-here' }
            ];
        }
        isContextMenuOpen = true;
    }

    function closeContextMenu() {
        isContextMenuOpen = false;
    }

    function handleMenuAction(event) {
        const { action, sequenceId, color, locationId } = event.detail;
        const { id: sceneId, sequenceId: targetSequenceId } = contextMenuTarget;

        switch (action) {
            case 'toggle-location':
                if (sceneId && locationId) {
                    projectActions.toggleSceneReference(sceneId, locationId);
                }
                break;
            case 'add-scene-here':
                projectActions.addScene({ position: contextMenuTarget.worldPos, sequenceId: targetSequenceId });
                break;
            case 'add-sequence-here':
                projectActions.addSequence(contextMenuTarget.worldPos);
                break;
            case 'add-to-sequence':
                if (sceneId && sequenceId) projectActions.addSceneToSequence(sequenceId, sceneId);
                break;
            case 'remove-from-sequence':
                if (sceneId) projectActions.removeSceneFromSequence(sceneId);
                break;
            
            // --- New Sequence Management Cases ---
            case 'rename-sequence':
                if (sequenceId && sequences[sequenceId]) {
                    const oldName = sequences[sequenceId].name;
                    uiState.prompt({
                        title: '시퀀스 이름 바꾸기',
                        message: `'${oldName}' 시퀀스의 새 이름을 입력하세요.`,
                        initialValue: oldName,
                        onConfirm: (newName) => {
                            if (newName && newName.trim() !== oldName) {
                                projectActions.updateSequence(sequenceId, { name: newName.trim() });
                            }
                        }
                    });
                }
                break;
            case 'change-sequence-color':
                if (sequenceId && color) {
                    projectActions.updateSequence(sequenceId, { color: color });
                }
                break;
            case 'delete-sequence':
                if (sequenceId && sequences[sequenceId]) {
                    confirmation.prompt(
                        `정말로 "${sequences[sequenceId].name}" 시퀀스를 삭제하시겠습니까? (씬은 삭제되지 않습니다)`,
                        () => projectActions.removeSequence(sequenceId)
                    );
                }
                break;

            case 'disconnect-scene':
                if (sceneId) projectActions.removeSceneConnection(sceneId);
                break;
            case 'duplicate-scene':
                if (sceneId) projectActions.duplicateScene(sceneId);
                break;
            case 'set-start-scene':
                if (sceneId && sceneId !== 'start') projectActions.setStartScene(sceneId);
                break;
            case 'delete-scene':
                if (sceneId && sceneId !== 'start') {
                    confirmation.prompt(
                        `정말로 "${scenes[sceneId].name}" 씬을 삭제하시겠습니까?`,
                        () => projectActions.removeScene(sceneId)
                    );
                }
                break;
        }
        closeContextMenu();
    }

    onMount(() => {
        canvasElement.addEventListener('wheel', handleWheel, { passive: false });
        // Use canvasElement for mouse down to avoid interfering with context menu logic on window
        canvasElement.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);
        window.addEventListener('mousemove', handleCommentEditorDrag);
        window.addEventListener('mouseup', handleCommentEditorDragEnd);

        // Touch events for mobile support
        canvasElement.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvasElement.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvasElement.addEventListener('touchend', handleTouchEnd);

        // MIMINYAN: Auto-center on selected scene when mounted (handles view switching from Map)
        if (story && story.selectedSceneId) {
            // Use setTimeout to ensure the DOM is ready and dimensions are correct
            setTimeout(() => {
                centerOnScene(story.selectedSceneId);
            }, 50);
        }

        return () => {
            canvasElement.removeEventListener('wheel', handleWheel);
            canvasElement.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
            window.removeEventListener('mousemove', handleCommentEditorDrag);
            window.removeEventListener('mouseup', handleCommentEditorDragEnd);

            // Cleanup touch events
            canvasElement.removeEventListener('touchstart', handleTouchStart);
            canvasElement.removeEventListener('touchmove', handleTouchMove);
            canvasElement.removeEventListener('touchend', handleTouchEnd);
        };
    });
</script>


<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="story-canvas" 
     bind:this={canvasElement} 
     bind:clientWidth={canvasWidth}
     bind:clientHeight={canvasHeight}
     on:click={handleCanvasClick}
     on:contextmenu={handleContextMenu}
     on:dragover={() => { if (draggedDialogue) uiState.setDraggingOverCanvas(true); }}
     on:dragleave={() => { if (draggedDialogue) uiState.setDraggingOverCanvas(false); }}
     class:panning={isPanning || spacebarPressed}
     class:storyline-editing={storylineEditMode.active}
     class:plot-thread-tagging={activeTaggingPlotThreadId}
     class:scene-tooltip-visible={tooltipVisible}
     style="background-position: {viewTransform.x}px {viewTransform.y}px; background-size: {20 * viewTransform.scale}px {20 * viewTransform.scale}px;"
     role="button" 
     tabindex="0">
    
    <div class="canvas-transform-group" style="transform: translate({viewTransform.x}px, {viewTransform.y}px) scale({viewTransform.scale});">
        <svg class="connection-svg" 
             style="left: {svgBounds.left}px; top: {svgBounds.top}px;"
             width={svgBounds.width}
             height={svgBounds.height}>
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-color-muted)" />
                </marker>
                 <marker id="arrowhead-highlighted" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-color)" />
                </marker>
                <marker id="arrowhead-storyline-highlight" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--storyline-color)" />
                </marker>
                <marker id="arrowhead-editing-storyline" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--success-color)" />
                </marker>
                <marker id="arrowhead-active-storyline" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-color)" />
                </marker>
            </defs>
            <g>
                <!-- Persistent connection lines with curved paths -->
                {#each Object.values(scenes) as scene (scene.id)}
                    {#if scene && scene.choices}
                        {#each scene.choices as choice (choice.id)}
                            {#if choice.targetSceneId && scenes[choice.targetSceneId]}
                                {@const targetScene = scenes[choice.targetSceneId]}
                                {#if visibleSceneIds.has(scene.id) || visibleSceneIds.has(targetScene.id)}
                                    {@const startPoint = getChoiceAnchorPoint(scene.id, choice.id)}
                                    {@const endPoint = getTargetAnchorPoint(targetScene, scene.id, choice.id)}
                                    {@const pathId = `path-${scene.id}-${choice.id}`}
                                    {@const isChoiceHighlighted = $uiState.highlightedLink.sourceSceneId === scene.id && $uiState.highlightedLink.sourceChoiceId === choice.id}
                                    {@const isStorylineLink = storylineHighlightLinks.has(`${scene.id}-${choice.id}`)}
                                    {@const isEditingStorylineLink = editingStorylineLinks.has(`${scene.id}-${choice.id}`)}
                                    {@const isActiveStorylineLink = activeStorylineLinks.has(`${scene.id}-${choice.id}`)}
                                    
                                    {@const localStart = { x: startPoint.x - svgBounds.left, y: startPoint.y - svgBounds.top }}
                                    {@const localEnd = { x: endPoint.x - svgBounds.left, y: endPoint.y - svgBounds.top }}
                                    {@const controlPointOffset = Math.max(50, Math.abs(localEnd.x - localStart.x) * 0.4)}
                                    {@const pathData = `M ${localStart.x} ${localStart.y} C ${localStart.x + controlPointOffset} ${localStart.y} ${localEnd.x - controlPointOffset} ${localEnd.y} ${localEnd.x} ${localEnd.y}`}
                                    
                                    <path
                                        class="connection-path"
                                        class:highlighted={isChoiceHighlighted || isStorylineLink}
                                        class:storyline-highlight={isStorylineLink}
                                        class:editing-storyline-link={isEditingStorylineLink}
                                        class:active-storyline-link={isActiveStorylineLink && !isEditingStorylineLink}
                                        id={pathId}
                                        d={pathData}
                                        stroke-dasharray={choice.conditions && choice.conditions.length > 0 ? '4,4' : 'none'}
                                        marker-end="url(#{isEditingStorylineLink ? 'arrowhead-editing-storyline' : (isActiveStorylineLink ? 'arrowhead-active-storyline' : (isStorylineLink ? 'arrowhead-storyline-highlight' : (isChoiceHighlighted ? 'arrowhead-highlighted' : 'arrowhead')))})"
                                    />
                                    {#if choice.conditions && choice.conditions.length > 0}
                                        <text dy="-5" class="condition-text">
                                            <textPath href="#{pathId}" startOffset="50%" text-anchor="middle">
                                                {formatConditions(choice.conditions)}
                                            </textPath>
                                        </text>
                                    {/if}
                                    {#if choice.text}
                                        <text dy="15" class="choice-text">
                                            <textPath href="#{pathId}" startOffset="50%" text-anchor="middle">
                                                {choice.text}
                                            </textPath>
                                        </text>
                                    {/if}
                                {/if}
                            {/if}
                        {/each}
                    {/if}
                {/each}

                <!-- Auto-transition connection lines -->
                {#each Object.values(scenes) as scene (scene.id)}
                    {#if scene.autoTransitionTarget && scenes[scene.autoTransitionTarget]}
                        {@const targetScene = scenes[scene.autoTransitionTarget]}
                        {#if visibleSceneIds.has(scene.id) || visibleSceneIds.has(targetScene.id)}
                            {@const startPoint = getSceneRightCenterAnchorPoint(scene.id)}
                            {@const endPoint = getSceneLeftCenterAnchorPoint(targetScene.id)}
                            {@const isStorylineLink = storylineHighlightLinks.has(`${scene.id}-auto`)}
                            {@const isEditingStorylineLink = editingStorylineLinks.has(`${scene.id}-auto`)}
                            {@const isActiveStorylineLink = activeStorylineLinks.has(`${scene.id}-auto`)}
                            
                            {@const localStart = { x: startPoint.x - svgBounds.left, y: startPoint.y - svgBounds.top }}
                            {@const localEnd = { x: endPoint.x - svgBounds.left, y: endPoint.y - svgBounds.top }}
                            {@const controlPointOffset = Math.max(50, Math.abs(localEnd.x - localStart.x) * 0.4)}
                            {@const pathData = `M ${localStart.x} ${localStart.y} C ${localStart.x + controlPointOffset} ${localStart.y} ${localEnd.x - controlPointOffset} ${localEnd.y} ${localEnd.x} ${localEnd.y}`}
                            
                            <path
                                class="connection-path"
                                class:storyline-highlight={isStorylineLink}
                                class:editing-storyline-link={isEditingStorylineLink}
                                class:active-storyline-link={isActiveStorylineLink && !isEditingStorylineLink}
                                d={pathData}
                                stroke-dasharray="5,5"
                                marker-end="url(#{isEditingStorylineLink ? 'arrowhead-editing-storyline' : (isActiveStorylineLink ? 'arrowhead-active-storyline' : (isStorylineLink ? 'arrowhead-storyline-highlight' : 'arrowhead'))})"
                            />
                        {/if}
                    {/if}
                {/each}

                <!-- Temporary line for linking mode with a curved path -->
                {#if linkingState.active}
                    {@const localSource = { x: sourceNodePosition.x - svgBounds.left, y: sourceNodePosition.y - svgBounds.top }}
                    {@const localMouse = { x: mouseWorldX - svgBounds.left, y: mouseWorldY - svgBounds.top }}
                    {@const midX = (localSource.x + localMouse.x) / 2}
                    {@const pathData = `M ${localSource.x} ${localSource.y} C ${midX} ${localSource.y} ${midX} ${localMouse.y} ${localMouse.x} ${localMouse.y}`}
                    <path 
                        d={pathData}
                        stroke="var(--accent-color)" stroke-width="2.5" stroke-dasharray="5,5" fill="none"
                    />
                {/if}

                <!-- Highlighted path for consistency checker -->
                {#if highlightedPath && highlightedPath.edges}
                    {#each highlightedPath.edges as [sourceId, targetId]}
                        {@const sourceScene = scenes[sourceId]}
                        {@const targetScene = scenes[targetId]}
                        {#if sourceScene && targetScene}
                            {@const startPoint = getSceneCenterPoint(sourceId)}
                            {@const endPoint = getSceneCenterPoint(targetId)}
                            {@const localStart = { x: startPoint.x - svgBounds.left, y: startPoint.y - svgBounds.top }}
                            {@const localEnd = { x: endPoint.x - svgBounds.left, y: endPoint.y - svgBounds.top }}
                            {@const controlPointOffset = Math.max(50, Math.abs(localEnd.x - localStart.x) * 0.4)}
                            {@const pathData = `M ${localStart.x} ${localStart.y} C ${localStart.x + controlPointOffset} ${localStart.y} ${localEnd.x - controlPointOffset} ${localEnd.y} ${localEnd.x} ${localEnd.y}`}
                            <path
                                class="highlight-path"
                                d={pathData}
                                marker-end="url(#arrowhead-highlighted)"
                            />
                        {/if}
                    {/each}
                {/if}
            </g>
        </svg>

        <!-- Render Sequences Behind Scenes -->
        {#if sequences}
            {#each Object.values(sequences) as sequence (sequence.id)}
                <SequenceBox {sequence} {scenes} on:contextmenu={handleSequenceContextMenu} on:dragstart={handleSequenceDragStart} />
            {/each}
        {/if}

        {#each visibleScenes as scene (scene.id)}
            {@const isEditingStorylineNode = editingStoryline && editingStoryline.nodes.includes(scene.id)}
            {@const isActiveStorylineNode = activeStoryline && activeStoryline.nodes.includes(scene.id)}
            {@const storylineIndex = isEditingStorylineNode ? editingStoryline.nodes.indexOf(scene.id) + 1 : (isActiveStorylineNode ? activeStoryline.nodes.indexOf(scene.id) + 1 : null)}
            {@const isInActivePlotThread = activeTaggingPlotThreadId && scene.plotThreadIds && scene.plotThreadIds.includes(activeTaggingPlotThreadId)}
            {@const location = getSceneLocation(scene)}
            <div
                class="scene-node"
                data-id={scene.id}
                style="left: {scene.position.x}px; top: {scene.position.y}px; {scene.color ? `--node-bg: ${scene.color}`: ''}"
                
                on:click|stopPropagation={() => {
                    if (storylineEditMode.active) {
                        projectActions.toggleSceneInStoryline(storylineEditMode.storylineId, scene.id);
                    } else if (activeTaggingPlotThreadId) {
                        projectActions.toggleScenePlotThread(scene.id, activeTaggingPlotThreadId);
                    } else {
                        projectActions.selectScene(scene.id);
                    }
                }}
                on:keydown|stopPropagation={(e) => { if (e.key === 'Enter') storylineEditMode.active ? projectActions.toggleSceneInStoryline(storylineEditMode.storylineId, scene.id) : projectActions.selectScene(scene.id) }}
                
                on:dragenter={(e) => handleDragEnter(e, scene.id)}
                on:dragover={handleDragOver}
                on:dragleave={handleDragLeave}
                on:drop={(e) => handleDrop(e, scene.id)}
                on:mouseenter={() => handleNodeMouseEnter(scene)}
                on:mouseleave={handleNodeMouseLeave}

                role="button"
                tabindex="0"
                class:selected={story.selectedSceneId === scene.id}
                class:linking-target={linkingState.active}
                class:start-node={scene.id === 'start'}
                class:storyline-node={isEditingStorylineNode}
                class:plot-thread-node={isInActivePlotThread}
                class:drop-target={dropTargetSceneId === scene.id}
                class:drop-animation={animatedSceneId === scene.id}
            >
                <div class="node-header">
                    {#if scene.icon}<span class="icon">{scene.icon}</span>{/if}
                    <span class="node-name">{scene.name}</span>
                    {#if storylineIndex}
                        <span class="storyline-index-badge" class:editing={isEditingStorylineNode}>{storylineIndex}</span>
                    {/if}
                </div>
                <div class="plot-threads-indicator">
                    {#each (story.plotThreads || []).filter(pt => scene.plotThreadIds && scene.plotThreadIds.includes(pt.id)) as thread}
                        <div class="plot-dot" style="background-color: {thread.color};" title={thread.name}></div>
                    {/each}
                </div>
                <div class="node-footer">
                    <span class="node-info">💬 {scene.content.filter(i => i.type === 'dialogue').length}</span>
                    <span class="node-info">🔀 {scene.choices.length}</span>
                </div>

                {#if location}
                    <div 
                        class="node-location-badge"
                        on:click|stopPropagation={() => jumpToLocation(location.id)}
                        title="이 장소로 이동 (지도/위키)"
                        role="button"
                        tabindex="0"
                        on:keydown={(e) => e.key === 'Enter' && jumpToLocation(location.id)}
                    >
                        <Icon name="map-pin" size={10} />
                        <span>{location.name}</span>
                    </div>
                {/if}

                {#if $uiState.showVariableRangesOnCanvas}
                    {@const ranges = variableRanges[scene.id] ? Object.entries(variableRanges[scene.id]).filter(([_, range]) => range.min !== null && range.min !== Infinity) : []}
                    {@const issuesForScene = $consistencyIssues.filter(issue => issue.sceneId === scene.id)}
                    {#if ranges.length > 0 || issuesForScene.length > 0}
                        <div class="node-variables">
                            {#each ranges as [varName, range]}
                                <div class="variable-range">
                                    <span class="var-name">{varName}</span>
                                    <span class="var-value">{range.min === range.max ? range.min : `${range.min} ~ ${range.max}`}</span>
                                </div>
                            {/each}
                            {#each issuesForScene as issue}
                                <div class="variable-range issue" title={issue.message}>
                                    <span class="var-name issue-icon"><Icon name="alert-triangle" size={12} />{issue.type}</span>
                                    <span class="var-value">{issue.message.split(':')[1] || issue.message}</span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {/if}

                <button 
                    class="comment-icon-btn" 
                    class:has-comment={scene.comment && scene.comment.trim()}
                    on:click|stopPropagation={() => toggleCommentEditor(scene.id)}
                    title="장면 메모 보기/편집"
                >
                    <Icon 
                        name="message-square"
                        size={16} 
                        color={scene.comment && scene.comment.trim() ? 'var(--accent-color)' : 'var(--text-color-muted)'} 
                    />
                </button>
            </div>
        {/each}

        <!-- Comment Editor Textareas are now outside the transform group -->
    </div>

    <SceneTooltip {story} scene={hoveredScene} position={tooltipPosition} />
</div>

{#if editingCommentSceneId && scenes[editingCommentSceneId]}
    {@const scene = scenes[editingCommentSceneId]}
    
    <div
        class="comment-editor-wrapper"
        style="left: {commentEditorPos.x}px; top: {commentEditorPos.y}px;"
        on:click|stopPropagation
        on:keydown|stopPropagation={() => {}}
    >
        <div class="comment-editor-header" on:mousedown|stopPropagation={handleCommentEditorDragStart}>
            <Icon name="message-square" size={14} />
            <span>장면 메모 - {scene.name}</span>
        </div>
        <textarea
            class="comment-textarea"
            placeholder="장면 메모..."
            value={scene.comment || ''}
            on:input={(e) => projectActions.updateScene(scene.id, { comment: e.target.value }, false)}
            on:change={() => projectActions.commitHistory()}
            on:mousedown|stopPropagation
        ></textarea>
    </div>
{/if}

{#if isContextMenuOpen}
    <ContextMenu 
        x={contextMenuPos.x} 
        y={contextMenuPos.y} 
        items={contextMenuItems}
        on:close={closeContextMenu}
        on:menuaction={handleMenuAction}
    />
{/if}

<div class="fab-container">
    <button 
        class="canvas-fab" 
        on:click|stopPropagation={centerOnStart} 
        title="시작 씬으로 이동 (Home)"
    >
        <Icon name="home" size={24} />
    </button>
    <button 
        class="canvas-fab" 
        on:click|stopPropagation={() => centerOnScene(story.selectedSceneId)} 
        class:disabled={!story.selectedSceneId}
        title="선택된 씬으로 이동"
    >
        <Icon name="crosshair" size={24} />
    </button>
    <button 
        class="canvas-fab" 
        class:active={$uiState.showVariableRangesOnCanvas}
        on:click|stopPropagation={() => uiState.toggleShowVariableRangesOnCanvas()} 
        title="캔버스에 변수 정보 표시/숨기기"
    >
        <Icon name="bar-chart-2" size={24} />
    </button>
    <button class="canvas-fab add-scene-fab" on:click={() => projectActions.addScene()} title="새 씬 추가">
        <Icon name="plus" size={24} />
    </button>
</div>

<style>
    .story-canvas {
        position: relative;
        width: 100%;
        height: 100%;
        background-color: var(--primary-bg);
        /* Dot Grid Pattern */
        background-image: radial-gradient(var(--border-color) 1px, transparent 1px);
        background-size: 20px 20px;
        /* Dynamic background position handled via inline style in the logic below if needed, 
           but since we transform the content group, static background is fine for "infinite canvas" feel 
           if the background itself doesn't move.
           However, to make the dots move with the canvas, we need to update background-position.
        */
        overflow: hidden;
        cursor: default;
    }
    /* Add logic to update background-position based on viewTransform */
    
    .fab-container {
        position: absolute;
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        z-index: 100;
        transition: right 0.3s ease, bottom 0.3s ease; /* Animate right property */
    }
    
    @media (max-width: 768px) {
        .fab-container {
            bottom: 100px; /* Lift FABs above the dock on mobile */
            right: 16px; /* Slightly closer to edge */
        }
        
        .canvas-fab {
            width: 48px; height: 48px; /* Slightly smaller on mobile */
        }
    }

    .canvas-fab {
        width: 56px;
        height: 56px;
        border-radius: 20px; /* Softer corners */
        background-color: var(--secondary-bg);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--transition-speed);
    }
    .canvas-fab:hover {
        border-color: var(--accent-color);
        color: var(--accent-color);
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.15);
    }
    .canvas-fab.active {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
        color: white;
    }
    .canvas-fab.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        filter: grayscale(1);
    }
    .add-scene-fab {
        background-color: var(--accent-color);
        color: white;
        border: none;
    }
    .add-scene-fab:hover {
        background-color: var(--accent-color-dark);
        color: white;
        box-shadow: 0 6px 16px rgba(var(--accent-rgb), 0.4);
    }
    .story-canvas.panning {
        cursor: grab;
    }
    .story-canvas.storyline-editing {
        cursor: crosshair;
    }
    .story-canvas.plot-thread-tagging {
        cursor: copy;
    }

    .canvas-transform-group {
        width: 100%;
        height: 100%;
        transform-origin: 0 0;
    }

    .connection-svg {
        position: absolute;
        pointer-events: none; /* Allows clicks to pass through to nodes */
    }

    .connection-path {
        stroke: var(--text-color-muted);
        stroke-width: 2px;
        fill: none;
        transition: stroke 0.2s, stroke-width 0.2s;
        opacity: 0.6;
    }
    .connection-path.highlighted {
        stroke: var(--accent-color);
        stroke-width: 3.5px;
        opacity: 1;
    }

    .connection-path.storyline-highlight {
        stroke: var(--storyline-color);
        stroke-width: 4px;
        opacity: 1;
    }

    .connection-path.editing-storyline-link {
        stroke: var(--success-color);
        stroke-width: 3.5px;
        opacity: 1;
    }

    .connection-path.active-storyline-link {
        stroke: var(--accent-color);
        stroke-width: 3px;
        opacity: 1;
    }

    .highlight-path {
        stroke: #FFD700; /* Bright Gold/Yellow */
        stroke-width: 4px;
        stroke-dasharray: 8 4;
        fill: none;
        animation: dash-flow 0.5s linear infinite;
    }

    @keyframes dash-flow {
        to {
            stroke-dashoffset: -12;
        }
    }

    .condition-text {
        font-size: 11px;
        fill: var(--text-color);
        paint-order: stroke;
        stroke: var(--primary-bg);
        stroke-width: 4px;
        stroke-linecap: butt;
        stroke-linejoin: miter;
        font-weight: 500;
    }

    .choice-text {
        font-size: 10px;
        fill: var(--text-color-muted);
        font-style: italic;
        paint-order: stroke;
        stroke: var(--primary-bg);
        stroke-width: 4px;
        stroke-linecap: butt;
        stroke-linejoin: miter;
    }

    .scene-node {
        position: absolute;
        background-color: var(--node-bg, var(--node-bg-default));
        border: 1px solid var(--node-border);
        border-radius: 12px; /* Increased radius */
        padding: 10px 14px;
        cursor: pointer;
        user-select: none;
        min-width: 160px;
        /* Improved shadow for depth */
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0,0,0,0.05);
        transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s, border-color 0.2s;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .scene-node.drop-target {
        box-shadow: 0 0 0 4px var(--accent-color), 0 0 20px var(--accent-color);
    }
    .scene-node.drop-animation {
        animation: drop-pulse 0.5s ease-out;
    }
    @keyframes drop-pulse {
        0% {
            transform: scale(1);
            box-shadow: 0 0 0 4px var(--accent-color);
        }
        50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent-color) 50%, transparent);
        }
        100% {
            transform: scale(1);
            box-shadow: 0 0 0 4px var(--accent-color);
        }
    }
    .node-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-weight: 600;
        position: relative; /* For badge positioning */
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color); /* Separator */
        margin-bottom: 2px;
    }
    .plot-threads-indicator {
        display: flex;
        justify-content: center;
        gap: 4px;
        position: absolute;
        top: -6px; /* Moved to top */
        right: -6px;
    }
    .plot-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid var(--node-bg-default); /* Stroke to separate from node */
    }
    .node-footer {
        display: flex;
        justify-content: space-around;
        font-size: 0.8em;
        color: var(--text-color-muted);
        padding-top: 4px;
        width: 100%;
    }
    
    .node-location-badge {
        position: absolute;
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        background-color: var(--secondary-bg); /* Use solid background to cover connection lines */
        color: var(--accent-color);
        font-size: 0.7em;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 600;
        border: 1px solid var(--border-color);
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        white-space: nowrap;
        max-width: 90%;
        overflow: hidden;
        text-overflow: ellipsis;
        z-index: 5;
        transition: all 0.2s;
    }
    .node-location-badge:hover {
        background-color: var(--accent-color);
        color: white;
        border-color: var(--accent-color);
        z-index: 20;
    }

    .node-variables {
        font-size: 0.75em;
        color: var(--text-color-muted);
        border-top: 1px dashed var(--border-color);
        padding-top: 6px;
        margin-top: 6px;
    }
    .variable-range {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .variable-range .var-name {
        font-weight: 500;
    }
    .variable-range .var-value {
        font-family: monospace;
        background-color: var(--primary-bg);
        padding: 1px 4px;
        border-radius: 4px;
    }
    .variable-range.issue {
        background-color: var(--danger-color-light);
        color: var(--danger-color);
        padding: 2px 4px;
        margin: 2px -4px;
        border-radius: 4px;
    }
    .variable-range.issue .var-name {
        color: var(--danger-color);
    }
    .variable-range.issue .var-value {
        background-color: var(--danger-color-light);
        color: var(--danger-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100px;
    }
    .issue-icon {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .node-info {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .icon {
        font-size: 1.2em;
    }

    .scene-node.start-node {
        border-width: 2px;
        border-color: var(--accent-color);
    }

    .scene-node:focus {
        outline: none;
        border-color: var(--accent-color);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color) 20%, transparent);
    }

    .scene-node:hover {
        border-color: var(--accent-color);
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(0,0,0,0.12);
        z-index: 10;
    }

    .scene-node.selected {
        border-color: var(--accent-color);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color) 30%, transparent), 0 4px 12px rgba(0,0,0,0.1);
        z-index: 11;
    }
    
    .scene-node.linking-target:hover {
        background-color: color-mix(in srgb, var(--accent-color) 10%, transparent);
    }

    .scene-node.storyline-node {
        border-color: var(--success-color);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--success-color) 30%, transparent);
    }
    .storyline-editing .scene-node:not(.storyline-node) {
        opacity: 0.5;
        filter: grayscale(100%);
        cursor: crosshair;
    }
    .storyline-editing .scene-node.storyline-node {
        cursor: crosshair;
    }
    .plot-thread-tagging .scene-node:not(.plot-thread-node) {
        opacity: 0.6;
    }
    .plot-thread-tagging .scene-node.plot-thread-node {
        border-color: var(--accent-color);
        box-shadow: 0 0 0 3.5px var(--accent-color);
    }


    .storyline-index-badge {
        position: absolute;
        top: -12px;
        left: -12px;
        background-color: var(--accent-color);
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8em;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        border: 2px solid white;
    }
    .storyline-index-badge.editing {
        background-color: var(--success-color);
    }

    .scene-node:active {
        cursor: grabbing;
        transform: scale(0.98);
    }

    .comment-icon-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        background: none;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        padding: 0;
        color: var(--text-color-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--transition-speed);
    }
    .comment-icon-btn:hover {
        background-color: var(--secondary-bg);
        color: var(--accent-color);
    }
    .comment-icon-btn.has-comment {
        background-color: rgba(var(--accent-color-rgb), 0.15);
        box-shadow: 0 0 8px rgba(var(--accent-color-rgb), 0.6);
        color: var(--accent-color);
    }
    
    .comment-editor-wrapper {
        position: absolute;
        z-index: 20;
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        resize: both;
        overflow: auto;
        width: 200px;
        height: 140px;
        min-width: 140px;
        min-height: 100px;
        animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

    .comment-editor-header {
        padding: 6px 10px;
        background-color: var(--primary-bg);
        cursor: grab;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85em;
        font-weight: 600;
        color: var(--text-color);
    }
    .comment-editor-header:active {
        cursor: grabbing;
    }
    .comment-textarea {
        width: 100%;
        flex-grow: 1;
        min-height: 0;
        border: none;
        background-color: transparent;
        color: var(--text-color);
        padding: 10px;
        font-family: inherit;
        font-size: 13px;
        resize: none;
        line-height: 1.5;
        transition: all 0.2s;
    }
    .comment-textarea:focus {
        outline: none;
        background-color: rgba(var(--accent-rgb), 0.05);
    }
</style>
