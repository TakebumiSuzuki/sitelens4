<script setup lang="ts">
defineProps<{ urls: string[] }>();
</script>

<template>
  <section>
    <h3 class="mb-2 text-sm font-semibold text-gray-800">関連検索結果</h3>
    <ol class="space-y-1 text-xs">
      <li v-for="(url, i) in urls" :key="i" class="truncate">
        <a
          :href="url"
          target="_blank"
          rel="noopener"
          class="text-blue-600 hover:underline"
        >
          {{ i + 1 }}. {{ url }}
        </a>
      </li>
    </ol>
  </section>
</template>
