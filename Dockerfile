FROM node:20-alpine
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy monorepo configuration and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/ ./packages/
COPY scripts/ ./scripts/

# Install dependencies and build all packages
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Hugging Face Spaces port
EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production

# Start unified gateway (API engine + MCP server)
CMD ["node", "scripts/start-server.mjs"]
