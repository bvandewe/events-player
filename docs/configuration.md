# Configuration

CloudEvent Player can be configured through environment variables to customize its behavior for different environments and use cases.

## Configuration Methods

CloudEvent Player supports multiple configuration methods, in order of precedence:

1. **Environment Variables** - Set directly in your shell or container
2. **Environment Files** - `.env` or `.env.prod` files in the application root
3. **Default Values** - Built-in defaults if no configuration is provided

## Environment Variables

All environment variables use the `API_` prefix (case-insensitive).

### Application Settings

#### `API_TAG`

- **Description**: Application version/tag
- **Type**: String
- **Default**: `"0.1.0"`
- **Example**: `API_TAG=v0.2.0`

Used for version identification in logs and API responses.

#### `API_REPOSITORY_URL`

- **Description**: Repository URL for the application
- **Type**: String (URL)
- **Default**: `"https://github.com/bvandewe/events-player"`
- **Example**: `API_REPOSITORY_URL=https://github.com/myorg/events-player`

Displayed in the UI and API documentation.

### Logging Configuration

#### `API_LOG_LEVEL`

- **Description**: Logging level for the application
- **Type**: String
- **Default**: `"INFO"`
- **Valid Values**: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`
- **Example**: `API_LOG_LEVEL=DEBUG`

Controls the verbosity of application logs. Use `DEBUG` for development and troubleshooting, `INFO` for production.

#### `API_LOG_FORMAT`

- **Description**: Python logging format string
- **Type**: String
- **Default**: `"%(asctime)s - %(name)s - %(levelname)s - %(message)s"`
- **Example**: `API_LOG_FORMAT="%(levelname)s - %(message)s"`

Customize log output format. See [Python logging documentation](https://docs.python.org/3/library/logging.html#logrecord-attributes) for available attributes.

### Default Event Settings

These settings define the default values used in the event generator form.

#### `API_DEFAULT_GENERATOR_EVENT__EVENT_SOURCE`

- **Description**: Default CloudEvent source attribute
- **Type**: String (URI)
- **Default**: `"https://dummy.source.com/sys-admin"`
- **Example**: `API_DEFAULT_GENERATOR_EVENT__EVENT_SOURCE=https://myapp.com/orders`

The source context in which the event occurred.

#### `API_DEFAULT_GENERATOR_EVENT__EVENT_TYPE`

- **Description**: Default CloudEvent type attribute
- **Type**: String
- **Default**: `"com.source.dummy.test.requested.v1"`
- **Example**: `API_DEFAULT_GENERATOR_EVENT__EVENT_TYPE=com.myapp.order.created.v1`

The type of event. Use reverse-DNS naming convention.

#### `API_DEFAULT_GENERATOR_EVENT__EVENT_SUBJECT`

- **Description**: Default CloudEvent subject attribute
- **Type**: String
- **Default**: `"some.interesting.concept.key_abcde12345"`
- **Example**: `API_DEFAULT_GENERATOR_EVENT__EVENT_SUBJECT=order.12345`

The subject of the event in the context of the event producer.

#### `API_DEFAULT_GENERATOR_EVENT__EVENT_DATA`

- **Description**: Default CloudEvent data payload
- **Type**: JSON String
- **Default**: `{"foo": "bar"}`
- **Example**: `API_DEFAULT_GENERATOR_EVENT__EVENT_DATA={"orderId": "12345", "amount": 99.99}`

The event payload data. Must be valid JSON.

### Default Gateway URLs

#### `API_DEFAULT_GENERATOR_GATEWAYS__URLS`

- **Description**: List of default gateway URLs for event publishing
- **Type**: JSON Array of URLs
- **Default**:
  ```json
  [
    "http://localhost:8884/events/pub",
    "http://host.docker.internal:8884/events/pub",
    "http://event-player:8080/events/pub"
  ]
  ```
- **Example**: `API_DEFAULT_GENERATOR_GATEWAYS__URLS='["https://events.myapp.com/publish"]'`

URLs that appear in the gateway dropdown in the UI. The first URL is selected by default.

### Performance Settings

#### `API_BROWSER_QUEUE_SIZE`

- **Description**: Maximum size of the in-memory event queue for SSE streaming
- **Type**: Integer
- **Default**: `1000`
- **Example**: `API_BROWSER_QUEUE_SIZE=5000`

Controls how many events are kept in memory for SSE clients. Increase for high-throughput scenarios, decrease to reduce memory usage.

#### `API_HTTP_CLIENT_TIMEOUT`

- **Description**: HTTP client timeout in seconds
- **Type**: Float
- **Default**: `30.0`
- **Example**: `API_HTTP_CLIENT_TIMEOUT=60.0`

Timeout for HTTP requests when publishing events to gateway URLs.

## Configuration Examples

### Development Environment

Create a `.env` file in the project root:

