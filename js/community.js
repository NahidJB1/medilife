// community.js
const API_URL = 'api/community.php'; // Adjust path if needed

let currentUser = null;
let currentPostType = 'question';
let currentSort = 'recent';
let feedOffset = 0;
let loading = false;
let hasMore = true;

document.addEventListener('DOMContentLoaded', () => {
    initCommunity();
});

function initCommunity() {
    const role = localStorage.getItem('userRole') || 'patient';
    const name = localStorage.getItem('userName') || 'User';
    const uid = localStorage.getItem('userUid');

    if (!localStorage.getItem('isLoggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = { name, role, uid };

    // Set logo link
    const logoLink = document.getElementById('navLogo');
    if (logoLink) {
        if (role === 'doctor') logoLink.href = 'doctor-dashboard.html';
        else if (role === 'pharmacy') logoLink.href = 'pharmacy-dashboard.html';
        else logoLink.href = 'patient-dashboard.html';
    }

    // Set Home & Profile icons dynamically
    const homeLink = document.querySelector('.nav-links a[title="Dashboard"]');
    if (homeLink) {
        if (role === 'doctor') homeLink.href = 'doctor-dashboard.html';
        else if (role === 'pharmacy') homeLink.href = 'pharmacy-dashboard.html';
        else homeLink.href = 'patient-dashboard.html';
    }
    
    const profileLink = document.querySelector('.nav-links a[title="Profile"]');
    if (profileLink) {
        profileLink.href = `community-profile.html?uid=${currentUser.uid}`;
    }

    // Show article tab only for doctors (Null-safe)
    const tabArticle = document.getElementById('tabArticle');
    if (tabArticle && role === 'doctor') {
        tabArticle.classList.remove('hidden');
    }

    // Image upload preview (Null-safe)
    const postImages = document.getElementById('postImages');
    if (postImages) {
        postImages.addEventListener('change', handleImagePreview);
    }

    // Load initial feed
    loadFeed(true);
}

// ------------------- POST CREATION -------------------
function setPostType(type) {
    currentPostType = type;
    document.getElementById('postTitle').classList.toggle('active', type === 'article');
    document.getElementById('postContent').setAttribute('data-placeholder', type === 'article' 
    ? 'Write your medical article content here...' 
    : 'What health question is on your mind?');
    document.querySelectorAll('.cp-tab').forEach(t => t.classList.remove('active'));
    if (type === 'article') {
        document.getElementById('tabArticle').classList.add('active');
    } else {
        document.querySelector('.cp-tab').classList.add('active');
    }
}

function handleImagePreview(e) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(files[i]);
    }
}

async function submitPost() {
    const content = document.getElementById('postContent').innerHTML.trim();
    const title = document.getElementById('postTitle').value.trim();
    const images = document.getElementById('postImages').files;

    if (!content) { showToast('Please write something!'); return; }
    if (currentPostType === 'article' && !title) { showToast('Articles need a title.'); return; }

    const formData = new FormData();
    formData.append('action', 'create_post');
    formData.append('authorId', currentUser.uid);
    formData.append('authorName', currentUser.name);
    formData.append('authorRole', currentUser.role);
    formData.append('type', currentPostType);
    if (title) formData.append('title', title);
    formData.append('content', content);
    for (let i = 0; i < images.length; i++) {
        formData.append('images[]', images[i]);
    }

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('postContent').innerHTML = '';
            document.getElementById('postTitle').value = '';
            document.getElementById('postImages').value = '';
            document.getElementById('imagePreview').innerHTML = '';
            setPostType('question');
            showToast('Post published!');
            closePostModal();
            // Reload feed
            feedOffset = 0;
            document.getElementById('feedContainer').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
            loadFeed(true);
        } else {
            showToast('Error: ' + data.message);
        }
    } catch (err) {
        showToast('Network error');
        console.error(err);
    }
}

