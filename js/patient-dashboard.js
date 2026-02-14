 const db = firebase.firestore();
    const auth = firebase.auth();
    const modal = document.getElementById('dashboardModal');
    const modalContent = document.getElementById('modalContent');

    // --- INIT PATIENT DATA ---
    // --- INIT PATIENT DATA ---
    const role = localStorage.getItem('userRole');
    if(role !== 'patient') { window.location.href = 'index.html'; } 

    const name = localStorage.getItem('userName') || 'User';
    const storedEmail = localStorage.getItem('userEmail');

    if (!storedEmail) {
        console.error("Critical: User email missing from session.");
        window.location.href = 'index.html'; 
    }

    // CRITICAL FIX: Patient ID is also their exact email now
    const stableId = storedEmail;

    const currentUserData = { name: name, role: 'patient', uid: stableId, email: storedEmail };
    db.collection('users').doc(stableId).get().then(doc => {
    if(doc.exists && doc.data().profilePic) {
        document.getElementById('sideAvatar').src = doc.data().profilePic;
    }
});

    // SYNC PATIENT: Ensures patient exists in DB with Email ID
    db.collection('users').doc(stableId).set({
        name: currentUserData.name,
        role: 'patient',
        email: currentUserData.email
    }, { merge: true });

    document.getElementById('sideName').innerText = name;
    document.getElementById('welcomeTitle').innerText = "Hello, " + name;
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // --- TAB SWITCHING ---
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

    // --- PATIENT FUNCTIONS ---
    function openUploadModal() {
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
        modal.classList.add('active');
    }

    function updateFileDisplay(input) {
        if(input.files && input.files[0]) {
            document.getElementById('fNameText').innerText = input.files[0].name;
            document.getElementById('fileSelectedName').style.display = 'block';
            document.querySelector('.modern-upload-box').style.background = '#F0FDF4';
            document.querySelector('.modern-upload-box i').className = 'fas fa-check-circle';
        }
    }

    function submitReport() {
        const file = document.getElementById('reportFile').files[0];
        if(!file) { showToast("Select a file first."); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            db.collection('reports').add({
                patientId: currentUserData.uid, patientName: currentUserData.name,
                reportType: document.getElementById('reportType').value, fileData: e.target.result,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => { showToast("Uploaded!"); closeModal(); });
        };
        reader.readAsDataURL(file);
    }

    function openFindDoctorModal() {
        modalContent.innerHTML = `<h2>Doctors</h2><div id="docList" style="margin-top:15px">Loading list...</div>`;
        modal.classList.add('active');
        
        Promise.all([
            db.collection('users').where('role', '==', 'doctor').get(),
            db.collection('appointments').where('patientId', '==', currentUserData.uid).get()
        ]).then(([doctorsSnap, myApptSnap]) => {
            const list = document.getElementById('docList'); 
            list.innerHTML = '';
            
            let myApptMap = {};
            myApptSnap.forEach(doc => { 
                myApptMap[doc.data().doctorId] = { status: doc.data().status, id: doc.id }; 
            });
            
            const processedNames = new Set();
            
            doctorsSnap.forEach(doc => {
                const d = doc.data();
                if (processedNames.has(d.name)) return;
                processedNames.add(d.name);

                const aptData = myApptMap[doc.id];
                const status = aptData ? aptData.status : null;
                const aptId = aptData ? aptData.id : null;

                let actionArea = '';

                if (status === 'pending') {
                    actionArea = `
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                            <span style="font-size:0.8rem; color:#F59E0B; font-weight:600;">Requested</span>
                            <button class="list-btn" style="background:#EF4444; color:white;" onclick="cancelPatientRequest('${aptId}')">Cancel</button>
                        </div>`;
                } else if (status === 'accepted') {
                    actionArea = `<button class="list-btn" disabled style="opacity:0.6; background:#10B981; color:white;">Booked</button>`;
                } else {
                    // CHANGED: Calls openDoctorBooking instead of bookApt
                    actionArea = `<button class="list-btn btn-book" onclick="openDoctorBooking('${doc.id}')">Book</button>`;
                }

                const avatarImg = d.profilePic 
                    ? `<img src="${d.profilePic}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--secondary);">` 
                    : `<div style="width:40px; height:40px; background:#E5E7EB; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#6B7280; border:2px solid #E5E7EB;"><i class="fas fa-user-md"></i></div>`;

                list.innerHTML += `
                <div class="list-item" style="transition:0.3s;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        ${avatarImg}
                        <div>
                            <span style="font-weight:600; font-size:1rem;">Dr. ${d.name}</span>
                            <div style="font-size:0.8rem; color:var(--gray);">${d.specialist || 'General'}</div>
                        </div>
                    </div> 
                    ${actionArea}
                </div>`;
            });
            
            if(list.innerHTML === '') list.innerHTML = '<p>No doctors found.</p>';
        });
    }

    function openDoctorBooking(docId) {
        const container = document.getElementById('docList'); // We replace the list content
        container.innerHTML = '<div style="text-align:center; padding:20px;">Loading Profile...</div>';

        db.collection('users').doc(docId).get().then(doc => {
            if(!doc.exists) { container.innerHTML = 'Error: Doctor not found'; return; }
            const d = doc.data();

            const avatarImg = d.profilePic 
                ? `<img src="${d.profilePic}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:4px solid var(--secondary); margin-bottom:15px;">` 
                : `<div style="width:100px; height:100px; background:#E5E7EB; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#6B7280; margin:0 auto 15px auto; font-size:2rem;"><i class="fas fa-user-md"></i></div>`;

            // HTML for the Booking View
            container.innerHTML = `
                <div style="animation:fadeIn 0.4s;">
                    <button onclick="openFindDoctorModal()" style="background:none; border:none; color:var(--gray); cursor:pointer; margin-bottom:15px; display:flex; align-items:center; gap:5px;"><i class="fas fa-arrow-left"></i> Back to List</button>
                    
                    <div style="text-align:center; margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid #E5E7EB;">
                        ${avatarImg}
                        <h2 style="font-size:1.5rem; margin-bottom:5px;">Dr. ${d.name}</h2>
                        <p style="color:var(--primary); font-weight:600;">${d.specialist || 'Medical Specialist'}</p>
                        <p style="color:var(--gray); font-size:0.9rem; margin-top:5px;">${d.degrees || ''}</p>
                        ${d.address ? `<p style="color:var(--gray); font-size:0.9rem; margin-top:5px;"><i class="fas fa-map-marker-alt"></i> ${d.address}</p>` : ''}
                    </div>

                    <div style="background:#F9FAFB; padding:20px; border-radius:12px; border:1px solid #E5E7EB;">
                        
                        <div style="margin-bottom:20px;">
                            <label style="display:block; font-weight:600; margin-bottom:8px; color:var(--dark);">Select Appointment Time</label>
                            <div style="background:white; border:1px solid #E5E7EB; padding:10px; border-radius:8px; font-size:0.9rem; color:var(--gray); margin-bottom:10px;">
                                <i class="far fa-clock"></i> Doctor's Usual Hours: <span style="color:var(--dark); font-weight:500;">${d.time || 'Not specified'}</span>
                            </div>
                            <input type="text" id="bookingTime" placeholder="e.g. Tomorrow at 10:00 AM" style="width:100%; padding:12px; border:1px solid #E5E7EB; border-radius:8px; outline:none;">
                        </div>

                        <div style="margin-bottom:25px;">
                            <label style="display:block; font-weight:600; margin-bottom:12px; color:var(--dark);">Medical Records</label>
                            
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; margin-bottom:10px; padding:10px; background:white; border:1px solid #E5E7EB; border-radius:8px; transition:0.2s;">
                                <input type="radio" name="docShare" value="true" checked onchange="highlightOption(this)">
                                <div>
                                    <span style="display:block; font-weight:500;">Let Doctor see my Documents</span>
                                    <span style="display:block; font-size:0.8rem; color:var(--gray);">Allow access to previous reports for better diagnosis (Recommended)</span>
                                </div>
                            </label>

                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:10px; background:white; border:1px solid #E5E7EB; border-radius:8px;">
                                <input type="radio" name="docShare" value="false" onchange="highlightOption(this)">
                                <div>
                                    <span style="display:block; font-weight:500;">Don't Share Documents</span>
                                    <span style="display:block; font-size:0.8rem; color:var(--gray);">Keep my history private</span>
                                </div>
                            </label>
                        </div>

                        <button class="list-btn btn-book" style="width:100%; padding:15px; font-size:1rem;" onclick="confirmBooking('${doc.id}', '${d.name}')">
                            Confirm Booking
                        </button>
                    </div>
                </div>
            `;
        });
    }

    // Helper for visual selection
    function highlightOption(radio) {
        document.getElementsByName('docShare').forEach(el => {
            el.closest('label').style.borderColor = '#E5E7EB';
            el.closest('label').style.background = 'white';
        });
        if(radio.checked) {
            radio.closest('label').style.borderColor = 'var(--primary)';
            radio.closest('label').style.background = '#FEF2F2';
        }
    }
    
    // Updated Booking Logic
    function confirmBooking(docId, docName) {
        const timePref = document.getElementById('bookingTime').value;
        const shareDocs = document.querySelector('input[name="docShare"]:checked').value === 'true';

        if(!timePref) { showToast("Please enter a preferred time"); return; }
        // [Task C] Removed Confirm Alert - Direct Action
        
        db.collection('appointments').add({
            patientId: currentUserData.uid, 
            patientName: currentUserData.name,
            doctorId: docId, 
            doctorName: docName, 
            status: 'pending', 
            requestDate: new Date().toISOString(),
            preferredTime: timePref, 
            shareDocuments: shareDocs 
        }).then(() => { 
            showToast("Request Sent Successfully!"); 
            closeModal(); 
        }).catch(err => {
            console.error(err);
            showToast("Error booking appointment");
        });
    }

    function cancelPatientRequest(aptId) {
        // [Task C] Removed Confirm Alert - Direct Action
        db.collection('appointments').doc(aptId).delete().then(() => {
            showToast("Request Cancelled");
            openFindDoctorModal(); 
        }).catch(error => {
            console.error("Error:", error);
            showToast("Could not cancel.");
        });
    }
    
    // Also update bookApt if used elsewhere
    function bookApt(docId, docName) {
        // [Task C] Removed Confirm Alert
        db.collection('appointments').add({
            patientId: currentUserData.uid, patientName: currentUserData.name,
            doctorId: docId, doctorName: docName, status: 'pending', requestDate: new Date().toISOString()
        }).then(() => { showToast("Request Sent!"); closeModal(); });
    }

    function openPatientSchedule() {
        modalContent.innerHTML = `<h2>My Schedule</h2><div id="schedList">Loading...</div>`;
        modal.classList.add('active');
        
        db.collection('appointments').where('patientId', '==', currentUserData.uid).get().then(snap => {
            const l = document.getElementById('schedList'); l.innerHTML = '';
            
            if(snap.empty) { l.innerHTML = '<p>No appointments.</p>'; return; }
            
            let apps = []; 
            snap.forEach(doc => apps.push({ ...doc.data(), id: doc.id }));
            
            // Sort client side for simplicity
            apps.sort((a,b) => new Date(b.requestDate) - new Date(a.requestDate));
            
            apps.forEach(d => {
                let statusBadge = '';
                let actionPanel = '';

                // 1. Badge Logic
                if (d.status === 'accepted') statusBadge = `<span style="color:green; font-weight:600;">Booked: ${d.scheduledTime||'TBA'}</span>`;
                else if (d.status === 'pending') statusBadge = '<span style="color:orange; font-weight:600;">Request Pending</span>';
                else statusBadge = '<span style="color:red; font-weight:600;">Declined</span>';

                // 2. Access Request Logic (Feature B)
                if (d.status === 'accepted' && d.accessRequest === 'pending') {
                    actionPanel = `
                        <div style="background:#FEF2F2; border:1px solid #FCA5A5; padding:10px; border-radius:8px; margin-top:10px;">
                            <p style="font-size:0.85rem; color:#B91C1C; margin-bottom:8px;"><i class="fas fa-exclamation-circle"></i> Dr. ${d.doctorName} requests access to your medical records.</p>
                            <div style="display:flex; gap:10px;">
                                <button class="list-btn btn-book" onclick="respondToAccess('${d.id}', true)">Allow Access</button>
                                <button class="list-btn" style="background:#9CA3AF; color:white;" onclick="respondToAccess('${d.id}', false)">Deny</button>
                            </div>
                        </div>
                    `;
                } else if (d.status === 'accepted' && d.shareDocuments === true) {
                     actionPanel = `<div style="margin-top:5px; font-size:0.8rem; color:green;"><i class="fas fa-check-circle"></i> Records shared with doctor</div>`;
                }

                l.innerHTML += `
                    <div class="list-item" style="display:block; padding:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:start;">
                            <div>
                                <strong style="font-size:1.1rem;">Dr. ${d.doctorName}</strong>
                                <br>${statusBadge}
                            </div>
                            <small style="color:var(--gray);">${new Date(d.requestDate).toLocaleDateString()}</small>
                        </div>
                        ${actionPanel}
                    </div>`;
            });
        });
    }

    // Add this helper function immediately after
    function respondToAccess(aptId, allow) {
        const updateData = { accessRequest: 'resolved' };
        if(allow) updateData.shareDocuments = true;
        
        db.collection('appointments').doc(aptId).update(updateData).then(() => {
            showToast(allow ? "Access Granted" : "Request Denied");
            openPatientSchedule(); // Refresh list
        });
    }

    

    function loadCommunityFeed(container) {
        // 1. Set up the Create Post UI and Feed Container
        container.innerHTML = `
            <div class="create-post-card">
                <div class="cp-input-area">
                    <textarea id="newPostText" placeholder="Share your health journey or ask a question..."></textarea>
                </div>
                <div style="text-align:right; margin-top:10px;">
                    <button class="list-btn btn-book" onclick="publishPost()">Post</button>
                </div>
            </div>
            <div id="postsFeed">Loading posts...</div>
        `;

        // 2. Listen to Real-time Updates from Firestore
        db.collection('posts').orderBy('timestamp', 'desc').onSnapshot(snap => {
            const feed = document.getElementById('postsFeed');
            // Check if element still exists (user might have switched tabs)
            if(!feed) return; 
            
            feed.innerHTML = '';
            
            if(snap.empty) { feed.innerHTML = '<p style="text-align:center; color:gray;">No posts yet. Be the first!</p>'; return; }

            snap.forEach(doc => {
                const p = doc.data();
                const isLiked = p.likes && p.likes.includes(currentUserData.uid);
                
                // Prepare Comments HTML
                let commentsHtml = '';
                if(p.comments && p.comments.length > 0) {
                    p.comments.forEach(c => {
                        const roleClass = c.role === 'doctor' ? 'role-doctor' : 'role-patient';
                        commentsHtml += `
                        <div style="margin-bottom:8px; font-size:0.9rem; border-bottom:1px solid #eee; padding-bottom:5px;">
                            <strong>${c.author}</strong> <span class="role-badge ${roleClass}">${c.role}</span>: 
                            <span style="color:#374151">${c.text}</span>
                        </div>`;
                    });
                }

                // Render Post Card
                feed.innerHTML += `
                    <div class="post-card">
                        <div class="post-header">
                            <div>
                                <strong>${p.authorName}</strong> 
                                <span class="role-badge ${p.authorRole==='doctor'?'role-doctor':'role-patient'}">${p.authorRole}</span>
                            </div>
                            <small style="color:gray">${p.timestamp ? new Date(p.timestamp.toDate()).toLocaleDateString() : 'Just now'}</small>
                        </div>
                        <div class="post-content" style="margin-bottom:10px; line-height:1.6;">${p.text}</div>
                        
                        <div class="interaction-bar">
                            <button class="action-btn ${isLiked?'liked':''}" onclick="toggleLike('${doc.id}', ${isLiked})">
                                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${p.likes ? p.likes.length : 0}
                            </button>
                            <button class="action-btn" onclick="document.getElementById('c-sec-${doc.id}').classList.toggle('open')">
                                <i class="far fa-comment"></i> ${p.comments ? p.comments.length : 0} Comments
                            </button>
                        </div>

                        <div class="comments-section" id="c-sec-${doc.id}">
                            <div class="comment-input-box">
                                <input type="text" id="i-${doc.id}" placeholder="Write a comment...">
                                <button class="list-btn btn-view" onclick="sendComment('${doc.id}')">Send</button>
                            </div>
                            <div style="max-height:200px; overflow-y:auto;">${commentsHtml}</div>
                        </div>
                    </div>
                `;
            });
        });
    }

    function publishPost() {
        const txt = document.getElementById('newPostText').value;
        if(!txt.trim()) { showToast("Post cannot be empty"); return; }
        
        db.collection('posts').add({
            text: txt,
            authorName: currentUserData.name,
            authorRole: currentUserData.role, // 'patient'
            authorId: currentUserData.uid,
            likes: [],
            comments: [],
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            document.getElementById('newPostText').value = '';
            showToast("Posted successfully!");
        }).catch(err => {
            console.error(err);
            showToast("Error posting.");
        });
    }

    // --- SHARED UTILS ---
    function viewFile(data) { const win = window.open(); win.document.write(`<iframe src="${data}" style="width:100%;height:100%;border:none;"></iframe>`); }
    function closeModal() { modal.classList.remove('active'); }
    function showToast(msg) { const b = document.getElementById('toast-box'); document.getElementById('toast-msg').innerText = msg; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000); }
    function logout() { localStorage.clear(); window.location.href = 'index.html'; }


    
    function toggleLike(pid, liked) { db.collection('posts').doc(pid).update({ likes: liked ? firebase.firestore.FieldValue.arrayRemove(currentUserData.uid) : firebase.firestore.FieldValue.arrayUnion(currentUserData.uid) }); }
    function sendComment(pid) {
        const t = document.getElementById('i-'+pid).value; if(!t) return;
        db.collection('posts').doc(pid).update({ comments: firebase.firestore.FieldValue.arrayUnion({ text: t, author: currentUserData.name, role: 'patient' }) });
    }
