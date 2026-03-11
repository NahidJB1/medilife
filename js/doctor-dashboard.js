// --- CONFIG ---
const API_BASE = 'api/'; // Path to your PHP folder

const role = localStorage.getItem('userRole');
if(role !== 'doctor') { window.location.href = 'index.html'; }

const name = localStorage.getItem('userName') || 'Dr. User';
const storedEmail = localStorage.getItem('userEmail');
const storedUid = localStorage.getItem('userUid'); 

if (!storedEmail) {
    console.error("Critical: User email missing.");
    window.location.href = 'index.html';
}

const currentUserData = { name: name, role: 'doctor', uid: storedUid, email: storedEmail };

document.getElementById('sideName').innerText = name;
document.getElementById('welcomeTitle').innerText = "Hello, " + name;
document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// Load Avatar
fetch(`${API_BASE}users.php?action=get&uid=${currentUserData.uid}`)
.then(res => res.json())
.then(data => {
    if(data.profile_pic) document.getElementById('sideAvatar').src = data.profile_pic;
});

// Sync User to DB (Ensure existence)
const formData = new FormData();
formData.append('action', 'sync');
formData.append('uid', currentUserData.uid);
formData.append('name', currentUserData.name);
formData.append('role', 'doctor');
formData.append('email', currentUserData.email);
fetch(`${API_BASE}users.php`, { method: 'POST', body: formData });


// --- TAB SWITCHING ---
// --- TAB SWITCHING ---
function switchMainTab(el, tabName) {
    // 1. Manage Main Tabs (Top Nav) active states
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    if (el && el.classList.contains('tab-item')) {
        el.classList.add('active');
    }

    // 2. Manage Sidebar active states independently
    const sideNavs = document.querySelectorAll('.nav-item');
    sideNavs.forEach(t => t.classList.remove('active'));
    
    if (tabName === 'home') {
        sideNavs[0].classList.add('active'); // Highlight Home on sidebar
        location.reload(); 
    } else if (tabName === 'notifications') {
        // Leave sidebar items un-highlighted since we are in Notifications
        const contentArea = document.getElementById('tabContentArea');
        loadNotifications(contentArea, role);
    }
}

