export const PROFILE_UPDATED_EVENT = "profile:updated";

export function emitProfileUpdated() {
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
}