// ------------------- FEED -------------------
async function loadFeed(reset = false) {
    if (loading) return;
    if (reset) {
        feedOffset = 0;
        hasMore = true;
        document.getElementById('feedContainer').innerHTML = '';
    }
    if (!hasMore) return;

    loading = true;
    const url = `${API_URL}?action=get_feed&uid=${currentUser.uid}&sort=${currentSort}&limit=10&offset=${feedOffset}`;
    try {
        const res = await fetch(url);
        const posts = await res.json();
        if (posts.length < 10) hasMore = false;

        const feed = document.getElementById('feedContainer');
        posts.forEach(post => feed.appendChild(createPostElement(post)));

        feedOffset += posts.length;
    } catch (err) {
        showToast('Failed to load feed');
        console.error(err);
    } finally {
        loading = false;
    }
}

// Infinite scroll
window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadFeed();
    }
});

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post-card';
    div.dataset.postId = post.id;

    const displayName = post.author_role === 'doctor' ? 'Dr. ' + post.author_name : post.author_name;
    
    // NEW: Handle Main Profile Avatar
    const avatarHtml = post.author_pic 
        ? `<img src="${post.author_pic}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` 
        : `<i class="fas fa-user"></i>`;

    let tagLabel = post.type === 'article' 
        ? '<span class="post-tag">Article</span>' 
        : '<span class="post-tag" style="background:#E0F2FE; color:#0284C7">Question</span>';

    let titleHtml = post.title ? `<h3>${post.title}</h3>` : '';

    // NEW: Smart Context/Share Rendering
    let contentHtml = '';
    let imagesHtml = '';

    if (post.type === 'share' && post.original) {
        tagLabel = '<span class="post-tag" style="background:#F3F4F6; color:#4B5563"><i class="fas fa-retweet"></i> Shared</span>';
        
        const origAvatar = post.original.author_pic 
            ? `<img src="${post.original.author_pic}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">` 
            : `<div style="width:35px; height:35px; border-radius:50%; background:#E5E7EB; display:flex; align-items:center; justify-content:center; color:#9CA3AF;"><i class="fas fa-user"></i></div>`;

        let origImages = '';
        const parsedImages = typeof post.original.images === 'string' ? JSON.parse(post.original.images || '[]') : (post.original.images || []);
        if(parsedImages && parsedImages.length > 0) {
             origImages = `<img src="${parsedImages[0]}" style="width:100%; max-height:250px; object-fit:cover; border-radius:8px; margin-top:10px;">`;
        }

        // B. Truncation for custom share caption
        let captionHtml = '';
        if (post.content && post.content.length > 150) {
            captionHtml = `
                <div class="post-text truncated" id="text-${post.id}" style="margin-bottom: 12px; white-space: pre-wrap;">${post.content}</div>
                <button class="see-more-btn" onclick="toggleText('${post.id}')" style="margin-bottom: 12px;">See more</button>
            `;
        } else {
            captionHtml = `<div class="post-text" id="text-${post.id}" style="margin-bottom: 12px; white-space: pre-wrap;">${post.content}</div>`;
        }

        // B. Truncation for Original Shared Content
        let origContentHtml = '';
        if (post.original.content && post.original.content.length > 150) {
            origContentHtml = `
                <div class="post-text truncated" id="text-orig-${post.id}" style="font-size:0.9rem; color:#374151; white-space: pre-wrap;">${post.original.content}</div>
                <button class="see-more-btn" onclick="toggleText('orig-${post.id}')">See more</button>
            `;
        } else {
            origContentHtml = `<div class="post-text" id="text-orig-${post.id}" style="font-size:0.9rem; color:#374151; white-space: pre-wrap;">${post.original.content}</div>`;
        }

        contentHtml = `
            ${captionHtml}
            <div class="shared-post-box" style="border: 1px solid #E5E7EB; border-radius: 12px; padding: 15px; background: #F9FAFB;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    ${origAvatar}
                    <div>
                        <div style="font-weight:600; font-size:0.9rem; color:var(--dark);">${post.original.author_name}</div>
                        <div style="font-size:0.75rem; color:var(--gray); text-transform:capitalize;">${post.original.author_role}</div>
                    </div>
                </div>
                ${origContentHtml}
                ${origImages}
            </div>
        `;
    } else {
        // Standard Content Truncation & D. Line Gap fix (pre-wrap)
        if (post.content.length > 150) {
            contentHtml = `
                <div class="post-text truncated" id="text-${post.id}" style="white-space: pre-wrap;">${post.content}</div>
                <button class="see-more-btn" onclick="toggleText('${post.id}')">See more</button>
            `;
        } else {
            contentHtml = `<div class="post-text" id="text-${post.id}" style="white-space: pre-wrap;">${post.content}</div>`;
        }

        if (post.images && post.images.length > 0) {
            const firstImage = post.images[0];
            const moreCount = post.images.length - 1;
            imagesHtml = `<div class="post-images ${post.images.length > 1 ? 'multiple' : 'single'}" data-full="false">`;
            imagesHtml += `<img src="${firstImage}" alt="post image" onclick="expandImages(this, ${post.id})">`;
            if (moreCount > 0) {
                imagesHtml += `<div class="more-overlay" onclick="expandImages(this, ${post.id})">+${moreCount} more</div>`;
            }
            imagesHtml += '</div>';
        }
    }

    // C. Only show if NOT followed, and stop click from opening profile
    let followBtn = (post.author_id !== currentUser.uid && !post.followed_by_user) ? 
        `<button class="inline-follow-btn" onclick="event.stopPropagation(); toggleFollow('${post.author_id}', this)" title="Follow">
            <i class="fas fa-user-plus"></i> Follow
        </button>` : '';

    let optionsMenu = '';
    if (post.author_id === currentUser.uid) {
        optionsMenu = `
            <div class="post-options">
                <button class="options-trigger" onclick="togglePostMenu(${post.id})"><i class="fas fa-ellipsis-h"></i></button>
                <div class="options-dropdown" id="menu-${post.id}">
                    <button onclick="pinPost(${post.id})"><i class="fas fa-thumbtack"></i> Pin Post</button>
                    <button onclick="editPost(${post.id})"><i class="fas fa-pen"></i> Edit</button>
                    <button class="text-danger" onclick="deletePost(${post.id})"><i class="fas fa-trash"></i> Delete</button>
                </div>
            </div>`;
    } else {
        optionsMenu = `
            <div class="post-options">
                <button class="options-trigger" onclick="togglePostMenu(${post.id})"><i class="fas fa-ellipsis-h"></i></button>
                <div class="options-dropdown" id="menu-${post.id}">
                    <button onclick="hidePost(${post.id})"><i class="fas fa-eye-slash"></i> Hide Post</button>
                    <button class="text-danger" onclick="blockUser('${post.author_id}')"><i class="fas fa-ban"></i> Block User</button>
                </div>
            </div>`;
    }

    const likeBtn = `<button class="action-btn ${post.liked_by_user ? 'liked' : ''}" onclick="toggleLike(${post.id}, this)"><i class="${post.liked_by_user ? 'fas' : 'far'} fa-heart"></i> <span class="like-count">${post.likes_count}</span></button>`;
    const commentBtn = `<button class="action-btn" onclick="toggleComments(${post.id})"><i class="far fa-comment"></i> <span class="comment-count">${post.comments_count}</span></button>`;
    const answerBtn = `<button class="action-btn" onclick="toggleAnswers(${post.id})" style="color: #16A34A;"><i class="fas fa-user-md"></i> <span>Answers</span></button>`;
    const shareBtn = `<button class="action-btn" onclick="sharePost(${post.id})"><i class="fas fa-share"></i></button>`;

    let answerInputHtml = currentUser.role === 'doctor' ? `
        <div class="comment-input-box">
            <input type="text" id="answer-input-${post.id}" placeholder="Provide professional medical advice...">
            <button class="btn-send" style="background: #16A34A;" onclick="submitAnswer(${post.id})"><i class="fas fa-paper-plane"></i></button>
        </div>` : 
        `<div style="font-size: 0.85rem; color: var(--gray); margin-bottom: 10px; font-style: italic;">Only verified doctors can provide answers.</div>`;

    const pinBadge = post.is_pinned == 1 ? `<span class="pin-badge"><i class="fas fa-thumbtack"></i> Pinned</span>` : '';

    div.innerHTML = `
        <div class="post-header">
            <div class="user-info">
                <div class="avatar" style="cursor:pointer; padding:0; overflow:hidden;" onclick="openProfile('${post.author_id}')">${avatarHtml}</div>
                <div class="meta">
                    <h4 style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="openProfile('${post.author_id}')">
                        ${displayName} ${followBtn}
                    </h4>
                    <span>${pinBadge} ${timeAgo(post.created_at)}</span>
                </div>
            </div>
            ${optionsMenu}
        </div>
        <div class="post-content">
            ${tagLabel}
            ${titleHtml}
            ${contentHtml}
            ${imagesHtml}
        </div>
        <div class="interaction-bar">
            ${likeBtn}
            ${commentBtn}
            ${answerBtn}
            ${shareBtn}
        </div>
        
        <div id="comments-${post.id}" class="comments-section">
            <div class="comment-input-box">
                <input type="text" id="comment-input-${post.id}" placeholder="Write a comment...">
                <button class="btn-send" onclick="submitInteraction(${post.id}, 'comment')"><i class="fas fa-paper-plane"></i></button>
            </div>
            <div class="comment-list" id="comment-list-${post.id}"></div>
        </div>

        <div id="answers-${post.id}" class="answers-section">
            <h4 style="color: #16A34A; margin-bottom: 12px; font-size: 1rem;"><i class="fas fa-user-md"></i> Medical Answers</h4>
            ${answerInputHtml}
            <div class="comment-list" id="answer-list-${post.id}"></div>
        </div>
    `;

    return div;
}

