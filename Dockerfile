FROM node:26-slim
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "run", "preview"]
