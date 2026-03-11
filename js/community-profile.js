let targetProfileUid = new URLSearchParams(window.location.search).get('uid');
let currentTab = 'wall';

// C. Use DOMContentLoaded instead of window.onload for instant loading
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('isLoggedIn')) { window.location.href = 'login.html'; return; }
    currentUser = { 
        name: localStorage.getItem('userName'), 
        role: localStorage.getItem('userRole'), 
        uid: localStorage.getItem('userUid') 
    };

    if(!targetProfileUid) targetProfileUid = currentUser.uid;

    loadProfileData();
    loadProfileFeed('wall');
});

async function loadProfileData() {
    try {
        const res = await fetch(`${API_URL}?action=get_profile&targetUid=${targetProfileUid}&reqUid=${currentUser.uid}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            const p = data.profile;
            // D. Remove Skeleton loaders to stop layout shifting
            const nameEl = document.getElementById('profileName');
            nameEl.innerText = p.name;
            nameEl.classList.remove('skeleton-text');
            
            const roleBadge = document.getElementById('profileRole');
            roleBadge.innerText = p.role.charAt(0).toUpperCase() + p.role.slice(1);
            roleBadge.className = `role-badge role-${p.role}`;
            roleBadge.style.opacity = '1'; // D. Fade in badge
            
            // Show Answers tab only if doctor
            if (p.role === 'doctor') document.getElementById('tabAnswers').style.display = 'block';

            // Sync Avatar
            const imgEl = document.getElementById('profileImage');
            const iconEl = document.getElementById('profileIconPlaceholder');
            if (p.profile_pic) {
                imgEl.src = p.profile_pic;
                imgEl.style.display = 'block';
                iconEl.style.display = 'none';
            }
            
            // B. Fix missing Follow/Following text
            document.getElementById('followerCount').innerHTML = `<span>${p.followers_count || 0}</span> Followers`;
            document.getElementById('followingCount').innerHTML = `<span>${p.following_count || 0}</span> Following`;
            document.getElementById('profileBio').innerText = p.bio || 'This user has not written a bio yet.';
            
            // Build Personal Details Grid
            let metaHtml = '';
            if(p.profession) metaHtml += `<div class="cred-item"><i class="fas fa-briefcase"></i> <div>Works as <strong>${p.profession}</strong></div></div>`;
            if(p.education) metaHtml += `<div class="cred-item"><i class="fas fa-graduation-cap"></i> <div>Studied at <strong>${p.education}</strong></div></div>`;
            if(p.location) metaHtml += `<div class="cred-item"><i class="fas fa-map-marker-alt"></i> <div>Lives in <strong>${p.location}</strong></div></div>`;
            if(p.languages) metaHtml += `<div class="cred-item"><i class="fas fa-language"></i> <div>Knows <strong>${p.languages}</strong></div></div>`;
            if(p.join_month_year) metaHtml += `<div class="cred-item"><i class="fas fa-calendar-alt"></i> <div>Joined <strong>${p.join_month_year}</strong></div></div>`;
            
            document.getElementById('profileMetaGrid').innerHTML = metaHtml;
            
            // Build Socials Grid
            let socialHtml = '';
            const links = JSON.parse(p.social_links || '{}');
            if(links.fb) socialHtml += `<div class="cred-item"><i class="fab fa-facebook" style="color:#1877F2"></i> <a href="${links.fb}" target="_blank">Facebook Profile</a></div>`;
            if(links.insta) socialHtml += `<div class="cred-item"><i class="fab fa-instagram" style="color:#E4405F"></i> <a href="${links.insta}" target="_blank">Instagram Profile</a></div>`;
            if(links.x) socialHtml += `<div class="cred-item"><i class="fab fa-x-twitter" style="color:#000"></i> <a href="${links.x}" target="_blank">X (Twitter) Profile</a></div>`;
            if(links.yt) socialHtml += `<div class="cred-item"><i class="fab fa-youtube" style="color:#FF0000"></i> <a href="${links.yt}" target="_blank">YouTube Channel</a></div>`;
            
            if (socialHtml === '') socialHtml = '<div style="color:var(--gray); font-size:0.85rem;">No social links available.</div>';
            document.getElementById('profileSocialLinks').innerHTML = socialHtml;

            // Setup Owner Privileges
            if (targetProfileUid === currentUser.uid) {
                document.getElementById('editCredBtn').style.display = 'block';
                document.getElementById('avatarUploadBtn').style.display = 'flex';
                document.getElementById('profileBio').insertAdjacentHTML('beforeend', ` <button class="icon-btn" onclick="openEditModal()"><i class="fas fa-pen"></i></button>`);
                populateEditForm(p, links, JSON.parse(p.privacy_settings || '{}'));
            }
        }
    } catch (e) { showToast('Error loading profile'); }
}

// --- TABS LOGIC ---
function switchProfileTab(tab, element) {
    document.querySelectorAll('.p-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    currentTab = tab;
    
    if (tab === 'answers') loadProfileAnswers();
    else loadProfileFeed(tab);
}

async function loadProfileFeed(filterType) {
    const feed = document.getElementById('feedContainer');
    feed.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const res = await fetch(`${API_URL}?action=get_feed&uid=${currentUser.uid}&profileUid=${targetProfileUid}&filter=${filterType}&limit=20&offset=0`);
        const posts = await res.json();
        feed.innerHTML = '';
        if(posts.length === 0) {
            feed.innerHTML = `<div style="text-align:center; color:var(--gray); padding: 40px; border:1px solid #E5E7EB; border-radius:12px; background:white;">No ${filterType} posts yet.</div>`;
            return;
        }
        posts.forEach(post => feed.appendChild(createPostElement(post))); 
    } catch(e) { feed.innerHTML = `<div style="color:red; text-align:center;">Failed to load posts</div>`; }
}

async function loadProfileAnswers() {
    const feed = document.getElementById('feedContainer');
    feed.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading answers...</div>';
    try {
        const res = await fetch(`${API_URL}?action=get_user_answers&targetUid=${targetProfileUid}`);
        const answers = await res.json();
        feed.innerHTML = '';
        if(answers.length === 0) {
            feed.innerHTML = `<div style="text-align:center; color:var(--gray); padding: 40px; border:1px solid #E5E7EB; border-radius:12px; background:white;">No answers provided yet.</div>`;
            return;
        }
        
        answers.forEach(ans => {
            const div = document.createElement('div');
            div.className = 'post-card';
            div.innerHTML = `
                <div style="font-size: 0.85rem; color: var(--gray); margin-bottom: 8px;">Answered on a post: <strong>${ans.post_title || 'Question'}</strong></div>
                <div style="padding: 10px; background: #F9FAFB; border-left: 3px solid #E5E7EB; margin-bottom: 10px; font-style: italic; color: #6B7280;">"${ans.post_content}"</div>
                <div style="color: #16A34A; font-weight: 500;"><i class="fas fa-user-md"></i> Dr. Response:</div>
                <div style="margin-top: 5px;">${ans.content}</div>
                <div style="font-size: 0.75rem; color: var(--gray); margin-top: 10px;">${timeAgo(ans.created_at)}</div>
            `;
            feed.appendChild(div);
        });
    } catch(e) { feed.innerHTML = `<div style="color:red; text-align:center;">Failed to load answers</div>`; }
}

// --- FOLLOW LISTS LOGIC ---
async function openFollowModal(type) {
    document.getElementById('followModalTitle').innerText = type.charAt(0).toUpperCase() + type.slice(1);
    document.getElementById('followModal').classList.add('active');
    const container = document.getElementById('followListContainer');
    container.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const res = await fetch(`${API_URL}?action=get_follow_list&targetUid=${targetProfileUid}&type=${type}`);
        const users = await res.json();
        
        if (users.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--gray);">No users found.</div>';
            return;
        }
        
        container.innerHTML = users.map(u => {
            const imgHtml = u.profile_pic ? `<img src="${u.profile_pic}">` : `<div class="placeholder"><i class="fas fa-user"></i></div>`;
            return `<a href="community-profile.html?uid=${u.uid}" class="follow-user-item">
                ${imgHtml}<div><strong>${u.name}</strong><span>${u.role}</span></div>
            </a>`;
        }).join('');
    } catch (e) { container.innerHTML = '<div style="color:red; text-align:center;">Error loading list.</div>'; }
}

// --- IMAGE UPLOAD LOGIC ---
async function uploadProfilePicture(input) {
    if (!input.files || !input.files[0]) return;
    
    const fd = new FormData();
    fd.append('action', 'update_profile');
    fd.append('uid', currentUser.uid);
    fd.append('profile_pic', input.files[0]);

    showToast("Uploading image...");
    
    try {
        // Send to users.php to sync across the entire platform
        const res = await fetch(`api/users.php`, { method: 'POST', body: fd });
        const data = await res.json();
        
        if (data.status === 'success') {
            showToast("Profile picture updated!");
            // Read locally to display immediately without reloading
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('profileImage').src = e.target.result;
                document.getElementById('profileImage').style.display = 'block';
                document.getElementById('profileIconPlaceholder').style.display = 'none';
            }
            reader.readAsDataURL(input.files[0]);
        } else showToast("Error uploading image");
    } catch (e) { showToast("Network error"); }
}

// --- EDIT PROFILE LOGIC ---
function openEditModal() { 
    // A. Role-Based Fields Visibility
    const role = currentUser.role;
    const groupEdu = document.getElementById('groupEducation');
    const groupProf = document.getElementById('groupProfession');
    const labelProf = document.getElementById('labelProfession');

    if (role === 'patient') {
        // Patients don't need Medical Education or Work Experience
        groupEdu.style.display = 'none';
        groupProf.style.display = 'none';
    } else if (role === 'pharmacy') {
        // Pharmacy doesn't need Medical Education, but needs Business Info
        groupEdu.style.display = 'none';
        groupProf.style.display = 'flex';
        labelProf.innerHTML = '<i class="fas fa-store"></i> Business Info';
        document.getElementById('editProfession').placeholder = 'e.g. Retail Pharmacy';
    } else {
        // Doctors get everything
        groupEdu.style.display = 'flex';
        groupProf.style.display = 'flex';
        labelProf.innerHTML = '<i class="fas fa-briefcase"></i> Work Experience';
        document.getElementById('editProfession').placeholder = 'e.g. Cardiologist';
    }

    document.getElementById('editProfileModal').classList.add('active'); 
}
function closeEditModal() { document.getElementById('editProfileModal').classList.remove('active'); }

function populateEditForm(p, links, priv) {
    document.getElementById('editBio').value = p.bio || '';
    document.getElementById('editLocation').value = p.location || '';
    document.getElementById('editEducation').value = p.education || '';
    document.getElementById('editProfession').value = p.profession || '';
    document.getElementById('editLanguages').value = p.languages || '';
    
    document.getElementById('editFb').value = links.fb || '';
    document.getElementById('editInsta').value = links.insta || '';
    document.getElementById('editX').value = links.x || '';
    document.getElementById('editYt').value = links.yt || '';
    
    document.getElementById('privLocation').value = priv.location || 'public';
    document.getElementById('privEducation').value = priv.education || 'public';
    document.getElementById('privProfession').value = priv.profession || 'public';
    document.getElementById('privLanguages').value = priv.languages || 'public';
    document.getElementById('privSocial').value = priv.social_links || 'public';
}

async function saveProfile() {
    const links = {
        fb: document.getElementById('editFb').value.trim(),
        insta: document.getElementById('editInsta').value.trim(),
        x: document.getElementById('editX').value.trim(),
        yt: document.getElementById('editYt').value.trim()
    };
    const priv = {
        location: document.getElementById('privLocation').value,
        education: document.getElementById('privEducation').value,
        profession: document.getElementById('privProfession').value,
        languages: document.getElementById('privLanguages').value,
        social_links: document.getElementById('privSocial').value
    };

    const fd = new FormData();
    fd.append('action', 'update_profile');
    fd.append('uid', currentUser.uid);
    fd.append('bio', document.getElementById('editBio').value.trim());
    fd.append('location', document.getElementById('editLocation').value.trim());
    fd.append('education', document.getElementById('editEducation').value.trim());
    fd.append('profession', document.getElementById('editProfession').value.trim());
    fd.append('languages', document.getElementById('editLanguages').value.trim());
    fd.append('social_links', JSON.stringify(links));
    fd.append('privacy_settings', JSON.stringify(priv));

    try {
        const res = await fetch(API_URL, { method: 'POST', body: fd });
        const data = await res.json();
        if(data.status === 'success') {
            closeEditModal();
            showToast('Personal detail updated!');
            loadProfileData(); 
        } else showToast(data.message);
    } catch(e) { showToast('Network Error'); }
}
