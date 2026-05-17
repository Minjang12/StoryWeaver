<script>
    import { activeStory, projectActions, uiState } from './stores.js';
    import Icon from './Icon.svelte';
    import { onMount } from 'svelte';

    // --- Derived Data ---
    $: goals = $activeStory?.goals || {};
    $: dailyGoal = goals.dailyWordCount || { target: 500, current: 0 };
    $: streak = goals.streak || 0;
    $: history = goals.history || {}; // { "YYYY-MM-DD": count }

    $: percentage = Math.min(100, Math.round((dailyGoal.current / dailyGoal.target) * 100));
    $: remaining = Math.max(0, dailyGoal.target - dailyGoal.current);

    // --- Rank System ---
    const ranks = [
        { name: '🌱 견습 작가', threshold: 0 },
        { name: '✏️ 집필가', threshold: 5000 },
        { name: '📚 다작 작가', threshold: 20000 },
        { name: '🔥 열혈 작가', threshold: 50000 },
        { name: '💎 베스트셀러', threshold: 100000 },
        { name: '👑 대문호', threshold: 500000 }
    ];

    $: totalWords = $activeStory ? countTotalWords($activeStory) : 0;
    $: currentRank = ranks.slice().reverse().find(r => totalWords >= r.threshold) || ranks[0];
    $: nextRank = ranks.find(r => r.threshold > totalWords);
    $: progressToNextRank = nextRank 
        ? Math.min(100, Math.round(((totalWords - currentRank.threshold) / (nextRank.threshold - currentRank.threshold)) * 100))
        : 100;

    function countTotalWords(story) {
        let count = 0;
        Object.values(story.scenes).forEach(scene => {
            scene.content.forEach(item => {
                if (item.text) count += item.text.split(/\s+/).filter(Boolean).length;
            });
        });
        return count;
    }

    // --- Weekly Chart Data ---
    function getLast7Days() {
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    }

    $: chartData = getLast7Days().map(date => ({
        date,
        day: new Date(date).toLocaleDateString('ko-KR', { weekday: 'short' }),
        count: history[date] || (date === new Date().toISOString().split('T')[0] ? dailyGoal.current : 0),
        isToday: date === new Date().toISOString().split('T')[0]
    }));

    $: maxCount = Math.max(...chartData.map(d => d.count), dailyGoal.target * 1.2); // Scale chart

</script>

