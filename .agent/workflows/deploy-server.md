---
description: Build und Deploy der Web-App auf den Server
---
Dieses Workflow automatisiert den Prozess, die Web-App lokal zu bauen, zu packen, auf den Server zu laden und dort zu aktualisieren.

// turbo
1. Projekt lokal bauen:
   `rm -rf .next && npm run build`

// turbo
2. Dateien für den Server packen:
   `rm -f AbiturCloud_Server_Update.zip && zip -r AbiturCloud_Server_Update.zip .next public package.json package-lock.json next.config.ts src`

3. ZIP-Datei auf den Server hochladen:
   `expect -c 'spawn scp AbiturCloud_Server_Update.zip supabaseabi@192.168.178.92:~/; expect "Password:"; send "4565\r"; expect eof'`

4. Auf dem Server entpacken:
   `expect -c 'spawn ssh supabaseabi@192.168.178.92 "cd ~/abitur-cloud && rm -rf .next && unzip -o ~/AbiturCloud_Server_Update.zip"; expect "Password:"; send "4565\r"; expect eof'`

5. PM2 auf dem Server neu starten:
   `expect -c 'spawn ssh supabaseabi@192.168.178.92 "PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin pm2 restart all"; expect "Password:"; send "4565\r"; expect eof'`

// turbo
6. Lokale ZIP-Datei aufräumen:
   `rm AbiturCloud_Server_Update.zip`

