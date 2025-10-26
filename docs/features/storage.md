# Client-Side Storage

Two-tier storage system for optimal performance and persistence.

## Architecture Overview

CloudEvent Player uses a sophisticated two-tier storage architecture that balances performance with persistence:

1. **IndexedDB** - Persistent storage that survives browser restarts
2. **In-Memory Cache** - Fast access for real-time operations

This dual approach provides:

- **Fast access** for current operations (memory)
- **Persistence** for long-term storage (IndexedDB)
- **Offline capability** for viewing historical events
- **Reduced server load** with local caching

## IndexedDB (Persistent Storage)

### Purpose

Long-term event storage that survives browser restarts and page refreshes.

### Characteristics

**Persistence**:

- Stores events indefinitely (until manually cleared)
- Survives browser restarts
- Survives page refreshes
- Survives browser crashes (data recovery)

**Capacity**:

- Larger storage capacity (~50MB typical, browser-dependent)
- Can store thousands of events
- Automatic quota management

**Performance**:

- Slightly slower than memory (milliseconds vs microseconds)
- Async operations don't block UI
- Indexed for fast queries

### Implementation Details

**Database Configuration**:

- **Database name**: `CloudEventPlayerDB`
- **Object store**: `events`
- **Schema version**: 1

**Indexes**:

- `id` - Primary key (CloudEvent ID)
- `type` - Event type for filtering
- `source` - Event source for filtering
- `time` - Event timestamp for time-based queries

**Data Structure**:

```javascript
{
  id: "uuid-here",
  specversion: "1.0",
  type: "com.example.event",
  source: "example-service",
  subject: "example-subject",
  time: "2025-10-26T12:34:56.789Z",
  datacontenttype: "application/json",
  data: { /* event payload */ },
  // Metadata
  receivedAt: "2025-10-26T12:34:56.790Z"
}
```

### Operations

**Write** - New events saved to IndexedDB:

```javascript
// Add single event
await storageManager.addEvent(event);

// Bulk add events
await storageManager.addEvents(eventArray);
```

**Read** - Load events from IndexedDB:

```javascript
// Get all events
const events = await storageManager.getAllEvents();

// Get events by type
const orderEvents = await storageManager.getEventsByType(
  "com.example.order.created"
);

// Get events by time range
const recentEvents = await storageManager.getEventsByTimeRange(
  startTime,
  endTime
);
```

**Delete** - Remove events:

```javascript
// Delete single event
await storageManager.deleteEvent(eventId);

// Clear all events (admin only)
await storageManager.clearAll();
```

**Query** - Filter events using indexes:

```javascript
// Fast queries using indexes
const events = await storageManager.queryEvents({
  type: "com.example.order.created",
  source: "order-service",
  timeRange: { start: yesterday, end: now },
});
```

## In-Memory Cache (Session Storage)

### Purpose

Fast access to current session events for real-time operations.

### Characteristics

**Performance**:

- Extremely fast read/write (microseconds)
- Synchronous operations
- No I/O overhead
- Direct JavaScript array access

**Lifecycle**:

- Cleared on page refresh
- Limited by available RAM
- Managed by JavaScript garbage collector

**Capacity**:

- RAM-limited (typically thousands of events feasible)
- Automatically managed by browser
- No explicit size limits

### Implementation Details

**Data Structure**:

```javascript
// Simple JavaScript array
const eventCache = [
  { id: "event-1", type: "..." /* full event */ },
  { id: "event-2", type: "..." /* full event */ },
  // ...
];
```

**Operations**:

- **Add**: `eventCache.push(newEvent)`
- **Read**: `eventCache.filter(filterFn)`
- **Clear**: `eventCache.length = 0`

**Synchronization**:

- Synchronized with IndexedDB
- Filtered views project from this cache
- Reset on page reload

## Storage Flow

### Incoming Events

When a new event arrives via SSE:

```text
1. SSE Message Received
   ↓
2. Parse JSON
   ↓
3. Add to In-Memory Cache (immediate)
   ↓
4. Filter and Display in UI (if matches filters)
   ↓
5. Save to IndexedDB (async, non-blocking)
   ↓
6. Notify State Subscribers
```

**Benefits of this flow**:

- UI updates immediately (memory)
- Persistence happens in background (IndexedDB)
- No blocking or performance impact
- Data loss protection (persisted quickly)

### Page Load

When the page loads:

```text
1. Page Loads
   ↓
2. Initialize Storage Manager
   ↓
3. Load Events from IndexedDB
   ↓
4. Populate In-Memory Cache
   ↓
5. Apply Current Filters
   ↓
6. Render in Current View
   ↓
7. Connect to SSE Stream
   ↓
8. Ready for New Events
```

**Benefits of this flow**:

- Quick initial load
- Historical events immediately available
- Seamless transition to real-time updates
- Offline viewing capability

## Storage Management

### Automatic Cleanup

**Quota Management**:

- Old events removed when storage quota exceeded
- Oldest events removed first (FIFO)
- Configurable retention policy (future feature)

**Triggers**:

- Storage quota warnings
- Configurable event count limits (future)
- Time-based retention (future)

**Process**:

