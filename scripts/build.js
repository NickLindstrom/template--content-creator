const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const contentPath = path.join(projectRoot, "content", "home.json");
const defaultTemplatePath = path.join(projectRoot, "src", "template.html");
const outputPath = path.join(projectRoot, "index.html");

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasText(value) {
  return Boolean(String(value ?? "").trim());
}

function cleanPhone(phone) {
  return String(phone ?? "").replace(/[^\d+]/g, "");
}

function safeJsonForHtml(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function localeFromLanguage(language) {
  return language === "sv" ? "sv_SE" : "en_US";
}

/* -------------------------------------------------------------------------- */
/* HTML manipulation                                                          */
/* -------------------------------------------------------------------------- */

function findElementById(html, id) {
  const escapedId = escapeRegExp(id);

  const openingRegex = new RegExp(
    `<([a-zA-Z][\\w:-]*)\\b[^>]*\\bid\\s*=\\s*(["'])${escapedId}\\2[^>]*>`,
    "i",
  );

  const match = openingRegex.exec(html);

  if (!match) {
    return null;
  }

  const tagName = match[1];
  const openStart = match.index;
  const openTag = match[0];
  const openEnd = openStart + openTag.length;

  const tagRegex = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, "gi");
  tagRegex.lastIndex = openEnd;

  let depth = 1;
  let token;

  while ((token = tagRegex.exec(html))) {
    const tag = token[0];

    if (/^<\//.test(tag)) {
      depth -= 1;
    } else if (!/\/>$/.test(tag)) {
      depth += 1;
    }

    if (depth === 0) {
      return {
        tagName,
        openStart,
        openEnd,
        openTag,
        closeStart: token.index,
        closeEnd: token.index + tag.length,
        closeTag: tag,
      };
    }
  }

  return null;
}

function replaceInnerById(html, id, innerHtml) {
  const element = findElementById(html, id);

  if (!element) {
    console.warn(`Element #${id} hittades inte i template.`);
    return html;
  }

  return (
    html.slice(0, element.openEnd) + innerHtml + html.slice(element.closeStart)
  );
}

function setTagAttribute(tag, attributeName, value) {
  const attributeRegex = new RegExp(
    `\\s${escapeRegExp(attributeName)}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
    "i",
  );

  let cleaned = tag.replace(attributeRegex, "");

  const selfClosing = /\/>$/.test(cleaned);

  cleaned = cleaned.replace(/\s*\/?>$/, "");

  return `${cleaned} ${attributeName}="${escapeHtml(value)}"${
    selfClosing ? " />" : ">"
  }`;
}

function removeTagAttribute(tag, attributeName) {
  const attributeRegex = new RegExp(
    `\\s${escapeRegExp(attributeName)}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`,
    "i",
  );

  return tag.replace(attributeRegex, "");
}

function setAttributeById(html, id, attributeName, value) {
  const element = findElementById(html, id);

  if (!element) {
    return html;
  }

  const newOpenTag = setTagAttribute(element.openTag, attributeName, value);

  return (
    html.slice(0, element.openStart) + newOpenTag + html.slice(element.openEnd)
  );
}

function setHiddenById(html, id, hidden) {
  const element = findElementById(html, id);

  if (!element) {
    return html;
  }

  let openTag = removeTagAttribute(element.openTag, "hidden");

  if (hidden) {
    openTag = openTag.replace(/>$/, " hidden>");
  }

  return (
    html.slice(0, element.openStart) + openTag + html.slice(element.openEnd)
  );
}

function setText(html, id, value) {
  return replaceInnerById(html, id, escapeHtml(value));
}

function setLink(html, id, href, label) {
  html = setAttributeById(html, id, "href", href || "#");
  html = setText(html, id, label || "");

  return html;
}

function setMeta(html, attributeName, attributeValue, content) {
  const regex = new RegExp(
    `<meta\\b[^>]*\\b${escapeRegExp(attributeName)}\\s*=\\s*(["'])${escapeRegExp(
      attributeValue,
    )}\\1[^>]*>`,
    "i",
  );

  return html.replace(regex, (tag) =>
    setTagAttribute(tag, "content", content || ""),
  );
}

function setTitle(html, title) {
  return html.replace(
    /<title\b[^>]*>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`,
  );
}

