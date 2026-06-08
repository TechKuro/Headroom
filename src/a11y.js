import { useEffect } from 'react';

// Shared keyboard/focus helpers for interactive elements that aren't native
// <button>s (because they nest other controls) and for modal dialogs.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Makes a non-button element carrying role="button" behave like a button for
// keyboard users: Enter or Space activates it (Space's page-scroll suppressed).
export function activateOnKey(handler) {
  return e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler(e);
    }
  };
}

// Modal focus management: focus the dialog on open, keep Tab cycling inside it,
// and restore focus to whatever opened it on close. Pair with the element
// carrying role="dialog" / aria-modal="true" and pass that element's ref.
// `key` re-arms the trap for hosts that toggle the dialog without unmounting
// (e.g. a persistent host that early-returns when idle); omit it when the
// component is mounted/unmounted per open.
export function useFocusTrap(ref, key) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prevFocused = document.activeElement;
    const visible = () =>
      Array.from(node.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);

    // Respect a child's autoFocus (already applied during commit); otherwise
    // move focus to the first control so keyboard users start inside.
    if (!node.contains(document.activeElement)) (visible()[0] || node).focus();

    function onKey(e) {
      if (e.key !== 'Tab') return;
      const items = visible();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      if (prevFocused && prevFocused.focus) prevFocused.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, key]);
}
