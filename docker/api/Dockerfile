FROM node:20-alpine

WORKDIR /app/server

COPY server/package.json ./package.json
COPY server/.docker-deps ./.docker-deps

RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));for(const [k,v] of Object.entries(p.dependencies||{})){if(typeof v==='string'&&v.startsWith('file:'))delete p.dependencies[k];}fs.writeFileSync('package.json',JSON.stringify(p,null,2));" \
  && npm install --omit=dev --no-audit --no-fund --no-package-lock \
  && mkdir -p node_modules/@lemon/seasons-neurons node_modules/@lemon/media-hub-neurons \
  && tar -xzf .docker-deps/lemon-seasons-neurons-*.tgz --strip-components=1 -C node_modules/@lemon/seasons-neurons \
  && tar -xzf .docker-deps/lemon-media-hub-neurons-*.tgz --strip-components=1 -C node_modules/@lemon/media-hub-neurons \
  && rm -rf .docker-deps

COPY server/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/main.js"]
