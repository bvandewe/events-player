/**
 * EventStorageManager - Two-tier storage system for CloudEvents
 * 
 * Tier 1: IndexedDB for recent full events - capacity-based cleanup (FIFO queue)
 * Tier 2: IndexedDB for long-term metadata - capacity-based cleanup (FIFO queue)
 * 
 * Both tiers use capacity-based cleanup: oldest events removed when limit exceeded
 * 
 * SINGLETON: Only one instance should exist, shared across all views
 */
class EventStorageManager {
    // Singleton instance
    static instance = null;

    static getInstance(options = {}) {
        if (!EventStorageManager.instance) {
            EventStorageManager.instance = new EventStorageManager(options);
        }
        return EventStorageManager.instance;
    }

    constructor(options = {}) {
        // Prevent multiple instances
        if (EventStorageManager.instance) {
            return EventStorageManager.instance;
        }

        // Tier 1 configuration: IndexedDB full events (capacity-based)
        this.maxRecentEvents = options.maxRecentEvents || 5000;
        this.maxRecentAge = options.maxRecentAge || 1800000; // NOT USED - reserved for future

        // Tier 2 configuration: IndexedDB metadata (capacity-based)
        this.maxMetadataEvents = options.maxMetadataEvents || 100000;
        this.maxMetadataAge = options.maxMetadataAge || 86400000; // NOT USED - reserved for future

        // Tier 2: IndexedDB reference
        this.db = null;
        this.dbName = 'CloudEventsPlayer';
        this.dbVersion = 3; // Incremented for storedAt index
        this.initialized = false;
        this.initPromise = null; // Track initialization promise

        // In-memory cache of recent event IDs (for quick duplicate detection)
        this.recentEventIds = new Set();

        // Statistics
        this.stats = {
            totalReceived: 0,
            recentCount: 0,
            metadataCount: 0,
            oldestMetadata: null,
            newestMetadata: null,
            lastCleanup: null
        };

        // Cleanup interval (every 5 minutes)
        this.cleanupInterval = null;
        this.cleanupIntervalMs = 300000; // 5 minutes

        console.info('📦 EventStorage initialized', {
            maxRecentEvents: this.maxRecentEvents,
            maxMetadataEvents: this.maxMetadataEvents
        });

        EventStorageManager.instance = this;
    }

    /**
     * Initialize the storage manager (must be called before use)
     * Returns the same promise if already initializing to prevent double init
     */
    async init() {
        // If already initialized, return immediately
        if (this.initialized) {
            console.log('[EventStorage] Already initialized');
            return this;
        }

        // If initialization is in progress, return the existing promise
        if (this.initPromise) {
            console.log('[EventStorage] Initialization in progress, waiting...');
            return this.initPromise;
        }

        // Start initialization
        this.initPromise = (async () => {
            console.log('[EventStorage] Initializing...');
            await this.initIndexedDB();
            await this.loadStats();
            this.startCleanupInterval();
            this.initialized = true;
            console.log('[EventStorage] Ready. Stats:', this.stats);
            return this;
        })();

        return this.initPromise;
    }

