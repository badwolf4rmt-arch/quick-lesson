// Yandex Metrika analytics helper
// Counter ID: 108472990

declare global {
  interface Window {
    ym?: (counterId: number, method: string, goal: string, params?: Record<string, any>) => void;
  }
}

const YM_COUNTER_ID = 108472990;

export function reachGoal(goal: string, params?: Record<string, any>) {
  try {
    if (window.ym) {
      if (params) {
        window.ym(YM_COUNTER_ID, 'reachGoal', goal, params);
      } else {
        window.ym(YM_COUNTER_ID, 'reachGoal', goal);
      }
      console.log('[YM] Goal reached:', goal, params || '');
    } else {
      console.warn('[YM] Yandex Metrika not loaded');
    }
  } catch (e) {
    console.error('[YM] Error sending goal:', e);
  }
}
