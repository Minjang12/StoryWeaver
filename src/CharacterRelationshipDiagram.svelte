<script>
    import { onMount } from 'svelte';
    import { getColorFromString } from './utils.js';

    export let characters = [];
    export let dictionary = [];
    export let groups = [];

    let nodes = [];
    let links = [];
    let affiliationAreas = [];
    let width = 800;
    let height = 600;
    let svgElement;
    let isMounted = false;
    const NODE_RADIUS = 30;

    // --- Zoom & Pan State ---
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let lastMouseX, lastMouseY;

    $: transform = `translate(${translateX}, ${translateY}) scale(${scale})`;

    function updateDiagram() {
        if (!characters || !isMounted) {
            nodes = [];
            links = [];
            return;
        }

        const numNodes = characters.length;
        if (numNodes === 0) {
            nodes = [];
            links = [];
            return;
        }

        // --- Grouping Logic ---
        const groupMap = { 'unassigned': [] };
        
        // Populate keys from groups and dictionary
        (groups || []).forEach(g => groupMap[g.id] = []);
        (dictionary || []).forEach(d => {
             // Only if used as affiliation
             if (characters.some(c => c.affiliation === d.id)) {
                 groupMap[d.id] = [];
             }
        });

        characters.forEach(char => {
            const aff = char.affiliation || 'unassigned';
            if (!groupMap[aff]) groupMap[aff] = [];
            groupMap[aff].push(char);
        });

        const activeGroupKeys = Object.keys(groupMap).filter(k => groupMap[k].length > 0);
        const numGroups = activeGroupKeys.length;
        
        // --- Layout Calculation ---
        const newNodes = [];
        
        if (numGroups <= 1) {
            // Fallback to single circle if only one group (or none)
            const radius = Math.min(width, height) / 2 - 100;
            const angleStep = (2 * Math.PI) / numNodes;
            characters.forEach((char, i) => {
                newNodes.push({
                    id: char.id,
                    name: char.name,
                    color: char.color || '#cccccc',
                    profileImage: char.profileImage,
                    profileImageTransform: char.profileImageTransform,
                    affiliation: char.affiliation,
                    x: width / 2 + radius * Math.cos(i * angleStep),
                    y: height / 2 + radius * Math.sin(i * angleStep)
                });
            });
        } else {
            // Cluster Layout
            const mainRadius = Math.min(width, height) * 0.35;
            
            activeGroupKeys.forEach((key, i) => {
                // Main Group Position
                const groupAngle = (2 * Math.PI * i) / numGroups;
                // Place unassigned group in center if there are multiple groups
                const isUnassigned = key === 'unassigned';
                const groupCX = width / 2 + (isUnassigned ? 0 : mainRadius * Math.cos(groupAngle));
                const groupCY = height / 2 + (isUnassigned ? 0 : mainRadius * Math.sin(groupAngle));
                
                const groupNodes = groupMap[key];
                const subRadius = Math.min(120, 40 + groupNodes.length * 15); // Adjust radius based on count

                groupNodes.forEach((char, j) => {
                    const subAngle = (2 * Math.PI * j) / groupNodes.length;
                    newNodes.push({
                        id: char.id,
                        name: char.name,
                        color: char.color || '#cccccc',
                        profileImage: char.profileImage,
                        profileImageTransform: char.profileImageTransform,
                        affiliation: char.affiliation,
                        x: groupCX + subRadius * Math.cos(subAngle),
                        y: groupCY + subRadius * Math.sin(subAngle)
                    });
                });
            });
        }

        const newLinks = [];
        const linkSet = new Set();
        characters.forEach(char => {
            if (char.relationships) {
                char.relationships.forEach(rel => {
                    if (characters.some(c => c.id === rel.targetId)) {
                        const linkId = `${char.id}-${rel.targetId}`;
                        const reverseLinkId = `${rel.targetId}-${char.id}`;
                        
                        const link = {
                            source: char.id,
                            target: rel.targetId,
                            type: rel.type,
                            bidirectional: false
                        };

                        if (linkSet.has(reverseLinkId)) {
                            const reverseLink = newLinks.find(l => l.source === rel.targetId && l.target === char.id);
                            if (reverseLink) {
                                reverseLink.bidirectional = true;
                                link.bidirectional = true;
                            }
                        }
                        
                        newLinks.push(link);
                        linkSet.add(linkId);
                    }
                });
            }
        });
        
        // --- Calculate Affiliation Areas ---
        // Recalculate based on new clustered positions
        const affiliationGroups = {};
        newNodes.forEach(node => {
            if (node.affiliation) {
                if (!affiliationGroups[node.affiliation]) affiliationGroups[node.affiliation] = [];
                affiliationGroups[node.affiliation].push(node);
            }
        });

        const newAffiliationAreas = [];
        for (const affiliationId in affiliationGroups) {
            const groupNodes = affiliationGroups[affiliationId];
            
            // Find Name
            let groupName = '??';
            let groupColor = '#888';
            
            const groupInfo = (groups || []).find(g => g.id === affiliationId);
            if (groupInfo) {
                groupName = groupInfo.name;
                groupColor = getColorFromString(groupName);
            } else {
                const loreInfo = (dictionary || []).find(d => d.id === affiliationId);
                if (loreInfo) {
                    groupName = loreInfo.name || loreInfo.term;
                    groupColor = getColorFromString(groupName);
                }
            }
            
            if (groupName === '??') continue; // Skip unknown affiliations (or could show as Unknown)

            let sumX = 0, sumY = 0;
            groupNodes.forEach(n => { sumX += n.x; sumY += n.y; });
            const centroid = { x: sumX / groupNodes.length, y: sumY / groupNodes.length };

            let maxDistSq = 0;
            groupNodes.forEach(n => {
                const distSq = (n.x - centroid.x)**2 + (n.y - centroid.y)**2;
                if (distSq > maxDistSq) maxDistSq = distSq;
            });
            
            const PADDING = 40;
            const radius = Math.sqrt(maxDistSq) + NODE_RADIUS + PADDING;

            newAffiliationAreas.push({
                id: affiliationId,
                name: groupName,
                cx: centroid.x,
                cy: centroid.y,
                r: radius,
                color: groupColor
            });
        }

        nodes = newNodes;
        links = newLinks;
        affiliationAreas = newAffiliationAreas;
    }

    $: if (isMounted) updateDiagram();

    onMount(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width: newWidth, height: newHeight } = entries[0].contentRect;
                width = newWidth > 0 ? newWidth : 800;
                height = newHeight > 0 ? newHeight : 600;
            }
        });

        if (svgElement.parentElement) observer.observe(svgElement.parentElement);
        isMounted = true;
        return () => {
            if (svgElement.parentElement) observer.unobserve(svgElement.parentElement);
        };
    });

    function getLinkPath(link) {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) return "";

        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const angle = Math.atan2(dy, dx);

        const x1 = sourceNode.x + Math.cos(angle) * NODE_RADIUS;
        const y1 = sourceNode.y + Math.sin(angle) * NODE_RADIUS;
        const x2 = targetNode.x - Math.cos(angle) * (NODE_RADIUS + 8); // +8 to leave space for arrowhead
        const y2 = targetNode.y - Math.sin(angle) * (NODE_RADIUS + 8);

        if (link.bidirectional) {
            const offsetX = 25 * Math.sin(angle); // Increased offset for better visibility
            const offsetY = -25 * Math.cos(angle); // Increased offset for better visibility
            const midX = (x1 + x2) / 2 + offsetX;
            const midY = (y1 + y2) / 2 + offsetY;
            return `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
        } else {
            return `M ${x1} ${y1} L ${x2} ${y2}`;
        }
    }

    function getLinkTextPosition(link) {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) return { x: 0, y: 0, angle: 0, dy: -5 };
        
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;

        let midX = (sourceNode.x + targetNode.x) / 2;
        let midY = (sourceNode.y + targetNode.y) / 2;

        if (link.bidirectional) {
            const angleRad = Math.atan2(dy, dx);
            midX += 25 * Math.sin(angleRad); // Increased offset
            midY += -25 * Math.cos(angleRad); // Increased offset
        }

        let dyOffset = -5; // Default: Above the line (Screen Up)

        // Normalize angle for readability (keep between -90 and 90)
        if (angle > 90 || angle < -90) {
            angle += 180;
            // If we flipped the angle, "local up" becomes "screen down".
            // For bidirectional curves (which bend "screen down" for R->L), 
            // the text was originally "screen down" (dy=-5 relative to inverted).
            // Now text is upright, dy=-5 moves it "screen up" (Inside curve).
            // So we change dy to move it "screen down" (Outside curve).
            if (link.bidirectional) {
                dyOffset = 15; 
            }
            // For straight lines, we usually prefer text to be "Screen Up" regardless of direction,
            // so we keep dy=-5 (which moves it Screen Up for upright text).
        }

        return { x: midX, y: midY, angle, dy: dyOffset };
    }

    function getImageTransform(transform) {
        if (!transform) return `scale(1)`;
        // Base size is 80px (from CharacterStudio avatar-large)
        // Current Node size is NODE_RADIUS * 2 (60px)
        const ratio = (NODE_RADIUS * 2) / 80;
        const scaledX = transform.x * ratio;
        const scaledY = transform.y * ratio;
        return `translate(${scaledX}, ${scaledY}) scale(${transform.scale})`;
    }

    // --- Event Handlers ---
    function handleWheel(event) {
        event.preventDefault();
        const scaleAmount = event.deltaY > 0 ? 0.9 : 1.1;
        const newScale = scale * scaleAmount;
        
        const rect = svgElement.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        translateX = mouseX - (mouseX - translateX) * scaleAmount;
        translateY = mouseY - (mouseY - translateY) * scaleAmount;
        scale = newScale;
    }

    function handleMouseDown(event) {
        if (event.target === svgElement) {
            isPanning = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            svgElement.style.cursor = 'grabbing';
        }
    }

    function handleMouseMove(event) {
        if (isPanning) {
            const dx = event.clientX - lastMouseX;
            const dy = event.clientY - lastMouseY;
            translateX += dx;
            translateY += dy;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        }
    }

    function handleMouseUp() {
        isPanning = false;
        svgElement.style.cursor = 'grab';
    }
</script>

<div class="diagram-container" on:wheel={handleWheel}>
    <svg bind:this={svgElement} {width} {height} on:mousedown={handleMouseDown} on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} on:mouseleave={handleMouseUp} style="cursor: grab;">
        {#if nodes.length > 0}
        <defs>
            <marker id="arrowhead" viewBox="0 0 10 10" refX="10" refY="5"
                markerUnits="strokeWidth" markerWidth="6" markerHeight="5"
                orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-color-muted)"></path>
            </marker>
            {#each nodes as node (node.id)}
                <clipPath id="clip-{node.id}">
                    <circle r={NODE_RADIUS} cx="0" cy="0"></circle>
                </clipPath>
            {/each}
        </defs>

        <g {transform}>
            <g class="affiliation-areas">
                {#each affiliationAreas as affiliation (affiliation.id)}
                    <circle 
                        cx={affiliation.cx} 
                        cy={affiliation.cy} 
                        r={affiliation.r} 
                        fill={affiliation.color} 
                        fill-opacity="0.1" 
                        stroke={affiliation.color} 
                        stroke-width="2"
                        stroke-dasharray="5,5"
                    />
                    <text 
                        x={affiliation.cx} 
                        y={affiliation.cy - affiliation.r + 20} 
                        text-anchor="middle" 
                        fill={affiliation.color} 
                        font-weight="bold"
                        font-size="1.2rem"
                        class="affiliation-label"
                        style="text-shadow: 0 2px 4px var(--primary-bg);"
                    >
                        {affiliation.name}
                    </text>
                {/each}
            </g>
            <g class="links">
                {#each links as link (link.source + '-' + link.target)}
                    {@const textPos = getLinkTextPosition(link)}
                    <path d={getLinkPath(link)} stroke="var(--text-color-muted)" stroke-width="1.5" fill="none" marker-end="url(#arrowhead)" />
                    <text
                        class="link-label"
                        x={textPos.x}
                        y={textPos.y}
                        dy={textPos.dy}
                        transform="rotate({textPos.angle}, {textPos.x}, {textPos.y})"
                        text-anchor="middle"
                        style="fill: var(--text-color); stroke: var(--primary-bg); stroke-width: 3px; paint-order: stroke;"
                        >
                        {link.type}
                    </text>
                {/each}
            </g>

            <g class="nodes">
                {#each nodes as node (node.id)}
                    <g class="node-group" transform="translate({node.x}, {node.y})">
                        {#if node.profileImage}
                            <g clip-path="url(#clip-{node.id})">
                                <g transform={getImageTransform(node.profileImageTransform)}>
                                    <image 
                                        href={node.profileImage} 
                                        x={-NODE_RADIUS} 
                                        y={-NODE_RADIUS} 
                                        height={NODE_RADIUS * 2} 
                                        width={NODE_RADIUS * 2} 
                                        preserveAspectRatio="xMidYMid slice"
                                    />
                                </g>
                            </g>
                            <circle r={NODE_RADIUS} fill="none" stroke="var(--border-color)" stroke-width="2"></circle>
                        {:else}
                            <circle r={NODE_RADIUS} fill={node.color} stroke="var(--primary-bg)" stroke-width="2"></circle>
                        {/if}
                        <text 
                            y={NODE_RADIUS + 20} 
                            text-anchor="middle" 
                            fill="var(--text-color)"
                            font-weight="bold"
                            class="node-label"
                            style="stroke: var(--primary-bg); stroke-width: 3px; paint-order: stroke;"
                            >
                            {node.name}
                        </text>
                    </g>
                {/each}
            </g>
        </g>
        {/if}
    </svg>
</div>

<style>
    .diagram-container {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        background-color: var(--primary-bg);
    }
    svg {
        font-family: inherit;
    }
    .node-label {
        font-size: 0.95rem;
        pointer-events: none;
        user-select: none;
    }
    .link-label {
        font-size: 0.85rem;
        pointer-events: none;
        user-select: none;
    }
</style>
