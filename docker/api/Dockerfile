FROM node:20-alpine

WORKDIR /app

RUN npm init -y >/dev/null 2>&1 && npm install pg --omit=dev --no-audit --no-fund

COPY server ./server

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.mjs"]
