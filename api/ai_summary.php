<?php
header('Content-Type: application/json');

// Get the raw POST data
$input = json_decode(file_get_contents('php://input'), true);
$medicalData = $input['context'] ?? '';

if (empty($medicalData)) {
    echo json_encode(['error' => 'No data to summarize']);
    exit;
}

// Your Gemini API Key
$apiKey = "YOUR_GEMINI_API_KEY"; 
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . $apiKey;

$prompt = "You are a medical assistant for the platform MEDeLIFE. 
           Summarize the following patient medical records into a concise, professional summary. 
           Focus on recent diagnoses, medications, and key lab results. 
           Keep it brief and easy to read. Data: " . $medicalData;

$data = [
    "contents" => [
        ["parts" => [["text" => $prompt]]]
    ]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
