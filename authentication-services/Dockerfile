FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 3002

CMD ["node", "src/index.js"]