/* -------------------------------------------------------------------------- */
/* Render functions                                                           */
/* -------------------------------------------------------------------------- */

function renderServices(items = []) {
  return items
    .filter(
      (item) => item && (hasText(item.title) || hasText(item.description)),
    )
    .map((item) => {
      const image = item.image?.url
        ? `
          <img
            class="service-card__image"
            src="${escapeHtml(item.image.url)}"
            alt="${escapeHtml(item.image.alt || item.title || "")}"
            loading="lazy"
            decoding="async"
          >
        `
        : "";

      return `
        <article class="service-card">
          <div class="service-card__media${
            image ? " service-card__media--image" : ""
          }">
            ${image}
          </div>

          <h3 class="service-card__title">
            ${escapeHtml(item.title)}
          </h3>

          <p class="service-card__text">
            ${escapeHtml(item.description)}
          </p>
        </article>
      `;
    })
    .join("");
}

function renderHeroVisual(content) {
  const image = content.media?.heroImage;

  if (!image?.url) {
    return "";
  }

  return `
    <div class="hero-visual">
      <div class="hero-visual__main-card">
        <img
          class="hero-visual__image"
          src="${escapeHtml(image.url)}"
          alt="${escapeHtml(image.alt || "")}"
          decoding="async"
          fetchpriority="high"
        >
      </div>

      <div class="hero-visual__floating-card">
        <p class="hero-visual__label">Lokalt fokus</p>

        <p class="hero-visual__value">
          ${escapeHtml(content.site?.displayName || "")}
        </p>

        ${
          hasText(content.contact?.address)
            ? `
              <p class="hero-visual__caption">
                ${escapeHtml(content.contact.address)}
              </p>
            `
            : ""
        }
      </div>
    </div>
  `;
}

function renderAboutVisual(content) {
  const image = content.media?.aboutImage;

  const imageHtml = image?.url
    ? `
      <div class="about-media__image-frame">
        <img
          class="about-media__image"
          src="${escapeHtml(image.url)}"
          alt="${escapeHtml(image.alt || "")}"
          loading="lazy"
          decoding="async"
        >
      </div>
    `
    : "";

  const uspItems = Array.isArray(content.usp?.items)
    ? content.usp.items.filter(hasText)
    : [];

  const uspHtml =
    uspItems.length || hasText(content.usp?.heading)
      ? `
        <div class="highlight-panel">
          <p class="highlight-panel__label">
            ${escapeHtml(content.usp?.heading || "")}
          </p>

          <ul class="usp-list">
            ${uspItems
              .map(
                (item) => `<li class="usp-list__item">${escapeHtml(item)}</li>`,
              )
              .join("")}
          </ul>
        </div>
      `
      : "";

  if (!imageHtml && !uspHtml) {
    return "";
  }

  return `
    <div class="about-media">
      ${imageHtml}
      ${uspHtml}
    </div>
  `;
}

function renderTestimonials(items = []) {
  return items
    .filter((item) => item && (hasText(item.name) || hasText(item.quote)))
    .map(
      (item) => `
        <article class="testimonial-card">
          <h3 class="testimonial-card__name">
            ${escapeHtml(item.name)}
          </h3>

          <p class="testimonial-card__text">
            "${escapeHtml(item.quote)}"
          </p>
        </article>
      `,
    )
    .join("");
}

function renderFaq(items = []) {
  return items
    .filter((item) => item && (hasText(item.question) || hasText(item.answer)))
    .map(
      (item) => `
        <article class="faq-item">
          <h3 class="faq-item__question">
            ${escapeHtml(item.question)}
          </h3>

          <p class="faq-item__answer">
            ${escapeHtml(item.answer)}
          </p>
        </article>
      `,
    )
    .join("");
}

function renderGallery(items = []) {
  return items
    .filter((item) => item?.url)
    .map(
      (item) => `
        <figure class="gallery-card">
          <img
            class="gallery-card__image"
            src="${escapeHtml(item.url)}"
            alt="${escapeHtml(item.alt || "")}"
            loading="lazy"
            decoding="async"
          >
        </figure>
      `,
    )
    .join("");
}

