# 🚀 Deployment Guide - AnlægsPortalen til Webdock

## Forudsætninger

- En Webdock server (Ubuntu 20.04+ anbefalet)
- Domæne navn pegende til din server IP
- SSH adgang til serveren

## 1️⃣ Server Setup (På Webdock serveren)

### Opdater system og installer dependencies

```bash
# SSH ind på din Webdock server
ssh root@your-server-ip

# Opdater systemet
sudo apt update && sudo apt upgrade -y

# Installer Node.js (v20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installer build tools
sudo apt install -y build-essential

# Installer PM2 (process manager)
sudo npm install -g pm2

# Installer Nginx
sudo apt install -y nginx

# Installer Git
sudo apt install -y git
```

### Opret application directory

```bash
# Opret directory
sudo mkdir -p /var/www/anlaegsportalen
sudo chown -R $USER:$USER /var/www/anlaegsportalen

# Naviger til directory
cd /var/www/anlaegsportalen
```

## 2️⃣ Deploy Applikationen

### Option A: Via Git (Anbefalet)

```bash
# Klon repository (hvis du har det på GitHub/GitLab)
git clone https://your-repo-url.git .

# Eller Option B: Upload files via SFTP/SCP fra din lokale maskine
# scp -r C:\Users\edizu\Desktop\Cloud\Inspektioner root@your-server-ip:/var/www/anlaegsportalen
```

### Installer dependencies

```bash
cd /var/www/anlaegsportalen

# Installer alle dependencies
npm run install:all

# ELLER manuelt:
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Byg frontend

```bash
cd /var/www/anlaegsportalen
npm run build

# Dette bygger frontend til: frontend/dist/
```

### Kompiler backend TypeScript

```bash
cd /var/www/anlaegsportalen/backend
npm run build

# Dette kompilerer TypeScript til: backend/dist/
```

## 3️⃣ Konfigurer Environment Variables

```bash
cd /var/www/anlaegsportalen

# Opret .env fil i backend directory
nano backend/.env
```

Tilføj følgende indhold:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=YOUR_SUPER_SECURE_RANDOM_STRING_HERE_CHANGE_THIS
CORS_ORIGIN=https://yourdomain.com
MAX_FILE_SIZE=50000000
UPLOAD_DIR=./uploads
```

**VIGTIGT**: Generer en sikker JWT_SECRET:

```bash
# Generer random string til JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 4️⃣ Opret nødvendige directories

```bash
cd /var/www/anlaegsportalen

# Opret logs directory for PM2
mkdir -p logs

# Sørg for at uploads og data directories eksisterer
mkdir -p backend/uploads
mkdir -p backend/data

# Sæt korrekte permissions
chmod -R 755 backend/uploads
chmod -R 755 backend/data
```

## 5️⃣ Start Backend med PM2

```bash
cd /var/www/anlaegsportalen

# Start backend
pm2 start ecosystem.config.js

# Gem PM2 process list
pm2 save

# Sæt PM2 til at starte ved server reboot
pm2 startup

# Check status
pm2 status

# Se logs
pm2 logs anlaegsportalen-backend
```

## 6️⃣ Konfigurer Nginx

```bash
# Kopier nginx config
sudo cp nginx.conf /etc/nginx/sites-available/anlaegsportalen

# Rediger og tilpas domæne navn
sudo nano /etc/nginx/sites-available/anlaegsportalen
# ÆNDR: server_name yourdomain.com www.yourdomain.com

# Aktiver site
sudo ln -s /etc/nginx/sites-available/anlaegsportalen /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Genstart nginx
sudo systemctl restart nginx

# Enable nginx at boot
sudo systemctl enable nginx
```

## 7️⃣ Opsæt SSL med Let's Encrypt (Anbefalet)

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx

# Få SSL certifikat
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot vil automatisk opdatere nginx config med SSL
# Og opsætte auto-renewal

# Test auto-renewal
sudo certbot renew --dry-run
```

## 8️⃣ Firewall Setup

```bash
# Tillad SSH, HTTP og HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Check status
sudo ufw status
```

## 9️⃣ Opdater Frontend API URL

Hvis dit domæne er anderledes end localhost, opdater frontend API URL:

