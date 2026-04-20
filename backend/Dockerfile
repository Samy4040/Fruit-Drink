# Dockerfile für das Node.js Backend
FROM node:18-alpine

WORKDIR /app

# Zuerst nur package.json kopieren (für besseres Caching)
COPY package.json ./
RUN npm install --production

# Dann den Rest
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
