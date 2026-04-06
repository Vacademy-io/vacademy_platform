# Vacademy — BigBlueButton Video Classes Server

Self-hosted BBB 3.0 on Hetzner CCX33 (8 vCPU / 32 GB / 240 GB) with start/stop to minimize costs.

## Cost

- **Running:** ~$0.133/h (~$3.19/day)
- **Stopped:** $0 (storage is free while server exists)
- Only pay for the hours you actually use

## Quick Start

### 1. Get a Hetzner API Token

- Go to [Hetzner Cloud Console](https://console.hetzner.cloud)
- Create a project (or use existing)
- **Security → SSH Keys** — add your public key
- **Security → API Tokens** — generate a Read & Write token

```bash
echo "your-token-here" > ~/.hetzner-bbb-token
```

### 2. Create the Server

```bash
chmod +x manage-server.sh
./manage-server.sh create
```

This creates a CCX33 in Nuremberg and prints the IP address.

### 3. Point DNS

Add an A record for your domain (e.g. `bbb.vacademy.io`) pointing to the server IP.

### 4. Install BBB

```bash
./manage-server.sh ssh
# On the server:
apt-get update && apt-get install -y wget
wget https://raw.githubusercontent.com/<your-repo>/main/bigbluebutton-server/setup-hetzner.sh
bash setup-hetzner.sh bbb.vacademy.io admin@vacademy.io
```

Wait ~20 min. Then run the post-install config:

```bash
wget https://raw.githubusercontent.com/<your-repo>/main/bigbluebutton-server/configure-bbb.sh
bash configure-bbb.sh
```

### 5. Get API Credentials

```bash
sudo bbb-conf --secret
```

Save the **URL** and **Secret** — you'll need them to connect the Vacademy backend later.

## Daily Operations

```bash
# Before classes start
./manage-server.sh start

# After classes end
./manage-server.sh stop

# Check if server is running
./manage-server.sh status
```

## File Structure

```
bigbluebutton-server/
├── README.md              # This file
├── manage-server.sh       # Start/stop/create Hetzner server
├── setup-hetzner.sh       # First-time BBB install (run on server)
├── configure-bbb.sh       # Post-install Vacademy config (run on server)
└── monitoring/
    └── health-check.sh    # Health check script (run on server via cron)
```

## Important Notes

- **DNS:** The server IP stays the same across start/stop cycles (Hetzner keeps it)
- **Storage:** 240 GB is fine for live classes. If you enable heavy recording, attach a Hetzner Volume
- **SSL:** Let's Encrypt cert auto-renews. If server is stopped for 60+ days, renew manually after restart
- **Capacity:** CCX33 handles ~100-150 concurrent users comfortably
