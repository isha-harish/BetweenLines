# Use a lightweight Python image
FROM python:3.10-slim

# Install ffmpeg and git (needed by whisper/tf hub sometimes)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the backend files into the container
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the port Render expects
EXPOSE 10000

# Start FastAPI app using uvicorn
CMD ["uvicorn", "main:app", "--host=0.0.0.0", "--port=10000"]
