# CadQuery requires OpenCASCADE binaries — use a full Python image, not slim/alpine
FROM python:3.11

WORKDIR /app

# OCP (the OpenCASCADE bindings behind CadQuery) links against the system
# OpenGL/X11 libraries even for headless geometry work — without them
# `import cadquery` dies on libGL.so.1 before the server ever starts.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libgl1 \
      libglu1-mesa \
      libxrender1 \
      libxext6 \
      libsm6 \
 && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer-cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
