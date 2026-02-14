<?php
include 'db_connect.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_POST['action'] ?? '';

// --- GET REQUESTS (Fetch Lists) ---
if ($method === 'GET') {
    $doctor_id = $_GET['doctor_id'] ?? null;
    $patient_id = $_GET['patient_id'] ?? null;
    $status = $_GET['status'] ?? null;

    $sql = "SELECT * FROM appointments WHERE 1=1";
    
    if ($doctor_id) $sql .= " AND doctor_id = '$doctor_id'";
    if ($patient_id) $sql .= " AND patient_id = '$patient_id'";
    if ($status) $sql .= " AND status = '$status'";
    
    $sql .= " ORDER BY request_date DESC";

    $result = $conn->query($sql);
    $data = [];
    while($row = $result->fetch_assoc()) {
        // Fix boolean conversion for JS
        $row['share_documents'] = $row['share_documents'] == 1;
        $data[] = $row;
    }
    echo json_encode($data);
}

// --- POST REQUESTS (Actions) ---
elseif ($method === 'POST') {
    
    // 1. BOOK APPOINTMENT
    if ($action == 'book') {
        $pid = $_POST['patientId'];
        $pname = $_POST['patientName'];
        $did = $_POST['doctorId'];
        $dname = $_POST['doctorName'];
        $time = $_POST['time'];
        $share = $_POST['share'] === 'true' ? 1 : 0;

        $stmt = $conn->prepare("INSERT INTO appointments (patient_id, patient_name, doctor_id, doctor_name, preferred_time, share_documents, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')");
        $stmt->bind_param("sssssi", $pid, $pname, $did, $dname, $time, $share);
        
        if ($stmt->execute()) echo json_encode(["status" => "success"]);
        else echo json_encode(["status" => "error", "message" => $conn->error]);
    }

    // 2. UPDATE STATUS (Accept/Decline)
    elseif ($action == 'update_status') {
        $id = $_POST['id'];
        $status = $_POST['status'];
        $conn->query("UPDATE appointments SET status = '$status' WHERE id = $id");
        echo json_encode(["status" => "success"]);
    }

    // 3. DOCTOR SETS TIME
    elseif ($action == 'update_time') {
        $id = $_POST['id'];
        $time = $_POST['time'];
        $stmt = $conn->prepare("UPDATE appointments SET scheduled_time = ? WHERE id = ?");
        $stmt->bind_param("si", $time, $id);
        $stmt->execute();
        echo json_encode(["status" => "success"]);
    }

    // 4. ACCESS RESPONSE (Patient Allows/Denies)
    elseif ($action == 'access_response') {
        $id = $_POST['id'];
        $allow = $_POST['allow'] === 'true' ? 1 : 0;
        $reqStatus = 'resolved';
        
        $sql = "UPDATE appointments SET access_request = '$reqStatus', share_documents = $allow WHERE id = $id";
        $conn->query($sql);
        echo json_encode(["status" => "success"]);
    }

    // 5. DELETE/CANCEL
    elseif ($action == 'delete') {
        $id = $_POST['id'];
        $conn->query("DELETE FROM appointments WHERE id = $id");
        echo json_encode(["status" => "success"]);
    }
}
?>
