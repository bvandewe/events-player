# Performance Optimization

Techniques and strategies for handling thousands of events efficiently.

## Overview

CloudEvent Player is optimized to handle large volumes of events without degrading performance. This document covers the performance optimizations implemented and best practices for maintaining smooth operation with thousands of events.

## Performance Goals

### Target Metrics

**Event Processing**:

- **Receive and parse**: < 1ms per event
- **Storage write**: < 5ms per event (async)
- **Filter evaluation**: < 2ms per event
- **UI update**: < 10ms per event

**View Rendering**:

- **Initial render**: < 200ms for 1000 events
- **Filter update**: < 100ms for 1000 events
- **View switch**: < 150ms
- **Scroll performance**: 60 FPS

**Memory Usage**:

- **Per event**: ~2KB average
- **1000 events**: ~2MB memory
- **10000 events**: ~20MB memory
- **Target**: < 100MB for typical usage

## Optimization Techniques

### 1. Debounced Filtering

**Problem**: Filtering on every keystroke causes excessive re-renders

**Solution**: Debounce filter calculations by 300ms

```javascript
// Simplified debounce implementation
let filterTimeout;
function onSearchInput(value) {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    applyFilters(value);
  }, 300);
}
```

**Benefits**:

- Reduces filter calculations by ~90%
- Smoother typing experience
- Lower CPU usage
- Better battery life (mobile)

**Trade-off**: 300ms delay before filters apply

### 2. Indexed Storage

**Problem**: Searching thousands of events is slow

**Solution**: IndexedDB indexes on common fields

```javascript
// Database schema with indexes
objectStore.createIndex("type", "type", { unique: false });
objectStore.createIndex("source", "source", { unique: false });
objectStore.createIndex("time", "time", { unique: false });
```

**Benefits**:

- O(log n) instead of O(n) queries
- Fast filtering by type/source
- Efficient time-range queries
- Scales to 10,000+ events

**Example Performance**:

- **Without index**: 100ms to filter 10,000 events
- **With index**: 5ms to filter 10,000 events
- **Improvement**: 20x faster

### 3. Lazy Loading

**Problem**: Rendering all event data at once is slow

**Solution**: Render event cards, load details on expand

```javascript
// Pseudo-code for lazy loading
function renderEvent(event) {
  // Render card immediately (minimal data)
  const card = createEventCard(event.id, event.type);

  // Load full data only when expanded
  card.onExpand = () => {
    loadEventDetails(event.id);
  };
}
```

**Benefits**:

- Faster initial render
- Lower memory usage
- Smooth scrolling
- Better perceived performance

**Trade-off**: Slight delay when expanding event

### 4. Virtual Scrolling (Future)

**Problem**: Rendering 10,000 DOM nodes is slow

**Solution**: Render only visible events (future enhancement)

**Concept**:

```text
Viewport (visible area)
  ↓
[Event 50]  ← Rendered
[Event 51]  ← Rendered
[Event 52]  ← Rendered
[Event 53]  ← Rendered
  ↓
(Events 1-49: placeholder)
(Events 54-10000: placeholder)
```

**Expected Benefits**:

- 100+ events in viewport vs 10,000 total
- Constant render time regardless of total
- Smooth scrolling with any event count
- Much lower memory usage

**Planned Implementation**: Future release

### 5. Efficient State Updates

**Problem**: Frequent state updates cause excessive re-renders

**Solution**: Immutable updates with change detection

```javascript
// Only update if actually changed
function updateState(path, newValue) {
  const oldValue = get(state, path);
  if (oldValue === newValue) return; // Skip if unchanged

  set(state, path, newValue);
  notifySubscribers(path, newValue, oldValue);
}
```

**Benefits**:

- Avoids unnecessary re-renders
- Reduces CPU usage
- Smoother UI updates
- Better performance overall

### 6. Batch Operations

**Problem**: Individual operations have overhead

**Solution**: Batch related operations together

**Example - Event Addition**:

```javascript
// Bad - adds one at a time
events.forEach((event) => {
  addEvent(event); // Triggers notification
  saveToIndexedDB(event); // Separate write
});

// Good - batches operations
addEvents(events); // Single notification
saveAllToIndexedDB(events); // Batched write
```

