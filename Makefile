.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# Documentation targets
.PHONY: docs-build docs-serve docs-deploy
docs-build: ## Build MkDocs documentation
	@echo "Building documentation..."
	poetry run mkdocs build --verbose

docs-serve: ## Serve documentation locally (development server)
	@echo "Starting documentation server..."
	$(eval DEV_PORT := $(shell grep '^DOCS_DEV_PORT=' .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo '8000'))
	@echo "Checking for existing servers on port $(DEV_PORT)..."
	@lsof -ti:$(DEV_PORT) | xargs -r kill -9 2>/dev/null || true
	@echo "Open http://127.0.0.1:$(DEV_PORT) in your browser"
	poetry run mkdocs serve --dev-addr=127.0.0.1:$(DEV_PORT) --livereload --watch-theme

docs-deploy: ## Deploy documentation to GitHub Pages
	@echo "Deploying documentation..."
	poetry run mkdocs gh-deploy --force

# Code quality targets
.PHONY: lint format
lint: ## Run linting checks
	@echo "Running linting checks..."
	poetry run flake8 src/api/ --max-line-length=100
	poetry run pylint src/api/

format: ## Format code using black
	@echo "Formatting code..."
	poetry run black src/api/ --line-length=100

# Docker targets
.PHONY: docker-build docker-up docker-down docker-debug docker-debug-down docker-logs
docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker-compose -f docker-compose.debug.yml build

docker-dev: ## Build and start Docker image
	@echo "Building and running Docker image..."
	docker-compose -f docker-compose.debug.yml up --build -d

docker-up: ## Start services using docker-compose
	@echo "Starting services..."
	docker-compose -f docker-compose.debug.yml up -d

docker-down: ## Stop services using docker-compose
	@echo "Stopping services..."
	docker-compose -f docker-compose.debug.yml down

docker-debug: ## Start services in debug mode with hot-reload
	@echo "Starting services in debug mode..."
	docker-compose -f docker-compose.debug.yml up

docker-debug-down: ## Stop debug services
	@echo "Stopping debug services..."
	docker-compose -f docker-compose.debug.yml down

docker-logs: ## Show logs from running containers
	@echo "Showing logs..."
	docker-compose -f docker-compose.debug.yml logs -f
