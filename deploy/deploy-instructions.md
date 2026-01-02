# Deployment Instructions for plant.interterminals.app

## Problem
Currently `ship-management-frontend` container has ports 80/443 but doesn't route traffic correctly to both domains. We need a system Nginx as reverse proxy.

## Solution Architecture
```
Internet → System Nginx (80/443 + SSL) → Docker containers
                                         ├── plant-frontend:8080
                                         └── ship-frontend:8081
```

## Step 1: Stop Docker containers using ports 80/443

```bash
# SSH to server
ssh root@itd1

# Check what's using ports 80/443
docker ps

# Stop the ship-management containers temporarily
cd /root/SHIPLIST
docker-compose down
```

## Step 2: Install system Nginx (if not installed)

```bash
apt update
apt install nginx -y
```

## Step 3: Configure system Nginx as reverse proxy

```bash
# Copy the nginx-proxy.conf to server
# Then on server:
cp nginx-proxy.conf /etc/nginx/sites-available/interterminals
ln -sf /etc/nginx/sites-available/interterminals /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Restart nginx
systemctl restart nginx
systemctl enable nginx
```

## Step 4: Update Docker containers to use different ports

### Plant app (port 8080) - already correct
The docker-compose.yml in Inspektioner folder already uses port 8080.

### Skib app - update to use port 8081
Edit `/root/SHIPLIST/docker-compose.yml` and change frontend ports from `80:80` and `443:443` to:
```yaml
frontend:
  ports:
    - "8081:80"
```

Remove the SSL configuration from the Docker container since system Nginx handles SSL.

## Step 5: Start containers

```bash
# Start plant app
cd /root/plant  # or wherever Inspektioner is deployed
docker-compose up -d

# Start skib app
cd /root/SHIPLIST
docker-compose up -d
```

## Step 6: Verify

```bash
# Test plant app
curl -s https://plant.interterminals.app | grep -o '<title>.*</title>'
# Should show: <title>AnlægsPortalen</title>

# Test skib app
curl -s https://skib.interterminals.app | grep -o '<title>.*</title>'
# Should show the ship management title
```

## Quick Commands (Run these on server)

```bash
# 1. Stop all Docker containers using web ports
cd /root/SHIPLIST && docker-compose down

# 2. Install and configure system Nginx
apt update && apt install nginx -y

# 3. Create nginx config
cat > /etc/nginx/sites-available/interterminals << 'NGINX'
# HTTP - Redirect all to HTTPS
server {
    listen 80;
    server_name plant.interterminals.app skib.interterminals.app;
    return 301 https://$host$request_uri;
}

# HTTPS - plant.interterminals.app
server {
    listen 443 ssl http2;
    server_name plant.interterminals.app;

    ssl_certificate /etc/letsencrypt/live/plant.interterminals.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/plant.interterminals.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

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
    listen 443 ssl http2;
    server_name skib.interterminals.app;

    ssl_certificate /etc/letsencrypt/live/skib.interterminals.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/skib.interterminals.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

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
NGINX

# 4. Enable the site
ln -sf /etc/nginx/sites-available/interterminals /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 5. Test and restart nginx
nginx -t && systemctl restart nginx

# 6. Update SHIPLIST docker-compose to use port 8081
# Edit /root/SHIPLIST/docker-compose.yml manually:
# Change frontend ports from "80:80" to "8081:80"
# Remove port "443:443" line

# 7. Start containers
cd /root/plant && docker-compose up -d
cd /root/SHIPLIST && docker-compose up -d
```
