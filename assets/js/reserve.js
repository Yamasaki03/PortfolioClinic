/* =========================================================
   ご予約ページ — 予約サービスの画面(見本)
   メニュー → 日時 → お名前とお電話番号 の3段階。
   実案件では予約サービスの埋め込みに置き換えるため、
   空き枠は日付から決まる仮のデータで、入力内容は送信しない。
   ========================================================= */
(function () {
  'use strict';

  var form = document.getElementById('booking-form');
  if (!form) return;

  var helpers = window.Soyokaze;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  var DAYS_AHEAD = 14;
  var DAYS_PER_PAGE = 7;
  var LEAD_MINUTES = 60; // 当日は1時間後の枠から

  var state = {
    step: 1,
    menu: null,
    dayIndex: null,
    time: null,
    page: 0
  };

  var days = buildDays();

  /* ---------- 受付時間と空き枠 ---------- */
  function timesBetween(start, end) {
    // start〜end(どちらも分)を30分刻みで
    var list = [];
    for (var m = start; m <= end; m += 30) {
      list.push(Math.floor(m / 60) + ':' + (m % 60 === 0 ? '00' : '30'));
    }
    return list;
  }

  function toMinutes(time) {
    var parts = time.split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  // 日付と時間から決まる「埋まっている枠」(見本用)
  function isTaken(key, time) {
    var str = key + time;
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % 9973;
    }
    return hash % 100 < 32;
  }

  function buildDays() {
    var list = [];
    var now = new Date();
    var nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (var i = 0; i < DAYS_AHEAD; i++) {
      var date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      var dow = date.getDay();
      var key = helpers.dateKey(date);
      var closed = dow === 0 || helpers.isHoliday(date);
      var groups = [];
      var note = '';

      if (!closed) {
        if (dow === 6) {
          groups = [
            { label: '午前', times: timesBetween(9 * 60, 12 * 60) },
            { label: '午後(14:00まで)', times: timesBetween(12 * 60 + 30, 13 * 60 + 30) }
          ];
          note = '14時まで';
        } else if (dow === 4) {
          groups = [{ label: '午前', times: timesBetween(9 * 60, 12 * 60) }];
          note = '午前のみ';
        } else {
          groups = [
            { label: '午前', times: timesBetween(9 * 60, 12 * 60) },
            { label: '午後', times: timesBetween(15 * 60, 19 * 60) }
          ];
        }
      }

      var free = 0;
      groups.forEach(function (group) {
        group.slots = group.times.map(function (time) {
          var past = i === 0 && toMinutes(time) < nowMinutes + LEAD_MINUTES;
          var available = !past && !isTaken(key, time);
          if (available) free++;
          return { time: time, available: available };
        });
      });

      list.push({
        date: date,
        isToday: i === 0,
        closed: closed,
        groups: groups,
        free: free,
        note: note
      });
    }
    return list;
  }

  /* ---------- 表示用の文字 ---------- */
  function formatDay(day) {
    var d = day.date;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日(' + WEEKDAYS[d.getDay()] + ')';
  }

  function dayStatus(day) {
    if (day.closed) return { mark: '休', text: '休診日' };
    if (day.free === 0) return { mark: '×', text: '満' };
    if (day.free <= 3) return { mark: '△', text: day.note || '残りわずか' };
    return { mark: '○', text: day.note || '空きあり' };
  }

  function menuLabel() {
    var input = form.querySelector('input[name="menu"]:checked');
    return input ? input.dataset.label : '';
  }

  function dateTimeLabel() {
    if (state.dayIndex === null || !state.time) return '';
    return formatDay(days[state.dayIndex]) + ' ' + state.time;
  }

  /* ---------- 日付と時間のボタン ---------- */
  var dayGrid = document.getElementById('day-grid');
  var slotArea = document.getElementById('slot-area');
  var timeDay = document.getElementById('time-day');
  var weekPrev = document.getElementById('week-prev');
  var weekNext = document.getElementById('week-next');

  function renderDays() {
    dayGrid.innerHTML = '';
    var start = state.page * DAYS_PER_PAGE;

    days.slice(start, start + DAYS_PER_PAGE).forEach(function (day, offset) {
      var index = start + offset;
      var status = dayStatus(day);
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'day-btn' + (day.isToday ? ' is-today' : '');
      button.disabled = day.closed || day.free === 0;
      button.setAttribute('aria-pressed', String(state.dayIndex === index));
      button.setAttribute('aria-label',
        formatDay(day) + (day.isToday ? ' 本日' : '') + ' ' + status.text);
      button.innerHTML =
        '<span class="day-btn__date">' + (day.date.getMonth() + 1) + '/' + day.date.getDate() + '</span>' +
        '<span class="day-btn__week">' + WEEKDAYS[day.date.getDay()] + (day.isToday ? '・本日' : '') + '</span>' +
        '<span class="day-btn__status">' + status.mark + ' ' + status.text + '</span>';
      button.addEventListener('click', function () {
        state.dayIndex = index;
        state.time = null;
        renderDays();
        renderSlots();
        updateSummaries();
      });
      dayGrid.appendChild(button);
    });

    weekPrev.disabled = state.page === 0;
    weekNext.disabled = (state.page + 1) * DAYS_PER_PAGE >= days.length;
  }

  function renderSlots() {
    slotArea.innerHTML = '';

    if (state.dayIndex === null) {
      timeDay.textContent = '';
      var empty = document.createElement('p');
      empty.className = 'slot-empty';
      empty.textContent = '先に日にちを選んでください。';
      slotArea.appendChild(empty);
      return;
    }

    var day = days[state.dayIndex];
    timeDay.textContent = formatDay(day);

    day.groups.forEach(function (group) {
      var wrap = document.createElement('div');
      wrap.className = 'slot-group';

      var label = document.createElement('p');
      label.className = 'slot-group__label';
      label.textContent = group.label;
      wrap.appendChild(label);

      var grid = document.createElement('div');
      grid.className = 'slot-grid';

      group.slots.forEach(function (slot) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'slot-btn';
        button.disabled = !slot.available;
        button.setAttribute('aria-pressed', String(state.time === slot.time));
        button.setAttribute('aria-label', slot.time + (slot.available ? ' 予約できます' : ' 予約がいっぱいです'));
        button.innerHTML = slot.time + ' <span class="slot-btn__mark" aria-hidden="true">' + (slot.available ? '○' : '×') + '</span>';
        button.addEventListener('click', function () {
          state.time = slot.time;
          grid.closest('#slot-area').querySelectorAll('.slot-btn').forEach(function (b) {
            b.setAttribute('aria-pressed', 'false');
          });
          button.setAttribute('aria-pressed', 'true');
          setMessage(2, '');
          updateSummaries();
        });
        grid.appendChild(button);
      });

      wrap.appendChild(grid);
      slotArea.appendChild(wrap);
    });
  }

  weekPrev.addEventListener('click', function () {
    if (state.page > 0) { state.page--; renderDays(); }
  });
  weekNext.addEventListener('click', function () {
    if ((state.page + 1) * DAYS_PER_PAGE < days.length) { state.page++; renderDays(); }
  });

  /* ---------- まとめ表示 ---------- */
  function updateSummaries() {
    var summary1 = form.querySelector('[data-summary="1"]');
    var summary2 = form.querySelector('[data-summary="2"]');
    summary1.textContent = state.menu ? '選んだメニュー:' + menuLabel() : 'メニューを選んでください';
    summary2.textContent = state.time ? dateTimeLabel() : '日にちと時間を選んでください';
  }

  function fillSummary(dl, extra) {
    var rows = [['メニュー', menuLabel()], ['日時', dateTimeLabel()]].concat(extra || []);
    dl.innerHTML = '';
    rows.forEach(function (row) {
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
  }

  function setMessage(step, text) {
    var el = form.querySelector('[data-message="' + step + '"]');
    if (el) el.textContent = text;
  }

  /* ---------- ステップの切り替え ---------- */
  var booking = form.closest('.booking');

  function showStep(step, initial) {
    state.step = step;

    form.querySelectorAll('.booking-panel').forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== String(step);
    });

    form.closest('.booking__body').querySelectorAll('[data-progress]').forEach(function (item) {
      var n = Number(item.dataset.progress);
      var current = step === n;
      var done = step === 'done' || n < step;
      item.classList.toggle('is-current', current);
      item.classList.toggle('is-done', done);
      if (current) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });

    if (step === 3) fillSummary(form.querySelector('[data-confirm]'));
    if (initial) return;

    // 予約枠の上が見えていなければ戻す
    var top = booking.getBoundingClientRect().top;
    if (top < 0) booking.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

    var title = form.querySelector('[data-panel="' + step + '"] .booking-panel__title');
    if (title) title.focus({ preventScroll: true });
  }

  function validateStep(step) {
    if (step === 1) {
      if (!state.menu) {
        setMessage(1, 'メニューを1つ選んでください。');
        return false;
      }
    }
    if (step === 2) {
      if (state.dayIndex === null) {
        setMessage(2, '日にちを選んでください。');
        return false;
      }
      if (!state.time) {
        setMessage(2, '時間を選んでください。');
        return false;
      }
    }
    if (step === 3) return validateForm();
    setMessage(step, '');
    return true;
  }

  /* ---------- 入力チェック ---------- */
  var nameInput = document.getElementById('f-name');
  var proxyInput = document.getElementById('f-proxy');
  var telInput = document.getElementById('f-tel');
  var proxyField = document.getElementById('field-proxy');

  function setFieldError(input, show) {
    var error = document.getElementById(input.id + '-error');
    input.setAttribute('aria-invalid', String(show));
    if (error) error.hidden = !show;
  }

  function normalizeTel(value) {
    // 全角数字やハイフン・空白を許す
    return value
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[\s\-－ー−‐()()]/g, '');
  }

  function isFamily() {
    return form.querySelector('input[name="who"]:checked').value === 'family';
  }

  function validateForm() {
    var firstInvalid = null;

    var nameOk = nameInput.value.trim() !== '';
    setFieldError(nameInput, !nameOk);
    if (!nameOk) firstInvalid = firstInvalid || nameInput;

    if (isFamily()) {
      var proxyOk = proxyInput.value.trim() !== '';
      setFieldError(proxyInput, !proxyOk);
      if (!proxyOk) firstInvalid = firstInvalid || proxyInput;
    } else {
      setFieldError(proxyInput, false);
    }

    var tel = normalizeTel(telInput.value);
    var telOk = /^0\d{9,10}$/.test(tel);
    setFieldError(telInput, !telOk);
    if (!telOk) firstInvalid = firstInvalid || telInput;

    if (firstInvalid) {
      setMessage(3, '入力していただきたいところがあります。赤い枠の欄をご確認ください。');
      firstInvalid.focus();
      return false;
    }
    setMessage(3, '');
    return true;
  }

  // 入力し直したら、その欄のエラーを消す
  [nameInput, proxyInput, telInput].forEach(function (input) {
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') setFieldError(input, false);
    });
  });

  form.querySelectorAll('input[name="who"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      proxyField.hidden = !isFamily();
      if (!isFamily()) setFieldError(proxyInput, false);
    });
  });

  /* ---------- 操作 ---------- */
  form.querySelectorAll('input[name="menu"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      state.menu = radio.value;
      setMessage(1, '');
      updateSummaries();
    });
  });

  form.addEventListener('click', function (event) {
    if (event.target.closest('[data-next]')) {
      if (validateStep(state.step)) showStep(state.step + 1);
    } else if (event.target.closest('[data-back]')) {
      showStep(state.step - 1);
    } else if (event.target.closest('[data-restart]')) {
      reset();
    }
  });

  // Enterキーでも次へ進めるように
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (state.step !== 3) {
      if (validateStep(state.step)) showStep(state.step + 1);
      return;
    }
    if (!validateForm()) return;

    var extra = [['お名前', nameInput.value.trim() + ' 様']];
    if (isFamily()) extra.push(['ご予約者', proxyInput.value.trim() + ' 様']);
    extra.push(['お電話番号', telInput.value.trim()]);
    fillSummary(form.querySelector('[data-done-summary]'), extra);

    // 実案件では、予約サービス側で完了数を計測する
    if (typeof window.gtag === 'function') window.gtag('event', 'reserve_complete');

    showStep('done');
  });

  function reset() {
    form.reset();
    state.menu = null;
    state.dayIndex = null;
    state.time = null;
    state.page = 0;
    proxyField.hidden = true;
    [nameInput, proxyInput, telInput].forEach(function (input) { setFieldError(input, false); });
    [1, 2, 3].forEach(function (n) { setMessage(n, ''); });
    renderDays();
    renderSlots();
    updateSummaries();
    showStep(1);
  }

  /* ---------- はじめの表示 ---------- */
  renderDays();
  renderSlots();
  updateSummaries();
  showStep(1, true);
})();
