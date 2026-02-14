<?php
include 'db_connect.php';
header('Content-Type: application/json');

$action = $_REQUEST['action'] ?? '';

// 1. SYNC USER (Create or Update on Login)
if ($action == 'sync') {
    $uid = $_POST['uid'];
    $name = $_POST['name'];
    $email = $_POST['email'];
    $role = $_POST['role'];

    // Insert or Update if exists
    $sql = "INSERT INTO users (uid, name, email, role) VALUES (?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE name=?, role=?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssssss", $uid, $name, $email, $role, $name, $role);
    
    if ($stmt->execute()) echo json_encode(["status" => "success"]);
    else echo json_encode(["status" => "error", "message" => $conn->error]);
}

// 2. SEARCH USERS (For Doctors/Pharmacy)
elseif ($action == 'search') {
    $email = $_GET['email'];
    $sql = "SELECT uid, name, email, role, profile_pic FROM users WHERE email = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $users = [];
    while($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    echo json_encode($users);
}

// 3. GET SINGLE USER
elseif ($action == 'get') {
    $uid = $_GET['uid'];
    $sql = "SELECT * FROM users WHERE uid = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $uid);
    $stmt->execute();
    $result = $stmt->get_result();
    echo json_encode($result->fetch_assoc() ?: []);
}

// 4. GET ALL DOCTORS (For Patient Dashboard)
elseif ($action == 'get_doctors') {
    $sql = "SELECT uid, name, specialist, degrees, address, phone, time, profile_pic FROM users WHERE role = 'doctor'";
    $result = $conn->query($sql);
    
    $doctors = [];
    while($row = $result->fetch_assoc()) {
        $doctors[] = $row;
    }
    echo json_encode($doctors);
}

// 5. UPDATE PROFILE (New Section)
elseif ($action == 'update_profile') {
    $uid = $_POST['uid'];

    // A. Handle Image Upload
    if (isset($_FILES['profile_pic']) && $_FILES['profile_pic']['error'] === UPLOAD_ERR_OK) {
        $target_dir = "../uploads/";
        // Create folder if it doesn't exist
        if (!file_exists($target_dir)) {
            mkdir($target_dir, 0777, true);
        }
        
        $fileName = time() . "_" . basename($_FILES["profile_pic"]["name"]);
        $target_file = $target_dir . $fileName;
        
        if (move_uploaded_file($_FILES["profile_pic"]["tmp_name"], $target_file)) {
            // Update DB with new image path (we save the relative path 'uploads/filename')
            $db_path = "uploads/" . $fileName;
            $stmt = $conn->prepare("UPDATE users SET profile_pic = ? WHERE uid = ?");
            $stmt->bind_param("ss", $db_path, $uid);
            $stmt->execute();
        }
    }

    $name = $_POST['name'] ?? null;
    $phone = $_POST['phone'] ?? null;
    $address = $_POST['address'] ?? null;
    
    // Doctor
    $specialist = $_POST['specialist'] ?? null;
    $degrees = $_POST['degrees'] ?? null;
    $time = $_POST['time'] ?? null;
    
    // Patient
    $gender = $_POST['gender'] ?? null;
    $age = $_POST['age'] ?? null;
    $blood_group = $_POST['bloodGroup'] ?? null; 
    $height = $_POST['height'] ?? null;
    $weight = $_POST['weight'] ?? null;
    $em_name = $_POST['emName'] ?? null;
    $em_phone = $_POST['emPhone'] ?? null;
    // [NEW] Missing Patient Fields
    $em_relation = $_POST['emRelation'] ?? null;
    $em_email = $_POST['emEmail'] ?? null;
    $reg_num = $_POST['regNum'] ?? null;


   $sql = "UPDATE users SET 
            name = COALESCE(?, name),
            phone = COALESCE(?, phone),
            address = COALESCE(?, address),
            specialist = COALESCE(?, specialist),
            degrees = COALESCE(?, degrees),
            time = COALESCE(?, time),
            gender = COALESCE(?, gender),
            age = COALESCE(?, age),
            blood_group = COALESCE(?, blood_group),
            height = COALESCE(?, height),
            weight = COALESCE(?, weight),
            em_name = COALESCE(?, em_name),
            em_phone = COALESCE(?, em_phone),
            em_relation = COALESCE(?, em_relation),
            em_email = COALESCE(?, em_email),
            reg_num = COALESCE(?, reg_num)
            WHERE uid = ?";

    $stmt = $conn->prepare($sql);
    // 's' repeats 13 times for inputs + 1 time for uid = 14 strings
    $stmt->bind_param("sssssssssssssssss", 
        $name, $phone, $address, $specialist, $degrees, $time, 
        $gender, $age, $blood_group, $height, $weight, $em_name, $em_phone, 
        $em_relation, $em_email, $reg_num,
        $uid
    );

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => $conn->error]);
    }
}
?>
