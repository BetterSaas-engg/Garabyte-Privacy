# Backend Dockerfile for Railway deployment
# Uses Python 3.12 (stable, well-supported)

FROM python:3.12-slim

# Install system deps for psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend
COPY app/ ./app/

# Copy the rules library from the parent directory
# Railway runs the build with the project root as context (configured in railway.toml)
COPY rules/ ./rules/

# Railway provides PORT env var; default to 8000 if not set
ENV PORT=8000
EXPOSE 8000

# Start uvicorn, binding to 0.0.0.0 so the container accepts external traffic
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
