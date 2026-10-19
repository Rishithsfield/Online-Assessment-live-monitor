FROM node:20-bullseye-slim

WORKDIR /app

# Install native compilers: g++, gcc, python3, openjdk-17, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    openjdk-17-jdk-headless \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Build frontend production bundle into dist/
RUN npm run build

# Expose server port
EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
