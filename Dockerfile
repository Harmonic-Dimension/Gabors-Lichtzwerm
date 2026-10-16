# Lichtzwerm is een statische site: bouwen met Node, serveren met nginx.

# --- bouwen -----------------------------------------------------------------
FROM node:22-alpine AS bouw
WORKDIR /app

# Eerst alleen de afhankelijkheden, zodat deze laag in de cache blijft.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- serveren ---------------------------------------------------------------
FROM nginx:1.27-alpine AS serveren

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=bouw /app/dist /usr/share/nginx/html

# Fly stuurt verkeer naar deze poort (zie internal_port in fly.toml).
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
