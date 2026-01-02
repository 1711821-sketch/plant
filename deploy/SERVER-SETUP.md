# Server Setup Guide - Interterminals Apps

Denne guide beskriver opsætningen af flere apps på samme server med separate domæner.

## Arkitektur Oversigt

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  System Nginx (SSL Termination)                         │
│  Port 80 (HTTP → HTTPS redirect)                        │
│  Port 443 (HTTPS)                                       │
└─────────────────────────────────────────────────────────┘
    │                               │
    ▼                               ▼
┌─────────────────────┐   ┌─────────────────────────────────┐
│ plant.interterminals│   │ skib.interterminals.app         │
│ → localhost:8080    │   │ → localhost:8081                │
└─────────────────────┘   └─────────────────────────────────┘
    │                               │
    ▼                               ▼
┌─────────────────────┐   ┌─────────────────────────────────┐
│ plant-frontend      │   │ ship-management-frontend        │
│ (Docker container)  │   │ (Docker container)              │
│ Nginx → :8080       │   │ Nginx → :8081                   │
└─────────────────────┘   └─────────────────────────────────┘
    │                               │
    ▼                               ▼
┌─────────────────────┐   ┌─────────────────────────────────┐
│ PM2 Backend         │   │ ship-management-backend         │
│ Node.js → :3001     │   │ (Docker) → :3000                │
└─────────────────────┘   │           │                     │
                          │           ▼                     │
                          │ ship-management-db (Postgres)   │
                          │ → :5432                         │
                          └─────────────────────────────────┘
```

## Server Information

- **Server**: itd1 (193.181.211.144)
- **OS**: Ubuntu/Debian Linux
- **Bruger**: root eller admin (med sudo)

## Nuværende Apps

| App | Domæne | Frontend Port | Backend Port | Placering |
|-----|--------|---------------|--------------|-----------|
| Plant (AnlægsPortalen) | plant.interterminals.app | 8080 | 3001 (PM2) | /var/www/plant |
| Skib (Ship Management) | skib.interterminals.app | 8081 | 3000 (Docker) | /root/SHIPLIST |

---

## System Nginx Konfiguration

Filen `/etc/nginx/sites-available/interterminals`:

```nginx
# HTTP - Redirect all to HTTPS
server {
    listen 80;
    server_name plant.interterminals.app skib.interterminals.app;
    return 301 https://$host$request_uri;
}