```bash
cd /var/www/anlaegsportalen/frontend

# Opret .env.production fil
nano .env.production
```

Tilføj:

```env
VITE_API_URL=https://yourdomain.com
```

Så genbyg frontend:

```bash
cd /var/www/anlaegsportalen
npm run build
```

## 🔟 Verificer Deployment

1. **Besøg dit domæne**: https://yourdomain.com
2. **Check backend health**: https://yourdomain.com/api/health
3. **Test login**: admin / admin123

## 📊 Monitoring & Vedligeholdelse

### PM2 Commands

```bash
# Se status
pm2 status

# Se logs
pm2 logs

# Genstart application
pm2 restart anlaegsportalen-backend

# Stop application
pm2 stop anlaegsportalen-backend

# Monitor resources
pm2 monit
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Genstart nginx
sudo systemctl restart nginx

# Se logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Opdater Applikationen

```bash
cd /var/www/anlaegsportalen

# Pull latest changes (hvis using Git)
git pull

# Geninstaller dependencies (hvis package.json ændret)
npm run install:all

# Genbyg frontend
npm run build

# Genbyg backend
cd backend && npm run build && cd ..

# Genstart backend
pm2 restart anlaegsportalen-backend
```

## 🐛 Troubleshooting

### Backend starter ikke

```bash
# Check PM2 logs
pm2 logs anlaegsportalen-backend --lines 100

# Check om port 3001 er i brug
sudo lsof -i :3001

# Check environment variables
pm2 env anlaegsportalen-backend
```

### Frontend viser 404 errors

```bash
# Check nginx configuration
sudo nginx -t

# Check om dist folder eksisterer
ls -la /var/www/anlaegsportalen/frontend/dist/

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Database errors

```bash
# Check om database file eksisterer
ls -la /var/www/anlaegsportalen/backend/data/

# Check permissions
chmod 755 /var/www/anlaegsportalen/backend/data
```

### Upload fejler

```bash
# Check uploads directory permissions
chmod -R 755 /var/www/anlaegsportalen/backend/uploads

# Check nginx max upload size
sudo nano /etc/nginx/sites-available/anlaegsportalen
# Sørg for: client_max_body_size 50M;
```

## 🔒 Sikkerhed Best Practices

1. **Ændre default passwords** i applikationen
2. **Opdater JWT_SECRET** til en sikker værdi
3. **Enable firewall** (ufw)
4. **Regelmæssige system opdateringer**: `sudo apt update && sudo apt upgrade`
5. **Backup database regelmæssigt**: `backend/data/inspektioner.db`
6. **Monitor logs** for mistænkelig aktivitet
7. **Brug HTTPS** (Let's Encrypt)
8. **Begræns SSH adgang** til specifikke IP'er hvis muligt

## 📦 Backup Strategy

```bash
# Backup script (opret som /var/www/scripts/backup.sh)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/www/backups"
mkdir -p $BACKUP_DIR

# Backup database
cp /var/www/anlaegsportalen/backend/data/inspektioner.db $BACKUP_DIR/db_$DATE.db

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/anlaegsportalen/backend/uploads

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

Automatiser med cron:

```bash
# Rediger crontab
crontab -e

# Tilføj (backup hver dag kl 02:00)
0 2 * * * /var/www/scripts/backup.sh >> /var/log/anlaegsportalen-backup.log 2>&1
```

## ✅ Checklist

- [ ] Server opdateret
- [ ] Node.js, PM2, Nginx installeret
- [ ] Application uploaded
- [ ] Dependencies installeret
- [ ] Frontend bygget
- [ ] Backend kompileret
- [ ] Environment variables konfigureret
- [ ] PM2 startet og gemt
- [ ] Nginx konfigureret
- [ ] SSL certifikat installeret
- [ ] Firewall konfigureret
- [ ] Domæne peger til server
- [ ] Application tilgængelig via browser
- [ ] Login virker
- [ ] PDF upload virker
- [ ] Backup strategi implementeret

## 🆘 Support

Hvis du støder på problemer, check:
1. PM2 logs: `pm2 logs`
2. Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
3. System logs: `sudo journalctl -xe`

God fornøjelse med AnlægsPortalen! 🎉
