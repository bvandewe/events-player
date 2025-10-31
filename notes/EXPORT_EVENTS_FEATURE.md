# Export Events Feature

## Overview

The CloudEvents Player UI now includes an export feature that allows authorized users (admins and operators) to download events as JSON files. This feature is accessible from the Event Stream view and provides two export options.

## Authorization

**Access Restricted**: This feature is only available to users with **admin** or **operator** roles. The export button will be hidden for users without proper authorization.

## Location

The export button is located at the top-right corner of the Event Stream page header, next to the page title and description.

## Features

### Export Options

1. **Filtered Events**

   - Exports only events that match the currently active filters
   - Filters can include: event type, source, subject, and time range
   - The modal displays which filters are currently active
   - Filename includes filter information for easy identification

2. **All Events (Tier 1)**
   - Exports all full events from recent storage (Tier 1)
   - Ignores any active filters
   - Includes all events up to the configured maximum (default: 5000 events)
   - Displays the total count of events that will be exported

### File Format

- **Format**: JSON (pretty-printed with 2-space indentation)
- **Filename Pattern**:
  - Filtered: `cloudevents_filtered_[filter-info]_[timestamp].json`
  - All: `cloudevents_all_[timestamp].json`
- **Content**: Array of CloudEvent objects with internal storage attributes removed

### User Interface

- **Export Button**: Styled with Bootstrap outline-primary button
- **Export Modal**: Clean modal dialog with radio button options
- **Notifications**: Bootstrap alerts appear at the top of the screen showing:
  - Success: Number of events exported
  - Error: Error message if export fails
- **Auto-dismiss**: Notifications automatically disappear after 3 seconds

## Implementation Details

### Files Modified

1. **src/ui/html/main.html**

   - Added export button to page header

2. **src/ui/js/app.js**

   - Imported and initialized exportEventsController
   - Made toastController globally available

3. **src/ui/js/ui/exportEvents.js** (new file)

   - Complete export functionality
   - Modal creation and management
   - Event filtering and file generation
   - User notifications

4. **CHANGELOG.md**
   - Documented new feature in version 0.3.9

### Technical Features

- Uses IndexedDB via EventStorageManager for data retrieval
- Leverages appState for current filter information
- Filters events based on type, source, subject, and time range
- Cleans internal storage attributes (storedAt, insertionOrder, sequenceNumber) before export
- Generates downloadable Blob URLs for JSON files
- Properly cleans up temporary DOM elements and object URLs

## Usage Example

1. Navigate to the Event Stream view
2. (Optional) Apply filters to narrow down events of interest
3. Click the "Export" button in the top-right corner
4. Choose export option:
   - Select "Filtered Events" to export only matching events
   - Select "All Events (Tier 1)" to export everything
5. Click "Download" button
6. Browser will download the JSON file to your default download location
7. Open the file in any text editor or JSON viewer

## Benefits

- **Data Analysis**: Export events for offline analysis in tools like jq, Python, or spreadsheets
- **Debugging**: Share specific event sets with team members
- **Compliance**: Archive events for audit or compliance purposes
- **Testing**: Use exported events as test data for other systems
- **Backup**: Create snapshots of event data at specific points in time
