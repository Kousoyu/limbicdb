#!/usr/bin/env python3

import subprocess
import json
import os

# Test direct subprocess call
cmd = ["npx", "tsx", "src/cli/explain.ts", "anime", "--json"]
print(f"Running: {' '.join(cmd)}")

try:
    result = subprocess.run(
        cmd,
        cwd="/tmp/limbicdb",
        capture_output=True,
        text=True,
        timeout=30
    )
    
    print("Return code:", result.returncode)
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    
    if result.returncode == 0:
        try:
            data = json.loads(result.stdout)
            print("Parsed JSON:", data)
        except json.JSONDecodeError as e:
            print("JSON decode error:", e)
    else:
        print("Command failed")
        
except subprocess.TimeoutExpired:
    print("Command timed out")
except Exception as e:
    print("Error:", e)