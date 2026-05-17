<script>
    import { notifications } from './stores.js';
    import { fly } from 'svelte/transition';
    import Icon from './Icon.svelte';

    const icons = {
        info: 'info',
        success: 'check-circle',
        warning: 'alert-triangle',
        error: 'alert-circle'
    };
</script>

<div class="notification-container">
    {#each $notifications as notification (notification.id)}
        <div 
            class="notification-toast {notification.type}"
            in:fly={{ y: -20, duration: 300 }}
            out:fly={{ x: 100, duration: 200 }}
        >
            <Icon name={icons[notification.type] || 'info'} size={20} />
            <p>{notification.message}</p>
            <button class="close-btn" on:click={() => notifications.remove(notification.id)}>
                <Icon name="x" size={16} />
            </button>
        </div>
    {/each}
</div>

<style>
    .notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .notification-toast {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 280px;
        max-width: 350px;
        background-color: var(--primary-bg);
        color: var(--text-color);
        padding: 14px 18px;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        border: 1px solid var(--border-color);
        border-left-width: 4px;
        transition: all 0.3s ease;
    }
    .notification-toast p {
        margin: 0;
        flex-grow: 1;
        font-size: 0.95em;
    }
    .notification-toast.info { border-left-color: var(--accent-color); }
    .notification-toast.success { border-left-color: var(--success-color); }
    .notification-toast.warning { border-left-color: var(--warning-color); }
    .notification-toast.error { border-left-color: var(--danger-color); }

    .close-btn {
        background: none;
        border: none;
        color: var(--text-color-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .close-btn:hover {
        background-color: var(--secondary-bg);
        color: var(--text-color);
    }
</style>
