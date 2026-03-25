import type { StorybookConfig } from "@storybook/react-vite";
const path = require("path");
const tsconfigPaths = require("vite-tsconfig-paths");

const config: StorybookConfig = {
    stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        "@storybook/addon-essentials",
        "@storybook/preset-create-react-app",
        "@storybook/addon-onboarding",
        "@storybook/addon-interactions",
    ],
    framework: {
        name: "@storybook/react-vite",
        options: {},
    },
    async viteFinal(config) {
        return {
            ...config,
            plugins: [...(config.plugins || []), tsconfigPaths.default()],
        };
    },
    staticDirs: ["../public"],
};
export default config;
