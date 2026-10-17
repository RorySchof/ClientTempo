/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          light: "#F7F7F8",
          card: "#FFFFFF",
          accent: "#F0F5FF",
        },
        border: {
          subtle: "#E5E7EB",
          strong: "#D1D5DB",
        },
        brand: {
          action: "#4CAF50",
          insight: "#3A7AFE",
        },
      },
      boxShadow: {
        card: "0 2px 4px rgba(0,0,0,0.06)",
        cardStrong: "0 4px 8px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        card: "12px",
      },
      spacing: {
        cardPadding: "20px",
        docPadding: "32px",
        sectionGap: "28px",
      },
      maxWidth: {
        document: "52rem",
      },
    },
  },
  plugins: [],
};
