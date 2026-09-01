export const REWORK_REQUIREMENT_MAX_LENGTH = 200

export function getReworkRequirementHelperText(value) {
  return `${String(value || '').length}/${REWORK_REQUIREMENT_MAX_LENGTH}`
}
