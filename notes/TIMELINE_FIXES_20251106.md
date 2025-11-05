# Timeline Fixes - November 6, 2025

## Issues Fixed

### Issue 1: Empty Timeline Chart Error

**Problem:** When loading the page without any events in storage, navigating to the timeline resulted in:

```
TypeError: Cannot set properties of undefined (setting 'data')
```

**Root Cause:** The code attempted to access `this.chart.data.datasets[0].data` when no datasets existed (new stacked bar implementation doesn't pre-create datasets).

**Solution:**

- Changed `this.chart.data.datasets[0].data = []` to `this.chart.data.datasets = []`
- This properly clears all datasets when there are no events

**File Changed:** `src/ui/js/components/timeline.js` (line ~398)

---

### Issue 2: Timeline Click Filtering and Zoom

**Problems:**

1. When clicking on a bucket in the timeline, the global filter was set but the timeline didn't show any data
2. Need to auto-zoom (reduce bucket size) when clicking a bucket to see sub-buckets

**Root Causes:**

1. Race condition: Chart was being destroyed and recreated while filter update was propagating
2. No zoom-in functionality was implemented

**Solutions:**

#### A. Auto-Zoom on Click

- When clicking a timeline bucket, the bucket size automatically decreases one level (unless already at minimum)
- For example: clicking a 1-hour bucket changes to 30-minute buckets
- This allows you to see the sub-buckets within the selected time range
- The bucket size dropdown is automatically updated

#### B. Proper Refresh Sequencing

- Added a short delay (100ms) before chart reinitialization to allow filter propagation
- Only reinitializes chart if zoom level changed
- Uses `scheduleRefresh(true)` for immediate refresh after chart recreation

**File Changed:** `src/ui/js/components/timeline.js` (lines ~250-288)

---

### Issue 3: Custom Time Range Display

**Problem:** Custom time range inputs weren't being hidden when switching away from custom range.

**Solution:**

- Enhanced `restoreFilterValues()` to explicitly hide custom inputs when timeRange is not 'custom'
- Ensures UI consistency

**File Changed:** `src/ui/js/ui/globalFilters.js` (lines ~215-235)

---

## Testing Guide

### Test Case 1: Empty Timeline

1. Clear browser storage (or use incognito)
2. Open the application
3. Navigate to Timeline tab
4. **Expected:** Empty chart with no errors in console

### Test Case 2: Timeline Click with Zoom

1. Generate some events over a time period (use event generator)
2. Navigate to Timeline tab with a large bucket size (e.g., 1 hour)
3. Click on a bar in the timeline
4. **Expected:**
   - Global filter shows "Custom Range" with the bucket's start/end times
   - Bucket size automatically reduces to next level (e.g., 30 minutes)
   - Timeline redraws showing sub-buckets within the selected time range
   - Custom time range inputs appear in filter panel with correct times

### Test Case 3: Zoom Limits

1. Set timeline to smallest bucket size (1 second)
2. Click on a bar
3. **Expected:**
   - Time filter is applied
   - Bucket size stays at 1 second (can't zoom further)
   - Timeline shows selected second in detail

### Test Case 4: Multiple Clicks (Drill-Down)

1. Start with 1 hour bucket size
2. Click a bar → zooms to 30 minutes
3. Click a bar in the new view → zooms to 20 minutes
4. Continue clicking → progressively zooms down
5. **Expected:** Each click narrows time range and decreases bucket size

---

## Implementation Details

### Zoom Levels (from largest to smallest)

```javascript
{ value: 60, unit: 'minute' },  // 1 hour (index 12)
{ value: 30, unit: 'minute' },  // 30 minutes (index 11)
{ value: 20, unit: 'minute' },  // 20 minutes (index 10)
{ value: 15, unit: 'minute' },  // 15 minutes (index 9)
{ value: 10, unit: 'minute' },  // 10 minutes (index 8)
{ value: 5, unit: 'minute' },   // 5 minutes (index 7)
{ value: 3, unit: 'minute' },   // 3 minutes (index 6)
{ value: 1, unit: 'minute' },   // 1 minute (index 5)
{ value: 30, unit: 'second' },  // 30 seconds (index 4)
{ value: 20, unit: 'second' },  // 20 seconds (index 3)
{ value: 15, unit: 'second' },  // 15 seconds (index 2)
{ value: 10, unit: 'second' },  // 10 seconds (index 1)
{ value: 5, unit: 'second' },   // 5 seconds (index 0)
{ value: 3, unit: 'second' },   // 3 seconds
{ value: 1, unit: 'second' }    // 1 second (minimum)
```

### Click Behavior Flow

1. User clicks on timeline bar
2. Extract bucket time and calculate start/end
3. Check if zoom is possible (not at index 0)
4. If yes: Decrease index, update dropdown, flag for reinit
5. Update global filters with custom time range
6. If reinit flagged: Destroy old chart, create new one, refresh
7. Filter subscription also triggers refresh (handles when zoom not needed)

---

## Files Modified

1. **src/ui/js/components/timeline.js**
   - Fixed empty chart error (line ~398)
   - Enhanced onClick handler with zoom functionality (lines ~250-288)

2. **src/ui/js/ui/globalFilters.js**
   - Fixed custom time range UI toggle (lines ~215-235)

---

## Build Instructions

To see these changes in action:

```bash
# Development mode with hot reload
npm run dev

# Or production build
npm run build
```

---

## Additional Notes

- The zoom feature is designed to work like Grafana's drill-down
- Each click narrows both the time range AND the granularity
- Users can manually adjust bucket size via the dropdown if desired
- The auto-refresh toggle still works as expected
- All chart interactions (legend click, bar click) now properly update global filters
