# CloudEvent Player

**A developer tool for testing and debugging CloudEvents in distributed systems.**

<div style="text-align: center; margin: 30px 0;">
  <img src="assets/images/logo.png" alt="CloudEvent Player Logo" width="200">
</div>

## What is CloudEvent Player?

CloudEvent Player is a lightweight, browser-based tool designed to help developers test, generate, and monitor [CloudEvents](https://cloudevents.io/) in real-time. It combines an event publisher, subscriber, and visual inspector in a single application.

<div style="text-align: center; margin: 30px 0;">
  <img src="assets/images/cloudevent-player_demo_0.2.gif" alt="CloudEvent Player Demo" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px;">
</div>

**Demo Setup:** Two CloudEvent Players monitoring each other's events

```mermaid
graph TB
    Browser[🌐 Browser SSE Client]

    Browser ---|SSE Stream| Player1[CloudEvent Player 1]
    Browser ---|SSE Stream| Player2[CloudEvent Player 2]

    Player1 <-->|Publishes Events| Player2

    style Browser fill:#FFFFFF,stroke:#1A1A1A,stroke-width:2px,color:#1A1A1A
    style Player1 fill:#10aef7,stroke:#1A1A1A,stroke-width:2px,color:#fff
    style Player2 fill:#10aef7,stroke:#1A1A1A,stroke-width:2px,color:#fff
```

## Key Features

### 🎯 **Event Generation**

Generate CloudEvents with customizable properties, data payloads, and delivery options. Perfect for testing event-driven architectures without writing code.

### 📡 **Real-Time Monitoring**

Watch events flow through your system with Server-Sent Events (SSE) streaming. See events as they arrive with syntax-highlighted JSON.

### 🔍 **Event Inspection**

Examine CloudEvent structure, validate schemas, and debug data payloads with an intuitive web interface.

### 🔄 **Pub/Sub Support**

Acts as both publisher and subscriber, allowing you to test complete event workflows.

### 🆔 **Request Tracing**

Built-in Request ID tracing for debugging across distributed systems.

### 🏥 **Health Monitoring**

Health check endpoint for integration with monitoring systems and orchestrators.

## Use Cases

- **Development**: Test event-driven microservices locally
- **Integration Testing**: Validate event flows between services
- **Debugging**: Inspect CloudEvents in real-time
- **Load Testing**: Generate high-volume event streams
- **Documentation**: Demonstrate CloudEvents to stakeholders

## Quick Start

=== "Using Docker"

    The easiest way to run CloudEvent Player is using Docker.

    ```bash
    # Pull and run the latest image
    docker pull ghcr.io/bvandewe/events-player:latest

    docker run -d \
    --name event-player \
    -p 8884:8080 \
    -e API_LOG_LEVEL=INFO \
    ghcr.io/bvandewe/events-player:latest
    ```

=== "Using Docker Compose"

    ```bash
    # Using Docker Compose
    git clone https://github.com/bvandewe/events-player
    cd events-player
    docker-compose up -d

    # Access the UI
    open http://localhost:8884
    ```

## Architecture

```mermaid
graph LR
    A[Web UI] --> B[FastAPI Backend]
    B --> C[SSE Stream]
    B --> D[Event Publisher]
    B --> E[Event Subscriber]
    D --> F[CloudEvent Gateway]
    G[External Systems] --> E
    C --> A
```

## Technology Stack

- **Backend**: Python 3.10+ with FastAPI
- **Frontend**: Vanilla JavaScript with Bootstrap 5
- **Streaming**: Server-Sent Events (SSE)
- **Event Format**: CloudEvents v1.0 specification
- **Containerization**: Docker with multi-stage builds

## CloudEvents Compliance

CloudEvent Player implements the [CloudEvents v1.0 specification](https://github.com/cloudevents/spec/blob/v1.0/spec.md), supporting:

- ✅ Required attributes (specversion, id, source, type)
- ✅ Optional attributes (datacontenttype, subject, time)
- ✅ JSON format with proper type handling
- ✅ Content-Type validation
- ✅ Structured content mode

## Getting Started

Choose your deployment method:

- [**Installation**](installation.md) - Run locally with Python or Docker
- [**Quick Start**](quick-start.md) - Get up and running in 5 minutes
- [**Usage Guide**](usage.md) - Learn how to use all features
- [**Deployment**](deployment.md) - Deploy to Kubernetes or cloud platforms

## Documentation Structure

- **Getting Started**

  - [Installation](installation.md)
  - [Quick Start](quick-start.md)
  - [Configuration](configuration.md)

- **Usage**

  - [Using the Web UI](usage.md)
  - [API Reference](api-reference.md)
  - [Event Generation](event-generation.md)
  - [Event Monitoring](event-monitoring.md)

- **Deployment**

  - [Docker Deployment](deployment.md#docker)
  - [Kubernetes Deployment](deployment.md#kubernetes)
  - [Development Mode](deployment.md#development)

- **Advanced**
  - [Request ID Tracing](advanced/request-tracing.md)
  - [Testing](advanced/testing.md)
  - [Troubleshooting](advanced/troubleshooting.md)

## Community & Support

- **Issues**: Report bugs and request features on our issue tracker
- **Contributions**: See [CONTRIBUTE.md](https://github.com/bvandewe/events-player/blob/main/CONTRIBUTE.md)
- **Changelog**: View [release notes](changelog.md)

## License

[MIT License](https://github.com/bvandewe/events-player/blob/main/LICENSE)

---

**Ready to start?** Head to the [Installation Guide](installation.md) or jump to the [Quick Start](quick-start.md)!
