export const searchController = (() => {

    const STORAGE_KEY = 'cloudevents-player-search-term';
    let currentSearchTerm = '';

    /**
     * Save search term to localStorage
     */
    const saveSearchTerm = (term) => {
        try {
            localStorage.setItem(STORAGE_KEY, term);
        } catch (error) {
            console.error('[Search] Error saving search term:', error);
        }
    };

    /**
     * Load search term from localStorage
     */
    const loadSearchTerm = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved || '';
        } catch (error) {
            console.error('[Search] Error loading search term:', error);
            return '';
        }
    };

    /**
     * Deep search through event data (CloudEvent attributes + data payload)
     * Searches through the entire JSON structure including nested objects
     */
    const searchEventData = (eventElement, searchTerm) => {
        if (!searchTerm) return true; // Empty search matches all

        const lowerSearchTerm = searchTerm.toLowerCase();

        // Get the raw text content (includes all visible and hidden text)
        const textContent = eventElement.textContent || eventElement.innerText;
        if (textContent.toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }

        // Also check data attributes that might contain event data
        const eventData = eventElement.querySelector('.event-data');
        if (eventData) {
            const dataText = eventData.textContent || eventData.innerText;
            if (dataText.toLowerCase().includes(lowerSearchTerm)) {
                return true;
            }
        }

        return false;
    };

    /**
     * Apply search filter to all events in the stream
     */
    const applySearch = (searchTerm) => {
        currentSearchTerm = searchTerm;
        const lowerSearchTerm = searchTerm.toLowerCase().trim();

        const eventsStackDiv = document.getElementById('events-stack');
        if (!eventsStackDiv) {
            console.warn('[Search] Events stack not found');
            return;
        }

        const eventMessages = eventsStackDiv.getElementsByClassName('accordion-item');
        let visibleCount = 0;
        let hiddenCount = 0;

        for (let i = 0; i < eventMessages.length; i++) {
            const matches = searchEventData(eventMessages[i], lowerSearchTerm);
            if (matches) {
                eventMessages[i].style.display = '';
                visibleCount++;
            } else {
                eventMessages[i].style.display = 'none';
                hiddenCount++;
            }
        }

        console.log(`[Search] Applied search "${searchTerm}": ${visibleCount} visible, ${hiddenCount} hidden`);

        // Update clear button visibility
        updateClearButton(searchTerm);

        // Save search term
        saveSearchTerm(searchTerm);
    };

    /**
     * Clear search and show all events
     */
    const clearSearch = () => {
        const filterInput = document.getElementById('search-input');
        if (filterInput) {
            filterInput.value = '';
        }
        applySearch('');
    };

    /**
     * Update visibility of clear button
     */
    const updateClearButton = (searchTerm) => {
        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) {
            clearBtn.style.display = searchTerm ? 'block' : 'none';
        }
    };

    /**
     * Handle search input changes (debounced)
     */
    let searchTimeout;
    const onSearchInputChange = (event) => {
        const searchTerm = event.target.value;

        // Debounce search for better performance (300ms delay)
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            applySearch(searchTerm);
        }, 300);
    };

    /**
     * Get current search term
     */
    const getSearchTerm = () => {
        return currentSearchTerm;
    };

    /**
     * Reapply current search (useful when new events are added)
     */
    const reapplySearch = () => {
        if (currentSearchTerm) {
            applySearch(currentSearchTerm);
        }
    };

    const init = () => {
        console.log('[Search] Initializing...');

        const filterInput = document.getElementById('search-input');
        if (filterInput) {
            // Restore saved search term
            const savedTerm = loadSearchTerm();
            if (savedTerm) {
                filterInput.value = savedTerm;
                currentSearchTerm = savedTerm;
                // Apply search after a short delay to ensure DOM is ready
                setTimeout(() => applySearch(savedTerm), 500);
            }

            // Listen for input changes
            filterInput.addEventListener('keyup', onSearchInputChange);
            filterInput.addEventListener('input', onSearchInputChange);

            // Focus search on Ctrl/Cmd + F
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                    e.preventDefault();
                    filterInput.focus();
                    filterInput.select();
                }
            });
        } else {
            console.warn('[Search] Search input element not found');
        }

        // Setup clear button
        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearSearch);
        }

        // Prevent form submission
        const searchForm = document.getElementById('search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', (event) => {
                event.preventDefault();
            });
        }

        console.log('[Search] Initialized');
    };

    return {
        init,
        applySearch,
        clearSearch,
        getSearchTerm,
        reapplySearch
    };

})();
