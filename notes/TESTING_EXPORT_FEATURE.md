# Testing the Export Events Feature

## Build and Run

To test the new export events feature, you need to build the UI and run the application.

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the UI

For development with hot module reloading:

```bash
npm run dev
```

Or for a production build:

```bash
npm run build
```

### 3. Run the Backend

The UI requires the Python backend to be running. From the project root:

```bash
# Ensure Python environment is configured
make run
# or
python -m uvicorn src.api.app:app --reload
```

### 4. Access the UI

Open your browser to:

```text
http://localhost:8000
```

## Testing the Feature

### Test Case 1: Export Filtered Events

1. Open the Event Stream view
2. Click on "Filters" in the navigation bar
3. Select a specific event type (e.g., select one type from dropdown)
4. Click the "Export" button in the top-right corner
5. Verify the modal shows:
   - "Filtered Events" option
   - Description mentions the active filter
6. Select "Filtered Events" and click "Download"
7. Verify:
   - File downloads with name like `cloudevents_filtered_[type]_[timestamp].json`
   - Success notification appears
   - File contains only events matching the filter

### Test Case 2: Export All Events

1. Clear any active filters (click "Clear" in filters dropdown)
2. Click the "Export" button
3. Verify the modal shows:
   - "All Events (Tier 1)" option
   - Description shows the total event count
4. Select "All Events (Tier 1)" and click "Download"
5. Verify:
   - File downloads with name like `cloudevents_all_[timestamp].json`
   - Success notification appears
   - File contains all events in storage

### Test Case 3: Multiple Filters

1. Apply multiple filters:
   - Event Type: select a type
   - Event Source: select a source
   - Time Range: select "Last Hour"
2. Click the "Export" button
3. Verify the modal shows all active filters in the description
4. Export and verify the filename includes filter information
5. Verify exported events match all filter criteria

### Test Case 4: No Events

1. Apply a filter combination that matches no events
2. Click the "Export" button
3. Export filtered events
4. Verify:
   - File downloads successfully
   - File contains an empty array `[]`
   - Success notification shows "0 events"

### Test Case 5: Error Handling

To test error handling, you can simulate errors by:

1. Stop the backend or disconnect from network
2. Try to export events
3. Verify error notification appears

## Inspecting Exported JSON

The exported JSON file will have this structure:

```json
[
  {
    "id": "event-uuid",
    "specversion": "1.0",
    "type": "com.example.event.v1",
    "source": "https://example.com",
    "subject": "subject-value",
    "time": "2025-10-31T12:00:00Z",
    "datacontenttype": "application/json",
    "data": {
      "key": "value"
    },
    "timestamp": 1730376000000
  },
  ...
]
```

Note: Internal storage attributes (`storedAt`, `insertionOrder`, `sequenceNumber`) are removed from the export.

## Verification Checklist

- [ ] Export button appears in Event Stream view
- [ ] Export button has proper tooltip
- [ ] Modal opens when clicking export button
- [ ] Modal shows current filter information
- [ ] Modal has two radio button options
- [ ] "Filtered Events" option is selected by default
- [ ] Clicking "Download" downloads a JSON file
- [ ] Filename includes timestamp
- [ ] Filename includes filter info for filtered exports
- [ ] Success notification appears and auto-dismisses
- [ ] Exported JSON is properly formatted
- [ ] Internal storage attributes are removed
- [ ] Only filtered events are exported when using filters
- [ ] All events are exported when using "All Events" option
- [ ] Modal can be closed without exporting
- [ ] Feature works with no filters active
- [ ] Feature works with multiple filters active

## Browser Developer Tools

To debug issues:

1. Open browser DevTools (F12)
2. Check Console tab for `[ExportEvents]` log messages
3. Check Network tab for any failed API calls
4. Check Application > IndexedDB > CloudEventsPlayer to see stored events

## Common Issues

### Button Not Appearing

- Verify the HTML was properly updated in `src/ui/html/main.html`
- Check browser console for JavaScript errors
- Ensure Parcel build completed successfully

### Export Not Working

- Check browser console for errors
- Verify storageManager was passed to exportEventsController
- Check if IndexedDB has any events stored

### File Not Downloading

- Check browser's download settings
- Verify browser allows downloads from localhost
- Check browser console for Blob/URL creation errors
