// Simple pub/sub toast system — avoids React context ordering issues with the store
let listeners = [];

export function addToast(message, type = 'info') {
  listeners.forEach(fn => fn({ message, type, id: Date.now() }));
}

export function onToast(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
