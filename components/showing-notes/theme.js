// theme.js
// Shared design tokens for the showing-summary app.
// Palette family matches the financial-plan document style (navy/slate,
// hairline rules, pale callouts) with its own accent (deep teal-navy)
// so the product has its own identity while staying in the same register.

export const colors = {
    ink: "#1A2331",        // primary text
    slate: "#4B5768",      // secondary text
    slateLight: "#8592A3",  // meta / timestamps
    navy: "#1B3A4B",        // primary accent (headers, active states, buttons)
    navyDark: "#132A37",    // hover/pressed
    navyLight: "#E7EEF0",   // secondary button hover fill
    paleAccent: "#E7EEF0",  // callout / highlight fill
    hairline: "#DCE3E8",    // borders and dividers
    bgMuted: "#F7F9FA",     // page/sidebar background
    bg: "#FFFFFF",
    danger: "#9C3B3B",
    dangerLight: "#F7EAEA",
    dangerDark: "#7A2E2E",
  };
  
  export const type = {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
  };
  
  // A navy header bar with white text — echoes the table-header /
  // section-header treatment from the reference document. Use for the
  // top of any "card" that represents a distinct report section.
  export const sectionHeaderBar = {
    background: colors.navy,
    color: "#FFFFFF",
    padding: "0.65rem 1.25rem",
    fontSize: "0.95rem",
    fontWeight: 600,
    letterSpacing: "0.01em",
    borderRadius: "6px 6px 0 0",
  };
  
  // Pale, quiet callout box — echoes the "Important Modeling Notes"
  // treatment: a soft fill, hairline border, no shadow.
  export const calloutBox = {
    background: colors.paleAccent,
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    padding: "0.85rem 1rem",
  };
  
  export const hairlineDivider = {
    border: "none",
    borderTop: `1px solid ${colors.hairline}`,
    margin: "1.5rem 0",
  };
  