function renderSocialLinks(links = {}) {
  return Object.entries(links)
    .filter(([, url]) => hasText(url))
    .map(
      ([name, url]) => `
        <a
          class="site-footer__social-link"
          href="${escapeHtml(url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(name)}
        </a>
      `,
    )
    .join("");
}

function renderBrand(content, footer = false) {
  const logoUrl = content.media?.logoUrl;
  const logoOnly = !footer && Boolean(content.media?.headerLogoOnly);
  const companyName = footer
    ? content.footer?.companyName || content.site?.displayName
    : content.site?.displayName;

  const width = hasText(content.media?.logoWidth)
    ? ` style="width:${escapeHtml(content.media.logoWidth)};height:auto"`
    : "";

  const logo = logoUrl
    ? `
      <img
        class="brand-mark__logo"
        src="${escapeHtml(logoUrl)}"
        alt="${escapeHtml(companyName)} logotyp"
        ${width}
      >
    `
    : "";

  const text =
    !logoOnly || !logoUrl
      ? `<span class="brand-mark__text">${escapeHtml(companyName)}</span>`
      : "";

  return `${logo}${text}`;
}

/* -------------------------------------------------------------------------- */
/* SEO                                                                        */
/* -------------------------------------------------------------------------- */

function applySeo(html, content) {
  const title = content.seo?.title || content.site?.displayName || "";
  const description = content.seo?.description || "";

  html = setTitle(html, title);

  html = setMeta(html, "name", "description", description);

  html = setMeta(
    html,
    "property",
    "og:locale",
    localeFromLanguage(content.site?.language),
  );

  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);

  html = setMeta(
    html,
    "property",
    "og:image",
    content.media?.heroImage?.url || "",
  );

  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);

  html = setMeta(
    html,
    "name",
    "twitter:image",
    content.media?.heroImage?.url || "",
  );

  html = html.replace(/<html\b[^>]*>/i, (tag) =>
    setTagAttribute(tag, "lang", content.site?.language || "sv"),
  );

  return html;
}

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

function applyThemeStylesheet(html, content) {
  const theme = String(content.site?.theme || "").trim();

  if (!theme) {
    return html;
  }

  const themeCssPath = path.join(projectRoot, "themes", theme, "main.css");

  if (!fs.existsSync(themeCssPath)) {
    return html;
  }

  const href = `themes/${theme}/main.css`;

  return html.replace(
    /<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])[^>]*>/i,
    (tag) => setTagAttribute(tag, "href", href),
  );
}

/* -------------------------------------------------------------------------- */
/* Main rendering                                                             */
/* -------------------------------------------------------------------------- */

