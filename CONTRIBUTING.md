# Contributing Guide

Thank you for your interest in the Mini Agent (TypeScript Edition) project! We welcome contributions of all forms.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an Issue and include the following information:

- **Problem Description**: A clear description of the problem.
- **Steps to Reproduce**: Detailed steps to reproduce the issue.
- **Expected Behavior**: What you expected to happen.
- **Actual Behavior**: What actually happened.
- **Environment Information**:
  - Node.js version (`node -v`)
  - TypeScript version
  - Operating system
  - Versions of relevant dependencies (`npm list` or check package.json)

### Suggesting New Features

If you have an idea for a new feature, please create an Issue first to discuss it:

- Describe the purpose and value of the feature.
- Explain the intended use case.
- Provide a design proposal if possible.

### Submitting Code

#### Getting Started

1. Fork this repository.
2. Clone your fork:
   ```bash
   git clone https://github.com/Code-MonkeyZhang/Mini-Agent-TS.git
   cd Mini-Agent-TS
   ```

3. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

4. Install development dependencies:
   ```bash
   npm install
   ```

#### Development Process

1. **Write Code**
   - Follow the project's code style (see [Code Style Guide](#code-style-guide)).
   - Add necessary comments and documentation.
   - Keep your code clean and concise.

2. **Add Tests**
   - Add test cases for new features.
   - Ensure all tests pass:
     ```bash
     npm run test
     ```
   - Run tests with coverage:
     ```bash
     npm run test:run
     ```

3. **Build and Type Check**
   - Ensure the code compiles:
     ```bash
     npm run build
     ```
   - Run type checking:
     ```bash
     npm run typecheck
     ```
   - Run full preflight check (build + test):
     ```bash
     npm run preflight
     ```

4. **Update Documentation**
   - If you add a new feature, update the README or relevant documentation.
   - Keep documentation in sync with your code.

5. **Commit Changes**
   - Use clear commit messages following [Conventional Commits](https://www.conventionalcommits.org/):
     ```bash
     git commit -m "feat(tools): add new file search tool"
     # or
     git commit -m "fix(agent): fix error handling for tool calls"
     ```

   - Commit message format:
     - `feat`: A new feature
     - `fix`: A bug fix
     - `docs`: Documentation updates
     - `style`: Code style adjustments (formatting, missing semicolons, etc.)
     - `refactor`: Code refactoring
     - `test`: Test-related changes
     - `chore`: Build or auxiliary tools

6. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
   - Create a Pull Request on GitHub.
   - Clearly describe your changes.
   - Reference any related Issues if applicable.

#### Pull Request Checklist

Before submitting a PR, please ensure:

- [ ] The code follows the project's style guide.
- [ ] All tests pass (`npm run test`).
- [ ] The code compiles successfully (`npm run build`).
- [ ] TypeScript type checking passes (`npm run typecheck`).
- [ ] Necessary tests have been added.
- [ ] Relevant documentation has been updated.
- [ ] The commit message is clear and concise.
- [ ] There are no unrelated changes.

### Code Review

All Pull Requests will be reviewed:

- We will review your code as soon as possible.
- We may request some changes.
- Please be patient and responsive to feedback.
- Once approved, your PR will be merged into the main branch.

## Code Style Guide

### TypeScript Code Style

Follow the TypeScript style guidelines:

```typescript
// Good example ✅
interface ToolInput {
  command: string;
  timeout?: number;
}

class BashTool implements Tool {
  name: string = "bash";
  description: string = "Execute bash commands";

  async execute(params: ToolInput): Promise<ToolResult> {
    // Implementation
  }
}

// Bad example ❌
class bashTool {  // Class names should be PascalCase
  name:string;  // Missing spaces around colon
  async execute(params){  // Missing type annotations
    // Implementation
  }
}
```

### Type Annotations

Use TypeScript type annotations for better code clarity:

```typescript
// Define clear interfaces/types
interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentBlock[];
}

// Use type parameters for generics
async function processMessages<T>(
  messages: Message[],
  callback: (msg: T) => void
): Promise<void> {
  // Implementation
}
```

### Testing

- Write tests for new features.
- Keep tests simple and clear.
- Ensure tests cover critical paths.

```typescript
import { describe, it, expect } from "vitest";
import { BashTool } from "../tools/bash-tool.js";

describe("BashTool", () => {
  it("should execute a simple command", async () => {
    const tool = new BashTool();
    const result = await tool.execute({ command: "echo 'test'" });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain("test");
  });

  it("should handle timeout correctly", async () => {
    const tool = new BashTool();
    const result = await tool.execute({
      command: "sleep 10",
      timeout: 1,
    });
    expect(result.success).toBe(false);
  });
});
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Run in development mode with tsx |
| `npm run start` | Run the compiled application |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run preflight` | Build, test, and link (full check) |

## Project Structure

```
Mini-Agent-TS/
├── src/              # Source code
│   ├── agent.ts      # Agent implementation
│   ├── cli.ts        # Command-line interface
│   ├── config.ts     # Configuration management
│   ├── llm-client/   # LLM client implementations
│   ├── schema/       # TypeScript schemas and types
│   ├── tools/        # Tool implementations
│   └── util/         # Utility functions
├── tests/            # Test files
├── config/           # Configuration files
├── docs/             # Documentation
├── dist/             # Compiled output (generated)
└── package.json      # Project configuration
```

## Development Workflow

Recommended workflow for development:

```bash
# 1. Create a new branch
git checkout -b feature/my-new-feature

# 2. Make your changes
# Edit files...

# 3. Run tests
npm test

# 4. Build and type check
npm run preflight

# 5. Commit your changes
git add .
git commit -m "feat: add my new feature"

# 6. Push to your fork
git push origin feature/my-new-feature

# 7. Create Pull Request on GitHub
```

## Community Guidelines

Please be friendly and respectful when interacting with the community.

## Questions and Help

If you have any questions:

- Check the [README](README.md) and [documentation](docs/).
- Search existing Issues.
- Create a new Issue to ask a question.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you again for your contribution! 🎉
