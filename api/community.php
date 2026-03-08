<?php
include 'db_connect.php';
header('Content-Type: application/json');

$action = $_REQUEST['action'] ?? '';

// Helper function to create notifications
function createNotification($conn, $post_id, $sender_uid, $type) {
    // Get the recipient (author of the post)
    $query = $conn->query("SELECT author_id FROM posts WHERE id = $post_id");
    if ($query->num_rows > 0) {
        $post = $query->fetch_assoc();
        $recipient_uid = $post['author_id'];
        
        // Don't send a notification if the user interacts with their own post
        if ($recipient_uid !== $sender_uid) {
            $stmt = $conn->prepare("INSERT INTO notifications (recipient_uid, sender_uid, type, post_id) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("sssi", $recipient_uid, $sender_uid, $type, $post_id);
            $stmt->execute();
        }
    }
}

// ----------------------------- GET FEED -----------------------------
if ($action == 'get_feed') {
    $uid = $_GET['uid'] ?? ''; 
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
    $profileUid = isset($_GET['profileUid']) ? $conn->real_escape_string($_GET['profileUid']) : '';
    $filter = $_GET['filter'] ?? 'all'; 
    $sort = $_GET['sort'] ?? 'recent'; // Get the sort instruction

    // Standard Selects
    $sql = "SELECT p.*, 
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
            (SELECT profile_pic FROM users WHERE uid = p.author_id) AS author_pic";
            
    // NEW: Inject the Weighted Decay Algorithm if Trending is selected
    if ($sort === 'trending') {
        $sql .= ", ( 
            ((SELECT COUNT(*) FROM likes WHERE post_id = p.id) * 2) + 
            ((SELECT COUNT(*) FROM comments WHERE post_id = p.id) * 4) 
        ) / POW(TIMESTAMPDIFF(HOUR, p.created_at, NOW()) + 2, 1.5) AS trending_score ";
    }
            
    $sql .= " FROM posts p WHERE 1=1 ";
            
    // Preserve existing profile and shared filtering logic
    if ($profileUid !== '') {
        $sql .= " AND p.author_id = '$profileUid' ";
        if ($filter === 'wall') {
            $sql .= " AND p.type IN ('question', 'article') ";
        } elseif ($filter === 'shared') {
            $sql .= " AND p.type = 'share' ";
        }
    }
    
    // Apply the correct Sorting
    if ($sort === 'trending') {
        $sql .= " ORDER BY trending_score DESC, p.created_at DESC LIMIT ? OFFSET ?";
    } else {
        $sql .= " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
    }
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $limit, $offset);
    $stmt->execute();
    $result = $stmt->get_result();

    $posts = [];
    while ($row = $result->fetch_assoc()) {
        $row['images'] = json_decode($row['images'], true) ?? [];
        if ($row['type'] == 'share' && $row['original_post_id']) {
            $orig = $conn->query("SELECT p.author_name, p.author_role, p.content, p.images, (SELECT profile_pic FROM users WHERE uid = p.author_id) AS author_pic FROM posts p WHERE p.id = " . $row['original_post_id'])->fetch_assoc();
            $row['original'] = $orig;
        }
        $row['liked_by_user'] = $uid ? ($conn->query("SELECT id FROM likes WHERE post_id = {$row['id']} AND user_id = '$uid'")->num_rows > 0) : false;
        $row['followed_by_user'] = $uid ? ($conn->query("SELECT id FROM follows WHERE follower_uid = '$uid' AND followed_uid = '{$row['author_id']}'")->num_rows > 0) : false;
        $row['created_at'] = date('c', strtotime($row['created_at']));
        $posts[] = $row;
    }
    echo json_encode($posts);
    exit;
}


// ----------------------------- CREATE POST (with images) -----------------------------
elseif ($action == 'create_post') {
    $authorId = $_POST['authorId'];
    $authorName = $_POST['authorName'];
    $authorRole = $_POST['authorRole'];
    $type = $_POST['type']; // 'question' or 'article'
    $title = $_POST['title'] ?? null;
    $content = $_POST['content'];

    // Handle image uploads
    $imagePaths = [];
    if (!empty($_FILES['images']['name'][0])) {
        $targetDir = "../uploads/community/";
        if (!file_exists($targetDir)) mkdir($targetDir, 0777, true);

        foreach ($_FILES['images']['tmp_name'] as $key => $tmpName) {
            $fileName = time() . "_" . basename($_FILES['images']['name'][$key]);
            $targetFile = $targetDir . $fileName;
            if (move_uploaded_file($tmpName, $targetFile)) {
                $imagePaths[] = "uploads/community/" . $fileName;
            }
        }
    }
    $imagesJson = json_encode($imagePaths);

    $stmt = $conn->prepare("INSERT INTO posts (author_id, author_name, author_role, type, title, content, images) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssss", $authorId, $authorName, $authorRole, $type, $title, $content, $imagesJson);
    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "post_id" => $stmt->insert_id]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
    exit;
}