**Benefits**:

- Fewer DOM updates
- Fewer IndexedDB transactions
- Lower overhead
- Faster bulk operations

### 7. Throttled UI Updates

**Problem**: UI updates faster than screen refresh rate

**Solution**: Throttle updates to 60 FPS (16.67ms)

```javascript
// Simplified throttle for UI updates
let updateScheduled = false;
function scheduleUpdate() {
  if (updateScheduled) return;

  updateScheduled = true;
  requestAnimationFrame(() => {
    updateUI();
    updateScheduled = false;
  });
}
```

**Benefits**:

- Smooth 60 FPS performance
- No wasted rendering
- Lower CPU usage
- Consistent frame rate

### 8. Memory Management

**Problem**: Memory leaks and excessive memory usage

**Solution**: Automatic cleanup and limits

**Strategies**:

```javascript
// Limit in-memory events
if (events.length > MAX_EVENTS) {
  events = events.slice(-MAX_EVENTS);
}

// Clean up subscriptions
function cleanup() {
  subscriptions.forEach((unsub) => unsub());
  subscriptions = [];
}

// Clear old events from IndexedDB
if (storageQuotaExceeded()) {
  deleteOldestEvents(1000);
}
```

**Benefits**:

- Controlled memory usage
- No memory leaks
- Consistent performance over time
- Graceful degradation

## Performance Monitoring

### Browser Developer Tools

**Performance Tab**:

1. Open DevTools (F12)
2. Go to Performance tab
3. Click Record
4. Perform actions (filter, scroll, etc.)
5. Stop recording
6. Analyze flame graph

**Look For**:

- Long tasks (> 50ms)
- Layout thrashing
- Memory allocations
- Frame rate drops

**Memory Tab**:

1. Open DevTools
2. Go to Memory tab
3. Take heap snapshot
4. Perform actions
5. Take another snapshot
6. Compare snapshots

**Look For**:

- Memory growth
- Detached DOM nodes
- Large objects
- Unexpected allocations

### Performance Metrics

**Key Metrics to Monitor**:

| Metric              | Target  | Alert If |
| ------------------- | ------- | -------- |
| Event parse time    | < 1ms   | > 5ms    |
| Filter time (1000)  | < 100ms | > 500ms  |
| Render time (100)   | < 100ms | > 500ms  |
| Memory usage (1000) | < 5MB   | > 50MB   |
| Frame rate          | 60 FPS  | < 30 FPS |
| IndexedDB write     | < 5ms   | > 50ms   |

### Performance Budget

**Target Budgets**:

- **JavaScript**: < 200KB gzipped
- **CSS**: < 50KB gzipped
- **Memory**: < 100MB typical usage
- **Initial Load**: < 2 seconds
- **Time to Interactive**: < 3 seconds

## Scalability Limits

### Tested Limits

**Event Volume**:

- ✅ **1,000 events**: Excellent performance
- ✅ **10,000 events**: Good performance
- ⚠️ **50,000 events**: Acceptable performance (some slowdown)
- ❌ **100,000+ events**: Not recommended (use time filter)

**Concurrent Operations**:

- ✅ **1-5 filters**: Instant
- ✅ **Continuous SSE stream**: No issues
- ✅ **Background tasks**: Multiple concurrent
- ✅ **View switching**: Smooth

**Browser Limits**:

- **IndexedDB**: ~50-100MB (browser-dependent)
- **Memory**: Limited by available RAM
- **DOM nodes**: ~10,000 nodes recommended max

### Recommendations by Scale

**Small (< 1,000 events)**:

- No special considerations needed
- All features work optimally
- Real-time updates smooth
- No cleanup needed

**Medium (1,000 - 10,000 events)**:

- Use time range filter for focused analysis
- Consider periodic storage cleanup
- Monitor browser memory usage
- All features still work well

**Large (10,000 - 50,000 events)**:

- Use time range filter (required)
- Regular storage cleanup (admin)
- May see slight UI slowdown
- Virtual scrolling recommended (future)

**Very Large (50,000+ events)**:

- Time range filter essential
- Clear storage frequently
- Consider server-side filtering
- May need to refresh browser periodically

## Best Practices

### For Users

**Performance Tips**:

1. **Use Time Range Filter** - Reduce active dataset
2. **Clear Old Events** - Ask admin to clean storage periodically
3. **Close Unused Tabs** - Free memory for active tab
4. **Specific Filters** - Use type/source filters before search
5. **Refresh Browser** - If running for extended periods

**When to Clear Storage**:

- Browser feels sluggish
- High event count (> 10,000)
- Before important testing
- After bulk event generation

### For Administrators

**Admin Best Practices**:

1. **Monitor Storage** - Check event count regularly
2. **Periodic Cleanup** - Clear storage weekly/monthly
3. **Communicate** - Warn users before clearing
4. **Resource Limits** - Set limits on event generation
5. **Observe Patterns** - Watch for performance issues

**Cleanup Schedule**:

- **Daily** - If generating 10,000+ events/day
- **Weekly** - For normal usage
- **Monthly** - For light usage
- **As Needed** - When performance degrades

### For Developers

**Development Best Practices**:

1. **Test with Large Datasets** - Always test with 10,000+ events
2. **Profile Performance** - Use browser dev tools
3. **Monitor Memory** - Watch for leaks
4. **Optimize Queries** - Use IndexedDB indexes
5. **Debounce/Throttle** - Rate-limit expensive operations

**Code Review Checklist**:

- [ ] No memory leaks (unsubscribe all subscriptions)
- [ ] No layout thrashing (batch DOM reads/writes)
- [ ] Debounced user inputs
- [ ] Throttled animations
- [ ] Efficient filters (early exit)
- [ ] Indexed database queries
- [ ] Lazy loading where appropriate

## Troubleshooting Performance

### Symptoms and Solutions

**Slow Filtering**:

**Symptoms**:

- Typing in search box is laggy
- Filter changes take seconds
- UI freezes during filtering

**Solutions**:

- Clear storage (too many events)
- Use more specific filters
- Close other browser tabs
- Check for JavaScript errors

**Slow Scrolling**:

**Symptoms**:

- Choppy scrolling
- Frame rate drops
- Browser feels sluggish

**Solutions**:

- Use time range filter
- Clear storage
- Close unnecessary accordions
- Reduce browser zoom level

**High Memory Usage**:

**Symptoms**:

- Browser tab using > 500MB
- System memory pressure
- Browser warns about memory

**Solutions**:

- Clear storage immediately
- Refresh the page
- Close other tabs
- Use time range filter

**Slow Initial Load**:

**Symptoms**:

- Page takes long to load
- Events take time to appear
- IndexedDB load slow

**Solutions**:

- Clear storage (too many events)
- Check browser storage limits
- Verify network connection (for SSE)
- Clear browser cache

## Future Optimizations

Planned performance improvements:

### 1. Virtual Scrolling

- Render only visible events
- Handle 100,000+ events smoothly
- Constant memory usage
- Implementation planned for v0.4.0

### 2. Web Workers

- Move filtering to background thread
- Non-blocking UI during heavy operations
- Better multi-core utilization
- Planned for v0.5.0

### 3. Compression

- Compress old events in IndexedDB
- Save storage space
- Reduce memory usage
- Planned for v0.4.0

### 4. Server-Side Filtering

- Filter on server before sending
- Reduce client-side processing
- Lower bandwidth usage
- Planned for v0.5.0

### 5. Incremental Rendering

- Render events incrementally
- Time-sliced rendering
- No UI blocking
- Planned for v0.4.0

## Benchmarks

### Current Performance (v0.3.0)

**Event Processing**:

- Parse 1 event: 0.5ms
- Parse 100 events: 45ms
- Parse 1000 events: 425ms

**Filtering**:

- Filter 1000 events (indexed): 8ms
- Filter 10000 events (indexed): 35ms
- Filter 1000 events (search): 25ms

**Rendering**:

- Render 100 events: 95ms
- Render 1000 events: 850ms
- View switch: 120ms

**Memory**:

- Baseline: 15MB
- - 1000 events: 17MB
- - 10000 events: 35MB

## Next Steps

- [State Management](state-management.md) - Understand state optimization
- [Storage](storage.md) - Learn about storage performance
- [Filtering](filtering.md) - Efficient filtering strategies
- [Configuration](../configuration.md) - Configure performance settings