// ------------------- Switch Feed Sort -------------------
function switchFeedSort(sortType) {
    if (currentSort === sortType) return;
    currentSort = sortType;
    
    // Smooth UI Animation
    const container = document.getElementById('sortToggleContainer');
    const btnRecent = document.getElementById('btnRecent');
    const btnTrending = document.getElementById('btnTrending');
    
    if (sortType === 'trending') {
        container.classList.add('trending-active');
        btnRecent.classList.remove('active');
        btnTrending.classList.add('active');
    } else {
        container.classList.remove('trending-active');
        btnTrending.classList.remove('active');
        btnRecent.classList.add('active');
    }

    // Reload the feed with the new algorithm
    document.getElementById('feedContainer').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Analyzing trends...</div>';
    loadFeed(true);
}

// ------------------- INTERACTIONS -------------------
async function toggleLike(postId, btn) {
    const formData = new FormData();
    formData.append('action', 'like');
    formData.append('postId', postId);
    formData.append('userId', currentUser.uid);

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'liked' || data.status === 'unliked') {
            const isLiked = data.status === 'liked';
            btn.classList.toggle('liked', isLiked);
            btn.querySelector('i').className = isLiked ? 'fas fa-heart' : 'far fa-heart';
            const countSpan = btn.querySelector('.like-count');
            let count = parseInt(countSpan.innerText);
            count = isLiked ? count + 1 : count - 1;
            countSpan.innerText = count;
        }
    } catch (err) {
        showToast('Error toggling like');
    }
}

