<script>
    import { createEventDispatcher, tick } from "svelte";
    import {
        activeStory,
        projectActions,
        uiState,
        notifications,
        confirmation,
        annotationSelection,
    } from "./stores.js";
    import { fade, slide } from "svelte/transition";
    import Icon from "./Icon.svelte";
    import DictionaryTooltip from "./DictionaryTooltip.svelte";
    import {
        parseSmartInput,
        getColorFromString,
        getProfileImageStyle,
        linkifyText,
    } from "./utils.js";
    import RichTextEditor from "./RichTextEditor.svelte";

    export let isOpen = false;

    const dispatch = createEventDispatcher();

    // Local State
    let activeTab = "locations";
    let searchText = "";
    let selectedItemId = null;
    let selectedItemType = null;
    let showImportOverlay = false;
    let importWikiText = "";
    let showExportOverlay = false;
    let exportWikiText = "";
    let sortMode = "custom";

    // Sync with global state when opened
    $: if (isOpen && $uiState.wikiSelectedItemType) {
        const type = $uiState.wikiSelectedItemType;
        // Map store type to local tab
        const tabMap = {
            character: "characters",
            creature: "creatures",
            location: "locations",
            item: "items",
            group: "groups",
            lore: "lore",
            dictionary: "lore", // handle legacy/store mismatch
            history: "history",
        };
        if (tabMap[type]) {
            activeTab = tabMap[type];
        }
        selectedItemType = type === "dictionary" ? "lore" : type;
        selectedItemId = $uiState.wikiSelectedItemId;

        // Clear the selection in store so it doesn't persist/override later
        setTimeout(() => {
            uiState.clearWikiSelection();
        }, 0);
    }

    // Description Editing State
    let isEditingDescription = false;
    let showReferencePanel = false;
    let referenceSearchText = "";
    let referenceExpandedId = null; // ID of the item currently expanded in reference panel
    let referenceCollapsedGroups = new Set();

    function toggleRefGroup(groupId) {
        if (referenceCollapsedGroups.has(groupId)) {
            referenceCollapsedGroups.delete(groupId);
        } else {
            referenceCollapsedGroups.add(groupId);
        }
        referenceCollapsedGroups = referenceCollapsedGroups; // Trigger reactivity
    }

    const tabs = [
        { id: "characters", label: "인물", icon: "users" },
        { id: "creatures", label: "생물", icon: "feather" },
        { id: "locations", label: "장소", icon: "map" },
        { id: "items", label: "사물", icon: "package" },
        { id: "groups", label: "단체", icon: "flag" },
        { id: "lore", label: "지식", icon: "book" },
        { id: "history", label: "역사", icon: "clock" },
    ];

    // --- Derived Data (Reactivity) ---

    // 1. Get the actual object from store based on ID (Ensures updates show immediately)
    $: selectedItemData = getSelectedItemData(
        $activeStory,
        selectedItemType,
        selectedItemId,
    );

    $: groupedRefItems = (() => {
        if (!$activeStory) return [];
        const allItems = getAllWikiItems();
        // Filter unique items (ignore alias entries for the list)
        const uniqueItems = [];
        const seenIds = new Set();
        allItems.forEach((item) => {
            if (!seenIds.has(item.id)) {
                uniqueItems.push(item);
                seenIds.add(item.id);
            }
        });

        const filtered = uniqueItems.filter((item) => {
            const search = referenceSearchText.toLowerCase();
            return (
                (item.name || item.term || item.title || "")
                    .toLowerCase()
                    .includes(search) ||
                (item.description || item.definition || "")
                    .toLowerCase()
                    .includes(search)
            );
        });

        // Group by type then category
        const typeMap = {};
        tabs.forEach((tab) => {
            typeMap[tab.id] = {
                id: tab.id,
                label: tab.label,
                icon: tab.icon,
                categories: {},
            };
        });

        filtered.forEach((item) => {
            const tabId =
                item.type === "lore"
                    ? "lore"
                    : item.type === "character"
                      ? "characters"
                      : item.type === "creature"
                        ? "creatures"
                        : item.type === "location"
                          ? "locations"
                          : item.type === "item"
                            ? "items"
                            : item.type === "group"
                              ? "groups"
                              : item.type === "history"
                                ? "history"
                                : item.type;

            if (typeMap[tabId]) {
                const category = item.category || "미분류";
                if (!typeMap[tabId].categories[category]) {
                    typeMap[tabId].categories[category] = [];
                }
                typeMap[tabId].categories[category].push(item);
            }
        });

        return tabs
            .map((tab) => {
                const group = typeMap[tab.id];
                const categories = Object.keys(group.categories)
                    .sort((a, b) => {
                        if (a === "미분류") return 1;
                        if (b === "미분류") return -1;
                        return a.localeCompare(b);
                    })
                    .map((catName) => ({
                        name: catName,
                        id: `${tab.id}-${catName}`,
                        items: group.categories[catName],
                    }));

                return {
                    ...group,
                    categoryList: categories,
                };
            })
            .filter((g) => g.categoryList.length > 0);
    })();

    function formatWikiData(story, tab) {
        if (!story) return "";
        let text = "";

        // Determine Section Header & List
        let sectionTitle = "";
        let list = [];

        if (tab === "characters") {
            sectionTitle = "1. 등장인물 (characters)";
            list = story.characters || [];
        } else if (tab === "creatures") {
            sectionTitle = "2. 생물 (creatures)";
            list = story.creatures || [];
        } else if (tab === "locations") {
            sectionTitle = "3. 장소 (locations)";
            list = story.locations || [];
        } else if (tab === "items") {
            sectionTitle = "4. 아이템 (items)";
            list = story.items || [];
        } else if (tab === "groups") {
            sectionTitle = "5. 세력 (groups)";
            list = story.groups || [];
        } else if (tab === "lore") {
            sectionTitle = "6. 설정 (lore)";
            list = story.dictionary || [];
        } else if (tab === "history") {
            sectionTitle = "7. 역사 (history)";
        }

        text += `[${sectionTitle}]\n\n`;

        if (tab === "history") {
            // History Formatting
            const eras = story.history?.eras || [];
            const events = story.history?.events || [];

            // 1. Eras
            eras.forEach((era) => {
                text += `=== [시대] ${era.name} ===\n`;
                if (era.description) text += `${era.description}\n`;
                text += "\n";

                const eraEvents = events
                    .filter((e) => e.eraId === era.id)
                    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                eraEvents.forEach((evt) => {
                    text += `• [${evt.displayDate || "???"}] ${evt.title}\n`;
                    if (evt.description) text += `${evt.description}\n`;
                    text += "\n";
                });
                text += "\n";
            });

            // Events without Era
            const noEraEvents = events
                .filter((e) => !e.eraId)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            if (noEraEvents.length > 0) {
                text += `=== [시대] 미분류 ===\n\n`;
                noEraEvents.forEach((evt) => {
                    text += `• [${evt.displayDate || "???"}] ${evt.title}\n`;
                    if (evt.description) text += `${evt.description}\n`;
                    text += "\n";
                });
            }
        } else {
            // Standard Item Formatting
            // Sort by category then name for cleaner output
            const sortedList = [...list].sort((a, b) => {
                const catA = a.category || "";
                const catB = b.category || "";
                if (catA !== catB) return catA.localeCompare(catB);
                return (a.name || a.term || "").localeCompare(
                    b.name || b.term || "",
                );
            });

            sortedList.forEach((item) => {
                const name = item.name || item.term || item.title;
                if (!name) return;

                text += `■ ${name}\n`;

                // Attributes
                if (item.category) text += `분류: ${item.category}\n`;
                if (item.aliases && item.aliases.length > 0)
                    text += `별칭: ${item.aliases.join(", ")}\n`;
                if (item.tags && item.tags.length > 0)
                    text += `태그: ${item.tags.map((t) => "#" + t).join(", ")}\n`;

                if (tab === "characters" && item.affiliation) {
                    const affName = getAffiliationName(story, item.affiliation);
                    if (affName) text += `소속: ${affName}\n`;
                }

                // Description
                const desc = item.description || item.definition || "";
                if (desc) text += `\n${desc}\n`;

                text += "\n";
            });
        }

        return text;
    }

    function openExport() {
        exportWikiText = formatWikiData($activeStory, activeTab);
        showExportOverlay = true;
    }

    function getSelectedItemData(story, type, id) {
        if (!story || !id || !type) return null;
        if (type === "history")
            return (story.history?.events || []).find((e) => e.id === id);
        if (type === "lore" || type === "dictionary")
            return story.dictionary.find((e) => e.id === id);
        if (type === "character")
            return story.characters.find((e) => e.id === id);

        // locations, items, groups, creatures
        const list =
            story[
                type === "location"
                    ? "locations"
                    : type === "item"
                      ? "items"
                      : type === "creature"
                        ? "creatures"
                        : "groups"
            ];
        return list ? list.find((e) => e.id === id) : null;
    }

    function getFilteredItems(story, tab, search, catPath, sort) {
        if (!story) return [];
        let list = [];
        if (tab === "all") {
            list = getAllWikiItems(); // Use the existing helper that aggregates everything
        } else if (tab === "characters") list = story.characters || [];
        else if (tab === "creatures") list = story.creatures || [];
        else if (tab === "locations") list = story.locations || [];
        else if (tab === "items") list = story.items || [];
        else if (tab === "groups") list = story.groups || [];
        else if (tab === "lore") list = story.dictionary || [];
        else return [];

        // 1. Category Filter
        if (catPath) {
            list = list.filter(
                (i) =>
                    i.category === catPath ||
                    (i.category && i.category.startsWith(catPath + "/")),
            );
        }

        // 2. Search Filter
        if (search) {
            const lower = search.toLowerCase();
            list = list.filter((i) => {
                const name = (i.name || i.term || "").toLowerCase();
                const desc = (
                    i.description ||
                    i.definition ||
                    ""
                ).toLowerCase();
                const aliases = (i.aliases || []).join(" ").toLowerCase();
                const tags = (i.tags || []).join(" ").toLowerCase();
                return (
                    name.includes(lower) ||
                    desc.includes(lower) ||
                    aliases.includes(lower) ||
                    tags.includes(lower)
                );
            });
        }

        // 3. Sort
        if (sort === "name") {
            return [...list].sort((a, b) =>
                (a.name || a.term || "").localeCompare(b.name || b.term || ""),
            );
        }

        return list;
    }

    // 2. Filtered List for Grid
    let selectedCategoryPath = null;
    $: filteredItems = getFilteredItems(
        $activeStory,
        activeTab,
        searchText,
        selectedCategoryPath,
        sortMode,
    );

    // --- Linkage Logic ---
    $: connections =
        selectedItemData && selectedItemType !== "history"
            ? getConnections(selectedItemData, selectedItemType)
            : [];

    // Linked Annotation Logic
    $: linkedAnnotation =
        selectedItemData && selectedItemData.linkedAnnotationId
            ? getAnnotationById(
                  $activeStory,
                  selectedItemData.linkedAnnotationId,
              )
            : null;

    function getAnnotationById(story, id) {
        if (!story || !id) return null;
        if (id.startsWith("scene-")) {
            const sceneId = id.replace("scene-", "");
            const scene = story.scenes[sceneId];
            return scene
                ? {
                      type: "scene",
                      content: scene.comment,
                      source: scene.name,
                      sceneId: scene.id,
                  }
                : null;
        } else if (id.startsWith("dialogue-")) {
            const dialogueId = id.replace("dialogue-", "");
            for (const scene of Object.values(story.scenes)) {
                const item = scene.content.find((i) => i.id === dialogueId);
                if (item)
                    return {
                        type: "dialogue",
                        content: item.comment,
                        source: scene.name,
                        text: item.text,
                        sceneId: scene.id,
                    };
            }
        }
        return null;
    }

    function linkAnnotation() {
        const type =
            activeTab === "lore"
                ? "lore"
                : activeTab === "characters"
                  ? "character"
                  : activeTab.slice(0, -1);
        annotationSelection.startSelection(selectedItemId, type);
    }

    function unlinkAnnotation() {
        if (!selectedItemData) return;
        const type =
            activeTab === "lore"
                ? "lore"
                : activeTab === "characters"
                  ? "character"
                  : activeTab.slice(0, -1);

        if (type === "lore")
            projectActions.updateDictionaryEntry(selectedItemData.id, {
                linkedAnnotationId: null,
            });
        else if (type === "character")
            projectActions.updateCharacter(selectedItemData.id, {
                linkedAnnotationId: null,
            });
        else
            projectActions.updateWikiItem(type, selectedItemData.id, {
                linkedAnnotationId: null,
            });
    }

    function goToAnnotation(id) {
        if (!id) return;
        let sceneId;
        if (id.startsWith("scene-")) sceneId = id.replace("scene-", "");
        else if (id.startsWith("dialogue-")) {
            const dialogueId = id.replace("dialogue-", "");
            for (const scene of Object.values($activeStory.scenes)) {
                if (scene.content.some((i) => i.id === dialogueId)) {
                    sceneId = scene.id;
                    break;
                }
            }
        }
        if (sceneId) {
            projectActions.selectScene(sceneId);
            close();
        }
    }

    // ... (Existing filtering code) ...

    function getConnections(item, type) {
        if (!$activeStory || !item) return [];
        const results = [];

        // Helper to add unique connection
        const add = (id, name, type, reason, color, icon) => {
            if (!results.some((r) => r.id === id)) {
                results.push({ id, name, type, reason, color, icon });
            }
        };

        // 1. Character Specific Logic
        const chars = $activeStory.characters || [];

        // Group Affiliation
        if (type === "group" || type === "groups") {
            chars.forEach((c) => {
                if (c.affiliation === item.id)
                    add(c.id, c.name, "character", "소속", c.color, "user");
            });
        }

        // Key Item
        const itemKeys = [item.name || item.term, ...(item.aliases || [])]
            .filter((k) => k)
            .map((k) => k.toLowerCase());
        if (type === "item" || type === "items") {
            chars.forEach((c) => {
                if (
                    c.narrative?.keyitem &&
                    itemKeys.some((k) =>
                        c.narrative.keyitem.toLowerCase().includes(k),
                    )
                ) {
                    add(
                        c.id,
                        c.name,
                        "character",
                        "키 아이템",
                        c.color,
                        "user",
                    );
                }
            });
        }

        // 2. Universal Backlink Logic (Mentions)
        const allItems = getAllWikiItems(); // Get all characters, locs, items, etc.

        allItems.forEach((other) => {
            if (other.id === item.id) return;

            // Check Description/Definition/Narrative for mentions
            const desc = (
                other.description ||
                other.definition ||
                ""
            ).toLowerCase();
            const narrative = JSON.stringify(
                other.narrative || {},
            ).toLowerCase(); // For characters

            if (
                itemKeys.some((k) => desc.includes(k) || narrative.includes(k))
            ) {
                let icon = "file-text";
                if (other.type === "character") icon = "user";
                else if (other.type === "creature") icon = "feather";
                else if (other.type === "location") icon = "map";
                else if (other.type === "item") icon = "package";
                else if (other.type === "group") icon = "flag";
                else if (other.type === "lore") icon = "book";

                add(
                    other.id,
                    other.name || other.term || other.title,
                    other.type,
                    "언급됨",
                    other.color || "#888",
                    icon,
                );
            }
        });

        return results;
    }

    // --- Actions ---
    function close() {
        dispatch("close");
        selectedItemId = null;
    }

    function createNew() {
        if (activeTab === "history") {
            addEra();
            return;
        }
        uiState.prompt({
            title: `새 ${getTabLabel(activeTab)} 추가`,
            onConfirm: (val) => {
                if (!val) return;
                if (activeTab === "lore")
                    projectActions.addDictionaryEntry(
                        val,
                        "",
                        selectedCategoryPath,
                    );
                else if (activeTab === "characters")
                    projectActions.addNewCharacter(val, selectedCategoryPath);
                else
                    projectActions.addWikiItem(
                        activeTab.slice(0, -1),
                        val,
                        selectedCategoryPath,
                    );
            },
        });
    }

    function createCategory() {
        uiState.prompt({
            title: "새 카테고리",
            onConfirm: (val) =>
                val &&
                projectActions.addGroup(
                    activeTab === "lore"
                        ? "dictionary"
                        : activeTab === "characters"
                          ? "character"
                          : activeTab.slice(0, -1),
                    val,
                ),
        });
    }

    function getTabLabel(id) {
        return tabs.find((t) => t.id === id)?.label || "";
    }

    function getAffiliationName(story, affiliationId) {
        if (!story || !affiliationId) return null;
        const group = (story.groups || []).find((g) => g.id === affiliationId);
        if (group) return group.name;
        const lore = (story.dictionary || []).find(
            (d) => d.id === affiliationId,
        );
        if (lore) return lore.term;
        return null;
    }

    // History
    let selectedEraId = null;
    function addEra() {
        uiState.prompt({
            title: "새 시대 추가",
            onConfirm: (v) => v && projectActions.addHistoryEra(v),
        });
    }
    function addEvent(eraId) {
        uiState.prompt({
            title: "새 사건 추가",
            onConfirm: (v) => v && projectActions.addHistoryEvent(v, eraId),
        });
    }

    // --- Drag and Drop ---
    let draggedItem = null;
    let draggedCat = null;
    let dropTarget = null;

    function handleDragStart(e, id, type) {
        if (type !== "history" && (sortMode === "name" || searchText)) return;
        draggedItem = { id, type };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
    }
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }
    function handleDrop(e, targetId, type) {
        e.preventDefault();
        dropTarget = null;
        if (
            !draggedItem ||
            draggedItem.type !== type ||
            draggedItem.id === targetId
        )
            return;

        let list = [];
        if (type === "history") {
            // For history, we sort by sortOrder
            list = ($activeStory.history?.events || [])
                .filter((e) => !selectedEraId || e.eraId === selectedEraId)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        } else {
            list = getFilteredItems(
                $activeStory,
                activeTab,
                "",
                selectedCategoryPath,
                "custom",
            );
        }

        const fromIndex = list.findIndex((i) => i.id === draggedItem.id);
        const toIndex = list.findIndex((i) => i.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return;

        const newList = [...list];
        const [moved] = newList.splice(fromIndex, 1);
        newList.splice(toIndex, 0, moved);

        if (type === "history")
            projectActions.reorderHistoryEvents(newList.map((i) => i.id));
        else if (type === "lore")
            projectActions.reorderWikiItems(
                "lore",
                newList.map((i) => i.id),
            );
        else if (type === "characters")
            projectActions.reorderWikiItems(
                "character",
                newList.map((i) => i.id),
            );
        else
            projectActions.reorderWikiItems(
                type,
                newList.map((i) => i.id),
            );

        draggedItem = null;
    }

    function handleEraListDragStart(e, id) {
        draggedItem = { id, type: "era_reorder" };
        e.dataTransfer.effectAllowed = "move";
    }

    function handleEraDrop(e, targetEraId) {
        e.preventDefault();
        dropTarget = null;

        if (!draggedItem) return;

        // Case 1: Reordering Eras
        if (draggedItem.type === "era_reorder") {
            if (targetEraId === null) return; // Cannot reorder onto the 'All' item
            if (draggedItem.id === targetEraId) {
                draggedItem = null;
                return;
            }

            const eras = $activeStory.history?.eras || [];
            const fromIndex = eras.findIndex((e) => e.id === draggedItem.id);
            const toIndex = eras.findIndex((e) => e.id === targetEraId);

            if (fromIndex !== -1 && toIndex !== -1) {
                const idList = eras.map((e) => e.id);
                const [movedId] = idList.splice(fromIndex, 1);
                idList.splice(toIndex, 0, movedId);
                projectActions.reorderHistoryEras(idList);
            }
            draggedItem = null;
            return;
        }

        // Case 2: Assigning Event to Era
        if (draggedItem.type === "history") {
            projectActions.updateHistoryEvent(draggedItem.id, {
                eraId: targetEraId,
            });
            draggedItem = null;
        }
    }

    // Category Drag & Drop with Nesting/Sibling Logic
    let dropPosition = "inside"; // 'inside', 'before', 'after'

    function handleCatDragStart(e, cat) {
        draggedCat = cat;
        e.dataTransfer.effectAllowed = "move";
    }

    function handleCatDragOver(e, cat) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // Calculate drop position
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        // Top 25% -> before, Bottom 25% -> after, Middle 50% -> inside
        if (y < height * 0.25) {
            dropPosition = "before";
        } else if (y > height * 0.75) {
            dropPosition = "after";
        } else {
            dropPosition = "inside";
        }

        dropTarget = cat;
    }

    function handleCatDrop(e, targetCat) {
        e.preventDefault();
        dropTarget = null;

        const type =
            activeTab === "lore"
                ? "dictionary"
                : activeTab === "characters"
                  ? "character"
                  : activeTab.slice(0, -1);
        const categories =
            $activeStory[
                activeTab === "lore"
                    ? "dictionaryCategories"
                    : activeTab.slice(0, -1) + "Categories"
            ] || [];

        // 1. Handle Item Drop (Assign Category)
        if (draggedItem) {
            let targetParentPath = null;

            if (targetCat === null) {
                targetParentPath = null;
            } else if (dropPosition === "inside") {
                targetParentPath = targetCat;
            } else {
                // Before/After -> Sibling (Same Parent as targetCat)
                const parts = targetCat.split("/");
                parts.pop();
                targetParentPath = parts.length > 0 ? parts.join("/") : null;
            }

            if (type === "dictionary")
                projectActions.updateDictionaryEntry(draggedItem.id, {
                    category: targetParentPath,
                });
            else if (type === "character")
                projectActions.updateCharacter(draggedItem.id, {
                    category: targetParentPath,
                });
            else
                projectActions.updateWikiItem(type, draggedItem.id, {
                    category: targetParentPath,
                });
            draggedItem = null;
            return;
        }

        // 2. Handle Category Move/Reorder
        if (draggedCat) {
            if (draggedCat === targetCat) return;
            if (targetCat && targetCat.startsWith(draggedCat + "/")) return;

            // Determine Target Parent
            let targetParentPath = null;
            if (targetCat === null) {
                targetParentPath = null;
            } else if (dropPosition === "inside") {
                targetParentPath = targetCat;
            } else {
                const parts = targetCat.split("/");
                parts.pop();
                targetParentPath = parts.length > 0 ? parts.join("/") : null;
            }

            // Execute Move (Rename in Store)
            projectActions.moveCategory(type, draggedCat, targetParentPath);

            // Execute Reorder (Calculate new list locally and push)
            const name = draggedCat.split("/").pop();
            const newPath = targetParentPath
                ? `${targetParentPath}/${name}`
                : name;

            let workList = [...categories];
            const getBlock = (list, root) =>
                list.filter((c) => c === root || c.startsWith(root + "/"));

            // Identify moving items (old names)
            const itemsToMove = workList.filter(
                (c) => c === draggedCat || c.startsWith(draggedCat + "/"),
            );

            // Create transformed names for new order list
            const itemsMoved = itemsToMove.map((c) => {
                if (c === draggedCat) return newPath;
                return newPath + c.substring(draggedCat.length);
            });

            // Remove old items
            const remaining = workList.filter((c) => !itemsToMove.includes(c));

            // Find insertion index
            let insertIndex = remaining.length;

            if (targetCat !== null) {
                // Note: targetCat is stable (not moved), so we find it in remaining
                const targetIndex = remaining.indexOf(targetCat);
                if (targetIndex !== -1) {
                    if (dropPosition === "before") {
                        insertIndex = targetIndex;
                    } else if (dropPosition === "after") {
                        const targetBlock = getBlock(remaining, targetCat);
                        insertIndex = targetIndex + targetBlock.length;
                    } else if (dropPosition === "inside") {
                        const targetBlock = getBlock(remaining, targetCat);
                        insertIndex = targetIndex + targetBlock.length; // Append to target's block
                    }
                }
            } else {
                // Dropped on 'All' (Root)
                // If inside, append to end. If before/after... All is usually top.
                insertIndex = remaining.length;
            }

            const newOrder = [...remaining];
            newOrder.splice(insertIndex, 0, ...itemsMoved);

            projectActions.reorderCategories(type, newOrder);
            draggedCat = null;
        }
    }

    function handleDragEnd() {
        dropTarget = null;
        draggedItem = null;
        draggedCat = null;
    }

    // --- Hyperlink & Tooltip Logic ---
    let tooltipVisible = false;
    let tooltipData = null;
    let viewportWidth;
    let viewportHeight;

    function getAllWikiItems() {
        if (!$activeStory) return [];
        const items = [];
        const add = (list, type) => {
            (list || []).forEach((i) => {
                // 1. Main Name
                const mainKey = i.name || i.term || i.title;
                if (mainKey) {
                    items.push({ ...i, type, _matchText: mainKey });
                }
                // 2. Aliases
                if (i.aliases && i.aliases.length > 0) {
                    i.aliases.forEach((alias) => {
                        if (alias && alias.trim()) {
                            items.push({
                                ...i,
                                type,
                                _matchText: alias.trim(),
                            });
                        }
                    });
                }
            });
        };
        add($activeStory.characters, "character");
        add($activeStory.creatures, "creature");
        add($activeStory.locations, "location");
        add($activeStory.items, "item");
        add($activeStory.groups, "group");
        add($activeStory.dictionary, "lore");
        add($activeStory.history?.events, "history");

        // Sort by length descending (Longest match first)
        return items.sort((a, b) => b._matchText.length - a._matchText.length);
    }

    function autoLinkText(text) {
        return linkifyText(text, getAllWikiItems(), selectedItemId);
    }

    function handleLinkClick(e) {
        const link = e.target.closest(".wiki-link");
        if (link) {
            tooltipVisible = false; // Hide tooltip immediately on navigation
            const id = link.dataset.id;
            const type = link.dataset.type;

            // Switch tab based on type
            const tabMap = {
                character: "characters",
                creature: "creatures",
                location: "locations",
                item: "items",
                group: "groups",
                lore: "lore",
                history: "history",
            };

            if (tabMap[type]) {
                activeTab = tabMap[type];
                selectedItemId = id;
                selectedItemType = type;
                // Reset edit states
                isEditingDescription = false;
                selectedCategoryPath = null;
            }
        } else {
            // Clicked on text but not link -> Edit Mode
            isEditingDescription = true;
            // Focus editor after tick
            tick().then(() => {
                const editor = document.querySelector(".rich-text-editor");
                if (editor) editor.focus();
            });
        }
    }

    function handleMouseOver(event) {
        const target = event.target.closest(".wiki-link");
        if (target) {
            const id = target.dataset.id;
            const type = target.dataset.type;
            const item = getAllWikiItems().find((i) => i.id === id);

            if (item) {
                tooltipData = {
                    term: item.name || item.term || item.title,
                    definition:
                        item.description || item.definition || "설명 없음",
                    x: event.clientX,
                    y: event.clientY,
                };
                tooltipVisible = true;
            }
        }
    }

    function handleMouseOut(event) {
        if (event.target.closest(".wiki-link")) {
            tooltipVisible = false;
        }
    }
