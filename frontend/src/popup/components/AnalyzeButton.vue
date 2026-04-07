<script setup lang="ts">
defineProps<{ disabled?: boolean }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    class="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
    :disabled="disabled"
    @click="$emit('click')"
  >
    Analyze this site
  </button>
</template>
