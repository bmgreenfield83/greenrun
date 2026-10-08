FROM python:3.12-slim

WORKDIR /app
COPY backend /app/backend
RUN python -m pip install --no-cache-dir /app/backend
ENV GARMIN_TOKEN_DIR=/data/garmin
RUN mkdir -p /data/garmin && chmod 700 /data/garmin

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "/app/backend", "--host", "0.0.0.0", "--port", "8000"]