</script>

<svelte:window
    bind:innerWidth={viewportWidth}
    bind:innerHeight={viewportHeight}
    on:mouseover={handleMouseOver}
    on:mouseout={handleMouseOut}
/>

{#if tooltipVisible}
    <DictionaryTooltip
        term={tooltipData.term}
        definition={tooltipData.definition}
        x={tooltipData.x}
        y={tooltipData.y}
        {viewportWidth}
        {viewportHeight}
    />
{/if}

{#if isOpen}
    <div
        class="modal-backdrop"
        on:click={close}
        on:keydown={(e) => e.key === "Escape" && close()}
        role="button"
        tabindex="0"
        transition:fade={{ duration: 200 }}
    >
        <div class="modal-content" on:click|stopPropagation role="none">
            <!-- LEFT NAVIGATION -->
            <div class="sidebar">
                <div class="sidebar-header">
                    <h2>세계관 위키</h2>
                </div>
                <nav>
                    {#each tabs as tab}
                        <button
                            class="nav-item"
                            class:active={activeTab === tab.id}
                            on:click={() => {
                                activeTab = tab.id;
                                selectedItemId = null;
                                selectedCategoryPath = null;
                                isEditingDescription = false;
                            }}
                        >
                            <Icon name={tab.icon} size={18} />
                            <span>{tab.label}</span>
                        </button>
                    {/each}
                </nav>
                <div class="sidebar-footer">
                    <button
                        class="nav-item export-btn"
                        on:click={() => (showImportOverlay = true)}
                    >
                        <Icon name="upload" size={18} /> <span>가져오기</span>
                    </button>
                    <button class="nav-item export-btn" on:click={openExport}>
                        <Icon name="download" size={18} /> <span>내보내기</span>
                    </button>
                </div>
            </div>

            <!-- MAIN CONTENT AREA -->
            <div class="main-content">
                {#if selectedItemData}
                    <!-- DETAIL EDITOR (FULL VIEW) -->
                    <div
                        class="detail-view"
                        transition:fade={{ duration: 150 }}
                    >
                        <div class="detail-header">
                            <button
                                class="back-btn"
                                on:click={() => {
                                    selectedItemId = null;
                                    isEditingDescription = false;
                                }}
                            >
                                <Icon name="arrow-left" size={20} /> 목록으로
                            </button>
                            <div class="spacer"></div>
                            <button
                                class="icon-btn"
                                class:active={showReferencePanel}
                                on:click={() =>
                                    (showReferencePanel = !showReferencePanel)}
                                title="참조 패널 열기/닫기"
                                style="margin-right: 8px;"
                            >
                                <Icon name="sidebar" size={18} />
                            </button>
                            <button
                                class="danger-icon-btn"
                                on:click={() => {
                                    confirmation.prompt(
                                        "삭제하시겠습니까?",
                                        () => {
                                            if (activeTab === "history")
                                                projectActions.removeHistoryEvent(
                                                    selectedItemData.id,
                                                );
                                            else if (activeTab === "lore")
                                                projectActions.removeDictionaryEntry(
                                                    selectedItemData.id,
                                                );
                                            else if (activeTab === "characters")
                                                projectActions.removeCharacter(
                                                    selectedItemData.id,
                                                );
                                            else
                                                projectActions.removeWikiItem(
                                                    activeTab.slice(0, -1),
                                                    selectedItemData.id,
                                                );
                                            selectedItemId = null;
                                        },
                                    );
                                }}
                                ><Icon name="trash-2" size={18} /> 삭제</button
                            >
                        </div>

                        <div class="detail-scroll-body">
                            <div class="detail-container">
                                <div class="detail-title-row">
                                    <div
                                        class="detail-avatar"
                                        class:square={activeTab !==
                                            "characters"}
                                        style="background-color: {selectedItemData.profileImage
                                            ? 'transparent'
                                            : selectedItemData.color || '#444'}"
                                    >
                                        {#if selectedItemData.profileImage || selectedItemData.image}
                                            <img
                                                src={selectedItemData.profileImage ||
                                                    selectedItemData.image}
                                                alt={selectedItemData.name}
                                                style="{getProfileImageStyle(
                                                    selectedItemData.profileImageTransform || {
                                                        scale: 1,
                                                        x: 0,
                                                        y: 0,
                                                    },
                                                )} transform-origin: center center;"
                                            />
                                        {:else if activeTab === "characters"}
                                            <span
                                                >{selectedItemData
                                                    .name[0]}</span
                                            >
                                        {:else}
                                            <Icon
                                                name={tabs.find(
                                                    (t) => t.id === activeTab,
                                                ).icon}
                                                size={32}
                                            />
                                        {/if}

                                        <!-- Image Upload Overlay -->
                                        <div class="avatar-overlay">
                                            <button
                                                on:click={async () => {
                                                    if (window.electronAPI) {
                                                        const res =
                                                            await window.electronAPI.openImageFile();
                                                        if (
                                                            res.success &&
                                                            res.filePath
                                                        ) {
                                                            if (
                                                                activeTab ===
                                                                "characters"
                                                            )
                                                                projectActions.updateCharacter(
                                                                    selectedItemData.id,
                                                                    {
                                                                        profileImage:
                                                                            res.filePath,
                                                                    },
                                                                );
                                                            else if (
                                                                activeTab ===
                                                                "creatures"
                                                            )
                                                                projectActions.updateWikiItem(
                                                                    "creature",
                                                                    selectedItemData.id,
                                                                    {
                                                                        image: res.filePath,
                                                                    },
                                                                );
                                                            else if (
                                                                activeTab ===
                                                                "locations"
                                                            )
                                                                projectActions.updateWikiItem(
                                                                    "location",
                                                                    selectedItemData.id,
                                                                    {
                                                                        image: res.filePath,
                                                                    },
                                                                );
                                                            else if (
                                                                activeTab ===
                                                                "items"
                                                            )
                                                                projectActions.updateWikiItem(
                                                                    "item",
                                                                    selectedItemData.id,
                                                                    {
                                                                        image: res.filePath,
                                                                    },
                                                                );
                                                            else if (
                                                                activeTab ===
                                                                "groups"
                                                            )
                                                                projectActions.updateWikiItem(
                                                                    "group",
                                                                    selectedItemData.id,
                                                                    {
                                                                        image: res.filePath,
                                                                    },
                                                                );
                                                        }
                                                    }
                                                }}
                                            >
                                                <Icon name="camera" size={16} />
                                            </button>
                                            {#if selectedItemData.profileImage || selectedItemData.image}
                                                <button
                                                    on:click={() => {
                                                        if (
                                                            activeTab ===
                                                            "characters"
                                                        )
                                                            projectActions.updateCharacter(
                                                                selectedItemData.id,
                                                                {
                                                                    profileImage:
                                                                        "",
                                                                },
                                                            );
                                                        else if (
                                                            activeTab ===
                                                            "creatures"
                                                        )
                                                            projectActions.updateWikiItem(
                                                                "creature",
                                                                selectedItemData.id,
                                                                { image: "" },
                                                            );
                                                        else if (
                                                            activeTab ===
                                                            "locations"
                                                        )
                                                            projectActions.updateWikiItem(
                                                                "location",
                                                                selectedItemData.id,
                                                                { image: "" },
                                                            );
                                                        else if (
                                                            activeTab ===
                                                            "items"
                                                        )
                                                            projectActions.updateWikiItem(
                                                                "item",
                                                                selectedItemData.id,
                                                                { image: "" },
                                                            );
                                                        else if (
                                                            activeTab ===
                                                            "groups"
                                                        )
                                                            projectActions.updateWikiItem(
                                                                "group",
                                                                selectedItemData.id,
                                                                { image: "" },
                                                            );
                                                    }}
                                                >
                                                    <Icon
                                                        name="trash"
                                                        size={16}
                                                    />
                                                </button>
                                            {/if}
                                        </div>
                                    </div>

                                    <input
                                        class="big-title-input"
                                        type="text"
                                        value={selectedItemData.name ||
                                            selectedItemData.term ||
                                            selectedItemData.title}
                                        on:change={(e) => {
                                            const val = e.target.value;
                                            if (activeTab === "history")
                                                projectActions.updateHistoryEvent(
                                                    selectedItemData.id,
                                                    { title: val },
                                                );
                                            else if (activeTab === "lore")
                                                projectActions.updateDictionaryEntry(
                                                    selectedItemData.id,
                                                    { term: val },
                                                );
                                            else if (activeTab === "characters")
                                                projectActions.updateCharacter(
                                                    selectedItemData.id,
                                                    { name: val },
                                                );
                                            else
                                                projectActions.updateWikiItem(
                                                    activeTab.slice(0, -1),
                                                    selectedItemData.id,
                                                    { name: val },
                                                );
                                        }}
                                    />

                                    {#if activeTab === "characters"}
                                        <button
                                            class="primary-btn"
                                            on:click={() => {
                                                uiState.openCharacterSheet(
                                                    selectedItemData.id,
                                                );
                                            }}
                                        >
                                            <Icon name="edit-3" size={14} /> 캐릭터
                                            스튜디오 열기
                                        </button>
                                    {:else if activeTab === "locations"}
                                        {@const marker = (
                                            $activeStory.mapData?.markers || []
                                        ).find(
                                            (m) =>
                                                m.wikiId ===
                                                selectedItemData.id,
                                        )}
                                        {#if marker}
                                            <button
                                                class="primary-btn"
                                                on:click={() => {
                                                    close();
                                                    uiState.setView("map");
                                                    // Center on marker with offset
                                                    // Shift slightly left to avoid being covered by potential sidebars
                                                    const centerX =
                                                        window.innerWidth / 2 -
                                                        100;
                                                    const centerY =
                                                        window.innerHeight / 2;
                                                    const targetX =
                                                        centerX - marker.x * 1; // Assuming scale 1
                                                    const targetY =
                                                        centerY - marker.y * 1;
                                                    projectActions.updateViewTransform(
                                                        {
                                                            x: targetX,
                                                            y: targetY,
                                                            scale: 1,
                                                        },
                                                    );
                                                }}
                                            >
                                                <Icon
                                                    name="map-pin"
                                                    size={14}
                                                /> 지도에서 보기
                                            </button>
                                        {:else}
                                            <button
                                                class="icon-btn"
                                                disabled
                                                title="지도에 핀이 없습니다"
                                            >
                                                <Icon
                                                    name="map-pin-off"
                                                    size={14}
                                                />
                                            </button>
                                        {/if}
                                    {/if}
                                </div>

                                <div class="detail-grid">
                                    <div class="detail-main-col">
                                        <div class="section-box">
                                            <div class="box-header">설명</div>
                                            {#if isEditingDescription}
                                                <RichTextEditor
                                                    value={selectedItemData.description ||
                                                        selectedItemData.definition ||
                                                        ""}
                                                    dictionary={$activeStory.dictionary ||
                                                        []}
                                                    characters={$activeStory.characters ||
                                                        []}
                                                    onUpdate={(val) => {
                                                        if (
                                                            activeTab ===
                                                            "history"
                                                        )
                                                            projectActions.updateHistoryEvent(
                                                                selectedItemData.id,
                                                                {
                                                                    description:
                                                                        val,
                                                                },
                                                            );
                                                        else if (
                                                            activeTab === "lore"
                                                        )
                                                            projectActions.updateDictionaryEntry(
                                                                selectedItemData.id,
                                                                {
                                                                    definition:
                                                                        val,
                                                                },
                                                            );
                                                        else
                                                            projectActions.updateWikiItem(
                                                                activeTab.slice(
                                                                    0,
                                                                    -1,
                                                                ),
                                                                selectedItemData.id,
                                                                {
                                                                    description:
                                                                        val,
                                                                },
                                                            );
                                                    }}
                                                    onCommit={() => {
                                                        isEditingDescription = false;
                                                    }}
                                                />
                                            {:else}
                                                <div
                                                    class="detail-desc-view"
                                                    on:click={handleLinkClick}
                                                    role="button"
                                                    tabindex="0"
                                                    on:keydown={(e) =>
                                                        (e.key === "Enter" ||
                                                            e.key === " ") &&
                                                        (isEditingDescription = true)}
                                                >
                                                    {#if selectedItemData.description || selectedItemData.definition}
                                                        {@html autoLinkText(
                                                            selectedItemData.description ||
                                                                selectedItemData.definition,
                                                        )}
                                                    {:else}
                                                        <span class="empty-text"
                                                            >설명이 없습니다.
                                                            클릭하여 추가하세요.</span
                                                        >
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>

                                        <div class="section-box">
                                            <div class="box-header">
                                                <span
                                                    ><Icon
                                                        name="link"
                                                        size={14}
                                                    /> 연결된 주석</span
                                                >
                                                <div class="spacer"></div>
                                                {#if linkedAnnotation}
                                                    <button
                                                        class="icon-btn"
                                                        on:click={unlinkAnnotation}
                                                        title="연결 해제"
                                                        ><Icon
                                                            name="x"
                                                            size={14}
                                                        /></button
                                                    >
                                                {:else}
                                                    <button
                                                        class="icon-btn"
                                                        on:click={linkAnnotation}
                                                        title="주석 연결"
                                                        ><Icon
                                                            name="plus"
                                                            size={14}
                                                        /></button
                                                    >
                                                {/if}
                                            </div>
                                            {#if linkedAnnotation}
                                                <div
                                                    class="linked-annotation-box"
                                                >
                                                    <div class="la-header">
                                                        <span class="la-tag"
                                                            >{linkedAnnotation.type ===
                                                            "scene"
                                                                ? "씬 메모"
                                                                : "대사 주석"}</span
                                                        >
                                                        <span class="la-source"
                                                            >[{linkedAnnotation.source}]</span
                                                        >
                                                    </div>
                                                    <div class="la-content">
                                                        {linkedAnnotation.content ||
                                                            "(내용 없음)"}
                                                    </div>
                                                    {#if linkedAnnotation.text}
                                                        <div class="la-context">
                                                            "{linkedAnnotation.text}"
                                                        </div>
                                                    {/if}
                                                    <button
                                                        class="primary-btn tiny"
                                                        style="margin-top: 10px;"
                                                        on:click={() =>
                                                            goToAnnotation(
                                                                selectedItemData.linkedAnnotationId,
                                                            )}
                                                    >
                                                        <Icon
                                                            name="arrow-right"
                                                            size={12}
                                                        /> 이동
                                                    </button>
                                                </div>
                                            {:else}
                                                <div class="empty-text">
                                                    연결된 주석이 없습니다.
                                                </div>
                                            {/if}
                                        </div>

                                        {#if activeTab !== "history"}
                                            <div class="section-box">
                                                <div class="box-header">
                                                    <Icon
                                                        name="share-2"
                                                        size={14}
                                                    /> 연관된 항목 (Connections)
                                                </div>
                                                <div class="connections-list">
                                                    {#if connections.length > 0}
                                                        {#each connections as c}
                                                            <div
                                                                class="connection-chip"
                                                                role="button"
                                                                tabindex="0"
                                                                on:keydown={(
                                                                    e,
                                                                ) =>
                                                                    (e.key ===
                                                                        "Enter" ||
                                                                        e.key ===
                                                                            " ") &&
                                                                    (c.type ===
                                                                    "character"
                                                                        ? uiState.openCharacterSheet(
                                                                              c.id,
                                                                          )
                                                                        : ((activeTab =
                                                                              {
                                                                                  creature:
                                                                                      "creatures",
                                                                                  location:
                                                                                      "locations",
                                                                                  item: "items",
                                                                                  group: "groups",
                                                                                  lore: "lore",
                                                                                  history:
                                                                                      "history",
                                                                              }[
                                                                                  c
                                                                                      .type
                                                                              ] ||
                                                                              activeTab),
                                                                          (selectedItemId =
                                                                              c.id),
                                                                          (selectedItemType =
                                                                              c.type)))}
                                                                on:click={() => {
                                                                    if (
                                                                        c.type ===
                                                                        "character"
                                                                    )
                                                                        uiState.openCharacterSheet(
                                                                            c.id,
                                                                        );
                                                                    else {
                                                                        // Switch to that item
                                                                        const tabMap =
                                                                            {
                                                                                creature:
                                                                                    "creatures",
                                                                                location:
                                                                                    "locations",
                                                                                item: "items",
                                                                                group: "groups",
                                                                                lore: "lore",
                                                                                history:
                                                                                    "history",
                                                                            };
                                                                        if (
                                                                            tabMap[
                                                                                c
                                                                                    .type
                                                                            ]
                                                                        ) {
                                                                            activeTab =
                                                                                tabMap[
                                                                                    c
                                                                                        .type
                                                                                ];
                                                                            selectedItemId =
                                                                                c.id;
                                                                            selectedItemType =
                                                                                c.type;
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <div
                                                                    class="conn-avatar"
                                                                    style="background:{c.color}"
                                                                >
                                                                    {#if c.type === "character"}
                                                                        {c
                                                                            .name[0]}
                                                                    {:else}
                                                                        <Icon
                                                                            name={c.icon}
                                                                            size={14}
                                                                            color="white"
                                                                        />
                                                                    {/if}
                                                                </div>
                                                                <div
                                                                    class="conn-info"
                                                                >
                                                                    <span
                                                                        class="conn-name"
                                                                        >{c.name}</span
                                                                    >
                                                                    <span
                                                                        class="conn-reason"
                                                                        >{c.reason}</span
                                                                    >
                                                                </div>
                                                            </div>
                                                        {/each}
                                                    {:else}
                                                        <div class="empty-text">
                                                            이 항목과 연관된
                                                            항목이 없습니다.
                                                        </div>
                                                    {/if}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>

                                    <div class="detail-side-col">
                                        {#if activeTab !== "history"}
                                            <div class="meta-field">
                                                <label
                                                    for="wiki-category-select"
                                                    >카테고리</label
                                                >
                                                <select
                                                    id="wiki-category-select"
                                                    value={selectedItemData.category ||
                                                        ""}
                                                    on:change={(e) => {
                                                        const val =
                                                            e.target.value;
                                                        if (
                                                            activeTab === "lore"
                                                        )
                                                            projectActions.updateDictionaryEntry(
                                                                selectedItemData.id,
                                                                {
                                                                    category:
                                                                        val,
                                                                },
                                                            );
                                                        else if (
                                                            activeTab ===
                                                            "characters"
                                                        )
                                                            projectActions.updateCharacter(
                                                                selectedItemData.id,
                                                                {
                                                                    category:
                                                                        val,
                                                                },
                                                            );
                                                        else
                                                            projectActions.updateWikiItem(
                                                                activeTab.slice(
                                                                    0,
                                                                    -1,
                                                                ),
                                                                selectedItemData.id,
                                                                {
                                                                    category:
                                                                        val,
                                                                },
                                                            );
                                                    }}
                                                >
                                                    <option value=""
                                                        >(없음)</option
                                                    >
                                                    {#each ($activeStory[activeTab === "lore" ? "dictionaryCategories" : activeTab.slice(0, -1) + "Categories"] || []).sort() as cat}
                                                        <option value={cat}
                                                            >{cat}</option
                                                        >
                                                    {/each}
                                                </select>
                                            </div>
                                            <div class="meta-field">
                                                <label for="wiki-alias-input"
                                                    >별칭</label
                                                >
                                                <input
                                                    id="wiki-alias-input"
                                                    type="text"
                                                    value={(
                                                        selectedItemData.aliases ||
                                                        []
                                                    ).join(", ")}
                                                    on:change={(e) => {
                                                        const val =
                                                            e.target.value
                                                                .split(",")
                                                                .map((s) =>
                                                                    s.trim(),
                                                                )
                                                                .filter(
                                                                    Boolean,
                                                                );
                                                        if (
                                                            activeTab === "lore"
                                                        )
                                                            projectActions.updateDictionaryEntry(
                                                                selectedItemData.id,
                                                                {
                                                                    aliases:
                                                                        val,
                                                                },
                                                            );
                                                        else if (
                                                            activeTab ===
                                                            "characters"
                                                        )
                                                            projectActions.updateCharacter(
                                                                selectedItemData.id,
                                                                {
                                                                    aliases:
                                                                        val,
                                                                },
                                                            );
                                                        else
                                                            projectActions.updateWikiItem(
                                                                activeTab.slice(
                                                                    0,
                                                                    -1,
                                                                ),
                                                                selectedItemData.id,
                                                                {
                                                                    aliases:
                                                                        val,
                                                                },
                                                            );
                                                    }}
                                                    placeholder="별명1, 별명2"
                                                />
                                            </div>
                                            <div class="meta-field">
                                                <label for="wiki-tag-input"
                                                    >태그</label
                                                >
                                                <div
                                                    class="tags-wrapper"
                                                    role="button"
                                                    tabindex="0"
                                                    on:keydown={() => {}}
                                                    on:click={() => {
                                                        document
                                                            .querySelector(
                                                                "#wiki-tag-input",
                                                            )
                                                            ?.focus();
                                                    }}
                                                >
                                                    {#each selectedItemData.tags || [] as tag}
                                                        <span
                                                            class="tag-badge"
                                                            style="background-color: {getColorFromString(
                                                                tag,
                                                            )}20; color: {getColorFromString(
                                                                tag,
                                                            )}; border-color: {getColorFromString(
                                                                tag,
                                                            )}40;"
                                                        >
                                                            #{tag}
                                                            <button
                                                                on:click|stopPropagation={() => {
                                                                    const newTags =
                                                                        selectedItemData.tags.filter(
                                                                            (
                                                                                t,
                                                                            ) =>
                                                                                t !==
                                                                                tag,
                                                                        );
                                                                    if (
                                                                        activeTab ===
                                                                        "lore"
                                                                    )
                                                                        projectActions.updateDictionaryEntry(
                                                                            selectedItemData.id,
                                                                            {
                                                                                tags: newTags,
                                                                            },
                                                                        );
                                                                    else if (
                                                                        activeTab ===
                                                                        "characters"
                                                                    )
                                                                        projectActions.updateCharacter(
                                                                            selectedItemData.id,
                                                                            {
                                                                                tags: newTags,
                                                                            },
                                                                        );
                                                                    else
                                                                        projectActions.updateWikiItem(
                                                                            activeTab.slice(
                                                                                0,
                                                                                -1,
                                                                            ),
                                                                            selectedItemData.id,
                                                                            {
                                                                                tags: newTags,
                                                                            },
                                                                        );
                                                                }}>×</button
                                                            >
                                                        </span>
                                                    {/each}
                                                    <input
                                                        id="wiki-tag-input"
                                                        class="tag-add-input"
                                                        type="text"
                                                        placeholder="태그 입력 (Enter)"
                                                        on:keydown={(e) => {
                                                            if (
                                                                e.key ===
                                                                    "Enter" ||
                                                                e.key === ","
                                                            ) {
                                                                e.preventDefault();
                                                                const val =
                                                                    e.target.value
                                                                        .trim()
                                                                        .replace(
                                                                            /^#/,
                                                                            "",
                                                                        )
                                                                        .replace(
                                                                            /,/g,
                                                                            "",
                                                                        );
                                                                if (
                                                                    val &&
                                                                    !(
                                                                        selectedItemData.tags ||
                                                                        []
                                                                    ).includes(
                                                                        val,
                                                                    )
                                                                ) {
                                                                    const newTags =
                                                                        [
                                                                            ...(selectedItemData.tags ||
                                                                                []),
                                                                            val,
                                                                        ];
                                                                    if (
                                                                        activeTab ===
                                                                        "lore"
                                                                    )
                                                                        projectActions.updateDictionaryEntry(
                                                                            selectedItemData.id,
                                                                            {
                                                                                tags: newTags,
                                                                            },
                                                                        );
                                                                    else if (
                                                                        activeTab ===
                                                                        "characters"
                                                                    )
                                                                        projectActions.updateCharacter(
                                                                            selectedItemData.id,
                                                                            {
                                                                                tags: newTags,
                                                                            },
                                                                        );
                                                                    else
                                                                        projectActions.updateWikiItem(
                                                                            activeTab.slice(
                                                                                0,
                                                                                -1,
                                                                            ),
                                                                            selectedItemData.id,
                                                                            {
                                                                                tags: newTags,
                                                                            },
                                                                        );
                                                                    e.target.value =
                                                                        "";
                                                                }
                                                            } else if (
                                                                e.key ===
                                                                    "Backspace" &&
                                                                !e.target
                                                                    .value &&
                                                                (
                                                                    selectedItemData.tags ||
                                                                    []
                                                                ).length > 0
                                                            ) {
                                                                const newTags =
                                                                    [
                                                                        ...(selectedItemData.tags ||
                                                                            []),
                                                                    ];
                                                                newTags.pop();
                                                                if (
                                                                    activeTab ===
                                                                    "lore"
                                                                )
                                                                    projectActions.updateDictionaryEntry(
                                                                        selectedItemData.id,
                                                                        {
                                                                            tags: newTags,
                                                                        },
                                                                    );
                                                                else if (
                                                                    activeTab ===
                                                                    "characters"
                                                                )
                                                                    projectActions.updateCharacter(
                                                                        selectedItemData.id,
                                                                        {
                                                                            tags: newTags,
                                                                        },
                                                                    );
                                                                else
                                                                    projectActions.updateWikiItem(
                                                                        activeTab.slice(
                                                                            0,
                                                                            -1,
                                                                        ),
                                                                        selectedItemData.id,
                                                                        {
                                                                            tags: newTags,
                                                                        },
                                                                    );
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        {:else}
                                            <div class="meta-field">
                                                <label for="wiki-date-input"
                                                    >날짜</label
                                                >
                                                <input
                                                    id="wiki-date-input"
                                                    type="text"
                                                    value={selectedItemData.displayDate}
                                                    on:change={(e) =>
                                                        projectActions.updateHistoryEvent(
                                                            selectedItemData.id,
                                                            {
                                                                displayDate:
                                                                    e.target
                                                                        .value,
                                                            },
                                                        )}
                                                />
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {#if showReferencePanel}
                            <div
                                class="reference-panel"
                                transition:slide={{ axis: "x", duration: 200 }}
                            >
                                <div class="ref-header">
                                    <Icon name="search" size={14} />
                                    <input
                                        type="text"
                                        placeholder="참조 검색..."
                                        bind:value={referenceSearchText}
                                    />
                                </div>
                                <div class="ref-list">
                                    {#each groupedRefItems as group (group.id)}
                                        <div class="ref-group">
                                            <div
                                                class="ref-group-header"
                                                on:click={() =>
                                                    toggleRefGroup(group.id)}
                                                role="button"
                                                tabindex="0"
                                                on:keydown={(e) =>
                                                    (e.key === "Enter" ||
                                                        e.key === " ") &&
                                                    toggleRefGroup(group.id)}
                                            >
                                                <Icon
                                                    name={group.icon}
                                                    size={14}
                                                />
                                                <span class="ref-group-label"
                                                    >{group.label}</span
                                                >
                                                <Icon
                                                    name={referenceCollapsedGroups.has(
                                                        group.id,
                                                    )
                                                        ? "chevron-right"
                                                        : "chevron-down"}
                                                    size={12}
                                                    className="ml-auto"
                                                />
                                            </div>

                                            {#if !referenceCollapsedGroups.has(group.id)}
                                                <div
                                                    class="ref-group-content"
                                                    transition:slide
                                                >
                                                    {#each group.categoryList as category (category.id)}
                                                        <div
                                                            class="ref-category"
                                                        >
                                                            {#if category.name !== "미분류" || group.categoryList.length > 1}
                                                                <div
                                                                    class="ref-category-header"
                                                                    on:click={() =>
                                                                        toggleRefGroup(
                                                                            category.id,
                                                                        )}
                                                                    role="button"
                                                                    tabindex="0"
                                                                    on:keydown={(
                                                                        e,
                                                                    ) =>
                                                                        (e.key ===
                                                                            "Enter" ||
                                                                            e.key ===
                                                                                " ") &&
                                                                        toggleRefGroup(
                                                                            category.id,
                                                                        )}
                                                                >
                                                                    <span
                                                                        class="ref-category-name"
                                                                        >{category.name}</span
                                                                    >
                                                                    <Icon
                                                                        name={referenceCollapsedGroups.has(
                                                                            category.id,
                                                                        )
                                                                            ? "chevron-right"
                                                                            : "chevron-down"}
                                                                        size={10}
                                                                    />
                                                                </div>
                                                            {/if}

                                                            {#if !referenceCollapsedGroups.has(category.id)}
                                                                <div
                                                                    class="ref-category-items"
                                                                    transition:slide
                                                                >
                                                                    {#each category.items as refItem (refItem.id)}
                                                                        <div
                                                                            class="ref-item"
                                                                        >
                                                                            <div
                                                                                class="ref-item-header"
                                                                                on:click={() =>
                                                                                    (referenceExpandedId =
                                                                                        referenceExpandedId ===
                                                                                        refItem.id
                                                                                            ? null
                                                                                            : refItem.id)}
                                                                                role="button"
                                                                                tabindex="0"
                                                                                on:keydown={(
                                                                                    e,
                                                                                ) =>
                                                                                    (e.key ===
                                                                                        "Enter" ||
                                                                                        e.key ===
                                                                                            " ") &&
                                                                                    (referenceExpandedId =
                                                                                        referenceExpandedId ===
                                                                                        refItem.id
                                                                                            ? null
                                                                                            : refItem.id)}
                                                                            >
                                                                                <Icon
                                                                                    name={{
                                                                                        character:
                                                                                            "user",
                                                                                        creature:
                                                                                            "feather",
                                                                                        location:
                                                                                            "map",
                                                                                        item: "package",
                                                                                        group: "flag",
                                                                                        lore: "book",
                                                                                        history:
                                                                                            "clock",
                                                                                    }[
                                                                                        refItem
                                                                                            .type
                                                                                    ]}
                                                                                    size={14}
                                                                                    className="ref-type-icon"
                                                                                />
                                                                                <span
                                                                                    class="ref-name"
                                                                                    >{refItem.name ||
                                                                                        refItem.term ||
                                                                                        refItem.title}</span
                                                                                >
                                                                                <Icon
                                                                                    name={referenceExpandedId ===
                                                                                    refItem.id
                                                                                        ? "chevron-up"
                                                                                        : "chevron-down"}
                                                                                    size={14}
                                                                                />
                                                                            </div>
                                                                            {#if referenceExpandedId === refItem.id}
                                                                                <div
                                                                                    class="ref-item-body"
                                                                                    transition:slide
                                                                                >
                                                                                    <div
                                                                                        class="ref-desc"
                                                                                        on:click={handleLinkClick}
                                                                                        role="none"
                                                                                    >
                                                                                        {#if refItem.description || refItem.definition}
                                                                                            {@html linkifyText(
                                                                                                refItem.description ||
                                                                                                    refItem.definition,
                                                                                                getAllWikiItems(),
                                                                                                refItem.id,
                                                                                            )}
                                                                                        {:else}
                                                                                            <span
                                                                                                class="empty-text"
                                                                                                >설명이
                                                                                                없습니다.</span
                                                                                            >
                                                                                        {/if}
                                                                                    </div>
                                                                                </div>
                                                                            {/if}
                                                                        </div>
                                                                    {/each}
                                                                </div>
                                                            {/if}
                                                        </div>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {:else}
                    <!-- GRID / LIST VIEW -->
                    <div class="toolbar">
                        <div class="search-bar">
                            <Icon name="search" size={16} />
                            <input
                                type="text"
                                placeholder="검색..."
                                bind:value={searchText}
                            />
                        </div>
                        {#if activeTab !== "history"}
                            <div class="view-toggle">
                                <button
                                    class="icon-btn"
                                    class:active={sortMode === "custom"}
                                    on:click={() => (sortMode = "custom")}
                                    title="사용자 지정 순서"
                                    ><Icon name="list" size={16} /></button
                                >
                                <button
                                    class="icon-btn"
                                    class:active={sortMode === "name"}
                                    on:click={() => (sortMode = "name")}
                                    title="이름순"
                                    ><Icon name="type" size={16} /></button
                                >
                            </div>
                        {/if}
                        <button class="primary-btn" on:click={createNew}>
                            <Icon name="plus" size={16} /> <span>추가</span>
                        </button>
                        <button class="icon-btn close-btn" on:click={close}
                            ><Icon name="x" size={20} /></button
                        >
                    </div>

                    <div class="content-body">
                        {#if activeTab === "history"}
                            <!-- History View -->
                            <div class="history-view">
                                <div class="eras-sidebar">
                                    <div class="list-header">
                                        <span>시대 (Eras)</span>
                                        <button
                                            class="icon-btn tiny"
                                            on:click={addEra}
                                            ><Icon
                                                name="plus"
                                                size={12}
                                            /></button
                                        >
                                    </div>
                                    <div
                                        class="era-item"
                                        class:selected={selectedEraId === null}
                                        class:drag-over={dropTarget ===
                                            "__NO_ERA__"}
                                        role="button"
                                        tabindex="0"
                                        on:keydown={(e) =>
                                            (e.key === "Enter" ||
                                                e.key === " ") &&
                                            (selectedEraId = null)}
                                        on:click={() => (selectedEraId = null)}
                                        on:dragenter={() =>
                                            (dropTarget = "__NO_ERA__")}
                                        on:dragover={handleDragOver}
                                        on:drop={(e) => handleEraDrop(e, null)}
                                    >
                                        전체 보기 (미분류)
                                    </div>
                                    {#each $activeStory.history?.eras || [] as era}
                                        <div
                                            class="era-item"
                                            class:selected={selectedEraId ===
                                                era.id}
                                            class:drag-over={dropTarget ===
                                                era.id}
                                            draggable="true"
                                            role="button"
                                            tabindex="0"
                                            on:keydown={(e) =>
                                                (e.key === "Enter" ||
                                                    e.key === " ") &&
                                                (selectedEraId = era.id)}
                                            on:click={() =>
                                                (selectedEraId = era.id)}
                                            on:dragstart={(e) =>
                                                handleEraListDragStart(
                                                    e,
                                                    era.id,
                                                )}
                                            on:dragenter={() =>
                                                (dropTarget = era.id)}
                                            on:dragover={handleDragOver}
                                            on:drop={(e) =>
                                                handleEraDrop(e, era.id)}
                                        >
                                            <span
                                                class="dot"
                                                style="background:{era.color}"
                                            ></span>
                                            <span class="era-name"
                                                >{era.name}</span
                                            >
                                            <button
                                                class="cat-del"
                                                title="삭제"
                                                on:click|stopPropagation={() => {
                                                    confirmation.prompt(
                                                        `'${era.name}' 시대를 삭제하시겠습니까? 포함된 사건들은 '미분류'로 이동합니다.`,
                                                        () => {
                                                            projectActions.removeHistoryEra(
                                                                era.id,
                                                            );
                                                            if (
                                                                selectedEraId ===
                                                                era.id
                                                            )
                                                                selectedEraId =
                                                                    null;
                                                        },
                                                    );
                                                }}>×</button
                                            >
                                        </div>
                                    {/each}
                                </div>
                                <div class="timeline-container">
                                    {#each ($activeStory.history?.events || [])
                                        .filter((e) => !selectedEraId || e.eraId === selectedEraId)
                                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) as event (event.id)}
                                        <div
                                            class="timeline-item"
                                            class:drag-over={dropTarget ===
                                                event.id}
                                            draggable="true"
                                            role="button"
                                            tabindex="0"
                                            on:keydown={(e) =>
                                                (e.key === "Enter" ||
                                                    e.key === " ") &&
                                                ((selectedItemId = event.id),
                                                (selectedItemType = "history"))}
                                            on:dragstart={(e) =>
                                                handleDragStart(
                                                    e,
                                                    event.id,
                                                    "history",
                                                )}
                                            on:dragend={handleDragEnd}
                                            on:dragenter={() =>
                                                (dropTarget = event.id)}
                                            on:dragover={handleDragOver}
                                            on:drop={(e) =>
                                                handleDrop(
                                                    e,
                                                    event.id,
                                                    "history",
                                                )}
                                            on:click={() => {
                                                selectedItemId = event.id;
                                                selectedItemType = "history";
                                            }}
                                        >
                                            <div class="marker"></div>
                                            <div class="tl-content">
                                                <span class="date"
                                                    >{event.displayDate ||
                                                        "???"}</span
                                                >
                                                <h4>{event.title}</h4>
                                                <p>
                                                    {(
                                                        event.description || ""
                                                    ).substring(0, 50)}
                                                </p>
                                            </div>
                                        </div>
                                    {/each}
                                    <button
                                        class="add-event-btn"
                                        on:click={() => addEvent(selectedEraId)}
                                        >+ 사건 추가</button
                                    >
                                </div>
                            </div>
                        {:else}
                            <!-- Grid View -->
                            <div class="split-view">
                                <!-- Category Sidebar -->
                                <div class="cat-sidebar">
                                    <div class="cat-header">
                                        <span>카테고리</span>
                                        <button
                                            class="icon-btn tiny"
                                            on:click={createCategory}
                                            ><Icon
                                                name="plus"
                                                size={12}
                                            /></button
                                        >
                                    </div>
                                    <div
                                        class="cat-item"
                                        class:selected={selectedCategoryPath ===
                                            null}
                                        class:drag-over={dropTarget ===
                                            "__ROOT__"}
                                        role="button"
                                        tabindex="0"
                                        on:keydown={(e) =>
                                            (e.key === "Enter" ||
                                                e.key === " ") &&
                                            (selectedCategoryPath = null)}
                                        on:click={() =>
                                            (selectedCategoryPath = null)}
                                        on:dragenter={() =>
                                            (dropTarget = "__ROOT__")}
                                        on:dragover={handleDragOver}
                                        on:drop={(e) => handleCatDrop(e, null)}
                                    >
                                        <Icon name="grid" size={14} /> 전체
                                    </div>
                                    {#each $activeStory[activeTab === "lore" ? "dictionaryCategories" : activeTab.slice(0, -1) + "Categories"] || [] as cat}
                                        {@const depth =
                                            cat.split("/").length - 1}
                                        <div
                                            class="cat-item"
                                            class:selected={selectedCategoryPath ===
                                                cat}
                                            class:drag-over={dropTarget === cat}
                                            class:drag-over-inside={dropTarget ===
                                                cat &&
                                                dropPosition === "inside"}
                                            class:drag-over-before={dropTarget ===
                                                cat &&
                                                dropPosition === "before"}
                                            class:drag-over-after={dropTarget ===
                                                cat && dropPosition === "after"}
                                            style="padding-left: {10 +
                                                depth * 15}px"
                                            role="button"
                                            tabindex="0"
                                            on:keydown={(e) =>
                                                (e.key === "Enter" ||
                                                    e.key === " ") &&
                                                (selectedCategoryPath = cat)}
                                            on:click={() =>
                                                (selectedCategoryPath = cat)}
                                            draggable="true"
                                            on:dragstart={(e) =>
                                                handleCatDragStart(e, cat)}
                                            on:dragend={handleDragEnd}
                                            on:dragenter={() =>
                                                (dropTarget = cat)}
                                            on:dragover={(e) =>
                                                handleCatDragOver(e, cat)}
                                            on:drop={(e) =>
                                                handleCatDrop(e, cat)}
                                        >
                                            <Icon name="folder" size={14} />
                                            <span class="cat-name"
                                                >{cat.split("/").pop()}</span
                                            >
                                            <button
                                                class="cat-del"
                                                on:click|stopPropagation={() =>
                                                    projectActions.deleteGroup(
                                                        activeTab === "lore"
                                                            ? "dictionary"
                                                            : activeTab.slice(
                                                                  0,
                                                                  -1,
                                                              ),
                                                        cat,
                                                    )}>×</button
                                            >
                                        </div>
                                    {/each}

                                    <!-- Bottom Drop Zone (Move to Root) -->
                                    <div
                                        class="cat-drop-zone-bottom"
                                        class:drag-over={dropTarget ===
                                            "__BOTTOM_ROOT__"}
                                        on:dragenter={() =>
                                            (dropTarget = "__BOTTOM_ROOT__")}
                                        on:dragover={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = "move";
                                        }}
                                        on:drop={(e) => handleCatDrop(e, null)}
                                    >
                                        <span class="hint-text"
                                            >여기로 드래그하여 최상위로 이동</span
                                        >
                                    </div>
                                </div>

                                <!-- Grid -->
                                <div class="grid-container">
                                    {#each filteredItems as item (item.id)}
                                        {#if activeTab === "characters"}
                                            <!-- Character Card Style (Portrait) -->
                                            <div
                                                class="character-card portrait-card"
                                                class:drag-over={dropTarget ===
                                                    item.id}
                                                draggable={sortMode ===
                                                    "custom" && !searchText}
                                                role="button"
                                                tabindex="0"
                                                on:keydown={(e) =>
                                                    (e.key === "Enter" ||
                                                        e.key === " ") &&
                                                    ((selectedItemId = item.id),
                                                    (selectedItemType =
                                                        "character"))}
                                                on:dragstart={(e) =>
                                                    handleDragStart(
                                                        e,
                                                        item.id,
                                                        "characters",
                                                    )}
                                                on:dragend={handleDragEnd}
                                                on:dragenter={() =>
                                                    (dropTarget = item.id)}
                                                on:dragover={handleDragOver}
                                                on:drop={(e) =>
                                                    handleDrop(
                                                        e,
                                                        item.id,
                                                        "characters",
                                                    )}
                                                on:click={() => {
                                                    selectedItemId = item.id;
                                                    selectedItemType =
                                                        "character";
                                                }}
                                                style="--card-color: {item.color ||
                                                    '#444'};"
                                            >
                                                <!-- Background Image/Color -->
                                                <div class="card-bg">
                                                    {#if item.profileImage}
                                                        <img
                                                            src={item.profileImage}
                                                            alt={item.name}
                                                        />
                                                    {:else}
                                                        <div
                                                            class="placeholder-bg"
                                                            style="background-color: var(--card-color)"
                                                        >
                                                            <span
                                                                class="placeholder-initial"
                                                                >{item
                                                                    .name[0]}</span
                                                            >
                                                        </div>
                                                    {/if}
                                                </div>

                                                <!-- Gradient Overlay -->
                                                <div class="card-overlay"></div>

                                                <!-- Content -->
                                                <div class="card-content">
                                                    <div class="card-header">
                                                        <div
                                                            class="header-left"
                                                        >
                                                            {#if item.category}
                                                                <span
                                                                    class="card-badge category-badge"
                                                                    >{item.category
                                                                        .split(
                                                                            "/",
                                                                        )
                                                                        .pop()}</span
                                                                >
                                                            {/if}
                                                            {#if item.aliases && item.aliases.length > 0}
                                                                <span
                                                                    class="card-badge alias-badge"
                                                                    title={item.aliases.join(
                                                                        ", ",
                                                                    )}
                                                                    >{item
                                                                        .aliases[0]}</span
                                                                >
                                                            {/if}
                                                        </div>
                                                        <div
                                                            class="header-right"
                                                        >
                                                            {#if getAffiliationName($activeStory, item.affiliation)}
                                                                <span
                                                                    class="card-badge affiliation-badge"
                                                                >
                                                                    <Icon
                                                                        name="flag"
                                                                        size={10}
                                                                    />
                                                                    {getAffiliationName(
                                                                        $activeStory,
                                                                        item.affiliation,
                                                                    )}
                                                                </span>
                                                            {/if}
                                                        </div>
                                                    </div>

                                                    <div
                                                        class="card-body-spacer"
                                                    ></div>

                                                    <div class="card-footer">
                                                        <h4 class="card-name">
                                                            {item.name}
                                                        </h4>

                                                        <div class="card-tags">
                                                            {#each (item.tags || []).slice(0, 3) as tag}
                                                                <span
                                                                    class="mini-tag"
                                                                    >#{tag}</span
                                                                >
                                                            {/each}
                                                        </div>

                                                        <p class="flavor-text">
                                                            {(
                                                                item.description ||
                                                                "..."
                                                            ).substring(
                                                                0,
                                                                60,
                                                            )}{item.description
                                                                ?.length > 60
                                                                ? "..."
                                                                : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        {:else}
                                            <!-- Standard Wiki Card -->
                                            <div
                                                class="wiki-card"
                                                class:drag-over={dropTarget ===
                                                    item.id}
                                                draggable={sortMode ===
                                                    "custom" && !searchText}
                                                role="button"
                                                tabindex="0"
                                                on:keydown={(e) =>
                                                    (e.key === "Enter" ||
                                                        e.key === " ") &&
                                                    ((selectedItemId = item.id),
                                                    (selectedItemType =
                                                        activeTab === "lore"
                                                            ? "lore"
                                                            : activeTab.slice(
                                                                  0,
                                                                  -1,
                                                              )))}
                                                on:dragstart={(e) =>
                                                    handleDragStart(
                                                        e,
                                                        item.id,
                                                        activeTab === "lore"
                                                            ? "lore"
                                                            : activeTab.slice(
                                                                  0,
                                                                  -1,
                                                              ),
                                                    )}
                                                on:dragend={handleDragEnd}
                                                on:dragenter={() =>
                                                    (dropTarget = item.id)}
                                                on:dragover={handleDragOver}
                                                on:drop={(e) =>
                                                    handleDrop(
                                                        e,
                                                        item.id,
                                                        activeTab === "lore"
                                                            ? "lore"
                                                            : activeTab.slice(
                                                                  0,
                                                                  -1,
                                                              ),
                                                    )}
                                                on:click={() => {
                                                    selectedItemId = item.id;
                                                    selectedItemType =
                                                        activeTab === "lore"
                                                            ? "lore"
                                                            : activeTab.slice(
                                                                  0,
                                                                  -1,
                                                              );
                                                }}
                                            >
                                                <div class="card-icon">
                                                    <Icon
                                                        name={tabs.find(
                                                            (t) =>
                                                                t.id ===
                                                                activeTab,
                                                        ).icon}
                                                        size={24}
                                                    />
                                                </div>
                                                <div class="card-info">
                                                    <h4>
                                                        {item.name || item.term}
                                                    </h4>
                                                    {#if item.category}<span
                                                            class="cat-tag"
                                                            >{item.category
                                                                .split("/")
                                                                .pop()}</span
                                                        >{/if}
                                                    <p>
                                                        {(
                                                            item.description ||
                                                            item.definition ||
                                                            ""
                                                        ).substring(0, 40)}...
                                                    </p>
                                                </div>
                                            </div>
                                        {/if}
                                    {/each}

                                    <!-- Add New Item Card -->
                                    <div
                                        class:wiki-card={activeTab !==
                                            "characters"}
                                        class:character-card={activeTab ===
                                            "characters"}
                                        class:portrait-card={activeTab ===
                                            "characters"}
                                        class="add-new-card"
                                        on:click={createNew}
                                        role="button"
                                        tabindex="0"
                                        on:keydown={(e) =>
                                            (e.key === "Enter" ||
                                                e.key === " ") &&
                                            createNew()}
                                    >
                                        <div class="add-content">
                                            <Icon
                                                name="plus"
                                                size={activeTab === "characters"
                                                    ? 48
                                                    : 32}
                                                color="var(--text-color-muted)"
                                            />
                                            <span
                                                >새 {getTabLabel(activeTab)} 추가</span
                                            >
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<!-- Import Overlay -->
{#if showImportOverlay}
    <div class="modal-backdrop" style="z-index: 1200;">
        <div class="modal-content small-modal">
            <h3>데이터 가져오기</h3>
            <textarea
                bind:value={importWikiText}
                placeholder="텍스트 붙여넣기..."
            ></textarea>
            <div class="actions">
                <button on:click={() => (showImportOverlay = false)}
                    >취소</button
                >
                <button
                    class="primary-btn"
                    on:click={() => {
                        projectActions.importWikiData(
                            parseSmartInput(importWikiText),
                        );
                        showImportOverlay = false;
                    }}>확인</button
                >
            </div>
        </div>
    </div>
{/if}

<!-- Export Overlay -->
{#if showExportOverlay}
    <div class="modal-backdrop" style="z-index: 1200;">
        <div class="modal-content small-modal">
            <h3>
                데이터 내보내기 ({tabs.find((t) => t.id === activeTab)?.label})
            </h3>
            <textarea
                readonly
                value={exportWikiText}
                on:click={(e) => e.target.select()}
            ></textarea>
            <div class="actions">
                <button on:click={() => (showExportOverlay = false)}
                    >닫기</button
                >
                <button
                    class="primary-btn"
                    on:click={() => {
                        navigator.clipboard.writeText(exportWikiText);
                        notifications.add(
                            "클립보드에 복사되었습니다.",
                            "success",
                        );
                    }}
                >
                    <Icon name="copy" size={14} /> 복사하기
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Structure */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .modal-content {
        width: 90%;
        height: 90%;
        background: var(--primary-bg);
        border-radius: 8px;
        display: flex;
        overflow: hidden;
        box-shadow: 0 5px 30px rgba(0, 0, 0, 0.5);
        position: relative;
    }

    /* Sidebar */
    .sidebar {
        width: 200px;
        background: var(--secondary-bg);
        border-right: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
    }
    .sidebar-header {
        padding: 15px;
        border-bottom: 1px solid var(--border-color);
    }
    .sidebar-header h2 {
        margin: 0;
        font-size: 1.1em;
    }
    .nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 15px;
        width: 100%;
        border: none;
        background: none;
        color: var(--text-color-muted);
        cursor: pointer;
        text-align: left;
    }
    .nav-item:hover {
        background: rgba(255, 255, 255, 0.05);
    }
    .nav-item.active {
        background: var(--accent-color);
        color: white;
    }
    .sidebar-footer {
        margin-top: auto;
        border-top: 1px solid var(--border-color);
    }

    /* Main Content */
    .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
    }
    .toolbar {
        padding: 10px 20px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--primary-bg);
    }
    .search-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--secondary-bg);
        padding: 6px 10px;
        border-radius: 4px;
        flex: 1;
        border: 1px solid var(--border-color);
    }
    .search-bar input {
        border: none;
        background: none;
        color: var(--text-color);
        width: 100%;
    }
    .primary-btn {
        background: var(--accent-color);
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
    }
    .icon-btn {
        background: none;
        border: 1px solid transparent;
        color: var(--text-color-muted);
        padding: 6px;
        border-radius: 4px;
        cursor: pointer;
    }
    .icon-btn:hover,
    .icon-btn.active {
        background: var(--secondary-bg);
        border-color: var(--border-color);
        color: var(--text-color);
    }
    .close-btn {
        margin-left: 10px;
    }

    .content-body {
        flex: 1;
        overflow: hidden;
        position: relative;
    }
    .split-view {
        display: flex;
        height: 100%;
    }

    /* Category Sidebar inside Main */
    .cat-sidebar {
        width: 180px;
        background: var(--secondary-bg);
        border-right: 1px solid var(--border-color);
        padding: 10px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }
    .cat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.85em;
        font-weight: bold;
        color: var(--text-color-muted);
        margin-bottom: 10px;
        flex-shrink: 0;
    }
    .cat-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px;
        cursor: pointer;
        border-radius: 4px;
        color: var(--text-color-muted);
        font-size: 0.9em;
        flex-shrink: 0;
    }
    .cat-item:hover {
        background: rgba(255, 255, 255, 0.05);
    }
    .cat-item.selected {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-color);
        font-weight: bold;
    }
    /* General drag over style */
    .cat-item.drag-over {
        background: rgba(0, 170, 255, 0.1);
    }
    /* Specific styles */
    .cat-item.drag-over-inside {
        outline: 2px dashed var(--accent-color);
        outline-offset: -2px;
        background: rgba(0, 170, 255, 0.2);
    }
    .cat-item.drag-over-before {
        box-shadow: 0 -2px 0 var(--accent-color);
        background: transparent;
        z-index: 10;
        position: relative;
    }
    .cat-item.drag-over-after {
        box-shadow: 0 2px 0 var(--accent-color);
        background: transparent;
        z-index: 10;
        position: relative;
    }

    .cat-drop-zone-bottom {
        flex-grow: 1;
        min-height: 40px;
        margin-top: 10px;
        border: 2px dashed transparent;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: transparent;
        font-size: 0.8em;
        transition: all 0.2s;
    }
    .cat-drop-zone-bottom.drag-over {
        border-color: var(--accent-color);
        background-color: rgba(0, 170, 255, 0.1);
        color: var(--accent-color);
    }
    .cat-drop-zone-bottom .hint-text {
        pointer-events: none;
    }

    .cat-del {
        margin-left: auto;
        background: none;
        border: none;
        color: var(--text-color-muted);
        opacity: 0;
        cursor: pointer;
    }
    .cat-item:hover .cat-del,
    .era-item:hover .cat-del {
        opacity: 1;
    }
    .cat-name,
    .era-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Grid */
    .grid-container {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 20px;
        align-content: start;
        grid-auto-rows: max-content;
    }

    .add-new-card {
        border: 2px dashed var(--border-color);
        background-color: rgba(255, 255, 255, 0.02);
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: all 0.2s;
        opacity: 0.7;
    }
    .add-new-card:hover {
        border-color: var(--accent-color);
        background-color: rgba(255, 255, 255, 0.05);
        opacity: 1;
        transform: translateY(-2px);
    }
    .add-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: var(--text-color-muted);
        font-weight: 500;
        font-size: 0.9em;
    }
    .add-new-card:hover .add-content {
        color: var(--accent-color);
    }
    .add-new-card:hover :global(svg) {
        /* Target the Icon component's SVG */
        stroke: var(--accent-color);
    }

    .wiki-card {
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 15px;
        cursor: pointer;
        display: flex;
        gap: 12px;
        height: 100px;
        transition:
            transform 0.2s,
            box-shadow 0.2s;
    }
    .wiki-card:hover {
        border-color: var(--accent-color);
        transform: translateY(-2px);
        transition: all 0.2s;
    }
    .wiki-card.drag-over {
        border-color: var(--accent-color);
        background: rgba(0, 170, 255, 0.1);
        transform: scale(1.02);
        z-index: 10;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .card-icon {
        opacity: 0.5;
    }
    .card-info {
        overflow: hidden;
        flex: 1;
    }
    .card-info h4 {
        margin: 0 0 5px 0;
        font-size: 1em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .card-info p {
        margin: 0;
        font-size: 0.8em;
        color: var(--text-color-muted);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .cat-tag {
        font-size: 0.7em;
        background: rgba(0, 0, 0, 0.2);
        padding: 2px 4px;
        border-radius: 3px;
    }

    /* Character Cards (Portrait Style) */
    .character-card.portrait-card {
        padding: 0;
        aspect-ratio: 3/4; /* Slightly shorter than 2/3 */
        border: 1px solid var(--border-color);
        border-radius: 10px;
        position: relative;
        overflow: hidden;
        background: var(--secondary-bg);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        transition:
            transform 0.2s,
            box-shadow 0.2s,
            border-color 0.2s;
        display: flex;
        flex-direction: column;
    }

    .character-card.portrait-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
        border-color: var(--accent-color);
        z-index: 5;
    }
    .character-card.portrait-card.drag-over {
        border-color: var(--accent-color);
        background: rgba(0, 170, 255, 0.1);
        transform: scale(1.05);
        z-index: 10;
    }

    .card-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        background-color: var(--secondary-bg);
    }
    .card-bg img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .placeholder-bg {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        opacity: 0.8;
    }
    .placeholder-initial {
        font-size: 4em;
        font-weight: 900;
        color: rgba(255, 255, 255, 0.3);
    }

    .card-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 80%;
        background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.95) 0%,
            rgba(0, 0, 0, 0.7) 40%,
            transparent 100%
        );
        z-index: 1;
        pointer-events: none;
    }

    .card-content {
        position: relative;
        z-index: 2;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 12px;
        color: white;
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 5px;
        width: 100%;
    }

    .header-left,
    .header-right {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .header-right {
        justify-content: flex-end;
    }

    .card-badge {
        font-size: 0.7em;
        padding: 3px 6px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-weight: bold;
        text-shadow: 0 1px 2px black;
        white-space: nowrap;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        gap: 3px;
    }
    .category-badge {
        color: #aaa;
    }
    .affiliation-badge {
        color: var(--accent-color);
        border-color: var(--accent-color);
        background: rgba(0, 0, 0, 0.8);
    }
    .alias-badge {
        color: #efbcf9;
        border-color: #efbcf9;
    }

    .card-body-spacer {
        flex: 1;
        min-height: 20px;
    }

    .card-footer {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-height: 0;
    }

    .card-name {
        margin: 0;
        font-size: 1.2em;
        font-weight: 800;
        text-shadow: 0 2px 4px black;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 4px;
    }
    .mini-tag {
        font-size: 0.65em;
        color: #ccc;
        opacity: 0.8;
        background: rgba(255, 255, 255, 0.1);
        padding: 1px 4px;
        border-radius: 3px;
    }

    .flavor-text {
        font-size: 0.8em;
        font-style: italic;
        color: #ddd;
        opacity: 0.9;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-shadow: 0 1px 2px black;
        margin: 0;
        line-height: 1.3;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        padding-top: 6px;
        margin-top: 2px;
    }

    /* Detail View Avatar */
    .detail-avatar {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 2.5em;
        font-weight: bold;
        color: white;
        overflow: hidden;
        border: 4px solid var(--secondary-bg);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        flex-shrink: 0;
        position: relative; /* For overlay */
    }
    .detail-avatar.square {
        border-radius: 12px;
    }
    .detail-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    /* Avatar Overlay for Upload */
    .avatar-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        opacity: 0;
        transition: opacity 0.2s;
    }
    .detail-avatar:hover .avatar-overlay {
        opacity: 1;
    }
    .avatar-overlay button {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.5);
        color: white;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        padding: 0;
    }
    .avatar-overlay button:hover {
        background: rgba(255, 255, 255, 0.4);
    }

    /* History View */
    .history-view {
        display: flex;
        height: 100%;
    }
    .eras-sidebar {
        width: 200px;
        background: var(--secondary-bg);
        border-right: 1px solid var(--border-color);
        padding: 15px;
    }
    .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.85em;
        font-weight: 800;
        color: var(--text-color-muted);
        margin-bottom: 15px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .era-item {
        padding: 8px;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid transparent;
    }
    .era-item.selected {
        background: rgba(255, 255, 255, 0.1);
        font-weight: bold;
    }
    .era-item.drag-over {
        background: rgba(0, 170, 255, 0.2);
        outline: 2px dashed var(--accent-color);
        outline-offset: -2px;
    }
    .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }
    .timeline-container {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    .timeline-item {
        display: flex;
        gap: 15px;
        background: var(--secondary-bg);
        padding: 15px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid transparent;
        transition:
            transform 0.2s,
            box-shadow 0.2s;
    }
    .timeline-item:hover {
        border-color: var(--border-color);
    }
    .timeline-item.drag-over {
        border-color: var(--accent-color);
        background: rgba(0, 170, 255, 0.1);
        transform: scale(1.02);
        z-index: 10;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .timeline-item .marker {
        width: 4px;
        background: var(--accent-color);
        border-radius: 2px;
    }
    .tl-content .date {
        font-size: 0.8em;
        color: var(--accent-color);
        font-weight: bold;
    }
    .tl-content h4 {
        margin: 4px 0;
    }
    .add-event-btn {
        padding: 10px;
        border: 1px dashed var(--border-color);
        background: none;
        color: var(--text-color-muted);
        cursor: pointer;
        border-radius: 6px;
    }

    /* FULL DETAIL VIEW */
    .detail-view {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--primary-bg);
        height: 100%;
    }
    .detail-header {
        padding: 15px 20px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 20px;
    }
    .back-btn {
        background: none;
        border: none;
        color: var(--text-color-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        font-weight: bold;
    }
    .back-btn:hover {
        color: var(--text-color);
    }
    .spacer {
        flex: 1;
    }
    .danger-icon-btn {
        background: none;
        border: 1px solid var(--danger-color);
        color: var(--danger-color);
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    .danger-icon-btn:hover {
        background: var(--danger-color);
        color: white;
    }

    .detail-scroll-body {
        flex: 1;
        overflow-y: auto;
        padding: 30px;
    }
    .detail-container {
        max-width: 900px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .detail-title-row {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 10px;
    }
    .big-title-input {
        font-size: 2em;
        font-weight: bold;
        background: none;
        border: none;
        color: var(--text-color);
        flex: 1;
    }

    .detail-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 30px;
    }
    .detail-main-col {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    .detail-side-col {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .section-box {
        background: var(--secondary-bg);
        border-radius: 8px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    .box-header {
        font-weight: bold;
        font-size: 0.9em;
        color: var(--text-color-muted);
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .detail-desc-view {
        min-height: 100px;
        line-height: 1.8;
        cursor: pointer;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: break-word;
        font-size: 1.1em;
        color: var(--text-color);
        padding: 5px;
        border-radius: 4px;
        transition: background 0.2s;
    }
    .detail-desc-view:hover {
        background: rgba(255, 255, 255, 0.03);
    }
    .ref-group {
        margin-bottom: 15px;
    }
    .ref-category {
        font-weight: bold;
        margin-bottom: 8px;
        color: var(--accent-color);
    }

    .meta-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 12px;
    }
    .meta-field label {
        font-size: 0.75em;
        color: var(--text-color-muted);
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .meta-field input,
    .meta-field select {
        padding: 6px 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid transparent;
        color: var(--text-color);
        border-radius: 0;
        font-size: 0.95em;
        transition: all 0.2s;
    }
    .meta-field input:hover,
    .meta-field select:hover {
        border-bottom-color: var(--border-color);
    }
    .meta-field input:focus,
    .meta-field select:focus {
        outline: none;
        border-bottom-color: var(--accent-color);
    }

    .tags-wrapper {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 4px 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s;
        cursor: text;
    }
    .tags-wrapper:hover {
        border-bottom-color: var(--border-color);
    }
    .tags-wrapper:focus-within {
        border-bottom-color: var(--accent-color);
    }
    .tag-badge {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.85em;
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid transparent;
        font-weight: 600;
    }
    .tag-badge button {
        background: none;
        border: none;
        color: white;
        opacity: 0.7;
        cursor: pointer;
        padding: 0;
        font-size: 1.1em;
        line-height: 1;
        display: flex;
        align-items: center;
    }
    .tag-badge button:hover {
        opacity: 1;
    }
    .tag-add-input {
        border: none !important;
        background: none !important;
        padding: 0 !important;
        width: auto;
        flex: 1;
        min-width: 80px;
        font-size: 0.9em;
        outline: none;
        color: var(--text-color);
    }

    /* Connections */
    .connections-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .connection-chip {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        background: var(--primary-bg);
        border-radius: 6px;
        cursor: pointer;
        border: 1px solid transparent;
    }
    .connection-chip:hover {
        border-color: var(--accent-color);
    }
    .conn-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        font-weight: bold;
    }
    .conn-info {
        display: flex;
        flex-direction: column;
    }
    .conn-name {
        font-weight: bold;
        font-size: 0.9em;
    }
    .conn-reason {
        font-size: 0.8em;
        color: var(--accent-color);
    }
    .empty-text {
        color: var(--text-color-muted);
        font-style: italic;
        font-size: 0.9em;
    }

    /* Small Import Modal */
    .small-modal {
        width: 400px;
        height: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        background: var(--primary-bg);
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }
    .small-modal textarea {
        height: 150px;
        background: var(--secondary-bg);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        padding: 10px;
    }
    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    /* Linked Annotation Styles */
    .linked-annotation-box {
        background: var(--primary-bg);
        border-radius: 6px;
        padding: 12px;
        border: 1px solid var(--border-color);
    }
    .la-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 0.9em;
    }
    .la-tag {
        background: var(--accent-color);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: bold;
    }
    .la-source {
        color: var(--text-color-muted);
        font-weight: bold;
    }
    .la-content {
        color: var(--text-color);
        white-space: pre-wrap;
        line-height: 1.5;
        font-size: 0.95em;
    }
    .la-context {
        margin-top: 8px;
        padding: 8px;
        background: rgba(0, 0, 0, 0.2);
        border-left: 2px solid var(--text-color-muted);
        font-style: italic;
        color: var(--text-color-muted);
        font-size: 0.9em;
    }
    .tiny {
        padding: 4px 8px;
        font-size: 0.8em;
    }
    .detail-view {
        position: relative; /* Context for absolute panel */
        display: flex;
        flex-direction: column;
    }

    .reference-panel {
        position: absolute;
        top: 60px; /* Below header */
        bottom: 20px;
        right: 20px;
        width: 300px;
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
        z-index: 100;
        display: flex;
        flex-direction: column;
        border-radius: 8px;
        overflow: hidden;
    }
    .ref-header {
        padding: 10px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--primary-bg);
    }
    .ref-header input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-color);
        font-size: 0.9em;
    }
    .ref-list {
        flex: 1;
        overflow-y: auto;
        padding-bottom: 20px;
    }

    .ref-group {
        border-bottom: 1px solid var(--border-color);
    }
    .ref-group-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 15px;
        background: rgba(255, 255, 255, 0.03);
        cursor: pointer;
        font-weight: bold;
        font-size: 0.85em;
        color: var(--text-color-muted);
        user-select: none;
        transition: background 0.2s;
    }
    .ref-group-header:hover {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-color);
    }
    .ref-group-label {
        flex: 1;
    }

    .ref-category {
        border-left: 2px solid var(--border-color);
        margin-left: 10px;
    }
    .ref-category-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 15px;
        cursor: pointer;
        font-size: 0.8em;
        color: var(--text-color-muted);
        user-select: none;
        transition: color 0.2s;
    }
    .ref-category-header:hover {
        color: var(--text-color);
    }
    .ref-category-name {
        flex: 1;
    }

    .ref-category-items {
        padding-left: 5px;
    }

    .ref-item {
        border-bottom: 1px solid var(--border-color);
    }
    .ref-item:last-child {
        border-bottom: none;
    }

    .ref-item-header {
        padding: 8px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 0.9em;
    }
    .ref-item-header:hover {
        background: rgba(255, 255, 255, 0.05);
    }
    .ref-name {
        flex: 1;
        font-weight: 500;
    }
    :global(.ref-type-icon) {
        opacity: 0.7;
    }

    .ref-item-body {
        padding: 10px;
        background: rgba(0, 0, 0, 0.1);
        font-size: 0.85em;
        line-height: 1.5;
        color: var(--text-color-secondary);
        max-height: 200px;
        overflow-y: auto;
    }
    .ref-desc {
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: break-word;
    }

    :global(.ml-auto) {
        margin-left: auto;
    }

    /* Adjust detail-scroll-body when panel is open? 
       Ideally we want to push content or overlay.
       Overlay is easier. If overlay covers content, user can resize window or we can just let it cover.
       */
</style>
