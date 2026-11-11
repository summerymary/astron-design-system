type ScrollTarget = { style: Pick<CSSStyleDeclaration, 'overflow'> };
const scrollLocks = new WeakMap<ScrollTarget, { count: number; previous: string }>();

/** Release in any order; nested dialogs must not leave the page locked. */
export function lockScroll(target: ScrollTarget): () => void {
  let lock = scrollLocks.get(target);
  if (!lock) {
    lock = { count: 0, previous: target.style.overflow };
    scrollLocks.set(target, lock);
  }
  lock.count += 1;
  target.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count -= 1;
    if (lock.count === 0) {
      target.style.overflow = lock.previous;
      scrollLocks.delete(target);
    }
  };
}
