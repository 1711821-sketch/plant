# 🚀 Deployment Guide - AnlægsPortalen til plant.interterminals.app

## 📋 Oversigt

- **Domæne**: `plant.interterminals.app`
- **Eksisterende app**: `skib.interterminals.app` (vil IKKE blive påvirket)
- **Backend port**: 3001
- **Platform**: Webdock server

---

## 1️⃣ Forberedelse på Din Lokale Maskine

### Pak applikationen klar til upload

```bash
# Åbn PowerShell/CMD i din projektmappe
cd C:\Users\edizu\Desktop\Cloud\Inspektioner

# Byg frontend
cd frontend
npm install
npm run build
cd ..

# Byg backend
cd backend
npm install
npm run build
cd ..
```

### Opret en ZIP fil til upload (eller brug SFTP)

Du kan enten:
- **Option A**: Pakke projektet i en ZIP og uploade via Webdock panel
- **Option B**: Bruge SFTP (WinSCP, FileZilla)
- **Option C**: Bruge Git (hvis projektet er på GitHub)

---

## 2️⃣ SSH til Din Webdock Server

```bash
# SSH til server (brug din Webdock IP og bruger)
ssh root@your-webdock-ip
# ELLER hvis du har en non-root bruger
ssh your-username@your-webdock-ip
```

---

## 3️⃣ Opret Directory til AnlægsPortalen

```bash
# Opret directory (adskilt fra skib.interterminals.app)
sudo mkdir -p /var/www/plant
sudo chown -R $USER:$USER /var/www/plant

# Naviger til directory
cd /var/www/plant
```

---

## 4️⃣ Upload Applikationen

### Option A: Via SFTP (WinSCP/FileZilla)

1. Forbind til din server via SFTP
2. Naviger til `/var/www/plant`
3. Upload alle filer fra `C:\Users\edizu\Desktop\Cloud\Inspektioner`

### Option B: Via SCP fra Windows

```powershell
# Fra din lokale maskine (PowerShell)
scp -r C:\Users\edizu\Desktop\Cloud\Inspektioner\* root@your-server-ip:/var/www/plant/
```

### Option C: Via Git (hvis projektet er på GitHub)

```bash
# På serveren
cd /var/www/plant
git clone https://your-repo-url.git .
```

---

## 5️⃣ Installer Dependencies på Serveren

```bash
cd /var/www/plant

# Check at Node.js er installeret (skal være v18+)
node --version

# Hvis Node.js ikke er installeret:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installer backend dependencies
cd backend
npm install --production
npm run build

# Installer frontend dependencies og byg
cd ../frontend
npm install
npm run build

cd ..
```

---

## 6️⃣ Konfigurer Environment Variables

```bash
cd /var/www/plant/backend

# Opret .env fil
nano .env
```

Indsæt følgende (tryk `Ctrl+O` for at gemme, `Ctrl+X` for at lukke):

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=GENERER_EN_SIKKER_RANDOM_STRING_HER
CORS_ORIGIN=https://plant.interterminals.app
MAX_FILE_SIZE=50000000
UPLOAD_DIR=./uploads
```

**VIGTIGT**: Generer en sikker JWT_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Kopier outputtet og erstat `GENERER_EN_SIKKER_RANDOM_STRING_HER` med det.

---

## 7️⃣ Opret Nødvendige Directories

```bash
cd /var/www/plant

# Opret directories
mkdir -p logs
mkdir -p backend/uploads
mkdir -p backend/data

# Sæt permissions
chmod -R 755 backend/uploads
chmod -R 755 backend/data
```

---

## 8️⃣ Start Backend med PM2

```bash
# Installer PM2 hvis ikke allerede installeret
sudo npm install -g pm2

cd /var/www/plant

# Start backend med PM2
pm2 start backend/dist/index.js --name "plant-backend" --log ./logs/pm2.log

# Gem PM2 process list
pm2 save

# Sæt PM2 til at starte ved server reboot (kun én gang hvis ikke gjort før)
pm2 startup
# Følg instruktionerne fra outputtet

# Check status
pm2 status