```javascript
// Pseudo-code for automatic cleanup
if (storageQuotaExceeded()) {
  const oldEvents = await getOldestEvents(1000);
  await deleteEvents(oldEvents);
  notifyUser("Storage cleanup performed");
}
```

### Manual Cleanup

**User Controls**:

- All authenticated users can clear their own browser's local storage
- `Clear Storage` button in user dropdown menu
- Confirmation required before deletion
- Only affects the user's own browser storage

**How to Clear Storage**:

1. Click your **username** dropdown in navigation bar
2. Select **Clear Storage**
3. Confirm the action in modal
4. All events removed from both memory and IndexedDB in your browser

**What Gets Cleared**:

- ✅ All events in IndexedDB
- ✅ All events in memory cache
- ✅ Filter state reset
- ❌ SSE connection (continues running)
- ❌ Events on server (unaffected)

### Storage Statistics

View storage information in the UI:

**Displayed Stats**:

- **Total Events**: Number of events in storage
- **Storage Used**: Approximate MB used
- **Last Sync**: Last IndexedDB write timestamp
- **Cache Size**: In-memory event count

**Access Stats**:

- Displayed in footer or status bar
- Updated in real-time
- Admin-only detailed view (future)

## Storage Limits

### IndexedDB Limits

**Browser-Dependent**:

- **Chrome**: ~60% of available disk space (temporary storage)
- **Firefox**: ~50% of available disk space
- **Safari**: ~1GB typically
- **Edge**: Similar to Chrome

**Typical Capacity**:

- Small events (1KB): ~50,000-100,000 events
- Medium events (10KB): ~5,000-10,000 events
- Large events (100KB): ~500-1,000 events

### Memory Limits

**RAM-Limited**:

- Depends on available system memory
- Browser tab memory limits apply
- Thousands of small events feasible
- Hundreds of large events feasible

**Recommendations**:

- Clear storage periodically for long-running sessions
- Use time range filter to reduce active dataset
- Each user manages their own browser storage
- Monitor browser memory usage

## Best Practices

### For All Users

1. **Use Time Range Filter** - Reduce active dataset for better performance
2. **Clear Old Events** - Use "Clear Storage" option to free up browser space
3. **Close Unused Tabs** - Free up memory for active sessions
4. **Refresh Periodically** - If running 24/7, refresh occasionally

**Note**: Storage is client-side only. Each user's browser has independent storage.

### For Administrators

1. **Monitor System** - Check overall system health and usage patterns
2. **Manage Tasks** - Cancel long-running or stuck background tasks
3. **Plan Retention** - Decide data retention policies for your organization
4. **Communicate** - Educate users about clearing their own storage

**Note**: Admins manage tasks, not storage (storage is per-user/per-browser).

### For Developers

1. **Test with Large Datasets** - Verify performance with thousands of events
2. **Monitor Memory** - Use browser dev tools to check memory usage
3. **Optimize Queries** - Use IndexedDB indexes for filtering
4. **Implement Cleanup** - Add automatic cleanup logic if needed

## Troubleshooting

### Storage Quota Exceeded

**Symptom**: Error messages about storage quota

**Solution**:

1. Clear storage via user dropdown menu
2. Refresh the page
3. Reduce event generation rate
4. Use time range filter to limit dataset

### Events Not Persisting

**Symptom**: Events disappear after page refresh

**Solution**:

1. Check browser IndexedDB support (should be universal)
2. Check browser storage settings (ensure not in private mode)
3. Verify IndexedDB not disabled by browser extension
4. Check browser console for errors

### Slow Performance

**Symptom**: UI becomes sluggish with many events

**Solution**:

1. Clear your browser's storage using "Clear Storage" option
2. Use time range filter to reduce active dataset
3. Close other browser tabs to free memory
4. Restart browser if memory is exhausted

### Events Not Loading on Page Load

**Symptom**: Page loads but no historical events shown

**Solution**:

1. Check browser console for IndexedDB errors
2. Verify events were actually saved (check storage stats)
3. Try clearing storage and starting fresh
4. Check browser storage permissions

## Technical Details

### Storage Manager Singleton

The application uses a singleton pattern for storage management:

```javascript
class StorageManager {
  static instance = null;

  static getInstance() {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Storage operations...
}
```

**Benefits**:

- Single database connection
- Consistent state across app
- Efficient resource usage
- Easy to test and mock

### Error Handling

Storage operations include comprehensive error handling:

```javascript
try {
  await storageManager.addEvent(event);
} catch (error) {
  console.error("Failed to save event:", error);
  // Fallback: Keep in memory only
  // User notified via toast
}
```

**Error Scenarios**:

- Quota exceeded
- Browser crashes
- Permission denied
- Database corruption
- Network issues (shouldn't affect local storage)

## Future Enhancements

Planned storage improvements:

- **Configurable Retention** - Set event retention period
- **Storage Quotas** - Per-user or per-session limits
- **Compression** - Compress old events to save space
- **Export/Import** - Export events to file, import later
- **Sync Across Tabs** - Share storage between browser tabs
- **Cloud Backup** - Optional server-side backup (future)

## Next Steps

- [State Management](state-management.md) - Learn how storage integrates with state
- [Performance Optimization](performance.md) - Understand storage performance
- [Multiple Views](views.md) - See how views use storage
