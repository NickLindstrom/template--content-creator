(function () {
  var navToggle = document.querySelector(".nav-toggle");
  var siteNavigation = document.querySelector(
    "#site-navigation, .site-navigation, .editorial-nav, .showcase-nav",
  );

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function localeFromLanguage(language) {
    return language === "sv" ? "sv_SE" : "en_US";
  }

  function hasText(value) {
    return Boolean(String(value || "").trim());
  }

  function hasVisibleItems(items) {
    return (
      Array.isArray(items) &&
      items.some(function (item) {
        if (typeof item === "string") {
          return hasText(item);
        }

        if (!item || typeof item !== "object") {
          return false;
        }

        return Object.values(item).some(function (value) {
          return hasText(value);
        });
      })
    );
  }

  function setThemeMode(mode) {
    var resolvedMode = mode === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme-mode", resolvedMode);
    if (document.body) {
      document.body.setAttribute("data-theme-mode", resolvedMode);
    }
  }

  function setDesignSettings(content) {
    var site = content.site || {};
    var media = content.media || {};
    var imageRatio = hasText(media.imageRatio) ? media.imageRatio : "4 / 3";
    var headingFont = hasText(site.headingFont) ? site.headingFont : 'Georgia, "Times New Roman", serif';
    var bodyFont = hasText(site.bodyFont) ? site.bodyFont : 'Arial, sans-serif';
    document.documentElement.style.setProperty(
      "--content-image-ratio",
      imageRatio,
    );
    document.documentElement.style.setProperty("--font-heading", headingFont);
    document.documentElement.style.setProperty("--font-body", bodyFont);
    document.documentElement.style.setProperty("--serif", headingFont);
    document.documentElement.style.setProperty("--sans", bodyFont);
    if (document.body) {
      document.body.style.fontFamily = bodyFont;
    }

    if (hasText(site.headerBackgroundColor)) {
      document.documentElement.style.setProperty(
        "--site-header-bg",
        site.headerBackgroundColor,
      );
    } else {
      document.documentElement.style.removeProperty("--site-header-bg");
    }

    if (hasText(site.mainBackgroundColor)) {
      document.documentElement.style.setProperty(
        "--site-main-bg",
        site.mainBackgroundColor,
      );
    } else {
      document.documentElement.style.removeProperty("--site-main-bg");
    }

    if (hasText(site.footerBackgroundColor)) {
      document.documentElement.style.setProperty(
        "--site-footer-bg",
        site.footerBackgroundColor,
      );
    } else {
      document.documentElement.style.removeProperty("--site-footer-bg");
    }

    if (hasText(site.primaryColor)) {
      document.documentElement.style.setProperty(
        "--color-primary",
        site.primaryColor,
      );
      document.documentElement.style.setProperty(
        "--color-primary-dark",
        site.primaryColor,
      );
      document.documentElement.style.setProperty(
        "--editorial-accent",
        site.primaryColor,
      );
      document.documentElement.style.setProperty("--accent", site.primaryColor);
      document.documentElement.style.setProperty(
        "--accent-deep",
        site.primaryColor,
      );
    }

    if (hasText(site.secondaryColor)) {
      document.documentElement.style.setProperty(
        "--color-secondary",
        site.secondaryColor,
      );
      document.documentElement.style.setProperty(
        "--color-accent",
        site.secondaryColor,
      );
      document.documentElement.style.setProperty(
        "--editorial-accent-soft",
        site.secondaryColor,
      );
      document.documentElement.style.setProperty(
        "--accent-strong",
        site.secondaryColor,
      );
    }
  }

  function setHidden(id, hidden) {
    var element = document.getElementById(id);
    if (element) {
      element.hidden = hidden;
    }
  }

  function readEmbeddedContent() {
    var element = document.getElementById("initial-content");
    if (!element) return null;

    try {
      return JSON.parse(element.textContent || "null");
    } catch (error) {
      console.error("Could not parse embedded content", error);
      return null;
    }
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) {
      element.textContent = value || "";
    }
  }

  function setMeta(selector, value) {
    var element = document.querySelector(selector);
    if (element) {
      element.setAttribute("content", value || "");
    }
  }

  function absoluteUrl(value) {
    if (!hasText(value)) return "";
    try {
      return new URL(value, window.location.href).href;
    } catch (error) {
      return "";
    }
  }

  function cleanObject(value) {
    if (Array.isArray(value)) {
      return value.map(cleanObject).filter(function (item) {
        return item !== undefined && item !== null && item !== "";
      });
    }

    if (value && typeof value === "object") {
      return Object.entries(value).reduce(function (acc, entry) {
        var cleaned = cleanObject(entry[1]);
        if (
          cleaned !== undefined &&
          cleaned !== null &&
          cleaned !== "" &&
          (!Array.isArray(cleaned) || cleaned.length)
        ) {
          acc[entry[0]] = cleaned;
        }
        return acc;
      }, {});
    }

    return hasText(value) ? value : undefined;
  }

  function upsertJsonLd(content) {
    var scriptId = "site-json-ld";
    var script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }

    var site = content.site || {};
    var seo = content.seo || {};
    var contact = content.contact || {};
    var footer = content.footer || {};
    var media = content.media || {};
    var services = content.services || {};
    var schemaDayNames = {
      "Måndag": "Monday",
      "Tisdag": "Tuesday",
      "Onsdag": "Wednesday",
      "Torsdag": "Thursday",
      "Fredag": "Friday",
      "Lördag": "Saturday",
      "Söndag": "Sunday"
    };
    var pageUrl = window.location.href.split("#")[0];
    var logoUrl = absoluteUrl(media.logoUrl);
    var heroImageUrl = absoluteUrl(media.heroImage && media.heroImage.url);
    var galleryImages = Array.isArray(media.gallery)
      ? media.gallery.map(function (item) { return absoluteUrl(item.url); }).filter(Boolean)
      : [];
    var serviceOffers = Array.isArray(services.items)
      ? services.items.filter(function (item) {
          return item && (hasText(item.title) || hasText(item.description));
        }).map(function (item) {
          return {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: item.title,
              description: item.description
            }
          };
        })
      : [];
    var sameAs = Object.values(footer.socialLinks || {}).filter(function (value) {
      return hasText(value);
    });
    var openingHours = content.openingHours || {};
    var openingHoursSpecification = openingHours.alwaysOpen === true
      ? Object.keys(schemaDayNames).map(function (day) {
          return {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: schemaDayNames[day],
            opens: "00:00",
            closes: "23:59"
          };
        })
      : ((openingHours.days) || [])
        .filter(function (item) {
          return item && item.closed !== true && hasText(item.opens) && hasText(item.closes);
        })
        .map(function (item) {
          return {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: schemaDayNames[item.day] || item.day,
            opens: item.opens,
            closes: item.closes
          };
        });

    var graph = [
      {
        "@type": ["LocalBusiness", "ProfessionalService"],
        "@id": pageUrl + "#business",
        name: site.displayName || site.companyName || footer.companyName,
        legalName: site.companyName || footer.companyName,
        taxID: hasText(site.organizationNumber) ? site.organizationNumber : undefined,
        url: pageUrl,
        description: seo.description || contact.body || footer.tagline,
        telephone: contact.phone,
        email: contact.email,
        address: contact.address,
        logo: logoUrl,
        image: [heroImageUrl].concat(galleryImages).filter(Boolean),
        sameAs: sameAs,
        openingHours: openingHours.alwaysOpen === true ? "Mo-Su 00:00-23:59" : undefined,
        openingHoursSpecification: openingHoursSpecification,
        makesOffer: serviceOffers
      },
      {
        "@type": "WebSite",
        "@id": pageUrl + "#website",
        url: pageUrl,
        name: site.displayName || site.companyName || footer.companyName,
        publisher: {
          "@id": pageUrl + "#business"
        },
        inLanguage: site.language || "sv"
      },
      {
        "@type": "WebPage",
        "@id": pageUrl + "#webpage",
        url: pageUrl,
        name: seo.title || site.displayName || site.companyName,
        description: seo.description,
        isPartOf: {
          "@id": pageUrl + "#website"
        },
        about: {
          "@id": pageUrl + "#business"
        },
        primaryImageOfPage: heroImageUrl
          ? {
              "@type": "ImageObject",
              url: heroImageUrl
            }
          : undefined,
        inLanguage: site.language || "sv"
      }
    ];

    script.textContent = JSON.stringify(cleanObject({
      "@context": "https://schema.org",
      "@graph": graph
    }));
  }

  function setLink(id, href, label, visible) {
    var element = document.getElementById(id);
    if (!element) return;
    element.setAttribute("href", href || "#");
    element.textContent = label || "";
    if (typeof visible === "boolean") {
      element.hidden = !visible;
    }
  }

  function createBrand(elementId, companyName, logoUrl) {
    var element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = "";

    if (logoUrl) {
      var logo = document.createElement("img");
      logo.className = "brand-mark__logo";
      logo.src = logoUrl;
      logo.alt = companyName + " logotyp";
      logo.loading = "lazy";
      element.appendChild(logo);
    }

    var text = document.createElement("span");
    text.className = "brand-mark__text";
    text.textContent = companyName || "";
    element.appendChild(text);
  }

  function renderServices(content) {
    var section = document.getElementById("services");
    var navLink = document.getElementById("services-nav-link");
    var container = document.getElementById("services-list");
    if (!container) return;
    container.innerHTML = "";

    var items = (
      content.services && Array.isArray(content.services.items)
        ? content.services.items
        : []
    ).filter(function (item) {
      return item && (hasText(item.title) || hasText(item.description));
    });
    var visible = items.length > 0;
    if (section) section.hidden = !visible;
    if (navLink) navLink.hidden = !visible;
    if (!visible) return;

    setText("services-heading", content.services.heading);
    items.forEach(function (item) {
      var image =
        item.image && item.image.url
          ? '<img class="service-card__image" loading="lazy" src="' +
            escapeHtml(item.image.url) +
            '" alt="' +
            escapeHtml(item.image.alt || item.title || "") +
            '">'
          : "";
      var article = document.createElement("article");
      article.className = "service-card";
      article.innerHTML = [
        '<div class="service-card__media' +
          (image ? " service-card__media--image" : "") +
          '">' +
          image +
          "</div>",
        '<h3 class="service-card__title">' + escapeHtml(item.title) + "</h3>",
        '<p class="service-card__text">' +
          escapeHtml(item.description) +
          "</p>",
      ].join("");
      container.appendChild(article);
    });
  }

  function renderHeroVisual(content) {
    var container = document.getElementById("hero-visual-slot");
    if (!container) return;
    container.innerHTML = "";

    if (
      !content.media ||
      !content.media.heroImage ||
      !content.media.heroImage.url
    ) {
      return;
    }

    container.innerHTML = [
      '<div class="hero-visual">',
      '  <div class="hero-visual__main-card">',
      '    <img class="hero-visual__image" fetchpriority="high" src="' +
        escapeHtml(content.media.heroImage.url) +
        '" alt="' +
        escapeHtml(content.media.heroImage.alt || "") +
        '">',
      "  </div>",
      '  <div class="hero-visual__floating-card">',
      '    <p class="hero-visual__label">Lokalt fokus</p>',
      '    <p class="hero-visual__value">' +
        escapeHtml(content.site.displayName) +
        "</p>",
      '    <p class="hero-visual__caption">' +
        escapeHtml(content.contact.address) +
        "</p>",
      "  </div>",
      "</div>",
    ].join("");
  }

  function renderIntro(content) {
    var section = document.getElementById("intro-section");
    if (!section) return;
    var visible =
      hasText(content.intro && content.intro.heading) ||
      hasText(content.intro && content.intro.body);
    section.hidden = !visible;
    if (!visible) return;
    setText("intro-heading", content.intro.heading);
    setText("intro-body", content.intro.body);
  }

  function renderAboutVisual(content) {
    var container = document.getElementById("about-visual-slot");
    if (!container) return;

    var imageBlock = "";
    if (
      content.media &&
      content.media.aboutImage &&
      content.media.aboutImage.url
    ) {
      imageBlock = [
        '<div class="about-media__image-frame">',
        '  <img class="about-media__image" loading="lazy" src="' +
          escapeHtml(content.media.aboutImage.url) +
          '" alt="' +
          escapeHtml(content.media.aboutImage.alt || "") +
          '">',
        "</div>",
      ].join("");
    }

    var uspItems = (
      content.usp && Array.isArray(content.usp.items) ? content.usp.items : []
    )
      .filter(function (item) {
        return hasText(item);
      })
      .map(function (item) {
        return '<li class="usp-list__item">' + escapeHtml(item) + "</li>";
      })
      .join("");

    var hasHighlight = uspItems || hasText(content.usp && content.usp.heading);

    container.innerHTML = [
      '<div class="about-media">',
      imageBlock,
      hasHighlight
        ? '  <div class="highlight-panel">' +
          '    <p class="highlight-panel__label">' +
          escapeHtml((content.usp && content.usp.heading) || "") +
          "</p>" +
          '    <ul class="usp-list">' +
          uspItems +
          "</ul>" +
          "  </div>"
        : "",
      "</div>",
    ].join("");
  }

  function renderAbout(content) {
    var section = document.getElementById("about");
    var navLink = document.getElementById("about-nav-link");
    var hasAboutText =
      hasText(content.about && content.about.heading) ||
      hasText(content.about && content.about.body);
    var hasAboutMedia = Boolean(
      content.media && content.media.aboutImage && content.media.aboutImage.url,
    );
    var hasUspContent =
      hasText(content.usp && content.usp.heading) ||
      hasVisibleItems(content.usp && content.usp.items);
    var visible = hasAboutText || hasAboutMedia || hasUspContent;
    if (section) section.hidden = !visible;
    if (navLink) navLink.hidden = !visible;
    if (!visible) return;

    setText("about-heading", content.about.heading);
    setText("about-body", content.about.body);
    renderAboutVisual(content);
  }

  function renderTestimonials(content) {
    var section = document.getElementById("testimonials-section");
    var list = document.getElementById("testimonials-list");
    if (!section || !list) return;

    var items = (
      content.testimonials && Array.isArray(content.testimonials.items)
        ? content.testimonials.items
        : []
    ).filter(function (item) {
      return item && (hasText(item.name) || hasText(item.quote));
    });
    var visible = Boolean(
      content.testimonials && content.testimonials.enabled && items.length > 0,
    );
    section.hidden = !visible;
    list.innerHTML = "";
    if (!visible) return;

    setText("testimonials-heading", content.testimonials.heading);
    list.innerHTML = items
      .map(function (item) {
        return [
          '<article class="testimonial-card">',
          '  <h3 class="testimonial-card__name">' +
            escapeHtml(item.name) +
            "</h3>",
          '  <p class="testimonial-card__text">"' +
            escapeHtml(item.quote) +
            '"</p>',
          "</article>",
        ].join("");
      })
      .join("");
  }

  function renderFaq(content) {
    var section = document.getElementById("faq");
    var list = document.getElementById("faq-list");
    if (!section || !list) return;

    var items = (
      content.faq && Array.isArray(content.faq.items) ? content.faq.items : []
    ).filter(function (item) {
      return item && (hasText(item.question) || hasText(item.answer));
    });
    var visible = Boolean(
      content.faq && content.faq.enabled && items.length > 0,
    );
    section.hidden = !visible;
    list.innerHTML = "";
    if (!visible) return;

    setText("faq-heading", content.faq.heading);
    list.innerHTML = items
      .map(function (item) {
        return [
          '<article class="faq-item">',
          '  <h3 class="faq-item__question">' +
            escapeHtml(item.question) +
            "</h3>",
          '  <p class="faq-item__answer">' + escapeHtml(item.answer) + "</p>",
          "</article>",
        ].join("");
      })
      .join("");
  }

  function getHeroButtons(content) {
    var hero = content && content.hero ? content.hero : {};
    if (Array.isArray(hero.buttons)) {
      return hero.buttons.filter(function (button) {
        return button && hasText(button.label) && hasText(button.target);
      });
    }

    return hasText(hero.primaryCtaLabel)
      ? [{
          label: hero.primaryCtaLabel,
          variant: "primary",
          linkType: String(hero.primaryCtaHref || "").indexOf("#") === 0 ? "section" : "external",
          target: String(hero.primaryCtaHref || "#contact").replace(/^#/, ""),
        }]
      : [];
  }

  function heroButtonHref(button) {
    return button.linkType === "external"
      ? button.target
      : "#" + String(button.target || "").replace(/^#/, "");
  }

  function renderHeroButtons(content) {
    var container = document.getElementById("hero-actions");
    var buttons = getHeroButtons(content);
    var allowedVariants = ["primary", "secondary", "ghost", "secondary-ghost"];

    if (container) {
      container.innerHTML = "";
      buttons.forEach(function (button, index) {
        var link = document.createElement("a");
        var variant = allowedVariants.indexOf(button.variant) >= 0 ? button.variant : "primary";
        link.className = "showcase-button showcase-button--" + variant;
        link.href = heroButtonHref(button);
        link.textContent = button.label;
        if (index === 0) link.id = "hero-primary-cta";
        if (button.linkType === "external") {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        container.appendChild(link);
      });
    }

    if (buttons.length) {
      setLink("nav-cta-link", heroButtonHref(buttons[0]), buttons[0].label, true);
      var navLink = document.getElementById("nav-cta-link");
      if (navLink && buttons[0].linkType === "external") {
        navLink.target = "_blank";
        navLink.rel = "noopener noreferrer";
      } else if (navLink) {
        navLink.removeAttribute("target");
        navLink.removeAttribute("rel");
      }
    } else {
      setLink("nav-cta-link", "#", "", false);
    }
  }

  function renderOpeningHours(content) {
    var section = document.getElementById("opening-hours");
    var list = document.getElementById("opening-hours-list");
    if (!list) return;

    var openingHours = content.openingHours || {};
    var days = Array.isArray(openingHours.days) ? openingHours.days : [];
    var hasAnyTime = days.some(function (item) {
      return item && (hasText(item.opens) || hasText(item.closes));
    });
    var visibleDays = days.filter(function (item) {
      return item && (item.closed === true || hasText(item.opens) || hasText(item.closes));
    });
    var visible = openingHours.enabled !== false && (openingHours.alwaysOpen === true || (hasAnyTime && visibleDays.length > 0));

    if (section) section.hidden = !visible;
    list.innerHTML = "";
    if (!visible) return;

    setText("opening-hours-eyebrow", sectionEyebrow(content, "openingHours", "Öppettider"));
    setText("opening-hours-heading", openingHours.heading || "Öppettider");
    setText("opening-hours-body", openingHours.body || "");
    list.innerHTML = openingHours.alwaysOpen === true
      ? '<div class="opening-hours-row"><span class="opening-hours-row__day">Öppettider</span><span class="opening-hours-row__time">Alltid öppet</span></div>'
      : visibleDays
      .map(function (item) {
        var timeLabel = item.closed === true
          ? "Stängt"
          : [item.opens, item.closes].filter(hasText).join(" - ");

        return [
          '<div class="opening-hours-row">',
          '  <span class="opening-hours-row__day">' + escapeHtml(item.day || "") + "</span>",
          '  <span class="opening-hours-row__time">' + escapeHtml(timeLabel) + "</span>",
          "</div>",
        ].join("");
      })
      .join("");
  }

  function renderGallery(content) {
    var section = document.getElementById("gallery");
    var navLink = document.getElementById("gallery-nav-link");
    var grid = document.getElementById("gallery-grid");
    if (!section || !navLink || !grid) return;

    var galleryItems = (
      content.media && Array.isArray(content.media.gallery)
        ? content.media.gallery
        : []
    ).filter(function (item) {
      return item && item.url;
    });

    var visible = galleryItems.length > 0;
    section.hidden = !visible;
    navLink.hidden = !visible;
    grid.innerHTML = "";

    if (!visible) {
      return;
    }

    setText(
      "gallery-heading",
      (content.media && content.media.galleryHeading) ||
        "Inblick i verksamheten",
    );
    grid.innerHTML = galleryItems
      .map(function (item) {
        return [
          '<figure class="gallery-card">',
          '  <button class="gallery-card__button" type="button" data-gallery-full-src="' +
            escapeHtml(item.url) +
            '" data-gallery-alt="' +
            escapeHtml(item.alt || "") +
            '" aria-label="Visa bild i fullstorlek">',
          '    <img class="gallery-card__image" loading="lazy" decoding="async" src="' +
            escapeHtml(item.url) +
            '" alt="' +
            escapeHtml(item.alt || "") +
            '">',
          "  </button>",
          "</figure>",
        ].join("");
      })
      .join("");
  }

  function renderContact(content) {
    var section = document.getElementById("contact");
    var visible =
      hasText(content.contact && content.contact.heading) ||
      hasText(content.contact && content.contact.body) ||
      hasText(content.contact && content.contact.phone) ||
      hasText(content.contact && content.contact.email) ||
      hasText(content.contact && content.contact.address);
    setHidden("contact", !visible);
    if (!section || !visible) return;

    setText("contact-heading", content.contact.heading);
    setText("contact-body", content.contact.body);
    setLink(
      "contact-phone",
      "tel:" +
        String((content.contact && content.contact.phone) || "").replace(
          /\s+/g,
          "",
        ),
      content.contact.phone,
      hasText(content.contact.phone),
    );
    setLink(
      "contact-email",
      "mailto:" + ((content.contact && content.contact.email) || ""),
      content.contact.email,
      hasText(content.contact.email),
    );
    setText("contact-address", content.contact.address);
  }

  function renderSocialLinks(content) {
    var container = document.getElementById("social-links");
    if (!container) return;

    var entries = Object.entries(
      (content.footer && content.footer.socialLinks) || {},
    ).filter(function (entry) {
      return Boolean(entry[1]);
    });

    if (!entries.length) {
      container.innerHTML =
        '<span class="site-footer__meta">Inga sociala länkar angivna.</span>';
      return;
    }

    container.innerHTML = entries
      .map(function (entry) {
        return (
          '<a class="site-footer__social-link" href="' +
          escapeHtml(entry[1]) +
          '" target="_blank" rel="noreferrer">' +
          escapeHtml(entry[0]) +
          "</a>"
        );
      })
      .join("");
  }

  function applySeo(content) {
    document.documentElement.lang = content.site.language || "sv";
    document.title = content.seo.title || "";
    setMeta('meta[name="description"]', content.seo.description || "");
    setMeta(
      'meta[property="og:locale"]',
      localeFromLanguage(content.site.language),
    );
    setMeta('meta[property="og:title"]', content.seo.title || "");
    setMeta('meta[property="og:description"]', content.seo.description || "");
    setMeta(
      'meta[property="og:image"]',
      (content.media &&
        content.media.heroImage &&
        content.media.heroImage.url) ||
        "",
    );
    setMeta('meta[name="twitter:title"]', content.seo.title || "");
    setMeta('meta[name="twitter:description"]', content.seo.description || "");
    setMeta(
      'meta[name="twitter:image"]',
      (content.media &&
        content.media.heroImage &&
        content.media.heroImage.url) ||
        "",
    );
    upsertJsonLd(content);
  }

  function applyContent(content) {
    setThemeMode(content.site && content.site.themeMode);
    setDesignSettings(content);
    applySeo(content);
    createBrand(
      "header-brand",
      content.site.displayName,
      content.media && content.media.logoUrl,
    );
    createBrand(
      "footer-brand",
      content.footer.companyName,
      content.media && content.media.logoUrl,
    );
    setText("hero-eyebrow", content.hero.eyebrow);
    setText("hero-headline", content.hero.headline);
    setText("hero-subheadline", content.hero.subheadline);
    setText("footer-tagline", content.footer.tagline);
    setText(
      "footer-organization-number",
      hasText(content.site.organizationNumber) ? "Org.nr: " + content.site.organizationNumber : "",
    );
    setHidden("footer-organization-number", !hasText(content.site.organizationNumber));
    setText("footer-copyright", content.footer.copyright);

    renderHeroVisual(content);
    renderHeroButtons(content);
    renderIntro(content);
    renderServices(content);
    renderAbout(content);
    renderTestimonials(content);
    renderFaq(content);
    renderOpeningHours(content);
    renderGallery(content);
    renderContact(content);
    renderSocialLinks(content);
  }

  window.__contentCreatorApplyContent = applyContent;

  function setupNavigation() {
    if (!navToggle || !siteNavigation) {
      return;
    }

    navToggle.addEventListener("click", function () {
      var isOpen = siteNavigation.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    siteNavigation.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        siteNavigation.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var embeddedContent = readEmbeddedContent();
  if (embeddedContent) {
    applyContent(embeddedContent);
  }

  fetch("content/home.json")
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Kunde inte ladda innehåll.");
      }
      return response.json();
    })
    .then(function (content) {
      applyContent(content);
      setupNavigation();
    })
    .catch(function (error) {
      console.warn("Falling back to embedded content", error);
      if (!embeddedContent) {
        document.title = "Kunde inte ladda webbplatsen";
        setText("hero-headline", "Kunde inte ladda webbplatsen");
        setText("hero-subheadline", "Innehållsfilen kunde inte läsas in.");
      }
      setupNavigation();
    });
})();
