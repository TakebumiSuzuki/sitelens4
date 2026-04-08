<script setup lang="ts">
  import type { AnalyzeResponse } from '@/types/analyze';
  defineProps<{ data: AnalyzeResponse }>();
</script>

<template>
  <section class="space-y-1 text-sm">
    <h2 class="text-base font-semibold text-gray-800">{{ data.company_name }}</h2>
    <p class="text-gray-600"><span class="font-medium">Founded:</span> {{ data.year_founded }}</p>
    <p class="text-gray-600"><span class="font-medium">Headquarters:</span> {{ data.headquarters }}</p>
    <p class="text-gray-700">{{ data.description }}</p>
    <p class="text-gray-700"><span class="font-medium">Business:</span> {{ data.products_and_services }}</p>
  </section>
</template>
