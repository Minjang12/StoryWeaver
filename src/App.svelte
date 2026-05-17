<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { projectActions, activeProject, activeStory, theme, uiState, confirmation } from './stores.js';
	import Header from './Header.svelte';
    import Icon from './Icon.svelte';
	import SceneEditor from './SceneEditor.svelte';
	import StoryCanvas from './StoryCanvas.svelte';
    import WorldMapCanvas from './WorldMapCanvas.svelte'; // MIMINYAN: Import Map Canvas
	import TimelineView from './TimelineView.svelte';
    import CharacterStudio from './CharacterStudio.svelte'; // MIMINYAN: Import CharacterStudio
    import CanvasDock from './CanvasDock.svelte'; // MIMINYAN: Global Dock
	import ProjectModal from './ProjectModal.svelte';
	import CommandPalette from './CommandPalette.svelte';


	        import SettingsModal from './SettingsModal.svelte';	
	    let state;
	    uiState.subscribe(s => state = s);
	    
	    let story;
	    activeStory.subscribe(s => story = s);

        let isCharacterPaletteVisible = false;

		import ConfirmModal from './ConfirmModal.svelte';
		import FloatingWidget from './FloatingWidget.svelte';
		import CustomizationPalette from './CustomizationPalette.svelte';
		import CharacterPalette from './CharacterPalette.svelte';
				import VariablePalette from './VariablePalette.svelte';
				import StorylineViewerModal from './StorylineViewerModal.svelte';			import DialoguesEditor from './DialoguesEditor.svelte';
			import ChoicesEditor from './ChoicesEditor.svelte';
			import AnalyticsModal from './AnalyticsModal.svelte';
			import CharacterSheetModal from './CharacterSheetModal.svelte';
			import InputModal from './InputModal.svelte';
            import SceneContextSidebar from './SceneContextSidebar.svelte'; // MIMINYAN: Import Context Sidebar

		
			import Notification from './Notification.svelte';

			import AnnotationManagerModal from './AnnotationManagerModal.svelte';
				import WikiModal from './WikiModal.svelte';
				import PlotThreadModal from './PlotThreadModal.svelte';
				import GoalSettingModal from './GoalSettingModal.svelte'; // MIMINYAN: Import the new modal
                import GuideModal from './GuideModal.svelte'; // MIMINYAN: Import GuideModal
				import StateManagerModal from './StateManagerModal.svelte';
				
				$: activeScene = ($activeStory && $activeStory.selectedSceneId) 
					? $activeStory.scenes[$activeStory.selectedSceneId] 
					: null;		
			$: editingCharacter = ($uiState.editingCharacterId && $activeStory?.characters)
				? $activeStory.characters.find(c => c.id === $uiState.editingCharacterId)
				: null;
		
			let mainViewWidth;
			$: mainViewWidth = `calc(100% - ${$uiState.sidebarWidth}px)`;
		
			let sidebarResizing = false;
		
			function handleMouseMove(event) {
				if (sidebarResizing) {
					uiState.setSidebarWidth(event.clientX);
				}
			}
		
			function handleMouseUp() {
				sidebarResizing = false;
			}
		
			function handleDragOver(event) {
				event.preventDefault();
				event.dataTransfer.dropEffect = 'move';
			}
		
			function handleDrop(event) {
				event.preventDefault();
				const widgetId = event.dataTransfer.getData('text/plain');
				if (widgetId && $uiState.widgets[widgetId]) {
					// Position the widget centered on the drop location
					const x = event.clientX - 160; // 160 is half of the default widget width
					const y = event.clientY - 20;  // 20 is roughly half the header height
					uiState.undockWidget(widgetId, x, y);
				}
			}
		
			onMount(() => {
				// Handle keyboard shortcuts
				const handleKeyDown = (e) => {
                    // Alt key shortcuts
                    if (e.altKey) {
                        switch(e.key.toLowerCase()) {
                            case 'f':
                                e.preventDefault();
                                uiState.toggleFocusMode();
                                break;
                            case 's': // Sidebar (Context)
                                e.preventDefault();
                                uiState.toggleRightSidebar();
                                break;
                            case 'c': // Character Studio
                                e.preventDefault();
                                uiState.openCharacterSheet();
                                break;
                            case 'w': // Wiki
                                e.preventDefault();
                                uiState.openWikiModal();
                                break;
                            case 'n': // New Scene
                                e.preventDefault();
                                projectActions.addScene();
                                break;
                        }
                    }

					if (e.ctrlKey) {
						switch (e.key) {
							case 'z':
								e.preventDefault();
								projectActions.undo();
								break;
							case 'y':
								e.preventDefault();
								projectActions.redo();
								break;
						}
					}
				};
		
				// Handle responsive view
				const handleResize = () => {
					uiState.setIsMobileView(window.innerWidth < 768);
				};
		
				window.addEventListener('resize', handleResize);
				handleResize(); // Initial check
		
				window.addEventListener('keydown', handleKeyDown);
		
				// Listen for events from the main process (Electron menu)
				if (window.electronAPI) {
					window.electronAPI.on('save-project', () => {
						projectActions.saveProject();
					});
					window.electronAPI.on('load-project', () => {
						projectActions.loadProjectFromFile();
					});
				}
                
                // Check if we should show the guide
                const hideGuide = localStorage.getItem('hideStartupGuide');
                if (!hideGuide) {
                    // Slight delay to ensure UI is ready
                    setTimeout(() => {
                        uiState.openGuideModal();
                    }, 1000);
                }
		
				return () => {
					window.removeEventListener('keydown', handleKeyDown);
					window.removeEventListener('resize', handleResize);
				};
			});
		
			// Subscribe to theme changes and toggle body class
			theme.subscribe(value => {
				if (typeof document !== 'undefined') {
					if (value === 'dark') {
						document.body.classList.add('dark-theme');
					} else {
						document.body.classList.remove('dark-theme');
					}
				}
			});
		</script>
		
		<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />
		
		<div class="app-container" class:resizing={sidebarResizing}>
			<Header />
			<main>
				{#if $activeProject && $activeStory}
					{#if $uiState.isSidebarOpen}
						<div 
							class="sidebar-overlay" 
							on:click={() => uiState.toggleSidebar()}
							on:keydown={(e) => e.key === 'Enter' && uiState.toggleSidebar()}
							role="button"
							tabindex="0"
						></div>
					{/if}
					<div 
						class="sidebar" 
						class:mobile-open={$uiState.isSidebarOpen}
						style="width: {$uiState.isFocusMode ? 'auto' : `${$uiState.sidebarWidth}px`}; flex-grow: {$uiState.isFocusMode ? 1 : 0};"
					>
						<SceneEditor scene={activeScene} story={$activeStory} />
					</div>
		
					{#if !$uiState.isFocusMode}
						<div 
							class="resizer" 
							on:mousedown={() => sidebarResizing = true}
						></div>
						<div 
							class="main-view" 
							style="width: {mainViewWidth};"
							on:dragover={handleDragOver}
							on:drop={handleDrop}
						>
							{#if $uiState.currentView === 'canvas'}
                                <StoryCanvas story={$activeStory} />
                                
                                <!-- Character Palette & Context Sidebar Overlay -->
                                <div class="char-palette-overlay">
                                    <button 
                                        class="palette-toggle-btn" 
                                        class:active={$uiState.rightSidebar.isOpen} 
                                        on:click={() => uiState.toggleRightSidebar()} 
                                        title="문맥 자료 사이드바 (Alt+S)"
                                    >
                                        <Icon name="sidebar" size={20} />
                                    </button>

                                    <button 
                                        class="palette-toggle-btn" 
                                        class:active={isCharacterPaletteVisible} 
                                        on:click={() => isCharacterPaletteVisible = !isCharacterPaletteVisible} 
                                        title="등장인물 팔레트"
                                    >
                                        <Icon name="users" size={20} />
                                    </button>
                                    {#if isCharacterPaletteVisible}
                                        <div class="palette-panel" transition:fly={{ x: 200, duration: 200 }}>
                                            <div class="panel-header">
                                                <h4>등장인물</h4>
                                                <button class="close-icon-btn" on:click={() => isCharacterPaletteVisible = false}>
                                                    <Icon name="x" size={16} />
                                                </button>
                                            </div>
                                            <CharacterPalette story={$activeStory} selectedSceneId={activeScene?.id} />
                                        </div>
                                    {/if}
                                </div>

                                <!-- Canvas Dock only visible in Flow/Canvas view -->
                                <CanvasDock />
                            {:else if $uiState.currentView === 'map'}
                                <WorldMapCanvas story={$activeStory} />
							{:else if $uiState.currentView === 'timeline'}
								<TimelineView />
							{/if}
						</div>
					{/if}

                    <!-- Global Right Sidebar -->
                    {#if $uiState.rightSidebar.isOpen}
                        {#if !$uiState.isFocusMode}
                            <div class="resizer right-resizer"></div>
                        {/if}
                        <aside 
                            class="right-sidebar" 
                            class:focus-mode-overlay={$uiState.isFocusMode}
                        >
                            {#if $uiState.rightSidebar.activeTab === 'context'}
                                <SceneContextSidebar scene={activeScene} story={$activeStory} />
                            {/if}
                        </aside>
                    {/if}
				{/if}

				{#if !$activeProject || $uiState.isProjectModalOpen}
					<ProjectModal activeProjectId={$activeProject ? $activeProject.id : null} />
				{/if}
			</main>
		</div>
		
		{#if $activeStory}
			{#if !$uiState.widgets.customization.docked && $uiState.widgets.customization.visible}
				<FloatingWidget widgetId="customization" title="꾸미기" widgetState={$uiState.widgets.customization}>
					<CustomizationPalette scene={activeScene} />
				</FloatingWidget>
			{/if}
	{#if !$uiState.widgets.variables.docked && $uiState.widgets.variables.visible}
		<FloatingWidget widgetId="variables" title="변수 팔레트" widgetState={$uiState.widgets.variables}>
			<VariablePalette {story} />
		</FloatingWidget>
	{/if}
	{#if !$uiState.widgets.dialogues.docked && $uiState.widgets.dialogues.visible}
		<FloatingWidget widgetId="dialogues" title="대사 및 이벤트" widgetState={$uiState.widgets.dialogues}>
			<DialoguesEditor scene={activeScene} story={$activeStory} />
		</FloatingWidget>
	{/if}
			{#if !$uiState.widgets.choices.docked && $uiState.widgets.choices.visible}
				<FloatingWidget widgetId="choices" title="선택지" widgetState={$uiState.widgets.choices}>
					<ChoicesEditor scene={activeScene} story={$activeStory} />
				</FloatingWidget>
			{/if}
		{/if}
		

		

		
		{#if $uiState.isStorylineScriptViewerOpen}
			<StorylineViewerModal 
				story={$activeStory} 
				on:close={() => uiState.closeStorylineScriptViewer()} 
			/>
		{/if}

		{#if $uiState.isSettingsModalOpen}
		    <SettingsModal on:close={() => uiState.closeSettingsModal()} />
		{/if}
		
		{#if $uiState.isAnalyticsOpen}
			<AnalyticsModal on:close={() => uiState.closeAnalyticsModal()} />
		{/if}
		
		{#if $uiState.isWikiModalOpen}
		<WikiModal 
			isOpen={$uiState.isWikiModalOpen}
			on:close={() => uiState.closeWikiModal()}
		/>
		{/if}

		{#if $uiState.isAnnotationManagerOpen}
			<AnnotationManagerModal on:close={() => uiState.closeAnnotationManager()} />
		{/if}

		{#if $uiState.isCharacterSheetOpen}
			<CharacterStudio 
				isOpen={$uiState.isCharacterSheetOpen}
				story={$activeStory}
				on:close={() => uiState.closeCharacterSheet()}
			/>
		{/if}
		
		{#if $uiState.isPlotThreadModalOpen}
		<PlotThreadModal on:close={() => uiState.closePlotThreadModal()} />
		{/if}
		
		{#if $uiState.isGoalSettingModalOpen}
		<GoalSettingModal on:close={() => uiState.closeGoalSettingModal()} />
		{/if}
        {#if $uiState.isGuideModalOpen}
        <GuideModal on:close={() => uiState.closeGuideModal()} />
        {/if}
		{#if $uiState.isStateManagerOpen}
		<StateManagerModal on:close={() => uiState.closeStateManagerModal()} />
		{/if}
		{#if $uiState.inputModal.isOpen}
		<InputModal
			isOpen={$uiState.inputModal.isOpen}
			title={$uiState.inputModal.title}
			message={$uiState.inputModal.message}
			initialValue={$uiState.inputModal.initialValue}
			placeholder={$uiState.inputModal.placeholder}
			onConfirm={$uiState.inputModal.onConfirm}
			on:close={() => uiState.closeInputModal()}
		/>
		{/if}
		
		
		{#if $confirmation.isOpen}
			<ConfirmModal 
				message={$confirmation.message}
				on:confirm={$confirmation.onConfirm}
				on:cancel={$confirmation.onCancel}
			/>
		{/if}
		
		<CommandPalette />
		
		<Notification />
		
		<style>
			.app-container {
				display: flex;
				flex-direction: column;
				height: 100vh;
				width: 100vw;
				overflow: hidden;
			}
			main {
				display: flex;
				flex-grow: 1;
				height: 100%;
				overflow: hidden;
			}
			.sidebar {
				height: 100%;
				background-color: var(--sidebar-bg);
				flex-shrink: 0;
			}
			.resizer {
				width: 5px;
				height: 100%;
				background-color: var(--border-color);
				cursor: col-resize;
				flex-shrink: 0;
				transition: background-color var(--transition-speed);
                z-index: 10;
			}
			.resizer:hover {
				background-color: var(--accent-color);
			}
            .right-resizer {
                cursor: col-resize;
            }
			.main-view {
				height: 100%;
				flex-grow: 1;
                min-width: 0; /* Prevent flex overflow */
                position: relative;
			}
            .right-sidebar {
                width: 320px;
                height: 100%;
                background-color: var(--sidebar-bg);
                flex-shrink: 0;
                border-left: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
            }
            .right-sidebar.focus-mode-overlay {
                position: static;
                height: 100%;
                z-index: auto;
                box-shadow: none;
                border-left: 1px solid var(--border-color);
            }
		
			:global(.resizing) {
				cursor: col-resize;
				user-select: none;
			}
		
			:global(.resizing *) {
				cursor: col-resize !important;
			}
		
			.sidebar-overlay {
				display: none;
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background-color: rgba(0, 0, 0, 0.5);
				z-index: 199; /* Below sidebar but above everything else */
			}
		
			@media (max-width: 768px) {
				.sidebar {
					position: fixed;
					top: 60px; /* Below header */
					left: 0;
					height: calc(100% - 60px);
					z-index: 200;
					transform: translateX(-100%);
					transition: transform 0.3s ease-in-out;
					box-shadow: var(--box-shadow-lg);
					width: 100% !important; /* Use full screen width for mobile sidebar */
				}
				.sidebar.mobile-open {
					transform: translateX(0);
				}
				.resizer {
					display: none;
				}
				.main-view {
					width: 100% !important;
				}
				.sidebar-overlay {
					display: block;
				}
			}

            /* Character Palette Overlay */
            .char-palette-overlay {
                position: absolute;
                top: 20px;
                right: 20px;
                z-index: 100;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 10px;
                pointer-events: none; /* Let clicks pass through container */
            }
            .palette-toggle-btn {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-color: var(--secondary-bg);
                border: 1px solid var(--border-color);
                color: var(--text-color);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                pointer-events: auto; /* Enable clicks on button */
                transition: all 0.2s;
            }
            .palette-toggle-btn:hover, .palette-toggle-btn.active {
                background-color: var(--accent-color);
                color: white;
                border-color: var(--accent-color);
            }
            .palette-panel {
                width: 280px;
                background-color: var(--secondary-bg);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                padding: 15px;
                pointer-events: auto; /* Enable clicks on panel */
                max-height: calc(100vh - 100px);
                display: flex;
                flex-direction: column;
            }
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--border-color);
            }
            .panel-header h4 { margin: 0; font-size: 1em; }
            .close-icon-btn {
                background: none; border: none; color: var(--text-color-muted);
                cursor: pointer; padding: 4px; display: flex;
            }
            .close-icon-btn:hover { color: var(--text-color); }
		</style>