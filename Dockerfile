FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY game.js server.js ./
COPY public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
