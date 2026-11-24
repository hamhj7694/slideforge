import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F4F3EE",
        paper: "#FBFBF8",
        ink: "#161614",
        muted: "#6F6C63",
        line: "#DCD9D0",
        accent: "#D9462F",
        "accent-soft": "#F6E4DE",
        night: "#171715",
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans KR", "system-ui", "sans-serif"],
        display: ["Instrument Serif", "Noto Serif KR", "serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(22,22,20,.04), 0 12px 32px rgba(22,22,20,.06)",
        slide: "0 24px 70px rgba(22,22,20,.16), 0 2px 8px rgba(22,22,20,.08)",
      },
    },
  },
  plugins: [],
};

export default config;
