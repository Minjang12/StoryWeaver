<script>
    import { onMount } from "svelte";
    import { createWikiLinkRegex } from "./utils.js";

    export let value = "";
    export let dictionary = [];
    export let characters = [];
    export let onUpdate; // Callback for input
    export let onCommit; // Callback for blur/history

    let editor;
    let isFocused = false;

    // Mention Logic
    let showMentionPopup = false;
    let mentionSearchText = "";
    let mentionIndex = 0;
    let mentionCoordinates = { x: 0, y: 0 };
    let filteredMentions = [];

    // Combine dictionaries and characters for mentions
    $: allMentionItems = [
        ...dictionary.map((d) => ({
            ...d,
            _matchText: d.term,
            type: "dictionary",
        })),
        ...characters.map((c) => ({
            ...c,
            _matchText: c.name,
            type: "character",
        })),
    ];

    $: if (showMentionPopup) {
        const lower = mentionSearchText.toLowerCase();
        filteredMentions = allMentionItems
            .filter(
                (item) =>
                    item &&
                    item._matchText &&
                    item._matchText.toLowerCase().includes(lower),
            )
            .slice(0, 10); // Limit to 10 suggestions
    }

    function escapeHtml(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function highlight(text) {
        if (!text) return "";

        // Prepare items list for utils helper
        const allEntities = [];

        // Normalize dictionary items
        dictionary.forEach((d) => {
            if (d.term)
                allEntities.push({
                    ...d,
                    _matchText: d.term,
                    type: "dictionary",
                });
            if (d.aliases && Array.isArray(d.aliases)) {
                d.aliases.forEach((alias) => {
                    if (alias)
                        allEntities.push({
                            ...d,
                            _matchText: alias,
                            type: "dictionary",
                            isAlias: true,
                        });
                });
            }
        });

        // Normalize character items
        characters.forEach((c) => {
            if (c.name)
                allEntities.push({
                    ...c,
                    _matchText: c.name,
                    type: "character",
                });
            if (c.aliases && Array.isArray(c.aliases)) {
                c.aliases.forEach((alias) => {
                    if (alias)
                        allEntities.push({
                            ...c,
                            _matchText: alias,
                            type: "character",
                            isAlias: true,
                        });
                });
            }
        });

        if (allEntities.length === 0)
            return escapeHtml(text).replace(/\n/g, "<br>");

        const regex = createWikiLinkRegex(allEntities);

        if (!regex) return escapeHtml(text).replace(/\n/g, "<br>");

        try {
            // Use split to find parts.
            // Note: split with capturing group returns [prev, match, next, match, ...]
            const parts = text.split(regex);

            const result = parts
                .map((part) => {
                    if (!part) return "";
                    // Check if part matches any entity (case insensitive)
                    const match = allEntities.find(
                        (e) =>
                            e._matchText.toLowerCase() === part.toLowerCase(),
                    );

                    if (match) {
                        return `<span class="highlighted-term" data-type="${match.type}" data-key="${escapeHtml(match._matchText)}">${escapeHtml(part)}</span>`;
                    } else {
                        return escapeHtml(part);
                    }
                })
                .join("");

            return result.replace(/\n/g, "<br>");
        } catch (e) {
            console.warn("Highlighting failed:", e);
            return escapeHtml(text).replace(/\n/g, "<br>");
        }
    }

    function handleFocus() {
        isFocused = true;
        // When focusing, revert to plain text for a clean editing experience
        if (editor.innerText !== value) {
            editor.innerText = value;
        }
    }

    function handleBlur() {
        isFocused = false;
        const newText = editor.innerText;

        if (newText !== value) {
            onUpdate(newText);
        }
        onCommit();

        // Apply highlighting on blur
        editor.innerHTML = highlight(newText);
    }

    function handleInput() {
        // 1. Check for Mention Trigger
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const text = range.startContainer.textContent;

            // Look for @ symbol backwards from cursor
            const textBeforeCursor = text.substring(0, range.startOffset);
            const lastAt = textBeforeCursor.lastIndexOf("@");

            if (lastAt !== -1) {
                // Check if there's a space before @ (or it's the start)
                const charBeforeAt =
                    lastAt > 0 ? textBeforeCursor[lastAt - 1] : " ";
                if (/\s/.test(charBeforeAt)) {
                    // Valid trigger
                    const query = textBeforeCursor.substring(lastAt + 1);
                    // allow spaces in query? limits? let's say up to 20 chars
                    if (query.length < 20) {
                        showMentionPopup = true;
                        mentionSearchText = query;
                        const rect = range.getBoundingClientRect();
                        mentionCoordinates = {
                            x: rect.left,
                            y: rect.bottom + 5,
                        };
                    } else {
                        showMentionPopup = false;
                    }
                } else {
                    showMentionPopup = false;
                }
            } else {
                showMentionPopup = false;
            }
        }

        // Just update the store with the raw text content
        onUpdate(editor.innerText);
    }

    function insertMention(item) {
        // Replace @query with item.name
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const textNode = range.startContainer;
            const text = textNode.textContent;

            // Look for @ symbol backwards from cursor
            const textBeforeCursor = text.substring(0, range.startOffset);
            const lastAt = textBeforeCursor.lastIndexOf("@");

            if (lastAt !== -1) {
                const beforeIdx = lastAt;
                const afterIdx = range.startOffset;

                const before = text.substring(0, beforeIdx);
                const after = text.substring(afterIdx);

                const newText = before + item._matchText + " " + after;
                textNode.textContent = newText;

                // Move cursor after inserted text
                const newRange = document.createRange();
                newRange.setStart(
                    textNode,
                    beforeIdx + item._matchText.length + 1,
                );
                newRange.setEnd(
                    textNode,
                    beforeIdx + item._matchText.length + 1,
                );
                sel.removeAllRanges();
                sel.addRange(newRange);

                onUpdate(editor.innerText);
            }
        }
        showMentionPopup = false;
        editor.focus();
    }

    function handleKeydown(e) {
        if (showMentionPopup) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                mentionIndex = (mentionIndex + 1) % filteredMentions.length;
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                mentionIndex =
                    (mentionIndex - 1 + filteredMentions.length) %
                    filteredMentions.length;
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (filteredMentions[mentionIndex]) {
                    insertMention(filteredMentions[mentionIndex]);
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                showMentionPopup = false;
            }
        }
    }

    // This block handles updates from outside the component (undo/redo, scene change)
    $: if (editor && !isFocused) {
        const highlightedHTML = highlight(value);
        if (editor.innerHTML !== highlightedHTML) {
            editor.innerHTML = highlightedHTML;
        }
    }

    onMount(() => {
        if (editor) {
            editor.innerHTML = highlight(value);
        }
    });
