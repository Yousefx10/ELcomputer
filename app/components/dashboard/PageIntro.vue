<template>
  <component
    :is="tag"
    v-if="dashboardLayout === 'standard'"
    :class="containerClass"
  >
    <div :class="layoutClass">
      <Icon
        v-if="icon"
        :name="icon"
        :size="iconSize"
        :class="iconClass"
      />

      <div :class="copyClass">
        <h1 :class="titleClass">{{ title }}</h1>
        <p v-if="description" :class="descriptionClass">{{ description }}</p>
      </div>

      <template v-if="showActions && $slots.actions">
        <div v-if="actionsClass" :class="actionsClass">
          <slot name="actions" />
        </div>
        <slot v-else name="actions" />
      </template>
    </div>
  </component>

  <div
    v-else-if="showActions && $slots.actions"
    :class="modernActionsClass"
    role="group"
    aria-label="Page actions"
  >
    <slot name="actions" />
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  showActions: {
    type: Boolean,
    default: true
  },
  icon: {
    type: String,
    default: ''
  },
  iconSize: {
    type: [Number, String],
    default: 34
  },
  tag: {
    type: String,
    default: 'section'
  },
  containerClass: {
    type: [String, Array, Object],
    default: 'rounded-2xl bg-white p-6 shadow'
  },
  layoutClass: {
    type: [String, Array, Object],
    default: ''
  },
  copyClass: {
    type: [String, Array, Object],
    default: ''
  },
  titleClass: {
    type: [String, Array, Object],
    default: 'text-4xl font-bold'
  },
  descriptionClass: {
    type: [String, Array, Object],
    default: 'mt-2 text-sm text-gray-500'
  },
  iconClass: {
    type: [String, Array, Object],
    default: ''
  },
  actionsClass: {
    type: [String, Array, Object],
    default: ''
  },
  modernActionsClass: {
    type: [String, Array, Object],
    default: 'flex flex-wrap items-center justify-end gap-3'
  }
})

const { dashboardLayout } = useDashboardLayout()
</script>
