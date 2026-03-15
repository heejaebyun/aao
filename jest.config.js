module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.js$": ["@swc/jest"],
  },
  transformIgnorePatterns: ["/node_modules/(?!@sentry)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};
