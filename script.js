/* =========================================================
   Tex.NEL — interactions
   ========================================================= */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------
     1. 背景点阵 / 粒子
     ------------------------------------------------------- */

  var canvas = document.getElementById('gridCanvas');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

  if (ctx && !reduceMotion) {
    var W = 0;
    var H = 0;
    var dpr = 1;
    var dots = [];
    var particles = [];
    var pointer = { x: -9999, y: -9999, active: false };
    var GAP = 46;
    var LINK_DIST = 130;

    function buildScene() {
      var rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      var startX = (W % GAP) / 2;
      var startY = (H % GAP) / 2;
      for (var y = startY; y < H; y += GAP) {
        for (var x = startX; x < W; x += GAP) {
          dots.push({ x: x, y: y, seed: Math.random() * Math.PI * 2 });
        }
      }

      var count = W < 760 ? 10 : 22;
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          r: Math.random() * 1.3 + 0.7
        });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      // 点阵：靠近指针的点被点亮
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var alpha = 0.095;
        var radius = 1;

        if (pointer.active) {
          var dx = d.x - pointer.x;
          var dy = d.y - pointer.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 170) {
            var k = 1 - dist / 170;
            alpha = 0.095 + k * 0.5;
            radius = 1 + k * 1.1;
          }
        }

        if (radius > 1.2) {
          ctx.fillStyle = 'rgba(94, 233, 143, ' + alpha.toFixed(3) + ')';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
        }
        ctx.fillRect(d.x - radius / 2, d.y - radius / 2, radius, radius);
      }

      // 浮动粒子 + 连线
      for (var p = 0; p < particles.length; p++) {
        var pt = particles[p];
        pt.x += pt.vx;
        pt.y += pt.vy;

        if (pt.x < -20) pt.x = W + 20;
        if (pt.x > W + 20) pt.x = -20;
        if (pt.y < -20) pt.y = H + 20;
        if (pt.y > H + 20) pt.y = -20;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.32)';
        ctx.fill();

        for (var q = p + 1; q < particles.length; q++) {
          var op = particles[q];
          var ox = pt.x - op.x;
          var oy = pt.y - op.y;
          var od = Math.sqrt(ox * ox + oy * oy);
          if (od < LINK_DIST) {
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(op.x, op.y);
            ctx.strokeStyle = 'rgba(74, 222, 128, ' + (0.1 * (1 - od / LINK_DIST)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    function onPointerMove(e) {
      var rect = canvas.getBoundingClientRect();
      var point = e.touches ? e.touches[0] : e;
      pointer.x = point.clientX - rect.left;
      pointer.y = point.clientY - rect.top;
      pointer.active = true;
    }

    function onPointerLeave() {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    }

    buildScene();
    requestAnimationFrame(draw);

    window.addEventListener('resize', debounce(buildScene, 200));
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('mouseout', onPointerLeave);
    window.addEventListener('touchend', onPointerLeave);
  }

  /* -------------------------------------------------------
     2. 滚动出现
     ------------------------------------------------------- */

  var revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -60px 0px' }
    );

    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // 兜底：若观察器未能及时回调，视口内的元素直接显示
  window.setTimeout(function () {
    var vh = window.innerHeight || 800;
    revealEls.forEach(function (el) {
      if (el.classList.contains('is-visible')) return;
      var rect = el.getBoundingClientRect();
      if (rect.top < vh && rect.bottom > 0) {
        el.classList.add('is-visible');
      }
    });
  }, 1200);

  /* -------------------------------------------------------
     3. 导航状态 + 阅读进度
     ------------------------------------------------------- */

  var nav = document.getElementById('nav');
  var progress = document.getElementById('navProgress');
  var ticking = false;

  function updateScroll() {
    var top = window.scrollY || window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;

    if (nav) {
      nav.classList.toggle('scrolled', top > 24);
    }

    if (progress) {
      var pct = max > 0 ? Math.min(top / max, 1) * 100 : 0;
      progress.style.width = pct.toFixed(2) + '%';
    }

    ticking = false;
  }

  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateScroll);
      }
    },
    { passive: true }
  );

  updateScroll();

  /* -------------------------------------------------------
     4. 卡片跟随光斑
     ------------------------------------------------------- */

  var spotCards = document.querySelectorAll('[data-spot]');

  spotCards.forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', e.clientX - rect.left + 'px');
      card.style.setProperty('--my', e.clientY - rect.top + 'px');
    });
  });

  /* -------------------------------------------------------
     5. 启动器卡片轻微视差
     ------------------------------------------------------- */

  var tilt = document.querySelector('[data-tilt]');

  if (tilt && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    var tiltParent = tilt.parentElement;

    tiltParent.addEventListener('mousemove', function (e) {
      if (window.innerWidth < 1020) return;
      var rect = tiltParent.getBoundingClientRect();
      var nx = (e.clientX - rect.left) / rect.width - 0.5;
      var ny = (e.clientY - rect.top) / rect.height - 0.5;
      tilt.style.transform =
        'rotateY(' + (-7 + nx * 5).toFixed(2) + 'deg) rotateX(' + (3.5 - ny * 4).toFixed(2) + 'deg)';
    });

    tiltParent.addEventListener('mouseleave', function () {
      tilt.style.transform = '';
    });
  }

  /* -------------------------------------------------------
     6. 年份
     ------------------------------------------------------- */

  var year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  /* -------------------------------------------------------
     utils
     ------------------------------------------------------- */

  function debounce(fn, wait) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }
})();
