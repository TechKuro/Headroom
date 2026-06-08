// Promise-based in-app confirm dialog — replaces blocking window.confirm().
// Mirrors the toast pub/sub so it sidesteps React context ordering.
let listeners = [];
let _id = 0;

/**
 * Show a confirm dialog. Resolves true if confirmed, false otherwise.
 * confirmDialog({ title, message, confirmLabel, cancelLabel, danger })
 */
export function confirmDialog(opts = {}) {
  return new Promise(resolve => {
    const req = {
      id: ++_id,
      title: 'Are you sure?',
      message: '',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      danger: false,
      ...opts,
      resolve,
    };
    listeners.forEach(fn => fn(req));
  });
}

export function onConfirm(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
