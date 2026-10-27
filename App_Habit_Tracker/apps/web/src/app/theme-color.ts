// Keeps <meta name="theme-color"> (the browser bar on the phone) on the page background
// of the active style and mode, from the first paint and whatever state the app is in.
export function syncThemeColor(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const update = () => {
    meta.content = getComputedStyle(document.body).backgroundColor;
  };
  update();
  new MutationObserver(update).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-style'],
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
}
