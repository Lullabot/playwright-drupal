import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'playwright-drupal',
  base: '/playwright-drupal/',
  themeConfig: {
    sidebar: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Writing Tests', link: '/writing-tests' },
      { text: 'Visual Comparisons', link: '/visual-comparisons' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'GitHub Actions & Accessibility', link: '/github-actions' },
      { text: 'Development', link: '/development' },
    ],
  },
})