</script>

<div
    bind:this={editor}
    class="rich-text-editor"
    contenteditable="true"
    on:focus={handleFocus}
    on:blur={handleBlur}
    on:input={handleInput}
    on:keydown={handleKeydown}
    on:paste|preventDefault={(e) => {
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
    }}
></div>

{#if showMentionPopup && filteredMentions.length > 0}
    <div
        class="mention-popup"
        style="top: {mentionCoordinates.y}px; left: {mentionCoordinates.x}px;"
    >
        {#each filteredMentions as item, i}
            <div
                class="mention-item"
                class:selected={i === mentionIndex}
                on:click={() => insertMention(item)}
                on:keydown={(e) =>
                    (e.key === "Enter" || e.key === " ") && insertMention(item)}
                role="button"
                tabindex="0"
            >
                <div
                    class="mention-avatar"
                    style="background-color: {item.color || '#888'}"
                >
                    {#if item.profileImage}
                        <img src={item.profileImage} alt="" />
                    {:else}
                        {item._matchText[0]}
                    {/if}
                </div>
                <span>{item._matchText}</span>
                <span class="mention-type">{item.type}</span>
            </div>
        {/each}
    </div>
{/if}

<style>
    .rich-text-editor {
        background-color: var(--primary-bg);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        padding: 9px 12px;
        border-radius: var(--border-radius);
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        font-family: inherit;
        font-size: 1em;
        transition: all var(--transition-speed);
        resize: vertical;
        min-height: 80px;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: break-word;
        overflow-y: auto;
        overflow-x: hidden;
    }
    .rich-text-editor:focus {
        outline: none;
        border-color: var(--accent-color);
        box-shadow: 0 0 0 3px
            color-mix(in srgb, var(--accent-color) 20%, transparent);
        white-space: pre-wrap; /* Ensure wrapping is consistent */
    }
    :global(.rich-text-editor .highlighted-term) {
        border-bottom: 1px solid;
        cursor: pointer;
        border-radius: 2px;
        padding: 1px 0;
    }
    :global(.rich-text-editor .highlighted-term[data-type="dictionary"]) {
        background-color: color-mix(
            in srgb,
            var(--accent-color) 15%,
            transparent
        );
        border-color: var(--accent-color);
    }
    :global(.rich-text-editor .highlighted-term[data-type="character"]) {
        background-color: color-mix(in srgb, #558cff 15%, transparent);
        border-color: #558cff;
    }

    .mention-popup {
        position: fixed;
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        border-radius: 4px;
        z-index: 9999;
        max-height: 200px;
        overflow-y: auto;
        min-width: 150px;
    }
    .mention-item {
        padding: 6px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: var(--text-color);
        font-size: 0.9em;
    }
    .mention-item.selected,
    .mention-item:hover {
        background: var(--accent-color);
        color: white;
    }
    .mention-avatar {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #555;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7em;
        overflow: hidden;
    }
    .mention-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .mention-type {
        font-size: 0.7em;
        opacity: 0.7;
        margin-left: auto;
    }
</style>
