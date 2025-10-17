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

# Install the rest of the requirements
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY app/ ./app/

# Copy the main API file
COPY main.py .

# Install FastAPI dependencies
RUN pip install fastapi uvicorn python-multipart

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 
