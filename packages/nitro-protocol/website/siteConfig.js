/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var hljsDefineSolidity = require('highlightjs-solidity');

// See https://docusaurus.io/docs/site-config for all the possible
// site configuration options.
// List of projects/orgs using your project for the users page.
const users = [
  {
    caption: 'User1',
    // You will need to prepend the image path with your baseUrl
    // if it is not '/', like: '/test-site/img/image.jpg'.
    image: '/img/undraw_open_source.svg',
    infoLink: 'https://www.facebook.com',
    pinned: true,
  },
];

const siteConfig = {
  title: 'Nitro protocol', // Title for your website.
  tagline: 'A smart-contract protocol for state channel networks',
  url: 'https://protocol.statechannels.org', // Your website URL
  baseUrl: '/', // Base URL for your project */
  // For github.io type URLs, you would set the url and baseUrl like:
  //   url: 'https://facebook.github.io',
  //   baseUrl: '/test-site/',

  // Used for publishing and more
  projectName: 'nitro-spec',
  organizationName: 'statechannels',
  // For top-level user or org sites, the organization is still the same.
  // e.g., for the https://JoelMarcey.github.io site, it would be set like...
  //   organizationName: 'JoelMarcey'

  // For no header links in the top nav bar -> headerLinks: [],
  headerLinks: [
    {doc: 'overview', label: 'Docs'},
    {doc: 'contract-api/contract-inheritance', label: 'Contract API'},
    {page: 'help', label: 'Help'},
  ],

  // If you have users set above, you add it here:
  users,

  /* path to images for header/footer */
  headerIcon: 'img/logo.svg',
  footerIcon: 'img/logo.svg',
  favicon: 'img/favicon.ico',

  /* Colors for website */
  colors: {
    primaryColor: '#3531FF',
    secondaryColor: '#46A5D0',
  },

  markdownPlugins: [
    // Highlight admonitions.
    require('remarkable-admonitions')({icon: 'svg-inline'}),
  ],

  /* Custom fonts for website */

  fonts: {
    myFont: ['Chivo', 'sans-serif'],
  },

  // This copyright info is used in /core/Footer.js and blog RSS/Atom feeds.
  copyright: `Copyright © ${new Date().getFullYear()}`,

  highlight: {
    // Highlight.js theme to use for syntax highlighting in code blocks.
    theme: 'foundation',

    hljs: function(hljs) {
      return hljsDefineSolidity(hljs);
    },
  },

  // Add custom scripts here that would be placed in <script> tags.
  scripts: [
    'https://buttons.github.io/buttons.js',
    'https://unpkg.com/mermaid@8.4.0/dist/mermaid.min.js',
  ],

  stylesheets: ['https://fonts.googleapis.com/css?family=Chivo&display=swap'],

  // On page navigation for the current documentation page.
  onPageNav: 'separate',
  // No .html extensions for paths.
  cleanUrl: true,

  // Open Graph and Twitter card images.
  ogImage: 'img/undraw_online.svg',
  twitterImage: 'img/undraw_tweetstorm.svg',

  // Show documentation's last contributor's name.
  enableUpdateBy: true,

  // Show documentation's last update time.
  enableUpdateTime: true,

  // You may provide arbitrary config keys to be used as needed by your
  // template. For example, if you need your repo's URL...
  repoUrl: 'https://github.com/statechannels/monorepo',
  packageUrl: 'https://github.com/statechannels/monorepo/tree/master/packages/nitro-protocol',
};

module.exports = siteConfig;
