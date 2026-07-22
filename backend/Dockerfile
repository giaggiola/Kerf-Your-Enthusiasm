# CadQuery requires OpenCASCADE binaries — use a full Python image, not slim/alpine
FROM python:3.11

WORKDIR /app

# OCP (the OpenCASCADE bindings behind CadQuery) links against the system
# OpenGL/X11 libraries even for headless geometry work — without them
# `import cadquery` dies on libGL.so.1 before the server ever starts.
#
# Retried for the same reason the web image retries apk: package-mirror fetches
# from this host fail intermittently, and a transient network error here would
# fail an otherwise-good deploy.
RUN for attempt in 1 2 3; do \
      apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglu1-mesa \
        libxrender1 \
        libxext6 \
        libsm6 \
      && rm -rf /var/lib/apt/lists/* && exit 0; \
      echo "apt-get failed (attempt ${attempt}/3); retrying in 10s"; \
      sleep 10; \
    done; \
    echo "apt-get failed after 3 attempts" >&2; exit 1

# Install Python deps first (layer-cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
