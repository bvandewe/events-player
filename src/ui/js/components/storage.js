/**
 * Storage Component
 * Manages storage utilization indicators
 */

class StorageController {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.updateInterval = null;
    }

    /**
     * Initialize storage indicators
     */
    init() {
        console.log('[Storage] Initializing...');

        // Initial update
        this.update();

        // Backup polling every 30 seconds
        this.updateInterval = setInterval(() => this.update(), 30000);

        console.log('[Storage] Initialized');
    }

    /**
     * Update storage indicators
     */
    update() {
        if (!this.storageManager) return;

        const stats = this.storageManager.getStats();

        // Recent Events
        const recentMax = this.storageManager.maxRecentEvents;
        const recentPercent = Math.round((stats.recentCount / recentMax) * 100);
        
        const recentCountEl = document.getElementById('recentCount');
        const recentMaxEl = document.getElementById('recentMax');
        const recentProgressEl = document.getElementById('recentProgress');
        const recentPercentEl = document.getElementById('recentPercent');

        if (recentCountEl) recentCountEl.textContent = stats.recentCount.toLocaleString();
        if (recentMaxEl) recentMaxEl.textContent = recentMax.toLocaleString();
        if (recentProgressEl) recentProgressEl.style.width = `${recentPercent}%`;
        if (recentPercentEl) recentPercentEl.textContent = `${recentPercent}%`;

        // Update progress bar color based on usage
        if (recentProgressEl) {
            recentProgressEl.className = 'progress-bar';
            if (recentPercent >= 90) {
                recentProgressEl.classList.add('bg-danger');
            } else if (recentPercent >= 70) {
                recentProgressEl.classList.add('bg-warning');
            } else {
                recentProgressEl.classList.add('bg-primary');
            }
        }

        // Metadata
        const metadataMax = this.storageManager.maxMetadataEvents;
        const metadataPercent = Math.round((stats.metadataCount / metadataMax) * 100);
        
        const metadataCountEl = document.getElementById('metadataCount');
        const metadataMaxEl = document.getElementById('metadataMax');
        const metadataProgressEl = document.getElementById('metadataProgress');
        const metadataPercentEl = document.getElementById('metadataPercent');

        if (metadataCountEl) metadataCountEl.textContent = stats.metadataCount.toLocaleString();
        if (metadataMaxEl) metadataMaxEl.textContent = metadataMax.toLocaleString();
        if (metadataProgressEl) metadataProgressEl.style.width = `${metadataPercent}%`;
        if (metadataPercentEl) metadataPercentEl.textContent = `${metadataPercent}%`;

        // Update progress bar color
        if (metadataProgressEl) {
            metadataProgressEl.className = 'progress-bar';
            if (metadataPercent >= 90) {
                metadataProgressEl.classList.add('bg-danger');
            } else if (metadataPercent >= 70) {
                metadataProgressEl.classList.add('bg-warning');
            } else {
                metadataProgressEl.classList.add('bg-info');
            }
        }

        // Update Storage Utilization accordion title color based on Tier 1 (Recent Events) usage
        const storageTitle = document.querySelector('.storage-section h6');
        if (storageTitle) {
            if (recentPercent > 80) {
                storageTitle.style.color = 'var(--bs-orange, #fd7e14)';
                storageTitle.style.fontWeight = 'bold';
            } else {
                storageTitle.style.color = '';
                storageTitle.style.fontWeight = '';
            }
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

export { StorageController };
