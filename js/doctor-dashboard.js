 const db = firebase.firestore();
    const auth = firebase.auth();
    const modal = document.getElementById('dashboardModal');
    const modalContent = document.getElementById('modalContent');

    // --- INIT DOCTOR DATA ---
    
    // --- INIT DOCTOR DATA ---
    const role = localStorage.getItem('userRole');
    if(role !== 'doctor') { window.location.href = 'index.html'; }

    const name = localStorage.getItem('userName') || 'Dr. User';
    const storedEmail = localStorage.getItem('userEmail');
    
    // CRITICAL FIX: Always use the raw Email as the User ID
    // This ensures the ID is consistent regardless of login method
    if (!storedEmail) {
        console.error("Critical: User email missing from session.");
        window.location.href = 'index.html'; // Redirect to login if email is lost
    }

    const stableId = storedEmail; // ID is now "doctor@gmail.com"

    const currentUserData = { name: name, role: 'doctor', uid: stableId, email: storedEmail };
    db.collection('users').doc(stableId).get().then(doc => {
    if(doc.exists && doc.data().profilePic) {
        document.getElementById('sideAvatar').src = doc.data().profilePic;
    }
});
    
    document.getElementById('sideName').innerText = name;
    document.getElementById('welcomeTitle').innerText = "Hello, " + name;
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // SYNC DOCTOR: Creates/Updates the doctor document with the Email ID
    db.collection('users').doc(stableId).set({
        name: currentUserData.name, 
        role: 'doctor', 
        email: currentUserData.email
    }, { merge: true });


    // --- TAB SWITCHING ---
    function switchMainTab(el, tabName) {
        document.querySelectorAll('.tab-item, .nav-item').forEach(t => t.classList.remove('active'));
        if(el) el.classList.add('active');
        
        const allNavs = document.querySelectorAll('.nav-item');
        if(tabName === 'home') allNavs[0].classList.add('active');
        if(tabName === 'community') allNavs[1].classList.add('active');

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
            loadCommunityFeed(contentArea);
        }
    }

    function openAppointmentList(filterType) {
    const title = filterType === 'pending' ? 'Appointment Requests' : 'Confirmed Bookings';
    
    // 1. Header Logic (Cleaned up - removed the broken 'else' block)
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
    // ERROR WAS HERE: The 'else' block with 'btns = ...' was removed because 'doc' is not defined yet.

    modalContent.innerHTML = `${headerHtml}<div id="aptList">Loading...</div>`;
    modal.classList.add('active');

    // 2. Fetch Data
    db.collection('appointments').where('doctorId', '==', currentUserData.uid).get().then(snap => {
        const list = document.getElementById('aptList'); list.innerHTML = '';
        let count = 0;
        snap.forEach(doc => {
            const data = doc.data();
            if(data.status !== filterType) return;
            count++;
            
            let btns = '';
            let infoExtra = '';

            // 3. Button Logic (This is the correct place for it)
            if(filterType === 'pending') {
                const reqTime = data.preferredTime ? `<br><small style="color:#F59E0B; font-weight:600;"><i class="far fa-clock"></i> Requested: ${data.preferredTime}</small>` : '';
                infoExtra = reqTime;
                btns = `<button class="list-btn btn-accept" onclick="updateApt('${doc.id}','accepted')">Accept</button>
                        <button class="list-btn btn-decline" onclick="updateApt('${doc.id}','declined')">Decline</button>`;
            } else {
                // Confirmed Bookings: Now correctly uses 'goToPatientPage'
                btns = `<button class="list-btn btn-time" title="Set Time" onclick="openTimePicker('${doc.id}', '${data.scheduledTime || ''}', '${data.preferredTime || ''}')"><i class="fas fa-clock"></i></button>
                        <button class="list-btn btn-book" onclick="goToPatientPage('${data.patientId}', '${data.patientName}')">Profile</button>
                        <button class="list-btn btn-cancel" onclick="cancelAppointment('${doc.id}')">Cancel</button>`;
            }

            list.innerHTML += `
                <div class="list-item">
                    <div>
                        <strong>${data.patientName}</strong>
                        <br><small>Date: ${new Date(data.requestDate).toLocaleDateString()}</small>
                        ${data.scheduledTime ? `<br><small style="color:#2563EB; font-weight:600;">Scheduled: ${data.scheduledTime}</small>` : ''}
                        ${infoExtra}
                    </div>
                    <div style="text-align:right; display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end;">${btns}</div>
                </div>`;
        });
        if(count === 0) list.innerHTML = `<p>No ${filterType} appointments.</p>`;
    });
}


    function updateApt(id, status) {
        db.collection('appointments').doc(id).update({ status: status }).then(() => { showToast("Updated!"); openAppointmentList('pending'); });
    }

    // [Task C] Replaced prompt with a UI Modal
    // [Task B] Updated to show Requested Time
    function openTimePicker(docId, currentVal, reqTime) {
        let reqDisplay = '';
        if(reqTime && reqTime !== 'undefined' && reqTime !== '') {
            reqDisplay = `
            <div style="background:#FFFBEB; border:1px solid #FCD34D; padding:10px; border-radius:8px; margin-bottom:15px; font-size:0.9rem; color:#92400E;">
                <i class="far fa-clock"></i> <strong>Patient Requested:</strong> ${reqTime}
            </div>`;
        }

        modalContent.innerHTML = `
            <h3>Set Appointment Time</h3>
            <p style="color:var(--gray); margin-bottom:15px; font-size:0.9rem;">Confirm the time for this visit.</p>
            ${reqDisplay}
            <input type="text" id="newTimeInput" value="${currentVal && currentVal !== 'undefined' ? currentVal : ''}" class="rx-input" style="min-height:auto; margin-bottom:20px;" placeholder="e.g. 10:30 AM">
            <button class="list-btn btn-book" style="width:100%; padding:12px;" onclick="saveTime('${docId}')">Save Time</button>
        `;
        modal.classList.add('active');
    }

    function saveTime(docId) {
        const time = document.getElementById('newTimeInput').value;
        if(!time) { showToast("Please enter a time"); return; }
        
        db.collection('appointments').doc(docId).update({ scheduledTime: time }).then(()=>{ 
            showToast("Time Updated Successfully"); 
            // Return to list or close
            openAppointmentList('accepted'); 
        });
    }

    // [Task C] Removed native confirm alert
    function cancelAppointment(id) {
        db.collection('appointments').doc(id).delete().then(()=>{ 
            showToast("Appointment Cancelled"); 
            openAppointmentList('accepted'); 
        });
    }

    function openPatientSearch() {
        modalContent.innerHTML = `
            <h2 style="text-align:center;">Patient Lookup</h2>
            <div class="modern-search-bar"><i class="fas fa-search search-icon"></i>
            <input type="text" id="sInput" class="search-input-field" placeholder="Enter Patient Email..."><button class="search-btn-modern" onclick="performSearch()">Search</button></div>
            <div id="searchResults" style="max-height:400px;overflow-y:auto"></div>`;
        modal.classList.add('active');
    }

    // --- REPLACE THE SEARCH LOGIC inside performSearch() ---
