# Quick Start

Get CloudEvent Player up and running in 5 minutes.

## Prerequisites

**None!** CloudEvent Player works out of the box with zero configuration. Just start it and go.

## Step 1: Start the Application

Choose your preferred method to run CloudEvent Player:

=== "Docker Run (Fastest)"

    Pull and run the pre-built image from GitHub Container Registry:

    ```bash
    docker run -d \
      --name event-player \
      -p 8884:8080 \
      ghcr.io/bvandewe/events-player:latest
    ```

    **That's it!** No environment variables required. The application uses sensible defaults.

    Verify it's running:

    ```bash
    curl http://localhost:8884/health
    ```

=== "Docker Compose"

    Create a `docker-compose.yml` file:

    ```yaml
    services:
      event-player:
        image: ghcr.io/bvandewe/events-player:latest
        ports:
          - "8884:8080"
        restart: unless-stopped
    ```

    Start it:

    ```bash
    docker-compose up -d
    ```

    Verify it's running:

    ```bash
    curl http://localhost:8884/health
    ```

=== "Build From Source"

    Build from source code:

    ```bash
    # Clone the repository
    git clone https://github.com/bvandewe/events-player
    cd events-player

    # Start with Docker Compose (builds automatically)
    docker-compose up -d
    ```

    Verify it's running:

    ```bash
    curl http://localhost:8884/health
    ```

**Expected output:**

```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T00:00:00Z",
  "active_tasks": 0,
  "active_clients": 0,
  "version": "0.4.0"
}
```

## Step 2: Open the Web Interface

Open your browser to:

```
http://localhost:8884
```

You should see the **Unified Dashboard** with:

- **Real-time Metrics**: Total events, avg rate, event types, event sources
- **Tabs**: Streams (event list) and Timeline (visual chart)
- **Search box**: In the tab bar for filtering events
- **Export button**: Download events as JSON
- **Generator button**: Top navigation bar (⚡ Generator)

## Step 3: Generate Your First Event

1. Click the **"⚡ Generator"** button in the top navigation bar

2. The generator panel will open on the right side with default values:

   - **Event Gateway**: `http://localhost:8884/events/pub`
   - **Event Source**: `https://dummy.source.com/sys-admin`
   - **Event Type**: `com.source.dummy.test.requested.v1`
   - **Event Subject**: `some.interesting.concept.key_abcde12345`
   - **Event Data**: `{"foo": "bar"}`
   - **Iterations**: `1`
   - **Delay**: `100` (milliseconds)

3. Click the **"Generate"** button at the bottom of the panel

4. Watch your event appear in the **Streams** tab in real-time!

   The metrics at the top will update automatically showing:

   - Total Events: 1
   - Event rate
   - Top event type and source

## Step 4: Inspect the Event

Click on the event card in the Streams tab to expand it and view the complete CloudEvent structure:

```json
{
  "specversion": "1.0",
  "id": "a1b2c3d4-5678-90ab-cdef-123456789abc",
  "time": "2025-10-31T12:34:56.789012",
  "datacontenttype": "application/json",
  "type": "com.source.dummy.test.requested.v1",
  "source": "https://dummy.source.com/sys-admin",
  "subject": "some.interesting.concept.key_abcde12345",
  "data": {
    "foo": "bar"
  }
}
```

## Step 5: Explore the Timeline View

1. Click the **"Timeline"** tab
2. See a visual chart showing event activity over time
3. Use the **"Bucket Size"** dropdown to change time granularity (1 sec to 1 hr)
4. Events are color-coded by source

## Step 6: Try the Search Feature

1. Go back to the **"Streams"** tab
2. Type `foo` in the search box (in the tab bar)
3. Only events containing "foo" anywhere in their payload will be shown
4. Clear the search to see all events again

The search term is automatically saved and restored when you reload the page!

## Step 7: Generate Multiple Events

Try generating multiple events:

