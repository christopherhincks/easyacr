FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN pnpm build

# Chromium scans untrusted pages. Do not run the application or its browser
# child process as root, even when Compose has removed Linux capabilities.
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin easyacr \
  && chown -R easyacr:easyacr /app

ENV NODE_ENV=production
ENV PORT=4174
EXPOSE 4174

USER easyacr
CMD ["node", "server/index.mjs"]