function renderPage(content) {
  /*
   * Om du senare skapar exempelvis:
   *
   * themes/editorial/template.html
   * themes/classic/template.html
   *
   * används rätt template automatiskt.
   */

  const theme = String(content.site?.theme || "").trim();

  const themeTemplate = theme
    ? path.join(projectRoot, "themes", theme, "template.html")
    : null;

  const templatePath =
    themeTemplate && fs.existsSync(themeTemplate)
      ? themeTemplate
      : defaultTemplatePath;

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template hittades inte: ${templatePath}`);
  }

  let html = fs.readFileSync(templatePath, "utf8");

  /* SEO */

  html = applySeo(html, content);
  html = applyThemeStylesheet(html, content);

  /* Branding */

  html = replaceInnerById(html, "header-brand", renderBrand(content, false));

  html = replaceInnerById(html, "footer-brand", renderBrand(content, true));

  /* Hero */

  html = setText(html, "hero-eyebrow", content.hero?.eyebrow);
  html = setText(html, "hero-headline", content.hero?.headline);
  html = setText(html, "hero-subheadline", content.hero?.subheadline);

  html = setLink(
    html,
    "hero-primary-cta",
    content.hero?.primaryCtaHref || "#contact",
    content.hero?.primaryCtaLabel || "Kontakta oss",
  );

  html = setLink(
    html,
    "nav-cta-link",
    content.hero?.primaryCtaHref || "#contact",
    content.hero?.primaryCtaLabel || "Kontakt",
  );

  html = replaceInnerById(html, "hero-visual-slot", renderHeroVisual(content));

  /* Intro */

  html = setText(html, "intro-heading", content.intro?.heading);
  html = setText(html, "intro-body", content.intro?.body);

  /* Services */

  const serviceItems = Array.isArray(content.services?.items)
    ? content.services.items
    : [];

  const servicesVisible =
    content.services?.enabled !== false && serviceItems.length > 0;

  html = setText(html, "services-heading", content.services?.heading);

  html = replaceInnerById(html, "services-list", renderServices(serviceItems));

  html = setHiddenById(html, "services", !servicesVisible);

  /* About */

  html = setText(html, "about-heading", content.about?.heading);
  html = setText(html, "about-body", content.about?.body);

  html = replaceInnerById(
    html,
    "about-visual-slot",
    renderAboutVisual(content),
  );

  /* Gallery */

  const galleryItems = Array.isArray(content.media?.gallery)
    ? content.media.gallery
    : [];

  const galleryVisible =
    content.media?.galleryEnabled !== false && galleryItems.length > 0;

  html = setText(
    html,
    "gallery-heading",
    content.media?.galleryHeading || "Inblick i verksamheten",
  );

  html = replaceInnerById(html, "gallery-grid", renderGallery(galleryItems));

  html = setHiddenById(html, "gallery", !galleryVisible);
  html = setHiddenById(html, "gallery-nav-link", !galleryVisible);

  /* Testimonials */

  const testimonialItems = Array.isArray(content.testimonials?.items)
    ? content.testimonials.items
    : [];

  const testimonialsVisible =
    Boolean(content.testimonials?.enabled) && testimonialItems.length > 0;

  html = setText(html, "testimonials-heading", content.testimonials?.heading);

  html = replaceInnerById(
    html,
    "testimonials-list",
    renderTestimonials(testimonialItems),
  );

  html = setHiddenById(html, "testimonials-section", !testimonialsVisible);

  /* FAQ */

  const faqItems = Array.isArray(content.faq?.items) ? content.faq.items : [];

  const faqVisible = Boolean(content.faq?.enabled) && faqItems.length > 0;

  html = setText(html, "faq-heading", content.faq?.heading);

  html = replaceInnerById(html, "faq-list", renderFaq(faqItems));

  html = setHiddenById(html, "faq", !faqVisible);

  /* Contact */

  html = setText(html, "contact-heading", content.contact?.heading);
  html = setText(html, "contact-body", content.contact?.body);

  html = setLink(
    html,
    "contact-phone",
    `tel:${cleanPhone(content.contact?.phone)}`,
    content.contact?.phone || "",
  );

  html = setLink(
    html,
    "contact-email",
    `mailto:${content.contact?.email || ""}`,
    content.contact?.email || "",
  );

  html = setText(html, "contact-address", content.contact?.address || "");

  /* Footer */

  html = setText(html, "footer-tagline", content.footer?.tagline || "");

  html = setText(html, "footer-copyright", content.footer?.copyright || "");

  html = replaceInnerById(
    html,
    "social-links",
    renderSocialLinks(content.footer?.socialLinks),
  );

  /*
   * Behåll JSON i sidan.
   *
   * Ditt nuvarande index.js kan därför fortsätta läsa:
   * document.getElementById("initial-content")
   */

  html = replaceInnerById(
    html,
    "initial-content",
    `\n${safeJsonForHtml(content)}\n`,
  );

  return html;
}

/* -------------------------------------------------------------------------- */
/* Build                                                                      */
/* -------------------------------------------------------------------------- */

(function build() {
  const content = readJson(contentPath);

  const html = renderPage(content);

  fs.writeFileSync(outputPath, html, "utf8");

  console.log("");
  console.log("Static build klar.");
  console.log(`Source: ${contentPath}`);
  console.log(`Output: ${outputPath}`);
  console.log("");
})();
