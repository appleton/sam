import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { RoboVac, WorkMode, CleanSpeed } from "eufy-robovac";
import { NetworkDiscovery } from "./network-discovery.js";

interface RoboVacConfig {
  deviceId: string;
  localKey: string;
  ip?: string;
}

class RoboVacMCPServer {
  private server: Server;
  private robovac: RoboVac | null = null;
  private networkDiscovery: NetworkDiscovery;

  constructor() {
    this.server = new Server(
      {
        name: "eufy-robovac-mcp-server",
        version: "0.2.0",
      },
      {
        capabilities: {
          tools: {
            listChanged: false,
          },
          logging: {},
        },
      }
    );

    this.networkDiscovery = new NetworkDiscovery();
    this.setupHandlers();
  }

  private async initializeRoboVac(
    deviceId: string,
    localKey: string,
    ip?: string
  ): Promise<boolean> {
    try {
      this.robovac = new RoboVac({
        deviceId: deviceId,
        localKey: localKey,
        ip: ip || "192.168.1.100",
      });
      await this.robovac.connect();
      return true;
    } catch (error) {
      console.error("Failed to initialize RoboVac:", error);
      return false;
    }
  }

  private ensureRoboVacInitialized(): void {
    if (!this.robovac) {
      throw new Error(
        "RoboVac not initialized. Please run robovac_auto_initialize or robovac_connect first."
      );
    }
  }

