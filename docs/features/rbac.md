# Role-Based Access Control (RBAC)

Fine-grained permissions based on user roles for secure multi-user access.

## Overview

CloudEvent Player implements role-based access control (RBAC) to provide different levels of access to different users. This allows organizations to safely deploy the application with multiple users while controlling who can perform sensitive operations.

## Available Roles

### User Role

**Purpose**: Read-only access for observers and viewers

**Permissions**:

- ✅ View events in all views (Events, Timeline)
- ✅ Filter and search events
- ✅ Switch between views
- ✅ Use keyboard shortcuts
- ✅ View own user information
- ✅ Clear own browser's local storage
- ❌ Generate events
- ❌ Submit background tasks
- ❌ Manage tasks
- ❌ Access admin features

**Use Cases**:

- **Observers** - Team members who need to monitor events
- **Auditors** - Compliance team reviewing event logs
- **Viewers** - Stakeholders checking system activity
- **Support** - Support staff investigating issues

**UI Experience**:

- Full read access to all event data
- All filtering and search capabilities
- Cannot see event generator button
- Cannot see admin menu
- Minimal UI, focused on viewing

### Operator Role

**Purpose**: Generate and test events

**Permissions**:

- ✅ All User permissions
- ✅ Generate events via event generator form
- ✅ Submit background tasks
- ✅ Configure event generation parameters
- ✅ Send events to gateway URLs
- ❌ View all tasks
- ❌ Cancel tasks (own or others)
- ❌ Access admin menu

**Additional Permissions** (via Authorization Manager):

- May have custom permissions configured
- Can be granted access to specific gateways
- Can have rate limits applied
- Can have resource quotas

**Use Cases**:

- **Developers** - Building and testing event-driven systems
- **QA Engineers** - Testing event processing logic
- **Integration Testers** - Validating integrations
- **Performance Testers** - Load testing with events

**UI Experience**:

- Event generator button visible
- Can configure and submit tasks
- Can see own generated events
- Cannot see Task Manager
- Cannot clear storage

### Admin Role

**Purpose**: Full administrative access

**Permissions**:

- ✅ All Operator permissions
- ✅ View all background tasks (any user)
- ✅ Cancel individual tasks
- ✅ Cancel all tasks (bulk operation)
- ✅ Access admin menu and features
- ✅ View system statistics
- ✅ Configure system settings (future)
- ✅ Manage users (future via Keycloak)

**Use Cases**:

- **System Administrators** - Managing the application
- **DevOps Engineers** - Operating the platform
- **Platform Engineers** - Maintaining infrastructure
- **Team Leads** - Overseeing team usage

**UI Experience**:

- Admin menu in navigation bar
- Task Manager modal access
- Storage management controls
- Full system visibility
- All features enabled

## Permission Matrix

Comprehensive table of permissions by role:

| Feature/Action              | User | Operator | Admin |
| --------------------------- | ---- | -------- | ----- |
| **Event Viewing**           |      |          |       |
| View events in list         | ✅   | ✅       | ✅    |
| View events in timeline     | ✅   | ✅       | ✅    |
| Filter events               | ✅   | ✅       | ✅    |
| Search events               | ✅   | ✅       | ✅    |
| Click-to-filter             | ✅   | ✅       | ✅    |
| Export events (future)      | ✅   | ✅       | ✅    |
| **Event Generation**        |      |          |       |
| Open event generator        | ❌   | ✅       | ✅    |
| Configure event parameters  | ❌   | ✅       | ✅    |
| Submit generation task      | ❌   | ✅       | ✅    |
| Generate single event       | ❌   | ✅       | ✅    |
| Generate bulk events        | ❌   | ✅       | ✅    |
| Use custom gateway URL      | ❌   | ❌       | ✅    |
| **Task Management**         |      |          |       |
| View own tasks              | ❌   | ❌       | ✅    |
| View all tasks              | ❌   | ❌       | ✅    |
| Cancel own task             | ❌   | ❌       | ✅    |
| Cancel any task             | ❌   | ❌       | ✅    |
| Cancel all tasks            | ❌   | ❌       | ✅    |
| **Storage Management**      |      |          |       |
| View storage stats          | ✅   | ✅       | ✅    |
| Clear own browser storage   | ✅   | ✅       | ✅    |
| Export storage (future)     | ❌   | ❌       | ✅    |
| **System Administration**   |      |          |       |
| Access admin menu           | ❌   | ❌       | ✅    |
| View system logs (future)   | ❌   | ❌       | ✅    |
| Configure settings (future) | ❌   | ❌       | ✅    |
| Manage users (future)       | ❌   | ❌       | ✅    |

