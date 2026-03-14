/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.qjc.cc-visualizer',
  productName: 'CC Visualizer',
  directories: {
    buildResources: 'build',
    output: 'release'
  },
  files: [
    'out/**/*'
  ],
  mac: {
    category: 'public.app-category.developer-tools',
    target: ['dmg'],
    darkModeSupport: true
  },
  dmg: {
    title: 'CC Visualizer',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' }
    ]
  }
}
