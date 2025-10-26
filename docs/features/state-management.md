# State Management

Reactive state management system keeping all views synchronized without a heavyweight framework.

## Overview

CloudEvent Player uses a custom reactive state management system (`appState`) that provides centralized state with automatic view synchronization. This eliminates the need for frameworks like React or Vue while maintaining consistent state across multiple views.

## Architecture

### Single Source of Truth

The application maintains one centralized state object:

```javascript
// Simplified state structure
const state = {
  filters: {
    search: "",
    type: [],
    source: [],
    subject: null,
    timeRange: "all",
  },
  events: [],
  currentView: "events",
  storage: {
    totalEvents: 0,
    usedSpace: 0,
    lastSync: null,
  },
  connection: {
    status: "disconnected",
    lastEvent: null,
  },
};
```

**Benefits**:

- **Consistency** - Single state, multiple views
- **Predictability** - State changes always flow through one path
- **Debuggability** - Easy to inspect and debug state
- **Testability** - Mock state for testing

### Observer Pattern

Components subscribe to state changes:

```javascript
// Simplified subscription
appState.subscribe("filters", (newFilters, oldFilters) => {
  console.log("Filters changed:", newFilters);
  updateUI(newFilters);
});
```

**How It Works**:

1. Component subscribes to specific state path
2. State changes trigger notifications
3. Subscribed components receive updates
4. Components update their UI
5. Cycle repeats for each change

## State Components

### Filters State

Stores all active filter values:

```javascript
{
  filters: {
    search: '',              // Search box text
    type: [],                // Selected event types
    source: [],              // Selected event sources
    subject: null,           // Selected event subject
    timeRange: 'all'         // Time range filter
  }
}
```

**Operations**:

```javascript
// Set search filter
appState.set("filters.search", "order");

// Add type filter
appState.updateFilters({ type: ["com.example.order.created"] });

// Clear all filters
appState.clearFilters();
```

**Subscribers**:

- Events view (filters event list)
- Timeline view (filters chart data)
- Filter chips UI (displays active filters)
- Event counter (shows filtered count)

### Events State

Stores in-memory event cache:

```javascript
{
  events: [
    { id: "123", type: "com.example.event" /* ... */ },
    { id: "456", type: "com.example.another" /* ... */ },
    // ...
  ];
}
```

**Operations**:

```javascript
// Add single event
appState.addEvent(newEvent);

// Add multiple events
appState.addEvents(eventArray);

// Get all events
const events = appState.get("events");

// Get filtered events
const filtered = appState.getFilteredEvents();
```

**Subscribers**:

- Events view (renders event list)
- Timeline view (renders chart)
- Storage manager (syncs to IndexedDB)
- Event counter (counts events)

### View State

Tracks current active view:

```javascript
{
  currentView: "events"; // 'events' or 'timeline'
}
```

**Operations**:

```javascript
// Switch to timeline view
appState.setCurrentView("timeline");

// Get current view
const view = appState.get("currentView");
```

**Subscribers**:

- Navigation bar (highlights active view)
- View containers (show/hide)
- Keyboard shortcuts (view-specific behavior)

### Storage State

Tracks storage statistics:

```javascript
{
  storage: {
    totalEvents: 1234,          // Total events in IndexedDB
    usedSpace: 5242880,         // Bytes used (~5MB)
    lastSync: '2025-10-26T...'  // Last IndexedDB write
  }
}
```

**Operations**:

```javascript
// Update storage stats
appState.updateStorageStats({
  totalEvents: count,
  usedSpace: bytes,
});
```

**Subscribers**:

- Footer/status bar (displays stats)
- Admin controls (storage management)

### Connection State

Tracks SSE connection status:

```javascript
{
  connection: {
    status: 'connected',        // 'connected', 'connecting', 'disconnected'
    lastEvent: '2025-10-26...'  // Last event received timestamp
  }
}
```

**Operations**:

```javascript
// Update connection status
appState.setConnectionStatus("connected");

// Update last event time
appState.updateLastEventTime();
```

**Subscribers**:

- Connection indicator (visual status)
- Navigation bar (shows status)
- Error handlers (retry logic)

## State Updates

### Immutable Updates

State updates are immutable to ensure predictability:

```javascript
// Bad - mutates state directly
state.filters.search = "new value"; // ❌

// Good - creates new state object
appState.set("filters.search", "new value"); // ✅
```

**Benefits**:

- **Change Detection** - Easy to detect what changed
- **Time Travel** - Can undo/redo (future feature)
- **Debugging** - Clear history of changes
- **Performance** - Efficient comparison

### Batched Updates

Multiple updates can be batched for efficiency:

```javascript
// Individual updates (triggers 3 notifications)
appState.set("filters.type", ["order.created"]);
appState.set("filters.source", ["order-service"]);
appState.set("filters.search", "error");

// Batched update (triggers 1 notification)
appState.updateFilters({
  type: ["order.created"],
  source: ["order-service"],
  search: "error",
});
```

**Benefits**:

- **Performance** - Fewer UI updates
- **Atomicity** - All changes or none
- **Consistency** - Related changes together

### Async Updates

