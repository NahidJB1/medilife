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
?>
