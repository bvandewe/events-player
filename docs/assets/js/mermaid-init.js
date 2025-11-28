/**
 * Mermaid Initialization for CML Lablets Documentation
 * Configures Mermaid diagrams with theme support and custom styling
 */

document.addEventListener('DOMContentLoaded', function () {
    // Check if Mermaid is available
    if (typeof mermaid !== 'undefined') {
        // Get the current theme from Material theme
        const getTheme = () => {
            const palette = JSON.parse(localStorage.getItem('__palette') || '{}');
            return palette.index === 1 ? 'dark' : 'light';
        };

        // Configure Mermaid with theme-aware settings
        mermaid.initialize({
            startOnLoad: true,
            theme: getTheme(),
            themeVariables: {
                // Light theme colors (Cisco branding)
                primaryColor: '#1BA0D7',
                primaryTextColor: '#2D3748',
                primaryBorderColor: '#1BA0D7',
                lineColor: '#4A5568',
                sectionBkColor: '#F7FAFC',
                altSectionBkColor: '#EDF2F7',
                gridColor: '#E2E8F0',
                secondaryColor: '#68D391',
                tertiaryColor: '#ED8936',

                // Flowchart specific
                clusterBkg: '#EBF8FF',
                clusterBorder: '#1BA0D7',

                // Sequence diagram
                actorBorder: '#1BA0D7',
                actorBkg: '#EBF8FF',
                actorTextColor: '#2D3748',
                activationBorderColor: '#1BA0D7',
                activationBkgColor: '#BEE3F8',

                // Gantt chart
                taskBkgColor: '#EBF8FF',
                taskTextColor: '#2D3748',
                activeTaskBkgColor: '#1BA0D7',
                activeTaskBorderColor: '#2B6CB0',
                gridLineColor: '#E2E8F0',

                // Class diagram
                classText: '#2D3748',
            },
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis',
            },
            sequence: {
                diagramMarginX: 50,
                diagramMarginY: 10,
                actorMargin: 50,
                width: 150,
                height: 65,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35,
                mirrorActors: true,
                bottomMarginAdj: 1,
                useMaxWidth: true,
            },
            gantt: {
                titleTopMargin: 25,
                barHeight: 20,
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
                fontSize: 12,
                gridLineStartPadding: 35,
                bottomPadding: 25,
                rightPadding: 25,
            },
        });

        // Listen for theme changes and reinitialize Mermaid
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'data-md-color-scheme') {
                    const newTheme = getTheme();
                    mermaid.initialize({
                        theme: newTheme,
                        startOnLoad: true,
                    });

                    // Re-render all Mermaid diagrams
                    document.querySelectorAll('.mermaid').forEach((element, index) => {
                        const graphDefinition = element.textContent;
                        element.innerHTML = '';
                        mermaid.render(`mermaid-diagram-${index}`, graphDefinition, svgCode => {
                            element.innerHTML = svgCode;
                        });
                    });
                }
            });
        });

        // Start observing theme changes
        const bodyElement = document.body;
        if (bodyElement) {
            observer.observe(bodyElement, {
                attributes: true,
                attributeFilter: ['data-md-color-scheme'],
            });
        }

        console.log('🎨 Mermaid initialized for CML Lablets documentation');
    } else {
        console.warn('⚠️  Mermaid library not loaded');
    }
});

/**
 * Handle diagram click events for better UX
 */
document.addEventListener('click', function (event) {
    if (event.target.closest('.mermaid svg')) {
        const diagram = event.target.closest('.mermaid');
        if (diagram) {
            // Add subtle animation or interaction feedback
            diagram.style.transform = 'scale(1.02)';
            diagram.style.transition = 'transform 0.2s ease-in-out';

            setTimeout(() => {
                diagram.style.transform = 'scale(1)';
            }, 200);
        }
    }
});
