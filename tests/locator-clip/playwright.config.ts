import {defineConfig} from '@playwright/test'
export default defineConfig({
  updateSnapshots: 'none',
  testDir: '.', testMatch: '*.spec.ts', outputDir: '../../test-results/locator-clip',
  snapshotPathTemplate: '{testDir}/snapshots/{projectName}/{testFilePath}/{arg}{ext}',
  use: {viewport: {width: 640, height: 480}},
  projects: ['chromium', 'firefox', 'webkit'].map(name => ({name, use: {browserName: name as 'chromium' | 'firefox' | 'webkit'}})),
})
