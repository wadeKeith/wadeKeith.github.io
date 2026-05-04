const header = document.querySelector("[data-header]");
const tabs = document.querySelectorAll("[data-platform]");
const panels = document.querySelectorAll("[data-panel]");
const year = document.querySelector("#year");

if (year) {
  year.textContent = new Date().getFullYear();
}

window.addEventListener("scroll", () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 24);
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const platform = tab.dataset.platform;

    tabs.forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === platform);
    });
  });
});
