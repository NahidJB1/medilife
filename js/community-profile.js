let targetProfileUid = new URLSearchParams(window.location.search).get('uid');

// Override init from community.js to prevent loading the main feed
window.onload = () => {
    if (!localStorage.getItem('isLoggedIn')) { window.location.href = 'login.html'; return; }
    currentUser = { 
        name: localStorage.getItem('userName'), 
        role: localStorage.getItem('userRole'), 
        uid: localStorage.getItem('userUid') 
    };

    if(!targetProfileUid) targetProfileUid = currentUser.uid;

    loadProfileData();
    loadProfileFeed();
};

async function loadProfileData() {
    try {
        const res = await fetch(`${API_URL}?action=get_profile&targetUid=${targetProfileUid}&reqUid=${currentUser.uid}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            const p = data.profile;
            document.getElementById('profileName').innerText = p.name;
            
            const roleBadge = document.getElementById('profileRole');
            roleBadge.innerText = p.role.charAt(0).toUpperCase() + p.role.slice(1);
            roleBadge.className = `role-badge role-${p.role}`;
            
            document.getElementById('profileBio').innerText = p.bio || '';
            
            // Build Meta Grid
            let metaHtml = '';
            if(p.location) metaHtml += `<div class="meta-item"><i class="fas fa-map-marker-alt"></i> ${p.location}</div>`;
            if(p.education) metaHtml += `<div class="meta-item"><i class="fas fa-graduation-cap"></i> ${p.education}</div>`;
            if(p.profession) metaHtml += `<div class="meta-item"><i class="fas fa-briefcase"></i> ${p.profession}</div>`;
            document.getElementById('profileMetaGrid').innerHTML = metaHtml;
            
            // Build Socials
            let socialHtml = '';
            const links = JSON.parse(p.social_links || '{}');
            if(links.fb) socialHtml += `<a href="${links.fb}" target="_blank"><i class="fab fa-facebook"></i></a>`;
            if(links.insta) socialHtml += `<a href="${links.insta}" target="_blank"><i class="fab fa-instagram"></i></a>`;
            if(links.x) socialHtml += `<a href="${links.x}" target="_blank"><i class="fab fa-x-twitter"></i></a>`;
            document.getElementById('profileSocialLinks').innerHTML = socialHtml;

            // Setup Edit Button if Owner
            if (targetProfileUid === currentUser.uid) {
                document.getElementById('profileActionsBox').innerHTML = `
                    <button class="btn-edit-profile" onclick="openEditModal()"><i class="fas fa-pen"></i> Edit Profile</button>
                `;
                populateEditForm(p, links, JSON.parse(p.privacy_settings || '{}'));
            }
        } else {
            document.getElementById('profileName').innerText = "User not found";
        }
    } catch (e) {
        showToast('Error loading profile');
    }
}

function openEditModal() {
    document.getElementById('editProfileModal').classList.add('active');
}
function closeEditModal() {
    document.getElementById('editProfileModal').classList.remove('active');
}

function populateEditForm(p, links, priv) {
    document.getElementById('editBio').value = p.bio || '';
    document.getElementById('editLocation').value = p.location || '';
    document.getElementById('editEducation').value = p.education || '';
    document.getElementById('editProfession').value = p.profession || '';
    
    document.getElementById('editFb').value = links.fb || '';
    document.getElementById('editInsta').value = links.insta || '';
    document.getElementById('editX').value = links.x || '';
    
    document.getElementById('privLocation').value = priv.location || 'public';
    document.getElementById('privEducation').value = priv.education || 'public';
    document.getElementById('privProfession').value = priv.profession || 'public';
    document.getElementById('privSocial').value = priv.social_links || 'public';
}

async function saveProfile() {
    const links = {
        fb: document.getElementById('editFb').value.trim(),
        insta: document.getElementById('editInsta').value.trim(),
        x: document.getElementById('editX').value.trim()
    };
    
    const priv = {
        location: document.getElementById('privLocation').value,
        education: document.getElementById('privEducation').value,
        profession: document.getElementById('privProfession').value,
        social_links: document.getElementById('privSocial').value
    };

    const formData = new FormData();
    formData.append('action', 'update_profile');
    formData.append('uid', currentUser.uid);
    formData.append('bio', document.getElementById('editBio').value.trim());
    formData.append('location', document.getElementById('editLocation').value.trim());
    formData.append('education', document.getElementById('editEducation').value.trim());
    formData.append('profession', document.getElementById('editProfession').value.trim());
    formData.append('social_links', JSON.stringify(links));
    formData.append('privacy_settings', JSON.stringify(priv));

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if(data.status === 'success') {
            closeEditModal();
            showToast('Profile updated!');
            loadProfileData(); // refresh UI
        } else showToast(data.message);
    } catch(e) { showToast('Network Error'); }
}

async function loadProfileFeed() {
    const feed = document.getElementById('feedContainer');
    try {
        const res = await fetch(`${API_URL}?action=get_feed&uid=${currentUser.uid}&profileUid=${targetProfileUid}&limit=20&offset=0`);
        const posts = await res.json();
        
        feed.innerHTML = '';
        if(posts.length === 0) {
            feed.innerHTML = `<div style="text-align:center; color:var(--gray); padding: 40px;">No posts to show yet.</div>`;
            return;
        }
        
        posts.forEach(post => feed.appendChild(createPostElement(post))); // Reusing logic from community.js
    } catch(e) {
        feed.innerHTML = `<div style="color:red; text-align:center;">Failed to load posts</div>`;
    }
}