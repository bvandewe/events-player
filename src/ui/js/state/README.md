# State Management

Centralized state management for the CloudEvents Player application using a lightweight pub/sub pattern.

## Overview

The `AppState` class provides reactive state management across all views (Events, Timeline, Dashboard) without requiring a heavyweight framework like Vue or React.

## Features

- **Centralized State**: All application state in one place
- **Reactive Updates**: Automatic UI updates via pub/sub pattern
- **Type-Safe Access**: Dot notation support for nested state
- **Debug Mode**: Built-in logging for development
- **No Dependencies**: Pure JavaScript, no external libraries

## Usage

### Import

```javascript
import { appState } from "./state/appState";
```

### Subscribe to State Changes

```javascript
// Subscribe to filter changes
appState.subscribe("filters", (newFilters, oldFilters) => {
  console.log("Filters changed:", newFilters);
  refreshView();
});

// Subscribe to event count changes
appState.subscribe("eventCount", (newCount, oldCount) => {
  updateUI(newCount);
});

// Subscribe to connection status
appState.subscribe("connectionStatus", (status) => {
  updateConnectionIndicator(status);
});
```

### Update State

```javascript
// Update single value
appState.set("eventCount", 42);

// Update nested value
appState.set("filters.type", "com.example.event");

// Update multiple filters at once
appState.updateFilters({
  type: "com.example.event",
  source: "https://example.com",
  timeRange: "60",
});

// Clear all filters
appState.clearFilters();
```

### Read State

```javascript
// Get single value
const count = appState.get("eventCount");

// Get nested value
const filterType = appState.get("filters.type");

// Get all state (debugging)
const allState = appState.getAll();
```

### Special Methods

```javascript
// Event counter methods
appState.incrementEventCount();
appState.setEventCount(100);
appState.resetEventCount();

// Connection status
appState.setConnectionStatus("connected"); // 'connected', 'disconnected', 'error', 'receiving'

// Current view
appState.setCurrentView("timeline"); // 'events', 'timeline', 'dashboard'

// Storage stats
appState.updateStats({ metadataCount: 5000, recentCount: 1000 });
```

## State Schema

```javascript
{
    filters: {
        type: '',           // Event type filter
        source: '',         // Event source filter
        subject: null,      // Event subject filter
        timeRange: 'all'    // Time range: '5', '15', '30', '60', '180', '360', '720', '1440', 'all'
    },
    eventCount: 0,          // Total events received
    connectionStatus: 'disconnected', // SSE connection status
    currentView: 'events',  // Active view
    stats: {
        metadataCount: 0,   // Events in metadata storage
        recentCount: 0      // Events in recent storage
    }
}
```

## Debug Mode

Enable debug logging to see state changes:

```javascript
appState.setDebug(true);
```

Or from browser console:

```javascript
window.appState.setDebug(true);
window.appState.getAll(); // View current state
```

## Integration Examples

### Filter Controller

```javascript
// Filter controller updates state when filters change
setupEventListeners() {
    const handleChange = () => {
        const filters = this.getActiveFilters();
        appState.updateFilters(filters); // Notifies all subscribers
    };

    this.typeSelect.addEventListener('change', handleChange);
}
```

### Events View

```javascript
// Events view subscribes to filter changes
appState.subscribe("filters", (filters) => {
  loadEventsFromStorage(); // Reload with new filters
});

// Time range selector updates state
timeRangeSelect.addEventListener("change", () => {
  appState.set("filters.timeRange", timeRangeSelect.value);
});
```

### Timeline View

```javascript
// Timeline subscribes to same filters
appState.subscribe("filters", (filters) => {
  refreshChart(); // Update chart with new filters
});
```

### SSE Connection

```javascript
// Connection manager updates state
this.eventSource.addEventListener("open", () => {
  appState.setConnectionStatus("connected");
});

this.eventSource.addEventListener("message", (event) => {
  appState.incrementEventCount();
  appState.setConnectionStatus("receiving");
});

this.eventSource.addEventListener("error", () => {
  appState.setConnectionStatus("error");
});
```

## Benefits

1. **Eliminates Duplication**: Filter logic shared across all views
2. **Predictable Data Flow**: State changes flow one direction
3. **Easier Debugging**: All state changes logged in one place
4. **Loose Coupling**: Components don't need direct references to each other
5. **Easy Testing**: State can be mocked/observed independently

## Migration Notes

- Old `activeFilters` local variables replaced with `appState.get('filters')`
- Old callbacks replaced with `appState.subscribe()`
- Backward compatible: existing callbacks still work via subscription wrapper
- No breaking changes to existing code

## Performance

- Minimal overhead: ~150 lines of code, no external dependencies
- Subscribers notified synchronously (no async delays)
- Set-based listener management for O(1) lookup
- No virtual DOM diffing or reconciliation

## Future Enhancements

- Persistence: Save/restore state to localStorage
- Time travel: Undo/redo state changes
- Middleware: Add logging, analytics, etc.
- Computed properties: Derived state values
