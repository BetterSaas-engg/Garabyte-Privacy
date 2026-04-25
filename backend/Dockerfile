# Backend Dockerfile for Railway deployment
# Build context: project root (set by railway.toml)
# Uses Python 3.12 (stable, well-supported)

FROM python:3.12-slim

# Install system deps for psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for Docker layer caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application code
COPY backend/app/ ./app/

# Copy the rules library from the project root
COPY rules/ ./rules/

# Run as a non-root user (UID 1000). Keeps any future RCE in app or
# dependency from getting full container privileges.
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Railway provides PORT env var; default to 8000 if not set
ENV PORT=8000
EXPOSE 8000

# Start uvicorn, binding to 0.0.0.0 so the container accepts external traffic
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