  private async discoverBestRoboVacIP(): Promise<string | null> {
    try {
      console.error("[DEBUG] Auto-discovering RoboVac devices...");
      const devices = await this.networkDiscovery.discoverDevices();

      if (devices.length === 0) {
        console.error("[DEBUG] No devices found during auto-discovery");
        return null;
      }

      // Filter for likely RoboVac devices
      const likelyRoboVacs = devices.filter((device) => device.isLikelyRoboVac);

      if (likelyRoboVacs.length > 0) {
        const bestDevice = likelyRoboVacs[0]; // Take the first likely device
        console.error(
          `[DEBUG] Found likely RoboVac at ${bestDevice.ip} (MAC: ${bestDevice.mac}, Vendor: ${bestDevice.vendor})`
        );
        return bestDevice.ip;
      }

      // If no likely RoboVacs, try devices with port 6668 open
      const devicesWithPort6668 = devices.filter((device) =>
        device.ports.includes(6668)
      );

      if (devicesWithPort6668.length > 0) {
        const potentialDevice = devicesWithPort6668[0];
        console.error(
          `[DEBUG] Found potential RoboVac at ${potentialDevice.ip} with port 6668 open`
        );
        return potentialDevice.ip;
      }

      console.error("[DEBUG] No suitable RoboVac candidates found");
      return null;
    } catch (error) {
      console.error(
        `[DEBUG] Auto-discovery failed: ${(error as Error).message}`
      );
      return null;
    }
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async (): Promise<{ tools: Tool[] }> => ({
        tools: [
          {
            name: "robovac_set_work_mode",
            description: "Set the cleaning mode of the robovac",
            inputSchema: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  description: "The work mode to set",
                  enum: ["AUTO", "SMALL_ROOM", "SPOT", "EDGE", "NO_SWEEP"],
                },
              },
              required: ["mode"],
            },
          },
          {
            name: "robovac_set_clean_speed",
            description: "Set the suction speed of the robovac",
            inputSchema: {
              type: "object",
              properties: {
                speed: {
                  type: "string",
                  description: "The cleaning speed to set",
                  enum: ["STANDARD", "BOOST_IQ", "MAX", "NO_SUCTION"],
                },
              },
              required: ["speed"],
            },
          },
          {
            name: "robovac_play",
            description: "Start/resume robovac cleaning",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "robovac_pause",
            description: "Pause robovac cleaning",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "robovac_find_robot",
            description: "Make the robovac beep to help locate it",
            inputSchema: {
              type: "object",
              properties: {
                enable: {
                  type: "boolean",
                  description: "Whether to enable or disable find robot mode",
                  default: true,
                },
              },
            },
          },
          {
            name: "robovac_get_error_code",
            description: "Get the current error code of the robovac",
            inputSchema: {
              type: "object",
              properties: {
                force: {
                  type: "boolean",
                  description: "Force refresh of cached data",
                  default: false,
                },
              },
            },
          },
          {
            name: "robovac_get_work_mode",
            description: "Get the current work mode of the robovac",
            inputSchema: {
              type: "object",
              properties: {
                force: {
                  type: "boolean",
                  description: "Force refresh of cached data",
                  default: false,
                },
              },
            },
          },
          {
            name: "robovac_get_clean_speed",
            description: "Get the current cleaning speed of the robovac",
            inputSchema: {
              type: "object",
              properties: {
                force: {
                  type: "boolean",
                  description: "Force refresh of cached data",
                  default: false,
                },
              },
            },
          },
          {
            name: "robovac_get_work_status",
            description: "Get the current work status of the robovac",
            inputSchema: {
              type: "object",
              properties: {
                force: {
                  type: "boolean",
                  description: "Force refresh of cached data",
                  default: false,
                },
              },
            },
          },
          {
            name: "robovac_get_play_pause",
            description: "Get the current play/pause state of the robovac",
            inputSchema: {
              type: "object",
              properties: {
                force: {
                  type: "boolean",
                  description: "Force refresh of cached data",
                  default: false,
                },
              },
            },
          },
          {
            name: "robovac_format_status",
            description:
              "Get a formatted display of all robovac status information",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "robovac_get_all_statuses",
            description: "Get all status information from the robovac at once",
            inputSchema: {
              type: "object",
              properties: {
                force: {
                  type: "boolean",
                  description: "Force refresh of cached data",
                  default: false,
                },
              },
            },
          },
          {
            name: "robovac_auto_initialize",
            description:
              "Automatically discover and initialize the first RoboVac device found",
            inputSchema: {
              type: "object",
              properties: {
                email: {
                  type: "string",
                  description: "Your Eufy account email address",
                },
                password: {
                  type: "string",
                  description: "Your Eufy account password",
                },
                deviceIndex: {
                  type: "number",
                  description:
                    "Index of device to connect to (0 for first device)",
                  default: 0,
                },
              },
              required: ["email", "password"],
            },
          },
          {
            name: "robovac_connect_discovered",
            description:
              "Connect to a discovered RoboVac device by IP (requires device ID and local key)",
            inputSchema: {
              type: "object",
              properties: {
                ip: {
                  type: "string",
                  description: "IP address of the discovered device",
                },
                deviceId: {
                  type: "string",
                  description: "The device ID of your Eufy RoboVac",
                },
                localKey: {
                  type: "string",
                  description: "The local key for your Eufy RoboVac",
                },
              },
              required: ["ip", "deviceId", "localKey"],
            },
          },
          {
            name: "robovac_connect",
            description:
              "Connect to your RoboVac using device credentials (manual setup)",
            inputSchema: {
              type: "object",
              properties: {
                deviceId: {
                  type: "string",
                  description: "The device ID of your Eufy RoboVac",
                },
                localKey: {
                  type: "string",
                  description: "The local key for your Eufy RoboVac",
                },
                ip: {
                  type: "string",
                  description:
                    "The IP address of your Eufy RoboVac (optional, defaults to 192.168.1.100)",
                },
              },
              required: ["deviceId", "localKey"],
            },
          },
          {
            name: "robovac_start_cleaning",
            description: "Start the robovac cleaning cycle",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "robovac_stop_cleaning",
            description: "Stop the robovac cleaning cycle",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "robovac_return_home",
            description: "Send the robovac back to its charging dock",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "robovac_get_status",
            description: "Get the current status of the robovac",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "robovac_get_battery",
            description: "Get the battery level of the robovac",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      })
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        const { name, arguments: args } = request.params;

