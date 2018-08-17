module.exports = function(config) {
    config.set({
        frameworks: ["jasmine", "karma-typescript"],
        files: [
            "index.ts",
            "lib/**/*.ts"
        ],
        preprocessors: {
            "index.ts": "karma-typescript",
            "lib/**/*.ts": "karma-typescript"
        },
        karmaTypescriptConfig: {
            compilerOptions: {
                module: "node"
            },
            tsconfig: "./tsconfig.json",
        },
        plugins: [
            "karma-chrome-launcher",
            "karma-jasmine",
            "karma-typescript"
        ],
        reporters: ["progress", "karma-typescript"],
        customLaunchers: {
            ChromeDebugging: {
              base: 'Chrome',
              flags: [ '--remote-debugging-port=9333' ]
            }
        },
        browsers: ["ChromeHeadless"]
    });
};