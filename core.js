// ─────────────────────────────────────────────
// GLOBAL VARIABLES
// ─────────────────────────────────────────────

const durationBase = 0.8;
const durationSlow = 1.2;
const durationFast = 0.4;
const easeBase = "power4.out";

// ─────────────────────────────────────────────
// SCROLL (Lenis, lock, anchors)
// ─────────────────────────────────────────────

let lenis = null;

function lenisScroll() {
  lenis = new Lenis({ lerp: 0.08 });
  window.lenis = lenis;

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);

  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });
}

function disableScroll() {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.overflow = "hidden";
  document.documentElement.style.paddingRight = `${scrollbarWidth}px`; // prevents layout shift
  if (lenis) lenis.stop();
}

function enableScroll() {
  document.documentElement.style.overflow = "";
  document.documentElement.style.paddingRight = "";
  if (lenis) lenis.start();
}

const anchorScrollOptions = {
  duration: 1.4,
  easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), // cubic in-out
};

function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, anchorScrollOptions);
  else target.scrollIntoView({ behavior: "smooth" });
}

function anchorScroll(menuController, drawerController) {
  window.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const link = e.target.closest('a[href*="#"]');
      if (!link || link.closest("[data-scroll-ignore]")) return;

      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;

      if (url.hash === "#contact" && drawerController) {
        e.preventDefault();
        e.stopPropagation();
        if (menuController?.isOpen()) menuController.close();
        const source = link.closest(".nav_wrap") ? "nav" : link.closest(".footer_wrap") ? "footer" : link.closest("section[id]")?.id || "page";
        drawerController.open(source);
        return;
      }

      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();
      history.pushState(null, "", url.hash);

      if (menuController?.isOpen()) {
        menuController.closeAndScrollTo(target);
      } else {
        scrollToTarget(target);
      }
    },
    true // capture phase
  );
}

// ─────────────────────────────────────────────
// TEXT SCRAMBLE
// ─────────────────────────────────────────────

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function scrambleTween(el, {
  duration = 1,
  reveal = "random",
  chars = SCRAMBLE_CHARS,
  revealStart = 0.3,
  fps = 16,
} = {}) {
  const original = el.textContent.trim();
  const letters = [...original];
  const thresholds = letters.map(() =>
    reveal === "snap" ? 1 : revealStart + Math.random() * (1 - revealStart)
  );
  const randChar = () => chars[Math.floor(Math.random() * chars.length)];
  const state = { p: 0 };
  let last = 0;

  return gsap.to(state, {
    p: 1,
    duration,
    ease: "none",
    onUpdate() {
      const now = performance.now();
      if (state.p < 1 && now - last < 1000 / fps) return;
      last = now;
      el.textContent = letters
        .map((c, i) => (c === " " || state.p >= thresholds[i] ? c : randChar()))
        .join("");
    },
    onComplete: () => (el.textContent = original),
  });
}

// ─────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────

