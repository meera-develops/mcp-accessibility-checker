import React from "react";
import PropTypes from "prop-types";

// ============================================================
// SamplePage — A React page with INTENTIONAL accessibility issues
//
// This page is designed to test the accessibilityCheck MCP tool.
// Each section below has one or more accessibility violations
// that axe-core should detect. Use this to verify the server works!
// ============================================================

function SamplePage({ title, username }) {
  return (
    <div>
      {/* Page heading — uses the title prop if provided */}
      <h1>{title || "Welcome to My App"}</h1>

      {/* -------------------------------------------------- */}
      {/* ISSUE 1: Image without alt text                    */}
      {/* Rule: image-alt                                    */}
      {/* Fix: Add a descriptive alt attribute               */}
      {/* -------------------------------------------------- */}
      <section>
        <h2>Our Team</h2>
        <img src="team-photo.jpg" width="600" height="400" />
        <img src="logo.png" width="100" height="50" />
      </section>

      {/* -------------------------------------------------- */}
      {/* ISSUE 2: Form inputs without labels                */}
      {/* Rule: label                                        */}
      {/* Fix: Add <label> elements linked with htmlFor      */}
      {/* -------------------------------------------------- */}
      <section>
        <h2>Contact Us</h2>
        <form>
          <input type="text" name="fullName" placeholder="Your name" />
          <input type="email" name="email" placeholder="Email address" />
          <input type="password" name="password" placeholder="Password" />
          <textarea name="message" placeholder="Your message"></textarea>
          <button type="submit">Send</button>
        </form>
      </section>

      {/* -------------------------------------------------- */}
      {/* ISSUE 3: Empty link (no accessible text)           */}
      {/* Rule: link-name                                    */}
      {/* Fix: Add text content or aria-label to the link    */}
      {/* -------------------------------------------------- */}
      <section>
        <h2>Follow Us</h2>
        <a href="https://twitter.com/example"></a>
        <a href="https://github.com/example">
          <img src="github-icon.svg" />
        </a>
      </section>

      {/* -------------------------------------------------- */}
      {/* ISSUE 4: Select without a label                    */}
      {/* Rule: select-name                                  */}
      {/* Fix: Add a <label> element for the select          */}
      {/* -------------------------------------------------- */}
      <section>
        <h2>Preferences</h2>
        <select name="language">
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
        </select>
      </section>

      {/* -------------------------------------------------- */}
      {/* ISSUE 5: Low-contrast text (may be detected)       */}
      {/* and a div pretending to be a button                */}
      {/* Rule: various ARIA rules                           */}
      {/* -------------------------------------------------- */}
      <section>
        <h2>Actions</h2>
        <div role="button">Click me to subscribe</div>
      </section>

      {/* Greeting uses the username prop */}
      {username && <p>Hello, {username}!</p>}
    </div>
  );
}

// Define propTypes — the server checks these to detect missing props
SamplePage.propTypes = {
  title: PropTypes.string,
  username: PropTypes.string,
};

export default SamplePage;