```ini
# .env
API_TAG=dev
API_LOG_LEVEL=DEBUG
API_DEFAULT_GENERATOR_EVENT__EVENT_SOURCE=https://dev.myapp.com/events
API_DEFAULT_GENERATOR_EVENT__EVENT_TYPE=com.myapp.test.v1
API_BROWSER_QUEUE_SIZE=100
```

### Production Environment

Create a `.env.prod` file:

```ini
# .env.prod
API_TAG=v1.0.0
API_LOG_LEVEL=INFO
API_DEFAULT_GENERATOR_EVENT__EVENT_SOURCE=https://prod.myapp.com/events
API_DEFAULT_GENERATOR_EVENT__EVENT_TYPE=com.myapp.production.v1
API_DEFAULT_GENERATOR_GATEWAYS__URLS='["https://events.prod.myapp.com/publish"]'
API_BROWSER_QUEUE_SIZE=5000
API_HTTP_CLIENT_TIMEOUT=60.0
```

### Docker Compose Configuration

```yaml
services:
  event-player:
    image: event-player:latest
    ports:
      - "8884:8080"
    environment:
      - API_TAG=v1.0.0
      - API_LOG_LEVEL=INFO
      - API_DEFAULT_GENERATOR_EVENT__EVENT_SOURCE=https://myapp.com/events
      - API_DEFAULT_GENERATOR_EVENT__EVENT_TYPE=com.myapp.event.v1
      - API_BROWSER_QUEUE_SIZE=2000
    restart: unless-stopped
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: event-player-config
data:
  API_TAG: "v1.0.0"
  API_LOG_LEVEL: "INFO"
  API_DEFAULT_GENERATOR_EVENT__EVENT_SOURCE: "https://myapp.com/events"
  API_DEFAULT_GENERATOR_EVENT__EVENT_TYPE: "com.myapp.event.v1"
  API_BROWSER_QUEUE_SIZE: "2000"
  API_HTTP_CLIENT_TIMEOUT: "60.0"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: event-player
spec:
  template:
    spec:
      containers:
        - name: event-player
          image: event-player:latest
          envFrom:
            - configMapRef:
                name: event-player-config
```

## Configuration Best Practices

### Security

1. **Don't commit secrets**: Never commit `.env` files containing sensitive information
2. **Use environment-specific files**: Separate configuration for dev/staging/production
3. **Limit gateway URLs**: Only include trusted event gateway endpoints

### Performance

1. **Tune queue size**: Adjust `API_BROWSER_QUEUE_SIZE` based on expected event volume
2. **Set appropriate timeouts**: Configure `API_HTTP_CLIENT_TIMEOUT` for your network conditions
3. **Use appropriate log levels**: `INFO` or `WARNING` for production, `DEBUG` only for troubleshooting

### Maintainability

1. **Use meaningful defaults**: Configure sensible defaults for your organization
2. **Document custom settings**: Keep track of non-standard configurations
3. **Version configuration**: Track configuration changes alongside code changes

## Environment Variable Naming

The configuration uses Pydantic's nested settings feature. Double underscores (`__`) represent nesting:

```
API_DEFAULT_GENERATOR_EVENT__EVENT_SOURCE
│   │                     │   │
│   │                     │   └─ Field name (event_source)
│   │                     └───── Nested object separator
│   └─────────────────────────── Object name (default_generator_event)
└─────────────────────────────── Prefix (api_)
```

This allows structured configuration while maintaining compatibility with environment variable conventions.

## Validation

CloudEvent Player uses Pydantic for configuration validation. Invalid values will cause the application to fail at startup with a clear error message:

```bash
# Invalid log level
API_LOG_LEVEL=INVALID

# Error:
# ValidationError: 1 validation error for ApiSettings
# log_level
#   Input should be 'DEBUG', 'INFO', 'WARNING', 'ERROR', or 'CRITICAL'
```

## Troubleshooting

### Configuration Not Applied

1. **Check environment variable names**: Ensure correct prefix and casing
2. **Verify .env file location**: Must be in the application root directory
3. **Check file permissions**: Ensure .env files are readable
4. **Inspect logs**: Application logs show loaded configuration values (except secrets)

### Default Values Not Working

1. **Check for typos**: Variable names are case-insensitive but must be spelled correctly
2. **Verify JSON format**: For complex values like `EVENT_DATA`, ensure valid JSON
3. **Check for overrides**: Environment variables take precedence over .env files

### Application Won't Start

1. **Review validation errors**: Check startup logs for configuration validation failures
2. **Test configuration values**: Validate JSON strings and URLs before setting
3. **Check required fields**: Ensure all required configuration is provided

## Next Steps

- [Usage Guide](usage.md) - Learn how to use the configured application
- [Deployment Guide](deployment.md) - Deploy with custom configuration
- [Quick Start](quick-start.md) - Get started quickly with defaults