## UI Adaptations by Role

The user interface adapts automatically based on the authenticated user's role.

### Navigation Bar

**User**:

```text
┌─────────────────────────────────────────────┐
│ [Events] [Timeline]     👤 User (John Doe) ▼│
│                            └ Clear Storage   │
└─────────────────────────────────────────────┘
```

**Operator**:

```text
┌─────────────────────────────────────────────┐
│ [Events] [Timeline] [Generate] 👤 Operator ▼│
│                            └ Clear Storage   │
└─────────────────────────────────────────────┘
```

**Admin**:

```text
┌─────────────────────────────────────────────┐
│ [Events] [Timeline] [Generate] 👤 Admin ▼   │
│                                  ├ Tasks     │
│                                  └ Clear Storage│
└─────────────────────────────────────────────┘
```

### Event Generator

**User**:

- Button hidden from navigation
- Cannot access generator via keyboard shortcut
- Form not accessible even via direct URL

**Operator**:

- "Generate Events" button visible
- Accessible via `Ctrl/Cmd + G` shortcut
- Full form functionality
- Can select from pre-configured gateway URLs
- Cannot use custom gateway URLs

**Admin**:

- "Generate Events" button visible
- Accessible via `Ctrl/Cmd + G` shortcut
- Full form functionality
- Can select from pre-configured gateway URLs
- **Can use custom gateway URLs**:
    - Select "Custom URL..." from gateway dropdown
    - Enter any custom gateway endpoint (e.g., `http://dev-gateway:8080/events`)
    - Custom URL is saved to localStorage for convenience
    - Useful for testing with development/staging environments

### Admin Menu

**User & Operator**:

- Admin dropdown visible but only shows "Clear Storage"
- "Clear Storage" available to all authenticated users
- Clears only their own browser's local storage

**Admin**:

- Admin dropdown in navigation bar
- Additional menu item:
  - **Manage Tasks** - Opens Task Manager modal
- Plus the "Clear Storage" option available to all users

### Task Manager Modal

**User & Operator**:

- Cannot access modal
- Menu item not visible
- API endpoints return 403

**Admin**:

- Full access to Task Manager
- View all tasks from all users
- Cancel any task
- Cancel all tasks
- Real-time refresh

### Storage Controls

**All Authenticated Users**:

- "Clear Storage" option in user dropdown menu
- Opens confirmation modal before clearing
- Only affects own browser's local storage (IndexedDB)
- Does not affect other users or server data
- Useful for troubleshooting or freeing up local space

**Important Notes**:

- Storage is client-side only (browser-specific)
- Each user's browser has its own independent storage
- Clearing storage only removes events from your own browser
- No server-side data is deleted

## Role Assignment

### Keycloak Roles

Roles are assigned via Keycloak realm roles:

**Setup Steps**:

1. Create roles in Keycloak realm: `admin`, `operator`, `user`
2. Assign roles to users in Keycloak
3. Configure role mapper in client scope
4. Roles included in JWT access token

**JWT Token Structure**:

```json
{
  "sub": "user-id-here",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "realm_access": {
    "roles": ["operator", "user"]
  }
}
```

### Role Precedence

If a user has multiple roles:

**Precedence Order**: `admin` > `operator` > `user`

**Example**:

- User has both `operator` and `user` roles
- Application grants `operator` permissions
- Higher role always takes precedence

**Best Practice**:

- Assign only the highest required role
- Avoid assigning multiple roles
- Use role hierarchies in Keycloak

### Default Role

If authentication is disabled or user has no roles:

**Default**: Read-only access (equivalent to `user` role)

**Rationale**:

- Safe default (least privilege)
- Prevents accidental admin access
- Explicit role assignment required for elevated permissions

## Authorization Enforcement

### Frontend Authorization

**UI Elements**:

- Conditional rendering based on role
- Buttons hidden if no permission
- Menu items filtered by role
- Feature flags check user role

**Example**:

```javascript
// Simplified authorization code
if (auth.hasRole("operator") || auth.hasRole("admin")) {
  showGeneratorButton();
}

if (auth.hasRole("admin")) {
  showAdminMenu();
}
```