// ----------------------------- LIKE / UNLIKE -----------------------------
elseif ($action == 'like') {
    $postId = intval($_POST['postId']);
    $userId = $_POST['userId'];

    // Check if already liked
    $check = $conn->query("SELECT id FROM likes WHERE post_id = $postId AND user_id = '$userId'");
    if ($check->num_rows == 0) {
        $conn->query("INSERT INTO likes (post_id, user_id) VALUES ($postId, '$userId')");
        $conn->query("UPDATE posts SET likes_count = likes_count + 1 WHERE id = $postId");
        
        // NEW: Trigger Notification
        createNotification($conn, $postId, $userId, 'like');
        
        echo json_encode(["status" => "liked"]);
    } else {
        $conn->query("DELETE FROM likes WHERE post_id = $postId AND user_id = '$userId'");
        $conn->query("UPDATE posts SET likes_count = likes_count - 1 WHERE id = $postId");
        echo json_encode(["status" => "unliked"]);
    }
    exit;
}

// ----------------------------- COMMENT (or ANSWER) -----------------------------
elseif ($action == 'comment') {
    $postId = intval($_POST['postId']);
    $userId = $_POST['userId'];
    $authorName = $_POST['authorName'];
    $authorRole = $_POST['authorRole'];
    $content = $_POST['content'];
    $type = $_POST['type'] ?? 'comment'; // 'comment' or 'answer'
    
    // Default parent_id to NULL for standard comments (requires Phase 2 frontend update to utilize)
    $parentId = isset($_POST['parentId']) ? intval($_POST['parentId']) : NULL;

    $stmt = $conn->prepare("INSERT INTO comments (post_id, parent_id, user_id, author_name, author_role, content, type) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("iisssss", $postId, $parentId, $userId, $authorName, $authorRole, $content, $type);
    
    if ($stmt->execute()) {
        $conn->query("UPDATE posts SET comments_count = comments_count + 1 WHERE id = $postId");
        
        // NEW: Trigger Notification
        createNotification($conn, $postId, $userId, $type);
        
        echo json_encode(["status" => "success", "comment_id" => $stmt->insert_id]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
    exit;
}

// ----------------------------- FOLLOW / UNFOLLOW -----------------------------
elseif ($action == 'follow') {
    $followerUid = $_POST['followerUid'];
    $followedUid = $_POST['followedUid'];

    $check = $conn->query("SELECT id FROM follows WHERE follower_uid = '$followerUid' AND followed_uid = '$followedUid'");
    if ($check->num_rows == 0) {
        $conn->query("INSERT INTO follows (follower_uid, followed_uid) VALUES ('$followerUid', '$followedUid')");
        echo json_encode(["status" => "followed"]);
    } else {
        $conn->query("DELETE FROM follows WHERE follower_uid = '$followerUid' AND followed_uid = '$followedUid'");
        echo json_encode(["status" => "unfollowed"]);
    }
    exit;
}

// ----------------------------- SHARE POST -----------------------------
elseif ($action == 'share') {
    $userId = $_POST['userId'];
    $originalPostId = $_POST['originalPostId'];

    // Get original post details
    $orig = $conn->query("SELECT author_id, author_name, author_role, content, images FROM posts WHERE id = $originalPostId")->fetch_assoc();
    if (!$orig) {
        echo json_encode(["status" => "error", "message" => "Original post not found"]);
        exit;
    }

    // Get current user details
    $user = $conn->query("SELECT name, role FROM users WHERE uid = '$userId'")->fetch_assoc();
    if (!$user) {
        echo json_encode(["status" => "error", "message" => "User not found"]);
        exit;
    }

    // Create share post
    $shareContent = "shared a post"; // You can customize
    $stmt = $conn->prepare("INSERT INTO posts (author_id, author_name, author_role, type, content, original_post_id) VALUES (?, ?, ?, 'share', ?, ?)");
    $stmt->bind_param("ssssi", $userId, $user['name'], $user['role'], $shareContent, $originalPostId);
    if ($stmt->execute()) {
        // Increment shares count on original post
        $conn->query("UPDATE posts SET shares_count = shares_count + 1 WHERE id = $originalPostId");
        
        // NEW: Trigger Notification
        createNotification($conn, $originalPostId, $userId, 'share');
        
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
    exit;
}

// ----------------------------- GET COMMENTS FOR A POST -----------------------------
elseif ($action == 'get_comments') {
    $postId = $_GET['postId'];
    $result = $conn->query("SELECT * FROM comments WHERE post_id = $postId ORDER BY created_at ASC");
    $comments = [];
    while ($row = $result->fetch_assoc()) {
        $row['created_at'] = date('c', strtotime($row['created_at']));
        $comments[] = $row;
    }
    echo json_encode($comments);
    exit;
}

// ----------------------------- DELETE POST -----------------------------
elseif ($action == 'delete_post') {
    $postId = intval($_POST['postId']);
    $userId = $_POST['userId']; // Need to verify ownership

    // Check ownership
    $check = $conn->query("SELECT id FROM posts WHERE id = $postId AND author_id = '$userId'");
    if ($check->num_rows > 0) {
        // Delete associated likes and comments first to prevent orphaned data
        $conn->query("DELETE FROM likes WHERE post_id = $postId");
        $conn->query("DELETE FROM comments WHERE post_id = $postId");
        // Delete the post
        $conn->query("DELETE FROM posts WHERE id = $postId");
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Unauthorized to delete this post"]);
    }
    exit;
}


// ----------------------------- EDIT POST -----------------------------
elseif ($action == 'edit_post') {
    $postId = intval($_POST['postId']);
    $userId = $_POST['userId'];
    $content = $_POST['content'];
    $title = $_POST['title'];

    $check = $conn->query("SELECT id FROM posts WHERE id = $postId AND author_id = '$userId'");
    if ($check->num_rows > 0) {
        $stmt = $conn->prepare("UPDATE posts SET content = ?, title = ? WHERE id = ?");
        $stmt->bind_param("ssi", $content, $title, $postId);
        if($stmt->execute()) echo json_encode(["status" => "success"]);
        else echo json_encode(["status" => "error", "message" => "Database update failed"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Unauthorized to edit this post"]);
    }
    exit;
}

// ----------------------------- EDIT / DELETE COMMENT -----------------------------
elseif ($action == 'edit_comment') {
    $commentId = intval($_POST['commentId']);
    $userId = $_POST['userId'];
    $content = $_POST['content'];
    
    $check = $conn->query("SELECT id FROM comments WHERE id = $commentId AND user_id = '$userId'");
    if ($check->num_rows > 0) {
        $stmt = $conn->prepare("UPDATE comments SET content = ? WHERE id = ?");
        $stmt->bind_param("si", $content, $commentId);
        if($stmt->execute()) echo json_encode(["status" => "success"]);
        else echo json_encode(["status" => "error"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Unauthorized"]);
    }
    exit;
}

elseif ($action == 'delete_comment') {
    $commentId = intval($_POST['commentId']);
    $postId = intval($_POST['postId']);
    $userId = $_POST['userId'];
    
    $check = $conn->query("SELECT id FROM comments WHERE id = $commentId AND user_id = '$userId'");
    if ($check->num_rows > 0) {
        $conn->query("DELETE FROM comments WHERE id = $commentId");
        // Decrease comment count safely (preventing negative numbers)
        $conn->query("UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $postId");
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Unauthorized"]);
    }
    exit;
}

// ----------------------------- GET & MARK NOTIFICATIONS -----------------------------
elseif ($action == 'get_notifications') {
    $uid = $_GET['uid'];
    
    // Join with users table to get the sender's actual name
    $sql = "SELECT n.*, u.name as sender_name 
            FROM notifications n 
            JOIN users u ON n.sender_uid = u.uid 
            WHERE n.recipient_uid = '$uid' 
            ORDER BY n.created_at DESC LIMIT 30";
    
    $result = $conn->query($sql);
    $notifs = [];
    while ($row = $result->fetch_assoc()) {
        $row['created_at'] = date('c', strtotime($row['created_at']));
        $notifs[] = $row;
    }
    echo json_encode($notifs);
    exit;
}

elseif ($action == 'mark_notif_read') {
    $notifId = intval($_POST['notifId']);
    $conn->query("UPDATE notifications SET is_read = 1 WHERE id = $notifId");
    echo json_encode(["status" => "success"]);
    exit;
}


// ----------------------------- GET USER ANSWERS -----------------------------
elseif ($action == 'get_user_answers') {
    $targetUid = $conn->real_escape_string($_GET['targetUid']);
    $sql = "SELECT c.*, p.title as post_title, p.content as post_content 
            FROM comments c 
            JOIN posts p ON c.post_id = p.id 
            WHERE c.user_id = '$targetUid' AND c.type = 'answer' 
            ORDER BY c.created_at DESC";
    $result = $conn->query($sql);
    $answers = [];
    while ($row = $result->fetch_assoc()) {
        $row['created_at'] = date('c', strtotime($row['created_at']));
        $answers[] = $row;
    }
    echo json_encode($answers);
    exit;
}

// ----------------------------- GET FOLLOW LISTS -----------------------------
elseif ($action == 'get_follow_list') {
    $targetUid = $conn->real_escape_string($_GET['targetUid']);
    $type = $_GET['type']; // 'followers' or 'following'
    
    if ($type === 'followers') {
        $sql = "SELECT u.uid, u.name, u.role, u.profile_pic FROM follows f JOIN users u ON f.follower_uid = u.uid WHERE f.followed_uid = '$targetUid'";
    } else {
        $sql = "SELECT u.uid, u.name, u.role, u.profile_pic FROM follows f JOIN users u ON f.followed_uid = u.uid WHERE f.follower_uid = '$targetUid'";
    }
    
    $result = $conn->query($sql);
    $users = [];
    while ($row = $result->fetch_assoc()) { $users[] = $row; }
    echo json_encode($users);
    exit;
}

// ----------------------------- GET PROFILE -----------------------------
elseif ($action == 'get_profile') {
    $targetUid = $conn->real_escape_string($_GET['targetUid']);
    $reqUid = $conn->real_escape_string($_GET['reqUid']);

    // Get Base User Info (Including Photo and Join Date)
    $userQuery = $conn->query("SELECT name, role, profile_pic, created_at FROM users WHERE uid = '$targetUid'");
    if($userQuery->num_rows == 0) {
        echo json_encode(["status" => "error", "message" => "User not found"]);
        exit;
    }
    $userData = $userQuery->fetch_assoc();
    $userData['join_month_year'] = date('F Y', strtotime($userData['created_at']));

    $userData['followers_count'] = $conn->query("SELECT COUNT(*) as count FROM follows WHERE followed_uid = '$targetUid'")->fetch_assoc()['count'];
    $userData['following_count'] = $conn->query("SELECT COUNT(*) as count FROM follows WHERE follower_uid = '$targetUid'")->fetch_assoc()['count'];

    // Check if requester follows target (for privacy settings)
    $isFollowing = $conn->query("SELECT id FROM follows WHERE follower_uid = '$reqUid' AND followed_uid = '$targetUid'")->num_rows > 0;

    $profileQuery = $conn->query("SELECT * FROM user_profiles WHERE user_uid = '$targetUid'");
    $profileData = $profileQuery->num_rows > 0 ? $profileQuery->fetch_assoc() : [
        'bio' => '', 'education' => '', 'location' => '', 'profession' => '', 'languages' => '', 'social_links' => '{}', 'privacy_settings' => '{}'
    ];

    $response = array_merge($userData, $profileData);

    // Apply Privacy Filters
    if ($targetUid !== $reqUid) {
        $privacy = json_decode($response['privacy_settings'], true) ?? [];
        $fieldsToFilter = ['location', 'education', 'profession', 'languages', 'social_links'];
        
        foreach ($fieldsToFilter as $field) {
            $privState = $privacy[$field] ?? 'public';
            if ($privState === 'private') {
                $response[$field] = ($field === 'social_links') ? '{}' : null;
            } elseif ($privState === 'followers' && !$isFollowing) {
                $response[$field] = ($field === 'social_links') ? '{}' : null;
            }
        }
    }

    echo json_encode(["status" => "success", "profile" => $response]);
    exit;
}

// ----------------------------- UPDATE PROFILE -----------------------------
elseif ($action == 'update_profile') {
    $uid = $conn->real_escape_string($_POST['uid']);
    $bio = $conn->real_escape_string($_POST['bio']);
    $education = $conn->real_escape_string($_POST['education']);
    $location = $conn->real_escape_string($_POST['location']);
    $profession = $conn->real_escape_string($_POST['profession']);
    $languages = $conn->real_escape_string($_POST['languages'] ?? '');
    $socialLinks = $_POST['social_links']; 
    $privacySettings = $_POST['privacy_settings'];

    $check = $conn->query("SELECT id FROM user_profiles WHERE user_uid = '$uid'");
    if ($check->num_rows > 0) {
        $stmt = $conn->prepare("UPDATE user_profiles SET bio=?, education=?, location=?, profession=?, languages=?, social_links=?, privacy_settings=? WHERE user_uid=?");
        $stmt->bind_param("ssssssss", $bio, $education, $location, $profession, $languages, $socialLinks, $privacySettings, $uid);
    } else {
        $stmt = $conn->prepare("INSERT INTO user_profiles (bio, education, location, profession, languages, social_links, privacy_settings, user_uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssssssss", $bio, $education, $location, $profession, $languages, $socialLinks, $privacySettings, $uid);
    }

    if ($stmt->execute()) echo json_encode(["status" => "success"]);
    else echo json_encode(["status" => "error", "message" => "Database error"]);
    exit;
}

// If no action matched
echo json_encode(["status" => "error", "message" => "Invalid action"]);
?>
