# mcp-accessibility-check

A tool that checks your React pages for accessibility problems. It plugs into Claude Code as an MCP server, so you can just ask Claude to check any component and it will tell you what's wrong.

## How It Works

1. You give it a React component file (like `SamplePage.jsx`)
2. It renders the component to HTML
3. It runs [axe-core](https://github.com/dequelabs/axe-core) to find accessibility violations (missing alt text, unlabeled inputs, empty links, etc.)
4. It returns what's broken, how severe it is, and how to fix it

## Why It's Useful

Helps find accessibility issues easily. Identifies Aria-errors, header heirarchy, button labels, missing alt text, etc. Removes the need to look for accessibility errors manually on the webpage or within code. Let the AI handle accessibility checks for you.

## Setup

Install dependencies:

```bash
npm install
```

Add this to your Claude Code MCP config (`~/.claude/claude_code_config.json`):

```json
{
  "mcpServers": {
    "accessibility-checker": {
      "command": "node",
      "args": ["/path/to/mcp-accessibility-check/index.js"]
    }
  }
}
```

## Usage

Ask Claude something like:

> Check SamplePage.jsx for accessibility issues

The included [SamplePage.jsx](SamplePage.jsx) has intentional accessibility problems you can use to test it out.

> You can also run it on your own React web project

It may take some debugging/configuration to get the accessibility checker working on personal projects, but Claude handles debugging the server very well 
