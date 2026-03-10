# 🏙️ Skyrise - Educational City Builder

A collaborative educational game where students progress through learning levels while building a virtual city together. Each student's progress is visualized as a building in a shared skyline.

## Features

- **Real-time Collaboration**: WebSocket-based instant updates across all connected clients
- **Teacher Dashboard**: Create rooms, manage students, and track progress with an interactive skyline visualization
- **Student View**: Join rooms, complete assignments, and watch your building grow
- **Progress Tracking**: Visual progress through levels with reward system
- **Inventory System**: Collect items/badges as students complete levels
- **Configurable Levels**: JSON-based level configuration for easy customization

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **WebSockets**: Native WebSocket (ws library)
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Vanilla HTML/CSS/JavaScript with Canvas API

## Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the TypeScript code:

   ```bash
   npm run build
   ```

4. Copy the example environment file and edit as needed:

   ```bash
   cp .env.example .env
   ```

5. Start the server:

   ```bash
   npm start
   ```

6. Open your browser to `http://localhost:3000`

## Development

For development with auto-rebuild:

```bash
npm run dev
```

## Usage

### For Teachers

1. Navigate to the Teacher Dashboard
2. Click "Create New Room" to generate a 6-digit room code
3. Share the room code with students
4. Watch the skyline as students join
5. Select a student and mark their levels as complete when they finish assignments

### For Students

1. Navigate to the Student View
2. Enter the room code provided by your teacher
3. Enter your name
4. Read the current level assignment
5. Complete the assignment in real life
6. Wait for your teacher to mark it complete
7. Watch your building grow and collect rewards!

## Production Hosting

### Prerequisites

Ensure Node.js is installed on your Linux server:

```bash
node -v   # should be v18 or later
npm -v
```

### Build for Production

```bash
npm install
npm run build
```

### Keeping the Server Running with PM2

If you prefer a Node.js-native process manager:

```bash
npm install -g pm2
pm2 start dist/server.js --name skyrise
pm2 save                  # persist process list across reboots
pm2 startup               # follow the printed instructions to register PM2 with systemd
```

### Reverse Proxy with Apache

If Apache is already running on the server, use it as a reverse proxy — no need for a second web server.

Enable the required modules:

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers
sudo systemctl restart apache2
```

Create a virtual host config:

```bash
sudo nano /etc/apache2/sites-available/skyrise.conf
```

```apache
<VirtualHost *:80>
    ServerName yourdomain.com

    # Proxy WebSocket connections (must come before the general proxy rule)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) ws://localhost:3000/$1 [P,L]

    # Proxy all other requests
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```

Enable the site and reload Apache:

```bash
sudo a2ensite skyrise
sudo apache2ctl configtest
sudo systemctl reload apache2
```

> **WebSockets**: The `RewriteRule` with `proxy_wstunnel` is essential — without it the real-time skyline updates will not work through the proxy.

### TLS / HTTPS

Use [Certbot](https://certbot.eff.org/) to obtain a free Let's Encrypt certificate and have it automatically update the Apache config:

```bash
sudo certbot --apache -d yourdomain.com
```

Certbot installs a cron job / systemd timer to auto-renew the certificate before it expires. After running it, update the `RequestHeader` line in the SSL virtual host Certbot creates to read `"https"` instead of `"http"`.

### Firewall

Allow only the ports you need:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Apache Full'   # ports 80 and 443
sudo ufw enable
```

---

## Configuration

### Level Configuration

Edit `src/config/levels.json` to customize levels:

```json
[
  {
    "id": 1,
    "title": "Level Title",
    "description": "Brief description",
    "rewards": ["item_id_1", "item_id_2"]
  }
]
```

After editing, rebuild and restart:

```bash
npm run build
npm start
```
