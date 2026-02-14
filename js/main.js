// MEDeLIFE Main Logic

// Function to handle Login Modal opening
function openLoginModal() {
    // Later we will make this pop up a real modal
    // For now, let's redirect to a login placeholder or alert
    const confirmLogin = confirm("You need to log in to access this feature. Proceed to Login?");
    if (confirmLogin) {
        window.location.href = "login.html";
    }
}

console.log("MEDeLIFE System Loaded");



//--------------------------------------------

// --- LOGIN PAGE LOGIC ---

function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    
    document.getElementById('loginBtn').classList.add('active');
    document.getElementById('registerBtn').classList.remove('active');
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    
    document.getElementById('registerBtn').classList.add('active');
    document.getElementById('loginBtn').classList.remove('active');
}
