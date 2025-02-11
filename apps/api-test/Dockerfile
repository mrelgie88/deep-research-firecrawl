# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code (including tests folder)
COPY . .

# (Optional) Define a default command, e.g. open a shell.
CMD ["sh"]
