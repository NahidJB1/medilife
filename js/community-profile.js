let targetProfileUid = new URLSearchParams(window.location.search).get('uid');

window.onload = () => {
    if (!localStorage.getItem('isLoggedIn')) { window.location.href = 'login.html'; return; }
    currentUser = { 
        name: localStorage.getItem('userName'), 
        role: localStorage.getItem('userRole'), 
        uid: localStorage.getItem('userUid') 
    };

    if(!targetProfileUid) targetProfileUid = currentUser.uid;

    loadProfileData();
    loadProfileFeed('wall'); // Default to wall
};

async function loadProfileData() {
    try {
        const res = await fetch(`${API_URL}?action=get_profile&targetUid=${targetProfileUid}&reqUid=${currentUser.uid}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            const p = data.profile;
            document.getElementById('profileName').innerText = p.name;
            
            // Sync Avatar logic
            if (p.profile_pic) {
                document.getElementById('profileDisplayPic').src = p.profile_pic;
                document.getElementById('profileDisplayPic').style.display = 'block';
                document.getElementById('profileDefaultIcon').style.display = 'none';
            }

            const roleBadge = document.getElementById('profileRole');
            roleBadge.innerText = p.role.charAt(0).toUpperCase() + p.role.slice(1);
            roleBadge.className = `role-badge role-${p.role}`;

            // Hide Answers tab if target user is not a doctor
            if (p.role !== 'doctor') document.getElementById('tabAnswers').style.display = 'none';
            
            document.getElementById('followerCount').innerHTML = `<span style="color:var(--dark); font-weight:600;">${p.followers_count || 0}</span> Followers`;
            document.getElementById('followingCount').innerHTML = `<span style="color:var(--dark); font-weight:600;">${p.following_count || 0}</span> Following`;
            
            document.getElementById('profileBio').innerText = p.bio || 'This user has not written a bio yet.';
            
            // Build Personal Details
            let metaHtml = '';
            if(p.profession) metaHtml += `<div class="cred-item"><i class="fas fa-briefcase"></i> <div>Works as <strong>${p.profession}</strong></div></div>`;
            if(p.education) metaHtml += `<div class="cred-item"><i class="fas fa-graduation-cap"></i> <div>Studied at <strong>${p.education}</strong></div></div>`;
            if(p.location) metaHtml += `<div class="cred-item"><i class="fas fa-map-marker-alt"></i> <div>Lives in <strong>${p.location}</strong></div></div>`;
            if(p.languages) metaHtml += `<div class="cred-item"><i class="fas fa-language"></i> <div>Speaks <strong>${p.languages}</strong></div></div>`;
            
            // Joined Date Formatting
            const joinDate = new Date(p.joined_date);
            const formattedDate = joinDate.toLocaleString('default', { month: 'long', year: 'numeric' });
            metaHtml += `<div class="cred-item"><i class="far fa-calendar-alt"></i> <div>Joined <strong>${formattedDate}</strong></div></div>`;

            document.getElementById('profileMetaGrid').innerHTML = metaHtml;
            
            // Build Socials
            let socialHtml = '';
            const links = JSON.parse(p.social_links || '{}');
            if(links.fb) socialHtml += `<div class="cred-item"><i class="fab fa-facebook" style="color:#1877F2"></i> <a href="${links.fb}" target="_blank">Facebook Profile</a></div>`;
            if(links.insta) socialHtml += `<div class="cred-item"><i class="fab fa-instagram" style="color:#E4405F"></i> <a href="${links.insta}" target="_blank">Instagram Profile</a></div>`;
            if(links.x) socialHtml += `<div class="cred-item"><i class="fab fa-x-twitter" style="color:#000"></i> <a href="${links.x}" target="_blank">X (Twitter) Profile</a></div>`;
            if(links.yt) socialHtml += `<div class="cred-item"><i class="fab fa-youtube" style="color:#FF0000"></i> <a href="${links.yt}" target="_blank">YouTube Channel</a></div>`;
            
            if (socialHtml === '') socialHtml = '<div style="color:var(--gray); font-size:0.85rem;">No social links connected.</div>';
            document.getElementById('profileSocialLinks').innerHTML = socialHtml;

            // Setup Owner Controls
            if (targetProfileUid === currentUser.uid) {
                document.getElementById('editCredBtn').style.display = 'block';
                document.getElementById('avatarOverlay').style.display = 'flex'; // Show camera icon
                populateEditForm(p, links, JSON.parse(p.privacy_settings || '{}'));
            }
        }
    } catch (e) { showToast('Error loading profile'); }
}

// --- AVATAR UPLOAD SYNC ---
async function uploadAvatar(input) {
    if (!input.files[0]) return;
    const fd = new FormData();
    fd.append('action', 'update_profile'); // Hits users.php to sync across app
    fd.append('uid', currentUser.uid);
    fd.append('profile_pic', input.files[0]);

    showToast('Uploading photo...');
    try {
        const res = await fetch('api/users.php', { method: 'POST', body: fd });
        const data = await res.json();
        if(data.status === 'success') {
            showToast('Profile photo updated!');
            loadProfileData(); // Reloads the new image
        } else showToast('Error uploading photo');
    } catch (e) { showToast('Network error'); }
}

// --- TAB SWITCHING & FEED RENDERING ---
function switchProfileTab(tabType, element) {
    document.querySelectorAll('.p-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    
    if (tabType === 'answers') loadUserAnswers();
    else loadProfileFeed(tabType); // 'wall' or 'shared'
}

async function loadProfileFeed(type) {
    const feed = document.getElementById('feedContainer');
    feed.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const res = await fetch(`${API_URL}?action=get_feed&uid=${currentUser.uid}&profileUid=${targetProfileUid}&postType=${type}&limit=20&offset=0`);
        const posts = await res.json();
        feed.innerHTML = '';
        if(posts.length === 0) {
            feed.innerHTML = `<div style="text-align:center; color:var(--gray); padding: 40px; border:1px solid #E5E7EB; border-radius:12px; background:white;">No activity found in this tab.</div>`;
            return;
        }
        posts.forEach(post => feed.appendChild(createPostElement(post))); 
    } catch(e) { feed.innerHTML = `<div style="color:red; text-align:center;">Failed to load posts</div>`; }
}

async function loadUserAnswers() {
    const feed = document.getElementById('feedContainer');
    feed.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading answers...</div>';
    try {
        const res = await fetch(`${API_URL}?action=get_user_answers&uid=${targetProfileUid}`);
        const answers = await res.json();
        feed.innerHTML = '';
        if(answers.length === 0) {
            feed.innerHTML = `<div style="text-align:center; color:var(--gray); padding: 40px; border:1px solid #E5E7EB; border-radius:12px; background:white;">No answers provided yet.</div>`;
            return;
        }
        answers.forEach(ans => {
            feed.innerHTML += `
                <div class="post-card" style="margin-bottom: 15px;">
                    <div style="font-size:0.85rem; color:var(--gray); margin-bottom:10px;">Answered a question:</div>
                    <div style="background:#F9FAFB; padding:10px; border-left:3px solid #E5E7EB; margin-bottom:15px;">
                        ${ans.post_title ? `<strong>${ans.post_title}</strong><br>` : ''}
                        <span style="color:#4B5563;">${ans.post_content.substring(0, 100)}...</span>
                    </div>
                    <div style="display:flex; gap:10px; align-items:start;">
                        <i class="fas fa-user-md" style="color:#16A34A; margin-top:3px;"></i>
                        <div><strong>Dr. ${document.getElementById('profileName').innerText}</strong><br><span style="color:#374151;">${ans.answer_content}</span></div>
                    </div>
                </div>`;
        });
    } catch(e) { feed.innerHTML = `<div style="color:red; text-align:center;">Failed to load answers</div>`; }
}

// --- FOLLOWERS MODAL ---
async function openFollowList(type) {
    document.getElementById('followModalTitle').innerText = type.charAt(0).toUpperCase() + type.slice(1);
    document.getElementById('followListModal').classList.add('active');
    const container = document.getElementById('followListContainer');
    container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const res = await fetch(`${API_URL}?action=get_follow_list&uid=${targetProfileUid}&type=${type}`);
        const users = await res.json();
        if(users.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--gray); padding:20px;">No users found.</div>`;
            return;
        }
        container.innerHTML = users.map(u => `
            <div style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #F3F4F6; cursor:pointer;" onclick="window.location.href='community-profile.html?uid=${u.uid}'">
                <div style="width:40px; height:40px; border-radius:50%; background:#E5E7EB; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                    ${u.profile_pic ? `<img src="${u.profile_pic}" style="width:100%; height:100%; object-fit:cover;">` : '<i class="fas fa-user" style="color:#9CA3AF;"></i>'}
                </div>
                <div>
                    <div style="font-weight:600; font-size:0.95rem; color:var(--dark);">${u.name}</div>
                    <div style="font-size:0.75rem; color:var(--gray); text-transform:capitalize;">${u.role}</div>
                </div>
            </div>`).join('');
    } catch (e) { container.innerHTML = 'Error loading list.'; }
}

function closeFollowModal(e) {
    if (e && e.target !== document.getElementById('followListModal')) return;
    document.getElementById('followListModal').classList.remove('active');
}

// --- EDIT PROFILE LOGIC ---
function openEditModal() { document.getElementById('editProfileModal').classList.add('active'); }
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
    document.getElementById('privSocial').value = priv.social_links || 'public';
}

async function saveProfile() {
    const links = { fb: document.getElementById('editFb').value.trim(), insta: document.getElementById('editInsta').value.trim(), x: document.getElementById('editX').value.trim(), yt: document.getElementById('editYt').value.trim() };
    const priv = { location: document.getElementById('privLocation').value, education: document.getElementById('privEducation').value, profession: document.getElementById('privProfession').value, social_links: document.getElementById('privSocial').value };

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
        if(data.status === 'success') { closeEditModal(); showToast('Profile updated!'); loadProfileData(); }
    } catch(e) { showToast('Network Error'); }
}