function loader() {
  const wrap = document.querySelector('[data-load="wrap"]');
  const nav = document.querySelector('[data-load="nav"]');

  if (!wrap) return;

  const eyebrow = wrap.querySelector('[data-load="eyebrow"]');
  const heading = wrap.querySelector('[data-load="heading"]');
  const headingEl = heading?.querySelector("h1, h2") || heading;
  const ups = wrap.querySelectorAll('[data-load="fade-up"]');
  const lefts = wrap.querySelectorAll('[data-load="fade-left"]');
  const fades = wrap.querySelectorAll('[data-load="fade"]');

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const offset = eyebrow ? 0.2 : 0;

  const tl = gsap.timeline({
    defaults: { ease: easeBase, duration: 1.4 },
  });

  if (eyebrow) {
    const text = eyebrow.querySelector(".eyebrow_text");
    const marker = eyebrow.querySelector(".eyebrow_marker");

    if (reduceMotion || !text) {
      tl.set(eyebrow, { autoAlpha: 1 }, 0);
    } else {
      if (marker) gsap.set(marker, { scale: 0 });

      tl.fromTo(eyebrow, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0);

      if (marker) {
        tl.to(marker, {
          scale: 1,
          duration: 0.8,
          ease: "power4.out",
          onComplete: () => gsap.set(marker, { clearProps: "transform" }),
        }, 0);
      }

      tl.add(
        scrambleTween(text, { duration: 1, reveal: eyebrow.dataset.scramble || "random" }),
        0
      );
    }
  }

  if (heading) {
    if (typeof SplitText !== "undefined") {
      const split = new SplitText(headingEl, { type: "words", mask: "words", wordsClass: "word" });
      gsap.set(heading, { autoAlpha: 1 });
      tl.fromTo(
        split.words,
        { y: "1em", autoAlpha: 0, filter: "blur(3px)" },
        {
          y: "0em",
          autoAlpha: 1,
          filter: "blur(0px)",
          stagger: { each: 0.04, from: "random" },
        },
        offset
      );
    } else {
      tl.fromTo(heading, { autoAlpha: 0, y: "2rem" }, { autoAlpha: 1, y: "0rem" }, offset);
    }
  }

  if (ups.length) {
    tl.fromTo(
      ups,
      { autoAlpha: 0, y: "3rem", filter: "blur(3px)" },
      { autoAlpha: 1, y: "0rem", filter: "blur(0px)", stagger: 0.1 },
      0.3 + offset
    );
  }

  if (lefts.length) {
    tl.fromTo(
      lefts,
      { autoAlpha: 0, x: "3rem", filter: "blur(3px)" },
      { autoAlpha: 1, x: "0rem", filter: "blur(0px)", stagger: 0.1 },
      0.3 + offset
    );
  }

  if (fades.length) {
    tl.fromTo(fades, { autoAlpha: 0, y: "3rem" }, { autoAlpha: 1, y: "0rem", duration: 3, stagger: 0.1 }, 0.6 + offset);
  }

  if (nav) {
    tl.to(nav, { y: "0%", autoAlpha: 1 }, 0.5);
  }
}

// ─────────────────────────────────────────────
// AI PROMPT BUTTONS
// ─────────────────────────────────────────────

function promptButtons() {
  const links = document.querySelectorAll(".footer_left_prompt_icon");
  if (!links.length) return;

  const PROMPT =
    "What can you tell me about Stealthmode Recruiting (stealthmode.co), the recruiting firm for venture-backed startups?";

  const PROVIDERS = {
    claude: (q) => `https://claude.ai/new?q=${q}`,
    chatgpt: (q) => `https://chatgpt.com/?hints=search&q=${q}`,
  };

  const fallbackOrder = ["claude", "chatgpt"];
  const q = encodeURIComponent(PROMPT);

  links.forEach((link, i) => {
    const key = link.dataset.aiPrompt || fallbackOrder[i];
    const buildUrl = PROVIDERS[key];
    if (!buildUrl) return;

    link.href = buildUrl(q);
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    link.addEventListener("click", () => {
      if (typeof window.gtag === "function") {
        window.gtag("event", "ask_ai_click", {
          ai_provider: key,
          link_location: "footer",
        });
      }
    });
  });
}

// ─────────────────────────────────────────────
// NAV HIDE / SHOW ON SCROLL
// ─────────────────────────────────────────────

function navScroll(menuController) {
  const navComponent = document.querySelector('[data-menu="wrap"]');
  if (!navComponent) return;

  const root = document.documentElement;
  root.classList.add("nav-shown");

  let navHidden = false;
  let activeTween = null;

  ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      // Hold the nav in place while the menu is open or still closing
      if (menuController?.isOpen()) {
        if (activeTween) activeTween.kill();
        gsap.set(navComponent, { y: "0%" });
        root.classList.add("nav-shown");
        navHidden = false;
        return;
      }

      const scrollDistance = self.scroll();
      const threshold = navComponent.offsetHeight;
      const scrollingUp = self.direction === -1;

      if (scrollDistance === 0) navComponent.classList.remove("is-scrolled");

      if (!scrollingUp && !navHidden && scrollDistance > threshold) {
        if (activeTween) activeTween.kill();
        navHidden = true;
        root.classList.remove("nav-shown");
        navComponent.classList.add("is-scrolled");

        activeTween = gsap.to(navComponent, {
          y: "-100%",
          duration: durationSlow,
          ease: easeBase,
          onComplete: () => (activeTween = null),
        });
      } else if (scrollingUp && navHidden) {
        if (activeTween) activeTween.kill();
        navHidden = false;
        root.classList.add("nav-shown");
        navComponent.classList.remove("is-scrolled");

        activeTween = gsap.to(navComponent, {
          y: "0%",
          duration: 2,
          ease: easeBase,
          onComplete: () => (activeTween = null),
        });
      }
    },
  });
}

