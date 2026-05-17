<script>
    import { createEventDispatcher } from 'svelte';
    import Icon from './Icon.svelte';

    const dispatch = createEventDispatcher();

    let dontShowAgain = false;

    function handleClose() {
        if (dontShowAgain) {
            localStorage.setItem('hideStartupGuide', 'true');
        }
        dispatch('close');
    }
</script>

<div 
    class="guide-backdrop" 
    on:click={handleClose}
    on:keydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') handleClose(); }}
    role="button" 
    tabindex="0"
>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="guide-modal" on:click|stopPropagation>
        <div class="modal-header">
            <Icon name="help-circle" size={28} color="var(--primary-color)" />
            <h2 class="modal-title">StoryWeaver에 오신 것을 환영합니다!</h2>
        </div>
        <div class="modal-content">
            <p>시작하는 방법을 안내해 드립니다.</p>
            <ol class="guide-steps">
                <li><strong>첫 장면 만들기:</strong> 우측 하단의 <strong>'+' 버튼</strong>을 누르거나, 캔버스 빈 곳을 <strong>우클릭</strong>하여 '여기에 새 씬 추가'를 선택하세요. (단축키 <code>Alt + N</code>)</li>
                <li><strong>대사 입력하기:</strong> 생성된 장면을 클릭하고, 왼쪽 편집기에 <code>인물: 대사</code> 형식으로 내용을 입력해보세요.</li>
                <li><strong>장면 연결하기:</strong> 장면을 하나 더 만들고, 선택지의 <code>🔗</code> 아이콘으로 두 장면을 이어보세요.</li>
            </ol>
            <p>자세한 사용법은 언제든 상단의 <strong>도움말</strong> 메뉴를 확인해주세요.</p>
        </div>
        <div class="modal-footer">
            <label class="checkbox-label">
                <input type="checkbox" bind:checked={dontShowAgain} />
                다시 보지 않기
            </label>
            <button class="btn close-btn" on:click={handleClose}>시작하기</button>
        </div>
    </div>
</div>

<style>
    .guide-backdrop {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background-color: rgba(0, 0, 0, 0.6);
        z-index: 6000;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .guide-modal {
        background-color: var(--secondary-bg);
        padding: 24px 32px;
        border-radius: var(--border-radius-large);
        box-shadow: var(--box-shadow-heavy);
        width: 90%;
        max-width: 520px;
        text-align: left;
        border-top: 4px solid var(--primary-color);
    }
    .modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }
    .modal-title {
        font-size: 1.4em;
        font-weight: 600;
        color: var(--heading-color);
        margin: 0;
    }
    .modal-content {
        font-size: 1.05em;
        line-height: 1.7;
        color: var(--text-color);
        margin-bottom: 24px;
    }
    .modal-content p {
        margin: 8px 0;
    }
    .guide-steps {
        padding-left: 20px;
        margin: 16px 0;
    }
    .guide-steps li {
        margin-bottom: 12px;
    }
    .guide-steps code {
        background-color: var(--primary-bg);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: var(--font-mono);
    }
    .modal-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 16px;
        border-top: 1px solid var(--border-color);
    }
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.95em;
        cursor: pointer;
        color: var(--text-color-light);
    }
    .btn {
        padding: 10px 24px;
        border: none;
        border-radius: var(--border-radius);
        font-size: 1em;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--transition-speed);
    }
    .close-btn {
        background-color: var(--primary-color);
        color: white;
    }
    .close-btn:hover {
        opacity: 0.85;
    }
</style>