1. Open the generator again
2. Change **Iterations** to `5`
3. Change **Delay** to `500` (milliseconds)
4. Click **"Generate"**

Watch as 5 events are generated with a half-second delay between each!

## Step 6: Customize Your Event

Create a custom event:

1. Open the generator
2. Modify the **Event Data** field:

```json
{
  "message": "My first custom event",
  "timestamp": "2025-10-16T00:00:00Z",
  "count": 42,
  "active": true,
  "tags": ["demo", "quickstart"]
}
```

3. Change the **Event Type** to: `com.myapp.custom.event`
4. Click **"Generate"**

Your custom event appears with the new data!

## Step 7: Send Events from External Systems

Test the subscriber endpoint using curl:

```bash
curl -X POST http://localhost:8884/events/pub \
  -H "Content-Type: application/cloudevents+json" \
  -d '{
    "specversion": "1.0",
    "id": "external-test-123",
    "time": "2025-10-16T00:00:00Z",
    "type": "com.external.test",
    "source": "curl-command",
    "subject": "external-test",
    "datacontenttype": "application/json",
    "data": {
      "message": "Event from external system",
      "origin": "command-line"
    }
  }'
```

The event appears in your browser in real-time!

## Common Use Cases

### Testing a Microservice

Point the gateway to your service:

```
Event Gateway: http://your-service:8080/api/events
```

Generate events to test your service's event handling.

### Load Testing

Generate high-volume event streams:

```
Iterations: 100
Delay: 100
```

This generates 100 events with 100ms between each.

### Debugging Event Structure

Use CloudEvent Player as a subscriber to inspect events from your system:

1. Configure your system to send events to: `http://localhost:8884/events/pub`
2. Watch events appear in real-time
3. Inspect the structure and data
4. Verify CloudEvents compliance

## Exploring the API

### Swagger UI

Visit the interactive API documentation:

```
http://localhost:8884/api/docs
```

Try out API endpoints directly from your browser!

### Health Check

Monitor application health:

```bash
curl http://localhost:8884/health
```

### List Active Tasks

See what event generation tasks are running:

```bash
curl http://localhost:8884/api/tasks
```

## Next Steps

You're ready to explore more features:

- **[Usage Guide](usage.md)** - Detailed usage instructions
- **[API Reference](api-reference.md)** - Complete API documentation
- **[Configuration](configuration.md)** - Customize your setup
- **[Deployment](deployment.md)** - Deploy to production

## Troubleshooting

### Port Already in Use

If port 8884 is already in use, change it in `docker-compose.yml`:

```yaml
ports:
  - "9000:8080" # Use port 9000 instead
```

Then access: `http://localhost:9000`

### Container Won't Start

Check the logs:

```bash
docker-compose logs event-player
```

### Events Don't Appear

1. Check the browser console for errors
2. Verify the SSE connection is active
3. Try refreshing the page
4. Check that the gateway URL is correct

### Cannot Connect to External Service

If testing with an external service:

1. Verify the service is running
2. Check network connectivity
3. Ensure the service accepts CloudEvents
4. Check firewall rules

## Development Mode

For hot-reload during development:

```bash
# Use debug compose file
docker-compose -f docker-compose.debug.yml up -d

# Changes to code will auto-reload
# Access logs:
docker-compose -f docker-compose.debug.yml logs -f
```

## Stopping the Application

```bash
# Stop containers
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Summary

You now know how to:

✅ Start CloudEvent Player with Docker  
✅ Generate CloudEvents via the web UI  
✅ Inspect event structure and data  
✅ Send events from external systems  
✅ Access API documentation  
✅ Monitor application health

## Next Steps

- **Advanced Features**: Read the [Usage Guide](usage.md) for filtering, search, and analytics
- **Configuration**: See [Configuration Reference](configuration.md) for all available settings
- **Security**: Set up authentication and RBAC with the [RBAC Configuration Guide](rbac-guide.md)
- **Deployment**: Check the [Deployment Guide](deployment.md) for production patterns