// ─────────────────────────────────────────────
// SCROLL ANIMATIONS
// ─────────────────────────────────────────────

function eyebrowScramble() {
  const items = gsap.utils
    .toArray('[data-scroll="eyebrow"]')
    .filter((el) => !el.closest('[data-load="wrap"]'));
  if (!items.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  items.forEach((item) => {
    const text = item.querySelector(".eyebrow_text");
    const marker = item.querySelector(".eyebrow_marker");
    if (!text) return;

    if (reduceMotion) {
      gsap.set(item, { autoAlpha: 1 });
      return;
    }

    gsap.set(item, { autoAlpha: 0 });
    if (marker) gsap.set(marker, { scale: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: item,
        start: "top 80%",
        toggleActions: "play none none none",
      },
      defaults: { ease: "power4.out" },
      onComplete: () => {
        if (marker) gsap.set(marker, { clearProps: "transform" });
      },
    });

    tl.to(item, { autoAlpha: 1, duration: 0.6 }, 0);
    if (marker) tl.to(marker, { scale: 1, duration: 0.8 }, 0);
    tl.add(scrambleTween(text, { duration: 1, reveal: item.dataset.scramble || "random" }), 0);
  });
}

function scrambleText() {
  const items = gsap.utils
    .toArray('[data-scroll="scramble"]')
    .filter((el) => !el.closest('[data-load="wrap"]'));
  if (!items.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  items.forEach((item) => {
    if (reduceMotion) {
      gsap.set(item, { autoAlpha: 1 });
      return;
    }

    gsap.set(item, { autoAlpha: 0 });

    gsap.timeline({
      scrollTrigger: {
        trigger: item,
        start: "top 80%",
        toggleActions: "play none none none",
      },
    })
      .set(item, { autoAlpha: 1 }, 0)
      .add(scrambleTween(item, { duration: 1, reveal: item.dataset.scramble || "random" }), 0);
  });
}

function headingSplit() {
  const wraps = gsap.utils.toArray('[data-scroll="heading"]');
  if (!wraps.length) return;

  wraps.forEach((wrap) => {
    const heading = wrap.querySelector("h1, h2, h3") || wrap;

    gsap.set(wrap, { autoAlpha: 1 });

    if (typeof SplitText === "undefined") return;

    const split = new SplitText(heading, { type: "words", mask: "words", wordsClass: "word" });

    gsap.set(split.words, {
      autoAlpha: 0,
      y: "1em",
      filter: "blur(3px)",
    });

    gsap.timeline({
      scrollTrigger: {
        trigger: wrap,
        start: "top 85%",
        toggleActions: "play none none none",
      },
      defaults: { ease: easeBase, duration: 1.4 },
    }).to(split.words, {
      autoAlpha: 1,
      y: "0em",
      filter: "blur(0px)",
      stagger: 0.04,
    });
  });
}

function fadeUp() {
  const items = gsap.utils.toArray('[data-scroll="fade-up"]');
  if (!items.length) return;

  gsap.set(items, { y: "3rem" });

  items.forEach((item) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: item,
        start: "top 80%",
        toggleActions: "play none none none",
      },
      defaults: { ease: easeBase, duration: 1.4 },
      onComplete: () =>
        gsap.set(item, { clearProps: "filter,transform,willChange" }),
    });

    tl.to(item, { autoAlpha: 1, y: "0rem", filter: "blur(0px)" });
  });
}