function toggleComments(postId) {
    document.getElementById(`answers-${postId}`).classList.remove('open'); // Close answers if open
    const section = document.getElementById(`comments-${postId}`);
    section.classList.toggle('open');
    if (section.classList.contains('open') && !section.dataset.loaded) {
        loadInteractions(postId, 'comment');
        section.dataset.loaded = 'true';
    }
}

function toggleAnswers(postId) {
    document.getElementById(`comments-${postId}`).classList.remove('open'); // Close comments if open
    const section = document.getElementById(`answers-${postId}`);
    section.classList.toggle('open');
    if (section.classList.contains('open') && !section.dataset.loaded) {
        loadInteractions(postId, 'answer');
        section.dataset.loaded = 'true';
    }
}

async function loadInteractions(postId, type) {
    const listId = type === 'answer' ? `answer-list-${postId}` : `comment-list-${postId}`;
    const list = document.getElementById(listId);
    list.innerHTML = '<div class="loading-spinner" style="padding:10px;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const res = await fetch(`${API_URL}?action=get_comments&postId=${postId}`);
        const data = await res.json();
        const filtered = data.filter(c => c.type === type);
        
        list.innerHTML = filtered.length ? filtered.map(c => {
            const authorDisplay = c.author_role === 'doctor' ? 'Dr. ' + c.author_name : c.author_name;
            const color = c.author_role === 'doctor' ? '#16A34A' : 'var(--dark)';
            
            // Check if user owns the comment to show 3-dot menu
            const isOwner = c.user_id === currentUser.uid;
            const menuHtml = isOwner ? `
                <div class="comment-options">
                    <button class="comment-options-trigger" onclick="toggleCommentMenu(${c.id})"><i class="fas fa-ellipsis-v"></i></button>
                    <div class="comment-dropdown" id="comment-menu-${c.id}">
                        <button onclick="editCommentPrompt(${c.id}, '${c.content.replace(/'/g, "\\'")}', ${postId}, '${type}')"><i class="fas fa-pen"></i> Edit</button>
                        <button class="text-danger" onclick="deleteComment(${c.id}, ${postId}, '${type}')"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            ` : '';

            return `
            <div class="single-comment" id="comment-el-${c.id}">
                ${menuHtml}
                <span class="comment-author" style="color:${color}">${authorDisplay}:</span>
                <span class="comment-text-content">${c.content}</span>
            </div>`;
        }).join('') : `<div style="color:#9CA3AF; font-size: 0.9rem;">No ${type}s yet.</div>`;
    } catch (err) {
        list.innerHTML = `<div style="color:red;">Failed to load data</div>`;
    }
}

