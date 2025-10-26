# Filtering System

Comprehensive filtering across all event properties to find exactly what you need.

## Overview

The filtering system allows you to narrow down events using multiple criteria. All filters work together with **AND** logic, and filters are synchronized across all views.

## Filter Types

### 1. Quick Search

**Location**: Search box in toolbar

**Keyboard Shortcut**: `Ctrl/Cmd + K`

**What It Searches**:

- Event type
- Event source
- Event subject
- Event data content (JSON payload)

**Behavior**:

- Real-time filtering as you type
- Case-insensitive matching
- Partial string matching
- Debounced for performance (300ms delay)

**Examples**:

- Type `order` to find all events related to orders
- Type `error` to find events containing error information
- Type `payment-service` to find events from that service

### 2. Type Filter

**Location**: Type dropdown in toolbar

**Description**: Filter by specific CloudEvent types

**Options**: All unique event types from received events (auto-populated)

**Behavior**:

- Multi-select capability
- OR logic (show events matching any selected type)
- Selected types shown as filter chips

**Use Cases**:

- Focus on specific event types (e.g., `com.example.order.created`)
- Compare multiple event types side-by-side
- Exclude irrelevant event types

### 3. Source Filter

**Location**: Source dropdown in toolbar

**Description**: Filter by event source

**Options**: All unique event sources (auto-populated)

**Behavior**:

- Multi-select capability
- OR logic (show events matching any selected source)
- Selected sources shown as filter chips

**Use Cases**:

- Monitor events from specific services
- Compare events across multiple sources
- Debug specific microservices

### 4. Subject Filter

**Location**: Subject dropdown in toolbar

**Description**: Filter by event subject

**Options**: All unique event subjects (auto-populated)

**Behavior**:

- Single select (one subject at a time)
- Handles null/empty subjects
- Clear button to remove filter

**Use Cases**:

- Track specific entities (e.g., `order-12345`)
- Monitor specific resources
- Debug subject-specific issues

**Special Handling**:

- Events with no subject can be filtered separately
- Subject filter can be combined with other filters

### 5. Time Range Filter

**Location**: Time range dropdown in toolbar

**Description**: Filter events by time period

**Options**:

- **Last Hour** - Events from the last 60 minutes
- **Last 6 Hours** - Events from the last 6 hours
- **Last 24 Hours** - Events from the last day
- **All Time** - No time filtering (default)

**Behavior**:

- Single select
- Filters based on event timestamp (`time` field)
- Updates in real-time as time progresses

**Use Cases**:

- Focus on recent events
- Analyze specific time periods
- Reduce noise from old events

## Filter Combination Logic

Multiple filters are combined with **AND** logic:

```text
Show events where:
  (search text matches) AND
  (type matches ANY selected type) AND
  (source matches ANY selected source) AND
  (subject matches selected subject) AND
  (time is within selected range)
```

### Example

With the following filters active:

- **Search**: `order`
- **Type**: `com.example.order.created`, `com.example.order.updated`
- **Source**: `order-service`
- **Time Range**: Last Hour

Result: Shows only events that:

- Contain "order" somewhere in the event
- Have type `com.example.order.created` OR `com.example.order.updated`
- Come from source `order-service`
- Were created within the last hour

## Click-to-Filter

Quickly add filters by clicking event properties in the Events view.

### How It Works

1. **Click event type badge** → Adds to type filter
2. **Click event source badge** → Adds to source filter
3. **Click event subject badge** → Sets subject filter

### Example Workflow

1. You see an interesting event
2. Click its type badge
3. All events of that type are now shown
4. Click another event's source
5. Now showing only events with that type AND source

### Benefits

- **Fast filtering** - No need to manually select from dropdowns
- **Exploratory analysis** - Click around to discover patterns
- **Context-aware** - Filters based on what you're looking at

## Filter Chips

Active filters are displayed as removable chips below the toolbar.

### Features

- **Visual indication** - See all active filters at a glance
- **Individual removal** - Click X on any chip to remove that filter
- **Clear all** - Button to remove all filters at once
- **Chip types** - Different colors for different filter types (future)

### Chip Display

Each chip shows:

- Filter type (search, type, source, subject, time range)
- Filter value
- Remove button (X)

### Managing Chips

**Remove individual filter**:

- Click X on the chip

**Clear all filters**:

- Click "Clear Filters" button
- Use keyboard shortcut `Ctrl/Cmd + L`

## Filter Persistence

### What Persists

✅ **During Session**:

- Filters remain active when switching views
- Filters survive tab changes within the app
- Filters maintained until manually cleared or page refresh

❌ **Doesn't Persist** (currently):

- Across page refreshes (future feature)
- Across browser tabs (future feature)
- Between sessions (future feature)

### Future Enhancements

Planned improvements:

- **Local Storage** - Save filters across page refreshes
- **URL Parameters** - Share filtered views via URL
- **Saved Filters** - Store and recall filter combinations
- **Filter Presets** - Predefined filter sets for common scenarios

## Filter Synchronization

Filters are synchronized across all views automatically.

### How It Works

1. User changes filter in any view
2. State management system (`appState`) updates
3. All subscribed views are notified
4. Each view re-filters its display
5. Event counter updates

### Benefits

- **Consistency** - Same filters apply everywhere
- **No confusion** - Can't have different filters in different views
- **Predictable** - Switching views maintains context

### Example

**Scenario**: User has both Events and Timeline views open

1. In Events view, filter by type `com.example.order.created`
2. Switch to Timeline view
3. Timeline shows only events of that type
4. Return to Events view
5. Type filter still active

## Advanced Filtering Techniques

### Combining Filters for Precision

**Use multiple filter types together** for precise results:

```text
Search: "error"
Type: com.example.payment.failed
Source: payment-service
Time Range: Last Hour
```

This shows only payment errors from the last hour.

### Progressive Filtering

**Start broad, then narrow**:

1. Start with time range (Last Hour)
2. Add source filter (specific service)
3. Add type filter if needed
4. Use search for final refinement

### Exploratory Filtering

**Click-to-filter workflow**:

1. Start with all events visible
2. Click interesting event's type
3. Examine filtered results
4. Click another event's source
5. Continue until you find what you need

## Filter Performance

The filtering system is optimized for performance:

### Optimizations

- **Debounced search** - Search input debounced by 300ms
- **Indexed storage** - IndexedDB indexes on type, source, time
- **Efficient algorithms** - O(n) filtering with early exit
- **Memoization** - Filter results cached until filters change

### Performance Tips

1. **Use specific filters first** - Type/source filters are faster than search
2. **Time range filtering** - Reduces dataset size significantly
3. **Clear unused filters** - Reduces processing overhead
4. **Regular storage cleanup** - Admin should clear old events periodically

## Troubleshooting

### No Events Showing

**Problem**: Filters too restrictive, no events match

**Solution**:

1. Check filter chips - are multiple filters active?
2. Clear all filters and start over
3. Try removing filters one at a time
4. Check time range - might be filtering out all events

### Filters Not Working

**Problem**: Filters don't seem to affect results

**Solution**:

1. Refresh the page
2. Check browser console for errors
3. Verify events actually have the properties you're filtering on
4. Try clearing all filters and reapplying

### Performance Issues

**Problem**: Filtering is slow with many events

**Solution**:

1. Clear storage to remove old events
2. Use time range filter to reduce dataset
3. Use specific filters (type/source) before search
4. Close other browser tabs to free memory

## Next Steps

- [Multiple Views](views.md) - See how filters work across views
- [State Management](state-management.md) - Understand filter synchronization
- [Keyboard Shortcuts](keyboard-shortcuts.md) - Efficient filter management
