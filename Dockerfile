# Use a lightweight Node base image
FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first - this layer only rebuilds when deps change,
# not on every code edit, which makes rebuilds much faster during development
COPY package*.json ./
RUN npm install --omit=dev

# Now copy the actual application code
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
