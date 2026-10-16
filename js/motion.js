// Shared entrance helpers (home, exam sheet). Content is never left hidden: the hidden state in
// css/site.css only exists under html.js (js/boot.js) and prefers-reduced-motion: no-preference.

// Adds .is-in to every [data-reveal] once it is in view. Runs once per element, never replays.
export function reveal(root = document) {
  const targets = [...root.querySelectorAll('[data-reveal]:not(.is-in)')];
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) {
    for (const t of targets) t.classList.add('is-in');
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -4% 0px', threshold: 0.05 },
  );
  for (const t of targets) io.observe(t);

  // Safety net: anything inside the viewport still hidden a moment after load is shown.
  const showVisible = () =>
    setTimeout(() => {
      for (const t of targets) {
        if (t.classList.contains('is-in')) continue;
        const r = t.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) t.classList.add('is-in');
      }
    }, 2500);
  if (document.readyState === 'complete') showVisible();
  else addEventListener('load', showVisible, { once: true });
}

// Numbers the matched elements 0, 1, 2 ... (from `start`) in --i, which css/site.css turns into a delay.
// CSSOM setProperty is allowed by the page's Content-Security-Policy; style attributes are not.
export function stagger(container, selector, start = 0) {
  let i = start;
  for (const node of container.querySelectorAll(selector)) {
    node.style.setProperty('--i', String(i));
    i += 1;
  }
  return i;
}
