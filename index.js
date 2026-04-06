(function () {
  var navToggle = document.querySelector('.nav-toggle');
  var siteNavigation = document.querySelector('#site-navigation, .site-navigation, .editorial-nav, .showcase-nav');

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function localeFromLanguage(language) {
    return language === 'sv' ? 'sv_SE' : 'en_US';
  }

  function hasText(value) {
    return Boolean(String(value || '').trim());
  }

  function hasVisibleItems(items) {
    return Array.isArray(items) && items.some(function (item) {
      if (typeof item === 'string') {
        return hasText(item);
      }

      if (!item || typeof item !== 'object') {
        return false;
      }

      return Object.values(item).some(function (value) {
        return hasText(value);
      });
    });
  }

  function setThemeMode(mode) {
    var resolvedMode = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme-mode', resolvedMode);
    if (document.body) {
      document.body.setAttribute('data-theme-mode', resolvedMode);
    }
  }

  function setHidden(id, hidden) {
    var element = document.getElementById(id);
    if (element) {
      element.hidden = hidden;
    }
  }

  function readEmbeddedContent() {
    var element = document.getElementById('initial-content');
    if (!element) return null;

    try {
      return JSON.parse(element.textContent || 'null');
    } catch (error) {
      console.error('Could not parse embedded content', error);
      return null;
    }
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) {
      element.textContent = value || '';
    }
  }

  function setMeta(selector, value) {
    var element = document.querySelector(selector);
    if (element) {
      element.setAttribute('content', value || '');
    }
  }

  function setLink(id, href, label, visible) {
    var element = document.getElementById(id);
    if (!element) return;
    element.setAttribute('href', href || '#');
    element.textContent = label || '';
    if (typeof visible === 'boolean') {
      element.hidden = !visible;
    }
  }

  function createBrand(elementId, companyName, logoUrl) {
    var element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = '';

    if (logoUrl) {
      var logo = document.createElement('img');
      logo.className = 'brand-mark__logo';
      logo.src = logoUrl;
      logo.alt = companyName + ' logotyp';
      element.appendChild(logo);
    }

    var text = document.createElement('span');
    text.className = 'brand-mark__text';
    text.textContent = companyName || '';
    element.appendChild(text);
  }

  function renderServices(content) {
    var section = document.getElementById('services');
    var navLink = document.getElementById('services-nav-link');
    var container = document.getElementById('services-list');
    if (!container) return;
    container.innerHTML = '';

    var items = (content.services && Array.isArray(content.services.items) ? content.services.items : []).filter(function (item) {
      return item && (hasText(item.title) || hasText(item.description));
    });
    var visible = items.length > 0;
    if (section) section.hidden = !visible;
    if (navLink) navLink.hidden = !visible;
    if (!visible) return;

    setText('services-heading', content.services.heading);
    items.forEach(function (item) {
      var article = document.createElement('article');
      article.className = 'service-card';
      article.innerHTML = [
        '<div class="service-card__media"><span class="service-card__badge">Tjänst</span></div>',
        '<h3 class="service-card__title">' + escapeHtml(item.title) + '</h3>',
        '<p class="service-card__text">' + escapeHtml(item.description) + '</p>'
      ].join('');
      container.appendChild(article);
    });
  }

  function renderHeroVisual(content) {
    var container = document.getElementById('hero-visual-slot');
    if (!container) return;
    container.innerHTML = '';

    if (!content.media || !content.media.heroImage || !content.media.heroImage.url) {
      return;
    }

    container.innerHTML = [
      '<div class="hero-visual">',
      '  <div class="hero-visual__main-card">',
      '    <img class="hero-visual__image" src="' + escapeHtml(content.media.heroImage.url) + '" alt="' + escapeHtml(content.media.heroImage.alt || '') + '">',
      '  </div>',
      '  <div class="hero-visual__floating-card">',
      '    <p class="hero-visual__label">Lokalt fokus</p>',
      '    <p class="hero-visual__value">' + escapeHtml(content.site.displayName) + '</p>',
      '    <p class="hero-visual__caption">' + escapeHtml(content.contact.address) + '</p>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderIntro(content) {
    var section = document.getElementById('intro-section');
    if (!section) return;
    var visible = hasText(content.intro && content.intro.heading) || hasText(content.intro && content.intro.body);
    section.hidden = !visible;
    if (!visible) return;
    setText('intro-heading', content.intro.heading);
    setText('intro-body', content.intro.body);
  }

  function renderAboutVisual(content) {
    var container = document.getElementById('about-visual-slot');
    if (!container) return;

    var imageBlock = '';
    if (content.media && content.media.aboutImage && content.media.aboutImage.url) {
      imageBlock = [
        '<div class="about-media__image-frame">',
        '  <img class="about-media__image" src="' + escapeHtml(content.media.aboutImage.url) + '" alt="' + escapeHtml(content.media.aboutImage.alt || '') + '">',
        '</div>'
      ].join('');
    }

    var uspItems = (content.usp && Array.isArray(content.usp.items) ? content.usp.items : [])
      .filter(function (item) { return hasText(item); })
      .map(function (item) {
        return '<li class="usp-list__item">' + escapeHtml(item) + '</li>';
      })
      .join('');

    var hasHighlight = uspItems || hasText(content.usp && content.usp.heading);

    container.innerHTML = [
      '<div class="about-media">',
      imageBlock,
      hasHighlight
        ? '  <div class="highlight-panel">' +
          '    <p class="highlight-panel__label">' + escapeHtml((content.usp && content.usp.heading) || '') + '</p>' +
          '    <ul class="usp-list">' + uspItems + '</ul>' +
          '  </div>'
        : '',
      '</div>'
    ].join('');
  }

  function renderAbout(content) {
    var section = document.getElementById('about');
    var navLink = document.getElementById('about-nav-link');
    var hasAboutText = hasText(content.about && content.about.heading) || hasText(content.about && content.about.body);
    var hasAboutMedia = Boolean(content.media && content.media.aboutImage && content.media.aboutImage.url);
    var hasUspContent = hasText(content.usp && content.usp.heading) || hasVisibleItems(content.usp && content.usp.items);
    var visible = hasAboutText || hasAboutMedia || hasUspContent;
    if (section) section.hidden = !visible;
    if (navLink) navLink.hidden = !visible;
    if (!visible) return;

    setText('about-heading', content.about.heading);
    setText('about-body', content.about.body);
    renderAboutVisual(content);
  }

  function renderTestimonials(content) {
    var section = document.getElementById('testimonials-section');
    var list = document.getElementById('testimonials-list');
    if (!section || !list) return;

    var items = (content.testimonials && Array.isArray(content.testimonials.items) ? content.testimonials.items : []).filter(function (item) {
      return item && (hasText(item.name) || hasText(item.quote));
    });
    var visible = Boolean(content.testimonials && content.testimonials.enabled && items.length > 0);
    section.hidden = !visible;
    list.innerHTML = '';
    if (!visible) return;

    setText('testimonials-heading', content.testimonials.heading);
    list.innerHTML = items.map(function (item) {
      return [
        '<article class="testimonial-card">',
        '  <h3 class="testimonial-card__name">' + escapeHtml(item.name) + '</h3>',
        '  <p class="testimonial-card__text">"' + escapeHtml(item.quote) + '"</p>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderFaq(content) {
    var section = document.getElementById('faq');
    var list = document.getElementById('faq-list');
    if (!section || !list) return;

    var items = (content.faq && Array.isArray(content.faq.items) ? content.faq.items : []).filter(function (item) {
      return item && (hasText(item.question) || hasText(item.answer));
    });
    var visible = Boolean(content.faq && content.faq.enabled && items.length > 0);
    section.hidden = !visible;
    list.innerHTML = '';
    if (!visible) return;

    setText('faq-heading', content.faq.heading);
    list.innerHTML = items.map(function (item) {
      return [
        '<article class="faq-item">',
        '  <h3 class="faq-item__question">' + escapeHtml(item.question) + '</h3>',
        '  <p class="faq-item__answer">' + escapeHtml(item.answer) + '</p>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderGallery(content) {
    var section = document.getElementById('gallery');
    var navLink = document.getElementById('gallery-nav-link');
    var grid = document.getElementById('gallery-grid');
    if (!section || !navLink || !grid) return;

    var galleryItems = (content.media && Array.isArray(content.media.gallery) ? content.media.gallery : []).filter(function (item) {
      return item && item.url;
    });

    var visible = galleryItems.length > 0;
    section.hidden = !visible;
    navLink.hidden = !visible;
    grid.innerHTML = '';

    if (!visible) {
      return;
    }

    setText('gallery-heading', (content.media && content.media.galleryHeading) || 'Inblick i verksamheten');
    grid.innerHTML = galleryItems.map(function (item) {
      return [
        '<figure class="gallery-card">',
        '  <img class="gallery-card__image" src="' + escapeHtml(item.url) + '" alt="' + escapeHtml(item.alt || '') + '">',
        '</figure>'
      ].join('');
    }).join('');
  }

  function renderContact(content) {
    var section = document.getElementById('contact');
    var visible = hasText(content.contact && content.contact.heading) || hasText(content.contact && content.contact.body) || hasText(content.contact && content.contact.phone) || hasText(content.contact && content.contact.email) || hasText(content.contact && content.contact.address);
    setHidden('contact', !visible);
    setLink('nav-cta-link', content.hero && content.hero.primaryCtaHref, content.hero && content.hero.primaryCtaLabel, visible && hasText(content.hero && content.hero.primaryCtaLabel));
    setLink('hero-primary-cta', content.hero && content.hero.primaryCtaHref, content.hero && content.hero.primaryCtaLabel, visible && hasText(content.hero && content.hero.primaryCtaLabel));
    if (!section || !visible) return;

    setText('contact-heading', content.contact.heading);
    setText('contact-body', content.contact.body);
    setLink('contact-phone', 'tel:' + String((content.contact && content.contact.phone) || '').replace(/\s+/g, ''), content.contact.phone, hasText(content.contact.phone));
    setLink('contact-email', 'mailto:' + ((content.contact && content.contact.email) || ''), content.contact.email, hasText(content.contact.email));
    setText('contact-address', content.contact.address);
  }

  function renderSocialLinks(content) {
    var container = document.getElementById('social-links');
    if (!container) return;

    var entries = Object.entries((content.footer && content.footer.socialLinks) || {}).filter(function (entry) {
      return Boolean(entry[1]);
    });

    if (!entries.length) {
      container.innerHTML = '<span class="site-footer__meta">Inga sociala länkar angivna.</span>';
      return;
    }

    container.innerHTML = entries.map(function (entry) {
      return '<a class="site-footer__social-link" href="' + escapeHtml(entry[1]) + '" target="_blank" rel="noreferrer">' + escapeHtml(entry[0]) + '</a>';
    }).join('');
  }

  function applySeo(content) {
    document.documentElement.lang = content.site.language || 'sv';
    document.title = content.seo.title || '';
    setMeta('meta[name="description"]', content.seo.description || '');
    setMeta('meta[property="og:locale"]', localeFromLanguage(content.site.language));
    setMeta('meta[property="og:title"]', content.seo.title || '');
    setMeta('meta[property="og:description"]', content.seo.description || '');
    setMeta('meta[property="og:image"]', (content.media && content.media.heroImage && content.media.heroImage.url) || '');
    setMeta('meta[name="twitter:title"]', content.seo.title || '');
    setMeta('meta[name="twitter:description"]', content.seo.description || '');
    setMeta('meta[name="twitter:image"]', (content.media && content.media.heroImage && content.media.heroImage.url) || '');
  }

  function applyContent(content) {
    setThemeMode(content.site && content.site.themeMode);
    applySeo(content);
    createBrand('header-brand', content.site.displayName, content.media && content.media.logoUrl);
    createBrand('footer-brand', content.footer.companyName, content.media && content.media.logoUrl);
    setText('hero-eyebrow', content.hero.eyebrow);
    setText('hero-headline', content.hero.headline);
    setText('hero-subheadline', content.hero.subheadline);
    setText('footer-tagline', content.footer.tagline);
    setText('footer-copyright', content.footer.copyright);

    renderHeroVisual(content);
    renderIntro(content);
    renderServices(content);
    renderAbout(content);
    renderTestimonials(content);
    renderFaq(content);
    renderGallery(content);
    renderContact(content);
    renderSocialLinks(content);
  }

  window.__contentCreatorApplyContent = applyContent;

  function setupNavigation() {
    if (!navToggle || !siteNavigation) {
      return;
    }

    navToggle.addEventListener('click', function () {
      var isOpen = siteNavigation.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    siteNavigation.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        siteNavigation.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var embeddedContent = readEmbeddedContent();
  if (embeddedContent) {
    applyContent(embeddedContent);
  }

  fetch('content/home.json')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Kunde inte ladda innehåll.');
      }
      return response.json();
    })
    .then(function (content) {
      applyContent(content);
      setupNavigation();
    })
    .catch(function (error) {
      console.warn('Falling back to embedded content', error);
      if (!embeddedContent) {
        document.title = 'Kunde inte ladda webbplatsen';
        setText('hero-headline', 'Kunde inte ladda webbplatsen');
        setText('hero-subheadline', 'Innehållsfilen kunde inte läsas in.');
      }
      setupNavigation();
    });
})();