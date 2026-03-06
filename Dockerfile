# Stage 1: Build the UI (React/Vite)
FROM node:20 AS ui-builder

WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm install
COPY ui/ .
RUN npm run build

# Stage 2: Runtime (Python FastAPI)
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Ensure directories for static asset serving and backend logic
RUN mkdir -p /app/ui/dist /app/bff

# Copy compiled frontend assets from ui-builder
COPY --from=ui-builder /app/ui/dist /app/ui/dist

# Switch to backend directory
WORKDIR /app/bff

# Install application dependencies safely
COPY bff/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend logic
COPY bff/ .

# Ensure frontend fallback routes from BFF find this mapped directory
# The main.py uses path os.path.join(__file__, "..", "ui", "dist")

EXPOSE 8000

# Expose internal ENV fallback for Kernel routing internally
ENV ANK_TARGET="ank-server:50051"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
