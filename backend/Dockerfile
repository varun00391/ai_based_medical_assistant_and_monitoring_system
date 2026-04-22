FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /app/data/uploads /app/data/reports

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Uvicorn logs to stdout/stderr; use UVICORN_LOG_LEVEL (see docker-compose). --no-access-log: app middleware logs HTTP instead.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log --no-use-colors --log-level ${UVICORN_LOG_LEVEL:-info}"]
