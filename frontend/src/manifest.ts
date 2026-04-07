import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'SiteLens',
  description: 'Analyze the current site and find related search results',
  version: '0.1.0',
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'SiteLens',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['tabs', 'storage', 'activeTab', 'scripting'],
  host_permissions: [
    'https://www.google.com/*',
    'http://localhost/*',
  ],
  content_scripts: [
    {
      matches: ['https://www.google.com/search*'],
      js: ['src/content/google-scraper.ts'],
      run_at: 'document_idle',
    },
  ],
});
