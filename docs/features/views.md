# Multiple Views

CloudEvent Player provides different views for analyzing CloudEvents based on your needs.

## Available Views

### Events List View

The default view showing events as an expandable list.

#### Best For

- Detailed event inspection
- Sequential event analysis
- Reading event data payloads
- Debugging specific events

#### Features

- **Accordion-style event cards** - Expand/collapse individual events
- **Syntax-highlighted JSON** - Easy-to-read event data
- **Full event details** - Complete CloudEvent structure
- **Click-to-expand/collapse** - Quick access to event details
- **Click-to-filter** - Click event properties to add filters

#### Navigation

- Click **Events** in the navigation bar
- Default view on page load

#### Screenshot

The Events view displays each CloudEvent as an accordion item with:

- Event header showing type, source, and timestamp
- Expandable section with full JSON payload
- Syntax highlighting for easy reading
- Click-to-filter badges on event properties

### Timeline Chart View

Visual timeline showing event activity over time using Chart.js.

#### Best For

- Pattern recognition and trend analysis
- Load analysis and capacity planning
- Time-based debugging
- Activity monitoring and alerting

#### Features

- **Interactive Chart.js timeline** - Pan and zoom on the chart
- **Hover tooltips** - See event counts for specific time periods
- **Time-based aggregation** - Events grouped by time buckets
- **Auto-refresh capability** - Chart updates as new events arrive
- **Manual refresh on demand** - Force refresh with button or keyboard shortcut

#### Navigation

- Click **Timeline** in the navigation bar
- Use view switcher in the toolbar

#### Use Cases

**Development & Testing:**

- Monitor event flow during testing
- Identify event bursts or gaps
- Validate event timing

**Operations & Monitoring:**

- Track system activity over time
- Detect anomalies in event patterns
- Correlate events with system metrics

**Debugging:**

- Identify when problems started
- Correlate event spikes with errors
- Analyze event distribution

## View Synchronization

All views share the same state and data, providing a consistent experience.

### Synchronized Elements

#### Filters

- Set filters in Events view → automatically applied to Timeline view
- Change filters in Timeline view → Events view updates
- Filter state persists when switching between views

#### Event Data

- Same events shown in all views
- New events appear in all views simultaneously
- Event storage shared across views

#### Storage

- Events stored once in IndexedDB
- All views access the same storage
- Storage management affects all views

#### Real-time Updates

- New events via SSE appear in all views
- Counter updates consistently
- Connection status shared

### Benefits of Synchronization

- **Consistency** - All views show the same filtered data
- **Efficiency** - No duplicate storage or processing
- **Seamless Switching** - Context preserved when changing views
- **Unified Experience** - Filters and settings work the same everywhere

## Switching Between Views

### Methods

1. **Navigation Bar** - Click Events or Timeline buttons
2. **Keyboard Shortcuts** - Use navigation shortcuts (future feature)
3. **View Switcher** - Use dropdown in toolbar (future feature)

### What Happens When Switching

When you switch from one view to another:

1. Current filters are preserved
2. Event data remains loaded
3. View-specific settings are restored
4. SSE connection continues
5. New events continue arriving

### View-Specific Settings

Some settings are view-specific:

**Events View:**

- Accordion expand/collapse state (per event)
- Scroll position

**Timeline View:**

- Chart zoom level (future feature)
- Time bucket size (future feature)

## Adding New Views (Future)

The architecture supports adding new views easily:

**Planned Views:**

- **Dashboard View** - Multiple widgets with metrics and charts
- **Table View** - Sortable/filterable data table
- **Graph View** - Relationship visualization (future)
- **Map View** - Geographic event distribution (future)

All new views will use the same synchronization system, ensuring consistency across the application.

## Next Steps

- [Filtering System](filtering.md) - Learn about comprehensive filtering
- [State Management](state-management.md) - Understand how synchronization works
- [Storage Architecture](storage.md) - Learn about event persistence