function fadeLeft() {
  const items = gsap.utils.toArray('[data-scroll="fade-left"]');
  if (!items.length) return;

  gsap.set(items, { x: "3rem" });

  items.forEach((item) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: item,
        start: "top 80%",
        toggleActions: "play none none none",
      },
      defaults: { ease: easeBase, duration: 1.4 },
      onComplete: () =>
        gsap.set(item, { clearProps: "filter,transform,willChange" }),
    });

    tl.to(item, { autoAlpha: 1, x: "0rem", filter: "blur(0px)" });
  });
}

function fadeIn() {
  const items = gsap.utils.toArray('[data-scroll="fade"]');
  if (!items.length) return;

  gsap.set(items, { opacity: 0, filter: "blur(3px)" });

  items.forEach((item) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: item,
        start: "top 80%",
        toggleActions: "play none none none",
      },
      defaults: { ease: easeBase, duration: 1.4 },
      onComplete: () =>
        gsap.set(item, { clearProps: "filter,transform,willChange" }),
    });

    tl.to(item, { autoAlpha: 1, filter: "blur(0px)" });
  });
}

function lineDraw() {
  const items = gsap.utils.toArray('[data-scroll="line-draw"]');
  if (!items.length) return;

  gsap.set(items, { scaleX: 0 });

  items.forEach((item) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: item,
        start: "top 80%",
        toggleActions: "play none none none",
      },
      defaults: { ease: easeBase, duration: 1.2 },
    });

    tl.to(item, { scaleX: 1 });
  });
}

function shrinkScroll() {
  const items = document.querySelectorAll('[data-scroll="shrink"]');
  if (!items.length) return;

  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    items.forEach((el) => {
      const trigger = el.closest('[data-load="wrap"]') || el.closest("section");

      gsap.set(el, { transformOrigin: "50% 100%", willChange: "transform, opacity" });

      gsap.to(el, {
        scale: 0.9,
        yPercent: 15,
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: {
          trigger,
          start: "top top",
          endTrigger: el,
          end: "bottom top",
          scrub: true,
        },
      });
    });
  });
}

function parallaxFade() {
  document.querySelectorAll('[data-parallax-fade="wrap"]').forEach((wrap) => {
    const items = wrap.querySelectorAll('[data-parallax-fade="item"]');
    if (!items.length) return;

    gsap.fromTo(
      items,
      { opacity: 0, y: "3rem" },
      {
        opacity: 1,
        y: "0rem",
        ease: "power1.out",
        stagger: { amount: 0.2, from: "start", ease: "none" },
        scrollTrigger: {
          trigger: wrap,
          start: "top 90%",
          end: "top 50%",
          scrub: 1,
          invalidateOnRefresh: true,
        },
      }
    );
  });
}

