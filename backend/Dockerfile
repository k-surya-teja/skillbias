FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

RUN mkdir -p uploads/resumes

EXPOSE 4000

CMD ["node", "dist/server.js"]
