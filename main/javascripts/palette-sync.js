(function () {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const syncToOS = (event) => {
    const wantScheme = event.matches ? "slate" : "default";
    const inputs = document.querySelectorAll(
      'form[data-md-component="palette"] input[data-md-color-scheme]'
    );
    for (const input of inputs) {
      if (input.getAttribute("data-md-color-scheme") === wantScheme) {
        if (!input.checked) input.click();
        return;
      }
    }
  };
  mq.addEventListener("change", syncToOS);
})();