# HTTPS - plant.interterminals.app
server {
    listen 443 ssl;
    server_name plant.interterminals.app;

    ssl_certificate /etc/letsencrypt/live/plant.interterminals.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/plant.interterminals.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTPS - skib.interterminals.app
server {
    listen 443 ssl;
    server_name skib.interterminals.app;

    ssl_certificate /etc/letsencrypt/live/skib.interterminals.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/skib.interterminals.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Tilføj en Ny App - Step by Step

### 1. Opret SSL Certifikat

```bash
# Stop nginx midlertidigt
sudo systemctl stop nginx

# Opret certifikat (standalone mode)
sudo certbot certonly --standalone -d nyapp.interterminals.app

# Start nginx igen
sudo systemctl start nginx
```

### 2. Tilføj App til System Nginx

Tilføj til `/etc/nginx/sites-available/interterminals`:

```nginx
# HTTPS - nyapp.interterminals.app
server {
    listen 443 ssl;
    server_name nyapp.interterminals.app;

    ssl_certificate /etc/letsencrypt/live/nyapp.interterminals.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nyapp.interterminals.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8082;  # Ny unik port!
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Opdater også HTTP redirect server blokken:
```nginx
server {
    listen 80;
    server_name plant.interterminals.app skib.interterminals.app nyapp.interterminals.app;
    return 301 https://$host$request_uri;
}
```

### 3. Test og Genstart Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Docker Compose for Ny App

Opret `docker-compose.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    container_name: nyapp-frontend
    ports:
      - "8082:80"  # Matcher nginx proxy_pass port
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped

  backend:
    build: ./backend
    container_name: nyapp-backend
    ports:
      - "3002:3000"  # Unik ekstern port
    environment:
      NODE_ENV: production
      PORT: 3000
    restart: unless-stopped
```

### 5. Frontend Nginx Config (i Docker)

Opret `frontend/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://host.docker.internal:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads {
        proxy_pass http://host.docker.internal:3002/uploads;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 6. Frontend Dockerfile

```dockerfile
FROM nginx:alpine

# Copy built frontend files
COPY dist/ /usr/share/nginx/html/

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 7. Build og Deploy

```bash
# På lokal maskine - byg frontend
cd frontend
npm run build

# Upload til server
scp -r . root@itd1:/var/www/nyapp/

# På server - start containers
ssh root@itd1
cd /var/www/nyapp
docker compose up -d
```

---

## Port Oversigt

| Port | Bruges af | Type |
|------|-----------|------|
| 80 | System Nginx | HTTP (redirect) |
| 443 | System Nginx | HTTPS |
| 3000 | ship-management-backend | Docker |
| 3001 | plant-backend | PM2 |
| 5432 | PostgreSQL (ship) | Docker |
| 8080 | plant-frontend | Docker |
| 8081 | ship-management-frontend | Docker |

**Næste ledige porte**: 3002+ (backend), 8082+ (frontend)

---

## Nyttige Kommandoer

### Docker

```bash
# Se alle kørende containers
docker ps

# Se logs for en container
docker logs <container-name>
docker logs -f <container-name>  # Follow mode

# Genstart container
docker restart <container-name>

# Stop alle containers i en compose
cd /path/to/app && docker compose down

# Start containers
docker compose up -d

# Rebuild og start
docker compose up -d --build
```

### Nginx

```bash
# Test konfiguration
nginx -t

# Genstart nginx
systemctl restart nginx

# Se status
systemctl status nginx

# Se logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### SSL Certifikater

```bash
# Liste certifikater
certbot certificates

# Forny certifikater
certbot renew

# Forny specifikt certifikat
certbot renew --cert-name plant.interterminals.app
```

### PM2 (Plant backend)

```bash
# Liste processer
pm2 list

# Se logs
pm2 logs plant-backend

# Genstart
pm2 restart plant-backend

# Stop
pm2 stop plant-backend
```

---

## Troubleshooting

### "Port already in use"

```bash
# Find hvad der bruger porten
ss -tlnp | grep :8080
# eller
lsof -i :8080

# Stop processen
kill <PID>
# eller stop docker container
docker stop <container-id>
```

### "502 Bad Gateway"

1. Tjek at backend kører:
   ```bash
   docker ps | grep backend
   docker logs <backend-container>
   ```

2. Tjek at porten matcher i nginx config

3. Tjek firewall:
   ```bash
   iptables -L -n | grep <port>
   ```

### SSL Certifikat Fejl

```bash
# Tjek certifikat status
certbot certificates

# Forny manuelt
certbot renew --force-renewal --cert-name <domain>
```

### Container Kan Ikke Nå Host

Tilføj `extra_hosts` til docker-compose.yml:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## Backup

### Database Backup

```bash
# PostgreSQL (ship-management)
docker exec ship-management-db pg_dump -U shipuser ship_management > backup.sql

# Restore
docker exec -i ship-management-db psql -U shipuser ship_management < backup.sql
```

### Fil Backup

```bash
# Plant backend data
tar -czvf plant-backup.tar.gz /var/www/plant/backend/data /var/www/plant/backend/uploads

# Docker volumes
docker run --rm -v shiplist_uploads:/data -v $(pwd):/backup alpine tar -czvf /backup/uploads.tar.gz /data
```

---

## Kontakt / Support

Denne dokumentation blev oprettet: 2026-01-02

Server vedligeholdes af: [Dit navn/firma]