<div class="goals-dashboard">
    <!-- Top Row: Daily Progress & Rank -->
    <div class="top-row">
        <!-- Daily Goal Card -->
        <div class="card daily-card">
            <div class="card-header">
                <h3><Icon name="target" size={18} /> 오늘의 목표</h3>
                <div class="header-actions">
                    <span class="streak-badge" title="연속 달성일">
                        <Icon name="zap" size={14} color="#FFD700" /> {streak}일
                    </span>
                    <button class="icon-btn" on:click={() => uiState.openGoalSettingModal()} title="목표 설정">
                        <Icon name="settings" size={16} />
                    </button>
                </div>
            </div>
            <div class="circle-progress-wrapper">
                <svg viewBox="0 0 36 36" class="circular-chart">
                    <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path class="circle" stroke-dasharray="{percentage}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <text x="18" y="20.35" class="percentage">{percentage}%</text>
                </svg>
            </div>
            <div class="daily-stats">
                <div class="stat">
                    <span class="value">{dailyGoal.current}</span>
                    <span class="label">작성함</span>
                </div>
                <div class="divider"></div>
                <div class="stat">
                    <span class="value">{dailyGoal.target}</span>
                    <span class="label">목표</span>
                </div>
            </div>
            <p class="message">
                {#if percentage >= 100}
                    🎉 목표 달성! 대단하다냥!
                {:else}
                    🔥 {remaining}단어 더 쓰면 달성이다냥!
                {/if}
            </p>
        </div>

        <!-- Rank Card -->
        <div class="card rank-card">
            <div class="card-header">
                <h3><Icon name="award" size={18} /> 작가 등급</h3>
            </div>
            <div class="rank-display">
                <div class="rank-icon">✍️</div>
                <div class="rank-info">
                    <div class="rank-name">{currentRank.name}</div>
                    <div class="total-words">누적 {totalWords.toLocaleString()} 단어</div>
                </div>
            </div>
            {#if nextRank}
                <div class="rank-progress-bar">
                    <div class="fill" style="width: {progressToNextRank}%;"></div>
                </div>
                <p class="next-rank-info">다음 등급 '{nextRank.name}'까지 {nextRank.threshold - totalWords} 단어 남음</p>
            {:else}
                <p class="next-rank-info">최고 등급에 도달했다냥! 존경한다냥!</p>
            {/if}
        </div>
    </div>

    <!-- Weekly Chart -->
    <div class="card chart-card">
        <div class="card-header">
            <h3><Icon name="bar-chart" size={18} /> 최근 7일 집필량</h3>
        </div>
        <div class="bar-chart">
            {#each chartData as data}
                <div class="bar-group" class:today={data.isToday}>
                    <div class="bar-wrapper">
                        <div 
                            class="bar" 
                            style="height: {Math.max(5, (data.count / maxCount) * 100)}%;"
                            title="{data.date}: {data.count}단어"
                        ></div>
                    </div>
                    <span class="day-label">{data.day}</span>
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    .goals-dashboard {
        display: flex;
        flex-direction: column;
        gap: 20px;
        font-family: 'Inter', sans-serif;
    }

    .top-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
    }

    .card {
        background-color: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border-color);
    }
    .card-header h3 { margin: 0; font-size: 1.1em; display: flex; align-items: center; gap: 8px; }
    
    .header-actions { display: flex; align-items: center; gap: 8px; }
    
    .icon-btn {
        background: none;
        border: 1px solid transparent;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: var(--text-color-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        width: 28px; height: 28px;
    }
    .icon-btn:hover {
        color: var(--accent-color);
        background-color: var(--primary-bg);
        border-color: var(--border-color);
    }

    /* Daily Card Specifics */
    .streak-badge {
        background-color: rgba(255, 215, 0, 0.15);
        color: #b8860b;
        font-weight: bold;
        font-size: 0.85em;
        padding: 4px 8px;
        border-radius: 12px;
        display: flex; align-items: center; gap: 4px;
    }
    
    .circle-progress-wrapper {
        width: 120px;
        margin: 0 auto 20px;
    }
    .circular-chart {
        display: block;
        margin: 0 auto;
        max-width: 80%;
        max-height: 250px;
    }
    .circle-bg {
        fill: none;
        stroke: var(--border-color);
        stroke-width: 2.5;
    }
    .circle {
        fill: none;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke: var(--accent-color);
        animation: progress 1s ease-out forwards;
    }
    .percentage {
        fill: var(--text-color);
        font-family: sans-serif;
        font-weight: bold;
        font-size: 0.5em;
        text-anchor: middle;
    }

    .daily-stats {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        margin-bottom: 15px;
    }
    .stat { text-align: center; }
    .stat .value { display: block; font-size: 1.2em; font-weight: bold; color: var(--text-color); }
    .stat .label { font-size: 0.8em; color: var(--text-color-muted); }
    .divider { width: 1px; height: 30px; background-color: var(--border-color); }
    
    .message { text-align: center; color: var(--accent-color); font-weight: 500; font-size: 0.95em; margin: 0; }

    /* Rank Card Specifics */
    .rank-display {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 20px;
    }
    .rank-icon { font-size: 2.5em; }
    .rank-name { font-size: 1.2em; font-weight: bold; color: var(--text-color); }
    .total-words { font-size: 0.9em; color: var(--text-color-muted); }
    
    .rank-progress-bar {
        height: 8px;
        background-color: var(--border-color);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
    }
    .rank-progress-bar .fill {
        height: 100%;
        background-color: var(--success-color);
        border-radius: 4px;
        transition: width 0.5s ease;
    }
    .next-rank-info { font-size: 0.85em; color: var(--text-color-muted); text-align: right; margin: 0; }

    /* Chart Card */
    .bar-chart {
        display: flex;
        justify-content: space-around;
        align-items: flex-end;
        height: 150px;
        padding-top: 20px;
    }
    .bar-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        flex: 1;
    }
    .bar-wrapper {
        height: 100%;
        width: 100%;
        display: flex;
        align-items: flex-end;
        justify-content: center;
    }
    .bar {
        width: 12px;
        background-color: var(--accent-color);
        border-radius: 4px 4px 0 0;
        opacity: 0.6;
        transition: height 0.5s ease;
    }
    .bar-group:hover .bar { opacity: 1; transform: scaleX(1.2); }
    .bar-group.today .bar { background-color: var(--success-color); opacity: 1; }
    .day-label { font-size: 0.8em; color: var(--text-color-muted); }

    @media (max-width: 768px) {
        .top-row { grid-template-columns: 1fr; }
    }
</style>
