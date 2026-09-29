FROM python:3.12-slim

WORKDIR /app
COPY backend /app/backend
RUN python -m pip install --no-cache-dir /app/backend

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "/app/backend", "--host", "0.0.0.0", "--port", "8000"]
