(function () {
  var navToggle = document.querySelector('.nav-toggle');
  var siteNavigation = document.querySelector('.site-navigation');
  var currentYear = document.getElementById('current-year');

  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }

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
})();
