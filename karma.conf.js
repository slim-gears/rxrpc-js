module.exports = function(config) {
    config.set({
        frameworks: ["jasmine", "karma-typescript"],
        files: [
            "node_modules/babel-polyfill/dist/polyfill.js",
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
            "karma-phantomjs2-launcher",
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
        browsers: ["PhantomJS2"]
    });
};