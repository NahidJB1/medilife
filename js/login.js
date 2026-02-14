// --- 1. UI SWITCHING ---
function switchMode(mode) {
    const container = document.getElementById('toggleContainer');
    const loginBtn = document.getElementById('loginBtn');
    const regBtn = document.getElementById('registerBtn');
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('registerForm');
    const title = document.getElementById('headerTitle');
    const sub = document.getElementById('headerSubtitle');

    if (mode === 'register') {
        container.classList.add('register-mode');
        loginBtn.classList.remove('active');
        regBtn.classList.add('active');
        loginForm.classList.add('hidden');
        regForm.classList.remove('hidden');
        title.innerText = "Join MEDeLIFE";
        sub.innerText = "Create a new account.";
    } else {
        container.classList.remove('register-mode');
        regBtn.classList.remove('active');
        loginBtn.classList.add('active');
        regForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        title.innerText = "Welcome Back";
        sub.innerText = "Enter your details to access your records.";
    }
}

function toggleRoleFields() {
    const role = document.getElementById('regRole').value;
    const docField = document.getElementById('doctorField');
    const pharmField = document.getElementById('pharmacyField');

    // Hide both initially
    docField.classList.add('hidden');
    pharmField.classList.add('hidden');

    if (role === 'doctor') {
        docField.classList.remove('hidden');
        docField.style.animation = "fadeIn 0.5s";
    } else if (role === 'pharmacy') {
        pharmField.classList.remove('hidden');
        pharmField.style.animation = "fadeIn 0.5s";
    }
}

// --- 2. AUTHENTICATION (PHP) ---

async function handleRegister(event) {
    event.preventDefault();
    const btn = document.getElementById('btnRegister');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    const formData = new FormData();
    formData.append('action', 'register');
    formData.append('name', document.getElementById('regName').value);
    formData.append('email', document.getElementById('regEmail').value);
    formData.append('password', document.getElementById('regPassword').value);
    formData.append('role', document.getElementById('regRole').value);
    
    // Optional fields
    formData.append('phone', document.getElementById('regPhone').value);

    try {
        const response = await fetch('api/auth.php', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.status === 'success') {
            showSuccessAnimation();
        } else {
            alert(result.message || "Registration failed");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } catch (error) {
        console.error('Error:', error);
        alert("Server error. Check console.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSignIn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';

    const formData = new FormData();
    formData.append('action', 'login');
    formData.append('email', document.getElementById('loginEmail').value);
    formData.append('password', document.getElementById('loginPassword').value);

    try {
        const response = await fetch('api/auth.php', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.status === 'success') {
            const u = result.user;
            
            // Save Session Data
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userUid', u.email); // Use Email as UID for consistency
            localStorage.setItem('userName', u.name);
            localStorage.setItem('userRole', u.role);
            localStorage.setItem('userEmail', u.email);

            redirectToDashboard(u.role);
        } else {
            alert(result.message || "Invalid credentials");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } catch (error) {
        console.error(error);
        alert("Login error. Check console.");
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

function showSuccessAnimation() {
    document.getElementById('registerForm').classList.add('hidden');
    const overlay = document.getElementById('successOverlay');
    overlay.classList.add('active');

    setTimeout(() => {
        overlay.classList.remove('active');
        document.getElementById('registerForm').reset();
        document.getElementById('btnRegister').disabled = false;
        document.getElementById('btnRegister').innerText = "Create Account";
        switchMode('login');
    }, 2000);
}

function redirectToDashboard(role) {
    if (role === 'doctor') window.location.href = "doctor-dashboard.html";
    else if (role === 'pharmacy') window.location.href = "pharmacy-dashboard.html";
    else window.location.href = "patient-dashboard.html";
}
