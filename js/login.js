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
            const docInput = document.getElementById('regDocID');
            const pharmInput = document.getElementById('regLicense');

            docField.classList.add('hidden'); pharmField.classList.add('hidden');
            docInput.required = false; pharmInput.required = false;

            if (role === 'doctor') {
                docField.classList.remove('hidden'); docInput.required = true; docField.style.animation = "fadeIn 0.5s";
            } else if (role === 'pharmacy') {
                pharmField.classList.remove('hidden'); pharmInput.required = true; pharmField.style.animation = "fadeIn 0.5s";
            }
        }

        
        function showSuccessAnimation() {
            // Hide the form
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('headerTitle').style.opacity = '0';
            document.getElementById('headerSubtitle').style.opacity = '0';
            
            // Show the nice popup
            const overlay = document.getElementById('successOverlay');
            overlay.classList.add('active');

            // Wait 2.5 seconds, then switch to Login view
            setTimeout(() => {
                overlay.classList.remove('active');
                document.getElementById('headerTitle').style.opacity = '1';
                document.getElementById('headerSubtitle').style.opacity = '1';
                
                // Reset Form
                document.getElementById('registerForm').reset();
                document.getElementById('btnRegister').disabled = false;
                document.getElementById('btnRegister').innerText = "Create Account";
                
                // Switch View
                switchMode('login');
            }, 2500);
        }

        function validateInputs() {
            const nameRegex = /^[a-zA-Z\s]+$/;
            const idRegex = /^[a-zA-Z0-9]+$/;
            const phoneRegex = /^[0-9]+$/;

            const nameInput = document.getElementById('regName');
            const idInput = document.getElementById('regNationalID');
            const phoneInput = document.getElementById('regPhone');
            
            let isValid = true;

            if (!nameRegex.test(nameInput.value)) { setError(nameInput); isValid = false; } else { clearError(nameInput); }
            if (!idRegex.test(idInput.value)) { setError(idInput); isValid = false; } else { clearError(idInput); }
            if (!phoneRegex.test(phoneInput.value)) { setError(phoneInput); isValid = false; } else { clearError(phoneInput); }

            return isValid;
        }

        function setError(inputElement) {
            inputElement.classList.add('error');
            setTimeout(() => { inputElement.classList.remove('error'); inputElement.style.borderColor = "#EF4444"; }, 300);
        }
        function clearError(inputElement) { inputElement.style.borderColor = "transparent"; document.getElementById('emailErrorMsg').style.display = 'none'; }
        
        // --- REPLACE handleRegister function ---
async function handleRegister(event) {
    event.preventDefault();
    const btn = document.getElementById('btnRegister');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    const formData = new FormData();
    formData.append('action', 'register');
    formData.append('name', document.getElementById('regName').value);
    formData.append('email', document.getElementById('regEmail').value);
    formData.append('password', document.getElementById('regPassword').value);
    formData.append('role', document.getElementById('regRole').value);

    try {
        const response = await fetch('api/auth.php', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.status === 'success') {
            showSuccessAnimation();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        btn.innerHTML = 'Create Account';
    }
}

// --- REPLACE handleLogin function ---
async function handleLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSignIn');
    btn.innerHTML = 'Signing In...';

    const formData = new FormData();
    formData.append('action', 'login');
    formData.append('email', document.getElementById('loginEmail').value);
    formData.append('password', document.getElementById('loginPassword').value);

    try {
        const response = await fetch('api/auth.php', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.status === 'success') {
            const u = result.user;
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userUid', u.uid); // Storing Email as UID
            localStorage.setItem('userName', u.name);
            localStorage.setItem('userRole', u.role);
            localStorage.setItem('userEmail', u.uid);

            redirectToDashboard(u.role);
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error(error);
    } finally {
        btn.innerHTML = 'Sign In';
    }
}

        function checkLocalBackupAndRedirect(email) {
            const savedData = localStorage.getItem('db_user_' + email);
            let role = 'patient'; // Default

            if (savedData) {
                const data = JSON.parse(savedData);
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userName', data.name);
                localStorage.setItem('userRole', data.role);
                role = data.role;
            } else {
                localStorage.setItem('isLoggedIn', 'true');
                if(!localStorage.getItem('userRole')) localStorage.setItem('userRole', 'patient');
            }
            
            // --- NEW: REDIRECT BASED ON ROLE ---
            redirectToDashboard(role);
        }

        // --- NEW HELPER FUNCTION ---
        function redirectToDashboard(role) {
            if (role === 'doctor') {
                window.location.href = "doctor-dashboard.html";
            } else if (role === 'pharmacy') {
                window.location.href = "pharmacy-dashboard.html";
            } else {
                window.location.href = "patient-dashboard.html";
            }
        }
