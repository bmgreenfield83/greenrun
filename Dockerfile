# Greenrun: the FastAPI backend serving the built frontend, in one container. See docs/deployment.md.
FROM node:22-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
# Same-origin API: the browser calls /api on whatever host served the page.
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend /app/backend
RUN python -m pip install --no-cache-dir /app/backend
COPY --from=frontend /src/frontend/dist /app/frontend-dist
ENV APP_ENV=production \
    FRONTEND_DIST=/app/frontend-dist \
    PYTHONUNBUFFERED=1
RUN useradd --uid 1000 --no-create-home greenrun
USER greenrun
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"
# One worker only: FIT and plan import previews are held in process memory.
CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "/app/backend", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