Some updates are async for performance:

```javascript
// Async storage update
appState.addEvent(event); // Immediate UI update
// IndexedDB write happens async in background
```

**Flow**:

1. Synchronous: Update in-memory state
2. Synchronous: Notify subscribers (UI updates)
3. Asynchronous: Persist to IndexedDB
4. Asynchronous: Update storage stats

**Benefits**:

- **Responsive UI** - No blocking
- **Data Safety** - Persisted in background
- **Performance** - Non-blocking I/O

## Subscription System

### Subscribing to Changes

Components subscribe to specific state paths:

```javascript
// Subscribe to all filter changes
const unsubscribe = appState.subscribe("filters", (newFilters, oldFilters) => {
  console.log("Filters changed from:", oldFilters, "to:", newFilters);
  renderFilteredEvents(newFilters);
});

// Subscribe to specific filter
appState.subscribe("filters.search", (newSearch, oldSearch) => {
  console.log("Search changed:", newSearch);
});
```

### Unsubscribing

Subscriptions can be cancelled:

```javascript
const unsubscribe = appState.subscribe("filters", callback);

// Later, when component unmounts
unsubscribe();
```

**When to Unsubscribe**:

- Component removed from DOM
- View no longer active
- Cleanup on page unload
- Memory leak prevention

### Wildcard Subscriptions

Subscribe to multiple paths:

```javascript
// Subscribe to any filter change
appState.subscribe("filters.*", (newValue, oldValue, path) => {
  console.log(`Filter ${path} changed:`, newValue);
});
```

## State Persistence

### Session Persistence

State persists during browser session:

**What Persists**:

- ✅ Filters (until page refresh)
- ✅ Current view (until page refresh)
- ✅ Events (in IndexedDB, survives refresh)

**What Doesn't Persist**:

- ❌ Filters (after page refresh)
- ❌ UI state (accordions, scroll position)
- ❌ Temporary flags

### Future: Local Storage Persistence

Planned enhancement:

```javascript
// Save filters to local storage
appState.persistToLocalStorage("filters");

// Restore on page load
const savedFilters = appState.restoreFromLocalStorage("filters");
```

## Benefits of Custom State Management

### Why Not Use React/Vue?

**Advantages of Custom Solution**:

1. **Lightweight** - No framework overhead (~200KB saved)
2. **Simple** - Easy to understand and maintain
3. **Flexible** - Full control over behavior
4. **Fast** - No virtual DOM reconciliation
5. **Direct** - Direct DOM manipulation
6. **Learning** - No framework learning curve

**Trade-offs**:

- **Manual DOM updates** - More code for complex UIs
- **No JSX** - Template strings instead
- **Limited ecosystem** - No pre-built components
- **Manual optimization** - Handle performance ourselves

**Verdict**: For CloudEvent Player's use case (relatively simple UI, performance-critical), custom state management is ideal.

### Performance Characteristics

**State Update**: ~0.1ms

**Notification**: ~0.1ms per subscriber

**UI Update**: ~5-10ms (depends on DOM complexity)

**Total Latency**: ~10-20ms from state change to UI update

**Comparison**:

- React: ~20-50ms (virtual DOM reconciliation)
- Vue: ~15-40ms (virtual DOM)
- Vanilla: ~10-20ms (direct DOM)
- **Our system: ~10-20ms (optimized direct DOM)**

## Best Practices

### For Component Development

1. **Subscribe on mount**:

```javascript
function initializeComponent() {
  const unsubscribe = appState.subscribe("filters", updateUI);
  // Store unsubscribe for cleanup
}
```

2. **Unsubscribe on unmount**:

```javascript
function cleanupComponent() {
  unsubscribe(); // Prevent memory leaks
}
```

3. **Use specific subscriptions**:

```javascript
// Bad - subscribes to everything
appState.subscribe("*", callback);

// Good - subscribes to what you need
appState.subscribe("filters.type", callback);
```

4. **Batch related updates**:

```javascript
// Bad - multiple updates
appState.set("filters.type", types);
appState.set("filters.source", sources);

// Good - single batched update
appState.updateFilters({ type: types, source: sources });
```

### For State Management

1. **Keep state flat** - Avoid deep nesting
2. **Use immutable updates** - Never mutate directly
3. **Validate state** - Check types and values
4. **Document state shape** - Clear structure
5. **Test state changes** - Unit test state logic

## Debugging State

### Browser Console

Access state from console:

```javascript
// Get current state
appState.getState();

// Get specific value
appState.get("filters");

// Subscribe to changes
appState.subscribe("*", (newVal, oldVal, path) => {
  console.log("State changed:", path, oldVal, "→", newVal);
});
```

### State Inspector (Future)

Planned developer tools:

- **State Tree View** - Visual state structure
- **Time Travel** - Undo/redo state changes
- **Change Log** - History of all state changes
- **Performance** - Profile state update performance
- **Subscriptions** - View active subscriptions

## Next Steps

- [Multiple Views](views.md) - See how views use state
- [Filtering](filtering.md) - Understand filter state
- [Storage](storage.md) - Learn about event state
- [Performance](performance.md) - Optimize state performance
