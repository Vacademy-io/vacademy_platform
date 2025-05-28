// https://stackoverflow.com/questions/74947483/running-tsc-in-expo-project-with-husky-via-lint-staged-keeps-generating-js-files

// Apply these on given files when lint-staged script is initiated
module.exports = {
    "*.{ts,tsx, js, jsx}": ["prettier --write", () => "tsc --project ./tsconfig.json", "eslint"],
    "*.{json,md,mdx,css,html,yml,yaml,scss,sass}": ["prettier --write"],
};
