export interface ControlIdDevice {
  id: string;
  name: string;
  model: string;
  ip: string;
  port: number;
  protocol: "http" | "https";
  status: "online" | "offline" | "unknown";
  lastSeenAt: any;
  updatedAt: any;
  details?: {
    serial?: string;
    version?: string;
    model?: string;
    ram?: number;
    disk?: number;
  };
}

export interface ControlIdCommand {
  id: string;
  type: "testConnection" | "unlock";
  deviceId: "iface-principal";
  direction?: "clockwise" | "anticlockwise" | "both";
  status: "pending" | "processing" | "success" | "error";
  requestedBy?: string;
  requestedAt: string;
  processingStartedAt?: string | null;
  processedAt?: string | null;
  result?: any;
  error?: string | null;
}

export interface ControlIdLog {
  id?: string;
  deviceId: string;
  commandId?: string;
  type: "testConnection" | "unlock" | "system";
  status: "success" | "error" | "info";
  message: string;
  createdAt: string;
  raw?: any;
}
