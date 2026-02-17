const API_BASE = 'api/';

const role = localStorage.getItem('userRole');
if(role !== 'patient') { window.location.href = 'index.html'; } 

const name = localStorage.getItem('userName') || 'User';
const storedEmail = localStorage.getItem('userEmail');

if (!storedEmail) { window.location.href = 'index.html'; }

const currentUserData = { name: name, role: 'patient', uid: storedEmail, email: storedEmail };

fetch(`${API_BASE}users.php?action=get&uid=${currentUserData.uid}`).then(r=>r.json()).then(d=>{
    if(d.profile_pic) document.getElementById('sideAvatar').src = d.profile_pic;
});

const fd = new FormData();
fd.append('action', 'sync');
fd.append('uid', currentUserData.uid);
fd.append('name', currentUserData.name);
fd.append('role', 'patient');
fd.append('email', currentUserData.email);
fetch(`${API_BASE}users.php`, { method: 'POST', body: fd });


document.getElementById('sideName').innerText = name;
document.getElementById('welcomeTitle').innerText = "Hello, " + name;
document.getElementById('sideRole').innerText = "Patient Account"; // Updates the "Medical Professional" text
document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// --- TAB SWITCHING ---
function switchMainTab(el, tabName) {
    document.querySelectorAll('.tab-item, .nav-item').forEach(t => t.classList.remove('active'));
    if(el) el.classList.add('active');
    
    const allNavs = document.querySelectorAll('.nav-item');
    if(tabName === 'home') allNavs[0].classList.add('active');
    if(tabName === 'community') allNavs[1].classList.add('active');

    const contentArea = document.getElementById('tabContentArea');

    if (tabName === 'home') {
        if(window.feedInterval) clearInterval(window.feedInterval);
        contentArea.innerHTML = `
        <div class="action-section">
            <div class="section-title">Quick Actions</div>
            <div class="quick-actions">
                <div class="action-card" onclick="openUploadModal()"><i class="fas fa-file-upload"></i><h4>Upload Report</h4><p>X-Ray, ECG, etc.</p></div>
                <div class="action-card" onclick="openFindDoctorModal()"><i class="fas fa-user-md"></i><h4>Find Doctors</h4><p>Book Appointment</p></div>
                <div class="action-card" onclick="openPatientSchedule()"><i class="fas fa-calendar-alt"></i><h4>View Schedule</h4><p>Check Appointments</p></div>
                <div class="action-card" onclick="window.location.href='patient-reports.html'"><i class="fas fa-file-medical-alt"></i><h4>My Reports</h4><p>View History</p></div>
            </div>
        </div>`;
    } else if (tabName === 'community') {
        loadCommunityFeed(contentArea);
    }
}

