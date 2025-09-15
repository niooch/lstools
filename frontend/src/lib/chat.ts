import type { ChatMessage } from "../types";

export function getLastId(list: ChatMessage[]) {
  if (!list.length) return null;
  return list[list.length - 1].id;
}

export function mergeUnique(oldList: ChatMessage[], add: ChatMessage[]) {
  if (!add.length) return oldList;
  const seen = new Set(oldList.map((m) => m.id));
  const merged = [...oldList];
  for (const m of add) if (!seen.has(m.id)) merged.push(m);
  return merged;
}

