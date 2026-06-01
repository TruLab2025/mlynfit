(function () {
  var DATA_PATHS = {
    schedule: "/data/grafik.json",
    pricing: "/data/cennik.json",
    messages: "/data/komunikaty.json",
    site: "/data/site.json"
  };

  var DAYS = [
    { key: "Poniedzialek", label: "Poniedziałek" },
    { key: "Wtorek", label: "Wtorek" },
    { key: "Sroda", label: "Środa" },
    { key: "Czwartek", label: "Czwartek" },
    { key: "Piatek", label: "Piątek" },
    { key: "Sobota", label: "Sobota" },
    { key: "Niedziela", label: "Niedziela" }
  ];

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Nie udalo sie pobrac " + url);
      }
      return response.json();
    });
  }

  function activeItems(payload) {
    return (payload.items || []).filter(function (item) {
      return item.aktywne !== false;
    });
  }

  function groupByDay(items) {
    return DAYS.map(function (day) {
      return {
        day: day.label,
        items: items.filter(function (item) {
          return item.dzien === day.key;
        })
      };
    }).filter(function (group) {
      return group.items.length;
    });
  }

  var TILE_MAP = {
    'pilates':      '/assets/pilates_tile_600x400.webp',
    'wzmacnianie':  '/assets/pilates_tile_600x400.webp',
    'hiit':         '/assets/hiit_tile_600x400.webp',
    'spalanie':     '/assets/hiit_tile_600x400.webp',
    'tabata':       '/assets/hiit_tile_600x400.webp',
    'body pump':    '/assets/bodypump_tile_600x400.webp',
    'figura':       '/assets/bodypump_tile_600x400.webp',
    'kształtowanie': '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'ksztaltowanie': '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'modelowanie':  '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'kickboxing':   '/assets/kickboxing_tile_600x400.webp',
    'kickobxing':   '/assets/kickboxing_tile_600x400.webp',
    'kregoslup':    '/assets/kregoslup_tile_original_600x400.webp',
    'kręgosłup':    '/assets/kregoslup_tile_original_600x400.webp',
    'salsation':    '/assets/salsation_tile_600x400.webp',
    'stretching':   '/assets/kregoslup_tile_original_600x400.webp'
  };

  function getTile(nazwa) {
    var key = (nazwa || '').toLowerCase();
    for (var k in TILE_MAP) {
      if (key.indexOf(k) !== -1) return TILE_MAP[k];
    }
    return null;
  }

  function renderTodayClasses(items) {
    var node = qs("[data-today-classes]");
    if (!node) return;

    var seen = {};
    var classItems = items.filter(function (item) {
      var key = (item.nazwa || "").toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });

    if (!classItems.length) {
      classItems = [
        { godzina: '17:00', nazwa: 'Pilates', trener: 'Kasia' },
        { godzina: '18:00', nazwa: 'HIIT', trener: 'Ania' },
        { godzina: '19:00', nazwa: 'Zdrowy Kręgosłup', trener: 'Kasia' },
        { godzina: '20:00', nazwa: 'Body Pump', trener: 'Michał' },
        { godzina: '18:00', nazwa: 'Kickboxing', opis: '7-12 lat' },
        { godzina: '19:30', nazwa: 'Kształtowanie sylwetki + rozciąganie' },
        { godzina: '18:00', nazwa: 'Salsation' }
      ];
    }

    node.innerHTML = classItems.map(function (item) {
      var tile = getTile(item.nazwa);
      var imgHtml = tile
        ? '<div class="class-card-img"><img src="' + tile + '" alt="' + item.nazwa + '" loading="lazy"></div>'
        : '';
      var noteHtml = item.opis ? '<p class="class-card-note">' + item.opis + '</p>' : '';
      var trainerHtml = item.trener ? '<p class="class-card-trainer">' + item.trener + '</p>' : '';
      return [
        '<article class="class-card">',
        imgHtml,
        '<div class="class-card-body">',
        '<span class="time">' + item.godzina + '</span>',
        '<h3>' + item.nazwa + '</h3>',
        noteHtml,
        trainerHtml,
        '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function initClassSlider() {
    var slider = qs("[data-class-slider]");
    var track = qs("[data-today-classes]");
    var prev = qs("[data-class-prev]");
    var next = qs("[data-class-next]");
    if (!slider || !track || !prev || !next) return;

    function step() {
      var firstCard = track.querySelector(".class-card");
      if (!firstCard) return 320;
      var gap = 14;
      return firstCard.getBoundingClientRect().width + gap;
    }

    prev.addEventListener("click", function () {
      track.scrollBy({ left: -step(), behavior: "smooth" });
    });

    next.addEventListener("click", function () {
      track.scrollBy({ left: step(), behavior: "smooth" });
    });
  }

  function renderSchedule(items) {
    var node = qs("[data-schedule]");
    if (!node) return;

    node.innerHTML = groupByDay(items).map(function (group) {
      return [
        '<section class="schedule-day">',
        '<h2>' + group.day + '</h2>',
        group.items.map(function (item) {
          return [
            '<article class="schedule-item">',
            '<div class="schedule-time">' + item.godzina + '</div>',
            '<div class="schedule-content">',
            '<h3>' + item.nazwa + '</h3>',
            item.opis ? '<p class="schedule-note">' + item.opis + '</p>' : '',
            item.trener ? '<p class="schedule-trainer">' + item.trener + '</p>' : '',
            '</div>',
            '</article>'
          ].join("");
        }).join(""),
        '</section>'
      ].join("");
    }).join("");
  }

  function renderPricing(items) {
    var node = qs("[data-pricing]");
    if (!node) return;

    node.innerHTML = items.map(function (item) {
      var className = item.wyrozniony ? "price-card featured" : "price-card";
      return [
        '<article class="' + className + '">',
        '<h3>' + item.nazwa + '</h3>',
        '<span class="price">' + item.cena + '</span>',
        '<p>' + item.opis + '</p>',
        '</article>'
      ].join("");
    }).join("");
  }

  function renderMessages(items) {
    var node = qs("[data-messages]");
    if (!node || !items.length) return;
    node.innerHTML = items.map(function (item) {
      return '<p>' + item.tresc + '</p>';
    }).join("");
  }

  function renderContact(site) {
    qsa("[data-contact]").forEach(function (node) {
      node.innerHTML = [
        '<strong>' + site.nazwa + '</strong><br>',
        site.adres.ulica + '<br>',
        site.adres.kod + ' ' + site.adres.miasto + '<br>',
        '<a href="tel:' + site.telefon.replace(/\s/g, "") + '">' + site.telefon + '</a><br>',
        '<a href="mailto:' + site.email + '">' + site.email + '</a><br>',
        '<span>' + site.godziny + '</span>'
      ].join("");
    });
  }

  function initNav() {
    var toggle = qs("[data-nav-toggle]");
    var nav = qs("[data-nav]");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      nav.classList.toggle("is-open");
    });
  }

  function initReveal() {
    if (!window.IntersectionObserver) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    qsa('.reveal').forEach(function (el) {
      observer.observe(el);
    });
  }

  function init() {
    initNav();
    initReveal();
    initClassSlider();

    fetchJson(DATA_PATHS.schedule)
      .then(activeItems)
      .then(function (items) {
        renderTodayClasses(items);
        renderSchedule(items);
      })
      .catch(function (error) {
        console.warn(error.message);
        // Render placeholders if schedule cannot be loaded
        try {
          renderTodayClasses([]);
        } catch (e) { /* ignore */ }
      });

    fetchJson(DATA_PATHS.pricing)
      .then(activeItems)
      .then(renderPricing)
      .catch(function (error) {
        console.warn(error.message);
      });

    fetchJson(DATA_PATHS.messages)
      .then(activeItems)
      .then(renderMessages)
      .catch(function (error) {
        console.warn(error.message);
      });

    fetchJson(DATA_PATHS.site)
      .then(renderContact)
      .catch(function (error) {
        console.warn(error.message);
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
