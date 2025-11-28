import { toastController } from '../ui/toast';
import { v4 as uuidv4 } from 'uuid';
import { sseConnection } from './connection';
import { connectionStatus } from './connectionStatus';
import { appState } from '../state/appState';
import { globalFilterController } from '../ui/globalFilters';
import { searchController } from '../ui/search';
import * as bootstrap from 'bootstrap';
import { formatDistanceToNow } from 'date-fns';

export const sseEventsController = (() => {
    var eventsStack = document.getElementById('events-stack');
    var maxQueueSize = 0;
    var eventStorageManager = null; // Will be initialized in init()

    const createAccordionItem = ({ eventCount, timestamp, hasError, eventSource, eventSubject, eventType, eventData, eventId }) => {
        console.log(`Rx event: ${eventType} from ${eventSource} at ${timestamp}`);

        // create the div element with class "accordion-item"
        const accordionItem = document.createElement('div');
        accordionItem.classList.add('accordion-item');

        // create the h2 element with class "accordion-header"
        const accordionHeader = document.createElement('h2');
        accordionHeader.classList.add('accordion-header');

        // create the button element with classes "accordion-button" and "collapsed", and set its attributes
        const button = document.createElement('button');
        button.classList.add('accordion-button', 'collapsed');
        button.type = 'button';
        button.setAttribute('data-bs-toggle', 'collapse');
        button.setAttribute('data-bs-target', `#${eventId}`);
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', `${eventId}`);

        // create the first span element with classes "me-2" and "align-middle", and set its text content
        const span1 = document.createElement('span');
        span1.classList.add('me-2', 'align-middle');
        span1.textContent = `#${eventCount}`;

        // create the second span element with classes "align-middle" and "text-secondary", and set its text content
        const span2 = document.createElement('span');
        span2.classList.add('align-middle', 'text-secondary', 'event-timestamp');
        span2.style.cursor = 'help';

        // Format relative time and store both formats in data attributes
        try {
            const relativeTime = formatDistanceToNow(new Date(timestamp), {
                addSuffix: true,
            });
            const absoluteTime = timestamp;

            // Store both formats in data attributes
            span2.setAttribute('data-relative-time', relativeTime);
            span2.setAttribute('data-absolute-time', absoluteTime);
            span2.setAttribute('data-format', 'relative'); // Track current format

            // Initially show relative time
            span2.textContent = relativeTime;

            // Add tooltip with absolute timestamp
            span2.setAttribute('data-bs-toggle', 'tooltip');
            span2.setAttribute('data-bs-placement', 'top');
            span2.setAttribute('data-bs-title', absoluteTime);
            span2.setAttribute('title', absoluteTime);
        } catch (error) {
            console.warn('[Events] Failed to format timestamp:', timestamp, error);
            span2.textContent = timestamp;
            span2.setAttribute('data-absolute-time', timestamp);
            span2.setAttribute('data-format', 'absolute');
        }

        // create the third span element with classes "mx-auto", "align-middle", and "text-info-emphasis", and set its text content
        const span3 = document.createElement('span');
        span3.classList.add('mx-auto', 'align-middle', 'text-info-emphasis', 'd-flex', 'gap-3', 'justify-content-between', 'flex-grow-1');

        // create source badge (left-aligned)
        const sourceBadge = document.createElement('span');
        sourceBadge.classList.add('badge', 'bg-secondary', 'p-1', 'text-truncate', 'ms-2', 'me-auto');
        sourceBadge.textContent = eventSource;
        sourceBadge.style.maxWidth = '33%';

        // create type badge (center-aligned)
        const typeBadge = document.createElement('span');
        typeBadge.classList.add('badge', 'text-bg-success', 'p-1', 'text-truncate', 'mx-auto');
        typeBadge.textContent = eventType;
        typeBadge.style.maxWidth = '33%';

        // create subject badge (right-aligned)
        const subjectBadge = document.createElement('span');
        subjectBadge.classList.add('badge', 'text-bg-warning', 'p-1', 'text-truncate', 'ms-auto', 'me-2');
        subjectBadge.textContent = eventSubject || '(none)';
        subjectBadge.style.maxWidth = '33%';

        // append badges to span3
        span3.appendChild(sourceBadge);
        span3.appendChild(typeBadge);
        span3.appendChild(subjectBadge);

        // Helper function to create filter button
        const createFilterButton = (filterType, value, icon, title) => {
            const btn = document.createElement('button');
            btn.classList.add('btn', 'btn-sm', 'btn-outline-secondary', 'opacity-50', 'border-0', 'p-1');
            btn.style.fontSize = '0.7rem';
            btn.setAttribute('data-bs-toggle', 'tooltip');
            btn.setAttribute('data-bs-placement', 'top');
            btn.setAttribute('data-bs-title', title);
            btn.setAttribute('type', 'button');
            btn.innerHTML = `<i class="bi bi-${icon}"></i>`;

            btn.addEventListener('click', e => {
                e.stopPropagation(); // Prevent accordion toggle

                // Hide the tooltip immediately
                const tooltip = bootstrap.Tooltip.getInstance(btn);
                if (tooltip) {
                    tooltip.hide();
                }

                // Clear existing filters and apply the new one
                const filters = {
                    type: filterType === 'type' ? value : '',
                    source: filterType === 'source' ? value : '',
                    subject: filterType === 'subject' ? value : null,
                    timeRange: 'all',
                };

                appState.updateFilters(filters);

                // Immediately update filtered count after applying filter
                // This ensures the page title updates right away
                setTimeout(() => {
                    updateFilteredCount();
                }, 50);

                // Show a subtle toast notification
                toastController.showToast({
                    status: 'info',
                    message: `Filtering by ${filterType}: ${value || '(none)'}`,
                });
            });

            return btn;
        };

        // Create filter buttons container
        const filterButtonsContainer = document.createElement('span');
        filterButtonsContainer.classList.add('d-flex', 'gap-1', 'ms-2', 'align-middle');

        // Create individual filter buttons
        const sourceButton = createFilterButton('source', eventSource, 'geo-alt', `Filter by source: ${eventSource}`);
        const typeButton = createFilterButton('type', eventType, 'funnel', `Filter by type: ${eventType}`);
        const subjectButton = createFilterButton('subject', eventSubject || '', 'tag', `Filter by subject: ${eventSubject || '(none)'}`);

        filterButtonsContainer.appendChild(sourceButton);
        filterButtonsContainer.appendChild(typeButton);
        filterButtonsContainer.appendChild(subjectButton);

        // Initialize Bootstrap tooltips for the filter buttons with quick hide
        new bootstrap.Tooltip(typeButton, {
            trigger: 'hover',
            delay: { show: 300, hide: 0 },
            animation: true,
        });
        new bootstrap.Tooltip(sourceButton, {
            trigger: 'hover',
            delay: { show: 300, hide: 0 },
            animation: true,
        });
        new bootstrap.Tooltip(subjectButton, {
            trigger: 'hover',
            delay: { show: 300, hide: 0 },
            animation: true,
        });

        // append the span elements to the button element
        button.appendChild(span1);
        button.appendChild(span2);
        button.appendChild(span3);
        button.appendChild(filterButtonsContainer);

        // append the button element to the h2 element
        accordionHeader.appendChild(button);

        // create the div element with classes "accordion-collapse" and "collapse", and set its attributes
        const accordionCollapse = document.createElement('div');
        accordionCollapse.classList.add('accordion-collapse', 'collapse');
        accordionCollapse.setAttribute('id', `${eventId}`);

        // create the div element with class "accordion-body" and set its text content
        const accordionBody = document.createElement('div');
        accordionBody.classList.add('accordion-body', 'eventData');

        // Filter out internal storage attributes before displaying (but keep them in eventData object)
        const { timestamp: _ts, storedAt: _sa, insertionOrder: _io, sequenceNumber: _sn, ...displayEvent } = eventData;
        accordionBody.textContent = JSON.stringify(displayEvent, null, 2);

        // append the accordionBody element to the accordionCollapse element
        accordionCollapse.appendChild(accordionBody); // append the accordionHeader and accordionCollapse elements to the accordionItem element
        accordionItem.appendChild(accordionHeader);
        accordionItem.appendChild(accordionCollapse);

        return accordionItem;
    };

    const resetEventsCount = () => {
        sseConnection.resetCount();
    };

    const incrementEventsCount = () => {
        sseConnection.incrementCount();
    };

    /**
     * Update filtered event count based on current filters and total count
     */
    const updateFilteredCount = () => {
        const stateFilters = appState.get('filters') || {};
        const totalCount = appState.get('eventCount');

        // Check if any filters are active
        const hasActiveFilters = stateFilters.type || stateFilters.source || stateFilters.subject !== null || (stateFilters.timeRange && stateFilters.timeRange !== 'all');

        if (hasActiveFilters) {
            // Count visible events in the DOM
            const eventsStack = document.getElementById('events-stack');
            if (eventsStack) {
                const visibleEvents = eventsStack.querySelectorAll('.accordion-item:not(.d-none)').length;
                appState.setFilteredEventCount(visibleEvents);
                console.log('[Events] Updated filtered count:', visibleEvents, '/', totalCount);
            }
        } else {
            // No filters active
            appState.setFilteredEventCount(null);
        }
    };

    const handleNewEvent = async event => {
        if ('data' in event) {
            var hasError = 'none';
            try {
                // Happy path: event.data is parseable
                // Example event.data with single quote:
                //   "{'timed': '2023-08-23 at 07:14:52.277365', 'cloudevent': {'specversion': '1.0', 'id': 'd1ca5fc6-68b8-45d2-9151-2f066abc017e', 'time': '2023-08-23T07:14:52.233089', 'datacontenttype': 'application/json', 'type': 'com.source.dummy.test.requested.v1', 'source': 'https://dummy.source.com/sys-admin', 'subject': '', 'data': {'foo': "bar 'test'"}}}"
                var eventData = JSON.parse(event.data.replace(/'/g, '"').replace(/\\\"/g, '"')); // < shouldnt be required
                var cleanedData = event.data
                    .replace(/'/g, '"') //replace single-quotes to double-quotes < shouldnt be required
                    .replace(/\\\"/g, '"') //replace escaped double-quotes to double-quotes < shouldnt be required
                    .replace(/True/g, 'true') //replace (Python/Ruby?) boolean to JSON boolean < shouldnt be required
                    .replace(/False/g, 'false') //replace (Python/Ruby?) boolean to JSON boolean < shouldnt be required
                    .replace(/None/g, 'null'); //replace (Python/Ruby?) None to String < shouldnt be required

                var eventData = JSON.parse(cleanedData);
                // var eventData = JSON.parse(event.data);
                var cloudEventData = eventData.cloudevent;

                const isValidCloudEvent =
                    cloudEventData &&
                    typeof cloudEventData === 'object' &&
                    typeof cloudEventData.specversion === 'string' &&
                    typeof cloudEventData.type === 'string' &&
                    typeof cloudEventData.source === 'string' &&
                    typeof cloudEventData.id === 'string' &&
                    typeof cloudEventData.time === 'string';

                if (!isValidCloudEvent) {
                    console.info('[Events] Ignoring non-CloudEvent payload from SSE stream', { payload: cloudEventData });
                    return;
                }

                const isHandshakeEvent = cloudEventData && typeof cloudEventData.system === 'string' && (!cloudEventData.type || cloudEventData.type === 'system.connected');

                if (isHandshakeEvent) {
                    console.info('[Events] Ignoring handshake/system event from SSE stream', { payload: cloudEventData });
                    return;
                }

                if (typeof cloudEventData.data === 'object') {
                    if (Object.keys(cloudEventData.data).length == 1 && cloudEventData.data.hasOwnProperty('error')) {
                        hasError = 'backend-error';
                    }
                }
            } catch (error) {
                // error = SyntaxError: Expected ',' or '}' after property value in JSON at position 334 at JSON.parse ...
                hasError = 'parse-error';
                var result = {
                    detail: [
                        {
                            loc: ['event.data'],
                            msg: 'Event data is not valid JSON, maybe a JSON object encoded as a String, or including single or double quotes somewhere?',
                            type: 'JSON.parse',
                        },
                    ],
                };
                toastController.showToast(result);
                var eventData = event.data.replace(/'/g, '"').replace(/\\\"/g, '"');
                // Assuming .data is the last attribute in the event... (!!! quite a significant assumption!!)
                // Removing anything after `, "data"` and adding `}}` should make it parsable
                var strippedEventData = eventData.substring(0, eventData.indexOf(', "data"')) + '}}';
                // Capturing the raw data
                var eventDataStr = eventData.substring(eventData.indexOf(', "data"'));
                eventData = JSON.parse(strippedEventData);
                var cloudEventData = eventData.cloudevent;
                // cloudEventData.data = result;
                // Adding the raw string back as "data"
                cloudEventData.data = eventDataStr.substring(9);
            }
            if (!cloudEventData || typeof cloudEventData !== 'object') {
                console.warn('[Events] No CloudEvent data found after parsing SSE payload, skipping event');
                return;
            }

            const hasRequiredFields =
                typeof cloudEventData.specversion === 'string' && typeof cloudEventData.type === 'string' && typeof cloudEventData.source === 'string' && typeof cloudEventData.id === 'string' && typeof cloudEventData.time === 'string';

            if (!hasRequiredFields) {
                console.warn('[Events] CloudEvent missing required attributes after parse, skipping event', cloudEventData);
                return;
            }

            const isSystemEvent = typeof cloudEventData.system === 'string' && (!cloudEventData.type || cloudEventData.type === 'system.connected');

            if (isSystemEvent) {
                console.info('[Events] Ignoring system Cloudevent after parse validation', cloudEventData);
                return;
            }

            const uuid = uuidv4();

            // Store event in storage manager (both tiers) first to get sequence number
            let sequenceNumber = 0;
            if (eventStorageManager) {
                await eventStorageManager.addEvent(cloudEventData).catch(err => {
                    console.error('[Events] Failed to store event:', err);
                });
                // Get the sequence number from stats (addEvent increments totalReceived)
                const stats = eventStorageManager.getStats();
                sequenceNumber = stats.totalReceived;
            }

            var accordionData = {
                eventCount: sequenceNumber, // Use sequence number from storage
                timestamp: cloudEventData.time,
                hasError: hasError,
                eventSource: cloudEventData.source,
                eventSubject: cloudEventData.subject,
                eventType: cloudEventData.type,
                eventData: cloudEventData,
                eventId: uuid,
            };

            // Add event values to global filter dropdowns
            if (globalFilterController.initialized) {
                globalFilterController.addEventValues(cloudEventData);
            }

            // Notify appState that a new event was received (triggers metrics/chart updates)
            appState.notifyEventReceived(cloudEventData);

            // Check if event matches active filters from global state
            if (!globalFilterController.matchesFilters(cloudEventData)) {
                console.log('[Events] Event filtered out:', cloudEventData.type);
                // Update filtered count even when event is filtered out
                updateFilteredCount();
                return; // Don't display this event
            }

            // Increment counter only when event is actually displayed
            incrementEventsCount();

            // Defensive check - eventsStack only exists on main events list page
            if (!eventsStack) {
                return; // Don't try to manipulate DOM if not on events list page
            }

            const item = createAccordionItem(accordionData);
            eventsStack.prepend(item);

            // Initialize tooltips for the new event timestamp
            const timestampEl = item.querySelector('.event-timestamp[data-bs-toggle="tooltip"]');
            if (timestampEl) {
                new bootstrap.Tooltip(timestampEl, { trigger: 'hover' });
            }

            // Apply search filter to new event if search is active
            if (searchController.getSearchTerm && searchController.getSearchTerm()) {
                searchController.reapplySearch();
            }

            // Update filtered count AFTER item is added to DOM
            updateFilteredCount();
        }
    };

    const handleSseEvent = async event => {
        console.log(event);
        // Don't increment here - increment in handleNewEvent after filtering
        connectionStatus.updateStatus('cleartimer');
        connectionStatus.updateStatus('connect');
        await handleNewEvent(event);
        connectionStatus.updateStatus('newtimer');

        // Defensive check - eventsStack only exists on main events list page
        if (!eventsStack) {
            return; // Don't try to manipulate DOM if not on events list page
        }

        // Keep the stack to its max-size ??? > eventsCount
        if (eventsStack.childElementCount > maxQueueSize) {
            let lastEvent = eventsStack.lastChild;
            eventsStack.removeChild(lastEvent);
        }
    };

    /**
     * Load events from IndexedDB storage and display them
     * This allows the event list to persist across page reloads
     */
    const loadEventsFromStorage = async () => {
        try {
            console.log('[Events] Loading events from storage...');

            if (!eventStorageManager) {
                console.error('[Events] Storage manager not available');
                return;
            }

            if (!eventStorageManager.initialized) {
                console.warn('[Events] Storage manager not initialized, waiting...');
                await eventStorageManager.init();
            }

            console.log('[Events] Storage stats:', eventStorageManager.getStats());

            // Get URL parameters for filtering (URL params take precedence)
            const urlParams = new URLSearchParams(window.location.search);
            const startTime = urlParams.get('startTime') ? parseInt(urlParams.get('startTime')) : null;
            const endTime = urlParams.get('endTime') ? parseInt(urlParams.get('endTime')) : null;
            const typeFilter = urlParams.get('type') || null;
            const sourceFilter = urlParams.get('source') || null;
            const subjectFilter = urlParams.has('subject') ? urlParams.get('subject') : null;

            // Get time range from global filters if not from URL
            let timeRangeStart = startTime;
            let timeRangeEnd = endTime;

            if (!startTime && !endTime) {
                const globalFilters = appState.get('filters');
                const timeRange = globalFilters.timeRange;

                if (timeRange && timeRange !== 'all') {
                    const now = Date.now();

                    // Handle custom time range (from timeline click or manual selection)
                    if (timeRange === 'custom') {
                        timeRangeStart = globalFilters.customStartTime;
                        timeRangeEnd = globalFilters.customEndTime;
                        console.log('[Events] Applying custom time range from global filters:', {
                            start: timeRangeStart ? new Date(timeRangeStart).toISOString() : 'none',
                            end: timeRangeEnd ? new Date(timeRangeEnd).toISOString() : 'none',
                        });
                    } else {
                        // Convert predefined time range format to milliseconds
                        timeRangeEnd = now;

                        switch (timeRange) {
                            case '5m':
                                timeRangeStart = now - 5 * 60 * 1000;
                                break;
                            case '15m':
                                timeRangeStart = now - 15 * 60 * 1000;
                                break;
                            case '30m':
                                timeRangeStart = now - 30 * 60 * 1000;
                                break;
                            case '1h':
                                timeRangeStart = now - 60 * 60 * 1000;
                                break;
                            case '3h':
                                timeRangeStart = now - 3 * 60 * 60 * 1000;
                                break;
                            case '6h':
                                timeRangeStart = now - 6 * 60 * 60 * 1000;
                                break;
                            case '12h':
                                timeRangeStart = now - 12 * 60 * 60 * 1000;
                                break;
                            case '24h':
                                timeRangeStart = now - 24 * 60 * 60 * 1000;
                                break;
                            case '2d':
                                timeRangeStart = now - 2 * 24 * 60 * 60 * 1000;
                                break;
                            case '7d':
                                timeRangeStart = now - 7 * 24 * 60 * 60 * 1000;
                                break;
                            case '30d':
                                timeRangeStart = now - 30 * 24 * 60 * 60 * 1000;
                                break;
                        }

                        console.log('[Events] Applying time range from global filters:', {
                            timeRange,
                            start: new Date(timeRangeStart).toISOString(),
                            end: new Date(timeRangeEnd).toISOString(),
                        });
                    }
                }
            }

            let events = await eventStorageManager.getRecentEvents({
                limit: maxQueueSize,
            });

            console.log('[Events] getRecentEvents returned:', events ? events.length : 'null/undefined', 'events');

            // Store the total count BEFORE filtering
            const totalEventsCount = events ? events.length : 0;

            // Check if any filters are active (URL params or dropdown filters)
            const stateFilters = appState.get('filters');
            const hasActiveFilters = timeRangeStart || timeRangeEnd || typeFilter || sourceFilter || subjectFilter !== null || stateFilters.type || stateFilters.source || stateFilters.subject !== null;

            // Apply filters from URL parameters or dropdown selections
            if (events && hasActiveFilters) {
                console.log('[Events] Applying filters:', {
                    startTime: timeRangeStart,
                    endTime: timeRangeEnd,
                    typeFilter,
                    sourceFilter,
                    subjectFilter,
                    stateFilters,
                });

                events = events.filter(event => {
                    // Time range filter
                    if (timeRangeStart || timeRangeEnd) {
                        // Handle timezone: if timestamp doesn't end with Z, assume UTC
                        let eventTime = event.time;
                        if (eventTime && !eventTime.endsWith('Z') && !eventTime.includes('+') && !eventTime.includes('-', 10)) {
                            eventTime = eventTime + 'Z';
                        }
                        const eventTimestamp = new Date(eventTime).getTime();

                        console.log('[Events] Checking event time:', {
                            originalTime: event.time,
                            correctedTime: eventTime,
                            eventTimestamp,
                            startTime: timeRangeStart,
                            endTime: timeRangeEnd,
                            inRange: (!timeRangeStart || eventTimestamp >= timeRangeStart) && (!timeRangeEnd || eventTimestamp < timeRangeEnd),
                        });

                        if (timeRangeStart && eventTimestamp < timeRangeStart) return false;
                        if (timeRangeEnd && eventTimestamp >= timeRangeEnd) return false;
                    }

                    // Type filter (from URL or state)
                    const activeTypeFilter = typeFilter || stateFilters.type;
                    if (activeTypeFilter && event.type !== activeTypeFilter) {
                        console.log('[Events] Filtering out by type:', event.type, '!==', activeTypeFilter);
                        return false;
                    }

                    // Source filter (from URL or state)
                    const activeSourceFilter = sourceFilter || stateFilters.source;
                    if (activeSourceFilter && event.source !== activeSourceFilter) {
                        console.log('[Events] Filtering out by source:', event.source, '!==', activeSourceFilter);
                        return false;
                    }

                    // Subject filter (from URL or state)
                    const activeSubjectFilter = subjectFilter !== null ? subjectFilter : stateFilters.subject;
                    if (activeSubjectFilter !== null && event.subject !== activeSubjectFilter) {
                        console.log('[Events] Filtering out by subject:', event.subject, '!==', activeSubjectFilter);
                        return false;
                    }

                    return true;
                });

                console.log('[Events] After filtering:', events.length, 'events');

                // Update filtered count in appState for counter display
                if (hasActiveFilters) {
                    appState.setFilteredEventCount(events.length);
                } else {
                    // No filters active, reset filtered count
                    appState.setFilteredEventCount(null);
                }
            } else {
                // No filters active, reset filtered count
                appState.setFilteredEventCount(null);
            }

            if (events && events.length > 0) {
                console.log(`[Events] Loaded ${events.length} events from storage`);

                // Defensive check - eventsStack only exists on main events list page
                if (!eventsStack) {
                    console.log('[Events] Skipping event display - not on events list page');
                    return;
                }

                // Clear current display
                eventsStack.innerHTML = '';
                resetEventsCount();

                // Render events in reverse order (oldest first, so newest ends up on top)
                events.reverse().forEach(cloudEventData => {
                    const uuid = uuidv4();
                    const accordionData = {
                        eventCount: cloudEventData.sequenceNumber || 0, // Use stored sequence number
                        timestamp: cloudEventData.time,
                        hasError: 'none',
                        eventSource: cloudEventData.source,
                        eventSubject: cloudEventData.subject,
                        eventType: cloudEventData.type,
                        eventData: cloudEventData,
                        eventId: uuid,
                    };

                    // Don't increment in loop - set count once at the end
                    const item = createAccordionItem(accordionData);
                    eventsStack.prepend(item);

                    // Initialize tooltips for the new event timestamp
                    const timestampEl = item.querySelector('.event-timestamp[data-bs-toggle="tooltip"]');
                    if (timestampEl) {
                        new bootstrap.Tooltip(timestampEl, { trigger: 'hover' });
                    }
                });

                // Set counter to the TOTAL number of events in storage (not filtered count)
                // The filtered count is set separately via appState.setFilteredEventCount()
                sseConnection.setCount(totalEventsCount);

                console.log(`[Events] Displayed ${events.length} events out of ${totalEventsCount} total`);

                // Apply search filter if search is active
                if (searchController.getSearchTerm && searchController.getSearchTerm()) {
                    searchController.reapplySearch();
                }
            } else {
                console.log('[Events] No events found in storage (events array empty or null)');
                // Set counter to 0 when no events
                resetEventsCount();
            }
        } catch (error) {
            console.error('[Events] Failed to load events from storage:', error);
        }
    };

    const init = (queueSize, storageManager) => {
        maxQueueSize = parseInt(queueSize);
        eventStorageManager = storageManager; // Store reference to storage manager

        // Wait for storage to initialize, then load events, then setup SSE
        const setupSequence = async () => {
            try {
                // Ensure storage is initialized
                if (eventStorageManager && !eventStorageManager.initialized) {
                    await eventStorageManager.init();
                }

                // Load existing events from storage (this will set the counter correctly)
                await loadEventsFromStorage();

                // Initialize global filters (already initialized in app.js, just ensure it has storage manager)
                if (!globalFilterController.initialized) {
                    await globalFilterController.init(eventStorageManager);
                }

                // Subscribe to filter changes to reload events (only once)
                appState.subscribe('filters', filters => {
                    console.log('[Events] Global filters changed:', filters);
                    loadEventsFromStorage();
                });

                // Now initialize SSE connection with the current counter value
                // (which reflects filtered events if filters are active)
                const currentCount = sseConnection.getCount();
                console.log('[Events] Initializing SSE with counter:', currentCount);

                // Initialize connection status manager
                connectionStatus.init();

                sseConnection.init({
                    initialCount: currentCount,
                    onMessage: event => {
                        connectionStatus.updateStatus('connect');
                        handleSseEvent(event);
                    },
                    onOpen: () => {
                        connectionStatus.updateStatus('open');
                    },
                    onError: error => {
                        connectionStatus.updateStatus('error');
                    },
                });
            } catch (error) {
                console.error('[Events] Failed to initialize:', error);
            }
        };

        setupSequence();

        // Listen for animation end on connection status indicator
        const statusIndicator = document.getElementById('connectionStatusIndicator');
        if (statusIndicator) {
            statusIndicator.addEventListener('animationend', () => {
                statusIndicator.classList.remove('glow', 'blink');
            });
        }

        // Listen for page visibility changes to reload events when user returns
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && eventStorageManager && eventStorageManager.db) {
                console.log('[Events] Page became visible, reloading events from storage...');
                loadEventsFromStorage();
            }
        });

        // Setup timestamp toggle functionality
        const setupTimestampToggle = () => {
            const timestampToggle = document.getElementById('timestampToggle');
            if (timestampToggle) {
                timestampToggle.addEventListener('click', () => {
                    // Get all timestamp elements
                    const timestamps = document.querySelectorAll('.event-timestamp');

                    if (timestamps.length === 0) return;

                    // Check current format from first timestamp
                    const currentFormat = timestamps[0].getAttribute('data-format');
                    const newFormat = currentFormat === 'relative' ? 'absolute' : 'relative';

                    console.log(`[Events] Toggling timestamps from ${currentFormat} to ${newFormat}`);

                    // Toggle all timestamps
                    timestamps.forEach(span => {
                        const relativeTime = span.getAttribute('data-relative-time');
                        const absoluteTime = span.getAttribute('data-absolute-time');

                        if (newFormat === 'absolute') {
                            // Show absolute time, tooltip shows relative
                            span.textContent = absoluteTime;
                            span.setAttribute('data-bs-title', relativeTime);
                            span.setAttribute('title', relativeTime);
                            span.setAttribute('data-format', 'absolute');
                        } else {
                            // Show relative time, tooltip shows absolute
                            span.textContent = relativeTime;
                            span.setAttribute('data-bs-title', absoluteTime);
                            span.setAttribute('title', absoluteTime);
                            span.setAttribute('data-format', 'relative');
                        }

                        // Reinitialize tooltip if it exists
                        const tooltip = bootstrap.Tooltip.getInstance(span);
                        if (tooltip) {
                            tooltip.dispose();
                            new bootstrap.Tooltip(span, { trigger: 'hover' });
                        }
                    });
                });
            }
        };

        // Initialize toggle after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupTimestampToggle);
        } else {
            setupTimestampToggle();
        }
    };

    return {
        init,
        resetEventsCount,
        loadEventsFromStorage, // Expose for manual refresh
        updateFilteredCount, // Expose for external filter updates
    };
})();
