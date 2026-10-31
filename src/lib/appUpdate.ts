/**
 * A new service worker takes over at once, but reloading then could throw away what an
 * employee is typing. The reload waits until nothing is open, or asks for it.
 */

const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

export const canReloadNow = (doc: Document = document) => {
  if (doc.querySelector('[role="dialog"], [data-work-in-progress]')) return false;
  const active = doc.activeElement;
  return !(active && active.matches(EDITABLE));
};

export const applyUpdateWhenSafe = ({
  doc = document,
  reload = () => window.location.reload(),
  onWaiting,
}: {
  doc?: Document;
  reload?: () => void;
  onWaiting: (reloadNow: () => void) => void;
}) => {
  if (canReloadNow(doc)) {
    reload();
    return;
  }
  onWaiting(reload);
  const reloadWhenHidden = () => {
    if (doc.visibilityState === 'hidden' && canReloadNow(doc)) reload();
  };
  doc.addEventListener('visibilitychange', reloadWhenHidden);
};
