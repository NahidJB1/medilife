// --- REGISTRATION LOGIC ---
const registerForm = document.getElementById('registerForm');

if(registerForm) {
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Stop page from reloading

        // 1. Get user info from HTML
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const fullName = document.getElementById('regName').value;
        const role = document.getElementById('regRole').value;
        const nationalID = document.getElementById('regNationalID').value;
        const phone = document.getElementById('regPhone').value;

        // 2. Create the Account in Firebase Auth
        auth.createUserWithEmailAndPassword(email, password)
            .then((cred) => {
                // 3. If successful, save extra details (Role, ID) to Firestore Database
                return db.collection('users').doc(cred.user.uid).set({
                    fullName: fullName,
                    role: role,
                    nationalID: nationalID,
                    phone: phone,
                    email: email,
                    createdAt: new Date()
                });
            })
            .then(() => {
                alert("Account Created! Logging you in...");
                window.location.href = "dashboard.html"; // Send them to the app
            })
            .catch((error) => {
                alert("Error: " + error.message);
            });
    });
}

// --- LOGIN LOGIC ---
const loginForm = document.getElementById('loginForm');

if(loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        auth.signInWithEmailAndPassword(email, password)
            .then((cred) => {
                // Login success
                alert("Welcome back!");
                window.location.href = "dashboard.html";
            })
            .catch((error) => {
                alert("Login Failed: " + error.message);
            });
    });
}
