FROM node:22.14-alpine

WORKDIR /app
COPY --chown=node:node scanner-proxy/index.mjs ./index.mjs

USER node
EXPOSE 3128
CMD ["node", "index.mjs"]
