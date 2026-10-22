// Reveal sections as they scroll in; CSS handles reduced motion.
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) e.target.classList.add('in');
  },
  { threshold: 0.2 },
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
