/**
 * Tiny history-router for localhost pages.
 * Links marked [data-link] stay inside the portal.
 */

export function startRouter(render) {
  const go = (path, push) => {
    if (push && path !== location.pathname) {
      history.pushState({}, "", path);
    }
    render(location.pathname);
  };

  window.addEventListener("popstate", () => render(location.pathname));

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-link]");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http")) return;
    event.preventDefault();
    go(href, true);
  });

  render(location.pathname);
}
