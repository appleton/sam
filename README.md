# Eufy RoboVac MCP Server

A Model Context Protocol (MCP) server for controlling Eufy RoboVac devices. Built with TypeScript and Vite.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Get your device credentials:
   - Device ID and Local Key from your Eufy Home app or network analysis
   - Find your RoboVac's IP address on your network

## Development

Run in development mode with hot reload:
```bash
npm run dev
```

Type checking:
```bash
npm run typecheck
```

## Production

Build the project:
```bash
npm run build
```

Run the built server:
```bash
npm start
```

## Available Tools

### Connection & Setup
- `robovac_scan_network` - Scan local network for RoboVac devices (🆕 no credentials needed!)
- `robovac_connect_discovered` - Connect to a discovered device using its IP
- `robovac_connect` - Manual connection using device credentials
- `robovac_auto_initialize` - Cloud-based discovery (⚠️ May not work due to API changes)

### Basic Controls  
- `robovac_start_cleaning` - Start cleaning cycle
- `robovac_stop_cleaning` - Stop cleaning cycle
- `robovac_return_home` - Return to charging dock
- `robovac_play` - Start/resume cleaning
- `robovac_pause` - Pause cleaning
- `robovac_find_robot` - Make the RoboVac beep to locate it

### Advanced Controls
- `robovac_set_work_mode` - Set cleaning mode (AUTO, SMALL_ROOM, SPOT, EDGE, NO_SWEEP)
- `robovac_set_clean_speed` - Set suction power (STANDARD, BOOST_IQ, MAX, NO_SUCTION)

### Status Information
- `robovac_get_status` - Get current device status (legacy)
- `robovac_get_battery` - Get battery level
- `robovac_get_error_code` - Get current error code
- `robovac_get_work_mode` - Get current cleaning mode
- `robovac_get_clean_speed` - Get current suction level
- `robovac_get_work_status` - Get detailed work status
- `robovac_get_play_pause` - Get play/pause state

### Utility Functions
- `robovac_format_status` - Print formatted status to console
- `robovac_get_all_statuses` - Get all status information at once

## Usage with MCP Client

### 🆕 Easy Setup with Network Scan (Recommended)

1. **Scan your local network to find RoboVac devices:**
```
robovac_scan_network()
```
This will show you:
- All devices with open Tuya/Eufy ports (6668, 6667, 443)
- Devices with Anker/Eufy MAC addresses (⭐ likely RoboVacs)
- IP addresses of potential devices

2. **Connect to a discovered device:**
```
robovac_connect_discovered(ip="192.168.1.100", deviceId="your_device_id", localKey="your_local_key")
```

### Getting Device Credentials
You still need the device ID and local key:

1. **Try community tools:**
   - `eufy-security-client` or similar projects
   - Check GitHub for updated credential grabbers

2. **Network traffic analysis:**
   - Monitor Eufy app network traffic
   - Use tools like Wireshark or Charles Proxy

3. **Router/firmware methods:**
   - Some routers log device information
   - Check if your RoboVac firmware exposes credentials

### Alternative Methods

**Manual connection (if you have all credentials):**
```
robovac_connect(deviceId="your_device_id", localKey="your_local_key", ip="192.168.1.100")
```

**Cloud discovery (may not work due to API changes):**
```
robovac_auto_initialize(email="your@email.com", password="your_password")
```

### Control Your RoboVac
Once connected, use any control tools:
```
robovac_start_cleaning()
robovac_get_status()
robovac_return_home()
robovac_set_work_mode(mode="SPOT")
robovac_set_clean_speed(speed="MAX")
```