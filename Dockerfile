FROM node:20-alpine

# Installer les outils de build pour sqlite3 (nécessite des bindings natifs)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copier les fichiers de dépendances en premier (meilleure mise en cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copier le code source
COPY src/ ./src/
COPY public/ ./public/

# Créer les répertoires pour les volumes
RUN mkdir -p /app/data /app/logs /app/config

EXPOSE 3000

CMD ["npm", "start"]
