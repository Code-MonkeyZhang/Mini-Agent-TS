// ANSI color codes
export const Colors = {
  RESET: "\x1b[0m",
  BOLD: "\x1b[1m",
  DIM: "\x1b[2m",

  // Foreground colors
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  WHITE: "\x1b[37m",

  // Bright colors
  BRIGHT_BLACK: "\x1b[90m",
  BRIGHT_RED: "\x1b[91m",
  BRIGHT_GREEN: "\x1b[92m",
  BRIGHT_YELLOW: "\x1b[93m",
  BRIGHT_BLUE: "\x1b[94m",
  BRIGHT_MAGENTA: "\x1b[95m",
  BRIGHT_CYAN: "\x1b[96m",
  BRIGHT_WHITE: "\x1b[97m",
};

// ANSI escape code regex
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*m/g;

// Unicode ranges for emoji
const EMOJI_START = 0x1F300;
const EMOJI_END = 0x1FAFF;

/**
 * Calculate visible width of text in terminal columns.
 *
 * Handles ANSI escape codes, emoji, and East Asian characters correctly.
 */
export function calculateDisplayWidth(text: string): number {
  const cleanText = text.replace(ANSI_ESCAPE_RE, "");

  let width = 0;
  for (const char of cleanText) {
    const codePoint = char.codePointAt(0) ?? 0;

    // Emoji range (counted as 2 columns)
    if (codePoint >= EMOJI_START && codePoint <= EMOJI_END) {
      width += 2;
      continue;
    }

    // East Asian Width property
    // W = Wide, F = Fullwidth (both occupy 2 columns)
    // Using a simplified check for common wide characters
    if (isWideChar(char)) {
      width += 2;
    } else {
      width += 1;
    }
  }

  return width;
}

/**
 * Check if a character is a wide character (2 columns).
 * Simplified version - covers most common cases.
 */
function isWideChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;

  // CJK Unified Ideographs
  if (code >= 0x4E00 && code <= 0x9FFF) return true;
  // CJK Unified Ideographs Extension A
  if (code >= 0x3400 && code <= 0x4DBF) return true;
  // CJK Unified Ideographs Extension B-F
  if (code >= 0x20000 && code <= 0x2EBEF) return true;
  // CJK Compatibility Ideographs
  if (code >= 0xF900 && code <= 0xFAFF) return true;
  // Hangul Syllables
  if (code >= 0xAC00 && code <= 0xD7AF) return true;
  // Fullwidth ASCII variants
  if (code >= 0xFF01 && code <= 0xFF60) return true;
  // Fullwidth symbols
  if (code >= 0xFFE0 && code <= 0xFFE6) return true;

  return false;
}

/**
 * Draw step header.
 */
export function drawStepHeader(step: number, maxSteps: number): string {
  const BOX_WIDTH = 60;
  const stepText = `${Colors.BOLD}${Colors.BRIGHT_CYAN}💭 Step ${step}/${maxSteps}${Colors.RESET}`;
  const stepDisplayWidth = calculateDisplayWidth(stepText);
  const padding = Math.max(0, BOX_WIDTH - 1 - stepDisplayWidth); // -1 for leading space

  const HORIZONTAL = "─";
  const TOP_LEFT = "╭";
  const TOP_RIGHT = "╮";
  const BOTTOM_LEFT = "╰";
  const BOTTOM_RIGHT = "╯";
  const VERTICAL = "│";

  const lines: string[] = [];
  lines.push(`${Colors.DIM}${TOP_LEFT}${HORIZONTAL.repeat(BOX_WIDTH)}${TOP_RIGHT}${Colors.RESET}`);
  lines.push(`${Colors.DIM}${VERTICAL}${Colors.RESET} ${stepText}${" ".repeat(padding)}${Colors.DIM}${VERTICAL}${Colors.RESET}`);
  lines.push(`${Colors.DIM}${BOTTOM_LEFT}${HORIZONTAL.repeat(BOX_WIDTH)}${BOTTOM_RIGHT}${Colors.RESET}`);

  return "\n" + lines.join("\n");
}

export function printBanner(): void {
  const BOX_WIDTH = 58;
  const bannerText = "🤖 Mini Agent - Multi-turn Interactive Session";

  const bannerWidth = bannerText.length;
  const totalPadding = BOX_WIDTH - bannerWidth;
  const leftPaddingCount = Math.floor(totalPadding / 2);
  const rightPaddingCount = totalPadding - leftPaddingCount;

  const leftPadding = " ".repeat(Math.max(0, leftPaddingCount));
  const rightPadding = " ".repeat(Math.max(0, rightPaddingCount));
  const horizontalLine = "═".repeat(BOX_WIDTH);

  console.log();
  console.log(`╔${horizontalLine}╗`);
  console.log(`║${leftPadding}${bannerText}${rightPadding}║`);
  console.log(`╚${horizontalLine}╝`);
  console.log();
}