function performSearch() {
    const email = document.getElementById('sInput').value.trim();
    const resDiv = document.getElementById('searchResults');
    
    // Call PHP endpoint
    fetch(`api/search_patient.php?email=${email}`)
    .then(res => res.json())
    .then(data => {
        resDiv.innerHTML = '';
        if(data.length === 0) {
            resDiv.innerHTML = 'No patient found.';
            return;
        }
        
        data.forEach(p => {
            resDiv.innerHTML += `
                <div class="list-item" onclick="window.location.href='doctor-patient-view.html?pid=${p.uid}&name=${p.name}'">
                   <strong>${p.name}</strong> (${p.email})
                </div>`;
        });
    });
}

    function goToPatientPage(pid, pname) {
    // Encodes the name to ensure special characters don't break the URL
    window.location.href = `doctor-patient-view.html?pid=${pid}&name=${encodeURIComponent(pname)}`;
}


    // [REPLACE] The entire openDocViewer function
    function openDocViewer(type, content, title, docName = 'Doctor', patName = 'Patient', dateStr = 'N/A', drDetails = {}) {
        const viewerModal = document.getElementById('documentViewerModal');
        const viewerContent = document.getElementById('docViewerContent');
        
        let html = '';
        
        if (type === 'manual') {
            const dSpec = drDetails.spec || 'Medical Professional';
            const dDeg = drDetails.deg || '';
            const dAddr = drDetails.addr || 'Address not available';
            
            // Format Schedule: Split by '|' and join with <br> for multi-line
            let dTime = drDetails.time || '';
            if(dTime.includes('|')) {
                dTime = dTime.split('|').map(t => t.trim()).join('<br>');
            }

            const dPhone = drDetails.phone || '';
            const dEmail = drDetails.email || '';

            html = `
                <div class="rx-paper" style="border: none; box-shadow: none; padding: 10px; max-width: 800px; margin: 0 auto; background: white;">
                    
                    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
                        
                        <div style="flex: 1; min-width: 250px; margin-bottom: 15px;">
                             <div style="display:flex; align-items:center; gap:8px; margin-bottom:15px;">
                                 <svg width="24" height="24" viewBox="0 0 100 100"><rect x="35" y="10" width="30" height="80" rx="5" fill="#EF4444" /><rect x="10" y="35" width="80" height="30" rx="5" fill="#EF4444" /></svg>
                                 <div style="font-family: 'Poppins', sans-serif; font-size: 18px; font-weight: 700; line-height: 1;"><span style="color: #EF4444;">MED</span><span style="color: #000;">e</span><span style="color: #22C55E;">LIFE</span></div>
                             </div>
                             
                             <h2 style="font-size: 1.6rem; margin: 0; color: #111;">Dr. ${docName}</h2>
                             <p style="color: #EF4444; font-weight: 600; font-size: 0.95rem; margin-top: 2px;">${dSpec}</p>
                             ${dDeg ? `<p style="color: #6B7280; font-size: 0.85rem; max-width: 300px;">${dDeg}</p>` : ''}
                        </div>

                        <div style="text-align: right; min-width: 200px; font-size: 0.85rem; color: #374151;">
                             <p style="margin-bottom: 8px;"><strong>Chamber:</strong><br>${dAddr}</p>
                             ${dTime ? `<p style="margin-bottom: 8px;"><strong>Schedule:</strong><br>${dTime}</p>` : ''}
                             <p style="margin-top: 8px;"><strong>Contact:</strong><br>
                                ${dPhone ? dPhone + '<br>' : ''}
                                ${dEmail ? dEmail : ''}
                             </p>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #E5E7EB; padding-bottom: 15px; margin-bottom: 25px; font-size: 0.95rem; color: #374151;">
                        <div>
                            <span style="font-weight: 700; color: #111;">Patient: ${patName}</span>
                            ${drDetails.pAge ? `<br><span style="font-size: 0.9rem; color: #4B5563;">Age: ${drDetails.pAge} • Gender: ${drDetails.pGender||'N/A'}</span>` : ''} 
                            <br><span style="font-size: 0.85rem; color: #6B7280;">Rx ID: #${Math.floor(Math.random()*10000) + 1000}</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-weight: 700;">Date: ${dateStr}</span><br>
                            <span style="font-size: 0.85rem; color: #6B7280;">Consultation: Online</span>
                        </div>
                    </div>

                    <div class="rx-body-bg" style="background: #FAFAFA; padding: 30px; border-radius: 8px; border: 1px dashed #E5E7EB; min-height: 400px; position: relative;">
                        <span style="font-family: 'Times New Roman', serif; font-style: italic; font-weight: bold; font-size: 2.5rem; color: #333; position: absolute; top: 20px; left: 20px;">Rx</span>
                        <div style="margin-top: 60px; white-space: pre-wrap; font-family: 'Poppins', sans-serif; font-size: 1rem; line-height: 1.8; color: #1F2937;">${content}</div>
                    </div>

                    <div class="rx-footer" style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
                        <small style="color: #9CA3AF;">Generated digitally via MEDeLIFE</small>
                        <div style="text-align: center;">
                            <div style="font-family: 'Cursive', serif; font-size: 1.5rem; color: #EF4444; opacity: 0.7;">Signed</div>
                            <div style="border-top: 1px solid #333; width: 150px; margin-top: 5px;"></div>
                            <small style="font-weight: 600;">Dr. ${docName}</small>
                        </div>
                    </div>
                </div>

                <div class="no-print" style="margin-top: 20px; text-align: right; border-top: 1px solid #eee; padding-top: 15px;">
                    <button class="list-btn btn-book" onclick="window.print()">
                        <i class="fas fa-print"></i> Print / Save as PDF
                    </button>
                </div>
            `;
        } else {
            // File View
            html = `
                <h3 style="margin-bottom: 10px;">${title}</h3>
                <iframe src="${content}" style="width: 100%; flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; background: #f1f1f1;"></iframe>
            `;
        }
        
        viewerContent.innerHTML = html;
        viewerModal.classList.add('active');
    }

    
    // --- HELPER: Tabs Switcher ---
    function switchModalTab(tab) {
        document.querySelectorAll('.m-tab-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.m-tab-content').forEach(el => el.style.display = 'none');
        
        if(tab === 'presc') {
            document.querySelectorAll('.m-tab-item')[0].classList.add('active');
            document.getElementById('tab-presc').style.display = 'block';
        } else {
            document.querySelectorAll('.m-tab-item')[1].classList.add('active');
            document.getElementById('tab-reports').style.display = 'block';
        }
    }

    // --- HELPER: Request Access ---
    function requestDocAccess(aptId) {
        db.collection('appointments').doc(aptId).update({
            accessRequest: 'pending'
        }).then(() => {
            showToast("Request sent to patient");
            openDoctorPatientView(currentViewingPatient.id, currentViewingPatient.name); // Refresh view
        });
    }

    // --- HELPER: Write Prescription UI ---
   // --- HELPER: Write Prescription UI (Updated Layout) ---
    // We store the current doctor details in a global variable for saving later
    let tempDoctorDetails = {};

    function renderWritePrescription(pName, pGen, pAge, docDetails) {
        // Store patient meta in the docDetails snapshot for saving
        tempDoctorDetails = {
            ...docDetails,
            pAge: pAge || 'N/A',
            pGender: pGen || 'N/A'
        };

        // Format Time for Display: Split by '|' for multi-line
        let displayTime = docDetails.time || 'Not set';
        if(displayTime.includes('|')) {
            displayTime = displayTime.split('|').map(t => t.trim()).join('<br>');
        }

        const headerHtml = `
            <div class="rx-header" style="border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between;">
                
                <div style="flex: 1; min-width: 200px; text-align: left;">
                    <div style="display:flex; align-items:center; gap:5px; margin-bottom:10px;">
                         <svg width="24" height="24" viewBox="0 0 100 100"><rect x="35" y="10" width="30" height="80" rx="5" fill="#EF4444" /><rect x="10" y="35" width="80" height="30" rx="5" fill="#EF4444" /></svg>
                         <div style="font-weight:700; font-size:16px; line-height:1;"><span style="color:#EF4444;">MED</span><span style="color:#000;">e</span><span style="color:#22C55E;">LIFE</span></div>
                    </div>
                    <h3 style="font-size: 1.2rem; margin-bottom: 2px;">Dr. ${docDetails.name}</h3>
                    <p style="color: var(--primary); font-weight: 600; font-size: 0.9rem;">${docDetails.spec}</p>
                    <p style="color: var(--gray); font-size: 0.85rem;">${docDetails.deg}</p>
                </div>

                <div style="text-align: right; min-width: 200px; font-size: 0.85rem; color: #374151;">
                    <p style="margin-bottom: 5px;"><strong>Chamber:</strong><br>${docDetails.addr || 'Address not set'}</p>
                    <p style="margin-bottom: 5px;"><strong>Schedule:</strong><br>${displayTime}</p>
                    <p><strong>Contact:</strong><br>${docDetails.phone || ''}<br>${docDetails.email || ''}</p>
                </div>
            </div>

            <div class="rx-meta">
                <span><strong>Pt:</strong> ${pName}</span>
                <span><strong>Age:</strong> ${pAge ? pAge+'Y' : '-'} &nbsp;|&nbsp; <strong>Gender:</strong> ${pGen ? pGen : '-'}</span>
                <span><strong>Date:</strong> ${new Date().toLocaleDateString()}</span>
            </div>
        `;

        document.getElementById('tab-presc').innerHTML = `
            <div class="rx-paper">
                ${headerHtml}
                <textarea id="rxBody" class="rx-input" placeholder="Rx: \n\n1. Medicine Name - Dosage - Duration..."></textarea>
                <div style="margin-top:20px; text-align:right;">
                    <button class="list-btn" style="background:var(--gray); color:white; margin-right:10px;" onclick="openDoctorPatientView('${currentViewingPatient.id}', '${currentViewingPatient.name}')">Cancel</button>
                    <button class="list-btn btn-book" onclick="saveWrittenPrescription()">Save & Print</button>
                </div>
            </div>
        `;
    }

    function saveWrittenPrescription() {
    const content = document.getElementById('rxBody').value;
    if(!content) { showToast("Prescription is empty"); return; }
    
    db.collection('reports').add({
        patientId: currentViewingPatient.id, // Ensure this is the patient's email
        patientName: currentViewingPatient.name,
        doctorId: currentUserData.uid,
        doctorName: currentUserData.name,
        reportType: 'Prescription',
        uploadedBy: 'doctor', 
        isManual: true,
        content: content,
        doctorDetails: tempDoctorDetails,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        showToast("Prescription Saved");
        // Use the function specific to the page you are on
        if(typeof loadPatientProfile === "function") loadPatientProfile(); 
        else if(typeof openDoctorPatientView === "function") openDoctorPatientView(currentViewingPatient.id, currentViewingPatient.name);
    });
}

    // --- HELPER: Upload Logic ---
    function triggerUpload(type) {
        document.getElementById('uploadType').value = type;
        document.getElementById('docUploadInput').click();
    }

    function handleDocUpload(input) {
        const type = document.getElementById('uploadType').value; // 'Prescription' or 'Report'
        
        // Determine specific category
        let specificCategory = type; 
        if(type === 'Report') {
            const selector = document.getElementById('reportCategorySelect');
            if(selector) specificCategory = selector.value; // e.g., "X-Ray"
        }

        if(input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                // In doctor-dashboard.html -> handleDocUpload()
db.collection('reports').add({
    patientId: currentViewingPatient.id,
    patientName: currentViewingPatient.name,
    doctorId: currentUserData.uid,
    doctorName: currentUserData.name,
    reportType: type,
    docCategory: specificCategory,
    uploadedBy: 'doctor', // <--- ADD THIS LINE
    fileData: e.target.result,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
})
                .then(() => {
                    showToast(specificCategory + " Uploaded");
                    openDoctorPatientView(currentViewingPatient.id, currentViewingPatient.name); // Refresh to show new item
                });
            }
            reader.readAsDataURL(input.files[0]);
        }
    }


    // --- SHARED UTILS ---
    function viewFile(data) { const win = window.open(); win.document.write(`<iframe src="${data}" style="width:100%;height:100%;border:none;"></iframe>`); }
    function closeModal() { modal.classList.remove('active'); }
    function showToast(msg) { const b = document.getElementById('toast-box'); document.getElementById('toast-msg').innerText = msg; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000); }
    function logout() { localStorage.clear(); window.location.href = 'index.html'; }


    
    function toggleLike(pid, liked) { db.collection('posts').doc(pid).update({ likes: liked ? firebase.firestore.FieldValue.arrayRemove(currentUserData.uid) : firebase.firestore.FieldValue.arrayUnion(currentUserData.uid) }); }
    function sendComment(pid) {
        const t = document.getElementById('i-'+pid).value; if(!t) return;
        db.collection('posts').doc(pid).update({ comments: firebase.firestore.FieldValue.arrayUnion({ text: t, author: currentUserData.name, role: 'doctor' }) });
    }

    // --- FIX: MISSING COMMUNITY FUNCTION ---
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

        db.collection('posts').orderBy('timestamp', 'desc').onSnapshot(snap => {
            const feed = document.getElementById('feedStream');
            if(!feed) return;
            feed.innerHTML = '';
            snap.forEach(doc => {
                const p = doc.data();
                feed.innerHTML += `
                    <div class="post-card">
                        <div class="post-header"><strong>${p.authorName}</strong> <span class="role-badge role-${p.authorRole}">${p.authorRole}</span></div>
                        <p>${p.content}</p>
                        <div class="interaction-bar"><small>${p.likes ? p.likes.length : 0} Likes</small></div>
                    </div>`;
            });
        });
    }

    function publishPost() {
        const txt = document.getElementById('newPostText').value;
        if(txt) db.collection('posts').add({
            authorName: currentUserData.name, authorRole: 'doctor', authorId: currentUserData.uid,
            content: txt, likes: [], comments: [], timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    

function closeDocViewer() {
    document.getElementById('documentViewerModal').classList.remove('active');
}
