/**
 * Collapse State Manager
 * Manages collapsible sections with localStorage persistence
 */

/**
 * Initialize collapsible sections with state persistence
 */
export function initializeCollapseState() {
    const collapsibles = [
        { id: 'metricsCollapse', chevronId: 'metricsChevron', key: 'metrics' },
        { id: 'analyticsCollapse', chevronId: 'analyticsChevron', key: 'analytics' },
        { id: 'storageCollapse', chevronId: 'storageChevron', key: 'storage' },
    ];

    collapsibles.forEach(({ id, chevronId, key }) => {
        const element = document.getElementById(id);
        const chevron = document.getElementById(chevronId);

        if (!element || !chevron) return;

        // Restore state from localStorage
        const savedState = localStorage.getItem(`dashboard_${key}_collapsed`);
        if (savedState === 'true') {
            element.classList.remove('show');
            chevron.classList.remove('bi-chevron-down');
            chevron.classList.add('bi-chevron-right');
        }

        // Listen for collapse events
        element.addEventListener('show.bs.collapse', () => {
            chevron.classList.remove('bi-chevron-right');
            chevron.classList.add('bi-chevron-down');
            localStorage.setItem(`dashboard_${key}_collapsed`, 'false');
        });

        element.addEventListener('hide.bs.collapse', () => {
            chevron.classList.remove('bi-chevron-down');
            chevron.classList.add('bi-chevron-right');
            localStorage.setItem(`dashboard_${key}_collapsed`, 'true');
        });
    });
}
