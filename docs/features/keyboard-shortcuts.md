# Keyboard Shortcuts

Power user features for efficient navigation and workflow optimization.

## Overview

CloudEvent Player provides comprehensive keyboard shortcuts for efficient navigation and operation. These shortcuts work across all views and significantly speed up common tasks.

## Available Shortcuts

### Navigation & Focus

| Shortcut       | Action               | Context  | Description                              |
| -------------- | -------------------- | -------- | ---------------------------------------- |
| `Ctrl/Cmd + K` | Focus search box     | Any view | Jump to search input for quick filtering |
| `Ctrl/Cmd + G` | Open event generator | Any view | Open event generator offcanvas panel     |
| `Escape`       | Close panels         | Any view | Close offcanvas panels and modals        |

### View Control

| Shortcut       | Action       | Context     | Description                               |
| -------------- | ------------ | ----------- | ----------------------------------------- |
| `Ctrl/Cmd + R` | Refresh view | Any view    | Refresh current view (events or timeline) |
| `Ctrl/Cmd + A` | Toggle all   | Events view | Expand or collapse all event accordions   |

### Filtering

| Shortcut       | Action            | Context  | Description                           |
| -------------- | ----------------- | -------- | ------------------------------------- |
| `Ctrl/Cmd + L` | Clear all filters | Any view | Remove all active filters at once     |
| `Ctrl/Cmd + F` | Focus type filter | Any view | Jump to type filter dropdown (future) |

### Help

| Shortcut | Action                  | Context  | Description                           |
| -------- | ----------------------- | -------- | ------------------------------------- |
| `?`      | Show keyboard shortcuts | Any view | Display keyboard shortcuts help modal |

## Cross-Platform Support

Shortcuts work on all major platforms with platform-specific modifiers:

**macOS**:

- `Cmd + K` - Focus search
- `Cmd + G` - Open generator
- `Cmd + R` - Refresh view
- `Cmd + A` - Toggle all
- `Cmd + L` - Clear filters

**Windows/Linux**:

- `Ctrl + K` - Focus search
- `Ctrl + G` - Open generator
- `Ctrl + R` - Refresh view
- `Ctrl + A` - Toggle all
- `Ctrl + L` - Clear filters

**Notes**:

- Application automatically detects platform
- Uses appropriate modifier key
- Consistent experience across platforms

## Usage Patterns

### Quick Search Workflow

```text
1. Press Ctrl/Cmd + K
   ↓
2. Search input focused
   ↓
3. Type search term
   ↓
4. Results filter in real-time
   ↓
5. Press Escape to close search
```

**Benefit**: Find events without using mouse

### Event Generation Workflow

```text
1. Press Ctrl/Cmd + G
   ↓
2. Generator panel opens
   ↓
3. Tab through form fields
   ↓
4. Fill in event details
   ↓
5. Press Enter to submit (or Tab to Generate button)
   ↓
6. Panel closes, events generated
```

**Benefit**: Generate events entirely via keyboard

### Filter Management Workflow

```text
1. Press Ctrl/Cmd + K
   ↓
2. Type to filter
   ↓
3. Click event types to add filters
   ↓
4. Press Ctrl/Cmd + L to clear all filters
   ↓
5. Repeat as needed
```

**Benefit**: Rapid filter adjustments without mouse

### Events View Navigation

```text
1. Scroll to event of interest
   ↓
2. Click event to expand
   ↓
3. Press Ctrl/Cmd + A to expand all
   ↓
4. Review all events
   ↓
5. Press Ctrl/Cmd + A again to collapse all
```

**Benefit**: Quickly see all or hide all event details

## Context Awareness

Shortcuts respect focus context to avoid conflicts:

### When Input Has Focus

**Typing in search box, generator form, etc.**:

- Text input shortcuts work normally
- Navigation shortcuts temporarily disabled
- Press `Escape` to unfocus and restore shortcuts

**Example**:

```text
Focus on search input:
  - Type "order" → searches for "order"
  - Press Ctrl/Cmd + K → does nothing (already focused)
  - Press Escape → unfocuses search
  - Press Ctrl/Cmd + K again → refocuses search
```

### When Modal is Open

**Modal or offcanvas panel open**:

- `Escape` closes modal/panel (highest priority)
- Other shortcuts disabled until modal closes
- Form submission shortcuts work inside modal

### When Dropdown is Open

**Filter dropdown or select menu open**:

- Arrow keys navigate dropdown
- Enter selects option
- Escape closes dropdown
- Other shortcuts temporarily disabled

## Implementation Details

### Event Listeners

Shortcuts implemented via document-level event listeners:

```javascript
// Simplified implementation
document.addEventListener("keydown", (event) => {
  // Check for Ctrl/Cmd + K
  if ((event.ctrlKey || event.metaKey) && event.key === "k") {
    event.preventDefault();
    focusSearchBox();
  }

  // Check for Escape
  if (event.key === "Escape") {
    closeOpenPanels();
  }

  // Other shortcuts...
});
```

### Preventing Default Behavior

Shortcuts prevent browser default behavior:

**Example - Ctrl/Cmd + K**:

- Browser default: Open search in some browsers
- Our override: Focus search box in app
- `event.preventDefault()` called

**Example - Ctrl/Cmd + R**:

- Browser default: Refresh entire page
- Our override: Refresh current view only
- `event.preventDefault()` called

### Platform Detection

Automatic detection of macOS vs Windows/Linux:

```javascript
const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const modifierKey = isMac ? "Cmd" : "Ctrl";
```

**Display**:

- Shortcuts show correct modifier in help text
- Tooltips use platform-appropriate keys
- Consistent user experience

