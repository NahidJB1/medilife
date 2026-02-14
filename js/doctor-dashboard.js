// --- CONFIG ---
const API_BASE = 'api/'; // Path to your PHP folder

// --- INIT DOCTOR DATA ---
const role = localStorage.getItem('userRole');
if(role !== 'doctor') { window.location.href = 'index.html'; }

const name = localStorage.getItem('userName') || 'Dr. User';
const storedEmail = localStorage.getItem('userEmail');
const storedUid = localStorage.getItem('userUid'); 

if (!storedEmail) {
    console.error("Critical: User email missing.");
    window.location.href = 'index.html';
}

const currentUserData = { name: name, role: 'doctor', uid: storedEmail, email: storedEmail };

// UI Init
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
function switchMainTab(el, tabName) {
    document.querySelectorAll('.tab-item, .nav-item').forEach(t => t.classList.remove('active'));
    if(el) el.classList.add('active');
    
    // Sync Sidebar & Top Tabs
    const allNavs = document.querySelectorAll('.nav-item');
    if(tabName === 'home') allNavs[0].classList.add('active');
    if(tabName === 'community') allNavs[1].classList.add('active');

    const contentArea = document.getElementById('tabContentArea');

    if (tabName === 'home') {
        // Stop Community Polling if active
        if(window.feedInterval) clearInterval(window.feedInterval);
        
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
        loadCommunityFeed(contentArea);
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
function loadCommunityFeed(container) {
    container.innerHTML = `
        <div class="create-post-card">
            <textarea id="newPostText" class="cp-input-area" style="width:100%; border:none; outline:none;" placeholder="Share a health tip..."></textarea>
            <div style="text-align:right; margin-top:10px;">
                <button class="list-btn btn-book" onclick="publishPost()">Post</button>
            </div>
        </div>
        <div id="feedStream">Loading...</div>
    `;
    
    fetchPosts(); // Initial Load
    // Set polling interval for "Real-Time" feel
    window.feedInterval = setInterval(fetchPosts, 5000); 
}

function fetchPosts() {
    const feed = document.getElementById('feedStream');
    if(!feed) return; 
    
    fetch(`${API_BASE}community.php?action=get`)
    .then(res => res.json())
    .then(data => {
        feed.innerHTML = '';
        data.forEach(p => {
            // Check if liked (p.likes should be array from PHP)
            const isLiked = p.likes && p.likes.includes(currentUserData.uid);
            
            let commentsHtml = '';
            if(p.comments && p.comments.length > 0) {
                p.comments.forEach(c => {
                    commentsHtml += `<div style="margin-bottom:8px; font-size:0.9rem; border-bottom:1px solid #eee;"><strong>${c.author}</strong>: ${c.text}</div>`;
                });
            }

            feed.innerHTML += `
                <div class="post-card">
                    <div class="post-header"><strong>${p.authorName}</strong> <span class="role-badge role-${p.authorRole}">${p.authorRole}</span></div>
                    <p>${p.content}</p>
                    <div class="interaction-bar">
                        <button class="action-btn ${isLiked?'liked':''}" onclick="toggleLike('${p.id}', ${isLiked})"> <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${p.likes ? p.likes.length : 0}</button>
                        <button class="action-btn" onclick="document.getElementById('c-sec-${p.id}').classList.toggle('open')"> <i class="far fa-comment"></i> ${p.comments ? p.comments.length : 0}</button>
                    </div>
                    <div class="comments-section" id="c-sec-${p.id}">
                        <div class="comment-input-box">
                            <input type="text" id="i-${p.id}" placeholder="Write a comment...">
                            <button class="list-btn btn-view" onclick="sendComment('${p.id}')">Send</button>
                        </div>
                        <div style="max-height:200px; overflow-y:auto;">${commentsHtml}</div>
                    </div>
                </div>`;
        });
    });
}

function publishPost() {
    const txt = document.getElementById('newPostText').value;
    if(txt) {
        const fd = new FormData();
        fd.append('action', 'post');
        fd.append('content', txt);
        fd.append('authorName', currentUserData.name);
        fd.append('authorRole', 'doctor');
        fd.append('authorId', currentUserData.uid);
        
        fetch(`${API_BASE}community.php`, { method: 'POST', body: fd })
        .then(() => { document.getElementById('newPostText').value = ''; fetchPosts(); });
    }
}

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

// --- UTILS ---
function closeDocViewer() { document.getElementById('documentViewerModal').classList.remove('active'); }
function closeModal() { document.getElementById('dashboardModal').classList.remove('active'); }
function showToast(msg) { const b = document.getElementById('toast-box'); if(b){ document.getElementById('toast-msg').innerText = msg; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000); }}
function logout() { localStorage.clear(); window.location.href = 'index.html'; }
