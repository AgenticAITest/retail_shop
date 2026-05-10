FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build the Vite frontend
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "run", "start"]
