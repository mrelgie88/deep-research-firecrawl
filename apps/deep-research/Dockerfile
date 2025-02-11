# Use Node.js 22 Alpine (matching package.json engine requirement)
FROM node:22-alpine

# Set working directory inside the container
WORKDIR /app

# Copy only package files first (optimizes Docker layer caching)
COPY package.json.docker ./package.json
COPY package.json.docker ./package-lock.json

# Install dependencies in a clean environment
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose API port
EXPOSE 3001

# Ensure .env.local is generated at runtime, not build time
ENTRYPOINT ["/bin/sh", "-c", "echo \"FIRECRAWL_BASE_URL=${FIRECRAWL_BASE_URL}\" > .env.local && \
    echo \"FIRECRAWL_BASE_URL_SCRAPE=${FIRECRAWL_BASE_URL_SCRAPE}\" >> .env.local && \
    echo \"OPENAI_KEY=${OPENAI_KEY}\" >> .env.local && \
    echo \"OPENAI_ENDPOINT=${OPENAI_ENDPOINT}\" >> .env.local && \
    echo \"SEARXNG_BASE_URL=${SEARXNG_BASE_URL}\" >> .env.local && \
    echo \"MODEL=${MODEL}\" >> .env.local && \
    npm run start:api"]
