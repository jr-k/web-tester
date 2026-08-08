FROM node:alpine AS base

WORKDIR /app
ENV PORT=8080
ENV DATA_FILE=/app/data/site.json

FROM base AS development

COPY server.mjs ./
COPY src/ ./src/
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 8080
CMD ["node", "--watch", "server.mjs"]

FROM base AS production

COPY --chown=node:node server.mjs ./
COPY --chown=node:node src/ ./src/
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