    /**
     * Initialize IndexedDB for metadata storage
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('[EventStorage] IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[EventStorage] IndexedDB opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                console.log('[EventStorage] Upgrading IndexedDB schema...');
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                // Create recentEvents store for full events (Tier 1)
                if (!db.objectStoreNames.contains('recentEvents')) {
                    const recentStore = db.createObjectStore('recentEvents', { keyPath: 'id' });
                    recentStore.createIndex('timestamp', 'timestamp', { unique: false });
                    recentStore.createIndex('insertionOrder', 'insertionOrder', { unique: true });
                    recentStore.createIndex('storedAt', 'storedAt', { unique: false });
                    console.log('[EventStorage] Created recentEvents store');
                } else if (oldVersion < 3) {
                    // Add storedAt index to existing store
                    const transaction = event.target.transaction;
                    const recentStore = transaction.objectStore('recentEvents');
                    if (!recentStore.indexNames.contains('storedAt')) {
                        recentStore.createIndex('storedAt', 'storedAt', { unique: false });
                        console.log('[EventStorage] Added storedAt index to recentEvents');
                    }
                }

                // Create metadata store if it doesn't exist (Tier 2)
                if (!db.objectStoreNames.contains('metadata')) {
                    const metaStore = db.createObjectStore('metadata', { keyPath: 'id' });

                    // Create indexes for efficient querying
                    metaStore.createIndex('timestamp', 'timestamp', { unique: false });
                    metaStore.createIndex('type', 'type', { unique: false });
                    metaStore.createIndex('source', 'source', { unique: false });
                    metaStore.createIndex('subject', 'subject', { unique: false });

                    console.log('[EventStorage] Created metadata store with indexes');
                }
            };
        });
    }

    /**
     * Add a new event to both storage tiers
     */
    async addEvent(fullEvent) {
        // Ensure storage is initialized
        if (!this.initialized) {
            console.warn('[EventStorage] Not initialized yet, waiting...');
            await this.init();
        }

        if (!this.db) {
            console.error('[EventStorage] Database not available');
            return false;
        }

        try {
            if (!fullEvent || !fullEvent.id) {
                console.warn('[EventStorage] Ignoring event without id field', fullEvent);
                return false;
            }

            // Check for duplicates
            if (this.recentEventIds.has(fullEvent.id)) {
                console.log(`[EventStorage] Duplicate event ignored: ${fullEvent.id}`);
                return false;
            }

            let metadata;
            try {
                metadata = this.extractMetadata(fullEvent);
            } catch (metadataError) {
                console.warn('[EventStorage] Metadata extraction threw error, skipping event', {
                    error: metadataError,
                    event: fullEvent
                });
                return false;
            }

            if (!metadata) {
                console.warn('[EventStorage] Skipping event due to invalid metadata', fullEvent);
                return false;
            }

            // Increment totalReceived AFTER validation (so first valid event is #1)
            this.stats.totalReceived++;
            const sequenceNumber = this.stats.totalReceived;

            // Persist totalReceived every 10 events to reduce localStorage writes
            if (this.stats.totalReceived % 10 === 0) {
                this.persistStats();
            }

            // Add insertion order, storage timestamp, and sequence number for preserving sequence
            // Use metadata.timestamp which has timezone correction applied
            const timestamp = metadata.timestamp;
            const now = Date.now();
            const eventWithOrder = {
                ...fullEvent,
                timestamp: timestamp,              // Original event time (with timezone correction)
                storedAt: now,                     // When we stored it (for cleanup)
                insertionOrder: now + Math.random(), // Ensure uniqueness
                sequenceNumber: sequenceNumber     // Persistent sequence number across sessions
            };

            // Tier 1: Add full event to IndexedDB (persisted)
            console.log(`[EventStorage] Storing full event ${fullEvent.id} in recentEvents store`);
            await this.addRecentEvent(eventWithOrder);
            this.recentEventIds.add(fullEvent.id);
            console.log(`[EventStorage] Full event stored successfully`);

            // Tier 2: Add metadata to IndexedDB
            await this.addMetadata(metadata);

            // Cleanup if needed
            await this.cleanupRecentEvents();

            // Update stats
            await this.updateStats();

            return true;
        } catch (error) {
            console.error('[EventStorage] Error adding event:', error);
            return false;
        }
    }

