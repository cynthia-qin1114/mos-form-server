FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./
RUN npm install --production

# Copy application code
COPY server.js feishu-api.js ./
COPY public/ ./public/

# Create .env from example (will be overridden by docker-compose or server env)
COPY .env.example .env

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
