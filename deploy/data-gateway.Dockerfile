FROM node:22.14-alpine

WORKDIR /app
COPY --chown=node:node data-gateway/index.mjs ./index.mjs

USER node
EXPOSE 4181
CMD ["node", "index.mjs"]