async function submitInteraction(postId, type) {
    const inputId = type === 'answer' ? `answer-input-${postId}` : `comment-input-${postId}`;
    const input = document.getElementById(inputId);
    const text = input.value.trim();
    if (!text) return;

    const formData = new FormData();
    formData.append('action', 'comment'); // reusing your backend comment action
    formData.append('postId', postId);
    formData.append('userId', currentUser.uid);
    formData.append('authorName', currentUser.name);
    formData.append('authorRole', currentUser.role);
    formData.append('content', text);
    formData.append('type', type);

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            input.value = '';
            loadInteractions(postId, type);
            if(type === 'comment') {
                const commentBtn = document.querySelector(`[onclick="toggleComments(${postId})"] .comment-count`);
                if (commentBtn) commentBtn.innerText = parseInt(commentBtn.innerText) + 1;
            }
        } else {
            showToast('Error posting');
        }
    } catch (err) {
        showToast('Network error');
    }
}

// Wrapper for the inline button call
function submitAnswer(postId) {
    submitInteraction(postId, 'answer');
}

async function toggleFollow(userId, btn) {
    const formData = new FormData();
    formData.append('action', 'follow');
    formData.append('followerUid', currentUser.uid);
    formData.append('followedUid', userId);

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'followed') {
            btn.remove(); // C. Completely remove the button once followed
        } else if (data.status === 'unfollowed') {
            btn.classList.remove('following');
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
        }
    } catch (err) {
        showToast('Error following user');
    }
}

async function sharePost(postId) {
    // A. Ask user for a caption
    const caption = prompt("Write a caption for this share (optional):", "");
    if (caption === null) return; // Cancelled if they click 'Cancel'

    const formData = new FormData();
    formData.append('action', 'share');
    formData.append('userId', currentUser.uid);
    formData.append('originalPostId', postId);
    formData.append('content', caption.trim() || 'shared a post'); // Send caption

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Shared to your wall!');
            feedOffset = 0;
            document.getElementById('feedContainer').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
            loadFeed(true);
        } else {
            showToast('Error sharing post');
        }
    } catch (err) {
        showToast('Network error');
    }
}


// ------------------- UI HELPERS -------------------
function toggleText(postId) {
    const textDiv = document.getElementById(`text-${postId}`);
    const btn = textDiv.nextElementSibling;
    if (textDiv.classList.contains('truncated')) {
        textDiv.classList.remove('truncated');
        btn.innerText = 'See less';
    } else {
        textDiv.classList.add('truncated');
        btn.innerText = 'See more';
    }
}

function expandImages(imgElement, postId) {
    const container = imgElement.closest('.post-images');
    if (container.classList.contains('expanded')) {
        container.classList.remove('expanded');
        // Optionally restore grid
    } else {
        container.classList.add('expanded');
        // Load all images? For simplicity, we just expand the container
    }
}

function timeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function showToast(msg) {
    const box = document.getElementById('toast-box');
    document.getElementById('toast-msg').innerText = msg;
    box.classList.add('show');
    setTimeout(() => box.classList.remove('show'), 3000);
}


function openPostModal() {
    document.getElementById('postModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePostModal(e) {
    if (e && e.target !== document.getElementById('postModal')) return;
    document.getElementById('postModal').classList.remove('active');
    document.body.style.overflow = '';
}


// --- POST OPTIONS LOGIC ---
function togglePostMenu(postId) {
    // Close others first
    document.querySelectorAll('.options-dropdown.show').forEach(el => {
        if(el.id !== `menu-${postId}`) el.classList.remove('show');
    });
    document.getElementById(`menu-${postId}`).classList.toggle('show');
}

// Close dropdowns if clicked outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.post-options')) {
        document.querySelectorAll('.options-dropdown.show').forEach(el => el.classList.remove('show'));
    }
});

async function deletePost(postId) {
    if(!confirm("Are you sure you want to delete this post?")) return;
    
    const formData = new FormData();
    formData.append('action', 'delete_post');
    formData.append('postId', postId);
    formData.append('userId', currentUser.uid);

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if(data.status === 'success') {
            document.querySelector(`.post-card[data-post-id="${postId}"]`).style.display = 'none';
            showToast('Post deleted.');
        } else {
            showToast(data.message || 'Error deleting post');
        }
    } catch (err) {
        showToast('Network error');
    }
}

function hidePost(postId) {
    document.querySelector(`.post-card[data-post-id="${postId}"]`).style.display = 'none';
    showToast('Post hidden from your feed.');
}

function editPost(postId) {
    const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    const contentEl = card.querySelector('.post-text');
    const titleEl = card.querySelector('.post-content h3');
    
    document.getElementById('editPostId').value = postId;
    document.getElementById('editPostContent').innerHTML = contentEl ? contentEl.innerHTML : '';
    
    const titleInput = document.getElementById('editPostTitle');
    if (titleEl) {
        titleInput.style.display = 'block';
        titleInput.value = titleEl.innerText;
    } else {
        titleInput.style.display = 'none';
        titleInput.value = '';
    }
    
    document.getElementById('editPostModal').classList.add('active');
    togglePostMenu(postId); // Close the 3-dot menu
}

function closeEditPostModal(e) {
    if (e && e.target !== document.getElementById('editPostModal')) return;
    document.getElementById('editPostModal').classList.remove('active');
}

async function submitEditPost() {
    const postId = document.getElementById('editPostId').value;
    const content = document.getElementById('editPostContent').innerHTML.trim();
    const title = document.getElementById('editPostTitle').value.trim();
    
    if(!content) { showToast('Content cannot be empty'); return; }
    
    const formData = new FormData();
    formData.append('action', 'edit_post');
    formData.append('postId', postId);
    formData.append('userId', currentUser.uid);
    formData.append('content', content);
    formData.append('title', title);
    
    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if(data.status === 'success') {
            showToast('Post updated successfully!');
            closeEditPostModal();
            // Update the UI instantly without reloading the page
            const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            if(card.querySelector('.post-text')) card.querySelector('.post-text').innerHTML = content;
            if(card.querySelector('.post-content h3') && title) card.querySelector('.post-content h3').innerText = title;
        } else {
            showToast(data.message || 'Error updating post');
        }
    } catch (err) {
        showToast('Network error');
    }
}

function blockUser(userId) {
    showToast('User blocked. You will no longer see their content.');
    // In Phase 2, this will hit a backend table to filter feed SQL
}

async function pinPost(postId) {
    // Placeholder for Phase 2 backend hook
    showToast('Post pin requested. Processing...');
}

// --- PROFILE UI TRIGGER ---
function openProfile(userId) {
    window.location.href = `community-profile.html?uid=${userId}`;
}

// --- COMMENT MANAGEMENT ---
function toggleCommentMenu(commentId) {
    document.querySelectorAll('.comment-dropdown.show').forEach(el => {
        if(el.id !== `comment-menu-${commentId}`) el.classList.remove('show');
    });
    document.getElementById(`comment-menu-${commentId}`).classList.toggle('show');
}

