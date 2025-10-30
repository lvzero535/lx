<template>
  <button class="lx-button" :disabled="disabled">
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'

defineProps<{
  disabled?: boolean
}>()
</script>