    /**
     * Add full event to IndexedDB (Tier 1)
     */
    async addRecentEvent(event) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recentEvents'], 'readwrite');
            const store = transaction.objectStore('recentEvents');
            const request = store.put(event);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('[EventStorage] Error adding recent event:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Extract lightweight metadata from full event
     */
    extractMetadata(event) {
        const dataString = JSON.stringify(event.data || {});

        if (!event.time) {
            console.warn('[EventStorage] Event missing time field, cannot extract metadata', event);
            return null;
        }

        // Handle timezone: if timestamp doesn't end with Z, assume UTC
        let eventTime = event.time;
        if (eventTime && !eventTime.endsWith('Z') && !eventTime.includes('+') && !eventTime.includes('-', 10)) {
            // No timezone info, assume UTC by adding Z
            eventTime = eventTime + 'Z';
        }

        const timestamp = new Date(eventTime).getTime();

        if (Number.isNaN(timestamp)) {
            console.warn('[EventStorage] Unable to parse event timestamp', { eventTime, event });
            return null;
        }

        const isoTimestamp = new Date(timestamp).toISOString();

        console.log('[EventStorage] Extracting metadata:', {
            originalEventTime: event.time,
            correctedEventTime: eventTime,
            timestamp: timestamp,
            timestampDate: isoTimestamp,
            now: Date.now(),
            nowDate: new Date().toISOString()
        });

        return {
            id: event.id,
            timestamp: timestamp,
            type: event.type,
            source: event.source,
            subject: event.subject || '',
            dataLength: dataString.length,
            dataContentType: event.datacontenttype || 'application/json'
        };
    }

    /**
     * Cleanup Tier 1: capacity-based cleanup (FIFO queue)
     * Only deletes events if we exceed maxRecentEvents count
     */
    async cleanupRecentEvents() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recentEvents'], 'readwrite');
            const store = transaction.objectStore('recentEvents');

            // Count total events
            const countRequest = store.count();
            countRequest.onsuccess = async () => {
                const totalCount = countRequest.result;

                // Only cleanup if we exceed capacity
                if (totalCount > this.maxRecentEvents) {
                    const excess = totalCount - this.maxRecentEvents;
                    console.log(`[EventStorage] Over capacity (${totalCount}/${this.maxRecentEvents}), removing ${excess} oldest events`);
                    await this.deleteOldestRecentEvents(excess);
                    this.stats.recentCount = await this.countRecentEvents();
                    resolve(excess);
                } else {
                    // Under capacity, no cleanup needed
                    this.stats.recentCount = totalCount;
                    resolve(0);
                }
            };

            countRequest.onerror = () => {
                console.error('[EventStorage] Error counting events for cleanup:', countRequest.error);
                reject(countRequest.error);
            };
        });
    }

    /**
     * Delete oldest events by insertion order
     */
    async deleteOldestRecentEvents(count) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recentEvents'], 'readwrite');
            const store = transaction.objectStore('recentEvents');
            const index = store.index('insertionOrder');
            const request = index.openCursor();

            let deleted = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && deleted < count) {
                    this.recentEventIds.delete(cursor.value.id);
                    cursor.delete();
                    deleted++;
                    cursor.continue();
                } else {
                    if (deleted > 0) {
                        console.log(`[EventStorage] Deleted ${deleted} oldest events (over limit)`);
                    }
                    resolve(deleted);
                }
            };

            request.onerror = () => {
                console.error('[EventStorage] Error deleting oldest events:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Count recent events in IndexedDB
     */
    async countRecentEvents() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recentEvents'], 'readonly');
            const store = transaction.objectStore('recentEvents');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add metadata to IndexedDB (Tier 2)
     */
    async addMetadata(metadata) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            const request = store.put(metadata);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('[EventStorage] Error adding metadata:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Cleanup Tier 2: capacity-based cleanup for metadata
     * Only deletes metadata entries if we exceed maxMetadataEvents count
     */
    async cleanupMetadata() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');

            // Count total metadata entries
            const countRequest = store.count();
            countRequest.onsuccess = async () => {
                const totalCount = countRequest.result;

                // Only cleanup if we exceed capacity
                if (totalCount > this.maxMetadataEvents) {
                    const excess = totalCount - this.maxMetadataEvents;
                    console.log(`[EventStorage] Metadata over capacity (${totalCount}/${this.maxMetadataEvents}), removing ${excess} oldest entries`);
                    await this.deleteOldestMetadata(excess);
                    this.stats.metadataCount = await this.countMetadata();
                    this.stats.lastCleanup = new Date();
                    this.persistStats(); // Persist cleanup timestamp
                    resolve(excess);
                } else {
                    // Under capacity, no cleanup needed
                    this.stats.metadataCount = totalCount;
                    resolve(0);
                }
            };

            countRequest.onerror = () => {
                console.error('[EventStorage] Error counting metadata for cleanup:', countRequest.error);
                reject(countRequest.error);
            };
        });
    }

    /**
     * Delete oldest metadata entries by timestamp
     */
    async deleteOldestMetadata(count) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            const index = store.index('timestamp');
            const request = index.openCursor(); // Ascending order (oldest first)

            let deleted = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && deleted < count) {
                    cursor.delete();
                    deleted++;
                    cursor.continue();
                } else {
                    if (deleted > 0) {
                        console.log(`[EventStorage] Deleted ${deleted} oldest metadata entries (over limit)`);
                    }
                    resolve(deleted);
                }
            };

            request.onerror = () => {
                console.error('[EventStorage] Error deleting oldest metadata:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Count metadata entries in IndexedDB
     */
    async countMetadata() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                console.error('[EventStorage] Error counting metadata:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Start automatic cleanup interval
     */
    startCleanupInterval() {
        this.cleanupInterval = setInterval(async () => {
            console.log('[EventStorage] Running periodic cleanup...');
            this.cleanupRecentEvents();
            await this.cleanupMetadata();
            await this.loadStats();
        }, this.cleanupIntervalMs);
    }

    /**
     * Stop automatic cleanup interval
     */
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Query recent events (Tier 1) - for list display
     * Now loads from IndexedDB instead of memory
     */
    async getRecentEvents(filter = {}) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recentEvents'], 'readonly');
            const store = transaction.objectStore('recentEvents');
            const index = store.index('insertionOrder');
            const request = index.openCursor(null, 'prev'); // Reverse order (newest first)

            const events = [];
            const limit = filter.limit || this.maxRecentEvents;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && events.length < limit) {
                    const evt = cursor.value;

                    // Apply filters
                    let include = true;
                    if (filter.type && evt.type !== filter.type) include = false;
                    if (filter.source && evt.source !== filter.source) include = false;
                    if (filter.subject && evt.subject !== filter.subject) include = false;
                    if (filter.startTime && evt.timestamp < filter.startTime) include = false;
                    if (filter.endTime && evt.timestamp > filter.endTime) include = false;

                    if (include) {
                        events.push(evt);
                    }

                    cursor.continue();
                } else {
                    resolve(events);
                }
            };

            request.onerror = () => {
                console.error('[EventStorage] Error querying recent events:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get event by ID (check recent events)
     */
    async getEventById(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recentEvents'], 'readonly');
            const store = transaction.objectStore('recentEvents');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => {
                console.error('[EventStorage] Error getting event by ID:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Query metadata (Tier 2) - for visualizations
     */
    async queryMetadata(options = {}) {
        const { startTime, endTime, type, source, subject, limit } = options;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const index = store.index('timestamp');

            // Create time range
            let range;
            if (startTime && endTime) {
                range = IDBKeyRange.bound(startTime, endTime);
            } else if (startTime) {
                range = IDBKeyRange.lowerBound(startTime);
            } else if (endTime) {
                range = IDBKeyRange.upperBound(endTime);
            }

            const request = range ? index.openCursor(range) : index.openCursor();
            const results = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const metadata = cursor.value;

                    // Apply filters
                    let match = true;
                    if (type && metadata.type !== type) match = false;
                    if (source && metadata.source !== source) match = false;
                    if (subject !== undefined && metadata.subject !== subject) match = false;

                    if (match) {
                        results.push(metadata);
                        if (limit && results.length >= limit) {
                            resolve(results);
                            return;
                        }
                    }

                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => {
                console.error('[EventStorage] Error querying metadata:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get aggregated statistics for visualizations
     * @param {number} bucketSize - Bucket size in milliseconds (e.g., 60000 for 1 minute)
     * @param {number} startTime - Optional start time filter
     * @param {number} endTime - Optional end time filter
     */
    async getAggregatedStats(bucketSize = 60000, startTime = null, endTime = null) {
        const metadata = await this.queryMetadata({ startTime, endTime });

        // Create time buckets
        const buckets = new Map();

        metadata.forEach(m => {
            const bucketKey = Math.floor(m.timestamp / bucketSize) * bucketSize;

            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, {
                    timestamp: bucketKey,
                    count: 0,
                    types: new Map(),
                    sources: new Map(),
                    subjects: new Map(),
                    totalDataSize: 0
                });
            }

            const bucket = buckets.get(bucketKey);
            bucket.count++;
            bucket.types.set(m.type, (bucket.types.get(m.type) || 0) + 1);
            bucket.sources.set(m.source, (bucket.sources.get(m.source) || 0) + 1);
            if (m.subject) {
                bucket.subjects.set(m.subject, (bucket.subjects.get(m.subject) || 0) + 1);
            }
            bucket.totalDataSize += m.dataLength;
        });

        // Convert Maps to objects and sort by timestamp
        const result = Array.from(buckets.values()).map(bucket => ({
            timestamp: bucket.timestamp,
            count: bucket.count,
            types: Object.fromEntries(bucket.types),
            sources: Object.fromEntries(bucket.sources),
            subjects: Object.fromEntries(bucket.subjects),
            totalDataSize: bucket.totalDataSize,
            avgDataSize: Math.round(bucket.totalDataSize / bucket.count)
        })).sort((a, b) => a.timestamp - b.timestamp);

        return result;
    }

    /**
     * Get unique values for a field (for filter dropdowns)
     */
    async getUniqueValues(field) {
        if (!['type', 'source', 'subject'].includes(field)) {
            throw new Error(`Invalid field: ${field}`);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const index = store.index(field);
            const request = index.openKeyCursor(null, 'nextunique');

            const values = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.key) { // Skip empty values
                        values.push(cursor.key);
                    }
                    cursor.continue();
                } else {
                    resolve(values.sort());
                }
            };

            request.onerror = () => {
                console.error('[EventStorage] Error getting unique values:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Load and update statistics
     */
    async loadStats() {
        return new Promise((resolve, reject) => {
            // Load persisted stats from localStorage
            try {
                const persistedStats = localStorage.getItem('eventStorageStats');
                if (persistedStats) {
                    const parsed = JSON.parse(persistedStats);
                    this.stats.totalReceived = parsed.totalReceived || 0;
                    this.stats.lastCleanup = parsed.lastCleanup ? new Date(parsed.lastCleanup) : null;
                    console.log('[EventStorage] Loaded persisted stats from localStorage:', {
                        totalReceived: this.stats.totalReceived,
                        lastCleanup: this.stats.lastCleanup
                    });
                }
            } catch (err) {
                console.warn('[EventStorage] Failed to load persisted stats from localStorage:', err);
            }

            // Create a single transaction that accesses both stores
            const transaction = this.db.transaction(['metadata', 'recentEvents'], 'readonly');
            const metadataStore = transaction.objectStore('metadata');
            const recentStore = transaction.objectStore('recentEvents');

            // Get metadata count
            const metadataCountRequest = metadataStore.count();

            // Get recent events count
            const recentCountRequest = recentStore.count();

            let metadataCount = 0;
            let recentCount = 0;
            let countsLoaded = 0;

            const checkComplete = () => {
                countsLoaded++;
                if (countsLoaded === 2) {
                    this.stats.metadataCount = metadataCount;
                    this.stats.recentCount = recentCount;

                    // Get oldest and newest metadata timestamps
                    const index = metadataStore.index('timestamp');

                    const oldestRequest = index.openCursor(null, 'next');
                    oldestRequest.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) {
                            this.stats.oldestMetadata = new Date(cursor.value.timestamp);
                        } else {
                            this.stats.oldestMetadata = null;
                        }

                        const newestRequest = index.openCursor(null, 'prev');
                        newestRequest.onsuccess = (e2) => {
                            const cursor2 = e2.target.result;
                            if (cursor2) {
                                this.stats.newestMetadata = new Date(cursor2.value.timestamp);
                            } else {
                                this.stats.newestMetadata = null;
                            }
                            resolve(this.stats);
                        };

                        newestRequest.onerror = () => {
                            console.error('[EventStorage] Error getting newest metadata:', newestRequest.error);
                            reject(newestRequest.error);
                        };
                    };

                    oldestRequest.onerror = () => {
                        console.error('[EventStorage] Error getting oldest metadata:', oldestRequest.error);
                        reject(oldestRequest.error);
                    };
                }
            };

            metadataCountRequest.onsuccess = () => {
                metadataCount = metadataCountRequest.result;
                checkComplete();
            };

            metadataCountRequest.onerror = () => {
                console.error('[EventStorage] Error loading metadata stats:', metadataCountRequest.error);
                reject(metadataCountRequest.error);
            };

            recentCountRequest.onsuccess = () => {
                recentCount = recentCountRequest.result;
                checkComplete();
            };

            recentCountRequest.onerror = () => {
                console.error('[EventStorage] Error counting recent events:', recentCountRequest.error);
                reject(recentCountRequest.error);
            };

            transaction.onerror = () => {
                console.error('[EventStorage] Transaction error:', transaction.error);
                reject(transaction.error);
            };
        });
    }

    /**
     * Update in-memory stats
     */
    async updateStats() {
        try {
            this.stats.recentCount = await this.countRecentEvents();
        } catch (error) {
            console.error('[EventStorage] Error updating stats:', error);
        }
    }

    /**
     * Persist important stats to localStorage
     */
    persistStats() {
        try {
            const toPersist = {
                totalReceived: this.stats.totalReceived,
                lastCleanup: this.stats.lastCleanup ? this.stats.lastCleanup.toISOString() : null
            };
            localStorage.setItem('eventStorageStats', JSON.stringify(toPersist));
        } catch (err) {
            console.warn('[EventStorage] Failed to persist stats to localStorage:', err);
        }
    }

    /**
     * Get current statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Clear all data (for testing/reset)
     */
    async clearAll() {
        console.log('[EventStorage] Clearing all data...');

        // Clear in-memory Tier 1
        this.recentEvents = [];

        // Clear both IndexedDB stores
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recentEvents', 'metadata'], 'readwrite');
            const recentEventsStore = transaction.objectStore('recentEvents');
            const metadataStore = transaction.objectStore('metadata');

            const clearRecentEvents = recentEventsStore.clear();
            const clearMetadata = metadataStore.clear();

            let recentEventsCleared = false;
            let metadataCleared = false;

            const checkComplete = () => {
                if (recentEventsCleared && metadataCleared) {
                    this.stats = {
                        totalReceived: 0,
                        recentCount: 0,
                        metadataCount: 0,
                        oldestMetadata: null,
                        newestMetadata: null,
                        lastCleanup: null
                    };
                    // Clear persisted stats from localStorage
                    this.persistStats();
                    console.log('[EventStorage] All data cleared (recentEvents and metadata)');
                    resolve();
                }
            };

            clearRecentEvents.onsuccess = () => {
                console.log('[EventStorage] Recent events store cleared');
                recentEventsCleared = true;
                checkComplete();
            };

            clearMetadata.onsuccess = () => {
                console.log('[EventStorage] Metadata store cleared');
                metadataCleared = true;
                checkComplete();
            };

            clearRecentEvents.onerror = () => {
                console.error('[EventStorage] Error clearing recent events:', clearRecentEvents.error);
                reject(clearRecentEvents.error);
            };

            clearMetadata.onerror = () => {
                console.error('[EventStorage] Error clearing metadata:', clearMetadata.error);
                reject(clearMetadata.error);
            };
        });
    }

    /**
     * Export metadata for backup/analysis
     */
    async exportMetadata() {
        const all = await this.queryMetadata({});
        return {
            exportDate: new Date().toISOString(),
            stats: this.getStats(),
            metadata: all
        };
    }

    /**
     * Cleanup and close database
     */
    async destroy() {
        console.log('[EventStorage] Destroying storage manager...');
        this.stopCleanupInterval();
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

export default EventStorageManager;
