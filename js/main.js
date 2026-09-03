// ========================================
// MathLoo Portfolio - Main JavaScript
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;
    
    // Check for saved theme preference or default to light.
    // If an inline pre-script has forced a theme (e.g. dark mode on livrée subpages),
    // respect it and do not override with the saved preference.
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

    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
        } else {
            navbar.style.boxShadow = 'none';
        }
    });

    // Smooth reveal animations
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

    document.querySelectorAll('.featured-card, .about-content, .project-card, .explore-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Add revealed styles
    const style = document.createElement('style');
    style.textContent = `
        .revealed {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    // Disclaimer popup
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

    // MLTC Sub-navigation Dropdowns
    const subnavToggles = document.querySelectorAll('.subnav-toggle');
    const subnavItems = document.querySelectorAll('.subnav-item');
    let hoverCloseTimer = null;

    // Inject mobile menu toggle button into the MLTC subnav (visible on mobile only via CSS).
    const mltcSubnav = document.querySelector('.mltc-subnav');
    if (mltcSubnav && !mltcSubnav.querySelector('.subnav-mobile-toggle')) {
        const mobileBtn = document.createElement('button');
        mobileBtn.type = 'button';
        mobileBtn.className = 'subnav-mobile-toggle';
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileBtn.setAttribute('aria-label', 'Ouvrir le menu MLTC');
        mobileBtn.innerHTML = '<span class="subnav-mobile-label">Menu MLTC</span><span class="subnav-mobile-caret" aria-hidden="true"></span>';
        const container = mltcSubnav.querySelector('.container') || mltcSubnav;
        container.insertBefore(mobileBtn, container.firstChild);

        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = mltcSubnav.classList.toggle('mobile-open');
            mobileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (!isOpen) {
                subnavItems.forEach(item => item.classList.remove('open'));
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.subnav-item')) {
            subnavItems.forEach(item => item.classList.remove('open'));
        }
        // Close mobile subnav panel when clicking outside the subnav entirely
        if (mltcSubnav && !e.target.closest('.mltc-subnav')) {
            mltcSubnav.classList.remove('mobile-open');
            const mobileBtn = mltcSubnav.querySelector('.subnav-mobile-toggle');
            if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
        }
    });

    // Handle toggle click and hover
    subnavToggles.forEach(toggle => {
        const item = toggle.closest('.subnav-item');

        // Click to toggle
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            subnavItems.forEach(i => {
                if (i !== item) i.classList.remove('open');
            });
            item.classList.toggle('open');
        });

        // Hover to open on desktop
        item.addEventListener('mouseenter', () => {
            if (window.innerWidth >= 768) {
                clearTimeout(hoverCloseTimer);
                subnavItems.forEach(i => {
                    if (i !== item) i.classList.remove('open');
                });
                item.classList.add('open');
            }
        });

        item.addEventListener('mouseleave', () => {
            if (window.innerWidth >= 768) {
                clearTimeout(hoverCloseTimer);
                hoverCloseTimer = setTimeout(() => {
                    item.classList.remove('open');
                }, 150);
            }
        });
    });

    // Handle link clicks in dropdown
    document.querySelectorAll('.subnav-dropdown .subnav-link').forEach(link => {
        link.addEventListener('click', () => {
            subnavItems.forEach(item => item.classList.remove('open'));
            if (mltcSubnav) {
                mltcSubnav.classList.remove('mobile-open');
                const mobileBtn = mltcSubnav.querySelector('.subnav-mobile-toggle');
                if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
            }
        });
    });

});
