/* =========================================================
   そよかぜ整骨院・鍼灸院 — 共通スクリプト(バニラJS)
   - 受付日・祝日の判定(ご予約ページでも使う)
   - 受付時間表の「本日」表示
   - セクションの出現(一度だけ)
   - よくある質問の開閉アニメーション
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 祝日(2026〜2027年) ---------- */
  var HOLIDAYS = [
    '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20',
    '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
    '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23',
    '2026-10-12', '2026-11-03', '2026-11-23',
    '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21',
    '2027-03-22', '2027-04-29', '2027-05-03', '2027-05-04', '2027-05-05',
    '2027-07-19', '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11',
    '2027-11-03', '2027-11-23'
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function dateKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function isHoliday(d) {
    return HOLIDAYS.indexOf(dateKey(d)) !== -1;
  }

  // ご予約ページの予約画面(見本)から使う
  window.Soyokaze = {
    dateKey: dateKey,
    isHoliday: isHoliday
  };

  /* ---------- 受付時間表の「本日」 ---------- */
  function markToday() {
    var today = new Date();
    var day = isHoliday(today) ? 0 : today.getDay();

    // PC:列(見出しと各セル)
    document.querySelectorAll('.hours-table--pc [data-day="' + day + '"]').forEach(function (cell) {
      cell.classList.add('is-today');
      if (cell.tagName === 'TH') {
        var badge = document.createElement('span');
        badge.className = 'today-badge';
        badge.textContent = '本日';
        cell.appendChild(badge);
      }
    });

    // スマホ:行
    var row = document.querySelector('.hours-table--sp tr[data-day="' + day + '"]');
    if (row) {
      var th = row.querySelector('th');
      th.classList.add('is-today');
      var badge = document.createElement('span');
      badge.className = 'today-badge';
      badge.textContent = '本日';
      th.appendChild(badge);
    }
  }

  /* ---------- 出現アニメーション ---------- */
  function setupReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    // 並んだカードは80msずつずらす。4個目以降は同時
    document.querySelectorAll('[data-reveal-group]').forEach(function (group) {
      group.querySelectorAll('.reveal').forEach(function (el, i) {
        el.style.setProperty('--i', Math.min(i, 3));
      });
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // 動きは一度だけ
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- よくある質問(300msでなめらかに開閉) ---------- */
  function setupFaq() {
    var DURATION = 300;

    document.querySelectorAll('details.faq').forEach(function (details) {
      var summary = details.querySelector('summary');
      var body = details.querySelector('.faq__body');
      if (!summary || !body || reduceMotion || !body.animate) return;

      var animation = null;

      summary.addEventListener('click', function (event) {
        event.preventDefault();
        if (animation) animation.cancel();

        if (details.open) {
          animation = body.animate(
            { height: [body.offsetHeight + 'px', '0px'], opacity: [1, 0] },
            { duration: DURATION, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }
          );
          animation.onfinish = function () {
            details.open = false;
            animation = null;
          };
        } else {
          details.open = true;
          animation = body.animate(
            { height: ['0px', body.offsetHeight + 'px'], opacity: [0, 1] },
            { duration: DURATION, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }
          );
          animation.onfinish = function () { animation = null; };
        }
      });
    });
  }

  /* ---------- 電話リンクのタップ計測(実案件では解析タグに送る) ---------- */
  function setupTelTracking() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="tel:"]');
      if (!link) return;
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'tel_tap', { link_position: link.dataset.track || 'other' });
      }
    });
  }

  markToday();
  setupReveal();
  setupFaq();
  setupTelTracking();
})();
