const header = document.querySelector("[data-header]");
const tabs = document.querySelectorAll("[data-platform]");
const panels = document.querySelectorAll("[data-panel]");
const year = document.querySelector("#year");
const languageButtons = document.querySelectorAll("[data-lang-switch]");
const translatable = document.querySelectorAll("[data-en][data-zh]");

const setLanguage = (language) => {
  const lang = language === "zh" ? "zh" : "en";
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.body.dataset.lang = lang;

  translatable.forEach((element) => {
    element.textContent = element.dataset[lang];
  });

  languageButtons.forEach((button) => {
    const isActive = button.dataset.langSwitch === lang;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

};

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

languageButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.langSwitch));
});

setLanguage("en");
