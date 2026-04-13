import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2b25",
        mist: "#eef0ea",
        clay: "#d8d0c2",
        sand: "#f6f2ea",
        sage: "#7b8d7d",
        moss: "#44584b",
        line: "#d9d4c8",
        accent: "#a75a31",
      },
      boxShadow: {
        card: "0 18px 45px rgba(31, 43, 37, 0.08)",
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 20% 20%, rgba(167, 90, 49, 0.08), transparent 35%), radial-gradient(circle at 80% 0%, rgba(68, 88, 75, 0.12), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.95))",
      },
    },
  },
  plugins: [],
};

export default config;
