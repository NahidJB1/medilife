    const db = firebase.firestore();
    const auth = firebase.auth();
    const modal = document.getElementById('dashboardModal');
    const modalContent = document.getElementById('modalContent');

    // --- INIT PHARMACY DATA ---
    const role = localStorage.getItem('userRole');
    if(role !== 'pharmacy') { window.location.href = 'index.html'; } // Security Check

    const name = localStorage.getItem('userName') || 'Pharmacy Staff';
    let storedEmail = localStorage.getItem('userEmail');
    let stableId = storedEmail ? storedEmail.replace(/[.#$[\]]/g, '_') : localStorage.getItem('userUid');

    const currentUserData = { name: name, role: 'pharmacy', uid: stableId, email: storedEmail };

    document.getElementById('sideName').innerText = name;
    document.getElementById('welcomeTitle').innerText = "Hello, " + name;
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
            contentArea.innerHTML = `
            <div class="action-section">
                <div class="section-title">Quick Actions</div>
                <div class="quick-actions">
                    <div class="action-card" onclick="openPatientSearch()"><i class="fas fa-search"></i><h4>Search Patient</h4><p>View Prescriptions</p></div>
                </div>
            </div>`;
        } else if (tabName === 'community') {
            loadCommunityFeed(contentArea);
        }
    }

    // --- PHARMACY FUNCTIONS ---
    function openPatientSearch() {
        modalContent.innerHTML = `
            <h2 style="text-align:center;">Patient Lookup</h2>
            <div class="modern-search-bar"><i class="fas fa-search search-icon"></i>
            <input type="text" id="sInput" class="search-input-field" placeholder="Enter Patient Email..."><button class="search-btn-modern" onclick="performSearch()">Search</button></div>
            <div id="searchResults" style="max-height:400px;overflow-y:auto"></div>`;
        modal.classList.add('active');
    }

    function performSearch() {
        const email = document.getElementById('sInput').value.trim();
        const div = document.getElementById('searchResults');
        if(!email) { showToast("Enter email"); return; }
        
        div.innerHTML = '<div style="text-align:center; padding:20px;">Searching patient...</div>';

        // 1. Find the User by Email
        db.collection('users').where('email', '==', email).get().then(userSnap => {
            div.innerHTML = '';
            
            if(userSnap.empty) { 
                div.innerHTML = '<p style="text-align:center; color:#EF4444;">No patient found.</p>'; 
                return; 
            }

            userSnap.forEach(userDoc => {
                const userData = userDoc.data();
                const patientId = userDoc.id;

                // Feature C: Show ONLY Name and limited info
                div.innerHTML += `
                    <div style="background:white; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; margin-bottom:15px;">
                        <div style="padding:15px; background:#F9FAFB; border-bottom:1px solid #E5E7EB; display:flex; align-items:center; gap:10px;">
                            <div style="width:40px; height:40px; background:#E5E7EB; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#6B7280;">
                                <i class="fas fa-user"></i>
                            </div>
                            <div>
                                <strong>${userData.name}</strong>
                                <div style="font-size:0.8rem; color:var(--gray);">Customer ID: ${patientId.substring(0,8)}...</div>
                            </div>
                        </div>
                        <div id="records-${patientId}" style="padding:15px;">
                            Loading prescriptions...
                        </div>
                    </div>`;

                // 2. Fetch ONLY Prescriptions
                db.collection('reports')
                    .where('patientId', '==', patientId)
                    .where('reportType', '==', 'Prescription') // Strict Filter
                    .orderBy('timestamp', 'desc')
                    .get()
                    .then(reportSnap => {
                        const recordDiv = document.getElementById(`records-${patientId}`);
                        recordDiv.innerHTML = '';

                        if(reportSnap.empty) {
                            recordDiv.innerHTML = '<small style="color:#6B7280; font-style:italic;">No prescriptions found.</small>';
                        } else {
                            // Inside performSearch -> reportSnap.forEach...
reportSnap.forEach(repDoc => {
    const r = repDoc.data();
    const date = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleDateString() : 'N/A';
    
    let viewAction = '';
    
    // UPDATED LOGIC
    if(r.isManual) {
        const safeContent = r.content.replace(/`/g, "'").replace(/\$/g, "");
        // Calls the new modal function
        viewAction = `openDocViewer('manual', \`${safeContent}\`, 'Prescription: Dr. ${r.doctorName}')`;
    } else {
        // Calls the new modal function
        viewAction = `openDocViewer('file', '${r.fileData}', 'Prescription Document')`;
    }

    recordDiv.innerHTML += `
        <div class="list-item" style="padding:10px;">
            <div>
                <strong>Prescribed by Dr. ${r.doctorName}</strong><br>
                <small style="color:#6B7280">${date}</small>
            </div>
            <button class="list-btn btn-view" onclick="${viewAction}">View Rx</button>
        </div>
    `;
});
                        }
                    })
                    .catch(err => {
                        console.log(err);
                        document.getElementById(`records-${patientId}`).innerHTML = '<small>No prescriptions found (or index missing).</small>';
                    });
            });
        });
    }

    function openDocViewer(type, content, title) {
    const viewerModal = document.getElementById('documentViewerModal');
    const viewerContent = document.getElementById('docViewerContent');
    
    let html = '';
    if (type === 'manual') {
        html = `
            <h2 style="margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px;">${title}</h2>
            <div style="background: #F9FAFB; padding: 25px; border-radius: 12px; border: 1px solid #E5E7EB; overflow-y: auto; flex: 1;">
                <pre style="white-space: pre-wrap; font-family: 'Poppins', sans-serif; font-size: 1.1rem; color: #333;">${content}</pre>
            </div>`;
    } else {
        html = `
            <h3 style="margin-bottom: 10px;">${title}</h3>
            <iframe src="${content}" style="width: 100%; flex: 1; border: none; background: #eee;"></iframe>`;
    }
    
    viewerContent.innerHTML = html;
    viewerModal.classList.add('active');
}

function closeDocViewer() {
    document.getElementById('documentViewerModal').classList.remove('active');
}

    // Add this helper for Pharmacy to view manual text prescriptions
    function viewManualRx(content, docName) {
        const win = window.open('', '_blank', 'width=600,height=600');
        win.document.write(`
            <html><head><title>Prescription</title>
            <style>body{font-family:sans-serif; padding:40px;}</style></head>
            <body>
                <h2 style="border-bottom:2px solid black; padding-bottom:10px;">Dr. ${docName}</h2>
                <pre style="white-space: pre-wrap; font-family: sans-serif; font-size:1.1rem; line-height:1.6; background:#f9f9f9; padding:20px;">${content}</pre>
                <div style="margin-top:50px; text-align:right;">Signed</div>
                <script>window.print();<\/script>
            </body></html>
        `);
    }

    // Helper for pharmacy view (ensure this exists in your shared utils or paste it here too)
    function viewFile(data) { 
        const win = window.open(); 
        win.document.write(`<iframe src="${data}" style="width:100%;height:100%;border:none;"></iframe>`); 
    }

    // --- SHARED UTILS ---
    function closeModal() { modal.classList.remove('active'); }
    function showToast(msg) { const b = document.getElementById('toast-box'); document.getElementById('toast-msg').innerText = msg; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000); }
    function logout() { localStorage.clear(); window.location.href = 'index.html'; }