## Best Practices

### Learning Curve

**Start Simple**:

1. **Week 1**: Learn `Ctrl/Cmd + K` for search
2. **Week 2**: Add `Ctrl/Cmd + G` for generator
3. **Week 3**: Add `Ctrl/Cmd + R` for refresh
4. **Week 4**: Master `Ctrl/Cmd + A` for toggle all

**Don't Rush**:

- Learn one shortcut at a time
- Use consistently before adding more
- Muscle memory develops with practice

### Efficiency Gains

**Quantified Benefits**:

- **Search**: 2 seconds (keyboard) vs 4 seconds (mouse)
- **Open Generator**: 1 second vs 3 seconds
- **Clear Filters**: 1 second vs 5 seconds (clicking each chip)
- **Toggle All**: 1 second vs 10+ seconds (clicking each event)

**Cumulative Impact**:

- Save ~2 seconds per operation
- 50 operations per day = 100 seconds saved
- ~30 minutes saved per month
- More efficient workflow overall

### Combining Shortcuts

**Power User Workflow**:

```text
Ctrl/Cmd + K (search) → type "error" →
Ctrl/Cmd + A (expand all) → review errors →
Ctrl/Cmd + L (clear filters) →
Ctrl/Cmd + G (generate test event)
```

**Benefit**: Complete workflow without using mouse

### Avoiding Conflicts

**Browser Shortcuts**:

- Be aware of browser shortcuts
- Our shortcuts override browser when needed
- Use `preventDefault()` judiciously

**Screen Reader Compatibility**:

- Shortcuts don't interfere with screen readers
- Alt text provided for all buttons
- ARIA labels used appropriately

## Customization (Future)

Planned features for keyboard shortcuts:

### Custom Key Bindings

- Configure your own shortcuts
- Import/export key binding profiles
- Share key bindings with team
- Reset to defaults option

### Shortcut Cheat Sheet

- Press `?` to show all shortcuts
- Modal with searchable shortcut list
- Printable cheat sheet
- PDF export option

### Shortcut Hints

- Tooltip hints show shortcuts
- "Hint mode" highlights shortcut keys
- Gradual learning system
- Progressive disclosure

## Accessibility

### Screen Reader Support

Shortcuts are screen reader friendly:

- **Announcements**: Actions announced to screen readers
- **Focus Management**: Focus moved logically
- **ARIA Labels**: All buttons have labels
- **Skip Links**: Skip to main content

### Keyboard-Only Navigation

Complete keyboard-only navigation supported:

- **Tab Order**: Logical tab sequence
- **Focus Indicators**: Clear visual focus
- **No Mouse Required**: All features accessible
- **Trapped Focus**: Modal focus management

### Reduced Motion

Respects user preferences:

- Transitions disabled if `prefers-reduced-motion`
- Smooth scrolling optional
- No distracting animations
- Instant focus changes

## Troubleshooting

### Shortcut Not Working

**Problem**: Keyboard shortcut doesn't respond

**Check**:

1. **Focus**: Is an input focused? Press Escape first
2. **Modal**: Is a modal open? Close it first
3. **Browser**: Does browser override this shortcut?
4. **Platform**: Using correct modifier (Ctrl vs Cmd)?
5. **Console**: Check browser console for errors

**Solutions**:

- Press Escape to clear focus
- Close any open modals
- Try different shortcut
- Refresh page

### Wrong Modifier Key

**Problem**: Shortcuts not working on macOS

**Check**:

- Using Cmd instead of Ctrl?
- Application should detect platform automatically
- Check platform detection in console

**Solutions**:

- Use Cmd on macOS, Ctrl on Windows/Linux
- Refer to shortcut help modal (`?`)
- Check documentation for platform notes

### Conflicts with Browser

**Problem**: Browser action instead of app action

**Common Conflicts**:

- `Ctrl/Cmd + R` - Page refresh (we prevent this)
- `Ctrl/Cmd + K` - Browser search (we prevent this)
- `Ctrl/Cmd + F` - Browser find (we don't override)

**Solutions**:

- Most conflicts are handled automatically
- Use browser shortcuts when needed
- Close any browser extensions conflicting

### Shortcuts Disabled

**Problem**: No shortcuts work at all

**Check**:

1. JavaScript errors in console?
2. Browser extensions interfering?
3. Page loaded correctly?
4. Event listeners registered?

**Solutions**:

- Refresh page
- Disable browser extensions
- Check browser console
- Try incognito mode

## Keyboard Shortcut Reference Card

**Print or save this reference**:

```text
╔══════════════════════════════════════════════════╗
║      CloudEvent Player Keyboard Shortcuts        ║
╠══════════════════════════════════════════════════╣
║ Navigation & Focus                               ║
║  Ctrl/Cmd + K    Focus search box                ║
║  Ctrl/Cmd + G    Open event generator            ║
║  Escape          Close panels                    ║
╠══════════════════════════════════════════════════╣
║ View Control                                     ║
║  Ctrl/Cmd + R    Refresh current view            ║
║  Ctrl/Cmd + A    Toggle all accordions           ║
╠══════════════════════════════════════════════════╣
║ Filtering                                        ║
║  Ctrl/Cmd + L    Clear all filters               ║
╠══════════════════════════════════════════════════╣
║ Help                                             ║
║  ?               Show keyboard shortcuts         ║
╚══════════════════════════════════════════════════╝
```

## Next Steps

- [Multiple Views](views.md) - Use shortcuts across different views
- [Filtering](filtering.md) - Efficient filtering with keyboard
- [Background Tasks](tasks.md) - Generate events via keyboard
