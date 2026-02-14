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

        function handleRegister(event) {
            event.preventDefault(); 

            const btn = document.getElementById('btnRegister');
            const originalText = btn.innerText;
            const emailInput = document.getElementById('regEmail');
            const passwordInput = document.getElementById('regPassword');
            const emailErrorMsg = document.getElementById('emailErrorMsg');
            
            // Capture values
            const nameVal = document.getElementById('regName').value;
            const roleVal = document.getElementById('regRole').value;
            const emailVal = emailInput.value;

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

            if (!validateInputs()) {
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }

            if (typeof firebase !== 'undefined') {
                firebase.auth().createUserWithEmailAndPassword(emailVal, passwordInput.value)
                .then((userCredential) => {
                    // --- 1. SAVE TO DATABASE (FIRESTORE) ---
                    const db = firebase.firestore();
                    return db.collection("users").doc(userCredential.user.uid).set({
                        name: nameVal,
                        role: roleVal,
                        email: emailVal,
                        createdAt: new Date()
                    })
                    .then(() => {
                        // --- 2. UPDATE LOCAL STORAGE ---
                        // Only now do we set the local storage for the current session
                        localStorage.setItem('isLoggedIn', 'true');
                        localStorage.setItem('userName', nameVal);
                        localStorage.setItem('userRole', roleVal);

                        // --- 3. DEMO BACKUP (For local testing without Firebase) ---
                        // We save a "fake database" entry in localStorage just in case
                        localStorage.setItem('db_user_' + emailVal, JSON.stringify({ role: roleVal, name: nameVal }));

                        showSuccessAnimation();
                    });
                })
                .catch((error) => {
                    btn.disabled = false;
                    btn.innerText = originalText;
                    if (error.code === 'auth/email-already-in-use') {
                        emailInput.classList.add('error');
                        emailErrorMsg.innerText = "This email is already registered.";
                        emailErrorMsg.style.display = "block";
                    } else {
                        alert("Error: " + error.message);
                    }
                });
            } else {
                // FALLBACK IF FIREBASE NOT LOADED
                // We simulate saving to a DB by using a specific key for this email
                localStorage.setItem('db_user_' + emailVal, JSON.stringify({ role: roleVal, name: nameVal }));
                
                setTimeout(() => { showSuccessAnimation(); }, 1500);
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
        
        function handleLogin(event) {
            event.preventDefault();
            const btn = document.getElementById('btnSignIn');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            if (typeof firebase !== 'undefined') {
                firebase.auth().signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const uid = userCredential.user.uid;
                    const db = firebase.firestore();

                    // --- FETCH ROLE AND REDIRECT ---
                    db.collection("users").doc(uid).get().then((doc) => {
                        if (doc.exists) {
                            const userData = doc.data();
                            
                            // Save Session Data
                            localStorage.setItem('isLoggedIn', 'true');
                            localStorage.setItem('userName', userData.name);
                            localStorage.setItem('userRole', userData.role); 
                            localStorage.setItem('userEmail', userData.email || email); // Ensure email is saved
                            
                            // --- NEW: REDIRECT BASED ON ROLE ---
                            redirectToDashboard(userData.role);
                        } else {
                            checkLocalBackupAndRedirect(email);
                        }
                    }).catch((error) => {
                        console.error("Error getting document:", error);
                        checkLocalBackupAndRedirect(email);
                    });
                })
                .catch((error) => {
                    btn.disabled = false;
                    btn.innerText = originalText;
                    alert("Login Failed: " + error.message);
                });
            } else {
                // DEMO MODE
                setTimeout(() => { 
                    checkLocalBackupAndRedirect(email);
                }, 1500);
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
