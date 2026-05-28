FROM node:22-bookworm

ARG AUDIVERIS_DEB_URL=https://github.com/Audiveris/audiveris/releases/download/5.6.1/Audiveris-5.6.1-ubuntu24.04-x86_64.deb

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L "$AUDIVERIS_DEB_URL" -o /tmp/audiveris.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends /tmp/audiveris.deb \
    && rm -f /tmp/audiveris.deb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8080
ENV AUDIVERIS_BIN=audiveris
ENV OMR_MAX_FILE_MB=30
ENV OMR_TIMEOUT_MS=180000

EXPOSE 8080

CMD ["npm", "start"]
