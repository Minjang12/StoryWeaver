<script>
    import { uiState } from './stores.js';
    import Icon from './Icon.svelte';

    export let widgetId;
    export let title;
    export let widgetState;
    export let isDockable = true; // MIMINYAN: Add isDockable prop

    let headerElement;
    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };
    let sidebarWidth;
    uiState.subscribe(s => sidebarWidth = s.sidebarWidth);

    function handleMouseDown(event) {
        // Only drag with left mouse button, and not on buttons inside the header
        if (event.button !== 0 || event.target.closest('button')) {
            return;
        }
        isDragging = true;
        lastMousePos = { x: event.clientX, y: event.clientY };
        uiState.focusWidget(widgetId);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(event) {
        if (!isDragging) return;

        // Check if dragging over the sidebar area to re-dock
        if (event.clientX < sidebarWidth) {
            uiState.dockWidget(widgetId);
            // No need to call handleMouseUp, docking will stop the drag
            return;
        }

        const dx = event.clientX - lastMousePos.x;
        const dy = event.clientY - lastMousePos.y;
        lastMousePos = { x: event.clientX, y: event.clientY };
        uiState.moveWidget(widgetId, dx, dy);
    }

    function handleMouseUp(event) {
        isDragging = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        // Final check on mouse up position
        if (event.clientX < sidebarWidth) {
            uiState.dockWidget(widgetId);
        }
    }

    function close() {
        // On mobile, "docking" is equivalent to closing the bottom sheet.
        uiState.dockWidget(widgetId);
    }
</script>

{#if $uiState.isMobileView}
    <div 
        class="bottom-sheet-overlay" 
        on:click={close}
        on:keydown={(e) => e.key === 'Enter' && close()}
        role="button"
        tabindex="0"
    ></div>
    <div class="bottom-sheet">
        <div class="widget-header">
            <span class="widget-title">{title}</span>
            <div class="widget-controls">
                <button on:click={close} title="닫기" class="icon-btn">
                    <Icon name="x" size={20} />
                </button>
            </div>
        </div>
        <div class="widget-body">
            <slot></slot>
        </div>
    </div>
{:else}
    <div 
        class="floating-widget" 
        style="left: {widgetState.x}px; top: {widgetState.y}px; z-index: {widgetState.z};"
        on:mousedown={() => uiState.focusWidget(widgetId)}
    >
        <div class="widget-header" bind:this={headerElement} on:mousedown={handleMouseDown}>
            <span class="widget-title">{title}</span>
            <div class="widget-controls">
                {#if isDockable}
                    <button on:click={() => uiState.dockWidget(widgetId)} title="사이드바에 고정" class="icon-btn">
                        <Icon name="sidebar" size={16} />
                    </button>
                {:else}
                    <button on:click={() => uiState.toggleWidget(widgetId)} title="닫기" class="icon-btn">
                        <Icon name="x" size={16} />
                    </button>
                {/if}
            </div>
        </div>
        <div class="widget-body">
            <slot></slot>
        </div>
    </div>
{/if}

<style>
    /* --- Desktop Styles --- */
    .floating-widget {
        position: fixed;
        width: 320px;
        background-color: var(--sidebar-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        display: flex;
        flex-direction: column;
    }
    .floating-widget:focus-within {
        border-color: var(--accent-color);
    }
    .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background-color: var(--secondary-bg);
        border-bottom: 1px solid var(--border-color);
        user-select: none;
    }
    .floating-widget .widget-header {
        cursor: grab;
        border-radius: var(--border-radius) var(--border-radius) 0 0;
    }
    .floating-widget .widget-header:active {
        cursor: grabbing;
    }
    .widget-title {
        font-weight: 600;
    }
    .widget-controls .icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        background-color: transparent; border: none;
        color: var(--text-color-muted); width: 28px; height: 28px;
        padding: 0; border-radius: var(--border-radius); cursor: pointer;
        transition: all var(--transition-speed);
    }
    .widget-controls .icon-btn:hover { 
        background-color: var(--primary-bg);
        color: var(--accent-color); 
    }
    .widget-body {
        padding: 12px;
        overflow-y: auto;
        max-height: 400px;
    }

    /* --- Mobile Styles --- */
    .bottom-sheet-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.6);
        z-index: 299;
        animation: fade-in 0.3s ease;
    }

    .bottom-sheet {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        max-height: 80vh;
        background-color: var(--sidebar-bg);
        border-top-left-radius: 16px;
        border-top-right-radius: 16px;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
        z-index: 300;
        display: flex;
        flex-direction: column;
        animation: slide-up 0.3s ease-out;
    }

    .bottom-sheet .widget-header {
        border-top-left-radius: 16px;
        border-top-right-radius: 16px;
    }

    .bottom-sheet .widget-body {
        max-height: calc(80vh - 50px); /* 50px is approx header height */
        touch-action: pan-y; /* Allow vertical scroll inside the sheet */
    }

    @keyframes slide-up {
        from {
            transform: translateY(100%);
        }
        to {
            transform: translateY(0);
        }
    }

    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
</style>
