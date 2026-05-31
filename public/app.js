(function () {
  var DATA_PATHS = {
    schedule: "/data/grafik.json",
    pricing: "/data/cennik.json",
    messages: "/data/komunikaty.json",
    site: "/data/site.json"
  };

  var DAYS = ["Poniedzialek", "Wtorek", "Sroda", "Czwartek", "Piatek", "Sobota", "Niedziela"];

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
        day: day,
        items: items.filter(function (item) {
          return item.dzien === day;
        })
      };
    }).filter(function (group) {
      return group.items.length;
    });
  }

  function renderTodayClasses(items) {
    var node = qs("[data-today-classes]");
    if (!node) return;

    var todayIndex = new Date().getDay();
    var dayName = DAYS[todayIndex === 0 ? 6 : todayIndex - 1];
    var todaysItems = items.filter(function (item) {
      return item.dzien === dayName;
    }).slice(0, 4);

    // If no items for today, render placeholder cards (keeps layout matching the example)
    if (!todaysItems.length) {
      todaysItems = (items && items.slice && items.slice(0, 4)) || [];
    }

    if (!todaysItems.length) {
      todaysItems = [
        { godzina: '17:00', nazwa: 'PILATES', trener: 'Kasia', placeholder: true },
        { godzina: '18:00', nazwa: 'STRONG NATION', trener: 'Ania', placeholder: true },
        { godzina: '19:00', nazwa: 'ZDROWY KRĘGOSŁUP', trener: 'Kasia', placeholder: true },
        { godzina: '20:00', nazwa: 'TABATA', trener: 'Michał', placeholder: true }
      ];
    }

    node.innerHTML = todaysItems.map(function (item) {
      var classes = ['class-card'];
      if (item.placeholder) classes.push('placeholder');
      return [
        '<article class="' + classes.join(' ') + '">',
        '<span class="time">' + item.godzina + '</span>',
        '<h3>' + item.nazwa + '</h3>',
        '<span class="trainer">' + (item.trener || "") + '</span>',
        '</article>'
      ].join("");
    }).join("");
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
            '<div class="schedule-item">',
            '<span class="time">' + item.godzina + '</span>',
            '<h3>' + item.nazwa + '</h3>',
            '<p>' + (item.trener || "") + '</p>',
            '</div>'
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

  function init() {
    initNav();

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
