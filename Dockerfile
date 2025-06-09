# Multi-stage build for optimized production image
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including dev dependencies for build process)
RUN npm ci

# Copy application source
COPY . .

# Run tests and build (if applicable)
# RUN npm run test -- --passWithNoTests
# RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine

# Use non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create app directory and set permissions
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=appuser:appgroup /app/src ./src
COPY --from=builder --chown=appuser:appgroup /app/scripts ./scripts
COPY --from=builder --chown=appuser:appgroup /app/*.js ./

# Create necessary directories with proper permissions
RUN mkdir -p logs uploads && chown -R appuser:appgroup logs uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose application port
EXPOSE 3000

# Configure volume for persistent data
VOLUME ["/app/uploads", "/app/logs"]

# Health check to verify service is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Switch to non-root user
USER appuser

# Start the application
CMD ["node", "src/start.js"]
