# Build
FROM node:16-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Package
FROM python:3.10-slim
EXPOSE 80
# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN python -m pip install -r requirements.txt
WORKDIR /app
COPY . /app

RUN mkdir /app/static
COPY --from=build /app/static /app/static

RUN adduser -u 5678 --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "80"]
