FROM node:22.14-alpine

WORKDIR /app
COPY --chown=node:node auth-gateway/index.mjs ./index.mjs

USER node
EXPOSE 4180
CMD ["node", "index.mjs"]
