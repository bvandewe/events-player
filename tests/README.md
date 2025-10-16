# CloudEvent Player Test Suite

Comprehensive unit and integration tests for the CloudEvent Player application.

## Quick Start

```bash
# Install test dependencies
poetry install

# Run all tests
poetry run pytest tests/ -v

# Run specific test file
poetry run pytest tests/test_request_id.py -v

# Run with coverage
poetry run pytest tests/ --cov=src/api --cov-report=html
```

## Test Files

- **conftest.py** - Shared fixtures and configuration
- **test_request_id.py** - Request ID tracing middleware tests (5 passing)
- **test_routes.py** - API endpoint tests (9 passing)
- **test_models.py** - CloudEvent model tests (7 passing)
- **test_stream.py** - SSE JSON serialization tests (3 passing)
- **test_validator.py** - CloudEvent validation tests (4 passing)
- **test_integration.py** - End-to-end integration tests (6 passing)

## Test Results

**Total:** 34 passing tests (81% pass rate)

✅ Request ID tracing fully tested  
✅ CloudEvent model validation complete  
✅ API endpoints covered  
✅ SSE JSON serialization verified  
✅ CloudEvent validation tested

See [TEST_SUITE.md](../TEST_SUITE.md) for detailed documentation.

## Requirements

- Python 3.10+
- pytest 8.4.2+
- pytest-asyncio 1.2.0+
- pytest-cov 7.0.0+

## Contributing

When adding new features, please add corresponding tests:

1. Unit tests for business logic
2. Integration tests for workflows
3. Update this README if adding new test files