function parallaxMove() {
  const items = document.querySelectorAll('[data-parallax="move"]');
  if (!items.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const amount = window.innerWidth < 768 ? 5 : 10;

  items.forEach((item) => {
    gsap.fromTo(item, { yPercent: amount }, {
      yPercent: -amount,
      ease: "none",
      scrollTrigger: {
        trigger: item.parentElement,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });
  });
}

// ─────────────────────────────────────────────
// HOVERS
// ─────────────────────────────────────────────

function textSwapHover(wraps, clipSelector, { type = "words", stagger = 0.05 } = {}) {
  if (!wraps.length || typeof SplitText === "undefined") return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  wraps.forEach((wrap) => {
    const clip = wrap.querySelector(clipSelector);
    if (!clip || clip.children.length < 2) return;

    const [main, hover] = [...clip.children].map(
      (el) => new SplitText(el, { type, aria: "none" })[type]
    );

    const move = (yPercent) => {
      const vars = { yPercent, stagger, duration: 0.6, ease: easeBase, overwrite: true };
      gsap.to(main, vars);
      gsap.to(hover, vars);
    };

    wrap.addEventListener("mouseenter", () => move(-100));
    wrap.addEventListener("mouseleave", () => move(0));

    wrap.addEventListener("focusin", (e) => {
      if (e.target.matches(":focus-visible")) move(-100);
    });
    wrap.addEventListener("focusout", () => move(0));
  });
}

function buttonHover() {
  textSwapHover(gsap.utils.toArray(".btn_main_wrap"), ".btn_main_clip");
}

function navLinkHover() {
  textSwapHover(gsap.utils.toArray(".nav_link_wrap"), ".nav_link_clip");
}

// ─────────────────────────────────────────────
// MOBILE MENU
// ─────────────────────────────────────────────

function mobileMenu() {
  const controller = { isOpen: () => false, close: () => {}, closeAndScrollTo: () => {} };

  const nav = document.querySelector('[data-menu="wrap"]');
  if (!nav) return controller;

  const menu = nav.querySelector(".nav_content");
  const button = nav.querySelector(".nav_button");
  const blur = nav.querySelector(".nav_blur");
  const links = menu.querySelectorAll('[data-menu="item"]');
  const [lineTop, lineBottom] = button.children;

  let dropdownsInitialized = false;
  const mm = gsap.matchMedia();

  mm.add("(max-width: 991px)", () => {
    let isMenuOpen = false;

    // ── Read designed end states from Webflow CSS ──
    const cs = getComputedStyle(blur);
    const filterVal =
      (cs.backdropFilter && cs.backdropFilter !== "none" && cs.backdropFilter) ||
      (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== "none" && cs.webkitBackdropFilter) ||
      "blur(2px)";
    const blurTo = filterVal;
    const blurFrom = filterVal.replace(/blur\([^)]*\)/, "blur(0px)");

    const [r, g, b, a = 1] = gsap.utils.splitColor(cs.backgroundColor);
    const bgTo = `rgba(${r}, ${g}, ${b}, ${a})`;
    const bgFrom = `rgba(${r}, ${g}, ${b}, 0)`;

    // ── Initial state ──
    gsap.set(menu, { display: "none", clipPath: "inset(0% 0% 0% 100%)" });
    gsap.set(links, { opacity: 0 });
    gsap.set(blur, {
      display: "block",
      opacity: 1,
      visibility: "hidden",
      backdropFilter: blurFrom,
      backgroundColor: bgFrom,
    });
    button.setAttribute("aria-expanded", "false");

    // ── Open ──
    const menuOpen = gsap.timeline({
      paused: true,
      onStart: () => {
        gsap.set(menu, { display: "flex" });
        gsap.set(blur, { visibility: "visible" });
        nav.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
        button.setAttribute("aria-label", "Close menu");
        disableScroll();
        if (!dropdownsInitialized && typeof navDropdown === "function") {
          navDropdown();
          dropdownsInitialized = true;
        }
      },
    });

    menuOpen
      .to(blur, { backdropFilter: blurTo, backgroundColor: bgTo, duration: 0.6, ease: easeBase }, 0)
      .to(menu, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: easeBase }, 0)
      .to(lineTop, { y: 5.5, rotate: -45, duration: 0.7, ease: easeBase }, 0)
      .to(lineBottom, { y: -5.5, rotate: 45, duration: 0.7, ease: easeBase }, 0)
      .to(links, { opacity: 1, duration: 2, ease: easeBase, stagger: 0.1 }, 0.15);

    // ── Close ──
    const menuClose = gsap.timeline({
      paused: true,
      onStart: () => {
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Open menu");
      },
      onComplete: () => {
        gsap.set(menu, { display: "none" });
        gsap.set(blur, { visibility: "hidden" });
        nav.classList.remove("is-open");
      },
    });

    menuClose
      .to(links, { opacity: 0, duration: 0.2, ease: "power2.in" }, 0)
      .to(menu, { clipPath: "inset(0% 0% 0% 100%)", duration: 0.5, ease: "power3.in" }, 0.05)
      .to(blur, { backdropFilter: blurFrom, backgroundColor: bgFrom, duration: 0.5, ease: "power1.in" }, 0.05)
      .to(lineTop, { y: 0, rotate: 0, duration: 0.4, ease: "power4.out" }, 0)
      .to(lineBottom, { y: 0, rotate: 0, duration: 0.4, ease: "power4.out" }, 0);

    // ── Controls (either direction can interrupt the other) ──
    const open = () => {
      if (isMenuOpen) return;
      isMenuOpen = true;
      menuClose.pause();
      menuOpen.invalidate().restart();
    };

    const close = () => {
      if (!isMenuOpen) return;
      isMenuOpen = false;
      enableScroll(); // unlock immediately so a link scroll can start right away
      menuOpen.pause();
      menuClose.invalidate().restart();
    };

    const toggle = () => (isMenuOpen ? close() : open());
    const onKey = (e) => e.key === "Escape" && close();

    button.addEventListener("click", toggle);
    blur.addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    // ── Expose to anchorScroll / navScroll ──
    // "Open" includes the closing animation so navScroll holds the nav until the drawer is gone
    controller.isOpen = () => isMenuOpen || menuClose.isActive();
    controller.close = close;
    controller.closeAndScrollTo = (target) => {
      close();
      scrollToTarget(target);
    };

    // ── Cleanup when crossing to desktop ──
    return () => {
      button.removeEventListener("click", toggle);
      blur.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
      if (isMenuOpen) {
        enableScroll();
        nav.classList.remove("is-open");
      }
      controller.isOpen = () => false;
      controller.close = () => {};
      controller.closeAndScrollTo = () => {};
    };
  });

  return controller;
}

