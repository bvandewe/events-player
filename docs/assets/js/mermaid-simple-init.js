/**
 * Simple Mermaid Initialization for CML Lablets Documentation
 * Lightweight configuration for fast build times
 */

document.addEventListener('DOMContentLoaded', function () {
    if (typeof mermaid !== 'undefined') {
        // Simple theme detection
        const isDark = document.body.getAttribute('data-md-color-scheme') === 'slate';

        // Minimal Mermaid configuration
        mermaid.initialize({
            startOnLoad: true,
            theme: isDark ? 'dark' : 'default',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true
            },
            sequence: {
                useMaxWidth: true
            },
            gantt: {
                useMaxWidth: true
            }
        });

        console.log('🎨 Mermaid initialized (simple mode)');
    }
});
