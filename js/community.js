// community.js
const API_URL = 'api/community.php'; // Adjust path if needed

let currentUser = null;
let currentPostType = 'question';
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

    // Show article tab only for doctors
    if (role === 'doctor') {
        document.getElementById('tabArticle').classList.remove('hidden');
    }

    // Image upload preview
    document.getElementById('postImages').addEventListener('change', handleImagePreview);

    // Load initial feed
    loadFeed(true);
}

// ------------------- POST CREATION -------------------
function setPostType(type) {
    currentPostType = type;
    document.getElementById('postTitle').classList.toggle('active', type === 'article');
    document.getElementById('postContent').placeholder = type === 'article' 
        ? 'Write your medical article content here...' 
        : 'What health question is on your mind?';
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
    const content = document.getElementById('postContent').value.trim();
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
            document.getElementById('postContent').value = '';
            document.getElementById('postTitle').value = '';
            document.getElementById('postImages').value = '';
            document.getElementById('imagePreview').innerHTML = '';
            setPostType('question');
            showToast('Post published!');
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
    const url = `${API_URL}?action=get_feed&uid=${currentUser.uid}&limit=10&offset=${feedOffset}`;
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

    // Badge class
    let badgeClass = 'role-patient';
    if (post.author_role === 'doctor') badgeClass = 'role-doctor';
    if (post.author_role === 'pharmacy') badgeClass = 'role-pharmacy';

    // Tag
    let tagLabel = post.type === 'article' 
        ? '<span class="post-tag">Article</span>' 
        : '<span class="post-tag" style="background:#E0F2FE; color:#0284C7">Question</span>';

    // Title
    let titleHtml = post.title ? `<h3>${post.title}</h3>` : '';

    // Images
    let imagesHtml = '';
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

    // Follow button (don't show for own posts)
    let followBtn = '';
    if (post.author_id !== currentUser.uid) {
        followBtn = `<button class="action-btn follow-btn ${post.followed_by_user ? 'following' : ''}" onclick="toggleFollow('${post.author_id}', this)">
            <i class="fas ${post.followed_by_user ? 'fa-user-check' : 'fa-user-plus'}"></i> ${post.followed_by_user ? 'Following' : 'Follow'}
        </button>`;
    }

    // Share button
    const shareBtn = `<button class="action-btn" onclick="sharePost(${post.id})"><i class="fas fa-share"></i> Share</button>`;

    // Interaction bar
    const likeBtn = `<button class="action-btn ${post.liked_by_user ? 'liked' : ''}" onclick="toggleLike(${post.id}, this)">
        <i class="${post.liked_by_user ? 'fas' : 'far'} fa-heart"></i> <span class="like-count">${post.likes_count}</span> Likes
    </button>`;
    const commentBtn = `<button class="action-btn" onclick="toggleComments(${post.id})">
        <i class="far fa-comment"></i> <span class="comment-count">${post.comments_count}</span> Comments
    </button>`;

    div.innerHTML = `
        <div class="post-header">
            <div class="user-info">
                <div class="avatar"><i class="fas fa-user"></i></div>
                <div class="meta">
                    <h4>${post.author_name} <span class="role-badge ${badgeClass}">${post.author_role.toUpperCase()}</span></h4>
                    <span>${timeAgo(post.created_at)}</span>
                </div>
            </div>
            ${followBtn}
        </div>
        <div class="post-content">
            ${tagLabel}
            ${titleHtml}
            <div class="post-text truncated" id="text-${post.id}">${post.content}</div>
            <button class="see-more-btn" onclick="toggleText(${post.id})">See more</button>
            ${imagesHtml}
        </div>
        <div class="interaction-bar">
            ${likeBtn}
            ${commentBtn}
            ${shareBtn}
        </div>
        <div id="comments-${post.id}" class="comments-section">
            <div class="comment-tabs">
                <span class="comment-tab active" onclick="loadComments(${post.id}, 'comment')">Comments</span>
                ${currentUser.role === 'doctor' ? '<span class="comment-tab" onclick="loadComments(' + post.id + ', \'answer\')">Answers</span>' : ''}
            </div>
            <div class="comment-input-box">
                <input type="text" id="comment-input-${post.id}" placeholder="Write a comment...">
                <button class="btn-send" onclick="submitComment(${post.id})"><i class="fas fa-paper-plane"></i></button>
            </div>
            <div class="comment-list" id="comment-list-${post.id}"></div>
        </div>
    `;

    return div;
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
    const section = document.getElementById(`comments-${postId}`);
    section.classList.toggle('open');
    if (section.classList.contains('open') && !section.dataset.loaded) {
        loadComments(postId, 'comment');
        section.dataset.loaded = 'true';
    }
}

async function loadComments(postId, type) {
    const list = document.getElementById(`comment-list-${postId}`);
    list.innerHTML = '<div class="loading-spinner" style="padding:10px;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const res = await fetch(`${API_URL}?action=get_comments&postId=${postId}`);
        const comments = await res.json();
        const filtered = comments.filter(c => type === 'all' || c.type === type);
        list.innerHTML = filtered.length ? filtered.map(c => `
            <div class="single-comment">
                <span class="comment-author" style="color:${c.author_role === 'doctor' ? 'var(--secondary)' : 'var(--dark)'}">${c.author_name}:</span>
                <span>${c.content}</span>
                ${c.type === 'answer' ? '<span class="answer-badge">Answer</span>' : ''}
            </div>
        `).join('') : '<div style="color:#9CA3AF;">No comments yet.</div>';
    } catch (err) {
        list.innerHTML = '<div style="color:red;">Failed to load comments</div>';
    }
}

async function submitComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;

    const activeTab = document.querySelector(`#comments-${postId} .comment-tab.active`);
    const type = activeTab ? activeTab.innerText.toLowerCase() : 'comment'; // 'comments' or 'answers'
    const commentType = type === 'answers' ? 'answer' : 'comment';

    const formData = new FormData();
    formData.append('action', 'comment');
    formData.append('postId', postId);
    formData.append('userId', currentUser.uid);
    formData.append('authorName', currentUser.name);
    formData.append('authorRole', currentUser.role);
    formData.append('content', text);
    formData.append('type', commentType);

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            input.value = '';
            loadComments(postId, commentType);
            // Increment comment count in UI
            const commentBtn = document.querySelector(`[onclick="toggleComments(${postId})"] .comment-count`);
            if (commentBtn) commentBtn.innerText = parseInt(commentBtn.innerText) + 1;
        } else {
            showToast('Error posting comment');
        }
    } catch (err) {
        showToast('Network error');
    }
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
            btn.classList.add('following');
            btn.innerHTML = '<i class="fas fa-user-check"></i> Following';
        } else if (data.status === 'unfollowed') {
            btn.classList.remove('following');
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
        }
    } catch (err) {
        showToast('Error following user');
    }
}

async function sharePost(postId) {
    const formData = new FormData();
    formData.append('action', 'share');
    formData.append('userId', currentUser.uid);
    formData.append('originalPostId', postId);

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Shared to your wall!');
            // Reload feed to show new share
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
