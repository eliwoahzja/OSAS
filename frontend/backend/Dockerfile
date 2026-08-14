# ============================================================
# Render deployment for the PHP REST API (Render has no native
# PHP runtime — this Docker image runs one).
# ============================================================
FROM php:8.2-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libcurl4-openssl-dev \
    libzip-dev \
    unzip \
    && docker-php-ext-install curl zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# API code (no build step — plain PHP)
COPY . .

# Static files are served by Vercel; this image serves only /api.
EXPOSE 8080

CMD ["php", "-S", "0.0.0.0:8080", "-t", "/app", "/app/router.php"]