async function editCommentPrompt(commentId, oldContent, postId, type) {
    toggleCommentMenu(commentId); 
    const newContent = prompt('Edit your response:', oldContent);
    if(newContent === null || newContent.trim() === '' || newContent === oldContent) return;
    
    const formData = new FormData();
    formData.append('action', 'edit_comment');
    formData.append('commentId', commentId);
    formData.append('userId', currentUser.uid);
    formData.append('content', newContent.trim());
    
    try {
        const res = await fetch(API_URL, {method: 'POST', body: formData});
        const data = await res.json();
        if(data.status === 'success') {
            document.querySelector(`#comment-el-${commentId} .comment-text-content`).innerText = newContent.trim();
            showToast('Response updated');
        } else showToast(data.message);
    } catch(e) { showToast('Error updating'); }
}

async function deleteComment(commentId, postId, type) {
    if(!confirm('Are you sure you want to delete this?')) return;
    toggleCommentMenu(commentId);
    
    const formData = new FormData();
    formData.append('action', 'delete_comment');
    formData.append('commentId', commentId);
    formData.append('postId', postId);
    formData.append('userId', currentUser.uid);
    
    try {
        const res = await fetch(API_URL, {method: 'POST', body: formData});
        const data = await res.json();
        if(data.status === 'success') {
            document.getElementById(`comment-el-${commentId}`).remove();
            if(type === 'comment') {
                const countSpan = document.querySelector(`[onclick="toggleComments(${postId})"] .comment-count`);
                if(countSpan) countSpan.innerText = Math.max(0, parseInt(countSpan.innerText) - 1);
            }
            showToast('Deleted successfully');
        } else showToast(data.message);
    } catch(e) { showToast('Error deleting'); }
}

// Close comment dropdowns if clicked outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.comment-options')) {
        document.querySelectorAll('.comment-dropdown.show').forEach(el => el.classList.remove('show'));
    }
});

// --- NOTIFICATIONS SYSTEM ---
function toggleNotifications(e) {
    e.preventDefault();
    const dropdown = document.getElementById('notifDropdown');
    dropdown.classList.toggle('show');
    if(dropdown.classList.contains('show')) {
        fetchNotifications();
    }
}

async function fetchNotifications() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return; // Exit safely if the notification UI doesn't exist on this page

    try {
        const res = await fetch(`${API_URL}?action=get_notifications&uid=${currentUser.uid}`);
        const notifs = await res.json();
        
        if(notifs.length === 0) {
            dropdown.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--gray);">No notifications yet.</div>';
            document.getElementById('notifBadge').style.display = 'none';
            return;
        }
        
        const unreadCount = notifs.filter(n => n.is_read == 0).length;
        const badge = document.getElementById('notifBadge');
        if(unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
        
        dropdown.innerHTML = notifs.map(n => {
            let text = '';
            if(n.type === 'like') text = 'liked your post.';
            if(n.type === 'comment') text = 'commented on your post.';
            if(n.type === 'answer') text = 'answered your question.';
            if(n.type === 'share') text = 'shared your post.';
            
            return `<div class="notification-item ${n.is_read == 0 ? 'unread' : ''}" onclick="markNotifRead(${n.id}, ${n.post_id})">
                <strong>${n.sender_name}</strong> ${text}
                <div style="font-size: 0.7rem; color: var(--gray); margin-top: 3px;">${timeAgo(n.created_at)}</div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error("Notification fetch failed", e);
    }
}

async function markNotifRead(notifId, postId) {
    document.getElementById('notifDropdown').classList.remove('show');
    
    // Smooth scroll to the relevant post
    const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if(postCard) postCard.scrollIntoView({behavior: 'smooth', block: 'center'});
    
    const formData = new FormData();
    formData.append('action', 'mark_notif_read');
    formData.append('notifId', notifId);
    await fetch(API_URL, {method: 'POST', body: formData});
    
    fetchNotifications(); // Refresh badge count
}

// Fetch unread count 1 second after page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(fetchNotifications, 1000);
});


// D. Rich Text Formatting Executer
function formatText(command) {
    document.execCommand(command, false, null);
    document.querySelector('.rich-editor:focus')?.focus();
}
