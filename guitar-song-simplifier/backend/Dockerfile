# Use Python 3.9 slim image as base (matches your working environment)
FROM python:3.9-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DEBIAN_FRONTEND=noninteractive

# Install minimal system dependencies (including build tools for C extensions)
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    gcc \
    g++ \
    make \
    portaudio19-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies (matching your local setup)
RUN pip install --no-cache-dir --upgrade pip

# Install numpy first (as you do locally)
RUN pip install --no-cache-dir numpy==1.23.5

# Set environment variable for build isolation (as you do locally)
ENV PIP_NO_BUILD_ISOLATION=1

# Install vamp first with explicit no-build-isolation so it can see numpy
# This is needed because chord-extractor depends on vamp, and vamp needs numpy at build time
RUN pip install --no-cache-dir --no-build-isolation vamp==1.1.0

# Now install the rest of the requirements (chord-extractor will find vamp already installed)
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY app/ ./app/

# Copy other necessary files
COPY loaded_song_combo.py .
COPY realtime_combo.py .
COPY complex_realtime_chords/ ./complex_realtime_chords/

# Install FastAPI dependencies with WebSocket support
RUN pip install fastapi "uvicorn[standard]" python-multipart websockets

# Expose port
EXPOSE 8000

# Command to run the application with new structure (with auto-reload for development)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"] 
