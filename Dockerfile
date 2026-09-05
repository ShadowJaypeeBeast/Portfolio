# Minimal image for running the portfolio + admin server anywhere that can
# run a container: a plain VPS with Docker, a Pterodactyl Docker-based egg,
# Fly.io, Railway, Render, etc.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached unless package.json changes
COPY package*.json ./
RUN npm install --omit=dev

# Now copy the rest of the app
COPY . .
RUN mkdir -p public/uploads data

EXPOSE 3000

# ADMIN_PASSWORD and SESSION_SECRET are required — pass them with
# `docker run -e` or your platform's environment variable settings.
# See .env.example for what's needed.
CMD ["node", "server.js"]