// --- APPOINTMENTS ---
function openAppointmentList(filterType) {
    const modal = document.getElementById('dashboardModal');
    const modalContent = document.getElementById('modalContent');
    const title = filterType === 'pending' ? 'Appointment Requests' : 'Confirmed Bookings';
    
    let headerHtml = `<h2 style="margin:0;">${title}</h2>`;
    
    if(filterType === 'pending') {
        headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0;">${title}</h2>
            <span onclick="openAppointmentList('accepted')" style="cursor:pointer; color:var(--secondary); font-size:0.9rem; font-weight:600;">
                <i class="fas fa-arrow-right"></i> Go to Bookings
            </span>
        </div>`;
    } 

    modalContent.innerHTML = `${headerHtml}<div id="aptList">Loading...</div>`;
    modal.classList.add('active');

    // Fetch from PHP
    fetch(`${API_BASE}appointments.php?doctor_id=${currentUserData.uid}&status=${filterType}`)
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById('aptList'); list.innerHTML = '';
        if(data.length === 0) { list.innerHTML = `<p>No ${filterType} appointments.</p>`; return; }

        data.forEach(apt => {
            let btns = '';
            let infoExtra = '';

            if(filterType === 'pending') {
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
    .catch(error => {
        document.getElementById('aptList').innerHTML = `<p style="color:var(--primary); text-align:center; animation: fadeIn 0.4s ease;">Failed to load data. Please check your connection or backend.</p>`;
        console.error("API Error:", error);
    });
}

function updateApt(id, status) {
    const fd = new FormData();
    fd.append('action', 'update_status');
    fd.append('id', id);
    fd.append('status', status);
    fetch(`${API_BASE}appointments.php`, { method: 'POST', body: fd })
    .then(() => { showToast("Updated!"); openAppointmentList('pending'); });
}

function cancelAppointment(id) {
    const fd = new FormData();
    fd.append('action', 'delete');
    fd.append('id', id);
    fetch(`${API_BASE}appointments.php`, { method: 'POST', body: fd })
    .then(() => { showToast("Appointment Cancelled"); openAppointmentList('accepted'); });
}

// --- TIME PICKER ---
function openTimePicker(docId, currentVal, reqTime) {
    const modalContent = document.getElementById('modalContent');
    let reqDisplay = '';
    if(reqTime && reqTime !== 'undefined' && reqTime !== '') {
        reqDisplay = `<div style="background:#FFFBEB; border:1px solid #FCD34D; padding:10px; border-radius:8px; margin-bottom:15px; font-size:0.9rem; color:#92400E;"><i class="far fa-clock"></i> <strong>Patient Requested:</strong> ${reqTime}</div>`;
    }

    modalContent.innerHTML = `
        <h3>Set Appointment Time</h3>
        <p style="color:var(--gray); margin-bottom:15px; font-size:0.9rem;">Confirm the time for this visit.</p>
        ${reqDisplay}
        <input type="text" id="newTimeInput" value="${currentVal && currentVal !== 'undefined' ? currentVal : ''}" class="rx-input" style="min-height:auto; margin-bottom:20px;" placeholder="e.g. 10:30 AM">
        <button class="list-btn btn-book" style="width:100%; padding:12px;" onclick="saveTime('${docId}')">Save Time</button>
    `;
    document.getElementById('dashboardModal').classList.add('active');
}

function saveTime(docId) {
    const time = document.getElementById('newTimeInput').value;
    if(!time) { showToast("Please enter a time"); return; }
    
    const fd = new FormData();
    fd.append('action', 'update_time');
    fd.append('id', docId);
    fd.append('time', time);
    
    fetch(`${API_BASE}appointments.php`, { method: 'POST', body: fd })
    .then(() => { showToast("Time Updated"); openAppointmentList('accepted'); });
}

// --- PATIENT SEARCH ---
function openPatientSearch() {
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <h2 style="text-align:center;">Patient Lookup</h2>
        <div class="modern-search-bar"><i class="fas fa-search search-icon"></i>
        <input type="text" id="sInput" class="search-input-field" placeholder="Enter Patient Email..."><button class="search-btn-modern" onclick="performSearch()">Search</button></div>
        <div id="searchResults" style="max-height:400px;overflow-y:auto"></div>`;
    document.getElementById('dashboardModal').classList.add('active');
}

function performSearch() {
    const email = document.getElementById('sInput').value.trim();
    const resDiv = document.getElementById('searchResults');
    resDiv.innerHTML = 'Searching...';
    
    fetch(`${API_BASE}users.php?action=search&email=${email}`)
    .then(res => res.json())
    .then(data => {
        resDiv.innerHTML = '';
        if(data.length === 0) { resDiv.innerHTML = 'No patient found.'; return; }
        
        data.forEach(p => {
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

// --- WRITE PRESCRIPTION UI ---
let tempDoctorDetails = {};

function renderWritePrescription(pName, pGen, pAge, docDetails) {
    tempDoctorDetails = { ...docDetails, pAge: pAge || 'N/A', pGender: pGen || 'N/A' };
    
    // Format Schedule
    let displayTime = docDetails.time || 'Not set';
    if(displayTime.includes('|')) displayTime = displayTime.split('|').map(t => t.trim()).join('<br>');

    const headerHtml = `
        <div class="rx-header" style="border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 15px;">
            <h3 style="font-size: 1.2rem;">Dr. ${docDetails.name}</h3>
            <p style="color: var(--primary); font-weight: 600;">${docDetails.spec}</p>
        </div>
        <div class="rx-meta">
            <span><strong>Pt:</strong> ${pName}</span>
            <span><strong>Date:</strong> ${new Date().toLocaleDateString()}</span>
        </div>`;

    document.getElementById('tab-presc').innerHTML = `
        <div class="rx-paper">
            ${headerHtml}
            <textarea id="rxBody" class="rx-input" placeholder="Rx: \n\n1. Medicine Name - Dosage - Duration..."></textarea>
            <div style="margin-top:20px; text-align:right;">
                <button class="list-btn" onclick="openDoctorPatientView('${currentViewingPatient.id}', '${currentViewingPatient.name}')">Cancel</button>
                <button class="list-btn btn-book" onclick="saveWrittenPrescription()">Save & Print</button>
            </div>
        </div>`;
}

function saveWrittenPrescription() {
    const content = document.getElementById('rxBody').value;
    if(!content) { showToast("Empty Prescription"); return; }
    
    const fd = new FormData();
    fd.append('action', 'manual');
    fd.append('patientId', currentViewingPatient.id);
    fd.append('patientName', currentViewingPatient.name);
    fd.append('doctorId', currentUserData.uid);
    fd.append('doctorName', currentUserData.name);
    fd.append('content', content);
    fd.append('doctorDetails', JSON.stringify(tempDoctorDetails)); // Store as JSON string in DB

    fetch(`${API_BASE}reports.php`, { method: 'POST', body: fd })
    .then(() => {
        showToast("Prescription Saved");
        // Reload Profile View
        if(typeof loadPatientProfile === "function") loadPatientProfile(); 
        else if(typeof openDoctorPatientView === "function") openDoctorPatientView(currentViewingPatient.id, currentViewingPatient.name);
    });
}

// --- FILE UPLOAD ---
function triggerUpload(type) {
    document.getElementById('uploadType').value = type;
    document.getElementById('docUploadInput').click();
}

function handleDocUpload(input) {
    const type = document.getElementById('uploadType').value;
    let specificCategory = type; 
    if(type === 'Report') {
        const selector = document.getElementById('reportCategorySelect');
        if(selector) specificCategory = selector.value;
    }

    if(input.files && input.files[0]) {
        const fd = new FormData();
        fd.append('action', 'upload');
        fd.append('file', input.files[0]);
        fd.append('patientId', currentViewingPatient.id);
        fd.append('patientName', currentViewingPatient.name);
        fd.append('doctorId', currentUserData.uid);
        fd.append('doctorName', currentUserData.name);
        fd.append('reportType', type);
        fd.append('docCategory', specificCategory);
        fd.append('uploadedBy', 'doctor');

        fetch(`${API_BASE}reports.php`, { method: 'POST', body: fd })
        .then(() => {
            showToast("Uploaded Successfully");
            openDoctorPatientView(currentViewingPatient.id, currentViewingPatient.name);
        });
    }
}

// --- COMMUNITY FEED (Auto-Refresh) ---



function toggleLike(pid, liked) {
    const fd = new FormData();
    fd.append('action', 'like');
    fd.append('id', pid);
    fd.append('uid', currentUserData.uid);
    fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(fetchPosts);
}

function sendComment(pid) {
    const t = document.getElementById('i-'+pid).value;
    if(!t) return;
    const fd = new FormData();
    fd.append('action', 'comment');
    fd.append('id', pid);
    fd.append('text', t);
    fd.append('author', currentUserData.name);
    fd.append('role', 'doctor');
    fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(fetchPosts);
}


// --- MOBILE SIDEBAR TOGGLE ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    let overlay = document.getElementById('sidebarOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'sidebar-overlay';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }
    
    sidebar.classList.toggle('active');
    if (sidebar.classList.contains('active')) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// --- NOTIFICATIONS SYSTEM ---
function loadNotifications(container, userType) {
    container.innerHTML = `
        <div class="action-section">
            <div class="section-title">Recent Notifications</div>
            <div id="notificationsStream">
                <div style="text-align:center; padding: 20px; color: var(--gray);">Loading notifications... <i class="fas fa-spinner fa-spin"></i></div>
            </div>
        </div>`;
        
    const queryParam = userType === 'doctor' ? `doctor_id=${currentUserData.uid}` : `patient_id=${currentUserData.uid}`;
    
    fetch(`${API_BASE}appointments.php?${queryParam}`)
    .then(res => res.json())
    .then(data => {
        const feed = document.getElementById('notificationsStream');
        feed.innerHTML = '';
        
        if(data.length === 0) {
            feed.innerHTML = `<div style="text-align:center; padding: 30px; background: white; border-radius: 12px; border: 1px dashed #ccc; color: var(--gray);">No recent notifications found.</div>`;
            return;
        }

        data.forEach((apt, index) => {
            let icon = 'fa-bell';
            let iconBg = '#F3F4F6';
            let iconColor = 'var(--gray)';
            let title = '';
            let msg = '';
            
            // Animation delay for smooth cascading effect
            const animDelay = `${index * 0.1}s`;

            if (userType === 'doctor') {
                if (apt.status === 'pending') {
                    icon = 'fa-calendar-plus'; iconColor = '#F59E0B'; iconBg = '#FEF3C7';
                    title = 'New Appointment Request';
                    msg = `Patient <strong>${apt.patient_name}</strong> requested an appointment on ${apt.preferred_time || 'a preferred time'}.`;
                } else if (apt.status === 'accepted') {
                    icon = 'fa-calendar-check'; iconColor = 'var(--secondary)'; iconBg = '#DCFCE7';
                    title = 'Appointment Booked';
                    msg = `You accepted an appointment with <strong>${apt.patient_name}</strong>.`;
                } else {
                    icon = 'fa-calendar-times'; iconColor = '#EF4444'; iconBg = '#FEE2E2';
                    title = 'Appointment Cancelled';
                    msg = `Appointment with <strong>${apt.patient_name}</strong> was declined or cancelled.`;
                }
            } else {
                if (apt.status === 'accepted') {
                    icon = 'fa-check-circle'; iconColor = 'var(--secondary)'; iconBg = '#DCFCE7';
                    title = 'Request Approved';
                    msg = `Dr. <strong>${apt.doctor_name}</strong> approved your request. ${apt.scheduled_time ? `<br><span style="color:var(--primary); font-weight:600;">Time set to: ${apt.scheduled_time}</span>` : ''}`;
                } else if (apt.status === 'pending') {
                    icon = 'fa-clock'; iconColor = '#F59E0B'; iconBg = '#FEF3C7';
                    title = 'Request Pending';
                    msg = `Your request to Dr. <strong>${apt.doctor_name}</strong> is awaiting approval.`;
                } else {
                    icon = 'fa-times-circle'; iconColor = '#EF4444'; iconBg = '#FEE2E2';
                    title = 'Request Declined';
                    msg = `Your request to Dr. <strong>${apt.doctor_name}</strong> was cancelled or declined.`;
                }
            }

            feed.innerHTML += `
                <div class="notification-card" style="animation-delay: ${animDelay}; border-left-color: ${iconColor};">
                    <div class="notif-icon" style="color: ${iconColor}; background: ${iconBg};">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="notif-content" style="flex: 1;">
                        <h4>${title}</h4>
                        <p>${msg}</p>
                        <div class="notif-time"><i class="far fa-clock"></i> ${new Date(apt.request_date).toLocaleDateString()}</div>
                    </div>
                </div>`;
        });
    }).catch(err => {
        document.getElementById('notificationsStream').innerHTML = `<p style="color: red; text-align: center;">Failed to load notifications.</p>`;
    });
}

// --- UTILS ---
function closeDocViewer() { document.getElementById('documentViewerModal').classList.remove('active'); }
function closeModal() { document.getElementById('dashboardModal').classList.remove('active'); }
function showToast(msg) { const b = document.getElementById('toast-box'); if(b){ document.getElementById('toast-msg').innerText = msg; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000); }}
function logout() { localStorage.clear(); window.location.href = 'index.html'; }
