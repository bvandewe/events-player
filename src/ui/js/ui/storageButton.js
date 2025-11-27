import { authManager } from '../auth/auth';
import EventStorageManager from '../storage/eventStorage';
import * as bootstrap from 'bootstrap';

export const storageButtonController = (() => {
    let storageBtn;
    let utilizationSpan;
    let storageManager;

    const init = () => {
        storageBtn = document.getElementById('storageStatusBtn');
        utilizationSpan = document.getElementById('storageUtilization');
        storageManager = EventStorageManager.getInstance();

        if (!storageBtn || !utilizationSpan) {
            console.warn('[StorageButton] Elements not found');
            return;
        }

        // Initialize tooltip
        new bootstrap.Tooltip(storageBtn);

        // Add click handler
        storageBtn.addEventListener('click', e => {
            e.preventDefault();
            authManager.clearStorage();
        });

        // Poll for updates every 5 seconds
        setInterval(updateButton, 5000);

        // Initial update
        updateButton();
    };

    const updateButton = () => {
        const stats = storageManager.getStats();
        if (!stats) return;

        const totalEvents = stats.recentCount + stats.metadataCount;
        const maxEvents = storageManager.maxRecentEvents + storageManager.maxMetadataEvents;

        let utilization = 0;
        if (maxEvents > 0) {
            utilization = (totalEvents / maxEvents) * 100;
        }

        // Update text
        utilizationSpan.textContent = `${Math.round(utilization)}%`;

        // Update color
        storageBtn.classList.remove('btn-success', 'btn-warning', 'btn-danger');

        if (utilization < 50) {
            storageBtn.classList.add('btn-success');
        } else if (utilization < 80) {
            storageBtn.classList.add('btn-warning');
        } else {
            storageBtn.classList.add('btn-danger');
        }
    };

    return {
        init,
    };
})();
