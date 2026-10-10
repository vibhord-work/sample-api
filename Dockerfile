FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm cli --omit=dev
COPY app.js .
EXPOSE 3000
CMD ["npm", "start"]


