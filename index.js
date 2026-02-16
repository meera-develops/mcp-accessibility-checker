#!/usr/bin/env node

// ============================================================
// MCP Server: React Page Accessibility Checker
//
// This server exposes a single tool — "accessibilityCheck" — that:
//   1. Loads a React page/component from a file path
//   2. Renders it to HTML using ReactDOMServer
//   3. Runs axe-core accessibility checks on the rendered HTML
//   4. Returns structured JSON with violations and missing props
//
// Transport: stdio (recommended for Claude Code)
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "module";
import path from "path";
import { z } from "zod";
import { JSDOM } from "jsdom";

// ------------------------------------------------------------
// Set up Babel so we can require() JSX files directly.
//
// createRequire() gives us a CommonJS require() function
// (since this file is ESM due to "type": "module" in package.json).
// @babel/register hooks into Node's module loader to transform
// JSX and ES module syntax on-the-fly when require() is called.
// ------------------------------------------------------------

const require = createRequire(import.meta.url);

require("@babel/register")({
  presets: [
    // Transforms import/export to CommonJS require/module.exports
    [require.resolve("@babel/preset-env"), { targets: { node: "current" } }],
    // Transforms JSX like <div> into React.createElement("div")
    [require.resolve("@babel/preset-react"), { runtime: "automatic" }],
  ],
  // Only transform .jsx and .js files
  extensions: [".jsx", ".js"],
});

// ------------------------------------------------------------
// Mock non-JS imports (CSS, images, etc.) that Babel can't handle.
// These are handled by bundlers like Vite/Webpack in dev, but
// we need to stub them out for server-side rendering.
// ------------------------------------------------------------

const cssExtensions = [".css", ".scss", ".sass", ".less"];
const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp"];

for (const ext of cssExtensions) {
  require.extensions[ext] = () => {};
}

for (const ext of imageExtensions) {
  require.extensions[ext] = (module) => {
    module.exports = "mocked-image.png";
  };
}

// Load axe-core's source code as a string.
// We'll inject this into jsdom later so axe can run in that environment.
const axeSource = require("axe-core").source;

// ------------------------------------------------------------
// Load React from the PROJECT's node_modules (not the MCP server's).
//
// The project may use a different React version (e.g., React 19)
// than what the MCP server has bundled (React 18). To avoid
// dual-instance issues and version mismatches, we load React
// from the project's directory and ensure everything uses the
// same copy.
// ------------------------------------------------------------

const projectDir = process.cwd();

let React, ReactDOMServer;
try {
  React = require(require.resolve("react", { paths: [projectDir] }));
  ReactDOMServer = require(require.resolve("react-dom/server", { paths: [projectDir] }));
} catch {
  // Fallback to MCP server's React if project doesn't have it
  React = require("react");
  ReactDOMServer = require("react-dom/server");
}

// Pre-populate the MCP server's react cache entries with the project's
// React so that any require("react") from any location returns the
// same instance.
const reactSubmodules = ["react", "react/jsx-runtime", "react/jsx-dev-runtime",
  "react-dom", "react-dom/server", "react-dom/client"];

for (const mod of reactSubmodules) {
  try {
    const projPath = require.resolve(mod, { paths: [projectDir] });
    const mcpPath = require.resolve(mod);
    if (projPath !== mcpPath && require.cache[projPath]) {
      require.cache[mcpPath] = require.cache[projPath];
    }
  } catch {
    // Module not found — skip
  }
}

// ============================================================
// Create the MCP Server
// ============================================================

const server = new McpServer({
  name: "accessibility-checker",
  version: "1.0.0",
});

// ============================================================
// Define the "accessibilityCheck" Tool
//
// This is the only tool this server exposes. Claude will call it
// with a pagePath (and optional props) to check a React page
// for accessibility violations.
// ============================================================

