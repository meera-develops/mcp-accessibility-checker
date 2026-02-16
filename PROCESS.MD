# Process

## What I Built

I built an MCP server that checks React components for accessibility violations using axe-core. The server exposes a single tool — `accessibilityCheck` — that takes a path to a JSX file, renders the component to HTML with ReactDOMServer, and runs axe-core against it inside a jsdom environment. It returns structured results with each violation's severity, the offending HTML, and how to fix it.

I chose stdio transport over HTTP/Express because it integrates directly with Claude Code as a subprocess — no need to manage a separate running server or deal with ports. It keeps the project simple and focused on the actual accessibility checking logic.

## How Claude Code Helped

1. **Initial prompt** — I described to Claude exactly what I wanted: an MCP server that could load a React JSX file, render it, and run axe-core to find accessibility issues. Claude scaffolded the entire server structure from that single prompt.

Original Prompt: 
Create a simple MCP server for Claude Code that checks **React page accessibility**.

The server should have **one tool called "checkAccessibility"** that:
- Accepts:
  - `pagePath` (string): path to a top-level React page/component file (e.g., App.jsx or HomePage.jsx)
  - `props` (object, optional): props to render dynamically
- Returns:
  - JSON with accessibility violations detected by axe-core across the full rendered page, including:
    - Missing alt attributes on images
    - Missing labels on form inputs
    - Incorrect or missing ARIA attributes
  - Any missing or undefined props required for rendering

Please create:

1. **package.json** with:
   - `@modelcontextprotocol/sdk`
   - `react` and `react-dom`
   - `jsdom`
   - `axe-core`
   - `@babel/core`, `@babel/preset-react`, and `@babel/register` (to handle JSX)

2. **index.js** with complete server code:
   - Defines the `checkAccessibility` tool
   - Dynamically imports the top-level page component
   - Renders the full page with optional props using ReactDOMServer
   - Runs axe-core accessibility checks on the rendered page DOM
   - Returns structured JSON with violations and missing props
   - Includes clear comments explaining each part

Keep it **simple and easy to understand**. This is my second MCP server. Make sure Claude could use it to analyze full React pages with optional props and return actionable accessibility results.

2. **Debugging larger projects** — When I tried running the checker against a much bigger React project, I hit a wall of errors. Claude helped work through each one — adding Babel configuration for JSX transformation, stubbing out CSS/image imports that Node can't process, and wrapping components in `MemoryRouter` for react-router-dom support.

3. **Framework compatibility** — Claude added support for Material UI (frequently used in my React projects) by detecting and wrapping components in `ThemeProvider` with the project's theme, which was necessary to render MUI components without crashing. This took several rounds of back-and-forth as new errors surfaced.

## Debugging Journey

The server worked smoothly on the included `SamplePage.jsx`, but applying it to a larger real-world project introduced many errors. React Router hooks like `useNavigate` would crash without Router context, so Claude added automatic `MemoryRouter` wrapping. MUI components needed a `ThemeProvider`, so Claude added detection for `@mui/material/styles` and the project's theme file. CSS and image imports caused Babel to fail, so we added mock handlers for those extensions. Each fix was incremental — Claude would run the tool, hit an error, diagnose it, and kills and restart the server until it worked end-to-end.

## How MCP Works

MCP - or Modle Context Protocol - is a way to enable AI agents with more capabilities. It gives AI agents tools to be more efficient and complete real tasks. In this case, the AI is the client, and the MCP tool I built is the server. Claude can call it when it needs to do something specific, like check the accessibility results of my webpage. 

The communication works through a JSON-based protocol. The client sends a request (e.g. "call the `accessibilityCheck` tool with these arguments"), the server runs the logic, and sends back a response. The AI decides *when* to call a tool based on the user's prompt and the tool's description.

This server uses the **stdio** transport method. In this method the client spawns the server as a subprocess and communicates through stdin/stdout. I was informed that this it the typical method of transport when using Claude Code. Using stdio is also simpler than adding Express to this server — Claude Code just runs `node index.js` behind the scenes, pipes data in and out, and kills the process when it's done. No ports, no URLs, no extra setup.

In short: MCP gives the AI a way to reach out and use external capabilities without those capabilities being baked into the model itself. The server defines what's available, and the AI decides when and how to use it.

## What I'd Do Differently

[TODO: Reflect on your approach — what would you change, what would you explore further, what lessons did you take away.]

I would give Claude an example of a real project, like the website we built in week 1, and ask it to build the Accessibility Checker based off that project. This would enable Claude to build the server from the get-go accounting for React Router, useState, and frameworks. Using a real project would make the server more transferrable to personal projects. Building it in an isolated project created too simple of a server that then had to be debugged extensively in order to accomplish its tasks. 

This assignment allowed me to learn more about MCP servers and configuring them. It showed me how to add them to Claude so that they could be used globally, across directories. It also taught me to apply servers to multiple projects. 
