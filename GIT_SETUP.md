# 🔧 Git Setup Guide - Push til GitHub

## 📋 Forudsætning

Du har oprettet et repository på GitHub med navnet **"plan"**.

---

## 1️⃣ Installer Git (hvis ikke allerede installeret)

Download og installer Git fra: https://git-scm.com/download/win

Verificer installation:
```powershell
git --version
```

---

## 2️⃣ Konfigurer Git (første gang)

```powershell
# Åbn PowerShell eller Git Bash
cd C:\Users\edizu\Desktop\Cloud\Inspektioner

# Sæt dit navn og email (brug samme som på GitHub)
git config --global user.name "Dit Navn"
git config --global user.email "din-email@example.com"
```

---

## 3️⃣ Initialiser Git Repository Lokalt

```powershell
cd C:\Users\edizu\Desktop\Cloud\Inspektioner

# Initialiser Git
git init

# Tilføj alle filer (respekterer .gitignore)
git add .

# Opret første commit
git commit -m "Initial commit: AnlægsPortalen - LOTO inspection system"
```

---

## 4️⃣ Forbind til GitHub Repository

```powershell
# Tilføj GitHub som remote (ÆNDR URL til dit repo)
# Format: https://github.com/DIT-BRUGERNAVN/plan.git
git remote add origin https://github.com/DIT-BRUGERNAVN/plan.git

# Verificer remote
git remote -v
```

---

## 5️⃣ Push til GitHub

```powershell
# Push til main branch
git branch -M main
git push -u origin main
```

### Hvis du får authentication fejl:

GitHub kræver nu Personal Access Token i stedet for password.

**Option A: GitHub CLI (Anbefalet)**
```powershell
# Installer GitHub CLI
winget install --id GitHub.cli

# Login via browser
gh auth login
# Vælg: GitHub.com → HTTPS → Login with browser

# Push igen
git push -u origin main
```

**Option B: Personal Access Token**
1. Gå til GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generer ny token med `repo` permissions
3. Kopier token (gem det sikkert!)
4. Når du pusher, brug token som password

---

## 6️⃣ Verificer på GitHub

Besøg dit repository på GitHub:
```
https://github.com/DIT-BRUGERNAVN/plan
```

Du skulle nu se alle dine filer! ✅

---

## 🔄 Fremtidige Opdateringer (Workflow)

### Når du laver ændringer:

```powershell
cd C:\Users\edizu\Desktop\Cloud\Inspektioner

# Se hvilke filer der er ændret
git status

# Tilføj ændrede filer
git add .

# Commit med beskrivelse
git commit -m "Beskrivelse af ændringer"

# Push til GitHub
git push
```

### Eksempel commits:

```powershell
git commit -m "Fix: Rettet TYPE dropdown i sidebar"
git commit -m "Feature: Tilføjet moderne design theme"
git commit -m "Deploy: Opdateret nginx config til plant.interterminals.app"
```

---

## 🌿 Branches (Valgfrit men anbefalet)

### For udvikling:

```powershell
# Opret development branch
git checkout -b development

# Arbejd på features
# ... lav ændringer ...

git add .
git commit -m "Feature: Ny funktionalitet"
git push -u origin development
```

### Merge til main når klar:

```powershell
# Skift til main
git checkout main

# Merge development
git merge development

# Push til GitHub
git push
```

---

## 📦 Deploy fra GitHub til Webdock

Nu hvor projektet er på GitHub, kan du deploye direkte:

```bash
# SSH til Webdock server
ssh root@your-server-ip

# Klon repository
cd /var/www
git clone https://github.com/DIT-BRUGERNAVN/plan.git plant

# Følg resten af DEPLOYMENT_INTERTERMINALS.md
```

### Opdater på server:

```bash
# SSH til server
cd /var/www/plant

# Pull latest changes
git pull

# Genbyg
cd frontend && npm install && npm run build && cd ..
cd backend && npm install && npm run build && cd ..

# Genstart backend
pm2 restart plant-backend
```

---

## 🔐 Beskyt Sensitive Filer

Vigtige filer der IKKE skal pushes til GitHub (allerede i .gitignore):

- ✅ `.env` filer (environment variables)
- ✅ `backend/data/*.db` (database filer)
- ✅ `backend/uploads/*` (uploadede PDF'er)
- ✅ `node_modules/` (dependencies)
- ✅ `logs/` (log filer)

---

## 🆘 Troubleshooting

### Fejl: "fatal: remote origin already exists"

```powershell
git remote remove origin
git remote add origin https://github.com/DIT-BRUGERNAVN/plan.git
```

### Fejl: Authentication failed

Brug GitHub CLI eller Personal Access Token (se trin 5)

### Fjern fil fra Git der allerede er tracked:

```powershell
git rm --cached filnavn
git commit -m "Remove sensitive file"
```

### Se commit history:

```powershell
git log --oneline
```

---

## ✅ Checklist

- [ ] Git installeret
- [ ] Git konfigureret (name + email)
- [ ] Repository initialiseret lokalt
- [ ] .gitignore oprettet
- [ ] Første commit lavet
- [ ] Remote til GitHub tilføjet
- [ ] Pushet til GitHub
- [ ] Verificeret på GitHub website

---

God fornøjelse med Git! 🎉

**Tips**: Commit ofte, push dagligt, og skriv beskrivende commit messages!
