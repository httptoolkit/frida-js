const CONTINUOUS = process.env.CONTINUOUS_TEST === 'true';
const HEADFUL = process.env.HEADFUL_TEST === 'true';
const CI = process.env.CI;

module.exports = function(config: any) {
    config.set({
        frameworks: ['mocha', 'chai'],
        files: [
            'test/**/*.spec.ts'
        ],
        preprocessors: {
            'src/**/*.ts': ['esbuild'],
            'test/**/*.ts': ['esbuild']
        },
        esbuild: {
            format: 'esm',
            target: 'esnext'
        },
        plugins: [
            'karma-chrome-launcher',
            'karma-chai',
            'karma-mocha',
            'karma-spec-reporter',
            'karma-esbuild'
        ],
        reporters: ['spec'],
        port: 9876,
        logLevel: config.LOG_INFO,

        customLaunchers: {
            ChromeCI: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox']
            }
        },

        browsers:
            CI // To run in CI environment:
                ? ['ChromeCI']
            : HEADFUL // Full debugging:
                ? ['Chrome']
            // Normal local usage:
                : ['ChromeHeadless'],

        autoWatch: CONTINUOUS,
        singleRun: !CONTINUOUS
    });
};