server.tool(
  // Tool name — Claude will see this and can call it
  "accessibilityCheck",

  // Tool description — helps Claude understand when to use it
  "Checks a React page/component for accessibility violations using axe-core. " +
    "Accepts a path to a JSX file and optional props, renders the component, " +
    "and returns any WCAG violations found.",

  // Input schema — defines what parameters the tool accepts
  {
    pagePath: z
      .string()
      .describe(
        "Path to the React page/component file, relative to the current working directory (e.g., 'SamplePage.jsx' or 'src/pages/Home.jsx')"
      ),
    props: z
      .record(z.any())
      .optional()
      .describe(
        "Optional props object to pass to the component when rendering (e.g., { title: 'My Page' })"
      ),
  },

  // Tool handler — runs when Claude calls this tool
  async ({ pagePath, props = {} }) => {
    try {
      // ----------------------------------------------------------
      // Step 1: Resolve the file path
      //
      // Convert the relative pagePath to an absolute path.
      // process.cwd() is the directory where the server was launched.
      // ----------------------------------------------------------

      const fullPath = path.resolve(process.cwd(), pagePath);

      // ----------------------------------------------------------
      // Step 2: Load the React component
      //
      // Clear the require cache first so we always get the latest
      // version of the file (useful during development).
      // Then require() the file — Babel will transform the JSX.
      // ----------------------------------------------------------

      try {
        delete require.cache[require.resolve(fullPath)];
      } catch {
        // File not in cache yet — that's fine
      }

      const componentModule = require(fullPath);

      // Handle both `export default` and `module.exports` styles
      const Component = componentModule.default || componentModule;

      if (typeof Component !== "function") {
        throw new Error(
          `The file "${pagePath}" does not export a valid React component. ` +
            `Got ${typeof Component} instead of a function.`
        );
      }

      // ----------------------------------------------------------
      // Step 3: Detect missing props
      //
      // If the component defines propTypes, check which required
      // props were not provided. This helps catch rendering issues
      // before they become cryptic errors.
      // ----------------------------------------------------------

      const missingProps = [];

      if (Component.propTypes) {
        for (const propName of Object.keys(Component.propTypes)) {
          if (!(propName in props)) {
            missingProps.push(propName);
          }
        }
      }

      // ----------------------------------------------------------
      // Step 4: Render the component to HTML
      //
      // ReactDOMServer.renderToString() takes a React element and
      // returns the HTML string. This is the same technique used
      // for server-side rendering (SSR).
      //
      // We wrap the component in a MemoryRouter if react-router-dom
      // is available, since many components depend on Router context
      // for hooks like useNavigate, useSearchParams, etc.
      // ----------------------------------------------------------

      let element = React.createElement(Component, props);

      // Try to wrap in MemoryRouter for Router context
      try {
        const rrPath = require.resolve("react-router-dom", { paths: [projectDir] });
        const { MemoryRouter } = require(rrPath);
        element = React.createElement(MemoryRouter, null, element);
      } catch {
        // react-router-dom not available — render without Router context
      }

      // Try to wrap in MUI ThemeProvider if a theme file exists
      try {
        const muiPath = require.resolve("@mui/material/styles", { paths: [projectDir] });
        const { ThemeProvider, createTheme } = require(muiPath);

        // Try to load the project's theme file
        let theme;
        const themeLocations = ["src/theme.jsx", "src/theme.js", "src/theme.tsx", "src/theme.ts"];
        for (const loc of themeLocations) {
          try {
            const themePath = path.resolve(projectDir, loc);
            const themeModule = require(themePath);
            theme = themeModule.default || themeModule;
            break;
          } catch {
            // Try next location
          }
        }

        if (!theme) theme = createTheme();
        element = React.createElement(ThemeProvider, { theme }, element);
      } catch {
        // MUI not available — render without ThemeProvider
      }

      const renderedHtml = ReactDOMServer.renderToString(element);

      // ----------------------------------------------------------
      // Step 5: Create a DOM environment with jsdom
      //
      // axe-core needs a real DOM to analyze. jsdom gives us a
      // browser-like environment in Node.js. We wrap the rendered
      // HTML in a proper HTML document structure.
      // ----------------------------------------------------------

      const fullHtml = `<!DOCTYPE html>
<html lang="en">
  <head><title>Accessibility Check</title></head>
  <body>${renderedHtml}</body>
</html>`;

      const dom = new JSDOM(fullHtml, {
        // Allow script execution (needed to run axe-core)
        runScripts: "dangerously",
        // Pretend we're a visual browser (some axe rules check this)
        pretendToBeVisual: true,
      });

      // ----------------------------------------------------------
      // Step 6: Run axe-core accessibility checks
      //
      // We inject axe-core's source code into the jsdom window,
      // then call axe.run() which analyzes the entire document
      // for WCAG accessibility violations.
      // ----------------------------------------------------------

      dom.window.eval(axeSource);

      const axeResults = await new Promise((resolve, reject) => {
        // Set a timeout in case axe gets stuck
        const timeout = setTimeout(() => {
          reject(new Error("axe-core timed out after 30 seconds"));
        }, 30_000);

        dom.window.axe
          .run(dom.window.document)
          .then((results) => {
            clearTimeout(timeout);
            resolve(results);
          })
          .catch((err) => {
            clearTimeout(timeout);
            reject(err);
          });
      });

      // ----------------------------------------------------------
      // Step 7: Format the results
      //
      // Extract just the useful information from each violation:
      // - id: the axe rule identifier (e.g., "image-alt")
      // - impact: severity level (minor, moderate, serious, critical)
      // - description: what the rule checks for
      // - help: short suggestion on how to fix it
      // - helpUrl: link to detailed documentation
      // - nodes: the specific HTML elements that violated the rule
      // ----------------------------------------------------------

      const violations = axeResults.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node) => ({
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      }));

      // Clean up the jsdom instance to free memory
      dom.window.close();

      // ----------------------------------------------------------
      // Step 8: Return structured results
      //
      // The response includes:
      // - filePath: which file was checked
      // - totalViolations: quick count for summary
      // - violations: detailed list of all issues found
      // - missingProps: any props the component expects but didn't get
      // - summary: human-readable one-liner
      // ----------------------------------------------------------

      const result = {
        filePath: fullPath,
        totalViolations: violations.length,
        violations,
        ...(missingProps.length > 0 && { missingProps }),
        summary:
          violations.length === 0
            ? "No accessibility violations found! The page passes all axe-core checks."
            : `Found ${violations.length} accessibility violation(s). Review the violations array for details and fixes.`,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // ----------------------------------------------------------
      // Error handling
      //
      // If anything goes wrong (file not found, invalid component,
      // render error, etc.), return a helpful error message.
      // ----------------------------------------------------------

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: error.message,
                hint: "Make sure the file exists, exports a valid React component (default export), and that all required dependencies are installed in your project.",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================
// Start the Server
//
// StdioServerTransport connects the MCP server to Claude Code
// via standard input/output (stdin/stdout). This is the simplest
// transport — Claude Code runs the server as a subprocess.
//
// Note: We use console.error() for logging because stdout is
// reserved for the MCP protocol messages.
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Accessibility Checker MCP server is running on stdio");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
