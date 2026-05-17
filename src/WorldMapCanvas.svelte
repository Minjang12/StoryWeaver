<script>
    import {
        projectActions,
        uiState,
        notifications,
        activeProject,
    } from "./stores.js";
    import { onMount, tick } from "svelte";
    import { get } from "svelte/store";
    import Icon from "./Icon.svelte";
    import { createUniqueId } from "./utils.js"; // MIMINYAN: Import createUniqueId
    import MapSidePanel from "./MapSidePanel.svelte"; // MIMINYAN: Import Palette

    export let story;

    $: mapData = story.mapData || {
        background: null,
        markers: [],
        connections: [],
    };
    $: viewTransform = story.viewTransform || { scale: 1, x: 0, y: 0 };
    $: locations = story.locations || [];
    $: connections = mapData.connections || []; // Ensure it defaults to array

    let canvasElement;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    let isDraggingMarker = false;
    let draggedMarkerId = null;
    let dragOffset = { x: 0, y: 0 };

    let selectedMarkerId = null; // To show linked scenes

    // Connection State
    let isConnecting = false;
    let connectionStartMarkerId = null;
    let mouseWorldPos = { x: 0, y: 0 }; // For drawing the active connection line

    async function setBackground() {
        if (window.electronAPI) {
            const result = await window.electronAPI.openImageFile();
            if (result.success && result.filePath) {
                projectActions.setMapBackground(result.filePath);
            }
        }
    }

    function getViewToWorld(clientX, clientY) {
        if (!canvasElement) return { x: 0, y: 0 };
        const rect = canvasElement.getBoundingClientRect();
        return {
            x: (clientX - rect.left - viewTransform.x) / viewTransform.scale,
            y: (clientY - rect.top - viewTransform.y) / viewTransform.scale,
        };
    }

    function handleMouseDown(e) {
        if (isConnecting) {
            // Handled in click, but prevent drag start
            return;
        }

        if (e.target.closest(".map-marker")) {
            const markerNode = e.target.closest(".map-marker");
            const markerId = markerNode.dataset.id;

            // Toggle selection
            if (selectedMarkerId === markerId) {
                // keep selected to allow drag
            } else {
                selectedMarkerId = markerId;
            }

            isDraggingMarker = true;
            draggedMarkerId = markerId;
            const marker = mapData.markers.find(
                (m) => m.id === draggedMarkerId,
            );
            const worldPos = getViewToWorld(e.clientX, e.clientY);
            dragOffset = { x: worldPos.x - marker.x, y: worldPos.y - marker.y };
            e.stopPropagation();
            return;
        }

        // Deselect if clicking empty space
        selectedMarkerId = null;

        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
    }

    function handleMouseMove(e) {
        const worldPos = getViewToWorld(e.clientX, e.clientY);
        mouseWorldPos = worldPos;

        if (isDraggingMarker && draggedMarkerId) {
            projectActions.updateMapMarker(draggedMarkerId, {
                x: worldPos.x - dragOffset.x,
                y: worldPos.y - dragOffset.y,
            });
            return;
        }

        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            projectActions.updateViewTransform({
                x: viewTransform.x + dx,
                y: viewTransform.y + dy,
            });
            panStart = { x: e.clientX, y: e.clientY };
        }
    }

    function handleMouseUp() {
        isPanning = false;
        isDraggingMarker = false;
        draggedMarkerId = null;
    }

    function handleWheel(e) {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.max(
            0.1,
            Math.min(5, viewTransform.scale + scaleAmount),
        );

        const worldPos = getViewToWorld(e.clientX, e.clientY);
        const newX =
            viewTransform.x +
            (worldPos.x * viewTransform.scale - worldPos.x * newScale);
        const newY =
            viewTransform.y +
            (worldPos.y * viewTransform.scale - worldPos.y * newScale);

        projectActions.updateViewTransform({
            scale: newScale,
            x: newX,
            y: newY,
        });
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent App.svelte from handling this
        const type = e.dataTransfer.getData("type");
        const id = e.dataTransfer.getData("id");

        if (!id) return;

        if (type === "location") {
            const worldPos = getViewToWorld(e.clientX, e.clientY);
            projectActions.addMapMarker(id, worldPos.x, worldPos.y);
        } else if (type === "scene") {
            // Check if dropped on a marker
            const targetMarker = e.target.closest(".map-marker");
            if (targetMarker) {
                const markerId = targetMarker.dataset.id;
                const marker = mapData.markers.find((m) => m.id === markerId);
                if (marker) {
                    projectActions.toggleSceneReference(id, marker.wikiId);
                    // Open the marker info to show the link
                    selectedMarkerId = markerId;
                }
            }
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent App.svelte from overriding dropEffect
        if (e.target.closest(".map-marker")) {
            e.dataTransfer.dropEffect = "link";
        } else {
            e.dataTransfer.dropEffect = "copy";
        }
    }

    function removeMarker(id) {
        projectActions.removeMapMarker(id);
        if (selectedMarkerId === id) selectedMarkerId = null;
    }

    // Helper to get linked scenes
    function getLinkedScenes(wikiId) {
        return Object.values(story.scenes).filter((s) =>
            (s.referencedWikiIds || []).includes(wikiId),
        );
    }

    function jumpToScene(scene) {
        // 1. Select the scene
        projectActions.selectScene(scene.id);

        // 2. Switch to Flow View
        // Note: StoryCanvas will automatically center on the selected scene when mounted.
        uiState.setView("canvas");
    }

    function createNewSceneAtLocation(wikiId) {
        // 1. Create Scene
        projectActions.addScene({ position: { x: 100, y: 100 } }); // Default pos

        // Wait for store update
        setTimeout(() => {
            const currentProject = get(activeProject);
            if (currentProject && currentProject.story) {
                const newSceneId = currentProject.story.selectedSceneId;
                if (newSceneId) {
                    projectActions.toggleSceneReference(newSceneId, wikiId);
                    notifications.add(
                        "새 씬이 생성되고 장소와 연결되었습니다.",
                        "success",
                    );

                    const newScene = currentProject.story.scenes[newSceneId];
                    if (newScene) jumpToScene(newScene);
                }
            }
        }, 50);
    }

    function startConnection(markerId) {
        isConnecting = true;
        connectionStartMarkerId = markerId;
        selectedMarkerId = null; // Close popover
        notifications.add("연결할 다른 핀을 클릭하세요. (취소: ESC)", "info");
    }

    function completeConnection(targetMarkerId) {
        if (!isConnecting || !connectionStartMarkerId) return;

        if (connectionStartMarkerId === targetMarkerId) {
            notifications.add("자기 자신과는 연결할 수 없습니다.", "warning");
            return;
        }

        // Check if already connected
        const exists = connections.some(
            (c) =>
                (c.fromId === connectionStartMarkerId &&
                    c.toId === targetMarkerId) ||
                (c.fromId === targetMarkerId &&
                    c.toId === connectionStartMarkerId),
        );

        if (exists) {
            notifications.add("이미 연결되어 있습니다.", "warning");
            cancelConnection();
            return;
        }

        const newConnection = {
            id: createUniqueId("conn"),
            fromId: connectionStartMarkerId,
            toId: targetMarkerId,
        };

        const newConnections = [...connections, newConnection];
        projectActions.updateActiveStory((story) => ({
            ...story,
            mapData: { ...story.mapData, connections: newConnections },
        }));

        cancelConnection();
    }

    function cancelConnection() {
        isConnecting = false;
        connectionStartMarkerId = null;
    }

    function deleteConnection(connectionId) {
        const newConnections = connections.filter((c) => c.id !== connectionId);
        projectActions.updateActiveStory((story) => ({
            ...story,
            mapData: { ...story.mapData, connections: newConnections },
        }));
    }

    function openWikiForMarker(wikiId) {
        uiState.openWikiModal(wikiId, "location");
    }

    function handleKeyDown(e) {
        if (e.key === "Escape" && isConnecting) {
            cancelConnection();
        }
    }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
    class="world-map-canvas"
    bind:this={canvasElement}
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    on:mouseleave={handleMouseUp}
    on:wheel={handleWheel}
    on:drop={handleDrop}
    on:dragover={handleDragOver}
>
    <!-- Map Palette -->
    <MapSidePanel {story} />

    <div
        class="map-content"
        style="transform: translate({viewTransform.x}px, {viewTransform.y}px) scale({viewTransform.scale});"
    >
        {#if mapData.background}
            <img
                src={mapData.background}
                alt="Map Background"
                class="map-bg"
                draggable="false"
            />
        {:else}
            <div class="empty-map-placeholder">
                <p>지도 이미지가 없습니다.</p>
                <button on:click={setBackground} class="primary-btn"
                    >이미지 불러오기</button
                >
            </div>
        {/if}

        <!-- Connection Lines -->
        <svg
            class="connections-layer"
            style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible;"
        >
            <defs>
                <marker
                    id="arrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="28"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                >
                    <path d="M0,0 L0,6 L9,3 z" fill="#888" />
                </marker>
            </defs>
            {#each connections as conn (conn.id)}
                {@const fromMarker = mapData.markers.find(
                    (m) => m.id === conn.fromId,
                )}
                {@const toMarker = mapData.markers.find(
                    (m) => m.id === conn.toId,
                )}
                {#if fromMarker && toMarker}
                    <line
                        x1={fromMarker.x}
                        y1={fromMarker.y - 20}
                        x2={toMarker.x}
                        y2={toMarker.y - 20}
                        stroke="#888"
                        stroke-width="2"
                        stroke-dasharray="5,5"
                    />
                {/if}
            {/each}

            {#if isConnecting && connectionStartMarkerId}
                {@const startMarker = mapData.markers.find(
                    (m) => m.id === connectionStartMarkerId,
                )}
                {#if startMarker}
                    <line
                        x1={startMarker.x}
                        y1={startMarker.y - 20}
                        x2={mouseWorldPos.x}
                        y2={mouseWorldPos.y}
                        stroke="#ffd700"
                        stroke-width="2"
                        stroke-dasharray="5,5"
                    />
                {/if}
            {/if}
        </svg>

        {#each mapData.markers as marker (marker.id)}
            {@const location = locations.find((l) => l.id === marker.wikiId)}
            {@const linkedScenes = getLinkedScenes(marker.wikiId)}
            {#if location}
                <div
                    class="map-marker"
                    class:selected={selectedMarkerId === marker.id}
                    class:connecting-target={isConnecting &&
                        connectionStartMarkerId !== marker.id}
                    style="left: {marker.x}px; top: {marker.y}px;"
                    data-id={marker.id}
                    role="button"
                    tabindex="0"
                    on:click|stopPropagation={() => {
                        if (isConnecting) {
                            completeConnection(marker.id);
                        }
                    }}
                    on:keydown={(e) => {
                        if (
                            (e.key === "Enter" || e.key === " ") &&
                            isConnecting
                        ) {
                            completeConnection(marker.id);
                            e.preventDefault();
                        }
                    }}
                >
                    <div class="marker-pin">
                        <Icon
                            name="map-pin"
                            size={24}
                            color={selectedMarkerId === marker.id
                                ? "#ffd700"
                                : isConnecting &&
                                    connectionStartMarkerId === marker.id
                                  ? "#ffd700"
                                  : "#e63946"}
                        />
                    </div>
                    <div class="marker-label">
                        <span class="marker-name">{location.name}</span>
                        {#if linkedScenes.length > 0}
                            <span class="scene-count-badge" title="연결된 씬 수"
                                >{linkedScenes.length}</span
                            >
                        {/if}
                    </div>

                    {#if selectedMarkerId === marker.id}
                        {@const markerConnections = connections.filter(
                            (c) =>
                                c.fromId === marker.id || c.toId === marker.id,
                        )}
                        <div
                            class="marker-popover"
                            on:mousedown|stopPropagation
                        >
                            <div class="popover-header">
                                <span>{location.name}</span>
                                <div class="header-actions">
                                    <button
                                        class="icon-btn tiny"
                                        on:click={() =>
                                            startConnection(marker.id)}
                                        title="다른 핀과 연결"
                                    >
                                        <Icon name="share-2" size={12} />
                                    </button>
                                    <button
                                        class="icon-btn tiny"
                                        on:click={() =>
                                            openWikiForMarker(marker.wikiId)}
                                        title="위키 열기"
                                    >
                                        <Icon name="book" size={12} />
                                    </button>
                                    <button
                                        class="close-btn"
                                        on:click={() =>
                                            (selectedMarkerId = null)}
                                        ><Icon name="x" size={12} /></button
                                    >
                                </div>
                            </div>
                            <div class="popover-body">
                                <div class="popover-section-title">
                                    연결된 씬
                                </div>
                                {#each linkedScenes as scene}
                                    <div
                                        class="popover-scene-item clickable"
                                        on:click={() => jumpToScene(scene)}
                                        on:keydown={(e) =>
                                            e.key === "Enter" &&
                                            jumpToScene(scene)}
                                        role="button"
                                        tabindex="0"
                                    >
                                        <span class="scene-name"
                                            >{scene.name}</span
                                        >
                                        <button
                                            class="unlink-btn"
                                            on:click|stopPropagation={() =>
                                                projectActions.toggleSceneReference(
                                                    scene.id,
                                                    marker.wikiId,
                                                )}
                                            title="연결 해제"
                                            ><Icon
                                                name="minus-circle"
                                                size={12}
                                            /></button
                                        >
                                    </div>
                                {/each}
                                {#if linkedScenes.length === 0}
                                    <div class="empty-text">연결된 씬 없음</div>
                                {/if}

                                <!-- Pin Connections -->
                                <div
                                    class="popover-section-title"
                                    style="margin-top: 10px; border-top: 1px dashed #444; padding-top: 5px;"
                                >
                                    연결된 핀
                                </div>
                                {#each markerConnections as conn}
                                    {@const otherId =
                                        conn.fromId === marker.id
                                            ? conn.toId
                                            : conn.fromId}
                                    {@const otherMarker = mapData.markers.find(
                                        (m) => m.id === otherId,
                                    )}
                                    {@const otherLoc = locations.find(
                                        (l) => l.id === otherMarker?.wikiId,
                                    )}
                                    {#if otherMarker && otherLoc}
                                        <div class="popover-scene-item">
                                            <span class="scene-name"
                                                >{otherLoc.name}</span
                                            >
                                            <button
                                                class="unlink-btn"
                                                on:click|stopPropagation={() =>
                                                    deleteConnection(conn.id)}
                                                title="연결 삭제"
                                                ><Icon
                                                    name="minus-circle"
                                                    size={12}
                                                /></button
                                            >
                                        </div>
                                    {/if}
                                {/each}

                                <button
                                    class="create-scene-btn"
                                    on:click={() =>
                                        createNewSceneAtLocation(marker.wikiId)}
                                >
                                    <Icon name="plus-circle" size={12} /> 이 장소에서
                                    씬 시작
                                </button>
                            </div>
                            <div class="popover-footer">
                                <button
                                    class="delete-marker-text-btn"
                                    on:click={() => removeMarker(marker.id)}
                                >
                                    핀 삭제
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        {/each}
    </div>

    <div class="map-controls">
        <button on:click={setBackground} title="배경 이미지 변경">
            <Icon name="image" size={20} />
        </button>
    </div>
</div>

<style>
    .world-map-canvas {
        width: 100%;
        height: 100%;
        background-color: #222;
        overflow: hidden;
        position: relative;
        cursor: grab;
    }
    .world-map-canvas:active {
        cursor: grabbing;
    }

    .map-content {
        transform-origin: 0 0;
        position: absolute;
        top: 0;
        left: 0;
    }

    .map-bg {
        pointer-events: none;
        user-select: none;
    }

    .empty-map-placeholder {
        width: 800px;
        height: 600px;
        border: 2px dashed #444;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #888;
        background: rgba(255, 255, 255, 0.05);
    }

    .map-marker {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%); /* Anchor at bottom center of pin */
        cursor: pointer;
        z-index: 10;
        transition: transform 0.1s;
    }
    .map-marker:hover {
        z-index: 20;
        transform: translate(-50%, -100%) scale(1.1);
    }
    .map-marker.selected {
        z-index: 30;
    }
    .map-marker.connecting-target {
        cursor: crosshair;
    }
    .map-marker.connecting-target .marker-pin {
        filter: drop-shadow(0 0 5px #ffd700);
        transform: scale(1.1);
    }

    .marker-pin {
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
    }

    .marker-label {
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.85em;
        margin-top: 2px;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .scene-count-badge {
        background: var(--accent-color);
        color: white;
        border-radius: 10px;
        padding: 0 5px;
        font-size: 0.8em;
        font-weight: bold;
        min-width: 16px;
        text-align: center;
    }

    /* Popover Styles */
    .marker-popover {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        width: 200px;
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        cursor: default;
    }
    .popover-header {
        padding: 8px 10px;
        background: var(--primary-bg);
        border-bottom: 1px solid var(--border-color);
        font-weight: bold;
        font-size: 0.9em;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 8px 8px 0 0;
    }
    .header-actions {
        display: flex;
        gap: 5px;
        align-items: center;
    }
    .popover-body {
        padding: 5px;
        max-height: 200px;
        overflow-y: auto;
    }
    .popover-section-title {
        font-size: 0.75em;
        color: var(--text-color-muted);
        margin: 5px 5px 2px 5px;
        font-weight: bold;
    }
    .popover-scene-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        font-size: 0.85em;
        background: var(--primary-bg);
        border-radius: 4px;
        margin-bottom: 4px;
        transition: background 0.2s;
    }
    .popover-scene-item.clickable {
        cursor: pointer;
    }
    .popover-scene-item.clickable:hover {
        background: var(--secondary-bg);
        color: var(--accent-color);
    }
    .scene-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 140px;
    }

    .close-btn,
    .unlink-btn,
    .icon-btn {
        background: none;
        border: none;
        padding: 2px;
        cursor: pointer;
        color: var(--text-color-muted);
    }
    .close-btn:hover,
    .unlink-btn:hover {
        color: var(--danger-color);
    }
    .icon-btn:hover {
        color: var(--accent-color);
    }
    .tiny {
        padding: 2px;
    }

    .create-scene-btn {
        width: 100%;
        margin-top: 5px;
        padding: 6px;
        background: rgba(var(--accent-rgb), 0.1);
        border: 1px dashed var(--accent-color);
        color: var(--accent-color);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        transition: all 0.2s;
    }
    .create-scene-btn:hover {
        background: var(--accent-color);
        color: white;
        border-style: solid;
    }

    .popover-footer {
        padding: 8px;
        border-top: 1px solid var(--border-color);
        text-align: center;
    }
    .delete-marker-text-btn {
        background: none;
        border: none;
        color: var(--danger-color);
        font-size: 0.8em;
        cursor: pointer;
        text-decoration: underline;
    }
    .empty-text {
        padding: 10px;
        text-align: center;
        color: var(--text-color-muted);
        font-size: 0.8em;
        line-height: 1.4;
    }

    .map-controls {
        position: absolute;
        top: 20px;
        right: 20px;
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        padding: 8px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .map-controls button {
        background: transparent;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
    }
    .map-controls button:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .primary-btn {
        margin-top: 15px;
        padding: 10px 20px;
        background: var(--accent-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
</style>
