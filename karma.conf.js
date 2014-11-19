module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai'],

    files: [
      './src/util.js',
      './src/peer.js',
      './tests/*.js'
    ],

    reporters: ['mocha', 'coverage'],

    preprocessors: {
      'src/*.js': ['coverage']
    },

    coverageReporter: {
      // specify a common output directory
      dir: 'coverage',
      reporters: [
        // reporters not supporting the `file` property
        { type: 'html', subdir: 'report-html' },
        { type: 'lcov', subdir: 'report-lcov' },
        // reporters supporting the `file` property, use `subdir` to directly
        // output them in the `dir` directory
        //{ type: 'lcovonly', subdir: '.', file: 'report-lcovonly.txt' },
        { type: 'text-summary', subdir: '.', file: 'text-summary.txt' }
      ]
    },

    plugins: [
      'karma-mocha',
      'karma-chai',
      'karma-coverage',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-safari-launcher',
      'karma-opera-launcher',
      'karma-mocha-reporter'
    ],

    browsers: ['Chrome', 'Safari']
  });
};
