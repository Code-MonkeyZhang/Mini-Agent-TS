import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export class Logger {
  private static logFile: string | null = null;

  static initialize(logDir?: string) {
    const logsDir = logDir ?? path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = path.join(logsDir, `agent-${timestamp}.log`);
    console.log(`Logging to file: ${this.logFile}`);
  }

  static log(category: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const formattedData = data ? JSON.stringify(data, null, 2) : "";
    const fileEntry = `[${timestamp}] [${category}] ${message} ${formattedData}\n`;
    
    // Write to file if initialized
    if (this.logFile) {
      fs.appendFileSync(this.logFile, fileEntry);
    }

  }

  static debug(category: string, message: string, data?: any) {
    this.log(category, message, data);
  }
}
