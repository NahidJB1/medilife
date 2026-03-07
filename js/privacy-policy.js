// js/privacy-policy.js

document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('.policy-section');
    const navLinks = document.querySelectorAll('.policy-sidebar .nav-link');

    // 1. Mobile Accordion Logic
    sections.forEach(section => {
        const header = section.querySelector('h2');
        header.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                const isActive = section.classList.contains('active');
                
                // Close all other sections smoothly
                sections.forEach(s => s.classList.remove('active'));
                
                // Open the clicked section
                if (!isActive) {
                    section.classList.add('active');
                }
            }
        });
    });

    // 2. Desktop Scrollspy Logic
    window.addEventListener('scroll', () => {
        if (window.innerWidth > 768) {
            let currentId = '';
            
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                // Trigger when section is 150px from the top of the viewport
                if (pageYOffset >= (sectionTop - 150)) {
                    currentId = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href').includes(currentId)) {
                    link.classList.add('active');
                }
            });
        }
    });
});
