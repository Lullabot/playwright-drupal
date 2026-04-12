import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'playwright-drupal',
  base: '/playwright-drupal/',
  themeConfig: {
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/getting-started/introduction' },
        ],
      },
      {
        text: 'Writing Tests',
        items: [
          { text: 'Overview', link: '/writing-tests/overview' },
        ],
      },
      {
        text: 'Visual Comparisons',
        items: [
          { text: 'Overview', link: '/visual-comparisons/overview' },
        ],
      },
      {
        text: 'Configuration',
        items: [
          { text: 'Overview', link: '/configuration/overview' },
        ],
      },
      {
        text: 'GitHub Actions & Accessibility',
        items: [
          { text: 'Overview', link: '/github-actions-a11y/overview' },
        ],
      },
      {
        text: 'Development',
        items: [
          { text: 'Overview', link: '/development/overview' },
        ],
      },
    ],
  },
})
