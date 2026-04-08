<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue';
  import { getState, subscribe } from '@/utils/storage';
  import type { StoredState } from '@/types/analyze';
  import AnalyzeButton from './components/AnalyzeButton.vue';
  import CompanyInfo from './components/CompanyInfo.vue';
  import ResultUrlList from './components/ResultUrlList.vue';

  const state = ref<StoredState>({ status: 'idle', updatedAt: Date.now() });
  let unsubscribe: (() => void) | null = null;

  onMounted(async () => {
    state.value = await getState();
    unsubscribe = subscribe((s) => {
      state.value = s;
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });

  function onAnalyze() {
    chrome.runtime.sendMessage({ type: 'ANALYZE_START' });
  }
</script>

<template>
  <div class="p-4 space-y-4">
    <header class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-800">SiteLens</h1>
      <span class="text-xs text-gray-400">{{ state.status }}</span>
    </header>

    <AnalyzeButton
      :disabled="state.status === 'analyzing' || state.status === 'searching'"
      @click="onAnalyze"
    />

    <p v-if="state.status === 'analyzing'" class="text-sm text-gray-600">
      Analyzing...
    </p>
    <p v-else-if="state.status === 'searching'" class="text-sm text-gray-600">
      Google Searching...
    </p>

    <div v-if="state.status === 'error'" class="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
      {{ state.error }}
    </div>

    <CompanyInfo v-if="state.data" :data="state.data" />
    <ResultUrlList v-if="state.urls && state.urls.length" :urls="state.urls" />
  </div>
</template>
