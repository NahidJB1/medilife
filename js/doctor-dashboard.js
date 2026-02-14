// --- 1. INIT DOCTOR DATA ---
const role = localStorage.getItem('userRole');
if (role !== 'doctor') { window.location.href = 'index.html'; }

const name = localStorage.getItem('userName') || 'Dr. User';
const storedEmail = localStorage.getItem('userEmail');
const storedUid = localStorage.getItem('userUid'); // Use the UID/Email saved during login

if (!storedEmail) {
    window.location.href = 'index.html';
}

const currentUserData = { name: name, role: 'doctor', uid: storedUid, email: storedEmail };

// UI Init
document.getElementById('sideName').innerText = name;
document.getElementById('welcomeTitle').innerText = "Hello, " + name;
document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// Load Avatar (Optional: You can fetch this from a PHP endpoint if needed)
const savedAvatar = localStorage.getItem('userAvatar');
if (savedAvatar) document.getElementById('sideAvatar').src = savedAvatar;


// --- 2. TAB SWITCHING ---
function switchMainTab(el, tabName) {
    document.querySelectorAll('.tab-item, .nav-item').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');

    const contentArea = document.getElementById('tabContentArea');

    if (tabName === 'home') {
        contentArea.innerHTML = `
        <div class="action-section">
            <div class="section-title">Quick Actions</div>
            <div class="quick-actions">
                <div class="action-card" onclick="openAppointmentList('pending')"><i class="fas fa-calendar-check" style="color:#F59E0B"></i><h4>Requests</h4><p>Pending Approvals</p></div>
                <div class="action-card" onclick="openAppointmentList('accepted')"><i class="fas fa-clipboard-list"></i><h4>View Bookings</h4><p>Confirmed Patients</p></div>
                <div class="action-card" onclick="openPatientSearch()"><i class="fas fa-user-injured"></i><h4>Find Patient</h4><p>View History & Prescribe</p></div>
            </div>
        </div>`;
    } else if (tabName === 'community') {
        // You would need a loadCommunityFeed() function calling a PHP endpoint here
        contentArea.innerHTML = '<p style="text-align:center; padding:20px;">Community feature coming soon to Hostinger version.</p>';
    }
}


// --- 3. APPOINTMENTS (Using PHP) ---
function openAppointmentList(filterType) {
    const modal = document.getElementById('dashboardModal');
    const modalContent = document.getElementById('modalContent');
    const title = filterType === 'pending' ? 'Appointment Requests' : 'Confirmed Bookings';

    let headerHtml = `<h2 style="margin:0;">${title}</h2>`;
    if (filterType === 'pending') {
        headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0;">${title}</h2>
            <span onclick="openAppointmentList('accepted')" style="cursor:pointer; color:var(--secondary); font-size:0.9rem; font-weight:600;">
                <i class="fas fa-arrow-right"></i> Go to Bookings
            </span>
        </div>`;
    }

    modalContent.innerHTML = `${headerHtml}<div id="aptList"><div class="ai-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>`;
    modal.classList.add('active');

    // FETCH FROM PHP API
    fetch(`api/get_appointments.php?doctor_id=${currentUserData.uid}&status=${filterType}`)
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('aptList');
            list.innerHTML = '';

            if (data.length === 0) {
                list.innerHTML = `<p>No ${filterType} appointments.</p>`;
                return;
            }

            data.forEach(apt => {
                let btns = '';
                let infoExtra = '';

                if (filterType === 'pending') {
                    const reqTime = apt.preferred_time ? `<br><small style="color:#F59E0B; font-weight:600;"><i class="far fa-clock"></i> Requested: ${apt.preferred_time}</small>` : '';
                    infoExtra = reqTime;
                    btns = `<button class="list-btn btn-accept" onclick="updateApt('${apt.id}','accepted')">Accept</button>
                            <button class="list-btn btn-decline" onclick="updateApt('${apt.id}','declined')">Decline</button>`;
                } else {
                    btns = `<button class="list-btn btn-time" title="Set Time" onclick="openTimePicker('${apt.id}', '${apt.scheduled_time || ''}', '${apt.preferred_time || ''}')"><i class="fas fa-clock"></i></button>
                            <button class="list-btn btn-book" onclick="goToPatientPage('${apt.patient_id}', '${apt.patient_name}')">Profile</button>
                            <button class="list-btn btn-cancel" onclick="cancelAppointment('${apt.id}')">Cancel</button>`;
                }

                list.innerHTML += `
                <div class="list-item">
                    <div>
                        <strong>${apt.patient_name}</strong>
                        <br><small>Date: ${new Date(apt.request_date).toLocaleDateString()}</small>
                        ${apt.scheduled_time ? `<br><small style="color:#2563EB; font-weight:600;">Scheduled: ${apt.scheduled_time}</small>` : ''}
                        ${infoExtra}
                    </div>
                    <div style="text-align:right; display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end;">${btns}</div>
                </div>`;
            });
        })
        .catch(err => {
            console.error(err);
            document.getElementById('aptList').innerHTML = '<p style="color:red">Error loading appointments.</p>';
        });
}

function updateApt(id, status) {
    const formData = new FormData();
    formData.append('id', id);
    formData.append('status', status);

    fetch('api/update_appointment.php', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                showToast("Updated!");
                openAppointmentList('pending');
            } else {
                showToast("Error updating.");
            }
        });
}

function cancelAppointment(id) {
    if(!confirm("Cancel this appointment?")) return;
    
    const formData = new FormData();
    formData.append('id', id);

    fetch('api/delete_appointment.php', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                showToast("Appointment Cancelled");
                openAppointmentList('accepted');
            }
        });
}


// --- 4. PATIENT SEARCH ---
function openPatientSearch() {
    const modal = document.getElementById('dashboardModal');
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <h2 style="text-align:center;">Patient Lookup</h2>
        <div class="modern-search-bar"><i class="fas fa-search search-icon"></i>
        <input type="text" id="sInput" class="search-input-field" placeholder="Enter Patient Email..."><button class="search-btn-modern" onclick="performSearch()">Search</button></div>
        <div id="searchResults" style="max-height:400px;overflow-y:auto"></div>`;
    modal.classList.add('active');
}

function performSearch() {
    const email = document.getElementById('sInput').value.trim();
    const resDiv = document.getElementById('searchResults');

    if (!email) return;

    resDiv.innerHTML = 'Loading...';

    // CALL PHP API
    fetch(`api/search_patient.php?email=${email}`)
        .then(res => res.json())
        .then(data => {
            resDiv.innerHTML = '';
            if (data.status === 'error' || data.length === 0) {
                resDiv.innerHTML = 'No patient found.';
                return;
            }

            // Data usually comes as an array, even if one result
            const patients = Array.isArray(data) ? data : [data];

            patients.forEach(p => {
                resDiv.innerHTML += `
                <div class="list-item" onclick="goToPatientPage('${p.uid}', '${p.name}')">
                   <strong>${p.name}</strong> (${p.email})
                </div>`;
            });
        });
}

function goToPatientPage(pid, pname) {
    window.location.href = `doctor-patient-view.html?pid=${pid}&name=${encodeURIComponent(pname)}`;
}


// --- UTILITIES ---
function closeModal() { document.getElementById('dashboardModal').classList.remove('active'); }
function showToast(msg) {
    const b = document.getElementById('toast-box');
    if(b) {
        document.getElementById('toast-msg').innerText = msg;
        b.classList.add('show');
        setTimeout(() => b.classList.remove('show'), 3000);
    } else {
        alert(msg);
    }
}
function logout() { localStorage.clear(); window.location.href = 'index.html'; }
