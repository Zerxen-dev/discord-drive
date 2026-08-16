FROM node:18-alpine
WORKDIR /app
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
