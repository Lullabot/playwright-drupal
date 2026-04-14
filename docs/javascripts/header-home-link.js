(function () {
  const run = () => {
    const logo = document.querySelector(
      '.md-header a.md-header__button.md-logo'
    );
    const topic = document.querySelector(
      '.md-header__title[data-md-component="header-title"] .md-header__topic'
    );
    if (!logo || !topic || topic.dataset.homeLinked === "1") return;
    const href = logo.getAttribute("href");
    const label = logo.getAttribute("aria-label") || "Home";
    const link = document.createElement("a");
    link.setAttribute("href", href);
    link.setAttribute("aria-label", label);
    link.className = "md-header__home-link";
    while (topic.firstChild) link.appendChild(topic.firstChild);
    topic.appendChild(link);
    topic.dataset.homeLinked = "1";
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
