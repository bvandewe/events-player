# Admin Task Cancellation Feature

## Overview

Implemented a feature for admin users to view and cancel ongoing generator jobs. This addresses the issue where admins could not stop long-running generator tasks (e.g., 100 events with high delay).

## Changes Made

### Backend Changes

#### 1. Updated EventGeneratorTask Model (`models.py`)

- Added `cancelled: bool = False` flag to track cancellation state
- This flag is checked during task execution

#### 2. Modified Background Task Handler (`background_tasks.py`)

- Added cancellation check in the event generation loop
- Tasks check `task.cancelled` flag before each iteration
- When cancelled, task status is set to "Cancelled" and removed from active tasks
- Clean graceful shutdown without error propagation

#### 3. Updated API Routes (`routes.py`)

**GET `/api/tasks`** - Get Active Tasks

- Restricted to admin users only (`require_admin`)
- Returns list of all active generator tasks
- Shows task ID, status, progress, etc.

**POST `/api/tasks/cancel-all`** - Cancel All Tasks

- Restricted to admin users only (`require_admin`)
- Sets `cancelled` flag on all active tasks
- Tasks will stop gracefully at next iteration check
- Logs admin action with username

**POST `/api/task/{task_id}/cancel`** - Cancel Single Task

- Restricted to admin users only (`require_admin`)
- Sets `cancelled` flag on specific task
- Task will stop gracefully at next iteration check
- Returns 404 if task not found

### Frontend Changes

#### 1. Created Tasks Modal (`tasksModal.html`)

- Bootstrap modal with clean UI
- Shows count of active tasks with badge
- Lists all active tasks with:
  - Status badge (Running, Cancelling, Completed)
  - Progress bar showing completion percentage
  - Task ID (truncated for display)
  - Cancel button for each task
- "Cancel All Tasks" button in footer
- Auto-refresh every 2 seconds while modal is open

#### 2. Created Tasks Modal Controller (`tasksModal.js`)

- Manages modal lifecycle and state
- Loads active tasks from `/api/tasks` endpoint
- Renders task list with real-time updates
- Handles individual task cancellation
- Handles bulk "cancel all" operation
- Uses apiClient for automatic token refresh
- Shows toast notifications for success/error
- Auto-refreshes task list every 2 seconds

#### 3. Updated Auth UI (`auth.js`)

- Added "Manage Tasks" menu item in user dropdown
- **Only visible to admin users** (checks `userInfo.roles.includes('admin')`)
- Opens tasks modal when clicked
- Placed after "Clear Storage" option

#### 4. Integrated into Main App (`app.js`)

- Imports and initializes tasksModalController
- Exposes controller globally for auth dropdown access
- Includes tasksModal.html in index.html

## How It Works

### Cancellation Flow

1. **Admin opens modal**: Clicks "Manage Tasks" in user dropdown
2. **View active tasks**: Modal loads and displays all running generator jobs
3. **Cancel task(s)**: Admin clicks "Cancel" button
4. **Backend sets flag**: `cancelled = True` on task object(s)
5. **Task checks flag**: On next iteration, task sees it's cancelled
6. **Graceful shutdown**: Task stops, updates status to "Cancelled", removes itself from active_tasks
7. **UI updates**: Modal auto-refreshes and shows updated status

### Security

- All endpoints protected with `require_admin` dependency
- Only users with "admin" role can access
- "Manage Tasks" menu item only shown to admins
- Logs admin actions (username + task IDs)

### User Experience

✅ **Admin users** see "Manage Tasks" in dropdown  
✅ **Non-admin users** don't see the menu item  
✅ **Auto-refresh** keeps task list current  
✅ **Progress bars** show task completion  
✅ **Status badges** clearly indicate task state  
✅ **Cancel individual** or all tasks with one click  
✅ **Toast notifications** confirm actions  
✅ **Graceful cancellation** - no errors, clean shutdown

## Testing Recommendations

1. **Test as admin user**:

   - Start a generator job with high iterations (e.g., 100) and high delay (e.g., 5000ms)
   - Open "Manage Tasks" from user dropdown
   - Verify task appears in list with progress bar
   - Click "Cancel" button
   - Verify task status changes to "Cancelling" then disappears
   - Verify no errors in console or backend logs

2. **Test as non-admin user**:

   - Verify "Manage Tasks" menu item does NOT appear in dropdown
   - Direct API access to `/api/tasks` should return 403 Forbidden

3. **Test cancel all**:

   - Start multiple generator jobs
   - Click "Cancel All Tasks" in modal
   - Verify all tasks are cancelled gracefully

4. **Test auto-refresh**:
   - Open modal with running tasks
   - Verify task progress updates automatically
   - Close and reopen modal - should show current state

## Files Modified

### Backend

- `src/api/models.py` - Added `cancelled` flag to EventGeneratorTask
- `src/api/background_tasks.py` - Added cancellation check in loop
- `src/api/routes.py` - Added/updated task endpoints with admin restriction

### Frontend

- `src/ui/html/tasksModal.html` - **NEW** - Tasks management modal
- `src/ui/js/ui/tasksModal.js` - **NEW** - Modal controller
- `src/ui/js/auth/auth.js` - Added "Manage Tasks" menu item (admin only)
- `src/ui/js/app.js` - Integrated tasksModal controller
- `src/ui/index.html` - Included tasksModal.html

## Bundle Impact

- Added ~5KB to UI bundle (minified + gzipped)
- No performance impact - modal loaded on demand
- Auto-refresh pauses when modal is closed

## Notes

- Tasks stop gracefully - they complete their current event before checking cancellation
- Cancelled tasks are removed from active_tasks dictionary
- No error propagation - cancellation is treated as normal completion
- Task progress and status continue to update until fully stopped
- Works with the existing token refresh system (uses apiClient)
