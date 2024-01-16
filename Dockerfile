# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/engine/reference/builder/

ARG NODE_VERSION=21.1.0
ARG PNPM_VERSION=8.14.0

FROM node:${NODE_VERSION}-alpine

RUN addgroup app && adduser -S -G app app

USER app

WORKDIR /app

COPY package*.json pnpm-lock.yaml* ./

USER root

RUN chown -R app:app .

# Use production node environment by default.
ENV NODE_ENV production

ENV BASE_API_PATH ./assets/data/

# Install pnpm.
RUN npm install -g pnpm@${PNPM_VERSION}

RUN pnpm install

# Copy the rest of the source files into the image.
COPY . .

USER app

# Expose the port that the application listens on.
EXPOSE 3000

# Run the application.
CMD pnpm run dev