### Backend Authorization

**API Endpoints**:

- Role validation on every protected endpoint
- JWT token validation
- Role extraction from token claims
- Permission checks before operation

**Example**:

```python
# Simplified FastAPI endpoint
@app.post("/api/generate")
async def generate_events(
    config: GeneratorConfig,
    user: User = Depends(require_operator)  # Role check
):
    # Generate events
    return {"task_id": task.id}

@app.get("/api/tasks")
async def list_tasks(
    user: User = Depends(require_admin)  # Admin only
):
    # List all tasks
    return tasks
```

**HTTP Responses**:

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Authenticated but insufficient permissions
- `200 OK` - Authorized and successful

## Authorization Manager (Advanced)

For advanced permission management, CloudEvent Player can integrate with a custom Authorization Manager.

### Custom Permissions

Beyond standard roles, additional permissions can be configured:

**Gateway Restrictions**:

- Operator can only send to specific gateway URLs
- Other gateways return permission error
- Configured per-user or per-group

**Rate Limits**:

- Maximum events per minute
- Maximum concurrent tasks
- Maximum iterations per task
- Configured per-user or per-role

**Resource Quotas**:

- Storage limits per user
- Event retention periods
- Task history limits

### Configuration

Authorization Manager configured via:

**Environment Variables**:

```bash
API_AUTH_MANAGER_URL=http://authz-manager:8080
API_AUTH_MANAGER_ENABLED=true
```

**Per-Request Headers**:

```http
POST /api/generate
Authorization: Bearer <jwt-token>
X-Gateway-URL: http://target-gateway:8080/events
```

**Response**:

```json
{
  "authorized": true,
  "permissions": {
    "max_iterations": 10000,
    "allowed_gateways": ["http://gateway-1", "http://gateway-2"],
    "rate_limit": 100
  }
}
```

## Security Considerations

### Authentication Required

RBAC only works when authentication is enabled:

**Without Auth**:

- All users have read-only access
- No event generation allowed
- No admin features available
- Safe default for public deployments

**With Auth**:

- Users must log in
- Roles enforced on every request
- Token validation required
- Full RBAC capabilities

### Token Validation

Every API request validates the JWT token:

**Validation Steps**:

1. Extract token from Authorization header
2. Verify token signature (JWKS)
3. Check token expiry
4. Validate issuer and audience
5. Extract user claims and roles
6. Check required role for endpoint
7. Allow or deny request

### Role Tampering

Roles cannot be tampered with:

**Protection**:

- Roles signed in JWT token
- Token signature verified on every request
- Tampering invalidates signature
- Invalid tokens rejected (401)
- Only Keycloak can issue valid tokens

### Principle of Least Privilege

Follow least privilege principle:

**Best Practices**:

1. **Default to User** - Assign user role by default
2. **Grant Operator** - Only to developers/testers
3. **Restrict Admin** - Minimum number of admins
4. **Audit Access** - Review role assignments regularly
5. **Revoke Promptly** - Remove access when no longer needed

## Troubleshooting

### User Cannot Generate Events

**Problem**: Operator role assigned but cannot generate events

**Check**:

1. Verify role in JWT token (check browser console)
2. Check Keycloak role assignment
3. Verify client scope includes realm roles
4. Check role mapper configuration
5. Log out and log back in (refresh token)

### Admin Features Not Visible

**Problem**: Admin role assigned but admin menu not showing

**Check**:

1. Verify role in JWT token
2. Check role extraction in frontend
3. Clear browser cache
4. Refresh page
5. Check browser console for errors

### 403 Forbidden Error

**Problem**: API calls return 403 Forbidden

**Check**:

1. Verify authentication token is valid
2. Check token hasn't expired
3. Verify required role for endpoint
4. Check backend logs for authorization errors
5. Verify user has required role in Keycloak

### Role Not Recognized

**Problem**: User has role but system doesn't recognize it

**Check**:

1. Role name case-sensitive (use lowercase)
2. Role in correct claim (`realm_access.roles`)
3. Role mapper configured correctly
4. Token includes role (inspect JWT)
5. Backend extracts role correctly

## Next Steps

- [Authentication & Authorization](../authentication.md) - Complete auth setup
- [Background Tasks](tasks.md) - Admin task management
- [Configuration](../configuration.md) - Configure role-based features
