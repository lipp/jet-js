module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai'],

    files: [
      './peer.js',
      './tests/*.js'
    ],

    plugins: [
      'karma-mocha',
      'karma-chai',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-safari-launcher',
      'karma-opera-launcher'
    ],

    browsers: ['Chrome', 'Safari']
  });
};
