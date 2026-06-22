# NovaNest dropshipping store
FROM node:22-alpine

WORKDIR /app

# Install production dependencies first (better layer caching)
COPY package.json ./
RUN npm install --omit=dev

# App source
COPY . .

# Persist the SQLite database outside the image via this volume
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Basic container health check hits the app's /healthz endpoint
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--no-warnings", "server.js"]
