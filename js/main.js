// ========================================
// MathLoo : script commun à toutes les pages
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Thème clair / sombre
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;

    // Thème enregistré, clair par défaut. Un thème imposé par la page
    // (data-theme-forced, le sombre des pages livrées) l'emporte.
    const forcedTheme = html.getAttribute('data-theme-forced');
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (forcedTheme) {
        html.setAttribute('data-theme', forcedTheme);
    } else {
        html.setAttribute('data-theme', savedTheme);
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Menu mobile
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Refermer le menu au clic sur un lien
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    // Ombre de la barre de navigation au défilement
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
        } else {
            navbar.style.boxShadow = 'none';
        }
    });

    // Apparition des blocs au défilement
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.about-content, .project-card, .explore-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    const style = document.createElement('style');
    style.textContent = `
        .revealed {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    // Avertissement affiché une fois par session
    const disclaimerOverlay = document.getElementById('disclaimer-overlay');
    const disclaimerClose = document.getElementById('disclaimer-close');

    if (disclaimerOverlay) {
        if (sessionStorage.getItem('disclaimerSeen')) {
            disclaimerOverlay.remove();
        } else {
            disclaimerClose.addEventListener('click', () => {
                disclaimerOverlay.classList.add('hidden');
                sessionStorage.setItem('disclaimerSeen', '1');
                setTimeout(() => disclaimerOverlay.remove(), 300);
            });
        }
    }

    // Sous-menu MLTC. Sur mobile, un bouton « Menu MLTC » (injecté ici,
    // affiché par le CSS) replie la liste.
    const mltcSubnav = document.querySelector('.mltc-subnav');
    if (mltcSubnav) {
        let mobileBtn = mltcSubnav.querySelector('.subnav-mobile-toggle');
        if (!mobileBtn) {
            mobileBtn = document.createElement('button');
            mobileBtn.type = 'button';
            mobileBtn.className = 'subnav-mobile-toggle';
            mobileBtn.setAttribute('aria-expanded', 'false');
            mobileBtn.setAttribute('aria-label', 'Ouvrir le menu MLTC');
            mobileBtn.innerHTML = '<span class="subnav-mobile-label">Menu MLTC</span><span class="subnav-mobile-caret" aria-hidden="true"></span>';
            const container = mltcSubnav.querySelector('.container') || mltcSubnav;
            container.insertBefore(mobileBtn, container.firstChild);
        }

        const closeMobile = () => {
            mltcSubnav.classList.remove('mobile-open');
            mobileBtn.setAttribute('aria-expanded', 'false');
        };

        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = mltcSubnav.classList.toggle('mobile-open');
            mobileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Refermer le panneau au clic en dehors ou sur un lien
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mltc-subnav')) closeMobile();
        });
        mltcSubnav.querySelectorAll('.subnav-link').forEach(link => {
            link.addEventListener('click', closeMobile);
        });
    }
});