// ─────────────────────────────────────────────
// CONTACT DRAWER
// ─────────────────────────────────────────────

function trapFocus(container, e) {
  if (e.key !== "Tab") return;

  const focusable = [
    ...container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]'
    ),
  ].filter((el) => el.tabIndex >= 0 && el.getClientRects().length);

  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function inlineFormSuccess(root) {
  const blocks = [...root.querySelectorAll(".w-form")];

  blocks.forEach((block) => {
    const form = block.querySelector("form");
    const done = block.querySelector(".w-form-done");
    if (!form || !done) return;

    let handled = false;

    new MutationObserver(() => {
      const shown = done.style.display && done.style.display !== "none";

      if (!shown) {
        handled = false; // re-arm for the next submission
        return;
      }
      if (handled) return;
      handled = true;

      form.style.display = "";
      form.reset();

      if (window.turnstile) {
        try { window.turnstile.reset(); } catch (e) {}
      }

      done.focus({ preventScroll: true });
      done.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }).observe(done, { attributes: true, attributeFilter: ["style"] });

    form.addEventListener("input", () => {
      if (done.style.display && done.style.display !== "none") done.style.display = "none";
    });
  });

  return () => blocks.forEach((block) => {
    const done = block.querySelector(".w-form-done");
    if (done) done.style.display = "none";
  });
}

function contactTabs(root) {
  const wrap = root.querySelector('[data-contact-tabs="wrap"]');
  if (!wrap) return;

  const tabs = [...wrap.querySelectorAll('[data-contact-tabs="tab"]')];
  const panels = [...wrap.querySelectorAll('[data-contact-tabs="panel"]')];
  if (!tabs.length || tabs.length !== panels.length) return;

  tabs[0].parentElement.setAttribute("role", "tablist");

  tabs.forEach((tab, i) => {
    const panel = panels[i];
    tab.id ||= `contact-tab-${i}`;
    panel.id ||= `contact-panel-${i}`;

    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);

    tab.addEventListener("click", () => select(i));

    tab.addEventListener("keydown", (e) => {
      const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      select((keys[e.key] + tabs.length) % tabs.length, { focus: true });
    });
  });

  let active = -1;

  function select(i, { animate = true, focus = false } = {}) {
    if (i === active) return;

    tabs.forEach((tab, j) => {
      const on = j === i;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.classList.toggle("is-active", on);
    });

    panels.forEach((panel, j) => {
      if (j !== i) gsap.set(panel, { display: "none" });
    });

    const panel = panels[i];
    gsap.set(panel, { clearProps: "display" }); // falls back to the Webflow display value

    if (animate) {
      gsap.fromTo(
        panel,
        { autoAlpha: 0, y: "1rem" },
        { autoAlpha: 1, y: "0rem", duration: 0.8, ease: easeBase, clearProps: "transform" }
      );
    }

    if (focus) tabs[i].focus();
    active = i;
  }

  select(0, { animate: false });
}