// --- FILE UPLOAD ---
function openUploadModal() {
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <h2 style="margin-bottom:20px;">Upload Document</h2>
        <div class="modal-form">
            <label>Type of Document</label>
            <select id="reportType">
                <option value="X-Ray">X-Ray / Scan</option>
                <option value="ECG">ECG Report</option>
                <option value="Blood Test">Blood / Lab Test</option>
            </select>
            <div class="modern-upload-box">
                <input type="file" id="reportFile" class="file-input-hidden" accept="image/*,.pdf" onchange="updateFileDisplay(this)">
                <div id="uploadContentUi"><i class="fas fa-cloud-upload-alt"></i><p>Click or Drag file here</p></div>
            </div>
            <div id="fileSelectedName" style="text-align:center; margin-bottom:15px; display:none;"><span class="file-name-display" id="fNameText"></span></div>
            <button class="list-btn btn-book" style="width:100%; padding:15px;" onclick="submitReport()"><i class="fas fa-check"></i> Submit Report</button>
        </div>`;
    document.getElementById('dashboardModal').classList.add('active');
}

function updateFileDisplay(input) {
    if(input.files && input.files[0]) {
        document.getElementById('fNameText').innerText = input.files[0].name;
        document.getElementById('fileSelectedName').style.display = 'block';
    }
}

function submitReport() {
    const file = document.getElementById('reportFile').files[0];
    if(!file) { showToast("Select a file first."); return; }
    
    const fd = new FormData();
    fd.append('action', 'upload');
    fd.append('file', file);
    fd.append('patientId', currentUserData.uid);
    fd.append('patientName', currentUserData.name);
    fd.append('reportType', document.getElementById('reportType').value);
    fd.append('uploadedBy', 'patient');

    fetch(`${API_BASE}reports.php`, { method: 'POST', body: fd })
    .then(() => { showToast("Uploaded!"); closeModal(); });
}

// --- FIND DOCTORS ---
function openFindDoctorModal() {
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `<h2>Doctors</h2><div id="docList" style="margin-top:15px">Loading list...</div>`;
    document.getElementById('dashboardModal').classList.add('active');

    // Fetch doctors and my appointments concurrently
    Promise.all([
        fetch(`${API_BASE}users.php?action=get_doctors`).then(r=>r.json()),
        fetch(`${API_BASE}appointments.php?patient_id=${currentUserData.uid}`).then(r=>r.json())
    ]).then(([doctors, myApps]) => {
        const list = document.getElementById('docList'); list.innerHTML = '';
        
        let myApptMap = {};
        myApps.forEach(a => { myApptMap[a.doctor_id] = { status: a.status, id: a.id }; });

        doctors.forEach(d => {
    const aptData = myApptMap[d.uid];
    const status = aptData ? aptData.status : null;
    const aptId = aptData ? aptData.id : null;

    // A. Profile Image Logic
    // If d.profile_pic exists, use it. Otherwise, use a placeholder URL.
    const imgSrc = d.profile_pic ? d.profile_pic : 'https://via.placeholder.com/150?text=Dr';
    const imgHtml = `<img src="${imgSrc}" class="doc-avatar-list" alt="Dr">`;

    let actionArea = '';
    
    // D. Updated Button Logic
    if (status === 'pending') {
        // Pending: Show Requested badge + Cancel
        actionArea = `
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                <span style="font-size:0.75rem; color:#F59E0B; font-weight:600;">Requested</span>
                <button class="list-btn" style="background:#EF4444; padding:5px 10px; font-size:0.7rem;" onclick="cancelPatientRequest('${aptId}')">Cancel</button>
            </div>`;
    } else if (status === 'accepted') {
        // Accepted: Show Booked badge + Cancel (User requirement: Cancel remains visible)
        actionArea = `
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                <span style="font-size:0.75rem; color:#10B981; font-weight:600;">Booked</span>
                <button class="list-btn" style="background:#EF4444; padding:5px 10px; font-size:0.7rem;" onclick="cancelPatientRequest('${aptId}')">Cancel</button>
            </div>`;
    } else {
        // No booking: Show Book button
        actionArea = `<button class="list-btn btn-book" onclick="openDoctorBooking('${d.uid}')">Book</button>`;
    }
    
    list.innerHTML += `
    <div class="list-item" style="animation: slideUp 0.3s ease-out;">
        <div style="display:flex; align-items:center; gap:15px;">
            ${imgHtml}
            <div>
                <span style="font-weight:600; font-size:1rem;">Dr. ${d.name}</span>
                <div style="font-size:0.8rem; color:var(--gray);">${d.specialist || 'General'}</div>
            </div>
        </div> 
        ${actionArea}
    </div>`;
});
    });
}

function openDoctorBooking(docId) {
    const container = document.getElementById('docList');
    container.innerHTML = '<div style="text-align:center; padding:20px;">Loading Profile...</div>';
    
    fetch(`${API_BASE}users.php?action=get&uid=${docId}`).then(r=>r.json()).then(d => {
        const imgSrc = d.profile_pic ? d.profile_pic : 'https://via.placeholder.com/150?text=Dr';
        
        // Parse the schedule string from DB
        const scheduleObj = parseDoctorSchedule(d.time); 
        let availableDaysText = "Available: All Days";
        if(scheduleObj) {
            availableDaysText = "Available: " + Object.values(scheduleObj).map(s => s.dayName).join(', ');
        }

        container.innerHTML = `
            <div style="animation:fadeIn 0.4s;">
                <button onclick="openFindDoctorModal()" style="border:none;background:none;cursor:pointer;margin-bottom:10px; color:var(--gray);">&larr; Back to list</button>
                
                <div class="doc-profile-header" style="text-align:center; margin-bottom:20px; border-bottom:1px solid #E5E7EB; padding-bottom:15px;">
                    <img src="${imgSrc}" alt="Doctor"> <h2 style="font-size:1.4rem;">Dr. ${d.name}</h2>
                    <p style="color:var(--primary); font-weight:500;">${d.specialist || 'Specialist'}</p>
                    
                    <div style="margin-top:10px; display:flex; flex-direction:column; gap:5px; align-items:center;">
                        <span class="doc-info-badge"><i class="far fa-clock"></i> ${d.time || '9:00 AM - 5:00 PM'}</span>
                        <span class="doc-info-badge"><i class="fas fa-map-marker-alt"></i> ${d.address || 'Chamber Address Not Listed'}</span>
                    </div>
                </div>

                <div style="background:#fff; padding:5px;">
                    <label style="font-weight:600; display:block; margin-bottom:5px;">Select Appointment Time</label>
                    <p style="font-size:0.8rem; color:#EF4444; margin-bottom:10px;">${availableDaysText}</p>

                    <div class="datetime-grid">
                        <div>
                            <span style="font-size:0.8rem; color:var(--gray);">Date</span>
                            <input type="date" id="bookingDate" class="modern-input">
                        </div>
                        <div>
                            <span style="font-size:0.8rem; color:var(--gray);">Time</span>
                            <input type="time" id="bookingTime" class="modern-input">
                        </div>
                    </div>
                    
                    <label style="font-weight:600; display:block; margin-bottom:10px;">Medical Records Access</label>
                    <label style="display:flex; align-items:center; gap:10px; padding:12px; background:#F9FAFB; border-radius:10px; border:1px solid #E5E7EB; margin-bottom:10px; cursor:pointer;">
                        <input type="radio" name="docShare" value="true" checked>
                        <span>Share Documents (Recommended)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; padding:12px; background:#F9FAFB; border-radius:10px; border:1px solid #E5E7EB; margin-bottom:20px; cursor:pointer;">
                        <input type="radio" name="docShare" value="false">
                        <span>Keep Private</span>
                    </label>

                    <button class="list-btn btn-book" style="width:100%; padding:15px; font-size:1rem; border-radius:30px; box-shadow:0 4px 15px rgba(239,68,68,0.3);" onclick="confirmBooking('${d.uid}', '${d.name}')">Confirm Booking</button>
                </div>
            </div>`;
            
            // --- Point C Logic: Restrict Dates & Times ---
            const dateInput = document.getElementById('bookingDate');
            const timeInput = document.getElementById('bookingTime');
            
            // Set min date to today
            dateInput.min = new Date().toISOString().split("T")[0];

            dateInput.addEventListener('change', function() {
                if(!this.value || !scheduleObj) return;

                const selectedDate = new Date(this.value);
                const dayIndex = selectedDate.getDay(); // 0 = Sun, 1 = Mon...

                // If the selected day is NOT in the doctor's schedule
                if (!scheduleObj[dayIndex]) {
                    showToast(`Doctor only available on: ${Object.values(scheduleObj).map(s => s.dayName).join(', ')}`);
                    this.value = ''; // Reset the input
                    timeInput.value = '';
                    timeInput.disabled = true;
                } else {
                    // Valid day selected
                    const hours = scheduleObj[dayIndex];
                    showToast(`Selected ${hours.dayName}. Hours: ${hours.start} - ${hours.end}`);
                    timeInput.disabled = false;
                    // Note: 'min' and 'max' on time inputs don't always strictly block UI in all browsers, 
                    // but we will validate logic on change.
                    timeInput.min = hours.start24;
                    timeInput.max = hours.end24;
                }
            });

            timeInput.addEventListener('change', function() {
                if(!dateInput.value || !scheduleObj) return;
                
                const dayIndex = new Date(dateInput.value).getDay();
                const hours = scheduleObj[dayIndex];
                
                if(hours) {
                    // Current value "14:30"
                    if(this.value < hours.start24 || this.value > hours.end24) {
                        showToast(`Please select time between ${hours.start} and ${hours.end}`);
                        this.value = '';
                    }
                }
            });
    });
}

function confirmBooking(docId, docName) {
    // C. Combine Date and Time
    const dateVal = document.getElementById('bookingDate').value;
    const timeVal = document.getElementById('bookingTime').value;
    
    if(!dateVal || !timeVal) { showToast("Please select both Date and Time"); return; }
    
    // Format: "2026-02-15 at 14:30"
    const finalTimeStr = `${dateVal} at ${timeVal}`;
    
    const share = document.querySelector('input[name="docShare"]:checked').value;

    const fd = new FormData();
    fd.append('action', 'book');
    fd.append('patientId', currentUserData.uid);
    fd.append('patientName', currentUserData.name);
    fd.append('doctorId', docId);
    fd.append('doctorName', docName);
    fd.append('time', finalTimeStr); // Sending combined string
    fd.append('share', share);

    fetch(`${API_BASE}appointments.php`, { method: 'POST', body: fd })
    .then(() => { showToast("Request Sent!"); closeModal(); });
}

function cancelPatientRequest(aptId) {
    const fd = new FormData();
    fd.append('action', 'delete');
    fd.append('id', aptId);
    fetch(`${API_BASE}appointments.php`, { method: 'POST', body: fd })
    .then(() => { showToast("Cancelled"); openFindDoctorModal(); });
}

// --- SCHEDULE & ACCESS REQUESTS ---
function openPatientSchedule() {
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `<h2>My Schedule</h2><div id="schedList" style="margin-top:15px;">Loading...</div>`;
    document.getElementById('dashboardModal').classList.add('active');
    
    fetch(`${API_BASE}appointments.php?patient_id=${currentUserData.uid}`)
    .then(r=>r.json()).then(data => {
        const l = document.getElementById('schedList'); l.innerHTML = '';
        if(data.length === 0) { l.innerHTML = '<div style="text-align:center; padding:20px; color:var(--gray);">No appointments found.</div>'; return; }
        
        data.forEach(d => {
            let statusBadge = '';
            let actionPanel = '';
            let timeDisplay = '';

            // E. Schedule Logic: Show Scheduled Time if accepted, else Preferred Time
            // Note: DB column 'scheduled_time' is set by doctor. 'preferred_time' is set by patient.
            if (d.status === 'accepted') {
                const finalTime = d.scheduled_time ? d.scheduled_time : d.preferred_time;
                timeDisplay = `<div style="font-size:0.9rem; margin-top:5px;"><i class="far fa-clock"></i> <strong>${finalTime}</strong></div>`;
                statusBadge = `<span style="background:#DEF7EC; color:#03543F; padding:2px 8px; border-radius:4px; font-size:0.75rem;">Confirmed</span>`;
            }
            else if (d.status === 'pending') {
                timeDisplay = `<div style="font-size:0.9rem; color:var(--gray); margin-top:5px;">Requested: ${d.preferred_time}</div>`;
                statusBadge = '<span style="background:#FEF3C7; color:#92400E; padding:2px 8px; border-radius:4px; font-size:0.75rem;">Pending</span>';
            }
            else {
                statusBadge = '<span style="background:#FEE2E2; color:#991B1B; padding:2px 8px; border-radius:4px; font-size:0.75rem;">Declined</span>';
            }

            // Access Request Logic (unchanged)
            if (d.status === 'accepted' && d.access_request === 'pending') {
                actionPanel = `
                    <div style="background:#FFF1F2; padding:12px; border-radius:8px; margin-top:12px; border:1px dashed #F43F5E;">
                        <p style="color:#BE123C; font-size:0.9rem; margin-bottom:8px; display:flex; align-items:center; gap:5px;"><i class="fas fa-lock"></i> Dr. ${d.doctor_name} requests file access.</p>
                        <div style="display:flex; gap:10px;">
                            <button class="list-btn btn-book" style="font-size:0.8rem;" onclick="respondToAccess('${d.id}', 'true')">Allow</button>
                            <button class="list-btn" style="background:#fff; border:1px solid #9CA3AF; color:#374151; font-size:0.8rem;" onclick="respondToAccess('${d.id}', 'false')">Deny</button>
                        </div>
                    </div>`;
            }

            l.innerHTML += `
                <div class="list-item" style="display:block; padding:15px; border-left: 4px solid ${d.status === 'accepted' ? 'var(--secondary)' : (d.status === 'pending' ? '#F59E0B' : '#EF4444')};">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <div style="font-weight:600; font-size:1.1rem;">Dr. ${d.doctor_name}</div>
                            ${timeDisplay}
                            <div style="margin-top:5px;">${statusBadge}</div>
                        </div>
                        <small style="color:var(--gray);">${new Date(d.request_date).toLocaleDateString()}</small>
                    </div>
                    ${actionPanel}
                </div>`;
        });
    });
}

function respondToAccess(aptId, allow) {
    const fd = new FormData();
    fd.append('action', 'access_response');
    fd.append('id', aptId);
    fd.append('allow', allow);
    fetch(`${API_BASE}appointments.php`, { method: 'POST', body: fd })
    .then(() => { showToast(allow==='true'?"Allowed":"Denied"); openPatientSchedule(); });
}

// --- COMMUNITY FEED (Auto-Refresh) ---
function loadCommunityFeed(container) {
    container.innerHTML = `
        <div class="create-post-card">
            <textarea id="newPostText" class="cp-input-area" style="width:100%; border:none; outline:none;" placeholder="Share a health journey..."></textarea>
            <div style="text-align:right; margin-top:10px;">
                <button class="list-btn btn-book" onclick="publishPost()">Post</button>
            </div>
        </div>
        <div id="postsFeed">Loading posts...</div>
    `;
    fetchPosts();
    window.feedInterval = setInterval(fetchPosts, 5000);
}

function fetchPosts() {
    const feed = document.getElementById('postsFeed');
    if(!feed) return; 
    
    fetch(`${API_BASE}community.php?action=get`).then(r=>r.json()).then(data => {
        feed.innerHTML = '';
        data.forEach(p => {
            const isLiked = p.likes && p.likes.includes(currentUserData.uid);
            let commentsHtml = '';
            if(p.comments) p.comments.forEach(c => {
                commentsHtml += `<div style="margin-bottom:8px; font-size:0.9rem; border-bottom:1px solid #eee;"><strong>${c.author}</strong>: ${c.text}</div>`;
            });

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
    if(!txt) return;
    const fd = new FormData();
    fd.append('action', 'post'); fd.append('content', txt);
    fd.append('authorName', currentUserData.name); fd.append('authorRole', 'patient'); fd.append('authorId', currentUserData.uid);
    fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(() => { document.getElementById('newPostText').value = ''; fetchPosts(); });
}

function toggleLike(pid) {
    const fd = new FormData(); fd.append('action', 'like'); fd.append('id', pid); fd.append('uid', currentUserData.uid);
    fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(fetchPosts);
}
function sendComment(pid) {
    const t = document.getElementById('i-'+pid).value; if(!t) return;
    const fd = new FormData(); fd.append('action', 'comment'); fd.append('id', pid); fd.append('text', t); fd.append('author', currentUserData.name);
    fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(fetchPosts);
}

// --- UTILS ---
function closeModal() { document.getElementById('dashboardModal').classList.remove('active'); }
function showToast(msg) { const b = document.getElementById('toast-box'); document.getElementById('toast-msg').innerText = msg; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000); }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }


// --- HELPER FUNCTIONS FOR SCHEDULE PARSING ---

// Converts "10:30 PM" to "22:30" for comparison
function to24Hour(timeStr) {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') { hours = '00'; }
    if (modifier === 'PM') { hours = parseInt(hours, 10) + 12; }
    return `${hours}:${minutes}`;
}

// Parses "Mon: 10:30 AM - 02:00 PM | Fri: ..." into an object
function parseDoctorSchedule(timeString) {
    if (!timeString) return null;
    
    const dayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
    const schedule = {};
    const parts = timeString.split('|'); // Split by pipe if multiple days
    
    parts.forEach(part => {
        // Regex to find Day and Time Range
        // Looks for "Mon: 10:00 AM - 02:00 PM" format
        const match = part.match(/([A-Za-z]{3})\s*:\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
        if (match) {
            const dayKey = match[1].toLowerCase();
            if (dayMap.hasOwnProperty(dayKey)) {
                schedule[dayMap[dayKey]] = {
                    dayName: match[1],
                    start: match[2], 
                    end: match[3],
                    start24: to24Hour(match[2]),
                    end24: to24Hour(match[3])
                };
            }
        }
    });
    return Object.keys(schedule).length > 0 ? schedule : null;
}