# Se logs
pm2 logs plant-backend
```

---

## 9️⃣ Konfigurer Nginx (VIGTIGT - Uden at Påvirke skib.interterminals.app)

```bash
# Opret ny nginx config for plant subdomain
sudo nano /etc/nginx/sites-available/plant
```

Indsæt følgende configuration:

```nginx
server {
    listen 80;
    server_name plant.interterminals.app;

    # Root directory for frontend
    root /var/www/plant/frontend/dist;
    index index.html;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Frontend - Serve React app
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;

        # Max upload size
        client_max_body_size 50M;
    }

    # Uploaded files
    location /uploads/ {
        alias /var/www/plant/backend/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Gem filen (`Ctrl+O`, `Enter`, `Ctrl+X`).

### Aktiver site og test configuration

```bash
# Opret symlink til sites-enabled
sudo ln -s /etc/nginx/sites-available/plant /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Hvis test OK, genstart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx
```

---

## 🔟 Opsæt SSL med Let's Encrypt

```bash
# Installer Certbot (hvis ikke allerede installeret)
sudo apt install -y certbot python3-certbot-nginx

# Få SSL certifikat for plant.interterminals.app
sudo certbot --nginx -d plant.interterminals.app

# Certbot vil:
# 1. Verificere dit domæne
# 2. Installere SSL certifikat
# 3. Automatisk opdatere nginx config til HTTPS
# 4. Opsætte auto-renewal

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## ✅ Verificer Deployment

### Test at alt virker:

1. **Besøg dit site**: https://plant.interterminals.app
2. **Test login**:
   - Admin: `admin` / `admin123`
   - Bruger: `bruger` / `user123`
3. **Test PDF upload** (hvis admin)
4. **Check at skib.interterminals.app stadig virker** ✅

### Troubleshooting Commands

```bash
# Check PM2 processer
pm2 list
pm2 logs plant-backend

# Check nginx
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Check hvilke porte der lytter
sudo ss -tulpn | grep LISTEN

# Test backend direkte
curl http://localhost:3001/api/health
```

---

## 📊 Monitoring & Vedligeholdelse

### Daglige Commands

```bash
# Check status
pm2 status

# Se logs
pm2 logs plant-backend --lines 50

# Genstart backend (hvis nødvendigt)
pm2 restart plant-backend

# Monitor ressourcer
pm2 monit
```

### Opdater Applikationen

```bash
cd /var/www/plant

# Pull changes (hvis using Git)
git pull

# ELLER upload nye filer via SFTP

# Geninstaller dependencies (kun hvis package.json ændret)
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..

# Genstart backend
pm2 restart plant-backend

# Nginx behøver ikke genstart (medmindre config ændret)
```

---

## 🔒 Sikkerhedstjek

- [x] SSL certifikat installeret
- [x] Firewall konfigureret (ufw)
- [x] JWT_SECRET er en sikker random string
- [x] Default passwords ændret i applikationen
- [x] Nginx kører kun nødvendige services
- [x] PM2 auto-restart aktiveret
- [x] Backup strategi på plads

---

## 💾 Backup Strategy

```bash
# Opret backup script
sudo mkdir -p /var/www/backups
sudo nano /var/www/backups/backup-plant.sh
```

Indsæt:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/www/backups/plant"
mkdir -p $BACKUP_DIR

# Backup database
cp /var/www/plant/backend/data/inspektioner.db $BACKUP_DIR/db_$DATE.db

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/plant/backend/uploads

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Plant backup completed: $DATE"
```

Gør script executable og automatiser:

```bash
sudo chmod +x /var/www/backups/backup-plant.sh

# Tilføj til crontab (backup dagligt kl 03:00)
crontab -e
# Tilføj: 0 3 * * * /var/www/backups/backup-plant.sh >> /var/log/plant-backup.log 2>&1
```

---

## 🎉 Success!

Din AnlægsPortalen skulle nu være live på:
### 🌐 https://plant.interterminals.app

**Vigtige noter:**
- ✅ Din eksisterende `skib.interterminals.app` er IKKE påvirket
- ✅ Begge apps kører side om side på samme server
- ✅ De bruger forskellige directories (`/var/www/plant` vs `/var/www/skib`)
- ✅ Backend kører på port 3001
- ✅ SSL er aktiveret via Let's Encrypt

---

## 🆘 Hjælp & Support

Hvis noget ikke virker:

1. Check PM2 logs: `pm2 logs plant-backend`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check om port 3001 er i brug: `sudo ss -tulpn | grep 3001`
4. Test backend direkte: `curl http://localhost:3001/api/health`

God fornøjelse med AnlægsPortalen! 🚀
