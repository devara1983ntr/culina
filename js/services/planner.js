/**
 * CULINA — Weekly meal planner (PRD §34).
 * monday..sunday × breakfast/lunch/dinner. Index-based operations because the
 * same recipe may appear multiple times (duplication is a feature).
 * Persisted locally; bounded to keep localStorage healthy.
 */
import { read, write } from '../storage.js';
import { STORAGE_KEYS, DAYS, MEALS } from '../constants.js';
import { appState } from '../state.js';

const MAX_PER_SLOT = 6;

function emptyWeek() {
  const week = {};
  for (const day of DAYS) {
    week[day.id] = {};
    for (const meal of MEALS) week[day.id][meal.id] = [];
  }
  return week;
}

function sanitize(raw) {
  const week = emptyWeek();
  if (!raw || typeof raw !== 'object') return week;
  for (const day of DAYS) {
    const dayData = raw[day.id];
    if (!dayData || typeof dayData !== 'object') continue;
    for (const meal of MEALS) {
      const list = dayData[meal.id];
      if (Array.isArray(list)) {
        week[day.id][meal.id] = list
          .filter((it) => it && it.id && it.title)
          .slice(0, MAX_PER_SLOT)
          .map((it) => ({ ...it }));
      }
    }
  }
  return week;
}

function persist(week) {
  write(STORAGE_KEYS.planner, week);
  appState.set((s) => ({ plannerVersion: s.plannerVersion + 1 }));
}

export const planner = {
  DAYS,
  MEALS,
  MAX_PER_SLOT,

  get() {
    return sanitize(read(STORAGE_KEYS.planner, null));
  },

  slot(day, meal) {
    return this.get()[day]?.[meal] || [];
  },

  /** @returns {boolean} false when the slot is full */
  add(day, meal, item) {
    if (!item || !item.id || !item.title) return false;
    const week = this.get();
    const slotList = week[day]?.[meal];
    if (!slotList) return false;
    if (slotList.length >= MAX_PER_SLOT) return false;
    slotList.push({ ...item });
    persist(week);
    return true;
  },

  removeAt(day, meal, index) {
    const week = this.get();
    const slotList = week[day]?.[meal];
    if (!slotList || index < 0 || index >= slotList.length) return false;
    slotList.splice(index, 1);
    persist(week);
    return true;
  },

  duplicateAt(day, meal, index) {
    const week = this.get();
    const slotList = week[day]?.[meal];
    if (!slotList || index < 0 || index >= slotList.length) return false;
    if (slotList.length >= MAX_PER_SLOT) return false;
    slotList.splice(index + 1, 0, { ...slotList[index], addedAt: new Date().toISOString() });
    persist(week);
    return true;
  },

  move(fromDay, fromMeal, fromIndex, toDay, toMeal, toIndex) {
    const week = this.get();
    const from = week[fromDay]?.[fromMeal];
    const to = week[toDay]?.[toMeal];
    if (!from || !to) return false;
    if (fromIndex < 0 || fromIndex >= from.length) return false;
    if (from === to && fromIndex === toIndex) return false;
    if (from !== to && to.length >= MAX_PER_SLOT) return false;

    const [item] = from.splice(fromIndex, 1);
    const targetIndex = Math.max(0, Math.min(toIndex, to.length));
    to.splice(targetIndex, 0, item);
    persist(week);
    return true;
  },

  clearDay(day) {
    const week = this.get();
    if (!week[day]) return false;
    for (const meal of MEALS) week[day][meal.id] = [];
    persist(week);
    return true;
  },

  clearWeek() {
    persist(emptyWeek());
    return true;
  },

  itemCount() {
    const week = this.get();
    let count = 0;
    for (const day of DAYS) for (const meal of MEALS) count += week[day.id][meal.id].length;
    return count;
  },

  /** Unique planned recipe ids (for shopping-list generation). */
  uniquePlanned() {
    const week = this.get();
    const map = new Map();
    for (const day of DAYS) {
      for (const meal of MEALS) {
        for (const item of week[day.id][meal.id]) {
          if (!map.has(item.id)) map.set(item.id, item);
        }
      }
    }
    return [...map.values()];
  },
};
