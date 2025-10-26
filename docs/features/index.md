# Features Overview

CloudEvent Player provides a rich set of features for generating, monitoring, and analyzing CloudEvents in real-time.

## Available Features

### Core Features

- **[Multiple Views](views.md)** - Events List and Timeline Chart views for different analysis needs
- **[Filtering System](filtering.md)** - Comprehensive filtering across all event properties
- **[Client-Side Storage](storage.md)** - Two-tier storage architecture with IndexedDB and in-memory cache

### Real-Time Features

- **[Server-Sent Events (SSE)](sse.md)** - Real-time event streaming with automatic reconnection
- **[Background Tasks](tasks.md)** - Non-blocking event generation with progress tracking

### Security & Access

- **[Role-Based Access Control](rbac.md)** - Fine-grained permissions for admin, operator, and user roles

### User Experience

- **[Keyboard Shortcuts](keyboard-shortcuts.md)** - Power user features for efficient navigation
- **[State Management](state-management.md)** - Reactive state system keeping all views synchronized

### Performance

- **[Performance Optimization](performance.md)** - Techniques for handling thousands of events

## Quick Navigation

Choose a feature category to learn more:

| Category            | Features                                  | Best For                      |
| ------------------- | ----------------------------------------- | ----------------------------- |
| **Views**           | Events List, Timeline Chart               | Different analysis approaches |
| **Filtering**       | Search, type, source, subject, time range | Finding specific events       |
| **Storage**         | IndexedDB, in-memory cache                | Offline access, performance   |
| **Real-Time**       | SSE streaming, background tasks           | Live monitoring               |
| **Security**        | RBAC, role-based UI                       | Multi-user environments       |
| **User Experience** | Keyboard shortcuts, state synchronization | Efficient workflow            |
| **Performance**     | Debouncing, indexed storage, lazy loading | High-volume scenarios         |

## Getting Started

1. **New Users**: Start with [Multiple Views](views.md) to understand the interface
2. **Power Users**: Check out [Keyboard Shortcuts](keyboard-shortcuts.md) for efficient navigation
3. **Administrators**: Review [RBAC](rbac.md) and [Background Tasks](tasks.md) for admin features
4. **Developers**: Explore [State Management](state-management.md) and [Performance](performance.md)

## Related Documentation

- [Usage Guide](../usage.md) - Basic usage instructions
- [Configuration](../configuration.md) - Configuration options
- [Authentication & Authorization](../authentication.md) - Security setup
