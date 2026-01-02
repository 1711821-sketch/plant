FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads data

EXPOSE 3001

CMD ["node", "dist/index.js"]
