# Build
FROM node:16-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
# Copy UI source files maintaining the directory structure
COPY src/ui/ ./src/ui/
# Clean any existing build artifacts and caches before building
RUN rm -rf static .parcel-cache dist
RUN npm run build

# Package
FROM python:3.10-slim
EXPOSE 8080
# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1
# Add src to Python path
ENV PYTHONPATH=/app/src
WORKDIR /app
COPY poetry.lock pyproject.toml /app/
# RUN python -m pip install -r requirements.txt
RUN pip install poetry && poetry config virtualenvs.create false && poetry install --no-root --no-interaction --no-ansi
COPY src /app/src

RUN mkdir -p /app/static
COPY --from=build /app/static /app/static

RUN adduser -u 5678 --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8080"]
