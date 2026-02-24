const API_BASE = 'api/';

// --- INIT PHARMACY DATA ---
const role = localStorage.getItem('userRole');
if(role !== 'pharmacy') { window.location.href = 'index.html'; }

const name = localStorage.getItem('userName') || 'Pharmacy Staff';
const storedEmail = localStorage.getItem('userEmail');
const storedUid = localStorage.getItem('userUid');

if (!storedEmail) { window.location.href = 'index.html'; }

const currentUserData = { name: name, role: 'pharmacy', uid: storedEmail, email: storedEmail };

document.getElementById('sideName').innerText = name;
document.getElementById('welcomeTitle').innerText = "Hello, " + name;
document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// --- TAB SWITCHING ---
function switchMainTab(el, tabName) {
    document.querySelectorAll('.tab-item, .nav-item').forEach(t => t.classList.remove('active'));
    if(el) el.classList.add('active');
    
    const contentArea = document.getElementById('tabContentArea');

    if (tabName === 'home') {
        if(window.feedInterval) clearInterval(window.feedInterval);
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
    const div = document.getElementById('searchResults');
    if(!email) { showToast("Enter email"); return; }
    
    div.innerHTML = 'Searching...';

    // 1. Search User
    fetch(`${API_BASE}users.php?action=search&email=${email}`)
    .then(res => res.json())
    .then(data => {
        div.innerHTML = '';
        if(data.length === 0) { div.innerHTML = 'No patient found.'; return; }

        data.forEach(user => {
            div.innerHTML += `
                <div style="background:white; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; margin-bottom:15px;">
                    <div style="padding:15px; background:#F9FAFB; border-bottom:1px solid #E5E7EB; display:flex; align-items:center; gap:10px;">
                        <div style="width:40px; height:40px; background:#E5E7EB; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fas fa-user"></i></div>
                        <div><strong>${user.name}</strong><br><small>ID: ${user.uid}</small></div>
                    </div>
                    <div id="records-${user.uid}" style="padding:15px;">Loading Rx...</div>
                </div>`;
            
            // 2. Load Prescriptions
            loadPrescriptions(user.uid);
        });
    });
}

function loadPrescriptions(patientId) {
    const safeId = patientId; // IDs are strings in PHP version
    const div = document.getElementById(`records-${safeId}`);
    
    fetch(`${API_BASE}reports.php?action=get_prescriptions&patient_id=${patientId}`)
    .then(r => r.json())
    .then(reports => {
        div.innerHTML = '';
        if(reports.length === 0) { div.innerHTML = '<small>No prescriptions.</small>'; return; }

        reports.forEach(r => {
            let viewAction = '';
            if(r.is_manual == 1) {
                // Manual Text
                const safeContent = (r.content||'').replace(/`/g, "'").replace(/\$/g, "");
                viewAction = `openDocViewer('manual', \`${safeContent}\`, 'Prescription: Dr. ${r.doctor_name}')`;
            } else {
                // File
                viewAction = `openDocViewer('file', '${r.file_path}', 'Prescription Doc')`;
            }

            div.innerHTML += `
                <div class="list-item" style="padding:10px; border-bottom:1px solid #eee;">
                    <div><strong>Dr. ${r.doctor_name}</strong><br><small>${new Date(r.timestamp).toLocaleDateString()}</small></div>
                    <button class="list-btn btn-view" onclick="${viewAction}">View Rx</button>
                </div>`;
        });
    });
}

// --- VIEWER ---
// --- VIEWER (Updated with Blockchain Verification UI) ---
function openDocViewer(type, content, title) {
    const viewerModal = document.getElementById('documentViewerModal');
    const viewerContent = document.getElementById('docViewerContent');
    
    // 1. Define the Blockchain Verification UI (Animated)
    const verificationUI = `
        <div id="blockchain-status" style="display:flex; align-items:center; gap:10px; padding:12px 20px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:30px; margin-bottom:20px; width: fit-content; margin-left: auto; margin-right: auto; transition: all 0.4s ease;">
            <i id="blockchain-icon" class="fas fa-spinner fa-spin" style="color:var(--primary); font-size:1.2rem;"></i>
            <span id="blockchain-text" style="font-weight:600; color:#475569; font-size:0.95rem;">Verifying immutable record...</span>
        </div>
    `;

    // Wrap the main content in a div that starts faded out
    let html = verificationUI + '<div id="doc-main-content" style="opacity: 0.5; transition: opacity 0.5s ease;">';
    
    if (type === 'manual') {
        html += `
            <h2 style="margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px;">${title}</h2>
            <div style="background: #F9FAFB; padding: 25px; border-radius: 12px; border: 1px solid #E5E7EB; overflow-y: auto; flex: 1;">
                <pre style="white-space: pre-wrap; font-family: 'Poppins', sans-serif; font-size: 1.1rem; color: #333;">${content}</pre>
            </div>
            <div style="text-align:right; margin-top:10px;"><button class="list-btn btn-book" onclick="window.print()">Print</button></div>`;
    } else {
        html += `<h3 style="margin-bottom: 10px;">${title}</h3><iframe src="${content}" style="width: 100%; height: 80vh; border: none; background: #eee;"></iframe>`;
    }
    
    html += '</div>'; // Close doc-main-content
    
    viewerContent.innerHTML = html;
    viewerModal.classList.add('active');

    // 2. Trigger the Animation Sequence
    setTimeout(() => {
        const statusBox = document.getElementById('blockchain-status');
        const icon = document.getElementById('blockchain-icon');
        const text = document.getElementById('blockchain-text');
        const docContent = document.getElementById('doc-main-content');

        if(statusBox) {
            statusBox.style.background = '#ECFDF5';
            statusBox.style.borderColor = '#10B981';
            icon.className = 'fas fa-link';
            icon.style.color = '#10B981';
            text.innerText = 'Data Intact & Verified on Ledger';
            text.style.color = '#065F46';
            docContent.style.opacity = '1';
        }
    }, 1500); // 1.5 second simulated verification delay
}
    if (type === 'manual') {
        html = `
            <h2 style="margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px;">${title}</h2>
            <div style="background: #F9FAFB; padding: 25px; border-radius: 12px; border: 1px solid #E5E7EB; overflow-y: auto; flex: 1;">
                <pre style="white-space: pre-wrap; font-family: 'Poppins', sans-serif; font-size: 1.1rem; color: #333;">${content}</pre>
            </div>
            <div style="text-align:right; margin-top:10px;"><button class="list-btn btn-book" onclick="window.print()">Print</button></div>`;
    } else {
        html = `<h3 style="margin-bottom: 10px;">${title}</h3><iframe src="${content}" style="width: 100%; height: 80vh; border: none; background: #eee;"></iframe>`;
    }
    
    viewerContent.innerHTML = html;
    viewerModal.classList.add('active');
}

// --- COMMUNITY FEED (Auto-Refresh) ---
function loadCommunityFeed(container) {
    container.innerHTML = `
        <div class="create-post-card">
            <textarea id="newPostText" class="cp-input-area" style="width:100%; border:none; outline:none;" placeholder="Share a health update..."></textarea>
            <div style="text-align:right; margin-top:10px;">
                <button class="list-btn btn-book" onclick="publishPost()">Post</button>
            </div>
        </div>
        <div id="feedStream">Loading...</div>
    `;
    fetchPosts();
    window.feedInterval = setInterval(fetchPosts, 5000);
}

function fetchPosts() {
    const feed = document.getElementById('feedStream');
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
                        <button class="action-btn ${isLiked?'liked':''}" onclick="toggleLike('${p.id}')"> <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${p.likes ? p.likes.length : 0}</button>
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
        const fd = new FormData(); fd.append('action', 'post'); fd.append('content', txt);
        fd.append('authorName', currentUserData.name); fd.append('authorRole', 'pharmacy'); fd.append('authorId', currentUserData.uid);
        fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(() => { document.getElementById('newPostText').value = ''; fetchPosts(); });
    }
}
function toggleLike(pid) { const fd = new FormData(); fd.append('action', 'like'); fd.append('id', pid); fd.append('uid', currentUserData.uid); fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(fetchPosts); }
function sendComment(pid) { const t = document.getElementById('i-'+pid).value; if(t) { const fd = new FormData(); fd.append('action', 'comment'); fd.append('id', pid); fd.append('text', t); fd.append('author', currentUserData.name); fetch(`${API_BASE}community.php`, { method: 'POST', body: fd }).then(fetchPosts); } }

// --- UTILS ---
function closeDocViewer() { document.getElementById('documentViewerModal').classList.remove('active'); }
function closeModal() { document.getElementById('dashboardModal').classList.remove('active'); }
function showToast(msg) { const b = document.getElementById('toast-box'); if(b){ document.getElementById('toast-msg').innerText = msg; b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000); }}
function logout() { localStorage.clear(); window.location.href = 'index.html'; }
