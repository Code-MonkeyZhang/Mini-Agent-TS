import * as fs from "node:fs";
import * as path from "node:path";

export class Logger {
  private static logFile: string | null = null;

  static initialize(logDir: string = "logs") {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = path.join(logDir, `agent-${timestamp}.log`);
    console.log(`📝 Logging to file: ${this.logFile}`);
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
