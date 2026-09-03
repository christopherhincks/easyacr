FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY --chown=pwuser:pwuser scanner-worker/index.mjs ./index.mjs

USER pwuser
CMD ["node", "index.mjs"]
