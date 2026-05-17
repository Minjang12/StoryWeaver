<script>
    import { activeStory, uiState } from './stores.js';
    import Icon from './Icon.svelte';

    let goals;
    let progress = 0;

    activeStory.subscribe(story => {
        if (story && story.goals) {
            goals = story.goals;
            const dailyGoal = goals.dailyWordCount;
            if (dailyGoal && dailyGoal.enabled && dailyGoal.target > 0) {
                progress = Math.min(100, (dailyGoal.current / dailyGoal.target) * 100);
            } else {
                progress = 0;
            }
        }
    });

    const circumference = 2 * Math.PI * 45; // Circle radius is 45

    function openGoalSettings() {
        uiState.openGoalSettingModal();
    }
</script>

<div class="goal-tracker-widget" title="일일 단어 수 목표 진행률">
    <svg viewBox="0 0 100 100">
        <circle class="progress-bg" cx="50" cy="50" r="45"></circle>
        <circle 
            class="progress-bar" 
            cx="50" 
            cy="50" 
            r="45"
            stroke-dasharray="{circumference}"
            stroke-dashoffset="{circumference * (1 - progress / 100)}"
        ></circle>
    </svg>
    <div class="widget-content">
        {#if goals?.dailyWordCount?.enabled}
            <div class="progress-text">{Math.round(progress)}%</div>
            <div class="word-count">
                {goals.dailyWordCount.current.toLocaleString()} / {goals.dailyWordCount.target.toLocaleString()}
            </div>
        {:else}
            <div class="progress-text">OFF</div>
        {/if}
    </div>
    <button class="settings-btn" on:click={openGoalSettings} aria-label="목표 설정 열기">
        <Icon name="settings" size={16} />
    </button>
</div>

<style>
    .goal-tracker-widget {
        position: relative;
        width: 120px;
        height: 120px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: default;
        user-select: none;
    }
    svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        transform: rotate(-90deg); /* Start from the top */
    }
    .progress-bg {
        fill: none;
        stroke: var(--primary-bg);
        stroke-width: 10;
    }
    .progress-bar {
        fill: none;
        stroke: var(--accent-color);
        stroke-width: 10;
        stroke-linecap: round;
        transition: stroke-dashoffset 0.5s ease-out;
    }
    .widget-content {
        text-align: center;
        z-index: 1;
    }
    .progress-text {
        font-size: 1.5em;
        font-weight: 600;
        color: var(--text-color);
    }
    .word-count {
        font-size: 0.75em;
        color: var(--text-color-muted);
    }
    .settings-btn {
        position: absolute;
        bottom: 5px;
        right: 5px;
        background: none;
        border: none;
        color: var(--text-color-muted);
        cursor: pointer;
        padding: 3px;
        border-radius: 50%;
        opacity: 0;
        transition: opacity 0.2s ease, background-color 0.2s ease;
    }
    .goal-tracker-widget:hover .settings-btn {
        opacity: 1;
    }
    .settings-btn:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }
</style>