        try {
          switch (name) {
            case "robovac_connect_discovered":
              // Auto-discover best IP if not provided or if connection fails
              let targetIP = args?.ip as string;
              let discoveredSuccess = false;

              if (targetIP) {
                discoveredSuccess = await this.initializeRoboVac(
                  args?.deviceId as string,
                  args?.localKey as string,
                  targetIP
                );
              }

              if (!discoveredSuccess) {
                console.error(
                  "[DEBUG] Initial connection failed or no IP provided, trying auto-discovery..."
                );
                const discoveredIP = await this.discoverBestRoboVacIP();

                if (discoveredIP) {
                  targetIP = discoveredIP;
                  discoveredSuccess = await this.initializeRoboVac(
                    args?.deviceId as string,
                    args?.localKey as string,
                    targetIP
                  );
                }
              }

              return {
                content: [
                  {
                    type: "text",
                    text: discoveredSuccess
                      ? `Successfully connected to RoboVac at ${targetIP}!`
                      : `Failed to connect to device. ${
                          targetIP ? `Tried ${targetIP} but` : ""
                        } Check your device ID and local key, and ensure the RoboVac is on the same network.`,
                  },
                ],
                isError: !discoveredSuccess,
              };

            case "robovac_connect":
              // Auto-discover best IP if not provided or if connection fails
              let connectTargetIP = args?.ip as string | undefined;
              let connectSuccess = false;

              if (connectTargetIP) {
                connectSuccess = await this.initializeRoboVac(
                  args?.deviceId as string,
                  args?.localKey as string,
                  connectTargetIP
                );
              }

              if (!connectSuccess) {
                console.error(
                  "[DEBUG] Manual connection failed or no IP provided, trying auto-discovery..."
                );
                const discoveredIP = await this.discoverBestRoboVacIP();

                if (discoveredIP) {
                  connectTargetIP = discoveredIP;
                  connectSuccess = await this.initializeRoboVac(
                    args?.deviceId as string,
                    args?.localKey as string,
                    connectTargetIP
                  );
                }
              }

              // Fallback to default IP if still not successful
              if (!connectSuccess && !connectTargetIP) {
                connectTargetIP = "192.168.1.100";
                connectSuccess = await this.initializeRoboVac(
                  args?.deviceId as string,
                  args?.localKey as string,
                  connectTargetIP
                );
              }

              return {
                content: [
                  {
                    type: "text",
                    text: connectSuccess
                      ? `RoboVac connected successfully at ${connectTargetIP}!`
                      : `Failed to connect to RoboVac. ${
                          connectTargetIP
                            ? `Tried ${connectTargetIP} but connection failed.`
                            : ""
                        } Check your device ID, local key, and network connection.`,
                  },
                ],
                isError: !connectSuccess,
              };

            case "robovac_auto_initialize":
              try {
                const devices = await this.networkDiscovery.discoverDevices();

                if (devices.length === 0) {
                  return {
                    content: [
                      {
                        type: "text",
                        text: "No RoboVac devices found.",
                      },
                    ],
                    isError: true,
                  };
                }

                const deviceIndex = (args?.deviceIndex as number) || 0;
                if (deviceIndex >= devices.length) {
                  return {
                    content: [
                      {
                        type: "text",
                        text: `Device index ${deviceIndex} is out of range. Found ${devices.length} device(s).`,
                      },
                    ],
                    isError: true,
                  };
                }

                const selectedDevice = devices[deviceIndex];
                let autoInitSuccess = await this.initializeRoboVac(
                  selectedDevice.deviceId,
                  selectedDevice.localKey,
                  selectedDevice.ip
                );

                // If direct connection fails, try auto-discovery
                if (!autoInitSuccess) {
                  console.error(
                    "[DEBUG] Cloud connection failed, trying auto-discovery..."
                  );
                  const discoveredIP = await this.discoverBestRoboVacIP();

                  if (discoveredIP) {
                    autoInitSuccess = await this.initializeRoboVac(
                      selectedDevice.deviceId,
                      selectedDevice.localKey,
                      discoveredIP
                    );
                  }
                }

                return {
                  content: [
                    {
                      type: "text",
                      text: autoInitSuccess
                        ? `Successfully connected to ${selectedDevice.name}!`
                        : `Failed to connect to ${selectedDevice.name}. Check network connection and ensure the device is online.`,
                    },
                  ],
                  isError: !autoInitSuccess,
                };
              } catch (error) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `Auto-initialization failed: ${
                        (error as Error).message
                      }

⚠️  The Eufy API appears to have changed since this implementation was created. As an alternative, you can:

1. Use the Eufy app to find your device IP address
2. Use a network scanner to find devices on your network
3. Check your router's device list
4. Use tools like eufy-security-client or other community projects

Once you have the device credentials, you can use the eufy-robovac library directly.`,
                    },
                  ],
                  isError: true,
                };
              }

            case "robovac_start_cleaning":
              this.ensureRoboVacInitialized();
              await this.robovac!.startCleaning();
              return {
                content: [
                  {
                    type: "text",
                    text: "RoboVac cleaning started!",
                  },
                ],
              };

            case "robovac_stop_cleaning":
              this.ensureRoboVacInitialized();
              await this.robovac!.pause();
              return {
                content: [
                  {
                    type: "text",
                    text: "RoboVac cleaning stopped!",
                  },
                ],
              };

            case "robovac_return_home":
              this.ensureRoboVacInitialized();
              await this.robovac!.goHome();
              return {
                content: [
                  {
                    type: "text",
                    text: "RoboVac returning to charging dock!",
                  },
                ],
              };

            case "robovac_get_status":
              this.ensureRoboVacInitialized();
              const status = await this.robovac!.getStatuses();
              return {
                content: [
                  {
                    type: "text",
                    text: `RoboVac Status:\n${JSON.stringify(status, null, 2)}`,
                  },
                ],
              };

            case "robovac_get_battery":
              this.ensureRoboVacInitialized();
              const battery = await this.robovac!.getBatteyLevel();
              return {
                content: [
                  {
                    type: "text",
                    text: `Battery Level: ${battery}%`,
                  },
                ],
              };

            case "robovac_set_work_mode":
              this.ensureRoboVacInitialized();
              await this.robovac!.setWorkMode(args?.mode as WorkMode);
              return {
                content: [
                  {
                    type: "text",
                    text: `Work mode set to: ${args?.mode}`,
                  },
                ],
              };

            case "robovac_set_clean_speed":
              this.ensureRoboVacInitialized();
              await this.robovac!.setCleanSpeed(args?.speed as CleanSpeed);
              return {
                content: [
                  {
                    type: "text",
                    text: `Clean speed set to: ${args?.speed}`,
                  },
                ],
              };

            case "robovac_play":
              this.ensureRoboVacInitialized();
              await this.robovac!.play();
              return {
                content: [
                  {
                    type: "text",
                    text: "RoboVac started/resumed cleaning!",
                  },
                ],
              };

            case "robovac_pause":
              this.ensureRoboVacInitialized();
              await this.robovac!.pause();
              return {
                content: [
                  {
                    type: "text",
                    text: "RoboVac paused!",
                  },
                ],
              };

            case "robovac_find_robot":
              this.ensureRoboVacInitialized();
              const enableFind =
                args?.enable !== undefined ? (args?.enable as boolean) : true;
              await this.robovac!.setFindRobot(enableFind);
              return {
                content: [
                  {
                    type: "text",
                    text: enableFind
                      ? "Find robot enabled - RoboVac should be beeping!"
                      : "Find robot disabled",
                  },
                ],
              };

            case "robovac_get_error_code":
              this.ensureRoboVacInitialized();
              const errorCode = await this.robovac!.getErrorCode(
                args?.force as boolean
              );
              return {
                content: [
                  {
                    type: "text",
                    text: `Error Code: ${errorCode}`,
                  },
                ],
              };

            case "robovac_get_work_mode":
              this.ensureRoboVacInitialized();
              const workMode = await this.robovac!.getWorkMode(
                args?.force as boolean
              );
              return {
                content: [
                  {
                    type: "text",
                    text: `Work Mode: ${workMode}`,
                  },
                ],
              };

            case "robovac_get_clean_speed":
              this.ensureRoboVacInitialized();
              const cleanSpeed = await this.robovac!.getCleanSpeed(
                args?.force as boolean
              );
              return {
                content: [
                  {
                    type: "text",
                    text: `Clean Speed: ${cleanSpeed}`,
                  },
                ],
              };

            case "robovac_get_work_status":
              this.ensureRoboVacInitialized();
              const workStatus = await this.robovac!.getWorkStatus(
                args?.force as boolean
              );
              return {
                content: [
                  {
                    type: "text",
                    text: `Work Status: ${workStatus}`,
                  },
                ],
              };

            case "robovac_get_play_pause":
              this.ensureRoboVacInitialized();
              const playPause = await this.robovac!.getPlayPause(
                args?.force as boolean
              );
              return {
                content: [
                  {
                    type: "text",
                    text: `Play/Pause State: ${playPause}`,
                  },
                ],
              };

            case "robovac_format_status":
              this.ensureRoboVacInitialized();
              await this.robovac!.formatStatus();
              return {
                content: [
                  {
                    type: "text",
                    text: "Status information has been printed to console. Use robovac_get_all_statuses for structured data.",
                  },
                ],
              };

            case "robovac_get_all_statuses":
              this.ensureRoboVacInitialized();
              const allStatuses = await this.robovac!.getStatuses(
                args?.force as boolean
              );
              return {
                content: [
                  {
                    type: "text",
                    text: `All RoboVac Statuses:\n${JSON.stringify(
                      allStatuses,
                      null,
                      2
                    )}`,
                  },
                ],
              };

            default:
              throw new Error(`Unknown tool: ${name}`);
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Eufy RoboVac MCP server running on stdio");
  }
}

const server = new RoboVacMCPServer();
server.run().catch(console.error);
