(function () {
  "use strict";

  var root = document.documentElement;

  var body = document.body;

  var navToggle = document.querySelector(".nav-toggle");

  var siteNavigation = document.querySelector(
    "#site-navigation, .site-navigation, .editorial-nav, .showcase-nav",
  );

  /* ------------------------------------------------------------------------ */
  /* Helpers                                                                  */
  /* ------------------------------------------------------------------------ */

  function hasText(value) {
    return Boolean(String(value || "").trim());
  }

  function readEmbeddedContent() {
    var element = document.getElementById("initial-content");

    if (!element) {
      return null;
    }

    try {
      return JSON.parse(element.textContent || "{}");
    } catch (error) {
      console.warn("Kunde inte läsa embedded site configuration.", error);

      return null;
    }
  }

  function setCssVariable(name, value) {
    if (hasText(value)) {
      root.style.setProperty(name, value);
    } else {
      root.style.removeProperty(name);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Design settings                                                          */
  /*
   * Allt synligt innehåll, SEO, JSON-LD och öppettider genereras av build.js.
   *
   * Här läses endast visuella inställningar från den JSON-konfiguration som
   * redan finns inbäddad i index.html.
   */
  /* ------------------------------------------------------------------------ */

  function applyDesignSettings(content) {
    if (!content) {
      return;
    }

    var site = content.site || {};

    var media = content.media || {};

    /* Theme mode */

    var themeMode = site.themeMode === "dark" ? "dark" : "light";

    root.setAttribute("data-theme-mode", themeMode);

    if (body) {
      body.setAttribute("data-theme-mode", themeMode);
    }

    /* Image ratio */

    setCssVariable(
      "--content-image-ratio",
      hasText(media.imageRatio) ? media.imageRatio : "4 / 3",
    );

    /* Fonts */

    if (hasText(site.headingFont)) {
      setCssVariable("--font-heading", site.headingFont);

      setCssVariable("--serif", site.headingFont);
    }

    if (hasText(site.bodyFont)) {
      setCssVariable("--font-body", site.bodyFont);

      setCssVariable("--sans", site.bodyFont);

      if (body) {
        body.style.fontFamily = site.bodyFont;
      }
    }

    /* Optional background colours */

    setCssVariable("--site-header-bg", site.headerBackgroundColor);

    setCssVariable("--site-main-bg", site.mainBackgroundColor);

    setCssVariable("--site-footer-bg", site.footerBackgroundColor);

    /* Primary colour */

    if (hasText(site.primaryColor)) {
      setCssVariable("--color-primary", site.primaryColor);

      setCssVariable("--color-primary-dark", site.primaryColor);

      setCssVariable("--editorial-accent", site.primaryColor);

      setCssVariable("--accent", site.primaryColor);

      setCssVariable("--accent-deep", site.primaryColor);
    }

    /* Secondary colour */

    if (hasText(site.secondaryColor)) {
      setCssVariable("--color-secondary", site.secondaryColor);

      setCssVariable("--color-accent", site.secondaryColor);

      setCssVariable("--editorial-accent-soft", site.secondaryColor);

      setCssVariable("--accent-strong", site.secondaryColor);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Mobile navigation                                                        */
  /* ------------------------------------------------------------------------ */

  function setupNavigation() {
    if (!navToggle || !siteNavigation) {
      return;
    }

    function isOpen() {
      return siteNavigation.classList.contains("is-open");
    }

    function openNavigation() {
      siteNavigation.classList.add("is-open");

      navToggle.setAttribute("aria-expanded", "true");
    }

    function closeNavigation(returnFocus) {
      siteNavigation.classList.remove("is-open");

      navToggle.setAttribute("aria-expanded", "false");

      if (returnFocus) {
        navToggle.focus();
      }
    }

    function toggleNavigation() {
      if (isOpen()) {
        closeNavigation(false);
      } else {
        openNavigation();
      }
    }

    /* Initial ARIA state */

    navToggle.setAttribute("aria-expanded", isOpen() ? "true" : "false");

    /* Menu button */

    navToggle.addEventListener("click", function (event) {
      event.stopPropagation();

      toggleNavigation();
    });

    /* Close after navigation */

    siteNavigation.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        closeNavigation(false);
      });
    });

    /* Escape closes menu */

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen()) {
        closeNavigation(true);
      }
    });

    /* Click outside closes menu */

    document.addEventListener("click", function (event) {
      if (!isOpen()) {
        return;
      }

      var clickedInsideNavigation = siteNavigation.contains(event.target);

      var clickedToggle = navToggle.contains(event.target);

      if (!clickedInsideNavigation && !clickedToggle) {
        closeNavigation(false);
      }
    });

    /*
     * Clear mobile open state when moving to desktop layout.
     */

    var desktopMediaQuery = window.matchMedia("(min-width: 921px)");

    function handleViewportChange(event) {
      if (event.matches) {
        closeNavigation(false);
      }
    }

    if (typeof desktopMediaQuery.addEventListener === "function") {
      desktopMediaQuery.addEventListener("change", handleViewportChange);
    } else if (typeof desktopMediaQuery.addListener === "function") {
      desktopMediaQuery.addListener(handleViewportChange);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Init                                                                     */
  /* ------------------------------------------------------------------------ */

  var embeddedContent = readEmbeddedContent();

  if (embeddedContent) {
    applyDesignSettings(embeddedContent);
  }

  setupNavigation();
})();
