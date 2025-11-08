# GitHub Copilot Instructions

Thank you for your interest in contributing to the CloudEvent Player! This guide provides instructions to help you get started with the codebase.

## Architecture

This project is a [FastAPI](https://fastapi.tiangolo.com/) application that serves a web-based UI for monitoring and generating [CloudEvents](https://cloudevents.io/). The backend is written in Python and the frontend is a single-page application.

- **Backend**: The core of the application is in `src/api/`. The main entrypoint is `src/api/app.py`, which sets up the FastAPI application, middleware, and routes.
- **Frontend**: The frontend is located in `src/ui/`. It is a vanilla JavaScript single-page application that communicates with the backend API.
- **Real-time Updates**: The application uses Server-Sent Events (SSE) to stream events to the UI in real-time. The SSE implementation can be found in `src/api/stream.py`.
- **Configuration**: Application settings are managed through environment variables and are defined in `src/api/settings.py` using `pydantic-settings`.

## Developer Workflow

The `Makefile` provides a set of commands for common development tasks.

- **Running the application**: Use `make docker-dev` to build and run the application in a Docker container. For development with hot-reloading, use `make docker-debug`.
- **Code Quality**: To format the code, run `make format`. To check for linting errors, run `make lint`.
- **Documentation**: To serve the documentation locally, run `make docs-serve`.

## Key Dependencies

- **Python**: The project uses [Poetry](https://python-poetry.org/) for dependency management. The dependencies are listed in `pyproject.toml`.
- **FastAPI**: The backend is built with [FastAPI](https://fastapi.tiangolo.com/), a modern, fast (high-performance) web framework for building APIs with Python 3.7+ based on standard Python type hints.
- **Pydantic**: The application uses [Pydantic](https://pydantic-docs.helpmanual.io/) for data validation and settings management.
- **SSE Starlette**: The real-time event streaming is implemented using [sse-starlette](https://pypi.org/project/sse-starlette/).

## Authentication

Authentication is optional and can be enabled by setting the `AUTH_REQUIRED` environment variable to `true`. When enabled, it uses OAuth 2.0/OIDC for authentication and authorization. The authentication logic is implemented in `src/api/auth.py`.

## RBAC and Security

When authentication is enabled (`AUTH_REQUIRED=true`), the application uses Role-Based Access Control (RBAC) to restrict access to sensitive features. This is critical for controlling the event generator, which can emit events with powerful options like auto-repeat and randomized payloads.

The RBAC implementation is in `src/api/auth.py` and defines the following roles:
- **admin**: Full access to all features.
- **operator**: Can use the generator but with some restrictions.
- **user**: Read-only access to view events.

## Documentation and Notes

The `notes/` directory contains raw, "private" notes that are used to inform the "public" documentation in the `docs/` directory, which is a MkDocs site. Both directories should be kept in sync. When adding new features or making significant changes, start by documenting them in `notes/` and then update the corresponding sections in `docs/`.

## Changelog

It is critical to maintain the changelog with any changes to the codebase. The `CHANGELOG.md` file is the single source of truth and must be updated. The changelog for the documentation site is generated from this file.

## How to Contribute

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and ensure that the tests pass.
4.  Submit a pull request with a clear description of your changes.

We appreciate your contributions to the CloudEvent Player!
