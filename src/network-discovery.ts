import * as net from "net";
import { execSync } from "child_process";
import * as os from "os";

interface NetworkDevice {
  ip: string;
  mac?: string;
  vendor?: string;
  ports: number[];
  isLikelyRoboVac: boolean;
}

export class NetworkDiscovery {
  private readonly TUYA_PORTS = [6668, 6667, 443];
  private readonly ANKER_EUFY_OUIS = [
    "34:ea:34", // Anker Innovations Limited
    "70:55:82", // Anker Innovations Limited
    "90:9a:4a", // Anker Innovations Limited
    "a4:c1:38", // Anker Innovations Limited
    "2c:aa:8e", // Anker Innovations Limited
  ];

  private getLocalNetworkRange(): string {
    const interfaces = os.networkInterfaces();

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;

      for (const addr of addrs) {
        if (addr.family === "IPv4" && !addr.internal) {
          const parts = addr.address.split(".");
          if (parts[0] === "192" && parts[1] === "168") {
            return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
          } else if (parts[0] === "10") {
            return "10.0.0.0/24";
          } else if (
            parts[0] === "172" &&
            parseInt(parts[1]) >= 16 &&
            parseInt(parts[1]) <= 31
          ) {
            return `172.${parts[1]}.0.0/16`;
          }
        }
      }
    }

    return "192.168.1.0/24"; // Default fallback
  }

  private async scanPort(
    ip: string,
    port: number,
    timeout: number = 1000
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();

      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.on("connect", () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });

      socket.connect(port, ip);
    });
  }

  private async getArpTable(): Promise<Map<string, string>> {
    const arpMap = new Map<string, string>();

    try {
      let arpOutput: string;
      const platform = os.platform();

      if (platform === "darwin" || platform === "linux") {
        arpOutput = execSync("arp -a", { encoding: "utf8", timeout: 5000 });
      } else if (platform === "win32") {
        arpOutput = execSync("arp -a", { encoding: "utf8", timeout: 5000 });
      } else {
        return arpMap;
      }

      const lines = arpOutput.split("\n");
      for (const line of lines) {
        // Parse different ARP formats
        let match;
        if (platform === "darwin") {
          // macOS format: hostname (192.168.1.100) at aa:bb:cc:dd:ee:ff [ether] on en0
          match = line.match(/\((\d+\.\d+\.\d+\.\d+)\) at ([a-fA-F0-9:]{17})/);
        } else if (platform === "linux") {
          // Linux format: 192.168.1.100 ether aa:bb:cc:dd:ee:ff C eth0
          match = line.match(/(\d+\.\d+\.\d+\.\d+).*?([a-fA-F0-9:]{17})/);
        } else if (platform === "win32") {
          // Windows format: 192.168.1.100    aa-bb-cc-dd-ee-ff     dynamic
          match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([a-fA-F0-9-]{17})/);
          if (match) {
            match[2] = match[2].replace(/-/g, ":"); // Convert Windows format to standard
          }
        }

        if (match) {
          arpMap.set(match[1], match[2].toLowerCase());
        }
      }
    } catch (error) {
      console.error("[DEBUG] Failed to get ARP table:", error);
    }

    return arpMap;
  }

  private isAnkerEufyDevice(mac: string): boolean {
    const macPrefix = mac.toLowerCase().substring(0, 8);
    return this.ANKER_EUFY_OUIS.some((oui) => macPrefix.startsWith(oui));
  }

  private async pingHost(ip: string): Promise<boolean> {
    try {
      const platform = os.platform();
      let pingCommand: string;

      if (platform === "win32") {
        pingCommand = `ping -n 1 -w 1000 ${ip}`;
      } else {
        pingCommand = `ping -c 1 -W 1 ${ip}`;
      }

      execSync(pingCommand, {
        encoding: "utf8",
        timeout: 2000,
        stdio: "pipe", // Suppress output
      });
      return true;
    } catch {
      return false;
    }
  }

  async discoverDevices(): Promise<NetworkDevice[]> {
    console.error("[DEBUG] Starting local network discovery...");

    const networkRange = this.getLocalNetworkRange();
    console.error(`[DEBUG] Scanning network range: ${networkRange}`);

    // Get current ARP table
    const arpTable = await this.getArpTable();
    console.error(`[DEBUG] Found ${arpTable.size} devices in ARP table`);

    // Generate IP range to scan
    const baseIp = networkRange.split("/")[0];
    const ipParts = baseIp.split(".");
    const ips: string[] = [];

    // Scan common ranges more efficiently
    for (let i = 1; i < 255; i++) {
      ips.push(`${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${i}`);
    }

    const devices: NetworkDevice[] = [];
    const batchSize = 20; // Process IPs in batches to avoid overwhelming the network

    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);

      const batchPromises = batch.map(async (ip) => {
        // First check if device responds to ping
        const isAlive = await this.pingHost(ip);
        if (!isAlive) return null;

        console.error(`[DEBUG] Device found at ${ip}, checking ports...`);

        // Check Tuya/Eufy ports
        const portResults = await Promise.all(
          this.TUYA_PORTS.map((port) => this.scanPort(ip, port, 500))
        );

        const openPorts = this.TUYA_PORTS.filter(
          (port, index) => portResults[index]
        );

        if (openPorts.length === 0) return null;

        const mac = arpTable.get(ip);
        const isAnkerDevice = mac ? this.isAnkerEufyDevice(mac) : false;

        const device: NetworkDevice = {
          ip,
          mac,
          vendor: isAnkerDevice ? "Anker/Eufy" : undefined,
          ports: openPorts,
          isLikelyRoboVac: isAnkerDevice && openPorts.includes(6668),
        };

        console.error(`[DEBUG] Potential device: ${JSON.stringify(device)}`);
        return device;
      });

      const batchResults = await Promise.all(batchPromises);
      const validDevices = batchResults.filter(
        (device): device is NetworkDevice => device !== null
      );
      devices.push(...validDevices);

      // Progress indicator
      console.error(
        `[DEBUG] Scanned ${Math.min(i + batchSize, ips.length)}/${
          ips.length
        } IPs...`
      );
    }

    // Sort by likelihood of being a RoboVac
    devices.sort((a, b) => {
      if (a.isLikelyRoboVac && !b.isLikelyRoboVac) return -1;
      if (!a.isLikelyRoboVac && b.isLikelyRoboVac) return 1;
      return 0;
    });

    console.error(
      `[DEBUG] Network discovery complete. Found ${devices.length} potential devices`
    );
    return devices;
  }

  async findRoboVacs(): Promise<NetworkDevice[]> {
    const allDevices = await this.discoverDevices();

    // Filter for devices that are likely RoboVacs
    return allDevices.filter(
      (device) =>
        device.isLikelyRoboVac ||
        (device.ports.includes(6668) && device.vendor === "Anker/Eufy")
    );
  }
}
