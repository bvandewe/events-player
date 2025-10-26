import { toastController } from "../ui/toast";
import { v4 as uuidv4 } from 'uuid';
import { sseConnection } from './connection';
import { filterController } from '../ui/filters';
import { connectionStatus } from './connectionStatus';

export const sseEventsController = (() => {

    var eventsStack = document.getElementById('events-stack');
    var maxQueueSize = 0;
    var eventStorageManager = null; // Will be initialized in init()
    var activeFilters = { type: '', source: '', subject: null };
    var timeRangeSelect = null; // Will be initialized in init()

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
        span2.textContent = `${timestamp}`;

        // create the third span element with classes "mx-auto", "align-middle", and "text-info-emphasis", and set its text content
        const span3 = document.createElement('span');
        span3.classList.add('mx-auto', 'align-middle', 'text-info-emphasis', 'd-flex', 'gap-3', 'justify-content-evenly', 'flex-grow-1');

        // create type badge
        const typeBadge = document.createElement('span');
        typeBadge.classList.add('badge', 'text-bg-success', 'p-1', 'text-truncate');
        typeBadge.textContent = eventType;
        typeBadge.style.maxWidth = '33%';

        // create source badge
        const sourceBadge = document.createElement('span');
        sourceBadge.classList.add('badge', 'bg-secondary', 'p-1', 'text-truncate');
        sourceBadge.textContent = eventSource;
        sourceBadge.style.maxWidth = '33%';

        // create subject badge (if subject exists)
        const subjectBadge = document.createElement('span');
        subjectBadge.classList.add('badge', 'text-bg-warning', 'p-1', 'text-truncate');
        subjectBadge.textContent = eventSubject || '(none)';
        subjectBadge.style.maxWidth = '33%';

        // append badges to span3
        span3.appendChild(typeBadge);
        span3.appendChild(sourceBadge);
        span3.appendChild(subjectBadge);

        // append the span elements to the button element
        button.appendChild(span1);
        button.appendChild(span2);
        button.appendChild(span3);

        // append the button element to the h2 element
        accordionHeader.appendChild(button);

        // create the div element with classes "accordion-collapse" and "collapse", and set its attributes
        const accordionCollapse = document.createElement('div');
        accordionCollapse.classList.add('accordion-collapse', 'collapse');
        accordionCollapse.setAttribute('id', `${eventId}`);

        // create the div element with class "accordion-body" and set its text content
        const accordionBody = document.createElement('div');
        accordionBody.classList.add('accordion-body', 'eventData');
        accordionBody.textContent = JSON.stringify(eventData, null, 2);

        // append the accordionBody element to the accordionCollapse element
        accordionCollapse.appendChild(accordionBody);

        // append the accordionHeader and accordionCollapse elements to the accordionItem element
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
     * Show filter banner when URL parameters are present
     */
    const showFilterBanner = (filters) => {
        const { startTime, endTime, typeFilter, sourceFilter, subjectFilter } = filters;

        // Find or create filter banner container
        let banner = document.getElementById('filter-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'filter-banner';
            banner.className = 'alert alert-info alert-dismissible fade show mb-3';
            banner.setAttribute('role', 'alert');

            // Insert before events stack
            eventsStack.parentNode.insertBefore(banner, eventsStack);
        }

        const filterParts = [];

        if (startTime || endTime) {
            const start = startTime ? new Date(startTime).toLocaleString() : 'start';
            const end = endTime ? new Date(endTime).toLocaleString() : 'now';
            filterParts.push(`<strong>Time:</strong> ${start} to ${end}`);
        }

        if (typeFilter) {
            filterParts.push(`<strong>Type:</strong> ${typeFilter}`);
        }

        if (sourceFilter) {
            filterParts.push(`<strong>Source:</strong> ${sourceFilter}`);
        }

        if (subjectFilter !== null) {
            filterParts.push(`<strong>Subject:</strong> ${subjectFilter || '(empty)'}`);
        }

        banner.innerHTML = `
            <i class="bi bi-funnel-fill me-2"></i>
            <strong>Filtered View:</strong> ${filterParts.join(' | ')}
            <button type="button" class="btn-close" onclick="window.location.href='/'"></button>
        `;
    };

    const handleNewEvent = (event) => {
        if ("data" in event) {
            var hasError = "none";
            try {
                // Happy path: event.data is parseable
                // Example event.data with single quote:
                //   "{'timed': '2023-08-23 at 07:14:52.277365', 'cloudevent': {'specversion': '1.0', 'id': 'd1ca5fc6-68b8-45d2-9151-2f066abc017e', 'time': '2023-08-23T07:14:52.233089', 'datacontenttype': 'application/json', 'type': 'com.source.dummy.test.requested.v1', 'source': 'https://dummy.source.com/sys-admin', 'subject': '', 'data': {'foo': "bar 'test'"}}}"
                var eventData = JSON.parse(event.data.replace(/'/g, "\"").replace(/\\\"/g, '"'));  // < shouldnt be required
                var cleanedData = event.data.replace(/'/g, "\"")        //replace single-quotes to double-quotes < shouldnt be required
                    .replace(/\\\"/g, '"')          //replace escaped double-quotes to double-quotes < shouldnt be required
                    .replace(/True/g, 'true')       //replace (Python/Ruby?) boolean to JSON boolean < shouldnt be required
                    .replace(/False/g, 'false')     //replace (Python/Ruby?) boolean to JSON boolean < shouldnt be required
                    .replace(/None/g, 'null');       //replace (Python/Ruby?) None to String < shouldnt be required

                var eventData = JSON.parse(cleanedData);
                // var eventData = JSON.parse(event.data);
                var cloudEventData = eventData.cloudevent;

                if (typeof cloudEventData.data === 'object') {
                    if (Object.keys(cloudEventData.data).length == 1 && cloudEventData.data.hasOwnProperty('error')) {
                        hasError = "backend-error";
                    }
                }

            } catch (error) {
                // error = SyntaxError: Expected ',' or '}' after property value in JSON at position 334 at JSON.parse ...
                hasError = "parse-error";
                var result = {
                    "detail": [
                        {
                            "loc": ["event.data"],
                            "msg": "Event data is not valid JSON, maybe a JSON object encoded as a String, or including single or double quotes somewhere?",
                            "type": "JSON.parse"
                        }
                    ]
                }
                toastController.showToast(result);
                var eventData = event.data.replace(/'/g, "\"").replace(/\\\"/g, '"');
                // Assuming .data is the last attribute in the event... (!!! quite a significant assumption!!)
                // Removing anything after `, "data"` and adding `}}` should make it parsable
                var strippedEventData = eventData.substring(0, eventData.indexOf(", \"data\"")) + "}}";
                // Capturing the raw data
                var eventDataStr = eventData.substring(eventData.indexOf(", \"data\""));
                eventData = JSON.parse(strippedEventData);
                var cloudEventData = eventData.cloudevent;
                // cloudEventData.data = result;
                // Adding the raw string back as "data"
                cloudEventData.data = eventDataStr.substring(9);
            }
            const uuid = uuidv4();
            var accordionData = {
                eventCount: sseConnection.getCount(),
                timestamp: cloudEventData.time,
                hasError: hasError,
                eventSource: cloudEventData.source,
                eventSubject: cloudEventData.subject,
                eventType: cloudEventData.type,
                eventData: cloudEventData,
                eventId: uuid
            };

            // Add event values to filter dropdowns
            filterController.addEventValues(cloudEventData);

            // Store event in storage manager (both tiers)
            if (eventStorageManager) {
                eventStorageManager.addEvent(cloudEventData).catch(err => {
                    console.error('[Events] Failed to store event:', err);
                });
            }

            // Check if event matches active filters
            if (!filterController.matchesFilters(cloudEventData)) {
                console.log('[Events] Event filtered out:', cloudEventData.type);
                return; // Don't display this event
            }

            const item = createAccordionItem(accordionData);
            eventsStack.prepend(item);
        }
    };

    const handleSseEvent = (event) => {
        console.log(event);
        incrementEventsCount();
        connectionStatus.updateStatus("cleartimer");
        connectionStatus.updateStatus("connect");
        handleNewEvent(event);
        connectionStatus.updateStatus("newtimer");

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

            // Get URL parameters for filtering
            const urlParams = new URLSearchParams(window.location.search);
            const startTime = urlParams.get('startTime') ? parseInt(urlParams.get('startTime')) : null;
            const endTime = urlParams.get('endTime') ? parseInt(urlParams.get('endTime')) : null;
            const typeFilter = urlParams.get('type') || null;
            const sourceFilter = urlParams.get('source') || null;
            const subjectFilter = urlParams.has('subject') ? urlParams.get('subject') : null;

            // Get time range from selector if not from URL
            let timeRangeStart = startTime;
            let timeRangeEnd = endTime;

            if (!startTime && !endTime && timeRangeSelect && timeRangeSelect.value !== 'all') {
                const minutes = parseInt(timeRangeSelect.value);
                const now = Date.now();
                timeRangeEnd = now;
                timeRangeStart = now - (minutes * 60 * 1000);
                console.log('[Events] Applying time range from selector:', {
                    minutes,
                    start: new Date(timeRangeStart).toISOString(),
                    end: new Date(timeRangeEnd).toISOString()
                });
            }

            let events = await eventStorageManager.getRecentEvents({ limit: maxQueueSize });

            console.log('[Events] getRecentEvents returned:', events ? events.length : 'null/undefined', 'events');

            // Apply filters from URL parameters or time range selector
            if (events && (timeRangeStart || timeRangeEnd || typeFilter || sourceFilter || subjectFilter !== null)) {
                console.log('[Events] Applying filters:', { startTime: timeRangeStart, endTime: timeRangeEnd, typeFilter, sourceFilter, subjectFilter });

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
                            inRange: (!timeRangeStart || eventTimestamp >= timeRangeStart) && (!timeRangeEnd || eventTimestamp < timeRangeEnd)
                        });

                        if (timeRangeStart && eventTimestamp < timeRangeStart) return false;
                        if (timeRangeEnd && eventTimestamp >= timeRangeEnd) return false;
                    }

                    // Type filter (from URL or dropdown)
                    const activeTypeFilter = typeFilter || activeFilters.type;
                    if (activeTypeFilter && event.type !== activeTypeFilter) {
                        console.log('[Events] Filtering out by type:', event.type, '!==', activeTypeFilter);
                        return false;
                    }

                    // Source filter (from URL or dropdown)
                    const activeSourceFilter = sourceFilter || activeFilters.source;
                    if (activeSourceFilter && event.source !== activeSourceFilter) {
                        console.log('[Events] Filtering out by source:', event.source, '!==', activeSourceFilter);
                        return false;
                    }

                    // Subject filter (from URL or dropdown)
                    const activeSubjectFilter = subjectFilter !== null ? subjectFilter : activeFilters.subject;
                    if (activeSubjectFilter !== null && event.subject !== activeSubjectFilter) {
                        console.log('[Events] Filtering out by subject:', event.subject, '!==', activeSubjectFilter);
                        return false;
                    }

                    return true;
                });

                console.log('[Events] After filtering:', events.length, 'events');

                // Show filter info banner (use original URL params for display)
                showFilterBanner({ startTime, endTime, typeFilter, sourceFilter, subjectFilter });
            }

            if (events && events.length > 0) {
                console.log(`[Events] Loaded ${events.length} events from storage`);

                // Clear current display
                eventsStack.innerHTML = '';
                resetEventsCount();

                // Render events in reverse order (oldest first, so newest ends up on top)
                events.reverse().forEach(cloudEventData => {
                    const uuid = uuidv4();
                    const accordionData = {
                        eventCount: sseConnection.getCount(),
                        timestamp: cloudEventData.time,
                        hasError: 'none',
                        eventSource: cloudEventData.source,
                        eventSubject: cloudEventData.subject,
                        eventType: cloudEventData.type,
                        eventData: cloudEventData,
                        eventId: uuid
                    };

                    incrementEventsCount();
                    const item = createAccordionItem(accordionData);
                    eventsStack.prepend(item);
                });

                console.log(`[Events] Displayed ${events.length} events`);
            } else {
                console.log('[Events] No events found in storage (events array empty or null)');
            }
        } catch (error) {
            console.error('[Events] Failed to load events from storage:', error);
        }
    };

    const init = (queueSize, storageManager) => {
        maxQueueSize = parseInt(queueSize);
        eventStorageManager = storageManager; // Store reference to storage manager

        // Initialize time range selector
        timeRangeSelect = document.getElementById('eventTimeRange');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', () => {
                console.log('[Events] Time range changed:', timeRangeSelect.value);
                loadEventsFromStorage();
            });
        }

        // Wait for storage to initialize, then load events, then setup SSE
        const setupSequence = async () => {
            try {
                // Ensure storage is initialized
                if (eventStorageManager && !eventStorageManager.initialized) {
                    await eventStorageManager.init();
                }

                // Load existing events from storage (this will set the counter correctly)
                await loadEventsFromStorage();

                // Initialize filter controller
                await filterController.init({
                    storageManager: eventStorageManager,
                    selectors: {
                        type: 'eventTypeFilter',
                        source: 'eventSourceFilter',
                        subject: 'eventSubjectFilter',
                        clear: 'clearFiltersBtn'
                    },
                    onFilterChange: (filters) => {
                        console.log('[Events] Filters changed:', filters);
                        activeFilters = filters;
                        // Reload events with new filters
                        loadEventsFromStorage();
                    }
                });

                // Now initialize SSE connection with the current counter value
                // (which reflects filtered events if filters are active)
                const currentCount = sseConnection.getCount();
                console.log('[Events] Initializing SSE with counter:', currentCount);

                // Initialize connection status manager
                connectionStatus.init();

                sseConnection.init({
                    initialCount: currentCount,
                    onMessage: (event) => {
                        connectionStatus.updateStatus("connect");
                        handleSseEvent(event);
                    },
                    onOpen: () => {
                        connectionStatus.updateStatus("open");
                    },
                    onError: (error) => {
                        connectionStatus.updateStatus("error");
                    }
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
    };

    return {
        init,
        resetEventsCount,
        loadEventsFromStorage  // Expose for manual refresh
    }

})();
