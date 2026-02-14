 // --- 1. INITIALIZATION ON LOAD ---
    document.addEventListener("DOMContentLoaded", () => {
        checkAuth();
    });

    function checkAuth() {
        // Retrieve the login state and name we saved in login.html
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const userName = localStorage.getItem('userName') || "My Profile"; 
        
        updateUI(isLoggedIn, userName);

        // If logged in, immediately load the saved profile photo for the navbar
        if (isLoggedIn) {
            const savedJSON = localStorage.getItem('userProfileData');
            if (savedJSON) {
                const savedData = JSON.parse(savedJSON);
                if (savedData.photo) {
                    document.getElementById('navAvatar').src = savedData.photo;
                }
            }
        }
    }

    // --- 2. UI UPDATER (Fixes the Name Issue) ---
    function updateUI(isLoggedIn, userName) {
        const loginBtn = document.getElementById('navLoginBtn');
        const profileBtn = document.getElementById('navProfileBtn');
        const mobileLogin = document.querySelector('.login-nav-item');
        const profileNameHeader = document.getElementById('profileName');
        
        // This targets the <span> inside the profile button to change the text
        const profileBtnText = profileBtn ? profileBtn.querySelector('span') : null; 

        if (isLoggedIn) {
            // HIDE LOGIN, SHOW PROFILE
            if(loginBtn) loginBtn.style.display = 'none';
            if(mobileLogin) mobileLogin.style.display = 'none';
            
            if(profileBtn) {
                profileBtn.style.display = 'flex';
                // UPDATE NAME HERE
                if(profileBtnText) profileBtnText.innerText = userName; 
            }
            
            // Set the name inside the modal header too
            if(profileNameHeader) profileNameHeader.innerText = userName;

        } else {
            // SHOW LOGIN, HIDE PROFILE
            if(loginBtn) loginBtn.style.display = 'block';
            if(mobileLogin) mobileLogin.style.display = 'block';
            if(profileBtn) profileBtn.style.display = 'none';
        }
    }

    // --- 3. MODAL LOGIC (OPEN & LOAD DATA) ---
    const modal = document.getElementById('profileModal');
    
    function openProfile() {
        modal.classList.add('active');
        loadProfileData(); // <--- Load data every time we open the modal
    }

    // Close modal if clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // --- 4. DATA SAVING & LOADING (The Database Fix) ---
    
    // Load data from LocalStorage into inputs
    function loadProfileData() {
        const savedJSON = localStorage.getItem('userProfileData');
        
        // Load Role if we have it (from login)
        const role = localStorage.getItem('userRole');
        if(role) {
            document.getElementById('profileRole').innerText = role.charAt(0).toUpperCase() + role.slice(1) + " Account";
        }

        if (!savedJSON) return; // No custom profile data saved yet

        const data = JSON.parse(savedJSON);

        // Fill inputs if data exists
        if(data.phone) document.getElementById('profilePhone').value = data.phone;
        if(data.blood) document.getElementById('profileBlood').value = data.blood;
        if(data.address) document.getElementById('profileAddress').value = data.address;
        if(data.emergency) document.getElementById('profileEmergency').value = data.emergency;
        
        // Fill Images
        if(data.photo) {
            document.getElementById('modalAvatar').src = data.photo;
            document.getElementById('navAvatar').src = data.photo;
        }
    }

    // Save data from inputs to LocalStorage
    function saveProfile(e) {
        e.preventDefault();
        const btn = e.target.querySelector('.btn-save');
        const originalText = btn.innerText;
        btn.innerText = "Saving...";

        // 1. Gather all data
        const profileData = {
            phone: document.getElementById('profilePhone').value,
            blood: document.getElementById('profileBlood').value,
            address: document.getElementById('profileAddress').value,
            emergency: document.getElementById('profileEmergency').value,
            // Get the current source of the image (base64 data)
            photo: document.getElementById('modalAvatar').src 
        };

        // 2. Save to Browser Memory
        localStorage.setItem('userProfileData', JSON.stringify(profileData));

        // 3. Visual Success Feedback
        setTimeout(() => {
            btn.innerText = "Saved!";
            btn.style.background = "#22C55E";
            setTimeout(() => {
                modal.classList.remove('active');
                btn.innerText = originalText;
                btn.style.background = "#22C55E"; 
            }, 1000);
        }, 500);
    }

    // --- 5. IMAGE PREVIEW ---
    function previewImage(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                // Instantly update the visual (Saving happens when they click "Save Changes")
                document.getElementById('modalAvatar').src = e.target.result;
            }
            reader.readAsDataURL(file);
        }
    }

    // --- 6. LOGOUT ---
    function handleLogout() {
        if(confirm("Are you sure you want to log out?")) {
            localStorage.removeItem('isLoggedIn');
            // Note: We keep 'userName' and 'userProfileData' so they are there when you log back in.
            // If you want to wipe everything, use: localStorage.clear();
            window.location.reload();
        }
    }

    // --- 7. MOBILE MENU & SCROLL ---
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelector('.nav-links');
    if(mobileMenu) {
        mobileMenu.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            const icon = mobileMenu.querySelector('i');
            if(navLinks.classList.contains('open')) {
                icon.classList.remove('fa-bars'); icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times'); icon.classList.add('fa-bars');
            }
        });
    }

    window.addEventListener('scroll', reveal);
    function reveal() {
        var reveals = document.querySelectorAll('.reveal');
        for (var i = 0; i < reveals.length; i++) {
            if (reveals[i].getBoundingClientRect().top < window.innerHeight - 150) {
                reveals[i].classList.add('active');
            }
        }
    }
    reveal(); 