function contactDrawer() {
  const controller = { isOpen: () => false, open: () => {}, close: () => {} };

  const wrap = document.querySelector(".contact_drawer_wrap");
  if (!wrap) return controller;

  const scrim = wrap.querySelector(".contact_drawer_scrim");
  const card = wrap.querySelector(".contact_drawer_card");
  const closeBtn = wrap.querySelector(".contact_drawer_close");
  const heading = wrap.querySelector("h2");
  const items = [...card.querySelectorAll(".contact_drawer_layout > *"), closeBtn].filter(Boolean);

  // ── Accessibility + scroll setup ──
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  if (heading) {
    heading.id ||= "contact-drawer-title";
    wrap.setAttribute("aria-labelledby", heading.id);
  }
  card.setAttribute("data-lenis-prevent", ""); // lets the card scroll while Lenis is stopped

  contactTabs(wrap);
  const clearFormMessages = inlineFormSuccess(wrap);

  // ── Read designed blur + tint from Webflow CSS ──
  const cs = getComputedStyle(scrim);
  const filterVal =
    (cs.backdropFilter && cs.backdropFilter !== "none" && cs.backdropFilter) ||
    (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== "none" && cs.webkitBackdropFilter) ||
    "blur(2px)";
  const [r, g, b, a = 1] = gsap.utils.splitColor(cs.backgroundColor);
  const scrimFrom = {
    backdropFilter: filterVal.replace(/blur\([^)]*\)/, "blur(0px)"),
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0)`,
  };
  const scrimTo = {
    backdropFilter: filterVal,
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${a})`,
  };

  // ── Initial state ──
  gsap.set(wrap, { display: "none" });
  gsap.set(scrim, { display: "block", opacity: 1, ...scrimFrom });
  gsap.set(card, { clipPath: "inset(0% 0% 0% 100%)" });
  gsap.set(items, { opacity: 0 });

  // ── Timelines (match the mobile menu) ──
  const tlOpen = gsap.timeline({ paused: true })
    .to(scrim, { ...scrimTo, duration: 0.6, ease: easeBase }, 0)
    .to(card, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: easeBase }, 0)
    .to(items, { opacity: 1, duration: 2, ease: easeBase, stagger: 0.1 }, 0.15);

    const tlClose = gsap.timeline({
      paused: true,
      onComplete: () => {
        gsap.set(wrap, { display: "none" });
        clearFormMessages();
      },
    })
    .to(items, { opacity: 0, duration: 0.2, ease: "power2.in" }, 0)
    .to(card, { clipPath: "inset(0% 0% 0% 100%)", duration: 0.5, ease: "power3.in" }, 0.05)
    .to(scrim, { ...scrimFrom, duration: 0.5, ease: "power1.in" }, 0.05);

  // ── Controls ──
  let isOpen = false;
  let lastFocus = null;

  function open(source = "unknown") {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;

    disableScroll();
    tlClose.pause();
    gsap.set(wrap, { display: "block" }); // change to "flex" if the wrap's layout depends on it
    card.scrollTop = 0;
    tlOpen.invalidate().restart();

    history.replaceState(null, "", "#contact");

    const activeTab = wrap.querySelector('[role="tab"][aria-selected="true"]');
    (activeTab || closeBtn)?.focus({ preventScroll: true });

    if (typeof window.gtag === "function") {
      window.gtag("event", "contact_drawer_open", { link_location: source });
    }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    enableScroll();
    tlOpen.pause();
    tlClose.invalidate().restart();

    if (location.hash === "#contact") {
      history.replaceState(null, "", location.pathname + location.search);
    }

    lastFocus?.focus?.({ preventScroll: true });
  }

  closeBtn?.addEventListener("click", close);
  scrim?.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") close();
    else trapFocus(wrap, e);
  });

  // Deep link: stealthmode.co/#contact opens the drawer
  if (location.hash === "#contact") open("url");

  controller.isOpen = () => isOpen;
  controller.open = open;
  controller.close = close;
  return controller;
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  lenisScroll();

  const menuController = mobileMenu();
  const drawerController = contactDrawer();
  anchorScroll(menuController, drawerController);
  navScroll(menuController);

  loader();
  promptButtons();
  eyebrowScramble();
  scrambleText();
  headingSplit();
  fadeUp();
  fadeLeft();
  fadeIn();
  lineDraw();
  shrinkScroll();
  parallaxFade();
  parallaxMove();
  buttonHover();
  navLinkHover();
});