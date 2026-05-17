<script>
    import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';

    export let x = 0;
    export let y = 0;
    export let items = [];

    const dispatch = createEventDispatcher();
    let menuElement;
    let activeSubmenuItem = null;
    let submenuTimeout;

    let adjustedX = x;
    let adjustedY = y;

    // This reactive block adjusts the menu's position to keep it within the viewport.
    $: {
        async function adjustPosition() {
            await tick(); // Wait for the DOM to be updated so we can measure the element
            if (!menuElement) return;

            const menuHeight = menuElement.offsetHeight;
            const menuWidth = menuElement.offsetWidth;
            const windowHeight = window.innerHeight;
            const windowWidth = window.innerWidth;
            const margin = 10; // A small margin from the window edge

            let newY = y;
            if (y + menuHeight > windowHeight) {
                newY = windowHeight - menuHeight - margin;
            }
            adjustedY = Math.max(margin, newY); // Ensure it doesn't go off the top either

            let newX = x;
            if (x + menuWidth > windowWidth) {
                newX = windowWidth - menuWidth - margin;
            }
            adjustedX = Math.max(margin, newX);
        }
        adjustPosition();
    }

    function handleItemClick(item) {
        if (item.submenu) return; // Don't do anything if it's a submenu parent

        if (item.action) {
            dispatch('menuaction', { ...item });
        }
        dispatch('close');
    }

    // --- Submenu Mouse Handling ---
    function handleMouseEnterItem(item) {
        clearTimeout(submenuTimeout);
        if (item.submenu) {
            activeSubmenuItem = item;
        }
    }

    function handleMouseLeaveItem(item) {
        if (item.submenu) {
            submenuTimeout = setTimeout(() => {
                if (activeSubmenuItem === item) {
                    activeSubmenuItem = null;
                }
            }, 200);
        }
    }
    
    function handleSubmenuMouseEnter() {
        clearTimeout(submenuTimeout);
    }
    
    function handleSubmenuMouseLeave() {
        submenuTimeout = setTimeout(() => {
            activeSubmenuItem = null;
        }, 200);
    }
    // --- End Submenu Mouse Handling ---

    function handleClickOutside(event) {
        if (menuElement && !menuElement.contains(event.target)) {
            dispatch('close');
        }
    }

    onMount(() => {
        window.addEventListener('click', handleClickOutside, true);
    });

    onDestroy(() => {
        window.removeEventListener('click', handleClickOutside, true);
        clearTimeout(submenuTimeout);
    });
</script>

<div class="context-menu-container" style="left: {adjustedX}px; top: {adjustedY}px;" bind:this={menuElement}>
    <ul>
        {#each items as item, i (i)}
            {#if item.type === 'separator'}
                <li class="separator"></li>
            {:else}
                <li
                    role="menuitem"
                    tabindex="0"
                    class:has-submenu={item.submenu}
                    on:click|stopPropagation={() => handleItemClick(item)}
                    on:keydown|stopPropagation={(e) => { if (e.key === 'Enter') handleItemClick(item); }}
                    on:mouseenter={() => handleMouseEnterItem(item)}
                    on:mouseleave={() => handleMouseLeaveItem(item)}
                >
                    <span>{item.label}</span>
                    {#if item.submenu}
                        <span class="submenu-arrow">▶</span>
                    {/if}

                    {#if activeSubmenuItem === item && item.submenu}
                        <div 
                            class="submenu"
                            on:mouseenter={handleSubmenuMouseEnter}
                            on:mouseleave={handleSubmenuMouseLeave}
                        >
                            <ul>
                                {#each item.submenu as subItem (subItem.sequenceId)}
                                    <li
                                        role="menuitem"
                                        tabindex="0"
                                        on:click|stopPropagation={() => handleItemClick(subItem)}
                                        on:keydown|stopPropagation={(e) => { if (e.key === 'Enter') handleItemClick(subItem); }}
                                    >
                                        {subItem.label}
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}
                </li>
            {/if}
        {/each}
    </ul>
</div>

<style>
    .context-menu-container {
        position: fixed;
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow-lg);
        z-index: 2000;
        padding: 6px;
        min-width: 220px;
    }
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    li {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 9px 14px;
        cursor: pointer;
        user-select: none;
        border-radius: 4px;
        transition: background-color var(--transition-speed), color var(--transition-speed);
        font-size: 0.95em;
    }
    li:hover {
        background-color: var(--accent-color);
        color: white;
    }
    .submenu li {
        color: var(--text-color);
    }
    .submenu li:hover {
        color: white;
    }
    .separator {
        height: 1px;
        background-color: var(--border-color);
        margin: 5px 0;
        padding: 0;
    }
    .separator:hover {
        background-color: var(--border-color); /* Prevent hover effect */
    }
    .submenu-arrow {
        font-size: 0.8em;
        opacity: 0.7;
    }
    .submenu {
        position: absolute;
        left: 100%;
        top: -7px; /* Align with parent item */
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow-lg);
        z-index: 2001;
        padding: 6px;
        min-width: 200px;
        animation: fadeIn 0.1s ease-out;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-5px); }
        to { opacity: 1; transform: translateX(0); }
    }
</style>