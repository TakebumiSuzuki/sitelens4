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
  // scripting は、開いているウェブページの中に、後からJavaScript（プログラム）を送り込んで実行する
  // ための権限。ページ内の文字を取得したり、ボタンを追加したりする際によく使われる。
  permissions: ['tabs', 'storage', 'activeTab', 'scripting'],

  // 拡張機能が「どのウェブサイトのデータを読み取ったり、通信したりしてよいか」を指定
  host_permissions: [
    'https://www.google.com/*',
    'http://localhost/*',
  ],
  content_scripts: [
    {
      matches: ['https://www.google.com/search*'],
      // 上で指定したページ（Google検索結果）を開いたときに、実際に読み込ませて実行するプログラムのファイル名
      js: ['src/content/google-scraper.ts'],
      run_at: 'document_idle',
    },
  ],
});
