import requests
import time
import sys
import websocket

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/websocket"

def run_tests():
    print("==================================================")
    print("      VITAGUARD SCENARIOS INTEGRATION TESTS       ")
    print("==================================================")

    # ----------------------------------------------------
    # SCENARIO 1: User details, medical history database setup
    # ----------------------------------------------------
    print("\n--- Running Scenario 1: User & Database Authentication ---")
    login_payload = {
        "email": "LKT01",
        "password": "password"
    }
    r = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    if r.status_code != 200:
        print("[-] Login failed for LKT01 test user.")
        sys.exit(1)
    
    auth_data = r.json()
    token = auth_data["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[+] Successfully logged in as LKT01. Token obtained.")

    # Fetch medical profile (database setup check)
    r = requests.get(f"{BASE_URL}/api/patients/me/medical-profile", headers=headers)
    if r.status_code != 200:
        print("[-] Failed to fetch medical profile.")
        sys.exit(1)
    profile = r.json()
    print("[+] Successfully fetched medical profile.")
    print(f"    Current Blood Group: {auth_data.get('bloodGroup')}")
    print(f"    Age: {auth_data.get('age')}")

    # Initialize/Reset profile fields for testing
    profile["chestPain"] = True
    profile["previousHeartProblems"] = "chronic cardiac history"
    r = requests.put(f"{BASE_URL}/api/patients/me/medical-profile", json=profile, headers=headers)
    if r.status_code != 200:
        print("[-] Failed to initialize medical profile fields.")
        sys.exit(1)
    print("[+] Medical profile initialized for Cardiology testing.")

    # ----------------------------------------------------
    # SCENARIO 2: Heart conditions, previous heart problems classified as Cardiology
    # ----------------------------------------------------
    print("\n--- Running Scenario 2: Heart Conditions -> Cardiology Department ---")
    sos_payload_cardiology = {
        "alert_message": "Cardiac emergency",
        "description": "Severe pressure and pain in chest area",
        "symptoms": ["chest pain"],
        "location": {"lat": 12.9716, "lng": 77.5946}
    }
    r = requests.post(f"{BASE_URL}/api/emergency/sos", json=sos_payload_cardiology, headers=headers)
    if r.status_code != 200:
        print("[-] Failed to trigger Cardiology SOS.")
        sys.exit(1)
    sos_cardiology = r.json()
    print(f"[+] SOS Event Triggered: ID={sos_cardiology['id']}")
    print(f"    Assigned Department: {sos_cardiology.get('requiredDepartment')}")
    print(f"    Assigned Hospital ID: {sos_cardiology.get('hospitalId')}")
    
    assert sos_cardiology.get("requiredDepartment") == "Cardiology", "Department should be Cardiology"
    print("[+] Scenario 2 successfully verified.")

    # ----------------------------------------------------
    # SCENARIO 3: Breathing difficulties classified as Pulmonology
    # ----------------------------------------------------
    print("\n--- Running Scenario 3: Breathing Difficulties -> Pulmonology Department ---")
    sos_payload_pulmonology = {
        "alert_message": "Respiratory distress",
        "description": "Shortness of breath and severe coughing",
        "symptoms": ["breathing difficulty"],
        "location": {"lat": 12.9716, "lng": 77.5946}
    }
    r = requests.post(f"{BASE_URL}/api/emergency/sos", json=sos_payload_pulmonology, headers=headers)
    if r.status_code != 200:
        print("[-] Failed to trigger Pulmonology SOS.")
        sys.exit(1)
    sos_pulmonology = r.json()
    print(f"[+] SOS Event Triggered: ID={sos_pulmonology['id']}")
    print(f"    Assigned Department: {sos_pulmonology.get('requiredDepartment')}")
    
    assert sos_pulmonology.get("requiredDepartment") == "Pulmonology", "Department should be Pulmonology"
    print("[+] Scenario 3 successfully verified.")

    # ----------------------------------------------------
    # SCENARIO 4: Other symptoms fallback to Emergency department
    # ----------------------------------------------------
    print("\n--- Running Scenario 4: Other Symptoms -> Emergency Department Fallback ---")
    sos_payload_fallback = {
        "alert_message": "General pain",
        "description": "Stomach cramp and nausea",
        "symptoms": ["abdominal pain"],
        "location": {"lat": 12.9716, "lng": 77.5946}
    }
    r = requests.post(f"{BASE_URL}/api/emergency/sos", json=sos_payload_fallback, headers=headers)
    if r.status_code != 200:
        print("[-] Failed to trigger fallback SOS.")
        sys.exit(1)
    sos_fallback = r.json()
    print(f"[+] SOS Event Triggered: ID={sos_fallback['id']}")
    print(f"    Assigned Department: {sos_fallback.get('requiredDepartment')}")
    
    assert sos_fallback.get("requiredDepartment") == "Emergency", "Department should fallback to Emergency"
    print("[+] Scenario 4 successfully verified.")

    # ----------------------------------------------------
    # SCENARIO 5: Filter hospital capability, check total/available beds, on-duty doctors, available doctors
    # ----------------------------------------------------
    print("\n--- Running Scenario 5: Hospital Capability and Resource Matching ---")
    # Fetch list of hospitals
    r = requests.get(f"{BASE_URL}/api/hospital", headers=headers)
    hospitals = r.json()
    apollo = next(h for h in hospitals if h["name"] == "Apollo Hospital")
    narayana = next(h for h in hospitals if h["name"] == "Narayana Health")
    
    # Apollo is closer to center (12.9716, 77.5946) than Narayana.
    # So the cardiology SOS above (sos_cardiology) was assigned to Apollo.
    print(f"[+] Closest capable hospital (Apollo, ID={apollo['id']}) was assigned: {sos_cardiology.get('hospitalId') == apollo['id']}")
    
    # Now let's change Apollo's Cardiology department to NOT accepting patients
    # First get Apollo's departments
    r = requests.get(f"{BASE_URL}/api/hospital/departments/Apollo Hospital", headers=headers)
    apollo_data = r.json()
    cardiology_dep = next(d for d in apollo_data["departments"] if d["name"] == "Cardiology")
    
    # Set acceptingPatients to False
    cardiology_dep["acceptingPatients"] = False
    r = requests.post(f"{BASE_URL}/api/hospital/departments", json=cardiology_dep, headers=headers)
    if r.status_code != 200:
        print("[-] Failed to disable Apollo Cardiology department.")
        sys.exit(1)
    print("[+] Temporarily set Apollo Cardiology department to not accepting patients.")

    # Trigger a new Cardiology SOS
    r = requests.post(f"{BASE_URL}/api/emergency/sos", json=sos_payload_cardiology, headers=headers)
    sos_cardiology_2 = r.json()
    print(f"[+] New SOS Event Triggered: ID={sos_cardiology_2['id']}")
    print(f"    Assigned Hospital ID: {sos_cardiology_2.get('hospitalId')} (Expected Narayana, ID={narayana['id']})")
    
    # Verify it matched with Narayana Health (the next closest cardiology capable hospital)
    assert sos_cardiology_2.get("hospitalId") == narayana["id"], "Should fallback/route to Narayana Health since Apollo Cardiology is unavailable"
    print("[+] Successfully verified department capability filtering and routing fallback.")

    # Restore Apollo Cardiology department
    cardiology_dep["acceptingPatients"] = True
    requests.post(f"{BASE_URL}/api/hospital/departments", json=cardiology_dep, headers=headers)

    # ----------------------------------------------------
    # SCENARIO 6: Ambulance dispatch check, status busy, verify no other concurrent request gets the busy vehicle
    # ----------------------------------------------------
    print("\n--- Running Scenario 6: Ambulance Dispatch and Concurrent Requests ---")
    # Accept the first SOS request
    r = requests.post(f"{BASE_URL}/api/emergency/{sos_cardiology['id']}/accept", headers=headers)
    sos_cardiology_accepted = r.json()
    amb1_id = sos_cardiology_accepted.get("ambulanceId")
    print(f"[+] SOS Event {sos_cardiology['id']} accepted. Assigned Ambulance ID: {amb1_id}")

    # Check status of that ambulance is now busy
    r = requests.get(f"{BASE_URL}/api/ambulances", headers=headers)
    ambulances = r.json()
    amb1 = next(a for a in ambulances if a["id"] == amb1_id)
    print(f"    Ambulance {amb1['unitId']} status: {amb1['status']}")
    assert amb1["status"] == "busy", "Assigned ambulance should be busy"

    # Accept the second SOS request
    r = requests.post(f"{BASE_URL}/api/emergency/{sos_pulmonology['id']}/accept", headers=headers)
    sos_pulmonology_accepted = r.json()
    amb2_id = sos_pulmonology_accepted.get("ambulanceId")
    print(f"[+] SOS Event {sos_pulmonology['id']} accepted. Assigned Ambulance ID: {amb2_id}")

    # Check they got DIFFERENT ambulances
    assert amb1_id != amb2_id, "Concurrent emergencies must be assigned different available ambulances!"
    print(f"[+] Scenario 6 successfully verified. Concurrent requests received distinct ambulances.")

    # ----------------------------------------------------
    # SCENARIO 7: Real-time update websocket broker
    # ----------------------------------------------------
    print("\n--- Running Scenario 7: WebSocket Live Coordinate Updates ---")
    ws = websocket.create_connection(WS_URL)
    
    # Send CONNECT frame
    connect_frame = "CONNECT\naccept-version:1.1,1.2\nheart-beat:0,0\n\n\u0000"
    ws.send(connect_frame)
    
    # Read response
    resp = ws.recv()
    if "CONNECTED" not in resp:
        print("[-] WebSocket connection failed.")
        sys.exit(1)
    print("[+] STOMP Handshake success: CONNECTED received.")
    
    # Subscribe to active emergency
    sub_frame = f"SUBSCRIBE\nid:sub-0\ndestination:/topic/emergency/{sos_cardiology['id']}\n\n\u0000"
    ws.send(sub_frame)
    print(f"[+] Subscribed to WebSocket broker channel /topic/emergency/{sos_cardiology['id']}")

    # Wait for coordinate frames
    print("[+] Waiting for live location updates from simulator...")
    updates_received = 0
    for _ in range(5):
        msg = ws.recv()
        if "MESSAGE" in msg:
            # Parse STOMP payload body
            body_start = msg.find("\n\n")
            if body_start != -1:
                body = msg[body_start+2:].rstrip("\u0000").strip()
                try:
                    payload = json.loads(body)
                    print(f"    [WS Update] Status: {payload.get('status')} | Ambulance: Lat={payload.get('ambulanceLatitude')}, Lng={payload.get('ambulanceLongitude')} | ETA: {payload.get('eta')}")
                    updates_received += 1
                except Exception as e:
                    pass
        time.sleep(1)

    ws.close()
    assert updates_received > 0, "Should receive location simulation coordinate updates via WebSocket"
    print("[+] Scenario 7 successfully verified. Real-time updates delivered over STOMP/WS.")

    print("\n==================================================")
    print("     ALL 7 SCENARIOS VERIFIED SUCCESSFULLY!       ")
    print("==================================================")

if __name__ == "__main__":
    import json
    run_tests()
