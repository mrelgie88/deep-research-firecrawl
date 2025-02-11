# Use Node.js to build the frontend
FROM node:18-alpine AS builder
WORKDIR /app

# Ensure package-lock.json exists before copying it
COPY package.json ./
RUN if [ -f package-lock.json ]; then cp package-lock.json ./; fi
RUN npm install

# Now copy the rest of the project
COPY . .

# Build the frontend
RUN npm run build

# Use Nginx to serve the built frontend
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 8081
CMD ["nginx", "-g", "daemon off;"]

