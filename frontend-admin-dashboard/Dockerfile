# Multi-stage Dockerfile for React TypeScript Vite application

# Stage 1: Build the application
FROM node:20-alpine AS builder

# Install pnpm globally (pin to the project's pnpm 9 for determinism; unpinned
# 'pnpm' pulls pnpm 10 which requires Node >=22.13)
RUN npm install -g pnpm@9

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and configuration files
COPY . .

# Build the application
RUN pnpm run build

# Stage 2: Serve the application with nginx
FROM nginx:alpine AS production

# Nginx server config (caching contract documented in the file itself)
COPY docker/nginx-default.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Runtime config injection (writes window.__BACKEND_URL__ from BACKEND_BASE_URL)
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Inject runtime config, then start nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]