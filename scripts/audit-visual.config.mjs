import base from '../playwright.config.js';

// Preserve the existing scenarios and capture their final UI for visual review.
export default {
  ...base,
  testDir: '../tests',
  outputDir: '../test-results/visual-audit',
  use: { ...base.use, screenshot: 'on' }
};
